import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { isCronAuthorized, cronUnauthorized } from "@/lib/request-security";
import { normalizePhone } from "@/lib/phone";
import { sendWa } from "@/lib/wa";
import { canSendAutomatedWa } from "@/lib/gym-plan-status";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export async function POST(req: NextRequest) {
  if (!isCronAuthorized(req)) return cronUnauthorized();

  const startedAt = Date.now();
  const log: string[] = [];

  try {
    const { gym_id } = await req.json();
    if (!gym_id) return NextResponse.json({ ok: false, error: "gym_id requerido." }, { status: 400 });

    const { data: gym } = await supabase
      .from("gym_settings")
      .select("gym_id, gym_name, inactividad_dias, inactividad_msg, inactividad_activo")
      .eq("gym_id", gym_id)
      .single();

    if (!gym) return NextResponse.json({ ok: false, error: "Gym no encontrado." }, { status: 404 });

    const canSend = await canSendAutomatedWa(gym_id);
    if (!canSend) {
      return NextResponse.json({ ok: false, error: "Tu gym tiene el envío de WhatsApp pausado por suscripción vencida." }, { status: 422 });
    }

    const dias = gym.inactividad_dias ?? 7;
    const since = new Date();
    since.setDate(since.getDate() - dias);
    const sinceStr = since.toISOString().slice(0, 10);

    const { data: alumnos } = await supabase
      .from("alumnos")
      .select("id, full_name, phone, ultima_notif_inactividad")
      .eq("gym_id", gym_id)
      .eq("status", "activo")
      .eq("is_demo", false)
      .is("deleted_at", null)
      .not("phone", "is", null);

    if (!alumnos?.length) {
      void supabase.from("cron_runs").insert({ cron_name: "ausentes-trigger", status: "ok", duration_ms: Date.now() - startedAt, summary: `gym=${gym_id} · 0 enviados`, counts: { enviados: 0, log } });
      return NextResponse.json({ ok: true, enviados: 0 });
    }

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

      const phone = normalizePhone(alumno.phone!);

      // sendWa retorna { ok: boolean, ... } — usar .ok, NO el objeto.
      const sent = await sendWa(gym_id, phone, message, { route: "cron/ausentes-trigger" });
      if (!sent.ok) continue;
      await supabase.from("alumnos").update({ ultima_notif_inactividad: new Date().toISOString() }).eq("id", alumno.id);
      enviados++;
      log.push(`✓ ${alumno.full_name}`);
    }

    void supabase.from("cron_runs").insert({ cron_name: "ausentes-trigger", status: "ok", duration_ms: Date.now() - startedAt, summary: `gym=${gym_id} · ${enviados} enviados`, counts: { enviados, log } });
    return NextResponse.json({ ok: true, enviados });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    void supabase.from("cron_runs").insert({ cron_name: "ausentes-trigger", status: "error", duration_ms: Date.now() - startedAt, summary: msg });
    console.error("[ausentes-trigger] error fatal:", msg);
    return NextResponse.json({ ok: false, error: msg }, { status: 500 });
  }
}
