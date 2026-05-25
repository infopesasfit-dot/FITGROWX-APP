import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { isCronAuthorized, cronUnauthorized } from "@/lib/request-security";
import { normalizePhone } from "@/lib/phone";
import { logWASend } from "@/lib/wa-log";
import { logAlumnoActivity } from "@/lib/alumno-log";
import { enqueueWABulk } from "@/lib/wa-queue";
import { getTodayDate } from "@/lib/date-utils";
import { ensureGymBranding } from "@/lib/messaging-helpers";
import { createHash } from "crypto";

// ── Cliente y constantes ──────────────────────────────────────────────────────

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
);

const APP_URL   = (process.env.NEXT_PUBLIC_APP_URL ?? "https://app.fitgrowx.com").replace(/\/$/, "");
const MOTOR_URL = process.env.WA_MOTOR_URL ?? "";
const MOTOR_KEY = process.env.WA_MOTOR_API_KEY ?? "";

// ── Tipos ─────────────────────────────────────────────────────────────────────

type GymSettings = {
  gym_id: string;
  gym_name: string | null;
  vencimiento_dias: number | null;
  vencimiento_msg: string | null;
  mp_access_token: string | null;
  payment_info: string | null;
};

type AlumnoVencido = {
  id: string;
  full_name: string;
  phone: string | null;
  next_expiration_date: string | null;
  notif_vencido_d3_para: string | null;
  notif_vencido_d7_para: string | null;
};

type AlumnoPendiente = {
  id: string;
  full_name: string;
  phone: string | null;
  next_expiration_date: string | null;
  notif_vencimiento_para: string | null;
};

// ── Utilidades ────────────────────────────────────────────────────────────────

function fechaRelativa(dias: number): string {
  const base = new Date(`${getTodayDate()}T12:00:00`);
  base.setDate(base.getDate() + dias);
  return `${base.getFullYear()}-${String(base.getMonth() + 1).padStart(2, "0")}-${String(base.getDate()).padStart(2, "0")}`;
}

function esMismoNumero(phone1: string | null, phone2: string | null): boolean {
  if (!phone1 || !phone2) return false;
  return normalizePhone(phone1) === normalizePhone(phone2);
}

function buildPaymentLink(token: string | undefined, gymHasMP: boolean): string {
  if (!token) return "";
  return gymHasMP
    ? `${APP_URL}/api/alumno/pagar-link?token=${token}`
    : `${APP_URL}/alumno/auth?token=${token}`;
}

function buildPaymentSuffix(gymHasMP: boolean, paymentInfo: string | null): string {
  if (gymHasMP || !paymentInfo) return "";
  return `\n\n💳 Datos de pago:\n${paymentInfo}`;
}

function fillTemplate(template: string, vars: Record<string, string>): string {
  return Object.entries(vars).reduce(
    (msg, [key, val]) => msg.replace(new RegExp(`\\[${key}\\]`, "g"), val),
    template,
  );
}

async function enviarMensajeWA(gymId: string, phone: string, message: string): Promise<boolean> {
  try {
    const res = await fetch(`${MOTOR_URL}/send/${gymId}`, {
      method: "POST",
      headers: { "Content-Type": "application/json", "x-api-key": MOTOR_KEY },
      body: JSON.stringify({ phone: normalizePhone(phone), message }),
      signal: AbortSignal.timeout(15000),
    });
    return res.ok;
  } catch (e) {
    console.error(`[vencimientos] enviarMensajeWA gym=${gymId} phone=${phone}:`, e instanceof Error ? e.message : e);
    return false;
  }
}

async function obtenerTokensExistentes(alumnoIds: string[]): Promise<Record<string, string>> {
  const { data } = await supabase
    .from("alumno_tokens")
    .select("alumno_id, token")
    .in("alumno_id", alumnoIds)
    .gt("expires_at", new Date().toISOString());

  const map: Record<string, string> = {};
  for (const t of data ?? []) {
    if (!map[t.alumno_id]) map[t.alumno_id] = t.token;
  }
  return map;
}

