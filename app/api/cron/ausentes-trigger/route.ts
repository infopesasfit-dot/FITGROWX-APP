import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

function normalizeArgPhone(raw: string): string {
  const p = raw.replace(/\D/g, "");
  if (p.startsWith("549") && p.length === 13) return p;
  if (p.startsWith("54") && p.length === 12) return "549" + p.slice(2);
  if (p.startsWith("9") && p.length === 11) return "54" + p;
  if (p.startsWith("0") && p.length === 11) return "549" + p.slice(1);
  if (p.length === 10) return "549" + p;
  return p;
}

export async function POST(req: NextRequest) {
  const { gym_id } = await req.json();
  if (!gym_id) return NextResponse.json({ ok: false, error: "gym_id requerido." }, { status: 400 });

  const motorUrl = process.env.WA_MOTOR_URL;
  if (!motorUrl) return NextResponse.json({ ok: false, error: "Motor WA no configurado." }, { status: 500 });

  const { data: gym } = await supabase
    .from("gym_settings")
    .select("gym_id, gym_name, inactividad_dias, inactividad_msg, inactividad_activo")
    .eq("gym_id", gym_id)
    .single();

  if (!gym) return NextResponse.json({ ok: false, error: "Gym no encontrado." }, { status: 404 });

  const dias = gym.inactividad_dias ?? 7;
  const since = new Date();
  since.setDate(since.getDate() - dias);
  const sinceStr = since.toISOString().slice(0, 10);

  const { data: alumnos } = await supabase
    .from("alumnos")
    .select("id, full_name, phone, ultima_notif_inactividad")
    .eq("gym_id", gym_id)
    .eq("status", "activo")
    .not("phone", "is", null);

  if (!alumnos?.length) return NextResponse.json({ ok: true, enviados: 0 });

  const { data: asistencias } = await supabase
    .from("asistencias")
    .select("alumno_id")
    .eq("gym_id", gym_id)
    .gte("fecha", sinceStr);

  const asistidosSet = new Set((asistencias ?? []).map(a => a.alumno_id));
  const notifCutoff = new Date();
  notifCutoff.setDate(notifCutoff.getDate() - dias);

  let enviados = 0;
  const defaultMsg = `¡Hola [Nombre]! 💪 Te extrañamos en *[Gym]*. Hace más de [Dias] días que no te vemos. ¡Volvé cuando quieras, te esperamos!`;

  for (const alumno of alumnos) {
    if (asistidosSet.has(alumno.id)) continue;
    if (alumno.ultima_notif_inactividad) {
      if (new Date(alumno.ultima_notif_inactividad) > notifCutoff) continue;
    }

    const template = gym.inactividad_msg?.trim() || defaultMsg;
    const message = template
      .replace(/\[Nombre\]/g, alumno.full_name)
      .replace(/\[Gym\]/g, gym.gym_name ?? "el gym")
      .replace(/\[Dias\]/g, String(dias));

    const phone = normalizeArgPhone(alumno.phone!);

    try {
      const res = await fetch(`${motorUrl}/send/${gym_id}`, {
        method: "POST",
        headers: { "Content-Type": "application/json", "x-api-key": process.env.WA_MOTOR_API_KEY ?? "" },
        body: JSON.stringify({ phone, message }),
        signal: AbortSignal.timeout(8000),
      });
      if (res.ok) {
        await supabase.from("alumnos").update({ ultima_notif_inactividad: new Date().toISOString() }).eq("id", alumno.id);
        enviados++;
      }
    } catch { /* continue to next */ }
  }

  return NextResponse.json({ ok: true, enviados });
}
