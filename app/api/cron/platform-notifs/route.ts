import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { isCronAuthorized, cronUnauthorized } from "@/lib/request-security";
import { sendWa, isWaConnected } from "@/lib/wa";
import { aggregateWaMetrics, clearExpiredCooldowns } from "@/lib/wa-metrics-aggregator";

export const dynamic = "force-dynamic";

const sb = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
);

const PLAT_SESSION = "fitgrowx-platform";

function fill(template: string, vars: Record<string, string>) {
  return Object.entries(vars).reduce(
    (s, [k, v]) => s.replace(new RegExp(`\\{${k}\\}`, "gi"), v),
    template,
  );
}

function normalizePhone(raw: string | null | undefined): string | null {
  if (!raw) return null;
  const digits = raw.replace(/\D/g, "");
  if (digits.length < 8) return null;
  if (digits.startsWith("549")) return digits;
  if (digits.startsWith("54"))  return "549" + digits.slice(2);
  return "549" + digits;
}

function nombre(acc: { owner_name?: string | null; company_name: string }) {
  return acc.owner_name?.split(" ")[0] ?? acc.company_name.split(" ")[0];
}

export async function GET(req: NextRequest) {
  if (!isCronAuthorized(req)) return cronUnauthorized();

  const startedAt = Date.now();
  const log: string[] = [];
  let trialVence = 0;
  let trialExpirado = 0;
  let inactivosSent = 0;
  let activacionD3 = 0;
  let primerPagoSent = 0;

  if (!process.env.WA_MOTOR_URL) return NextResponse.json({ ok: false, log: ["WA_MOTOR_URL no configurado."] });

  // Verificar sesión activa
  if (!await isWaConnected(PLAT_SESSION)) {
    return NextResponse.json({ ok: false, log: ["Sesión WA de plataforma no activa. Escaneá el QR primero."] });
  }

  try {

  // Agregar métricas WA del último período y limpiar cooldowns vencidos
  await Promise.allSettled([
    aggregateWaMetrics(sb),
    clearExpiredCooldowns(sb),
  ]);

  // Cargar todas las plantillas de una sola query
  const { data: templates } = await sb.from("platform_wa_templates").select("key, body, enabled");
  const tpl: Record<string, string> = {};
  const tplEnabled: Record<string, boolean> = {};
  for (const t of templates ?? []) {
    tpl[t.key] = t.body;
    tplEnabled[t.key] = t.enabled ?? true;
  }

  const now = new Date();
  const todayStr = now.toISOString().slice(0, 10);

  // ── 1. Trial por vencer (2-4 días) ──────────────────────────────────────
  const venceCutoffFrom = new Date(now.getTime() + 2 * 86_400_000).toISOString().slice(0, 10);
  const venceCutoffTo   = new Date(now.getTime() + 4 * 86_400_000).toISOString().slice(0, 10);

  const { data: trialsVence } = tplEnabled["trial_vence"] === false ? { data: [] } : await sb
    .from("platform_accounts")
    .select("id, company_name, owner_name, phone, trial_ends_at")
    .in("status", ["trial_active", "trial_risk"])
    .gte("trial_ends_at", venceCutoffFrom)
    .lte("trial_ends_at", venceCutoffTo)
    .is("wa_trial_vence_sent_at", null)
    .not("phone", "is", null);

  if (tplEnabled["trial_vence"] === false) log.push("— Trial vence: desactivado");
  for (const acc of trialsVence ?? []) {
    const phone = normalizePhone(acc.phone);
    if (!phone) { log.push(`Trial vence — sin tel: ${acc.company_name}`); continue; }
    const dias = Math.ceil((new Date(acc.trial_ends_at).getTime() - now.getTime()) / 86_400_000);
    const msg  = fill(tpl["trial_vence"] ?? "Tu trial vence en {dias} días, {nombre}.", { nombre: nombre(acc), dias: String(dias) });
    await sb.from("platform_accounts").update({ wa_trial_vence_sent_at: now.toISOString() }).eq("id", acc.id);
    void sendWa(PLAT_SESSION, phone, msg);
    trialVence++;
    log.push(`✓ Trial vence → ${acc.company_name} (${dias}d)`);
  }

  // ── 2. Trial vencido HOY sin convertir (ventana 0-36h del vencimiento) ──
  const expiredFrom = new Date(now.getTime() - 36 * 60 * 60 * 1000).toISOString();

  const { data: trialsExpirados } = tplEnabled["trial_expirado"] === false ? { data: [] } : await sb
    .from("platform_accounts")
    .select("id, company_name, owner_name, phone, trial_ends_at")
    .in("status", ["trial_active", "trial_risk"])   // el trial-check cron cambia status, puede llegar antes o después
    .lt("trial_ends_at", now.toISOString().slice(0, 10))
    .gte("trial_ends_at", expiredFrom.slice(0, 10))
    .is("wa_trial_expirado_sent_at", null)
    .not("phone", "is", null);

  if (tplEnabled["trial_expirado"] === false) log.push("— Trial expirado: desactivado");
  for (const acc of trialsExpirados ?? []) {
    const phone = normalizePhone(acc.phone);
    if (!phone) { log.push(`Trial expirado — sin tel: ${acc.company_name}`); continue; }
    const msg = fill(tpl["trial_expirado"] ?? "Hola {nombre}, tu prueba venció hoy. Tus datos siguen guardados.", { nombre: nombre(acc) });
    await sb.from("platform_accounts").update({ wa_trial_expirado_sent_at: now.toISOString() }).eq("id", acc.id);
    void sendWa(PLAT_SESSION, phone, msg);
    trialExpirado++;
    log.push(`✓ Trial expirado → ${acc.company_name}`);
  }

  // ── 3. Sin actividad ≥7 días (máx 1 vez cada 30 días) ──────────────────
  const inactivoCutoff   = new Date(now.getTime() - 7  * 86_400_000).toISOString();
  const reinactivoCutoff = new Date(now.getTime() - 30 * 86_400_000).toISOString();

  const { data: inactivos } = tplEnabled["inactivo_7d"] === false ? { data: [] } : await sb
    .from("platform_accounts")
    .select("id, company_name, owner_name, phone")
    .in("status", ["trial_active", "trial_risk", "converted"])
    .lt("last_seen_at", inactivoCutoff)
    .not("phone", "is", null)
    .or(`wa_inactivo_notif_sent_at.is.null,wa_inactivo_notif_sent_at.lt.${reinactivoCutoff}`);

  if (tplEnabled["inactivo_7d"] === false) log.push("— Inactivo 7d: desactivado");
  for (const acc of inactivos ?? []) {
    const phone = normalizePhone(acc.phone);
    if (!phone) { log.push(`Inactivo — sin tel: ${acc.company_name}`); continue; }
    const msg = fill(tpl["inactivo_7d"] ?? "Ey {nombre}! ¿Cómo va el gym?", { nombre: nombre(acc) });
    await sb.from("platform_accounts").update({ wa_inactivo_notif_sent_at: now.toISOString() }).eq("id", acc.id);
    void sendWa(PLAT_SESSION, phone, msg);
    inactivosSent++;
    log.push(`✓ Inactivo 7d → ${acc.company_name}`);
  }

  // ── 4. Día 3 sin cargar alumnos ──────────────────────────────────────────
  // Gyms registrados hace 3-5 días, notif no enviada, con 0 alumnos cargados
  const d3From = new Date(now.getTime() - 5 * 86_400_000).toISOString();
  const d3To   = new Date(now.getTime() - 3 * 86_400_000).toISOString();

  const { data: d3Candidates } = tplEnabled["activacion_d3"] === false ? { data: [] } : await sb
    .from("platform_accounts")
    .select("id, company_name, owner_name, phone, auth_user_id")
    .in("status", ["trial_active", "trial_risk", "trial_setup"])
    .gte("created_at", d3From)
    .lte("created_at", d3To)
    .is("wa_activacion_d3_sent_at", null)
    .not("phone", "is", null);

  if (tplEnabled["activacion_d3"] === false) log.push("— Día 3 sin alumnos: desactivado");
  for (const acc of d3Candidates ?? []) {
    if (!acc.auth_user_id) continue;

    // Obtener gym_id del perfil del dueño
    const { data: profile } = await sb
      .from("profiles")
      .select("gym_id")
      .eq("id", acc.auth_user_id)
      .maybeSingle();

    if (!profile?.gym_id) continue;

    // Contar alumnos cargados
    const { count: alumnosCount } = await sb
      .from("alumnos")
      .select("id", { count: "exact", head: true })
      .eq("gym_id", profile.gym_id)
      .eq("is_demo", false)
      .is("deleted_at", null);

    if ((alumnosCount ?? 0) > 0) {
      // Ya cargaron alumnos — marcar como enviado para no volver a evaluar
      await sb.from("platform_accounts").update({ wa_activacion_d3_sent_at: now.toISOString() }).eq("id", acc.id);
      log.push(`— Día 3 skip (ya cargó alumnos): ${acc.company_name}`);
      continue;
    }

    const phone = normalizePhone(acc.phone);
    if (!phone) continue;

    const msg = fill(tpl["activacion_d3"] ?? "Ey {nombre}! ¿Pudiste cargar tus alumnos?", { nombre: nombre(acc) });
    await sb.from("platform_accounts").update({ wa_activacion_d3_sent_at: now.toISOString() }).eq("id", acc.id);
    void sendWa(PLAT_SESSION, phone, msg);
    activacionD3++;
    log.push(`✓ Día 3 sin alumnos → ${acc.company_name}`);
  }

  // ── 5. Primer pago registrado en el gym ──────────────────────────────────
  const since48h = new Date(now.getTime() - 48 * 60 * 60 * 1000).toISOString();

  const { data: primerPagoCandidates } = tplEnabled["primer_pago"] === false ? { data: [] } : await sb
    .from("platform_accounts")
    .select("id, company_name, owner_name, phone, auth_user_id")
    .in("status", ["trial_active", "trial_risk", "converted"])
    .is("wa_primer_pago_sent_at", null)
    .not("phone", "is", null);

  if (tplEnabled["primer_pago"] === false) log.push("— Primer pago: desactivado");
  for (const acc of primerPagoCandidates ?? []) {
    if (!acc.auth_user_id) continue;

    const { data: profile } = await sb
      .from("profiles")
      .select("gym_id")
      .eq("id", acc.auth_user_id)
      .maybeSingle();

    if (!profile?.gym_id) continue;

    // Verificar si el primer pago validado fue en las últimas 48h
    const { count: totalPagos } = await sb
      .from("pagos")
      .select("id", { count: "exact", head: true })
      .eq("gym_id", profile.gym_id)
      .eq("status", "validado");

    if ((totalPagos ?? 0) !== 1) {
      // 0 pagos → todavía no, >1 → ya pasó el momento
      if ((totalPagos ?? 0) > 1) {
        // Marcar para no evaluar más
        await sb.from("platform_accounts").update({ wa_primer_pago_sent_at: now.toISOString() }).eq("id", acc.id);
      }
      continue;
    }

    // Confirmar que ese único pago fue reciente
    const { data: primerPago } = await sb
      .from("pagos")
      .select("created_at")
      .eq("gym_id", profile.gym_id)
      .eq("status", "validado")
      .gte("created_at", since48h)
      .maybeSingle();

    if (!primerPago) continue;

    const phone = normalizePhone(acc.phone);
    if (!phone) continue;

    const msg = fill(tpl["primer_pago"] ?? "🎉 {nombre}, tu gym recibió su primer pago en FitGrowX.", { nombre: nombre(acc) });
    await sb.from("platform_accounts").update({ wa_primer_pago_sent_at: now.toISOString() }).eq("id", acc.id);
    void sendWa(PLAT_SESSION, phone, msg);
    primerPagoSent++;
    log.push(`✓ Primer pago → ${acc.company_name}`);
  }

  // ── 6. Resumen diario al owner ──────────────────────────────────────────
  const ownerPhone = normalizePhone((process.env.OWNER_PHONE ?? process.env.ALERT_PHONE));
  if (ownerPhone) {
    const h1ago   = new Date(now.getTime() - 60 * 60 * 1000).toISOString();
    const d1ago   = new Date(now.getTime() - 24 * 60 * 60 * 1000).toISOString();
    const d7ago   = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000).toISOString();
    const monthStr = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-01`;

    const [
      { count: erroresH1 },
      { count: waDesconectados },
      { count: trialsRiskCount },
      { count: inactivosCount },
      { count: prospectosSinSeg },
      { count: webhookErrors },
      mrrResult,
    ] = await Promise.all([
      sb.from("platform_logs").select("id", { count: "exact", head: true }).eq("level", "ERROR").gte("created_at", h1ago),
      sb.from("gym_settings").select("gym_id", { count: "exact", head: true }).not("wa_status", "in", '("active","qr")'),
      sb.from("platform_accounts").select("id", { count: "exact", head: true }).in("status", ["trial_active", "trial_risk"]).lte("trial_ends_at", new Date(now.getTime() + 3 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10)).gte("trial_ends_at", todayStr),
      sb.from("platform_accounts").select("id", { count: "exact", head: true }).in("status", ["trial_active", "trial_risk", "converted"]).not("last_seen_at", "is", null).lt("last_seen_at", d7ago),
      sb.from("prospectos").select("id", { count: "exact", head: true }).not("next_follow_up_at", "is", null).lt("next_follow_up_at", new Date(now.getTime() - 48 * 60 * 60 * 1000).toISOString().slice(0, 10)).neq("status", "convertido"),
      sb.from("mp_webhook_log").select("id", { count: "exact", head: true }).eq("status", "error").gte("received_at", d1ago),
      sb.from("pagos").select("amount").eq("status", "validado").gte("date", monthStr).lte("date", todayStr),
    ]);

    const mrr = (mrrResult.data ?? []).reduce((s, r) => s + (r.amount ?? 0), 0);
    const fmtArs = (n: number) => n >= 1_000_000 ? `$${(n/1_000_000).toFixed(1)}M` : n >= 1_000 ? `$${(n/1_000).toFixed(0)}k` : `$${n}`;

    const alertLines: string[] = [];
    if ((erroresH1 ?? 0) > 0)         alertLines.push(`❌ ${erroresH1} errores sistema (última hora)`);
    if ((webhookErrors ?? 0) > 0)      alertLines.push(`🔴 ${webhookErrors} webhook${webhookErrors !== 1 ? "s" : ""} de pago con error (24h)`);
    if ((waDesconectados ?? 0) > 0)    alertLines.push(`📵 ${waDesconectados} sesión${waDesconectados !== 1 ? "es" : ""} WA desconectada${waDesconectados !== 1 ? "s" : ""}`);
    if ((trialsRiskCount ?? 0) > 0)    alertLines.push(`⏰ ${trialsRiskCount} trial${trialsRiskCount !== 1 ? "s" : ""} vence${trialsRiskCount === 1 ? "" : "n"} en ≤3 días`);
    if ((inactivosCount ?? 0) > 0)     alertLines.push(`😴 ${inactivosCount} gym${inactivosCount !== 1 ? "s" : ""} inactivo${inactivosCount !== 1 ? "s" : ""} 7d+`);
    if ((prospectosSinSeg ?? 0) > 0)   alertLines.push(`📋 ${prospectosSinSeg} prospecto${prospectosSinSeg !== 1 ? "s" : ""} sin seguimiento`);

    const msg = [
      `📊 *FitGrowX — Resumen ${new Date().toLocaleDateString("es-AR", { weekday: "long", day: "numeric", month: "long" })}*`,
      ``,
      `💰 MRR del mes: *${fmtArs(mrr)}*`,
      ``,
      alertLines.length > 0
        ? `⚠️ *Requiere atención:*\n${alertLines.join("\n")}`
        : `✅ Todo en orden, sin alertas críticas.`,
      ``,
      `Ver plataforma: ${process.env.NEXT_PUBLIC_APP_URL ?? "https://fitgrowx.com"}/platform/pulso`,
    ].join("\n");

    if (await sendWa(PLAT_SESSION,ownerPhone, msg)) {
      log.push(`✓ Resumen diario → owner`);
    } else {
      log.push(`✗ Resumen diario → owner (WA falló)`);
    }
  } else {
    log.push(`— Resumen diario: OWNER_PHONE no configurado`);
  }

  log.push(`Completado: ${todayStr}`);
  const totalNotifs = trialVence + trialExpirado + inactivosSent + activacionD3 + primerPagoSent;
  void sb.from("cron_runs").insert({ cron_name: "platform-notifs", status: "ok", duration_ms: Date.now() - startedAt, summary: `${todayStr} · ${totalNotifs} notifs enviadas`, counts: { trialVence, trialExpirado, inactivos: inactivosSent, activacionD3, primerPago: primerPagoSent, log } });
  return NextResponse.json({ ok: true, log });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    void sb.from("cron_runs").insert({ cron_name: "platform-notifs", status: "error", duration_ms: Date.now() - startedAt, summary: msg });
    console.error("[platform-notifs] error fatal:", msg);
    return NextResponse.json({ ok: false, error: msg }, { status: 500 });
  }
}
