import { NextRequest, NextResponse } from "next/server";
import { createHmac, timingSafeEqual } from "crypto";
import { getSupabaseAdminClient } from "@/lib/supabase-admin";
import { addMonths, getTodayDate } from "@/lib/date-utils";
import { normalizePhone } from "@/lib/phone";

// ── Cliente y constantes ──────────────────────────────────────────────────────

const supabase     = getSupabaseAdminClient();
const MASTER_SECRET = process.env.MP_WEBHOOK_SECRET ?? process.env.CRON_SECRET ?? "";
const MOTOR_URL    = process.env.WA_MOTOR_URL ?? "";
const MOTOR_KEY    = process.env.WA_MOTOR_API_KEY ?? "";

// ── Tipos ─────────────────────────────────────────────────────────────────────

type GymSettings = {
  mp_access_token: string | null;
  gym_name: string | null;
  whatsapp: string | null;
};

type Alumno = {
  id: string;
  full_name: string;
  gym_id: string;
  phone: string | null;
  plan_id: string | null;
  next_expiration_date: string | null;
  planes: { nombre: string; precio: number; periodo: string; duracion_dias: number | null } | null;
};

type MPPayment = {
  status: string;
  external_reference: string | null;
  transaction_amount: number;
  date_approved: string | null;
};

// ── Seguridad del webhook ─────────────────────────────────────────────────────

function generarTokenWebhook(gymId: string): string {
  return createHmac("sha256", MASTER_SECRET).update(gymId).digest("hex").slice(0, 32);
}

function verificarTokenWebhook(gymId: string, tokenRecibido: string): boolean {
  if (!MASTER_SECRET) return false;
  const esperado = generarTokenWebhook(gymId);
  try {
    return timingSafeEqual(Buffer.from(esperado), Buffer.from(tokenRecibido));
  } catch {
    return false;
  }
}

export { generarTokenWebhook };

// ── Cálculo de vencimiento ────────────────────────────────────────────────────

function calcularNuevoVencimiento(
  vencimientoActual: string | null,
  periodo: string,
  duracionDias: number | null,
): string {
  const hoy  = new Date();
  const base = vencimientoActual && new Date(vencimientoActual) > hoy
    ? new Date(vencimientoActual)
    : hoy;

  if (duracionDias && duracionDias > 0) {
    const d = new Date(base);
    d.setDate(d.getDate() + duracionDias);
    return d.toISOString().slice(0, 10);
  }

  const MESES: Record<string, number> = { mes: 1, mensual: 1, trimestral: 3, anual: 12, año: 12 };
  const DIAS:  Record<string, number> = { semanal: 7, semana: 7 };

  if (MESES[periodo]) return addMonths(base, MESES[periodo]).toISOString().slice(0, 10);
  const d = new Date(base);
  d.setDate(d.getDate() + (DIAS[periodo] ?? 30));
  return d.toISOString().slice(0, 10);
}

// ── Envío WA ──────────────────────────────────────────────────────────────────

async function enviarMensajeWA(gymId: string, phone: string, message: string): Promise<void> {
  if (!MOTOR_URL || !phone) return;
  try {
    await fetch(`${MOTOR_URL}/send/${gymId}`, {
      method: "POST",
      headers: { "Content-Type": "application/json", "x-api-key": MOTOR_KEY },
      body: JSON.stringify({ phone: normalizePhone(phone), message }),
      signal: AbortSignal.timeout(6000),
    });
  } catch (e) {
    console.error(`[gym-webhook] enviarMensajeWA gym=${gymId}:`, e instanceof Error ? e.message : e);
  }
}

// ── Consulta del pago a MP ────────────────────────────────────────────────────

