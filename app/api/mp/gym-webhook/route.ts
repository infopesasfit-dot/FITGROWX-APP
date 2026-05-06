import { NextRequest, NextResponse } from "next/server";
import { getSupabaseAdminClient } from "@/lib/supabase-admin";
import { addMonths, getTodayDate } from "@/lib/date-utils";

const supabase = getSupabaseAdminClient();
const MOTOR_URL = process.env.WA_MOTOR_URL ?? "";
const MOTOR_KEY = process.env.WA_MOTOR_API_KEY ?? "";

type GymSettingsRow = { mp_access_token: string | null; gym_name: string | null };
type AlumnoRow = {
  id: string;
  full_name: string;
  gym_id: string;
  phone: string | null;
  plan_id: string | null;
  next_expiration_date: string | null;
  planes: { nombre: string; precio: number; periodo: string; duracion_dias: number | null } | null;
};
type ProfileRow = { phone: string | null };

function calcNewExpiry(current: string | null, periodo: string, duracion_dias: number | null): string {
  const today = new Date();
  const base = current && new Date(current) > today ? new Date(current) : today;
  if (duracion_dias && duracion_dias > 0) {
    const d = new Date(base);
    d.setDate(d.getDate() + duracion_dias);
    return d.toISOString().slice(0, 10);
  }
  const MONTHS: Record<string, number> = { mes: 1, mensual: 1, trimestral: 3, anual: 12, año: 12 };
  const DAYS:   Record<string, number> = { semanal: 7, semana: 7 };
  if (MONTHS[periodo]) return addMonths(base, MONTHS[periodo]).toISOString().slice(0, 10);
  const d = new Date(base);
  d.setDate(d.getDate() + (DAYS[periodo] ?? 30));
  return d.toISOString().slice(0, 10);
}

async function sendWA(gym_id: string, phone: string, message: string) {
  if (!MOTOR_URL || !phone) return;
  try {
    await fetch(`${MOTOR_URL}/send/${gym_id}`, {
      method: "POST",
      headers: { "Content-Type": "application/json", "x-api-key": MOTOR_KEY },
      body: JSON.stringify({ phone, message }),
      signal: AbortSignal.timeout(6000),
    });
  } catch { /* non-blocking */ }
}

export async function POST(req: NextRequest) {
  const gym_id = new URL(req.url).searchParams.get("gym_id");
  if (!gym_id) return NextResponse.json({ error: "gym_id requerido." }, { status: 400 });

  // MP sends { id, topic } or { type, data: { id } }
  let body: Record<string, unknown>;
  try { body = await req.json(); } catch { return NextResponse.json({ ok: true }); }

  const topic = (body.topic ?? body.type) as string | undefined;
  if (!topic?.includes("payment")) return NextResponse.json({ ok: true });

  const paymentId = (body.data as Record<string, unknown>)?.id ?? body.id;
  if (!paymentId) return NextResponse.json({ ok: true });

  // Get gym's MP access token
  const { data: gymSettings } = await supabase
    .from("gym_settings")
    .select("mp_access_token, gym_name")
    .eq("gym_id", gym_id)
    .single();

  const gym = gymSettings as GymSettingsRow | null;
  if (!gym?.mp_access_token) return NextResponse.json({ ok: true });

  // Verify payment with gym's own MP token
  const mpRes = await fetch(`https://api.mercadopago.com/v1/payments/${paymentId}`, {
    headers: { Authorization: `Bearer ${gym.mp_access_token}` },
  });
  if (!mpRes.ok) return NextResponse.json({ ok: true });

  const payment = await mpRes.json() as {
    status: string;
    external_reference: string | null;
    transaction_amount: number;
    date_approved: string | null;
  };

  if (payment.status !== "approved") return NextResponse.json({ ok: true });

  // Parse external_reference: "gym_id|alumno_id"
  const parts = (payment.external_reference ?? "").split("|");
  const alumno_id = parts[1];
  if (!alumno_id) return NextResponse.json({ ok: true });

  // Load alumno with plan info
  const { data: alumnoData } = await supabase
    .from("alumnos")
    .select("id, full_name, gym_id, phone, plan_id, next_expiration_date, planes(nombre, precio, periodo, duracion_dias)")
    .eq("id", alumno_id)
    .eq("gym_id", gym_id)
    .single();

  const alumno = alumnoData as AlumnoRow | null;
  if (!alumno) return NextResponse.json({ ok: true });

  const plan = alumno.planes;
  const newExpiry = calcNewExpiry(
    alumno.next_expiration_date,
    plan?.periodo ?? "mensual",
    plan?.duracion_dias ?? null,
  );
  const today = getTodayDate();

  // Renew membership
  await supabase.from("alumnos").update({
    status: "activo",
    last_payment_date: today,
    next_expiration_date: newExpiry,
  }).eq("id", alumno_id);

  // Mark any open free-class prospecto as converted (match by phone in same gym)
  if (alumno.phone) {
    await supabase
      .from("prospectos")
      .update({ clase_gratis_status: "convertido", status: "contactado" })
      .eq("gym_id", gym_id)
      .eq("phone", alumno.phone)
      .not("clase_gratis_date", "is", null)
      .neq("clase_gratis_status", "convertido");
  }

  // Log payment in pagos table
  await supabase.from("pagos").insert({
    gym_id,
    alumno_id,
    amount: payment.transaction_amount,
    date: today,
    method: "mercadopago",
    status: "validado",
    concepto: "membresia",
    descripcion: `Pago MP automático — ${plan?.nombre ?? "Membresía"}`,
    notes: `payment_id:${paymentId}`,
  });

  // In-app notification for gym owner
  try {
    await supabase.from("notifications").insert({
      gym_id,
      type: "pago_mp",
      title: `💳 Pago recibido: ${alumno.full_name}`,
      body: `$${Math.round(payment.transaction_amount).toLocaleString("es-AR")} — ${plan?.nombre ?? "Membresía"}. Membresía renovada hasta el ${newExpiry}.`,
      read: false,
    });
  } catch { /* non-blocking */ }

  // WA to alumno confirming payment
  if (alumno.phone) {
    const fechaFmt = new Date(newExpiry + "T12:00:00").toLocaleDateString("es-AR", { day: "numeric", month: "long" });
    const msgAlumno = `✅ *¡Pago recibido!* Gracias ${alumno.full_name}.\n\nTu membresía en *${gym.gym_name ?? "el gimnasio"}* fue renovada hasta el *${fechaFmt}*. ¡Seguí entrenando! 💪`;
    await sendWA(gym_id, alumno.phone, msgAlumno);
  }

  // WA to gym owner if phone available
  const { data: ownerProfile } = await supabase
    .from("profiles")
    .select("phone")
    .eq("gym_id", gym_id)
    .eq("role", "admin")
    .maybeSingle();

  const owner = ownerProfile as ProfileRow | null;
  if (owner?.phone) {
    const monto = `$${Math.round(payment.transaction_amount).toLocaleString("es-AR")}`;
    const msgOwner = `💳 *Pago MP recibido*\n\n👤 ${alumno.full_name}\n💰 ${monto} — ${plan?.nombre ?? "Membresía"}\n📅 Vence: ${newExpiry}`;
    await sendWA(gym_id, owner.phone, msgOwner);
  }

  return NextResponse.json({ ok: true });
}
