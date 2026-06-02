"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import { Clock, Play, AlertTriangle, CheckCircle, XCircle, Loader2, RefreshCw } from "lucide-react";
import { useBrandAlert, useBrandConfirm } from "@/components/brand-confirm";

const fd = "'Inter', sans-serif";

type CronDef = {
  id: string;
  label: string;
  desc: string;
  needsGymId?: boolean;
  warning?: string;
};

const CRONS: CronDef[] = [
  {
    id: "vencimientos",
    label: "Recordatorio de vencimiento",
    desc: "Envía WA a alumnos cuya membresía vence según los días configurados por cada gym.",
  },
  {
    id: "ausentes",
    label: "Alumnos ausentes",
    desc: "Envía WA a alumnos que no asistieron en X días (según config del gym). Corre sobre todos los gyms.",
  },
  {
    id: "ausentes-trigger",
    label: "Ausentes — gym específico",
    desc: "Igual al anterior pero solo para el gym_id indicado. Útil para testear sin afectar a todos.",
    needsGymId: true,
  },
  {
    id: "trial-check",
    label: "Trial check",
    desc: "Marca gyms expirados, envía WA de warning a gyms que vencen pronto, desactiva suscripciones canceladas.",
    warning: "Puede cambiar el estado de gyms en la DB.",
  },
  {
    id: "monthly-report",
    label: "Reporte mensual",
    desc: "Envía el resumen mensual por email a cada gym. Usarlo fuera de fin de mes solo para tests.",
    warning: "Envía emails reales a todos los gyms activos.",
  },
  {
    id: "wa-keepalive",
    label: "WA Keepalive",
    desc: "Hace ping al motor de WhatsApp para mantener las sesiones activas.",
  },
  {
    id: "clase-gratis-followup",
    label: "Seguimiento clase gratis",
    desc: "Envía WA a prospectos en día 0, día 2 y día 5 después de su clase gratis. Solo gyms con clase_gratis_activo = true.",
  },
];

type LogEntry = {
  cron: string;
  ok: boolean;
  result: unknown;
  ts: string;
};

