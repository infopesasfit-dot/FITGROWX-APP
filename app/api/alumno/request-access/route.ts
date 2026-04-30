import { NextRequest, NextResponse } from "next/server";
import { getSupabaseAdminClient } from "@/lib/supabase-admin";
import { applyRateLimit, getClientIp, normalizeIdentifier } from "@/lib/request-security";

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

const REQUEST_ACCESS_RESPONSE = {
  ok: true,
  message: "Si encontramos una cuenta válida, te enviamos el acceso por WhatsApp.",
};

export async function POST(req: NextRequest) {
  const ip = getClientIp(req);
  const { dni } = await req.json();
  const dniClean = String(dni ?? "").replace(/\D/g, "");
  if (!dniClean) return NextResponse.json({ error: "DNI requerido." }, { status: 400 });
  if (dniClean.length < 7 || dniClean.length > 10) {
    return NextResponse.json({ error: "Ingresá un DNI válido." }, { status: 400 });
  }

  const ipLimit = applyRateLimit({
    namespace: "request-access:ip",
    identifier: normalizeIdentifier(ip),
    windowMs: 10 * 60 * 1000,
    maxAttempts: 6,
  });

  if (!ipLimit.allowed) {
    return NextResponse.json({
      error: "Demasiados intentos. Esperá unos minutos antes de volver a pedir el acceso.",
    }, { status: 429 });
  }

  const dniLimit = applyRateLimit({
    namespace: "request-access:dni",
    identifier: dniClean,
    windowMs: 10 * 60 * 1000,
    maxAttempts: 3,
  });

  if (!dniLimit.allowed) {
    return NextResponse.json(REQUEST_ACCESS_RESPONSE);
  }

  const supabase = getSupabaseAdminClient();

  const { data: alumno, error } = await supabase
    .from("alumnos")
    .select("id, gym_id, full_name, phone")
    .eq("dni", dniClean)
    .single();

  if (error || !alumno) {
    return NextResponse.json(REQUEST_ACCESS_RESPONSE);
  }

  if (!alumno.phone) {
    return NextResponse.json(REQUEST_ACCESS_RESPONSE);
  }

  const token = crypto.randomUUID();
  const expires_at = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString();

  const { error: tokenErr } = await supabase.from("alumno_tokens").insert({
    alumno_id: alumno.id,
    gym_id: alumno.gym_id,
    token,
    expires_at,
  });

  if (tokenErr) {
    console.error("[request-access] token insert error:", tokenErr.message);
    return NextResponse.json({ error: "Error al generar el acceso." }, { status: 500 });
  }

  // Obtener nombre del gym y plantilla personalizada (en paralelo)
  const [{ data: settings }, { data: gym }] = await Promise.all([
    supabase.from("gym_settings").select("gym_name, magiclink_msg").eq("gym_id", alumno.gym_id).maybeSingle(),
    supabase.from("gyms").select("name").eq("id", alumno.gym_id).maybeSingle(),
  ]);

  const gymName = settings?.gym_name || gym?.name || "tu gimnasio";

  const baseUrl = (process.env.NEXT_PUBLIC_APP_URL ?? (() => {
    const host  = req.headers.get("host") ?? "localhost:3000";
    const proto = host.startsWith("localhost") ? "http" : "https";
    return `${proto}://${host}`;
  })()).replace(/\/$/, "");
  const link = `${baseUrl}/alumno/auth?token=${token}`;

  const DEFAULT_MSG = `¡Hola [Nombre]! 👋\nIngresá a tu panel de *[Gym]* desde acá 👇\n\n[Link]\n\n_El acceso dura 30 días._`;
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
      if (!waRes.ok) {
        console.error("[WA Motor] request-access → HTTP", waRes.status);
      }
    } catch (err) {
      console.error("[WA Motor] request-access → ERROR:", err instanceof Error ? err.message : err);
    }
  } else {
    console.warn("[WA Motor] request-access → WA_MOTOR_URL no definida");
  }

  return NextResponse.json(REQUEST_ACCESS_RESPONSE);
}