async function crearTokensFaltantes(
  alumnos: { id: string }[],
  gymId: string,
  tokenMap: Record<string, string>,
): Promise<void> {
  const sinToken = alumnos.filter(a => !tokenMap[a.id]);
  if (!sinToken.length) return;

  const now = new Date();
  const alumnoIds = sinToken.map(a => a.id);

  // Invalidate existing tokens (same pattern as pay-link)
  await supabase
    .from("alumno_tokens")
    .update({ expires_at: now.toISOString() })
    .in("alumno_id", alumnoIds)
    .gt("expires_at", now.toISOString());

  const nuevos = sinToken.map(a => {
    const rawToken = crypto.randomUUID();
    const tokenHash = createHash("sha256").update(rawToken).digest("hex");
    tokenMap[a.id] = rawToken;
    return {
      alumno_id: a.id,
      gym_id: gymId,
      token: tokenHash,
      expires_at: new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000).toISOString(),
    };
  });

  const { error } = await supabase.from("alumno_tokens").insert(nuevos);
  if (error) {
    console.error("[vencimientos] crearTokensFaltantes:", error.message);
    // Limpiar mapeos porque los tokens no existen en DB
    for (const a of sinToken) delete tokenMap[a.id];
    return;
  }
}

// ── Bloque 1: Transferencias pendientes sin validar ───────────────────────────

async function notificarTransferenciasPendientes(log: string[]): Promise<void> {
  const seisHorasAtras = new Date(Date.now() - 6 * 60 * 60 * 1000).toISOString();

  const { data: pagos, error } = await supabase
    .from("pagos")
    .select("id, gym_id, amount, alumno_id, alumnos(full_name)")
    .eq("method", "transferencia")
    .eq("status", "pendiente")
    .is("notif_pendiente_sent_at", null)
    .lt("created_at", seisHorasAtras);

  if (error) { console.error("[vencimientos] notificarTransferenciasPendientes:", error.message); return; }
  if (!pagos?.length) return;

  const porGym = new Map<string, typeof pagos>();
  for (const p of pagos) {
    const arr = porGym.get(p.gym_id) ?? [];
    arr.push(p);
    porGym.set(p.gym_id, arr);
  }

  for (const [gymId, pagosList] of porGym) {
    const [{ data: ownerRow }, { data: settingsRow }] = await Promise.all([
      supabase.from("profiles").select("phone").eq("gym_id", gymId).eq("role", "admin").maybeSingle(),
      supabase.from("gym_settings").select("whatsapp").eq("gym_id", gymId).maybeSingle(),
    ]);

    const ownerPhone = (ownerRow as { phone: string | null } | null)?.phone ?? null;
    const gymWaPhone = (settingsRow as { whatsapp: string | null } | null)?.whatsapp ?? null;

    if (!ownerPhone || esMismoNumero(ownerPhone, gymWaPhone)) continue;

    const lista = pagosList
      .map(p => {
        const nombre = (p.alumnos as unknown as { full_name: string } | null)?.full_name ?? "Alumno";
        return `• ${nombre} — $${Math.round(p.amount).toLocaleString("es-AR")}`;
      })
      .join("\n");

    const mensaje = `⏳ *Tenés ${pagosList.length} pago${pagosList.length > 1 ? "s" : ""} por validar*\n\n${lista}\n\nEntrá al dashboard para confirmarlos y renovar las membresías.`;
    const enviado = await enviarMensajeWA(gymId, ownerPhone, mensaje);

    if (enviado) {
      const ids = pagosList.map(p => p.id);
      const { error: updErr } = await supabase
        .from("pagos")
        .update({ notif_pendiente_sent_at: new Date().toISOString() })
        .in("id", ids);
      if (updErr) console.error("[vencimientos] marcar notif_pendiente_sent_at:", updErr.message);
      log.push(`⏳ ${pagosList.length} transferencia(s) pendiente(s) notificadas al dueño (gym ${gymId})`);
    }
  }
}

