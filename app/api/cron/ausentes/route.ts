import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { isCronAuthorized, cronUnauthorized } from "@/lib/request-security";

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

export async function GET(req: NextRequest) {
  if (!isCronAuthorized(req)) return cronUnauthorized();

  const motorUrl = process.env.WA_MOTOR_URL;
  if (!motorUrl) return NextResponse.json({ error: "Motor WA no configurado." }, { status: 500 });

  // Get all gyms with inactividad active
  const { data: gyms } = await supabase
    .from("gym_settings")
    .select("gym_id, gym_name, inactividad_dias, inactividad_msg")
    .eq("inactividad_activo", true);

  if (!gyms?.length) return NextResponse.json({ ok: true, enviados: 0, detalle: "No hay gyms con automatización activa." });

  let totalEnviados = 0;
  const log: string[] = [];

  for (const gym of gyms) {
    const dias = gym.inactividad_dias ?? 7;
    const since = new Date();
    since.setDate(since.getDate() - dias);
    const sinceStr = since.toISOString().slice(0, 10);

    // Active students of this gym
    const { data: alumnos } = await supabase
      .from("alumnos")
      .select("id, full_name, phone, ultima_notif_inactividad")
      .eq("gym_id", gym.gym_id)
      .eq("status", "activo")
      .not("phone", "is", null);

    if (!alumnos?.length) continue;

    // Find students who haven't attended since sinceStr
    const { data: asistencias } = await supabase
      .from("asistencias")
      .select("alumno_id")
      .eq("gym_id", gym.gym_id)
      .gte("fecha", sinceStr);

    const asistidosSet = new Set((asistencias ?? []).map(a => a.alumno_id));

    // Notify cutoff: don't re-notify within same inactividad_dias window
    const notifCutoff = new Date();
    notifCutoff.setDate(notifCutoff.getDate() - dias);

    const pending = alumnos.filter(alumno => {
      if (asistidosSet.has(alumno.id)) return false;
      if (alumno.ultima_notif_inactividad) {
        const lastNotif = new Date(alumno.ultima_notif_inactividad);
        if (lastNotif > notifCutoff) return false;
      }
      return true;
    });

    const defaultMsg = `¡Hola [Nombre]! 💪 Te extrañamos en *[Gym]*. Hace más de ${dias} días que no te vemos. ¡Volvé cuando quieras, te esperamos!`;
    const template = gym.inactividad_msg?.trim() || defaultMsg;

    const CHUNK = 5;
    for (let i = 0; i < pending.length; i += CHUNK) {
      const chunk = pending.slice(i, i + CHUNK);
      const results = await Promise.allSettled(
        chunk.map(async alumno => {
          const message = template
            .replace(/\[Nombre\]/g, alumno.full_name)
            .replace(/\[Gym\]/g, gym.gym_name ?? "el gym")
            .replace(/\[Dias\]/g, String(dias));
          const phone = normalizeArgPhone(alumno.phone!);
          const res = await fetch(`${motorUrl}/send/${gym.gym_id}`, {
            method: "POST",
            headers: { "Content-Type": "application/json", "x-api-key": process.env.WA_MOTOR_API_KEY ?? "" },
            body: JSON.stringify({ phone, message }),
            signal: AbortSignal.timeout(8000),
          });
          if (res.ok) {
            await supabase.from("alumnos").update({ ultima_notif_inactividad: new Date().toISOString() }).eq("id", alumno.id);
            return alumno.full_name;
          }
          throw new Error(`HTTP ${res.status}`);
        })
      );
      for (let j = 0; j < results.length; j++) {
        const r = results[j];
        const name = chunk[j].full_name;
        if (r.status === "fulfilled") { totalEnviados++; log.push(`✓ ${name} (${gym.gym_name})`); }
        else { log.push(`✗ ${name} — ${r.reason instanceof Error ? r.reason.message : "error"}`); }
      }
    }
  }

  return NextResponse.json({ ok: true, enviados: totalEnviados, log });
}