export default function DevPage() {
  const brandAlert = useBrandAlert();
  const brandConfirm = useBrandConfirm();
  const [gymId, setGymId] = useState("");
  const [running, setRunning] = useState<string | null>(null);
  const [logs, setLogs] = useState<LogEntry[]>([]);

  type AuditLog = { id: string; action: string; resource_id: string | null; meta: Record<string, unknown> | null; created_at: string };
  const [auditLogs, setAuditLogs] = useState<AuditLog[]>([]);
  const [auditLoading, setAuditLoading] = useState(false);

  async function fetchAuditLogs() {
    setAuditLoading(true);
    try {
      const { data } = await supabase
        .from("platform_audit_logs")
        .select("id, action, resource_id, meta, created_at")
        .eq("action", "cron_trigger")
        .order("created_at", { ascending: false })
        .limit(20);
      setAuditLogs((data ?? []) as AuditLog[]);
    } catch { /* */ }
    finally { setAuditLoading(false); }
  }

  useEffect(() => { void fetchAuditLogs(); }, []);

  async function trigger(cron: CronDef) {
    const ok = await brandConfirm({
      eyebrow: "Producción",
      title: `¿Ejecutar "${cron.label}"?`,
      message: "Esta acción corre en producción real. No se puede deshacer.",
      variant: "danger",
      confirmLabel: "Ejecutar",
    });
    if (!ok) return;
    setRunning(cron.id);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const token = session?.access_token;

      const body: Record<string, string> = { cron: cron.id };
      if (cron.needsGymId) {
        if (!gymId.trim()) { await brandAlert({ eyebrow: "Dato requerido", title: "Ingresá un gym_id primero.", variant: "default" }); return; }
        body.gym_id = gymId.trim();
      }

      const res = await fetch("/api/platform/trigger-cron", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify(body),
      });
      const data = await res.json();
      setLogs(prev => [{
        cron: cron.label,
        ok: res.ok && data.ok,
        result: data.result ?? data,
        ts: new Date().toLocaleTimeString("es-AR"),
      }, ...prev]);
      setTimeout(() => void fetchAuditLogs(), 1200);
    } catch (e) {
      setLogs(prev => [{ cron: cron.label, ok: false, result: String(e), ts: new Date().toLocaleTimeString("es-AR") }, ...prev]);
    } finally {
      setRunning(null);
    }
  }

  return (
    <div style={{ maxWidth: 780, margin: "0 auto", padding: "32px 20px", fontFamily: fd }}>
      {/* Banner — permanent, non-dismissible */}
      <div style={{ background: "rgba(220,38,38,0.10)", border: "2px solid rgba(220,38,38,0.40)", borderRadius: 12, padding: "12px 16px", display: "flex", gap: 10, alignItems: "flex-start", marginBottom: 28 }}>
        <AlertTriangle size={16} color="#DC2626" style={{ flexShrink: 0, marginTop: 1 }} />
        <p style={{ font: `700 0.8rem/1.45 ${fd}`, color: "#DC2626", margin: 0 }}>
          ⚠️ Esta página ejecuta acciones reales en producción. Usá con cuidado.
        </p>
      </div>

      <h1 style={{ font: `800 1.4rem/1 ${fd}`, color: "#111827", marginBottom: 4 }}>Dev — Automatizaciones</h1>
      <p style={{ font: `400 0.84rem/1.5 ${fd}`, color: "#6B7280", marginBottom: 28 }}>
        Disparadores manuales para probar cada cron. Los resultados aparecen abajo en tiempo real.
      </p>

      {/* gym_id input */}
      <div style={{ marginBottom: 24 }}>
        <label style={{ font: `600 0.78rem/1 ${fd}`, color: "#374151", display: "block", marginBottom: 6 }}>
          gym_id (para tests de gym específico)
        </label>
        <input
          value={gymId}
          onChange={e => setGymId(e.target.value)}
          placeholder="UUID del gym a testear"
          style={{ width: "100%", padding: "10px 12px", borderRadius: 10, border: "1px solid rgba(0,0,0,0.12)", font: `400 0.875rem/1 ${fd}`, color: "#111827", outline: "none", boxSizing: "border-box", fontFamily: "monospace" }}
        />
      </div>

      {/* Cron cards */}
      <div style={{ display: "grid", gap: 12, marginBottom: 32 }}>
        {CRONS.map(cron => (
          <div key={cron.id} style={{ background: "#FFFFFF", borderRadius: 14, border: "1px solid rgba(0,0,0,0.07)", padding: "16px 18px", display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 16, boxShadow: "0 1px 4px rgba(0,0,0,0.04)" }}>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 4 }}>
                <span style={{ font: `700 0.88rem/1 ${fd}`, color: "#111827" }}>{cron.label}</span>
                {cron.needsGymId && (
                  <span style={{ font: `600 0.65rem/1 ${fd}`, color: "#6366F1", background: "rgba(99,102,241,0.08)", border: "1px solid rgba(99,102,241,0.2)", padding: "2px 7px", borderRadius: 9999 }}>gym_id</span>
                )}
              </div>
              <p style={{ font: `400 0.78rem/1.45 ${fd}`, color: "#6B7280", margin: 0 }}>{cron.desc}</p>
              {cron.warning && (
                <p style={{ font: `600 0.72rem/1.4 ${fd}`, color: "#B45309", marginTop: 6, marginBottom: 0 }}>
                  ⚠ {cron.warning}
                </p>
              )}
            </div>
            <button
              onClick={() => trigger(cron)}
              disabled={running !== null}
              style={{ display: "inline-flex", alignItems: "center", gap: 6, padding: "9px 16px", borderRadius: 10, border: "none", background: running === cron.id ? "#D1D5DB" : "#111827", color: "#FFFFFF", font: `700 0.8rem/1 ${fd}`, cursor: running !== null ? "not-allowed" : "pointer", whiteSpace: "nowrap", flexShrink: 0, transition: "background .15s" }}
            >
              {running === cron.id ? <Loader2 size={13} style={{ animation: "spin 1s linear infinite" }} /> : <Play size={13} />}
              {running === cron.id ? "Corriendo..." : "Ejecutar"}
            </button>
          </div>
        ))}
      </div>

      {/* Log */}
      {logs.length > 0 && (
        <div>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 10 }}>
            <h2 style={{ font: `700 0.88rem/1 ${fd}`, color: "#111827" }}>Log de ejecuciones</h2>
            <button onClick={() => setLogs([])} style={{ font: `600 0.72rem/1 ${fd}`, color: "#9CA3AF", background: "none", border: "none", cursor: "pointer" }}>Limpiar</button>
          </div>
          <div style={{ display: "grid", gap: 8 }}>
            {logs.map((log, i) => (
              <div key={i} style={{ background: "#FFFFFF", borderRadius: 12, border: `1px solid ${log.ok ? "rgba(22,163,74,0.2)" : "rgba(220,38,38,0.2)"}`, padding: "12px 14px" }}>
                <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 8 }}>
                  {log.ok ? <CheckCircle size={14} color="#16A34A" /> : <XCircle size={14} color="#DC2626" />}
                  <span style={{ font: `700 0.8rem/1 ${fd}`, color: "#111827" }}>{log.cron}</span>
                  <span style={{ font: `400 0.72rem/1 ${fd}`, color: "#9CA3AF", marginLeft: "auto" }}>{log.ts}</span>
                </div>
                <pre style={{ font: `400 0.72rem/1.5 'Menlo','Monaco',monospace`, color: "#374151", margin: 0, whiteSpace: "pre-wrap", wordBreak: "break-all", background: "#F8FAFC", borderRadius: 8, padding: "8px 10px", maxHeight: 200, overflowY: "auto" }}>
                  {JSON.stringify(log.result, null, 2)}
                </pre>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Historial de ejecuciones */}
      <div style={{ marginTop: 40 }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 12 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <Clock size={14} color="#6b7280" />
            <h2 style={{ font: `700 0.88rem/1 ${fd}`, color: "#111827" }}>Historial de ejecuciones manuales</h2>
          </div>
          <button
            onClick={() => void fetchAuditLogs()}
            disabled={auditLoading}
            style={{ display: "flex", alignItems: "center", gap: 5, padding: "5px 10px", borderRadius: 8, background: "rgba(0,0,0,0.05)", border: "none", font: `600 0.72rem/1 ${fd}`, color: "#374151", cursor: auditLoading ? "not-allowed" : "pointer", opacity: auditLoading ? 0.5 : 1 }}
          >
            <RefreshCw size={11} style={{ animation: auditLoading ? "spin 1s linear infinite" : "none" }} />
            Actualizar
          </button>
        </div>
        {auditLogs.length === 0 ? (
          <p style={{ font: `400 0.78rem/1 ${fd}`, color: "#9ca3af" }}>Sin ejecuciones registradas aún.</p>
        ) : (
          <div style={{ background: "#fff", borderRadius: 12, border: "1px solid rgba(0,0,0,0.07)", overflow: "hidden" }}>
            {auditLogs.map((entry, i) => {
              const ok = (entry.meta as { ok?: boolean } | null)?.ok !== false;
              const httpStatus = (entry.meta as { http_status?: number } | null)?.http_status;
              return (
                <div key={entry.id} style={{
                  display: "grid", gridTemplateColumns: "120px 1fr auto",
                  alignItems: "center", gap: 12, padding: "10px 16px",
                  borderBottom: i < auditLogs.length - 1 ? "1px solid rgba(0,0,0,0.04)" : "none",
                  background: !ok ? "rgba(239,68,68,0.02)" : "transparent",
                }}>
                  <span style={{ font: `600 0.73rem/1 ${fd}`, color: "#374151", fontFamily: "monospace" }}>
                    {entry.resource_id ?? "—"}
                  </span>
                  <span style={{ font: `400 0.7rem/1 ${fd}`, color: "#6b7280" }}>
                    {httpStatus != null ? `HTTP ${httpStatus}` : "—"}
                  </span>
                  <span style={{ font: `400 0.68rem/1 ${fd}`, color: "#9ca3af", whiteSpace: "nowrap" }}>
                    {new Date(entry.created_at).toLocaleString("es-AR", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" })}
                  </span>
                </div>
              );
            })}
          </div>
        )}
      </div>

      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </div>
  );
}