// ── Bloque 2: Socios en riesgo de abandono (14+ días sin venir) ───────────────

async function notificarInasistentes(log: string[], todayStr: string): Promise<void> {
  const cutoff14d      = fechaRelativa(-14);
  const cutoffNotif7d  = fechaRelativa(-7);

  const { data: candidatos, error: candErr } = await supabase
    .from("alumnos")
    .select("id, gym_id, full_name, phone, notif_inasistencia_sent_at")
    .eq("status", "activo")
    .is("deleted_at", null)
    .not("phone", "is", null)
    .or(`notif_inasistencia_sent_at.is.null,notif_inasistencia_sent_at.lte.${cutoffNotif7d}`);

  if (candErr) { console.error("[vencimientos] notificarInasistentes candidatos:", candErr.message); return; }
  if (!candidatos?.length) return;

  const ids = candidatos.map(a => a.id);
  const { data: asistencias, error: asistErr } = await supabase
    .from("asistencias")
    .select("alumno_id, fecha")
    .in("alumno_id", ids)
    .gte("fecha", cutoff14d);

  if (asistErr) { console.error("[vencimientos] notificarInasistentes asistencias:", asistErr.message); return; }

  const ultimaAsistencia: Record<string, string> = {};
  for (const r of asistencias ?? []) {
    if (!ultimaAsistencia[r.alumno_id] || r.fecha > ultimaAsistencia[r.alumno_id]) {
      ultimaAsistencia[r.alumno_id] = r.fecha;
    }
  }

  const enRiesgo = candidatos.filter(a => !ultimaAsistencia[a.id]);
  if (!enRiesgo.length) return;

  const porGym = new Map<string, typeof enRiesgo>();
  for (const a of enRiesgo) {
    const arr = porGym.get(a.gym_id) ?? [];
    arr.push(a);
    porGym.set(a.gym_id, arr);
  }

  for (const [gymId, alumnos] of porGym) {
    const [{ data: ownerRow }, { data: settingsRow }] = await Promise.all([
      supabase.from("profiles").select("phone").eq("gym_id", gymId).eq("role", "admin").maybeSingle(),
      supabase.from("gym_settings").select("gym_name, whatsapp, notif_inasistencia_owner_sent_at").eq("gym_id", gymId).maybeSingle(),
    ]);

    const ownerPhone    = (ownerRow as { phone: string | null } | null)?.phone ?? null;
    const settings      = settingsRow as { gym_name: string | null; whatsapp: string | null; notif_inasistencia_owner_sent_at: string | null } | null;
    const gymName       = settings?.gym_name ?? "el gym";
    const gymWaPhone    = settings?.whatsapp ?? null;
    const ownerSentToday = settings?.notif_inasistencia_owner_sent_at === todayStr;

    if (ownerPhone && !esMismoNumero(ownerPhone, gymWaPhone) && !ownerSentToday) {
      const lista    = alumnos.slice(0, 10).map(a => `• ${a.full_name}`).join("\n");
      const extra    = alumnos.length > 10 ? `\n...y ${alumnos.length - 10} más.` : "";
      const msgDueno = `🔔 *Socios sin venir hace 14+ días*\n\n${lista}${extra}\n\nLes mandé un mensaje automático. Podés hacer seguimiento desde el dashboard.`;
      const enviado  = await enviarMensajeWA(gymId, ownerPhone, msgDueno);
      if (enviado) {
        await supabase.from("gym_settings")
          .update({ notif_inasistencia_owner_sent_at: todayStr })
          .eq("gym_id", gymId);
      }
    }

    // Encolar en bulk con stagger anti-spam (dedup_key previene doble envío)
    await enqueueWABulk(alumnos.map(alumno => ({
      gymId,
      phone:    normalizePhone(alumno.phone!),
      message:  `¡Hola ${alumno.full_name}! 👋 Te extrañamos en *${gymName}*.\n\n¿Todo bien? Si necesitás algo, estamos acá. ¡Te esperamos! 💪`,
      dedupKey: `inasistencia14d:${alumno.id}:${todayStr}`,
    })));

    for (const alumno of alumnos) {
      const { error } = await supabase.from("alumnos")
        .update({ notif_inasistencia_sent_at: todayStr })
        .eq("id", alumno.id);
      if (error) console.error(`[vencimientos] marcar inasistencia alumno=${alumno.id}:`, error.message);
      else log.push(`💪 ${alumno.full_name} (${gymName}) — inasistencia 14d (encolado)`);
    }
  }
}

