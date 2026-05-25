import { NextRequest, NextResponse } from "next/server";
import { getSupabaseAdminClient } from "@/lib/supabase-admin";
import { createSupabaseServerClient } from "@/lib/supabase-server";
import { normalizePhone } from "@/lib/phone";
import { logger } from "@/lib/logger";
import { sendWa as sendWaLib } from "@/lib/wa";
import { ensureGymBranding } from "@/lib/messaging-helpers";
import { createHash } from "crypto";

const ROUTE = "/api/alumno/send-welcome";

function fill(template: string, nombre: string, gym: string, link = "") {
  return template
    .replace(/\[Nombre\]/g, nombre).replace(/\{nombre\}/gi, nombre)
    .replace(/\[Gym\]/g,    gym)   .replace(/\{gym\}/gi,    gym)
    .replace(/\[Link\]/g,   link)  .replace(/\{link\}/gi,   link);
}

const supabase = getSupabaseAdminClient();

const DEFAULT_WELCOME =
  `Hola {nombre}, soy del staff de {gym}. Te paso el link para que entres a la app:\n\n{link}\n\nCualquier duda escribime.`;

const DEFAULT_APP_MSG =
  `¡Bienvenido a {gym}, {nombre}! 💪 Ya podés acceder a la app desde acá:\n\n{link}`;

const DEFAULT_RENEWAL =
  `Hola {nombre}, te recordamos que tu cuota de {gym} vence en {dias} días ({fecha}). Si querés renovarla, avisanos por acá.`;

// type: "welcome" → nuevo alumno, "renewal" → renovó cuota
export async function POST(req: NextRequest) {
  const requestId = crypto.randomUUID().slice(0, 8);

  const sessionClient = await createSupabaseServerClient();
  const { data: { user } } = await sessionClient.auth.getUser();
  if (!user) return NextResponse.json({ ok: false }, { status: 401 });

  const { data: callerProfile } = await supabase
    .from("profiles")
    .select("gym_id, role")
    .eq("id", user.id)
    .maybeSingle();

  if (!callerProfile?.gym_id || !["admin", "staff"].includes(callerProfile.role ?? "")) {
    return NextResponse.json({ ok: false }, { status: 403 });
  }

  const { alumno_id, type = "welcome" } = await req.json();
  if (!alumno_id) return NextResponse.json({ ok: true });

  const { data: alumno } = await supabase
    .from("alumnos")
    .select("id, gym_id, full_name, phone")
    .eq("id", alumno_id)
    .eq("gym_id", callerProfile.gym_id)
    .single();

  if (!alumno?.phone) {
    logger.warn("send-welcome: alumno sin teléfono, mensaje omitido", { route: ROUTE, meta: { requestId, alumno_id, type } });
    return NextResponse.json({ ok: true });
  }

  // Crear token de 30 días
  const now = new Date();
  const { data: existing } = await supabase
    .from("alumno_tokens")
    .select("id")
    .eq("alumno_id", alumno.id)
    .gt("expires_at", now.toISOString())
    .maybeSingle();

  if (existing) {
    await supabase
      .from("alumno_tokens")
      .update({ expires_at: now.toISOString() })
      .eq("id", existing.id);
  }

  const rawToken = crypto.randomUUID();
  const tokenHash = createHash("sha256").update(rawToken).digest("hex");
  const expires_at = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000).toISOString();
  await supabase.from("alumno_tokens").insert({
    alumno_id: alumno.id,
    gym_id: alumno.gym_id,
    token: tokenHash,
    expires_at,
  });

  let token = rawToken;

  const [{ data: settings }, { data: gym }] = await Promise.all([
    supabase.from("gym_settings")
      .select("gym_name, magiclink_msg, bienvenida_app_msg, renewal_msg, renewal_activo, bienvenida_activo")
      .eq("gym_id", alumno.gym_id)
      .maybeSingle(),
    supabase.from("gyms").select("name").eq("id", alumno.gym_id).maybeSingle(),
  ]);

  if (type === "welcome" && settings?.bienvenida_activo === false) {
    logger.warn("send-welcome: bienvenida desactivada en gym_settings", { route: ROUTE, meta: { requestId, alumno_id, gymId: alumno.gym_id } });
    return NextResponse.json({ ok: true });
  }
  if (type === "renewal" && settings?.renewal_activo === false) {
    logger.warn("send-welcome: renewal desactivado en gym_settings", { route: ROUTE, meta: { requestId, alumno_id, gymId: alumno.gym_id } });
    return NextResponse.json({ ok: true });
  }

  const gymName = settings?.gym_name || gym?.name || "tu gimnasio";
  const baseUrl = (process.env.NEXT_PUBLIC_APP_URL ?? (() => {
    const host  = req.headers.get("host") ?? "localhost:3000";
    const proto = host.startsWith("localhost") ? "http" : "https";
    return `${proto}://${host}`;
  })()).replace(/\/$/, "");
  const link = `${baseUrl}/alumno/auth?token=${token}`;

  const phone = normalizePhone(alumno.phone);
  const logMeta = { requestId, alumno_id: alumno.id, gymId: alumno.gym_id, phone: phone.slice(-4), type };

  async function sendWA(message: string, step: string) {
    const ok = await sendWaLib(alumno!.gym_id, phone, message, { route: ROUTE });
    if (ok) void logger.info(`send-welcome: mensaje enviado (${step})`, { route: ROUTE, meta: logMeta });
  }

  if (type === "renewal") {
    const template = ensureGymBranding(settings?.renewal_msg?.trim() || DEFAULT_RENEWAL, gymName);
    const msg = fill(template, alumno.full_name, gymName, link);
    await sendWA(msg, "renewal");
    return NextResponse.json({ ok: true });
  }

  // welcome: msg 1 (link) → 3s → msg 2 (app explanation)
  const template1 = ensureGymBranding(settings?.magiclink_msg?.trim() || DEFAULT_WELCOME, gymName);
  const msg1 = fill(template1, alumno.full_name, gymName, link);
  await sendWA(msg1, "welcome-link");

  if (settings?.bienvenida_app_msg !== "") {
    await new Promise(r => setTimeout(r, 3000));
    const template2 = ensureGymBranding(settings?.bienvenida_app_msg?.trim() || DEFAULT_APP_MSG, gymName);
    const msg2 = fill(template2, alumno.full_name, gymName);
    await sendWA(msg2, "welcome-app");
  }

  return NextResponse.json({ ok: true });
}
