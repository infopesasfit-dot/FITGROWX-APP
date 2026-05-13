import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { isCronAuthorized, cronUnauthorized } from "@/lib/request-security";
import { normalizePhone } from "@/lib/phone";

export const dynamic = "force-dynamic";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
);

const MOTOR_URL = process.env.WA_MOTOR_URL ?? "";
const MOTOR_KEY = process.env.WA_MOTOR_API_KEY ?? "";

async function sendWA(gymId: string, phone: string, message: string): Promise<boolean> {
  try {
    const res = await fetch(`${MOTOR_URL}/send/${gymId}`, {
      method: "POST",
      headers: { "Content-Type": "application/json", "x-api-key": MOTOR_KEY },
      body: JSON.stringify({ phone, message }),
      signal: AbortSignal.timeout(8_000),
    });
    return res.ok;
  } catch {
    return false;
  }
}

export async function GET(req: NextRequest) {
  if (!isCronAuthorized(req)) return cronUnauthorized();
  if (!MOTOR_URL) return NextResponse.json({ ok: false, log: ["WA_MOTOR_URL no configurado"] });

  const now = new Date();
  const thisYear = now.getFullYear();
  const mm = now.getMonth() + 1;
  const dd = now.getDate();
  const log: string[] = [];

  const { data: gyms } = await supabase
    .from("gym_settings")
    .select("gym_id, gym_name, cumple_msg")
    .eq("cumple_activo", true);

  if (!gyms?.length) return NextResponse.json({ ok: true, log: ["Sin gyms con cumple activo"] });

  for (const gym of gyms) {
    const { data: alumnos } = await supabase
      .from("alumnos")
      .select("id, full_name, phone, fecha_nacimiento, notif_cumple_year")
      .eq("gym_id", gym.gym_id)
      .eq("status", "activo")
      .not("fecha_nacimiento", "is", null)
      .not("phone", "is", null);

    if (!alumnos?.length) continue;

    const cumpleHoy = alumnos.filter(a => {
      const d = new Date(a.fecha_nacimiento + "T12:00:00");
      return d.getMonth() + 1 === mm && d.getDate() === dd && a.notif_cumple_year !== thisYear;
    });

    for (const alumno of cumpleHoy) {
      const phone = normalizePhone(alumno.phone!);
      const gymName = gym.gym_name ?? "el gym";
      const nombre = alumno.full_name.split(" ")[0];
      const msg = (gym.cumple_msg ?? "🎂 ¡Feliz cumpleaños, {nombre}! Todo el equipo de *{gym}* te desea un día increíble 🎉💪")
        .replace(/\{nombre\}/gi, nombre)
        .replace(/\[Nombre\]/g, nombre)
        .replace(/\{gym\}/gi, gymName)
        .replace(/\[Gym\]/g, gymName);

      const ok = await sendWA(gym.gym_id, phone, msg);
      if (ok) {
        await supabase.from("alumnos").update({ notif_cumple_year: thisYear }).eq("id", alumno.id);
        log.push(`🎂 ${alumno.full_name} (${gymName})`);
      } else {
        log.push(`✗ ${alumno.full_name} (${gymName}) — fallo WA`);
      }
    }
  }

  log.push(`Completado: ${now.toISOString().slice(0, 10)}`);
  return NextResponse.json({ ok: true, log });
}