// ── Bloque 3: Sincronizar status activo ↔ vencido + auto-descongelar ────────

async function sincronizarStatus(todayStr: string, log: string[]): Promise<void> {
  const { data: vencidos, error: e1 } = await supabase
    .from("alumnos")
    .update({ status: "vencido" })
    .eq("status", "activo")
    .is("deleted_at", null)
    .not("next_expiration_date", "is", null)
    .lt("next_expiration_date", todayStr)
    .select("id");
  if (e1) console.error("[vencimientos] sincronizarStatus vencidos:", e1.message);
  if (vencidos?.length) log.push(`→ ${vencidos.length} alumno(s) marcados como vencidos`);

  const { data: reactivados, error: e2 } = await supabase
    .from("alumnos")
    .update({ status: "activo" })
    .eq("status", "vencido")
    .is("deleted_at", null)
    .not("next_expiration_date", "is", null)
    .gte("next_expiration_date", todayStr)
    .select("id");
  if (e2) console.error("[vencimientos] sincronizarStatus reactivados:", e2.message);
  if (reactivados?.length) log.push(`→ ${reactivados.length} alumno(s) reactivados por renovación`);

  // Auto-descongelar: pausado cuyo pausa_hasta ya pasó
  const { data: congelados, error: e3 } = await supabase
    .from("alumnos")
    .select("id, frozen_since, next_expiration_date")
    .eq("status", "pausado")
    .is("deleted_at", null)
    .not("pausa_hasta", "is", null)
    .lt("pausa_hasta", todayStr);
  if (e3) { console.error("[vencimientos] sincronizarStatus congelados:", e3.message); return; }

  for (const alumno of congelados ?? []) {
    const frozenSince = (alumno as { frozen_since: string | null }).frozen_since ?? todayStr;
    const diasCongelados = Math.max(
      0,
      Math.round((new Date(`${todayStr}T12:00:00`).getTime() - new Date(`${frozenSince}T12:00:00`).getTime()) / 86_400_000),
    );
    let newExpiration = (alumno as { next_expiration_date: string | null }).next_expiration_date ?? null;
    if (newExpiration && diasCongelados > 0) {
      const d = new Date(`${newExpiration}T12:00:00`);
      d.setDate(d.getDate() + diasCongelados);
      newExpiration = d.toISOString().slice(0, 10);
    }
    const { error: updErr } = await supabase
      .from("alumnos")
      .update({
        status: "activo",
        frozen_since: null,
        pausa_hasta: null,
        ...(newExpiration ? { next_expiration_date: newExpiration } : {}),
      })
      .eq("id", (alumno as { id: string }).id);
    if (updErr) console.error(`[vencimientos] auto-descongelar alumno=${(alumno as { id: string }).id}:`, updErr.message);
    else log.push(`❄️ Alumno ${(alumno as { id: string }).id} descongelado (+${diasCongelados}d → ${newExpiration})`);
  }
}

// ── Bloque 4: Follow-ups post-vencimiento (día 3 y día 7) ────────────────────

