import { NextRequest, NextResponse } from "next/server";
import { createHmac, timingSafeEqual } from "crypto";
import { getSupabaseAdminClient } from "@/lib/supabase-admin";
import { logger } from "@/lib/logger";
import { withApiHandler } from "@/lib/api-error";
import { addMonths, getTodayDate } from "@/lib/date-utils";
import { normalizePhone } from "@/lib/phone";
import { logAlumnoActivity } from "@/lib/alumno-log";
import { fetchMpWithTimeout } from "@/lib/mp/timeout";

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

export { generarTokenWebhook, verificarTokenWebhook, calcularNuevoVencimiento };

// ── Cálculo de vencimiento ────────────────────────────────────────────────────

function calcularNuevoVencimiento(
  vencimientoActual: string | null,
  periodo: string,
  duracionDias: number | null,
): string {
  // Work with YYYY-MM-DD strings in Argentina time throughout.
  // Parsing "YYYY-MM-DD" directly avoids UTC-offset surprises.
  const hoyStr = getTodayDate(); // "YYYY-MM-DD" en ART
  const baseStr = vencimientoActual && vencimientoActual > hoyStr
    ? vencimientoActual
    : hoyStr;

  // Parse as local-noon to prevent DST edge cases when doing day arithmetic.
  const base = new Date(`${baseStr}T12:00:00`);

  if (duracionDias && duracionDias > 0) {
    const d = new Date(base);
    d.setDate(d.getDate() + duracionDias);
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
  }

  const MESES: Record<string, number> = { mes: 1, mensual: 1, trimestral: 3, anual: 12, año: 12 };
  const DIAS:  Record<string, number> = { semanal: 7, semana: 7 };

  if (MESES[periodo]) {
    const r = addMonths(base, MESES[periodo]);
    return `${r.getFullYear()}-${String(r.getMonth() + 1).padStart(2, "0")}-${String(r.getDate()).padStart(2, "0")}`;
  }
  const d = new Date(base);
  d.setDate(d.getDate() + (DIAS[periodo] ?? 30));
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

// ── Envío WA ──────────────────────────────────────────────────────────────────

async function enviarMensajeWA(gymId: string, phone: string, message: string): Promise<void> {
  if (!MOTOR_URL || !phone) return;
  try {
    await fetch(`${MOTOR_URL}/send/${gymId}`, {
      method: "POST",
      headers: { "Content-Type": "application/json", "x-api-key": MOTOR_KEY },
      body: JSON.stringify({ phone: normalizePhone(phone), message }),
      signal: AbortSignal.timeout(3000),
    });
  } catch (e) {
    void logger.error("enviarMensajeWA failed", { route: "/api/mp/gym-webhook", meta: { gymId, error: String(e) } });
  }
}

// ── Consulta del pago a MP ────────────────────────────────────────────────────

async function consultarPagoMP(paymentId: string, accessToken: string): Promise<MPPayment | null> {
  const result = await fetchMpWithTimeout(`https://api.mercadopago.com/v1/payments/${paymentId}`, {
    method: "GET",
    headers: { Authorization: `Bearer ${accessToken}` },
    retryable: true,
  });
  if (!result.ok) {
    void logger.error("consultarPagoMP failed", { route: "/api/mp/gym-webhook", meta: { paymentId, status: result.status } });
    return null;
  }
  return result.data as MPPayment;
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
  resultingExpiry: string,
): Promise<RegistrarPagoResult> {
  const { error } = await supabase.from("pagos").insert({
    gym_id:          gymId,
    alumno_id:       alumnoId,
    amount:          monto,
    date:            today,
    method:          "mercadopago",
    status:          "validado",
    concepto:        "membresia",
    descripcion:     `Pago MP automático — ${planNombre}`,
    notes:           `payment_id:${paymentId}`,
    mp_payment_id:   paymentId,
    resulting_expiry: resultingExpiry,
  });

  if (!error) return "ok";
  if (error.code === "23505") return "duplicado";

  void logger.error("registrarPago failed", { route: "/api/mp/gym-webhook", meta: { gymId, alumnoId, paymentId, error: error.message } });
  return "error";
}

// ── Actualización de membresía ────────────────────────────────────────────────

async function extenderMembresia(alumnoId: string, today: string, nuevoVencimiento: string): Promise<void> {
  const { error } = await supabase.from("alumnos")
    .update({ status: "activo", last_payment_date: today, next_expiration_date: nuevoVencimiento })
    .eq("id", alumnoId);
  if (error) void logger.error("extenderMembresia failed", { route: "/api/mp/gym-webhook", meta: { alumnoId, error: error.message } });
}

async function convertirProspectoSiExiste(gymId: string, phone: string): Promise<void> {
  const { error } = await supabase
    .from("prospectos")
    .update({ clase_gratis_status: "convertido", status: "contactado" })
    .eq("gym_id", gymId)
    .eq("phone", phone)
    .not("clase_gratis_date", "is", null)
    .neq("clase_gratis_status", "convertido");
  if (error) void logger.error("convertirProspecto failed", { route: "/api/mp/gym-webhook", meta: { gymId, error: error.message } });
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
  if (error) void logger.error("crearNotificacionInApp failed", { route: "/api/mp/gym-webhook", meta: { gymId, error: error.message } });
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

async function handlePost(req: NextRequest): Promise<NextResponse> {
  const { searchParams } = new URL(req.url);
  const gymId = searchParams.get("gym_id");
  const wt    = searchParams.get("wt") ?? "";

  if (!gymId) return NextResponse.json({ error: "gym_id requerido." }, { status: 400 });
  if (!verificarTokenWebhook(gymId, wt)) return NextResponse.json({ error: "Token inválido." }, { status: 401 });

  // x-signature no se valida: cada gym usa su propia clave secreta de MP
  // que la plataforma no conoce. La autenticidad está cubierta por wt (HMAC
  // por-gym en la URL) + verificación del pago contra la API de MP.

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
    .eq("is_demo", false)
    .is("deleted_at", null)
    .single();

  const alumno = alumnoData as Alumno | null;
  if (!alumno) return NextResponse.json({ ok: true });

  const plan           = alumno.planes;
  const planNombre     = plan?.nombre ?? "Membresía";
  const nuevoVencimiento = calcularNuevoVencimiento(alumno.next_expiration_date, plan?.periodo ?? "mensual", plan?.duracion_dias ?? null);
  const today          = getTodayDate();

  // ── Validación monto vs precio del plan (alerta, no bloquea el cobro) ─────────
  // No castigamos a un alumno que pagó por un problema de configuración: se
  // registra y extiende igual, pero avisamos al dueño para que reconcilie.
  const precioEsperado = plan?.precio != null ? Math.round(plan.precio) : null;
  const montoOk = precioEsperado != null &&
    Math.abs(payment.transaction_amount - precioEsperado) <= Math.max(precioEsperado * 0.05, 1);
  if (!plan || !montoOk) {
    const detalle = !plan
      ? "alumno sin plan asignado"
      : `monto $${payment.transaction_amount} ≠ precio del plan $${precioEsperado}`;
    logWebhook(gymId, paymentId, "error", { amount: payment.transaction_amount, alumnoId, errorMsg: detalle });
    void supabase.from("notifications").insert({
      gym_id: gymId,
      type:   "pago_mp",
      title:  `⚠️ Revisá un pago de ${alumno.full_name}`,
      body:   `Pago de $${Math.round(payment.transaction_amount).toLocaleString("es-AR")} — ${detalle}. Verificá el plan o el monto.`,
      read:   false,
    });
  }

  // ── Vencimiento futuro: apilar en vez de descartar ────────────────────────────
  // Si el alumno ya tiene un vencimiento futuro (p. ej. renovó anticipado o pagó
  // manualmente), NO descartamos el pago: se registra y la membresía se extiende
  // APILANDO sobre el vencimiento vigente. `nuevoVencimiento` ya parte de esa
  // fecha futura (ver calcularNuevoVencimiento), así que el flujo normal de abajo
  // —registro idempotente por mp_payment_id + extensión + notificación— hace lo
  // correcto. La unicidad de mp_payment_id evita doble-apilado en reintentos de MP.
  // ─────────────────────────────────────────────────────────────────────────────

  // ── Gate de idempotencia ──────────────────────────────────────────────────────
  // registrarPago hace INSERT con mp_payment_id (unique constraint).
  // Si el mismo payment_id llega dos veces, el segundo INSERT falla con código 23505
  // y devuelve "duplicado" → respondemos 200 sin tocar la membresía.
  const resultadoPago = await registrarPago(gymId, alumnoId, payment.transaction_amount, paymentId, planNombre, today, nuevoVencimiento);

  if (resultadoPago === "error") {
    logWebhook(gymId, paymentId, "error", { amount: payment.transaction_amount, alumnoId, errorMsg: "registrarPago failed" });
    return NextResponse.json({ error: "db_error" }, { status: 500 });
  }

  if (resultadoPago === "duplicado") {
    // Pago ya registrado — verificar si extenderMembresia se completó en el intento anterior.
    // Si no (crash entre INSERT y UPDATE), completar la extensión ahora.
    const { data: alumnoActual } = await supabase
      .from("alumnos")
      .select("next_expiration_date, status")
      .eq("id", alumnoId)
      .is("deleted_at", null)
      .single();
    const fechaVigenteOVencida =
      !alumnoActual?.next_expiration_date || alumnoActual.next_expiration_date < today;
    if (fechaVigenteOVencida) {
      await extenderMembresia(alumnoId, today, nuevoVencimiento);
    }
    logWebhook(gymId, paymentId, "duplicate", { amount: payment.transaction_amount, alumnoId });
    return NextResponse.json({ ok: true });
  }

  // Solo llegamos acá la primera vez (resultadoPago === "ok")
  await extenderMembresia(alumnoId, today, nuevoVencimiento);

  // Registrar ingreso en egresos — no bloqueante
  void supabase.from("egresos").insert({
    gym_id:    gymId,
    titulo:    `Membresía MP — ${alumno.full_name}`,
    monto:     payment.transaction_amount,
    categoria: "Membresías",
    fecha:     today,
    metodo:    "mercadopago",
  }).then(({ error: eErr }) => {
    if (eErr) void logger.error("egresos insert failed", { route: "/api/mp/gym-webhook", meta: { gymId, alumnoId, paymentId, error: eErr.message } });
  });
  // ─────────────────────────────────────────────────────────────────────────────

  // Invalidate dashboard snapshot so next load reflects this payment
  void supabase.from("dashboard_snapshots").delete()
    .eq("gym_id", gymId).eq("month_key", today.slice(0, 7));

  logWebhook(gymId, paymentId, "processed", { amount: payment.transaction_amount, alumnoId });
  void logAlumnoActivity(alumnoId, gymId, "pago", `Pago $${payment.transaction_amount} via MercadoPago · ${planNombre} · vence ${nuevoVencimiento}`, "webhook_mp", { payment_id: paymentId, amount: payment.transaction_amount });

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

export const POST = withApiHandler(handlePost);
