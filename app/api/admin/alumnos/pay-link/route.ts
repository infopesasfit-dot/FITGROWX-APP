import { NextRequest, NextResponse } from "next/server";
import { getSupabaseAdminClient } from "@/lib/supabase-admin";
import { createSupabaseServerClient } from "@/lib/supabase-server";
import { normalizePhone } from "@/lib/phone";

const sb = getSupabaseAdminClient();
const APP_URL = (process.env.NEXT_PUBLIC_APP_URL ?? "https://app.fitgrowx.com").replace(/\/$/, "");

export async function POST(req: NextRequest) {
  const sbUser = await createSupabaseServerClient();
  const { data: { session } } = await sbUser.auth.getSession();
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { data: profile } = await sb.from("profiles").select("gym_id, role").eq("id", session.user.id).maybeSingle();
  if (!profile?.gym_id || !["admin", "staff"].includes(profile.role ?? ""))
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const { alumno_id } = await req.json();
  if (!alumno_id) return NextResponse.json({ error: "alumno_id requerido" }, { status: 400 });

  const { data: alumno } = await sb
    .from("alumnos")
    .select("id, full_name, phone, gym_id, plan_id, planes(nombre, precio)")
    .eq("id", alumno_id)
    .eq("gym_id", profile.gym_id)
    .maybeSingle();

  if (!alumno) return NextResponse.json({ error: "Alumno no encontrado" }, { status: 404 });
  if (!alumno.phone) return NextResponse.json({ error: "El alumno no tiene teléfono" }, { status: 400 });

  const plan = alumno.planes as unknown as { nombre: string; precio: number } | null;
  if (!plan?.precio) return NextResponse.json({ error: "El alumno no tiene plan con precio asignado" }, { status: 400 });

  // Reusar token vigente o crear uno nuevo
  const now = new Date();
  const { data: existing } = await sb
    .from("alumno_tokens")
    .select("token")
    .eq("alumno_id", alumno_id)
    .gt("expires_at", now.toISOString())
    .order("expires_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  let token = existing?.token;
  if (!token) {
    token = crypto.randomUUID();
    await sb.from("alumno_tokens").insert({
      alumno_id,
      gym_id: profile.gym_id,
      token,
      expires_at: new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000).toISOString(),
    });
  }

  const { data: settings } = await sb
    .from("gym_settings")
    .select("gym_name, mp_access_token, payment_info, slug")
    .eq("gym_id", profile.gym_id)
    .maybeSingle();

  const gymName = settings?.gym_name ?? "el gym";
  const hasMP = !!settings?.mp_access_token;
  const gymParam = settings?.slug ? `&gym=${settings.slug}` : "";
  const link = hasMP
    ? `${APP_URL}/api/alumno/pagar-link?token=${token}`
    : `${APP_URL}/alumno/auth?token=${token}${gymParam}`;

  const precio = plan.precio.toLocaleString("es-AR");
  const msg = hasMP
    ? `💳 *${gymName}* — Link de pago\n\nHola ${alumno.full_name.split(" ")[0]}! Te mandamos tu link para renovar tu membresía *${plan.nombre}* por $${precio}.\n\n👉 ${link}\n\n_Se abre directo en Mercado Pago. Sin registro._`
    : `💳 *${gymName}* — Renovación de membresía\n\nHola ${alumno.full_name.split(" ")[0]}! Tu membresía *${plan.nombre}* es $${precio}.\n\n👉 ${link}\n\n${settings?.payment_info ? `\n💳 Datos de pago:\n${settings.payment_info}` : ""}`;

  const motorUrl = process.env.WA_MOTOR_URL;
  if (!motorUrl) return NextResponse.json({ error: "WA no configurado" }, { status: 500 });

  const waRes = await fetch(`${motorUrl}/send/${profile.gym_id}`, {
    method: "POST",
    headers: { "Content-Type": "application/json", "x-api-key": process.env.WA_MOTOR_API_KEY ?? "" },
    body: JSON.stringify({ phone: normalizePhone(alumno.phone), message: msg }),
    signal: AbortSignal.timeout(8_000),
  }).catch(() => null);

  if (!waRes?.ok) return NextResponse.json({ error: "No se pudo enviar el WA. Verificá que esté conectado." }, { status: 500 });

  return NextResponse.json({ ok: true, link });
}
