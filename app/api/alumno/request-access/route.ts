import { NextRequest, NextResponse } from "next/server";
import { createHash } from "crypto";
import { getSupabaseAdminClient } from "@/lib/supabase-admin";
import { applyRateLimit, getClientIp, normalizeIdentifier } from "@/lib/request-security";
import { normalizePhone } from "@/lib/phone";

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

  const ipLimit = await applyRateLimit({
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

  const dniLimit = await applyRateLimit({
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

  const token      = crypto.randomUUID();
  const tokenHash  = createHash("sha256").update(token).digest("hex");
  const expires_at = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString();

  const { error: tokenErr } = await supabase.from("alumno_tokens").insert({
    alumno_id: alumno.id,
    gym_id:    alumno.gym_id,
    token:     tokenHash,
    expires_at,
  });

  if (tokenErr) {
    console.error("[request-access] token insert error:", tokenErr.message);
    return NextResponse.json({ error: "Error al generar el acceso." }, { status: 500 });
  }

  // Obtener nombre del gym y plantilla personalizada (en paralelo)
  const [{ data: settings }, { data: gym }] = await Promise.all([
    supabase.from("gym_settings").select("gym_name, magiclink_msg, slug").eq("gym_id", alumno.gym_id).maybeSingle(),
    supabase.from("gyms").select("name").eq("id", alumno.gym_id).maybeSingle(),
  ]);

  const gymName = settings?.gym_name || gym?.name || "tu gimnasio";

  const baseUrl = (process.env.NEXT_PUBLIC_APP_URL ?? (() => {
    const host  = req.headers.get("host") ?? "localhost:3000";
    const proto = host.startsWith("localhost") ? "http" : "https";
    return `${proto}://${host}`;
  })()).replace(/\/$/, "");
  const gymParam = settings?.slug ? `&gym=${settings.slug}` : "";
  const link = `${baseUrl}/alumno/auth?token=${token}${gymParam}`;

  const DEFAULT_MSG = `¡Hola [Nombre]! 👋\nIngresá a tu panel de *[Gym]* desde acá 👇\n\n[Link]\n\n_El acceso dura 30 días._`;
  const template = settings?.magiclink_msg?.trim() || DEFAULT_MSG;
  const message = template
    .replace(/\[Nombre\]/g, alumno.full_name).replace(/\{nombre\}/gi, alumno.full_name)
    .replace(/\[Gym\]/g,    gymName)          .replace(/\{gym\}/gi,    gymName)
    .replace(/\[Link\]/g,   link)             .replace(/\{link\}/gi,   link);

  const phone = normalizePhone(alumno.phone);
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
        signal: AbortSignal.timeout(3000),
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