async function consultarPagoMP(paymentId: string, accessToken: string): Promise<MPPayment | null> {
  const res = await fetch(`https://api.mercadopago.com/v1/payments/${paymentId}`, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  if (!res.ok) {
    console.error(`[gym-webhook] consultarPagoMP paymentId=${paymentId} HTTP ${res.status}`);
    return null;
  }
  return res.json() as Promise<MPPayment>;
}

// ── Idempotencia ──────────────────────────────────────────────────────────────

type RegistrarPagoResult = "ok" | "duplicado" | "error";

async function registrarPago(
  gymId: string,
  alumnoId: string,
  monto: number,
  paymentId: string,
  planNombre: string,
  today: string,
): Promise<RegistrarPagoResult> {
  const { error } = await supabase.from("pagos").insert({
    gym_id:      gymId,
    alumno_id:   alumnoId,
    amount:      monto,
    date:        today,
    method:      "mercadopago",
    status:      "validado",
    concepto:    "membresia",
    descripcion: `Pago MP automático — ${planNombre}`,
    notes:       `payment_id:${paymentId}`,
    mp_payment_id: paymentId,
  });

  if (!error) return "ok";
  if (error.code === "23505") return "duplicado";

  console.error("[gym-webhook] registrarPago:", error.message, { gymId, alumnoId, paymentId });
  return "error";
}

// ── Actualización de membresía ────────────────────────────────────────────────

async function extenderMembresia(alumnoId: string, today: string, nuevoVencimiento: string): Promise<void> {
  const { error } = await supabase.from("alumnos")
    .update({ status: "activo", last_payment_date: today, next_expiration_date: nuevoVencimiento })
    .eq("id", alumnoId);
  if (error) console.error(`[gym-webhook] extenderMembresia alumno=${alumnoId}:`, error.message);
}

async function convertirProspectoSiExiste(gymId: string, phone: string): Promise<void> {
  const { error } = await supabase
    .from("prospectos")
    .update({ clase_gratis_status: "convertido", status: "contactado" })
    .eq("gym_id", gymId)
    .eq("phone", phone)
    .not("clase_gratis_date", "is", null)
    .neq("clase_gratis_status", "convertido");
  if (error) console.error("[gym-webhook] convertirProspecto:", error.message);
}

async function crearNotificacionInApp(
  gymId: string,
  alumnoNombre: string,
  monto: number,
  planNombre: string,
  vencimiento: string,
): Promise<void> {
  const { error } = await supabase.from("notifications").insert({
    gym_id: gymId,
    type:   "pago_mp",
    title:  `💳 Pago recibido: ${alumnoNombre}`,
    body:   `$${Math.round(monto).toLocaleString("es-AR")} — ${planNombre}. Membresía renovada hasta el ${vencimiento}.`,
    read:   false,
  });
  if (error) console.error("[gym-webhook] crearNotificacionInApp:", error.message);
}

async function notificarDueno(
  gymId: string,
  gym: GymSettings,
  alumno: Alumno,
  monto: number,
  planNombre: string,
  nuevoVencimiento: string,
  today: string,
): Promise<void> {
  const [ownerRes, dupRes] = await Promise.all([
    supabase.from("profiles").select("phone").eq("gym_id", gymId).eq("role", "admin").maybeSingle(),
    supabase.from("pagos")
      .select("id", { count: "exact", head: true })
      .eq("gym_id", gymId)
      .eq("alumno_id", alumno.id)
      .eq("status", "validado")
      .neq("method", "mercadopago")
      .eq("date", today),
  ]);

  const ownerPhone = (ownerRes.data as { phone: string | null } | null)?.phone ?? null;
  const gymWaPhone = gym.whatsapp ? normalizePhone(gym.whatsapp) : null;
  const esMismoNumero = ownerPhone && gymWaPhone && normalizePhone(ownerPhone) === gymWaPhone;

  if (!ownerPhone || esMismoNumero) return;

  const montoFmt    = `$${Math.round(monto).toLocaleString("es-AR")}`;
  const dupWarning  = (dupRes.count ?? 0) > 0
    ? `\n\n⚠️ *Atención:* Este alumno ya tiene un pago registrado hoy por otro medio. Verificá si fue un pago duplicado.`
    : "";
  const mensaje = `💳 *Pago MP recibido*\n\n👤 ${alumno.full_name}\n💰 ${montoFmt} — ${planNombre}\n📅 Vence: ${nuevoVencimiento}${dupWarning}`;

  await enviarMensajeWA(gymId, ownerPhone, mensaje);
}

// ── Log de webhook ────────────────────────────────────────────────────────────

function logWebhook(
  gymId: string | null,
  paymentId: string | null,
  status: "received" | "processed" | "duplicate" | "error" | "ignored",
  opts?: { amount?: number; alumnoId?: string; errorMsg?: string },
) {
  void supabase.from("mp_webhook_log").insert({
    source:     "gym",
    gym_id:     gymId,
    payment_id: paymentId,
    event_type: "payment",
    status,
    amount:     opts?.amount ?? null,
    alumno_id:  opts?.alumnoId ?? null,
    error_msg:  opts?.errorMsg ?? null,
  });
}

// ── Handler principal ─────────────────────────────────────────────────────────

export async function POST(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const gymId = searchParams.get("gym_id");
  const wt    = searchParams.get("wt") ?? "";

  if (!gymId) return NextResponse.json({ error: "gym_id requerido." }, { status: 400 });
  if (!verificarTokenWebhook(gymId, wt)) return NextResponse.json({ error: "Token inválido." }, { status: 401 });

  let body: Record<string, unknown>;
  try { body = await req.json(); } catch { return NextResponse.json({ ok: true }); }

  const topic = (body.topic ?? body.type) as string | undefined;
  if (!topic?.includes("payment")) return NextResponse.json({ ok: true });

  const paymentId = String((body.data as Record<string, unknown>)?.id ?? body.id ?? "");
  if (!paymentId) return NextResponse.json({ ok: true });

  logWebhook(gymId, paymentId, "received");

  // Cargar credenciales del gym
  const { data: gymData } = await supabase
    .from("gym_settings")
    .select("mp_access_token, gym_name, whatsapp")
    .eq("gym_id", gymId)
    .single();

  const gym = gymData as GymSettings | null;
  if (!gym?.mp_access_token) return NextResponse.json({ ok: true });

  // Verificar pago con MP
  const payment = await consultarPagoMP(paymentId, gym.mp_access_token);
  if (!payment || payment.status !== "approved") return NextResponse.json({ ok: true });

  // Parsear referencia: "gym_id|alumno_id"
  const [refGymId, alumnoId] = (payment.external_reference ?? "").split("|");
  if (refGymId !== gymId || !alumnoId) return NextResponse.json({ ok: true });

  // Cargar alumno con su plan
  const { data: alumnoData } = await supabase
    .from("alumnos")
    .select("id, full_name, gym_id, phone, plan_id, next_expiration_date, planes(nombre, precio, periodo, duracion_dias)")
    .eq("id", alumnoId)
    .eq("gym_id", gymId)
    .single();

  const alumno = alumnoData as Alumno | null;
  if (!alumno) return NextResponse.json({ ok: true });

  const plan           = alumno.planes;
  const planNombre     = plan?.nombre ?? "Membresía";
  const nuevoVencimiento = calcularNuevoVencimiento(alumno.next_expiration_date, plan?.periodo ?? "mensual", plan?.duracion_dias ?? null);
  const today          = getTodayDate();

  // ── Gate de idempotencia ──────────────────────────────────────────────────────
  // registrarPago hace INSERT con mp_payment_id (unique constraint).
  // Si el mismo payment_id llega dos veces, el segundo INSERT falla con código 23505
  // y devuelve "duplicado" → respondemos 200 sin tocar la membresía.
  const resultadoPago = await registrarPago(gymId, alumnoId, payment.transaction_amount, paymentId, planNombre, today);

  if (resultadoPago === "error") {
    logWebhook(gymId, paymentId, "error", { amount: payment.transaction_amount, alumnoId, errorMsg: "registrarPago failed" });
    return NextResponse.json({ error: "db_error" }, { status: 500 });
  }

  if (resultadoPago === "duplicado") {
    logWebhook(gymId, paymentId, "duplicate", { amount: payment.transaction_amount, alumnoId });
    return NextResponse.json({ ok: true });
  }

  // Solo llegamos acá la primera vez (resultadoPago === "ok")
  await extenderMembresia(alumnoId, today, nuevoVencimiento);
  // ─────────────────────────────────────────────────────────────────────────────

  logWebhook(gymId, paymentId, "processed", { amount: payment.transaction_amount, alumnoId });

  // Acciones post-pago (non-blocking: errores no deben bloquear la respuesta a MP)
  await Promise.allSettled([
    alumno.phone ? convertirProspectoSiExiste(gymId, alumno.phone) : Promise.resolve(),
    crearNotificacionInApp(gymId, alumno.full_name, payment.transaction_amount, planNombre, nuevoVencimiento),
  ]);

  // WA al alumno
  if (alumno.phone) {
    const fechaFmt = new Date(nuevoVencimiento + "T12:00:00")
      .toLocaleDateString("es-AR", { day: "numeric", month: "long" });
    const msgAlumno = `✅ *¡Pago recibido!* Gracias ${alumno.full_name}.\n\nTu membresía en *${gym.gym_name ?? "el gimnasio"}* fue renovada hasta el *${fechaFmt}*. ¡Seguí entrenando! 💪`;
    await enviarMensajeWA(gymId, alumno.phone, msgAlumno);
  }

  // WA al dueño
  await notificarDueno(gymId, gym, alumno, payment.transaction_amount, planNombre, nuevoVencimiento, today);

  return NextResponse.json({ ok: true });
}
