import { NextRequest, NextResponse } from "next/server";
import { getSupabaseAdminClient } from "@/lib/supabase-admin";
import { createSupabaseServerClient } from "@/lib/supabase-server";
import { normalizePhone } from "@/lib/phone";
import { sendWa } from "@/lib/wa";
import { ensureGymBranding } from "@/lib/messaging-helpers";

const supabase = getSupabaseAdminClient();

const DEFAULT_MSG =
  "Hola {nombre}, soy del staff de {gym}. Te subimos una rutina nueva a la app. Entrá acá para verla:\n\n{link}";

export async function POST(req: NextRequest) {
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

  const { alumno_id } = await req.json();
  if (!alumno_id) return NextResponse.json({ ok: false }, { status: 400 });

  const { data: alumno } = await supabase
    .from("alumnos")
    .select("id, gym_id, full_name, phone")
    .eq("id", alumno_id)
    .eq("gym_id", callerProfile.gym_id)
    .single();

  if (!alumno?.phone) return NextResponse.json({ ok: true });

  // Reutilizar token válido si existe, sino crear uno nuevo
  const { data: existing } = await supabase
    .from("alumno_tokens")
    .select("token")
    .eq("alumno_id", alumno_id)
    .gt("expires_at", new Date().toISOString())
    .order("expires_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  let token: string;
  if (existing) {
    token = existing.token;
  } else {
    token = crypto.randomUUID();
    await supabase.from("alumno_tokens").insert({
      alumno_id: alumno.id,
      gym_id: alumno.gym_id,
      token,
      expires_at: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(),
    });
  }

  const [{ data: settings }, { data: gym }] = await Promise.all([
    supabase.from("gym_settings").select("gym_name").eq("gym_id", alumno.gym_id).maybeSingle(),
    supabase.from("gyms").select("name").eq("id", alumno.gym_id).maybeSingle(),
  ]);

  const gymName = settings?.gym_name || gym?.name || "tu gimnasio";
  const baseUrl = (process.env.NEXT_PUBLIC_APP_URL ?? (() => {
    const host  = req.headers.get("host") ?? "localhost:3000";
    const proto = host.startsWith("localhost") ? "http" : "https";
    return `${proto}://${host}`;
  })()).replace(/\/$/, "");

  const template = ensureGymBranding(DEFAULT_MSG, gymName);
  const msg = template
    .replace(/\{nombre\}/gi, alumno.full_name.split(" ")[0])
    .replace(/\{gym\}/gi, gymName)
    .replace(/\{link\}/gi, `${baseUrl}/alumno/auth?token=${token}`);

  void sendWa(alumno.gym_id, normalizePhone(alumno.phone), msg, { route: "alumno/notify-rutina" });

  return NextResponse.json({ ok: true });
}
