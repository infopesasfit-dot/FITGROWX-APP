import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { isCronAuthorized, cronUnauthorized } from "@/lib/request-security";
import { normalizePhone } from "@/lib/phone";
import { logWASend } from "@/lib/wa-log";
import { enqueueWABulk } from "@/lib/wa-queue";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

async function sendWA(gymId: string, phone: string, message: string) {
  const motor = process.env.WA_MOTOR_URL;
  if (!motor) throw new Error("Motor WA no configurado");
  const res = await fetch(`${motor}/send/${gymId}`, {
    method: "POST",
    headers: { "Content-Type": "application/json", "x-api-key": process.env.WA_MOTOR_API_KEY ?? "" },
    body: JSON.stringify({ phone, message }),
    signal: AbortSignal.timeout(8000),
  });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
}

export async function GET(req: NextRequest) {
  if (!isCronAuthorized(req)) return cronUnauthorized();

  const { data: gyms } = await supabase
    .from("gym_settings")
    .select("gym_id, gym_name, inactividad_dias, inactividad_msg, inactividad_msg_3")
    .eq("inactividad_activo", true);

  if (!gyms?.length) return NextResponse.json({ ok: true, enviados: 0, detalle: "No hay gyms con automatización activa." });

  const today = new Date();
  let totalEnviados = 0;
  const log: string[] = [];

  for (const gym of gyms) {
    const step1Days = gym.inactividad_dias ?? 10;

    const { data: alumnos } = await supabase
      .from("alumnos")
      .select("id, full_name, phone, ultima_notif_inactividad, ultima_notif_inactividad_3")
      .eq("gym_id", gym.gym_id)
      .eq("status", "activo")
      .is("deleted_at", null)
      .not("phone", "is", null);

    if (!alumnos?.length) continue;

    // Last attendance per alumno — one row per alumno via DISTINCT ON (server-side, no full scan)
    const alumnoIds = (alumnos ?? []).map(a => a.id);
    const { data: asistencias } = await supabase.rpc("last_asistencia_per_alumno", { gym_id_input: gym.gym_id, alumno_ids: alumnoIds });

    const lastAttend: Record<string, string> = {};
    for (const a of asistencias ?? []) {
      lastAttend[a.alumno_id] = a.fecha;
    }

    const gymName = gym.gym_name ?? "el gym";

    for (const alumno of alumnos) {
      if (!alumno.phone) continue;
      const lastDate = lastAttend[alumno.id];
      const diffDays = lastDate
        ? Math.floor((today.getTime() - new Date(lastDate).getTime()) / 86_400_000)
        : 999;

      const phone = normalizePhone(alumno.phone);

      // Step 1 — configurable days
      if (diffDays >= step1Days && gym.inactividad_msg) {
        const cutoff = new Date(today); cutoff.setDate(cutoff.getDate() - step1Days);
        const lastNotif = alumno.ultima_notif_inactividad ? new Date(alumno.ultima_notif_inactividad) : null;
        if (!lastNotif || lastNotif < cutoff) {
          const msg = gym.inactividad_msg
            .replace(/\{nombre\}/g, alumno.full_name).replace(/\[Nombre\]/g, alumno.full_name)
            .replace(/\{gym\}/g, gymName).replace(/\[Gym\]/g, gymName)
            .replace(/\{dias\}/g, String(step1Days)).replace(/\[Dias\]/g, String(step1Days));
          await supabase.from("alumnos").update({ ultima_notif_inactividad: today.toISOString() }).eq("id", alumno.id);
          await enqueueWABulk([{ gymId: gym.gym_id, phone, message: msg, dedupKey: `inactivo1:${alumno.id}:${today.toISOString().slice(0,10)}` }]);
          logWASend(supabase, gym.gym_id, "inactivo");
          totalEnviados++;
          log.push(`✓ ${alumno.full_name} (${gym.gym_name}) — paso 1 encolado (día ${diffDays})`);
        }
      }

      // Step 2 — 30 days
      if (diffDays >= 30 && gym.inactividad_msg_3) {
        const cutoff30 = new Date(today); cutoff30.setDate(cutoff30.getDate() - 30);
        const lastNotif3 = alumno.ultima_notif_inactividad_3 ? new Date(alumno.ultima_notif_inactividad_3) : null;
        if (!lastNotif3 || lastNotif3 < cutoff30) {
          const msg = gym.inactividad_msg_3
            .replace(/\{nombre\}/g, alumno.full_name).replace(/\[Nombre\]/g, alumno.full_name)
            .replace(/\{gym\}/g, gymName).replace(/\[Gym\]/g, gymName)
            .replace(/\{dias\}/g, "30").replace(/\[Dias\]/g, "30");
          await supabase.from("alumnos").update({ ultima_notif_inactividad_3: today.toISOString() }).eq("id", alumno.id);
          await enqueueWABulk([{ gymId: gym.gym_id, phone, message: msg, dedupKey: `inactivo3:${alumno.id}:${today.toISOString().slice(0,10)}` }]);
          logWASend(supabase, gym.gym_id, "inactivo");
          totalEnviados++;
          log.push(`✓ ${alumno.full_name} (${gym.gym_name}) — paso 3 encolado (día ${diffDays})`);
        }
      }
    }
  }

  return NextResponse.json({ ok: true, enviados: totalEnviados, log });
}
