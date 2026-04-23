import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

// Normaliza teléfonos argentinos al formato E.164 para WhatsApp (549XXXXXXXXXX)
function normalizeArgPhone(raw: string): string {
  const p = raw.replace(/\D/g, "");

  // Ya correcto: 549 + 10 dígitos = 13 dígitos
  if (p.startsWith("549") && p.length === 13) return p;

  // Tiene código de país pero le falta el 9 de celular (54 + 10 dígitos)
  if (p.startsWith("54") && p.length === 12) return "549" + p.slice(2);

  // Empieza con 9 + área (11 dígitos, ej: 91165891444)
  if (p.startsWith("9") && p.length === 11) return "54" + p;

  // Con 0 adelante (ej: 01165891444 → 11 dígitos)
  if (p.startsWith("0") && p.length === 11) return "549" + p.slice(1);

  // Número local sin prefijos (ej: 1165891444 → 10 dígitos)
  if (p.length === 10) return "549" + p;

  // Fallback: devolver limpio
  return p;
}

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY ?? process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

export async function POST(req: NextRequest) {
  const { email } = await req.json();
  if (!email) return NextResponse.json({ error: "Email requerido." }, { status: 400 });

  const { data: alumno, error } = await supabase
    .from("alumnos")
    .select("id, gym_id, full_name, phone")
    .ilike("email", email.trim())
    .single();

  if (error || !alumno) {
    return NextResponse.json({ error: "No encontramos ese email en ningún gimnasio." }, { status: 404 });
  }

  if (!alumno.phone) {
    return NextResponse.json({ error: "Tu cuenta no tiene teléfono registrado. Contactá al gym." }, { status: 400 });
  }

  const token = crypto.randomUUID();
  const expires_at = new Date(Date.now() + 15 * 60 * 1000).toISOString();

  const { error: tokenErr } = await supabase.from("alumno_tokens").insert({
    alumno_id: alumno.id,
    gym_id: alumno.gym_id,
    token,
    expires_at,
  });

  if (tokenErr) {
    return NextResponse.json({ error: "Error al generar el acceso." }, { status: 500 });
  }

  // Obtener nombre del gym y plantilla personalizada
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
  const link = `${baseUrl}/alumno/auth?token=${token}`;

  const DEFAULT_MSG = `¡Hola [Nombre]! 👋\nIngresá a tu panel de *[Gym]* desde acá 👇\n\n[Link]\n\n_El link vence en 15 minutos._`;
  const template = settings?.magiclink_msg?.trim() || DEFAULT_MSG;
  const message = template
    .replace(/\[Nombre\]/g, alumno.full_name)
    .replace(/\[Gym\]/g,    gymName)
    .replace(/\[Link\]/g,   link);

  const phone = normalizeArgPhone(alumno.phone);
  const motorUrl = process.env.WA_MOTOR_URL;

  if (motorUrl) {
    const endpoint = `${motorUrl}/send/${alumno.gym_id}`;
    const payload  = { phone, message };
    console.log("[WA Motor] request-access → URL:", endpoint);
    console.log("[WA Motor] request-access → body:", JSON.stringify(payload));
    try {
      const waRes = await fetch(endpoint, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-api-key": process.env.WA_MOTOR_API_KEY ?? "",
        },
        body: JSON.stringify(payload),
        signal: AbortSignal.timeout(8000),
      });
      const waBody = await waRes.text();
      console.log("[WA Motor] request-access → HTTP", waRes.status, "→", waBody);
    } catch (err) {
      console.error("[WA Motor] request-access → ERROR:", err instanceof Error ? err.message : err);
    }
  } else {
    console.warn("[WA Motor] request-access → WA_MOTOR_URL no definida");
  }

  return NextResponse.json({ ok: true });
}
