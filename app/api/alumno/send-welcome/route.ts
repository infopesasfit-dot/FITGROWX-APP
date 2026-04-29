import { NextRequest, NextResponse } from "next/server";
import { getSupabaseAdminClient } from "@/lib/supabase-admin";

function normalizeArgPhone(raw: string): string {
  const p = raw.replace(/\D/g, "");
  if (p.startsWith("549") && p.length === 13) return p;
  if (p.startsWith("54") && p.length === 12) return "549" + p.slice(2);
  if (p.startsWith("9") && p.length === 11) return "54" + p;
  if (p.startsWith("0") && p.length === 11) return "549" + p.slice(1);
  if (p.length === 10) return "549" + p;
  return p;
}

const supabase = getSupabaseAdminClient();

// type: "welcome" → nuevo alumno, "renewal" → renovó cuota
export async function POST(req: NextRequest) {
  const { alumno_id, type = "welcome" } = await req.json();
  if (!alumno_id) return NextResponse.json({ ok: true });

  const { data: alumno } = await supabase
    .from("alumnos")
    .select("id, gym_id, full_name, phone")
    .eq("id", alumno_id)
    .single();

  if (!alumno?.phone) return NextResponse.json({ ok: true });

  // Crear token de 30 días
  const token = crypto.randomUUID();
  const expires_at = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString();
  await supabase.from("alumno_tokens").insert({
    alumno_id: alumno.id,
    gym_id: alumno.gym_id,
    token,
    expires_at,
  });

  const { data: settings } = await supabase
    .from("gym_settings")
    .select("gym_name, magiclink_msg, renewal_msg, renewal_activo")
    .eq("gym_id", alumno.gym_id)
    .maybeSingle();

  // Si es renovación y el gym desactivó el envío, no mandamos nada
  if (type === "renewal" && settings?.renewal_activo === false) return NextResponse.json({ ok: true });

  const { data: gym } = await supabase
    .from("gyms")
    .select("name")
    .eq("id", alumno.gym_id)
    .maybeSingle();

  const gymName = settings?.gym_name || gym?.name || "tu gimnasio";

  const baseUrl = (process.env.NEXT_PUBLIC_APP_URL ?? (() => {
    const host  = req.headers.get("host") ?? "localhost:3000";
    const proto = host.startsWith("localhost") ? "http" : "https";
    return `${proto}://${host}`;
  })()).replace(/\/$/, "");

  const link = `${baseUrl}/alumno/auth?token=${token}`;

  const DEFAULT_WELCOME = `¡Hola [Nombre]! 👋 Te registramos en *[Gym]*.\n\nDesde acá podés ver tu membresía, rutinas y más 👇\n\n[Link]\n\n_El acceso dura 30 días._`;
  const DEFAULT_RENEWAL = `¡Hola [Nombre]! 💪 Tu cuota en *[Gym]* está al día.\n\nIngresá a tu panel desde acá 👇\n\n[Link]\n\n_El acceso dura 30 días._`;

  const template = type === "renewal"
    ? (settings?.renewal_msg?.trim() || DEFAULT_RENEWAL)
    : (settings?.magiclink_msg?.trim() || DEFAULT_WELCOME);
  const message  = template
    .replace(/\[Nombre\]/g, alumno.full_name)
    .replace(/\[Gym\]/g,    gymName)
    .replace(/\[Link\]/g,   link);

  const motorUrl = process.env.WA_MOTOR_URL;
  if (!motorUrl) return NextResponse.json({ ok: true });

  try {
    await fetch(`${motorUrl}/send/${alumno.gym_id}`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": process.env.WA_MOTOR_API_KEY ?? "",
      },
      body: JSON.stringify({ phone: normalizeArgPhone(alumno.phone), message }),
      signal: AbortSignal.timeout(8000),
    });
  } catch { /* no fatal */ }

  return NextResponse.json({ ok: true });
}
