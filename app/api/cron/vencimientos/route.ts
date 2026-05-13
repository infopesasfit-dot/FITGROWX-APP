import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { isCronAuthorized, cronUnauthorized } from "@/lib/request-security";
import { normalizePhone } from "@/lib/phone";

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
  const d = new Date();
  d.setDate(d.getDate() + dias);
  return d.toISOString().slice(0, 10);
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
      signal: AbortSignal.timeout(8000),
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

  const nuevos = sinToken.map(a => ({
    alumno_id: a.id,
    gym_id: gymId,
    token: crypto.randomUUID(),
    expires_at: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(),
  }));

  const { data, error } = await supabase.from("alumno_tokens").insert(nuevos).select("alumno_id, token");
  if (error) {
    console.error("[vencimientos] crearTokensFaltantes:", error.message);
    return;
  }
  for (const t of data ?? []) tokenMap[t.alumno_id] = t.token;
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
      supabase.from("gym_settings").select("gym_name, whatsapp").eq("gym_id", gymId).maybeSingle(),
    ]);

    const ownerPhone = (ownerRow as { phone: string | null } | null)?.phone ?? null;
    const gymName    = (settingsRow as { gym_name: string | null; whatsapp: string | null } | null)?.gym_name ?? "el gym";
    const gymWaPhone = (settingsRow as { gym_name: string | null; whatsapp: string | null } | null)?.whatsapp ?? null;

    if (ownerPhone && !esMismoNumero(ownerPhone, gymWaPhone)) {
      const lista  = alumnos.slice(0, 10).map(a => `• ${a.full_name}`).join("\n");
      const extra  = alumnos.length > 10 ? `\n...y ${alumnos.length - 10} más.` : "";
      const msgDueno = `🔔 *Socios sin venir hace 14+ días*\n\n${lista}${extra}\n\nLes mandé un mensaje automático. Podés hacer seguimiento desde el dashboard.`;
      await enviarMensajeWA(gymId, ownerPhone, msgDueno);
    }

    const CHUNK = 5;
    for (let i = 0; i < alumnos.length; i += CHUNK) {
      const chunk = alumnos.slice(i, i + CHUNK);
      await Promise.allSettled(
        chunk.map(async alumno => {
          const msg = `¡Hola ${alumno.full_name}! 👋 Te extrañamos en *${gymName}*.\n\n¿Todo bien? Si necesitás algo, estamos acá. ¡Te esperamos! 💪`;
          const ok  = await enviarMensajeWA(gymId, alumno.phone!, msg);
          if (ok) {
            const { error } = await supabase.from("alumnos")
              .update({ notif_inasistencia_sent_at: todayStr })
              .eq("id", alumno.id);
            if (error) console.error(`[vencimientos] marcar inasistencia alumno=${alumno.id}:`, error.message);
            log.push(`💪 ${alumno.full_name} (${gymName}) — inasistencia 14d`);
          }
        }),
      );
    }
  }
}

// ── Bloque 3: Sincronizar status activo ↔ vencido ─────────────────────────────

async function sincronizarStatus(todayStr: string, log: string[]): Promise<void> {
  const { data: vencidos, error: e1 } = await supabase
    .from("alumnos")
    .update({ status: "vencido" })
    .eq("status", "activo")
    .not("next_expiration_date", "is", null)
    .lt("next_expiration_date", todayStr)
    .select("id");
  if (e1) console.error("[vencimientos] sincronizarStatus vencidos:", e1.message);
  if (vencidos?.length) log.push(`→ ${vencidos.length} alumno(s) marcados como vencidos`);

  const { data: reactivados, error: e2 } = await supabase
    .from("alumnos")
    .update({ status: "activo" })
    .eq("status", "vencido")
    .not("next_expiration_date", "is", null)
    .gte("next_expiration_date", todayStr)
    .select("id");
  if (e2) console.error("[vencimientos] sincronizarStatus reactivados:", e2.message);
  if (reactivados?.length) log.push(`→ ${reactivados.length} alumno(s) reactivados por renovación`);
}

// ── Bloque 4: Follow-ups post-vencimiento (día 3 y día 7) ────────────────────