const MSG_D3 = `Hola [Nombre], soy del staff de [Gym]. Te recuerdo que tu cuota vence el [Fecha]. Si querés renovar, avisame.`;
const MSG_D7 = `Hola [Nombre], soy del staff de [Gym]. Tu cuota vence dentro de una semana ([Fecha]). ¿Querés que te ayude a renovar?`;

async function enviarFollowupsPostVencimiento(
  gyms: GymSettings[],
  todayStr: string,
  log: string[],
): Promise<number> {
  let enviados = 0;

  for (const gym of gyms) {
    const { data: alumnos, error } = await supabase
      .from("alumnos")
      .select("id, full_name, phone, next_expiration_date, notif_vencido_d3_para, notif_vencido_d7_para")
      .eq("gym_id", gym.gym_id)
      .eq("status", "vencido")
      .is("deleted_at", null)
      .not("phone", "is", null)
      .not("next_expiration_date", "is", null)
      .lte("next_expiration_date", todayStr);

    if (error) { console.error(`[vencimientos] followups gym=${gym.gym_id}:`, error.message); continue; }
    if (!alumnos?.length) continue;

    const tokenMap = await obtenerTokensExistentes(alumnos.map(a => a.id));

    const gymName      = gym.gym_name ?? "el gym";
    const paymentSuffix = buildPaymentSuffix(Boolean(gym.mp_access_token), gym.payment_info);

    for (const alumno of alumnos as AlumnoVencido[]) {
      if (!alumno.phone || !alumno.next_expiration_date) continue;

      const diasVencido = Math.floor((Date.now() - new Date(alumno.next_expiration_date).getTime()) / 86_400_000);
      const link        = buildPaymentLink(tokenMap[alumno.id], Boolean(gym.mp_access_token));

      const enviarFollowup = async (
        step: "d3" | "d7",
        templateBase: string,
        columna: string,
        yaEnviado: string | null,
      ) => {
        if (yaEnviado === alumno.next_expiration_date) return;
        const templateBranded = ensureGymBranding(templateBase, gymName);
        const mensaje = fillTemplate(templateBranded + paymentSuffix, {
          Nombre: alumno.full_name,
          Gym:    gymName,
          Link:   link,
        });
        await enqueueWABulk([{
          gymId:    gym.gym_id,
          phone:    alumno.phone!,
          message:  mensaje,
          dedupKey: `venc_${step}:${alumno.id}:${alumno.next_expiration_date}`,
        }]);
        const { error: upErr } = await supabase.from("alumnos")
          .update({ [columna]: alumno.next_expiration_date })
          .eq("id", alumno.id);
        if (upErr) { console.error(`[vencimientos] followup ${step} alumno=${alumno.id}:`, upErr.message); return; }
        logWASend(supabase, gym.gym_id, "vencimiento", alumno.id, alumno.full_name);
        void logAlumnoActivity(alumno.id, gym.gym_id, "wa_enviado", `Recordatorio vencimiento día ${diasVencido} encolado`);
        enviados++;
        log.push(`✓ ${alumno.full_name} (${gymName}) — follow-up ${step} encolado (día ${diasVencido})`);
      };

      if (diasVencido >= 3) await enviarFollowup("d3", MSG_D3, "notif_vencido_d3_para", alumno.notif_vencido_d3_para);
      if (diasVencido >= 7) await enviarFollowup("d7", MSG_D7, "notif_vencido_d7_para", alumno.notif_vencido_d7_para);
    }
  }

  return enviados;
}

// ── Bloque 5b: Notificación día exacto de vencimiento ────────────────────────

const MSG_VENCE_HOY = `¡Hola [Nombre]! 🔔 Tu membresía en *[Gym]* vence *hoy*. Renovála para no perder tu acceso. 💪`;

