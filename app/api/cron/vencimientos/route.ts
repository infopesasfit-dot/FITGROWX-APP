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
  if (p.startsWith("54")  && p.length === 12) return "549" + p.slice(2);
  if (p.startsWith("9")   && p.length === 11) return "54" + p;
  if (p.startsWith("0")   && p.length === 11) return "549" + p.slice(1);
  if (p.length === 10) return "549" + p;
  return p;
}

export async function GET(req: NextRequest) {
  if (!isCronAuthorized(req)) return cronUnauthorized();

  const motorUrl = process.env.WA_MOTOR_URL;
  if (!motorUrl) return NextResponse.json({ error: "Motor WA no configurado." }, { status: 500 });

  const log: string[] = [];

  // Gyms con recordatorio de vencimiento activo
  const { data: gyms } = await supabase
    .from("gym_settings")
    .select("gym_id, gym_name, vencimiento_dias, vencimiento_msg")
    .eq("vencimiento_activo", true);

  if (!gyms?.length) return NextResponse.json({ ok: true, enviados: 0, log: ["No hay gyms con recordatorio de vencimiento activo."] });

  let totalEnviados = 0;

  for (const gym of gyms) {
    const dias = gym.vencimiento_dias ?? 3;

    // Fecha límite: alumnos cuyo vencimiento es hoy + N días o antes (pero aún activos)
    const cutoff = new Date();
    cutoff.setDate(cutoff.getDate() + dias);
    const cutoffStr = cutoff.toISOString().slice(0, 10);
    const todayStr  = new Date().toISOString().slice(0, 10);

    // Alumnos activos con vencimiento próximo que aún no recibieron notif para este ciclo
    // notif_vencimiento_para != next_expiration_date → notif pendiente para este vencimiento
    const { data: alumnos } = await supabase
      .from("alumnos")
      .select("id, full_name, phone, next_expiration_date, notif_vencimiento_para")
      .eq("gym_id", gym.gym_id)
      .eq("status", "activo")
      .not("phone", "is", null)
      .not("next_expiration_date", "is", null)
      .lte("next_expiration_date", cutoffStr)
      .gte("next_expiration_date", todayStr); // no avisar sobre vencimientos ya pasados

    if (!alumnos?.length) continue;

    const DEFAULT_MSG = `¡Hola [Nombre]! 👋 Tu membresía en *[Gym]* vence el *[Fecha]*. Renovála para seguir entrenando sin interrupciones. 💪`;
    const template = gym.vencimiento_msg?.trim() || DEFAULT_MSG;

    const pending = alumnos.filter(a => a.notif_vencimiento_para !== a.next_expiration_date);

    const CHUNK = 5;
    for (let i = 0; i < pending.length; i += CHUNK) {
      const chunk = pending.slice(i, i + CHUNK);
      const results = await Promise.allSettled(
        chunk.map(async alumno => {
          const phone = normalizeArgPhone(alumno.phone!);
          const fechaVto = new Date(alumno.next_expiration_date!).toLocaleDateString("es-AR", { day: "numeric", month: "long" });
          const message = template
            .replace(/\[Nombre\]/g, alumno.full_name)
            .replace(/\[Gym\]/g,    gym.gym_name ?? "el gym")
            .replace(/\[Fecha\]/g,  fechaVto);
          const res = await fetch(`${motorUrl}/send/${gym.gym_id}`, {
            method: "POST",
            headers: { "Content-Type": "application/json", "x-api-key": process.env.WA_MOTOR_API_KEY ?? "" },
            body: JSON.stringify({ phone, message }),
            signal: AbortSignal.timeout(8000),
          });
          if (res.ok) {
            await supabase.from("alumnos").update({ notif_vencimiento_para: alumno.next_expiration_date }).eq("id", alumno.id);
            return alumno.next_expiration_date;
          }
          throw new Error(`HTTP ${res.status}`);
        })
      );
      for (let j = 0; j < results.length; j++) {
        const r = results[j];
        const alumno = chunk[j];
        if (r.status === "fulfilled") {
          totalEnviados++;
          log.push(`✓ ${alumno.full_name} (${gym.gym_name}) — vence ${alumno.next_expiration_date}`);
        } else {
          log.push(`✗ ${alumno.full_name} — ${r.reason instanceof Error ? r.reason.message : "error"} (se reintentará)`);
        }
      }
    }
  }

  return NextResponse.json({ ok: true, enviados: totalEnviados, log });
}
