import { NextRequest, NextResponse } from "next/server";
import { createHmac } from "crypto";
import { getValidAlumnoToken } from "@/lib/alumno-token";
import { getSupabaseAdminClient } from "@/lib/supabase-admin";
import { addMonths } from "@/lib/date-utils";
import { logAlumnoAction } from "@/lib/alumno-logging";
import { applyAlumnoRateLimit } from "@/lib/alumno-rate-limit";

const MASTER_SECRET = process.env.MP_WEBHOOK_SECRET ?? "";

if (!MASTER_SECRET) {
  throw new Error("MP_WEBHOOK_SECRET no configurado. La API pagar no puede inicializar.");
}

const supabase = getSupabaseAdminClient();
const APP_URL = process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";

type AlumnoRow = {
  id: string;
  full_name: string;
  gym_id: string;
  plan_id: string | null;
  next_expiration_date: string | null;
  planes: { nombre: string; precio: number; periodo: string; duracion_dias: number | null } | null;
};

type GymSettingsRow = { mp_access_token: string | null; gym_name: string | null };

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

export async function POST(req: NextRequest) {
  const tokenRow = await getValidAlumnoToken(req);
  if (!tokenRow) return NextResponse.json({ error: "No autorizado." }, { status: 401 });

  const rateLimit = await applyAlumnoRateLimit(req, tokenRow.alumno_id, { windowMs: 60_000, maxAttempts: 5 });
  if (!rateLimit.allowed) return rateLimit.response!;

  const [{ data: alumno }, { data: settings }] = await Promise.all([
    supabase
      .from("alumnos")
      .select("id, full_name, gym_id, plan_id, next_expiration_date, planes(nombre, precio, periodo, duracion_dias)")
      .eq("id", tokenRow.alumno_id)
      .is("deleted_at", null)
      .single(),
    supabase
      .from("gym_settings")
      .select("mp_access_token, gym_name")
      .eq("gym_id", tokenRow.gym_id)
      .single(),
  ]);

  const alumnoRow = alumno as AlumnoRow | null;
  const gymRow = settings as GymSettingsRow | null;

  if (!alumnoRow) return NextResponse.json({ error: "Alumno no encontrado." }, { status: 404 });
  if (!gymRow?.mp_access_token) {
    return NextResponse.json({ error: "El gimnasio no tiene MercadoPago configurado." }, { status: 422 });
  }

  const plan = alumnoRow.planes;
  const precio = plan?.precio ?? 0;
  const planNombre = plan?.nombre ?? "Membresía";
  const gymName = gymRow.gym_name ?? "Gimnasio";

  if (!precio || precio <= 0) {
    return NextResponse.json({ error: "No se pudo determinar el precio del plan." }, { status: 422 });
  }

  const wt = createHmac("sha256", MASTER_SECRET).update(tokenRow.gym_id).digest("hex").slice(0, 32);
  const notificationUrl = `${APP_URL}/api/mp/gym-webhook?gym_id=${tokenRow.gym_id}&wt=${wt}`;

  const prefBody = {
    items: [
      {
        id: `membresia-${tokenRow.alumno_id}`,
        title: `${planNombre} — ${gymName}`,
        description: `Renovación de membresía de ${alumnoRow.full_name}`,
        quantity: 1,
        currency_id: "ARS",
        unit_price: Math.round(precio),
      },
    ],
    payer: { name: alumnoRow.full_name },
    external_reference: `${tokenRow.gym_id}|${tokenRow.alumno_id}`,
    notification_url: notificationUrl,
    back_urls: {
      success:  `${APP_URL}/alumno/panel?pago=ok`,
      failure:  `${APP_URL}/alumno/panel?pago=error`,
      pending:  `${APP_URL}/alumno/panel?pago=pendiente`,
    },
    auto_return: "approved",
    statement_descriptor: gymName.slice(0, 22).toUpperCase(),
  };

  const mpRes = await fetch("https://api.mercadopago.com/checkout/preferences", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${gymRow.mp_access_token}`,
    },
    body: JSON.stringify(prefBody),
  });

  if (!mpRes.ok) {
    const err = await mpRes.text();
    console.error("[alumno/pagar] MP error:", err);
    await logAlumnoAction({ alumno_id: tokenRow.alumno_id, gym_id: tokenRow.gym_id, action: "pago_initiated", status: "error", error_msg: `MP error: ${mpRes.status}` });
    return NextResponse.json({ error: "No se pudo generar el link de pago." }, { status: 502 });
  }

  const mpData = await mpRes.json() as { init_point: string };
  await logAlumnoAction({ alumno_id: tokenRow.alumno_id, gym_id: tokenRow.gym_id, action: "pago_initiated", status: "success", details: { precio, plan: alumnoRow.planes?.nombre } });
  return NextResponse.json({ init_point: mpData.init_point });
}
