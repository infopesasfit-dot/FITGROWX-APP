import { NextRequest, NextResponse } from "next/server";
import { createHash, createHmac } from "crypto";
import { getSupabaseAdminClient } from "@/lib/supabase-admin";
import { addMonths } from "@/lib/date-utils";

const supabase = getSupabaseAdminClient();
const APP_URL = (process.env.NEXT_PUBLIC_APP_URL ?? "https://app.fitgrowx.com").replace(/\/$/, "");
const MASTER_SECRET = process.env.MP_WEBHOOK_SECRET ?? "";

type AlumnoRow = {
  id: string;
  full_name: string;
  gym_id: string;
  plan_id: string | null;
  next_expiration_date: string | null;
  planes: { nombre: string; precio: number; periodo: string; duracion_dias: number | null } | null;
};

function calcNewExpiry(current: string | null, periodo: string, duracion_dias: number | null): string {
  const today = new Date();
  const base = current && new Date(current) > today ? new Date(current) : today;
  if (duracion_dias && duracion_dias > 0) {
    const d = new Date(base);
    d.setDate(d.getDate() + duracion_dias);
    return d.toISOString().slice(0, 10);
  }
  const MONTHS: Record<string, number> = { mes: 1, mensual: 1, trimestral: 3, anual: 12, año: 12 };
  const DAYS: Record<string, number> = { semanal: 7, semana: 7 };
  if (MONTHS[periodo]) return addMonths(base, MONTHS[periodo]).toISOString().slice(0, 10);
  const d = new Date(base);
  d.setDate(d.getDate() + (DAYS[periodo] ?? 30));
  return d.toISOString().slice(0, 10);
}

// GET /api/alumno/pagar-link?token=xxx
// Validates token → creates MP preference → redirects to checkout.
// If gym has no MP, redirects to the portal (lock screen fallback).
export async function GET(req: NextRequest) {
  const token = req.nextUrl.searchParams.get("token");
  if (!token) return NextResponse.redirect(`${APP_URL}/alumno/login`);

  // Validate token — DB stores SHA-256 hash, never plaintext
  const tokenHash = createHash("sha256").update(String(token)).digest("hex");
  const { data: tokenRow } = await supabase
    .from("alumno_tokens")
    .select("alumno_id, gym_id, expires_at")
    .eq("token", tokenHash)
    .gt("expires_at", new Date().toISOString())
    .maybeSingle();

  if (!tokenRow) return NextResponse.redirect(`${APP_URL}/alumno/login`);

  const portalUrl = `${APP_URL}/alumno/auth?token=${token}`;

  const [{ data: alumnoData }, { data: settingsData }] = await Promise.all([
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

  const alumno = alumnoData as AlumnoRow | null;
  if (!alumno) return NextResponse.redirect(`${APP_URL}/alumno/login`);

  // No MP → fall back to portal
  if (!settingsData?.mp_access_token) return NextResponse.redirect(portalUrl);

  const plan = alumno.planes;
  const precio = plan?.precio ?? 0;
  if (!precio || precio <= 0) return NextResponse.redirect(portalUrl);

  const gymName = settingsData.gym_name ?? "Gimnasio";
  const planNombre = plan?.nombre ?? "Membresía";

  const wt = createHmac("sha256", MASTER_SECRET).update(tokenRow.gym_id).digest("hex").slice(0, 32);

  const prefBody = {
    items: [{
      id: `membresia-${alumno.id}`,
      title: `${planNombre} — ${gymName}`,
      description: `Renovación de membresía de ${alumno.full_name}`,
      quantity: 1,
      currency_id: "ARS",
      unit_price: Math.round(precio),
    }],
    payer: { name: alumno.full_name },
    external_reference: `${tokenRow.gym_id}|${alumno.id}`,
    notification_url: `${APP_URL}/api/mp/gym-webhook?gym_id=${tokenRow.gym_id}&wt=${wt}`,
    back_urls: {
      success: `${APP_URL}/alumno/panel?pago=ok`,
      failure: `${APP_URL}/alumno/panel?pago=error`,
      pending: `${APP_URL}/alumno/panel?pago=pendiente`,
    },
    auto_return: "approved",
    statement_descriptor: gymName.slice(0, 22).toUpperCase(),
  };

  const mpRes = await fetch("https://api.mercadopago.com/checkout/preferences", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${settingsData.mp_access_token}`,
    },
    body: JSON.stringify(prefBody),
  });

  if (!mpRes.ok) return NextResponse.redirect(portalUrl);

  const mpData = await mpRes.json() as { init_point: string };
  return NextResponse.redirect(mpData.init_point);
}