const MSG_D3 = `¡Hola [Nombre]! 👋 Tu membresía en *[Gym]* venció hace 3 días. Renovála para retomar tu entrenamiento 💪\n\n👉 [Link]`;
const MSG_D7 = `[Nombre], tu membresía en *[Gym]* lleva una semana vencida 😔 Si necesitás retomar, estamos acá. Renovála acá 👇\n\n👉 [Link]`;

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
        const mensaje = fillTemplate(templateBase + paymentSuffix, {
          Nombre: alumno.full_name,
          Gym:    gymName,
          Link:   link,
        });
        const ok = await enviarMensajeWA(gym.gym_id, alumno.phone!, mensaje);
        if (ok) {
          const { error: upErr } = await supabase.from("alumnos")
            .update({ [columna]: alumno.next_expiration_date })
            .eq("id", alumno.id);
          if (upErr) console.error(`[vencimientos] followup ${step} alumno=${alumno.id}:`, upErr.message);
          enviados++;
          log.push(`✓ ${alumno.full_name} (${gymName}) — follow-up ${step} (día ${diasVencido})`);
        } else {
          log.push(`✗ ${alumno.full_name} (${gymName}) — follow-up ${step} falló`);
        }
      };

      if (diasVencido >= 3) await enviarFollowup("d3", MSG_D3, "notif_vencido_d3_para", alumno.notif_vencido_d3_para);
      if (diasVencido >= 7) await enviarFollowup("d7", MSG_D7, "notif_vencido_d7_para", alumno.notif_vencido_d7_para);
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

    const CHUNK = 5;
    for (let i = 0; i < pendientes.length; i += CHUNK) {
      const chunk = pendientes.slice(i, i + CHUNK);
      const resultados = await Promise.allSettled(
        chunk.map(async alumno => {
          const link      = buildPaymentLink(tokenMap[alumno.id], Boolean(gym.mp_access_token));
          const fechaVto  = new Date(alumno.next_expiration_date! + "T12:00:00")
            .toLocaleDateString("es-AR", { day: "numeric", month: "long" });
          const mensaje   = fillTemplate(template + (link ? `\n\n👉 Renová desde acá: ${link}` : "") + paymentSuffix, {
            Nombre: alumno.full_name,
            Gym:    gymName,
            Fecha:  fechaVto,
            Link:   link,
          });

          const res = await fetch(`${MOTOR_URL}/send/${gym.gym_id}`, {
            method: "POST",
            headers: { "Content-Type": "application/json", "x-api-key": MOTOR_KEY },
            body: JSON.stringify({ phone: normalizePhone(alumno.phone!), message: mensaje }),
            signal: AbortSignal.timeout(8000),
          });
          if (!res.ok) throw new Error(`HTTP ${res.status}`);

          const { error: upErr } = await supabase.from("alumnos")
            .update({ notif_vencimiento_para: alumno.next_expiration_date })
            .eq("id", alumno.id);
          if (upErr) console.error(`[vencimientos] marcar notif alumno=${alumno.id}:`, upErr.message);
        }),
      );

      for (let j = 0; j < resultados.length; j++) {
        const alumno = chunk[j];
        if (resultados[j].status === "fulfilled") {
          enviados++;
          log.push(`✓ ${alumno.full_name} (${gymName}) — vence ${alumno.next_expiration_date}`);
        } else {
          const reason = resultados[j].status === "rejected"
            ? (resultados[j] as PromiseRejectedResult).reason
            : null;
          log.push(`✗ ${alumno.full_name} (${gymName}) — ${reason instanceof Error ? reason.message : "error"} (se reintentará)`);
        }
      }
    }
  }

  return enviados;
}

// ── Handler principal ─────────────────────────────────────────────────────────

export async function GET(req: NextRequest) {
  if (!isCronAuthorized(req)) return cronUnauthorized();
  if (!MOTOR_URL) return NextResponse.json({ error: "Motor WA no configurado." }, { status: 500 });

  const todayStr = new Date().toISOString().slice(0, 10);
  const log: string[] = [];

  await notificarTransferenciasPendientes(log);
  await notificarInasistentes(log, todayStr);
  await sincronizarStatus(todayStr, log);

  const { data: gyms, error: gymsErr } = await supabase
    .from("gym_settings")
    .select("gym_id, gym_name, vencimiento_dias, vencimiento_msg, mp_access_token, payment_info")
    .eq("vencimiento_activo", true);

  if (gymsErr) console.error("[vencimientos] cargar gyms:", gymsErr.message);
  if (!gyms?.length) return NextResponse.json({ ok: true, enviados: 0, log });

  const followups   = await enviarFollowupsPostVencimiento(gyms, todayStr, log);
  const recordatorios = await enviarRecordatoriosProximos(gyms, todayStr, log);

  return NextResponse.json({ ok: true, enviados: followups + recordatorios, log });
}
