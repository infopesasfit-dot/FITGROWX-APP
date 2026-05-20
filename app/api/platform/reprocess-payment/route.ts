import { NextRequest, NextResponse } from "next/server";
import { getSupabaseAdminClient } from "@/lib/supabase-admin";
import { createSupabaseServerClient } from "@/lib/supabase-server";
import { addMonths, getTodayDate } from "@/lib/date-utils";

export const dynamic = "force-dynamic";

async function assertPlatformOwner() {
  const sbUser = await createSupabaseServerClient();
  const { data: { user } } = await sbUser.auth.getUser();
  if (!user) return null;
  const sb = getSupabaseAdminClient();
  const { data: profile } = await sb.from("profiles").select("role").eq("id", user.id).maybeSingle();
  return profile?.role === "platform_owner" ? sb : null;
}

function calcExpiry(current: string | null, periodo: string, duracionDias: number | null): string {
  const hoy  = new Date();
  const base = current && new Date(current) > hoy ? new Date(current) : hoy;
  if (duracionDias && duracionDias > 0) {
    const d = new Date(base); d.setDate(d.getDate() + duracionDias); return d.toISOString().slice(0, 10);
  }
  const MESES: Record<string, number> = { mes: 1, mensual: 1, trimestral: 3, anual: 12, año: 12 };
  const months = MESES[periodo.toLowerCase()];
  if (months && months > 0) return addMonths(base, months).toISOString().slice(0, 10);
  // Fallback: 30 días (con log para debugging)
  console.warn(`[calcExpiry] Período inválido "${periodo}", usando fallback 30 días`);
  const d = new Date(base); d.setDate(d.getDate() + 30); return d.toISOString().slice(0, 10);
}

export async function POST(req: NextRequest) {
  const sb = await assertPlatformOwner();
  if (!sb) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const { payment_id, gym_id, log_id } = await req.json() as { payment_id: string; gym_id: string; log_id?: string };
  if (!payment_id || !gym_id) return NextResponse.json({ error: "payment_id y gym_id requeridos" }, { status: 400 });

  // 1. Obtener access token del gym
  const { data: gymSettings } = await sb
    .from("gym_settings")
    .select("mp_access_token, gym_name")
    .eq("gym_id", gym_id)
    .maybeSingle();

  if (!gymSettings?.mp_access_token) {
    return NextResponse.json({ error: "El gym no tiene MP configurado" }, { status: 400 });
  }

  // 2. Consultar pago en MP
  const mpRes = await fetch(`https://api.mercadopago.com/v1/payments/${payment_id}`, {
    headers: { Authorization: `Bearer ${gymSettings.mp_access_token}` },
  });
  if (!mpRes.ok) return NextResponse.json({ error: `MP API error ${mpRes.status}` }, { status: 502 });

  const payment = await mpRes.json() as {
    status: string;
    external_reference: string | null;
    transaction_amount: number;
  };

  if (payment.status !== "approved") {
    return NextResponse.json({ error: `Pago no está aprobado en MP (status: ${payment.status})` }, { status: 400 });
  }

  const [refGymId, alumnoId] = (payment.external_reference ?? "").split("|");
  if (refGymId !== gym_id || !alumnoId) {
    return NextResponse.json({ error: "external_reference no coincide con el gym_id" }, { status: 400 });
  }

  // 3. Cargar alumno con plan
  const { data: alumnoData } = await sb
    .from("alumnos")
    .select("id, full_name, gym_id, plan_id, next_expiration_date, planes(nombre, precio, periodo, duracion_dias)")
    .eq("id", alumnoId)
    .eq("gym_id", gym_id)
    .single();

  if (!alumnoData) return NextResponse.json({ error: "Alumno no encontrado" }, { status: 404 });

  const alumno = alumnoData as unknown as {
    id: string; full_name: string; gym_id: string; next_expiration_date: string | null;
    planes: { nombre: string; precio: number; periodo: string; duracion_dias: number | null } | null;
  };

  const plan          = alumno.planes;
  const planNombre    = plan?.nombre ?? "Membresía";
  const nuevoVenc     = calcExpiry(alumno.next_expiration_date, plan?.periodo ?? "mensual", plan?.duracion_dias ?? null);
  const today         = getTodayDate();

  // 4. Insertar pago (idempotente por mp_payment_id)
  const { error: pagoErr } = await sb.from("pagos").insert({
    gym_id: gym_id, alumno_id: alumnoId, amount: payment.transaction_amount,
    date: today, method: "mercadopago", status: "validado", concepto: "membresia",
    descripcion: `Re-proceso manual — ${planNombre}`,
    notes: `payment_id:${payment_id}`, mp_payment_id: payment_id,
    resulting_expiry: nuevoVenc,
  });
  const isDuplicate = pagoErr?.code === "23505";
  if (pagoErr && !isDuplicate) {
    return NextResponse.json({ error: `DB error al insertar pago: ${pagoErr.message}` }, { status: 500 });
  }

  // 5. Actualizar membresía
  const { error: alumnoErr } = await sb.from("alumnos")
    .update({ status: "activo", last_payment_date: today, next_expiration_date: nuevoVenc })
    .eq("id", alumnoId);
  if (alumnoErr) return NextResponse.json({ error: `DB error al extender membresía: ${alumnoErr.message}` }, { status: 500 });

  // 6. Marcar log como procesado
  if (log_id) {
    await sb.from("mp_webhook_log").update({ status: "processed", error_msg: null }).eq("id", log_id);
  }

  return NextResponse.json({
    ok: true,
    alumno: alumno.full_name,
    nuevo_vencimiento: nuevoVenc,
    pago: isDuplicate ? "ya_existia" : "insertado",
  });
}