async function enviarNotificacionesVenceHoy(
  gyms: GymSettings[],
  todayStr: string,
  log: string[],
): Promise<number> {
  let enviados = 0;

  for (const gym of gyms) {
    const { data: alumnos, error } = await supabase
      .from("alumnos")
      .select("id, full_name, phone, next_expiration_date")
      .eq("gym_id", gym.gym_id)
      .eq("status", "activo")
      .is("deleted_at", null)
      .eq("next_expiration_date", todayStr)
      .not("phone", "is", null)
      .or(`notif_vence_hoy_para.is.null,notif_vence_hoy_para.neq.${todayStr}`);

    if (error) { console.error(`[vencimientos] vence-hoy gym=${gym.gym_id}:`, error.message); continue; }
    if (!alumnos?.length) continue;

    const tokenMap = await obtenerTokensExistentes(alumnos.map(a => a.id));
    await crearTokensFaltantes(alumnos, gym.gym_id, tokenMap);

    const gymName       = gym.gym_name ?? "el gym";
    const paymentSuffix = buildPaymentSuffix(Boolean(gym.mp_access_token), gym.payment_info);

    for (const alumno of alumnos) {
      const link    = buildPaymentLink(tokenMap[alumno.id], Boolean(gym.mp_access_token));
      const mensaje = fillTemplate(MSG_VENCE_HOY + (link ? `\n\n👉 ${link}` : "") + paymentSuffix, {
        Nombre: alumno.full_name,
        Gym:    gymName,
        Link:   link,
      });
      await enqueueWABulk([{
        gymId:    gym.gym_id,
        phone:    alumno.phone!,
        message:  mensaje,
        dedupKey: `vence_hoy:${alumno.id}:${todayStr}`,
      }]);
      const { error: upErr } = await supabase.from("alumnos")
        .update({ notif_vence_hoy_para: todayStr })
        .eq("id", alumno.id);
      if (upErr) { console.error(`[vencimientos] vence-hoy alumno=${alumno.id}:`, upErr.message); continue; }
      logWASend(supabase, gym.gym_id, "vencimiento", alumno.id, alumno.full_name);
      void logAlumnoActivity(alumno.id, gym.gym_id, "wa_enviado", "Aviso de vencimiento hoy encolado");
      enviados++;
      log.push(`🔔 ${alumno.full_name} (${gymName}) — vence hoy (encolado)`);
    }
  }

  return enviados;
}

// ── Bloque 5: Recordatorios pre-vencimiento ───────────────────────────────────

const MSG_DEFAULT_VENCIMIENTO = `¡Hola [Nombre]! 👋 Tu membresía en *[Gym]* vence el *[Fecha]*. Renovála para seguir entrenando sin interrupciones. 💪`;

