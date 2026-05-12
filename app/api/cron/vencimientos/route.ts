import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { isCronAuthorized, cronUnauthorized } from "@/lib/request-security";
import { normalizePhone } from "@/lib/phone";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

const APP_URL = (process.env.NEXT_PUBLIC_APP_URL ?? "https://app.fitgrowx.com").replace(/\/$/, "");

export async function GET(req: NextRequest) {
  if (!isCronAuthorized(req)) return cronUnauthorized();

  const motorUrl = process.env.WA_MOTOR_URL;
  if (!motorUrl) return NextResponse.json({ error: "Motor WA no configurado." }, { status: 500 });

  const log: string[] = [];
  const todayStr = new Date().toISOString().slice(0, 10);

  // ── Transferencias pendientes sin validar ──────────────────────────────────
  // Si hay pagos de transferencia con más de 6hs sin validar, avisar al dueño por WA.
  // notif_pendiente_sent_at evita mandar la misma alerta más de una vez por pago.
  {
    const sixHoursAgo = new Date(Date.now() - 6 * 60 * 60 * 1000).toISOString();
    const { data: pendingTransfers } = await supabase
      .from("pagos")
      .select("id, gym_id, amount, concepto, alumno_id, alumnos(full_name)")
      .eq("method", "transferencia")
      .eq("status", "pendiente")
      .is("notif_pendiente_sent_at", null)
      .lt("created_at", sixHoursAgo);

    if (pendingTransfers?.length) {
      // Group by gym
      const byGym = new Map<string, typeof pendingTransfers>();
      for (const p of pendingTransfers) {
        const arr = byGym.get(p.gym_id) ?? [];
        arr.push(p);
        byGym.set(p.gym_id, arr);
      }

      const motorUrl = process.env.WA_MOTOR_URL;
      for (const [gymId, pagos] of byGym) {
        const [ownerRow, waRow] = await Promise.all([
          supabase.from("profiles").select("phone").eq("gym_id", gymId).eq("role", "admin").maybeSingle(),
          supabase.from("gym_settings").select("whatsapp").eq("gym_id", gymId).maybeSingle(),
        ]);

        const ownerPhone = (ownerRow.data as { phone: string | null } | null)?.phone;
        const gymWaPhone = (waRow.data as { whatsapp: string | null } | null)?.whatsapp;
        const sameNumber = ownerPhone && gymWaPhone && normalizePhone(ownerPhone) === normalizePhone(gymWaPhone);

        if (ownerPhone && !sameNumber && motorUrl) {
          const lista = pagos
            .map(p => {
              const nombre = (p.alumnos as unknown as { full_name: string } | null)?.full_name ?? "Alumno";
              return `• ${nombre} — $${Math.round(p.amount).toLocaleString("es-AR")}`;
            })
            .join("\n");
          const msg = `⏳ *Tenés ${pagos.length} pago${pagos.length > 1 ? "s" : ""} por validar*\n\n${lista}\n\nEntrá al dashboard para confirmarlos y renovar las membresías.`;
          try {
            const res = await fetch(`${motorUrl}/send/${gymId}`, {
              method: "POST",
              headers: { "Content-Type": "application/json", "x-api-key": process.env.WA_MOTOR_API_KEY ?? "" },
              body: JSON.stringify({ phone: normalizePhone(ownerPhone), message: msg }),
              signal: AbortSignal.timeout(8000),
            });
            if (res.ok) {
              const ids = pagos.map(p => p.id);
              await supabase.from("pagos")
                .update({ notif_pendiente_sent_at: new Date().toISOString() })
                .in("id", ids);
              log.push(`⏳ ${pagos.length} transferencia(s) pendiente(s) notificadas al dueño (gym ${gymId})`);
            }
          } catch { /* non-blocking */ }
        }
      }
    }
  }
  // ───────────────────────────────────────────────────────────────────────────

  // ── Socios en riesgo de abandono (sin venir 14+ días) ────────────────────
  // Por gym: WA al dueño con lista + WA "te extrañamos" a cada alumno.
  // notif_inasistencia_sent_at evita repetir más de una vez por semana.
  {
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - 14);
    const cutoffStr = cutoffDate.toISOString().slice(0, 10);

    const reminderCutoff = new Date();
    reminderCutoff.setDate(reminderCutoff.getDate() - 7);
    const reminderCutoffStr = reminderCutoff.toISOString().slice(0, 10);

    // Active alumnos not yet notified (or notified more than 7 days ago)
    const { data: candidates } = await supabase
      .from("alumnos")
      .select("id, gym_id, full_name, phone, notif_inasistencia_sent_at")
      .eq("status", "activo")
      .not("phone", "is", null)
      .or(`notif_inasistencia_sent_at.is.null,notif_inasistencia_sent_at.lte.${reminderCutoffStr}`);

    if (candidates?.length) {
      const candidateIds = candidates.map((a) => a.id);

      // Recent asistencias for these alumnos only
      const { data: recentAsist } = await supabase
        .from("asistencias")
        .select("alumno_id, fecha")
        .in("alumno_id", candidateIds)
        .gte("fecha", cutoffStr);

      const lastAttMap: Record<string, string> = {};
      for (const r of recentAsist ?? []) {
        if (!lastAttMap[r.alumno_id] || r.fecha > lastAttMap[r.alumno_id]) {
          lastAttMap[r.alumno_id] = r.fecha;
        }
      }

      // Those with no attendance in the last 14 days
      const atRisk = candidates.filter((a) => !lastAttMap[a.id]);

      if (atRisk.length) {
        // Group by gym
        const byGym = new Map<string, typeof atRisk>();
        for (const a of atRisk) {
          const arr = byGym.get(a.gym_id) ?? [];
          arr.push(a);
          byGym.set(a.gym_id, arr);
        }

        for (const [gymId, riskAlumnos] of byGym) {
          const [ownerRes, settingsRes] = await Promise.all([
            supabase.from("profiles").select("phone").eq("gym_id", gymId).eq("role", "admin").maybeSingle(),
            supabase.from("gym_settings").select("gym_name, whatsapp").eq("gym_id", gymId).maybeSingle(),
          ]);
          const ownerPhone = (ownerRes.data as { phone: string | null } | null)?.phone;
          const gymName = (settingsRes.data as { gym_name: string | null; whatsapp: string | null } | null)?.gym_name ?? "el gym";
          const gymWaPhone = (settingsRes.data as { gym_name: string | null; whatsapp: string | null } | null)?.whatsapp;
          const sameNumber = ownerPhone && gymWaPhone && normalizePhone(ownerPhone) === normalizePhone(gymWaPhone);

          // WA al dueño — resumen de la lista (solo si no usa el mismo número para el gym)
          if (ownerPhone && !sameNumber) {
            const lista = riskAlumnos
              .slice(0, 10)
              .map((a) => `• ${a.full_name}`)
              .join("\n");
            const extra = riskAlumnos.length > 10 ? `\n...y ${riskAlumnos.length - 10} más.` : "";
            const ownerMsg = `🔔 *Socios sin venir hace 14+ días*\n\n${lista}${extra}\n\nLes mandé un mensaje automático. Podés hacer seguimiento desde el dashboard.`;
            try {
              await fetch(`${motorUrl}/send/${gymId}`, {
                method: "POST",
                headers: { "Content-Type": "application/json", "x-api-key": process.env.WA_MOTOR_API_KEY ?? "" },
                body: JSON.stringify({ phone: normalizePhone(ownerPhone), message: ownerMsg }),
                signal: AbortSignal.timeout(8000),
              });
            } catch { /* non-blocking */ }
          }

          // WA a cada alumno + marcar notif
          const CHUNK = 5;
          for (let i = 0; i < riskAlumnos.length; i += CHUNK) {
            const chunk = riskAlumnos.slice(i, i + CHUNK);
            await Promise.allSettled(
              chunk.map(async (alumno) => {
                const msg = `¡Hola ${alumno.full_name}! 👋 Te extrañamos en *${gymName}*.\n\n¿Todo bien? Si necesitás algo, estamos acá. ¡Te esperamos! 💪`;
                try {
                  const res = await fetch(`${motorUrl}/send/${gymId}`, {
                    method: "POST",
                    headers: { "Content-Type": "application/json", "x-api-key": process.env.WA_MOTOR_API_KEY ?? "" },
                    body: JSON.stringify({ phone: normalizePhone(alumno.phone!), message: msg }),
                    signal: AbortSignal.timeout(8000),
                  });
                  if (res.ok) {
                    await supabase.from("alumnos")
                      .update({ notif_inasistencia_sent_at: todayStr })
                      .eq("id", alumno.id);
                    log.push(`💪 ${alumno.full_name} (${gymName}) — inasistencia 14d`);
                  }
                } catch { /* non-blocking */ }
              })
            );
          }
        }
      }
    }
  }
  // ─────────────────────────────────────────────────────────────────────────

  // ── Sincronización de status ────────────────────────────────────────────────
  // activo → vencido: membresía venció y nadie la renovó
  const { data: expiredRows } = await supabase
    .from("alumnos")
    .update({ status: "vencido" })
    .eq("status", "activo")
    .not("next_expiration_date", "is", null)
    .lt("next_expiration_date", todayStr)
    .select("id");
  const expiredCount = expiredRows?.length ?? 0;
  if (expiredCount) log.push(`→ ${expiredCount} alumno(s) marcados como vencidos`);

  // vencido → activo: renovaron pero el status quedó stale
  const { data: renewedRows } = await supabase
    .from("alumnos")
    .update({ status: "activo" })
    .eq("status", "vencido")
    .not("next_expiration_date", "is", null)
    .gte("next_expiration_date", todayStr)
    .select("id");
  const renewedCount = renewedRows?.length ?? 0;
  if (renewedCount) log.push(`→ ${renewedCount} alumno(s) reactivados por renovación`);
  // ───────────────────────────────────────────────────────────────────────────

  // Gyms con recordatorio de vencimiento activo
  const { data: gyms } = await supabase
    .from("gym_settings")
    .select("gym_id, gym_name, vencimiento_dias, vencimiento_msg, mp_access_token, payment_info")
    .eq("vencimiento_activo", true);

  // ── Post-expiry follow-ups (día 3 y día 7) ────────────────────────────────
  if (gyms?.length) {
    const DEFAULT_D3 = `¡Hola [Nombre]! 👋 Tu membresía en *[Gym]* venció hace 3 días. Renovála para retomar tu entrenamiento 💪\n\n👉 [Link]`;
    const DEFAULT_D7 = `[Nombre], tu membresía en *[Gym]* lleva una semana vencida 😔 Si necesitás retomar, estamos acá. Renovála acá 👇\n\n👉 [Link]`;

    for (const gym of gyms) {
      const d3cutoff = new Date(); d3cutoff.setDate(d3cutoff.getDate() - 3);
      const d7cutoff = new Date(); d7cutoff.setDate(d7cutoff.getDate() - 7);

      const { data: vencidos } = await supabase
        .from("alumnos")
        .select("id, full_name, phone, next_expiration_date, notif_vencido_d3_para, notif_vencido_d7_para")
        .eq("gym_id", gym.gym_id)
        .eq("status", "vencido")
        .not("phone", "is", null)
        .not("next_expiration_date", "is", null)
        .lte("next_expiration_date", todayStr);

      if (!vencidos?.length) continue;

      // Fetch tokens
      const ids = vencidos.map(a => a.id);
      const { data: tokens } = await supabase
        .from("alumno_tokens")
        .select("alumno_id, token")
        .in("alumno_id", ids)
        .gt("expires_at", new Date().toISOString());
      const tmap: Record<string, string> = {};
      for (const t of tokens ?? []) { if (!tmap[t.alumno_id]) tmap[t.alumno_id] = t.token; }

      for (const alumno of vencidos) {
        if (!alumno.phone) continue;
        const expDate = alumno.next_expiration_date!;
        const expiryMs = new Date(expDate).getTime();
        const diffDays = Math.floor((Date.now() - expiryMs) / 86_400_000);
        const phone = normalizePhone(alumno.phone);
        const tkn = tmap[alumno.id];
        const link = tkn
          ? gym.mp_access_token
            ? `${APP_URL}/api/alumno/pagar-link?token=${tkn}`
            : `${APP_URL}/alumno/auth?token=${tkn}`
          : "";
        const paymentSuffix = !gym.mp_access_token && gym.payment_info
          ? `\n\n💳 Datos de pago:\n${gym.payment_info}`
          : "";
        const gymName = gym.gym_name ?? "el gym";

        const sendFollowup = async (step: "d3" | "d7", defaultMsg: string, colName: string) => {
          const alreadySent = step === "d3" ? alumno.notif_vencido_d3_para : alumno.notif_vencido_d7_para;
          if (alreadySent === expDate) return; // ya enviado para este vencimiento
          const message = (defaultMsg + paymentSuffix)
            .replace(/\[Nombre\]/g, alumno.full_name)
            .replace(/\[Gym\]/g, gymName)
            .replace(/\[Link\]/g, link);
          try {
            const res = await fetch(`${motorUrl}/send/${gym.gym_id}`, {
              method: "POST",
              headers: { "Content-Type": "application/json", "x-api-key": process.env.WA_MOTOR_API_KEY ?? "" },
              body: JSON.stringify({ phone, message }),
              signal: AbortSignal.timeout(8000),
            });
            if (res.ok) {
              await supabase.from("alumnos").update({ [colName]: expDate }).eq("id", alumno.id);
              totalEnviados++;
              log.push(`✓ ${alumno.full_name} (${gymName}) — post-vencimiento ${step} (día ${diffDays})`);
            } else {
              log.push(`✗ ${alumno.full_name} — post-vencimiento ${step} HTTP ${res.status}`);
            }
          } catch (e) {
            log.push(`✗ ${alumno.full_name} — post-vencimiento ${step} ${e instanceof Error ? e.message : "error"}`);
          }
        };

        if (diffDays >= 3) await sendFollowup("d3", DEFAULT_D3, "notif_vencido_d3_para");
        if (diffDays >= 7) await sendFollowup("d7", DEFAULT_D7, "notif_vencido_d7_para");
      }
    }
  }
  // ─────────────────────────────────────────────────────────────────────────

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

    // Batch-fetch existing valid tokens for all pending alumnos
    const pendingIds = pending.map(a => a.id);
    const { data: existingTokens } = await supabase
      .from("alumno_tokens")
      .select("alumno_id, token")
      .in("alumno_id", pendingIds)
      .gt("expires_at", new Date().toISOString());

    const tokenMap: Record<string, string> = {};
    for (const t of existingTokens ?? []) {
      if (!tokenMap[t.alumno_id]) tokenMap[t.alumno_id] = t.token;
    }

    // Create tokens for alumnos that don't have one
    const needToken = pending.filter(a => !tokenMap[a.id]);
    if (needToken.length) {
      const newTokens = needToken.map(a => ({
        alumno_id: a.id,
        gym_id: gym.gym_id,
        token: crypto.randomUUID(),
        expires_at: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(),
      }));
      const { data: inserted } = await supabase.from("alumno_tokens").insert(newTokens).select("alumno_id, token");
      for (const t of inserted ?? []) tokenMap[t.alumno_id] = t.token;
    }

    const CHUNK = 5;
    for (let i = 0; i < pending.length; i += CHUNK) {
      const chunk = pending.slice(i, i + CHUNK);
      const results = await Promise.allSettled(
        chunk.map(async alumno => {
          const phone = normalizePhone(alumno.phone!);
          const fechaVto = new Date(alumno.next_expiration_date!).toLocaleDateString("es-AR", { day: "numeric", month: "long" });
          const token = tokenMap[alumno.id];
          // Direct MP checkout if gym has MP, otherwise portal
          const link = token
            ? gym.mp_access_token
              ? `${APP_URL}/api/alumno/pagar-link?token=${token}`
              : `${APP_URL}/alumno/auth?token=${token}`
            : null;
          // Append payment_info to message if no MP configured
          const paymentSuffix = !gym.mp_access_token && gym.payment_info
            ? `\n\n💳 Datos de pago:\n${gym.payment_info}`
            : "";
          const message = (template + (link ? `\n\n👉 Renová desde acá: ${link}` : "") + paymentSuffix)
            .replace(/\[Nombre\]/g, alumno.full_name)
            .replace(/\[Gym\]/g,    gym.gym_name ?? "el gym")
            .replace(/\[Fecha\]/g,  fechaVto)
            .replace(/\[Link\]/g,   link ?? "");
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
