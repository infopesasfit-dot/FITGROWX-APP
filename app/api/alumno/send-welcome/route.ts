import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

function normalizeArgPhone(raw: string): string {
  const p = raw.replace(/\D/g, "");
  if (p.startsWith("549") && p.length === 13) return p;
  if (p.startsWith("54") && p.length === 12) return "549" + p.slice(2);
  if (p.startsWith("9") && p.length === 11) return "54" + p;
  if (p.startsWith("0") && p.length === 11) return "549" + p.slice(1);
  if (p.length === 10) return "549" + p;
  return p;
}

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY ?? process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

export async function POST(req: NextRequest) {
  const { alumno_id } = await req.json();
  if (!alumno_id) return NextResponse.json({ error: "alumno_id requerido" }, { status: 400 });

  const { data: alumno } = await supabase
    .from("alumnos")
    .select("id, gym_id, full_name, phone")
    .eq("id", alumno_id)
    .single();

  if (!alumno?.phone) return NextResponse.json({ ok: true });

  const { data: settings } = await supabase
    .from("gym_settings")
    .select("gym_name, magiclink_msg")
    .eq("gym_id", alumno.gym_id)
    .maybeSingle();

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

  const loginUrl = `${baseUrl}/alumno/login`;

  const DEFAULT_MSG = `¡Hola [Nombre]! 👋 Te registramos en *[Gym]*.\n\nDesde acá podés ver tu membresía, rutinas y más 👇\n\n${loginUrl}\n\n_Ingresá con tu email y te mandamos el acceso al instante._`;
  const template = settings?.magiclink_msg?.trim() || DEFAULT_MSG;
  const message = template
    .replace(/\[Nombre\]/g, alumno.full_name)
    .replace(/\[Gym\]/g,    gymName)
    .replace(/\[Link\]/g,   loginUrl);

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