async function enviarRecordatoriosProximos(
  gyms: GymSettings[],
  todayStr: string,
  log: string[],
): Promise<number> {
  let enviados = 0;

  for (const gym of gyms) {
    const diasAnticipacion = gym.vencimiento_dias ?? 3;
    const cutoffStr        = fechaRelativa(diasAnticipacion);

    const { data: alumnos, error } = await supabase
      .from("alumnos")
      .select("id, full_name, phone, next_expiration_date, notif_vencimiento_para")
      .eq("gym_id", gym.gym_id)
      .eq("status", "activo")
      .is("deleted_at", null)
      .not("phone", "is", null)
      .not("next_expiration_date", "is", null)
      .lte("next_expiration_date", cutoffStr)
      .gte("next_expiration_date", todayStr);

    if (error) { console.error(`[vencimientos] recordatorios gym=${gym.gym_id}:`, error.message); continue; }
    if (!alumnos?.length) continue;

    const pendientes = (alumnos as AlumnoPendiente[]).filter(
      a => a.notif_vencimiento_para !== a.next_expiration_date,
    );
    if (!pendientes.length) continue;

    const tokenMap = await obtenerTokensExistentes(pendientes.map(a => a.id));
    await crearTokensFaltantes(pendientes, gym.gym_id, tokenMap);

    const template      = gym.vencimiento_msg?.trim() || MSG_DEFAULT_VENCIMIENTO;
    const gymName       = gym.gym_name ?? "el gym";
    const paymentSuffix = buildPaymentSuffix(Boolean(gym.mp_access_token), gym.payment_info);

    for (const alumno of pendientes) {
      const link     = buildPaymentLink(tokenMap[alumno.id], Boolean(gym.mp_access_token));
      const fechaVto = new Date(alumno.next_expiration_date! + "T12:00:00")
        .toLocaleDateString("es-AR", { day: "numeric", month: "long" });
      const mensaje  = fillTemplate(template + (link ? `\n\n👉 Renová desde acá: ${link}` : "") + paymentSuffix, {
        Nombre: alumno.full_name,
        Gym:    gymName,
        Fecha:  fechaVto,
        Link:   link,
      });

      await enqueueWABulk([{
        gymId:    gym.gym_id,
        phone:    alumno.phone!,
        message:  mensaje,
        dedupKey: `recordatorio:${alumno.id}:${alumno.next_expiration_date}`,
      }]);
      const { error: upErr } = await supabase.from("alumnos")
        .update({ notif_vencimiento_para: alumno.next_expiration_date })
        .eq("id", alumno.id);
      if (upErr) { console.error(`[vencimientos] marcar notif alumno=${alumno.id}:`, upErr.message); continue; }
      logWASend(supabase, gym.gym_id, "vencimiento", alumno.id, alumno.full_name);
      void logAlumnoActivity(alumno.id, gym.gym_id, "wa_enviado", `Recordatorio pre-vencimiento encolado · vence ${alumno.next_expiration_date}`);
      enviados++;
      log.push(`✓ ${alumno.full_name} (${gymName}) — vence ${alumno.next_expiration_date} (encolado)`);
    }
  }

  return enviados;
}

// ── Handler principal ─────────────────────────────────────────────────────────

export async function GET(req: NextRequest) {
  if (!isCronAuthorized(req)) return cronUnauthorized();
  if (!MOTOR_URL) return NextResponse.json({ error: "Motor WA no configurado." }, { status: 500 });

  const startedAt = Date.now();
  const todayStr = getTodayDate();
  const log: string[] = [];

  try {
    await notificarTransferenciasPendientes(log);
    await notificarInasistentes(log, todayStr);
    await sincronizarStatus(todayStr, log);

    const { data: gyms, error: gymsErr } = await supabase
      .from("gym_settings")
      .select("gym_id, gym_name, vencimiento_dias, vencimiento_msg, mp_access_token, payment_info")
      .eq("vencimiento_activo", true);

    if (gymsErr) console.error("[vencimientos] cargar gyms:", gymsErr.message);

    let venceHoy = 0, followups = 0, recordatorios = 0;
    if (gyms?.length) {
      venceHoy      = await enviarNotificacionesVenceHoy(gyms, todayStr, log);
      followups     = await enviarFollowupsPostVencimiento(gyms, todayStr, log);
      recordatorios = await enviarRecordatoriosProximos(gyms, todayStr, log);
    }

    // Pruning: eliminar snapshots de meses anteriores al actual (fuego y olvido)
    const currentMonthKey = todayStr.slice(0, 7);
    void supabase.from("dashboard_snapshots").delete().lt("month_key", currentMonthKey);

    const enviados = venceHoy + followups + recordatorios;
    void supabase.from("cron_runs").insert({
      cron_name:   "vencimientos",
      status:      "ok",
      duration_ms: Date.now() - startedAt,
      summary:     `${todayStr} · ${enviados} WA enviados`,
      counts:      { venceHoy, followups, recordatorios, log },
    });

    return NextResponse.json({ ok: true, enviados, log });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    void supabase.from("cron_runs").insert({
      cron_name:   "vencimientos",
      status:      "error",
      duration_ms: Date.now() - startedAt,
      summary:     msg,
    });
    console.error("[vencimientos] error fatal:", msg);
    return NextResponse.json({ ok: false, error: msg }, { status: 500 });
  }
}
