"use client";

import { useEffect, useState, useCallback } from "react";
import { AlertTriangle, CheckCircle2, Clock, RefreshCw, RotateCcw, XCircle } from "lucide-react";

const fd = "'Inter', sans-serif";

type WebhookLog = {
  id: string;
  source: string;
  gym_id: string | null;
  payment_id: string | null;
  event_type: string | null;
  status: string;
  error_msg: string | null;
  amount: number | null;
  alumno_id: string | null;
  received_at: string;
};

type Filter = "all" | "errors" | "pending";

const STATUS_STYLE: Record<string, { color: string; bg: string; label: string; icon: React.ReactNode }> = {
  processed: { color: "#10b981", bg: "rgba(16,185,129,0.08)", label: "Procesado",  icon: <CheckCircle2 size={12} /> },
  duplicate:  { color: "#6366f1", bg: "rgba(99,102,241,0.08)",  label: "Duplicado",  icon: <CheckCircle2 size={12} /> },
  received:   { color: "#f59e0b", bg: "rgba(245,158,11,0.08)",  label: "Pendiente",  icon: <Clock size={12} /> },
  error:      { color: "#ef4444", bg: "rgba(239,68,68,0.08)",   label: "Error",      icon: <XCircle size={12} /> },
  ignored:    { color: "#9ca3af", bg: "rgba(156,163,175,0.08)", label: "Ignorado",   icon: <AlertTriangle size={12} /> },
  resolved:   { color: "#10b981", bg: "rgba(16,185,129,0.08)", label: "Resuelto",   icon: <CheckCircle2 size={12} /> },
};

function fmt(ts: string) {
  return new Date(ts).toLocaleString("es-AR", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit", second: "2-digit" });
}
function fmtAmount(n: number | null) {
  if (n == null) return "—";
  return `$${Math.round(n).toLocaleString("es-AR")}`;
}
function shortId(id: string | null) {
  return id ? `…${id.slice(-8)}` : "—";
}

export default function PagosPage() {
  const [logs,    setLogs]    = useState<WebhookLog[]>([]);
  const [filter,  setFilter]  = useState<Filter>("all");
  const [loading, setLoading] = useState(true);
  const [acting,  setActing]  = useState<string | null>(null);
  const [toast,   setToast]   = useState<{ msg: string; ok: boolean } | null>(null);

  const showToast = (msg: string, ok: boolean) => {
    setToast({ msg, ok });
    setTimeout(() => setToast(null), 4000);
  };

  const fetchLogs = useCallback(async (f: Filter) => {
    setLoading(true);
    try {
      const res = await fetch(`/api/platform/webhook-log?filter=${f}`);
      const data = await res.json() as { ok: boolean; logs: WebhookLog[] };
      if (data.ok) setLogs(data.logs);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { void fetchLogs(filter); }, [filter, fetchLogs]);

  async function reprocess(log: WebhookLog) {
    if (!log.payment_id || !log.gym_id) return showToast("Falta payment_id o gym_id", false);
    setActing(log.id);
    try {
      const res = await fetch("/api/platform/reprocess-payment", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ payment_id: log.payment_id, gym_id: log.gym_id, log_id: log.id }),
      });
      const data = await res.json() as { ok: boolean; alumno?: string; nuevo_vencimiento?: string; pago?: string; error?: string };
      if (data.ok) {
        showToast(`✓ ${data.alumno} — renovado hasta ${data.nuevo_vencimiento}${data.pago === "ya_existia" ? " (pago ya existía)" : ""}`, true);
        void fetchLogs(filter);
      } else {
        showToast(`Error: ${data.error}`, false);
      }
    } catch {
      showToast("Error de red", false);
    } finally {
      setActing(null);
    }
  }

  async function markResolved(log: WebhookLog) {
    setActing(log.id);
    try {
      await fetch("/api/platform/webhook-log", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: log.id, status: "resolved" }),
      });
      void fetchLogs(filter);
    } finally {
      setActing(null);
    }
  }

  const errorCount   = logs.filter(l => l.status === "error").length;
  const pendingCount = logs.filter(l => l.status === "received").length;

  return (
    <div style={{ maxWidth: 1100, margin: "0 auto", padding: "28px 24px 60px" }}>

      {toast && (
        <div style={{
          position: "fixed", top: 66, right: 24, zIndex: 200,
          padding: "12px 18px", borderRadius: 12,
          background: toast.ok ? "#f0fdf4" : "#fef2f2",
          border: `1px solid ${toast.ok ? "rgba(16,185,129,0.3)" : "rgba(239,68,68,0.3)"}`,
          font: `500 0.82rem/1.4 ${fd}`,
          color: toast.ok ? "#065f46" : "#991b1b",
          boxShadow: "0 8px 24px rgba(0,0,0,0.10)",
          maxWidth: 360,
        }}>
          {toast.msg}
        </div>
      )}

      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 24, flexWrap: "wrap", gap: 12 }}>
        <div>
          <h1 style={{ font: `700 1.1rem/1 ${fd}`, color: "#111827", letterSpacing: "-0.03em", marginBottom: 4 }}>
            Webhooks de pago
          </h1>
          <p style={{ font: `400 0.76rem/1 ${fd}`, color: "#9ca3af" }}>
            Auditoría y re-procesamiento de eventos MercadoPago
          </p>
        </div>
        <button
          onClick={() => fetchLogs(filter)} disabled={loading}
          style={{ display: "flex", alignItems: "center", gap: 6, padding: "7px 13px", borderRadius: 8, background: "rgba(0,0,0,0.05)", border: "none", font: `600 0.75rem/1 ${fd}`, color: "#374151", cursor: "pointer", opacity: loading ? 0.5 : 1 }}
        >
          <RefreshCw size={12} style={{ animation: loading ? "spin 1s linear infinite" : "none" }} />
          Refresh
        </button>
      </div>

      {/* Tabs */}
      <div style={{ display: "flex", gap: 6, marginBottom: 18 }}>
        {([
          { key: "all",     label: "Todos",           count: null },
          { key: "errors",  label: "Errores",          count: errorCount,   color: "#ef4444" },
          { key: "pending", label: "Sin confirmar",    count: pendingCount, color: "#f59e0b" },
        ] as { key: Filter; label: string; count: number | null; color?: string }[]).map(t => (
          <button
            key={t.key}
            onClick={() => setFilter(t.key)}
            style={{
              display: "flex", alignItems: "center", gap: 6,
              padding: "6px 12px", borderRadius: 8, border: "none", cursor: "pointer",
              font: `600 0.75rem/1 ${fd}`,
              background: filter === t.key ? "#fff" : "transparent",
              color: filter === t.key ? "#111827" : "#6b7280",
              boxShadow: filter === t.key ? "0 1px 4px rgba(0,0,0,0.08)" : "none",
            }}
          >
            {t.label}
            {t.count != null && t.count > 0 && (
              <span style={{ padding: "2px 7px", borderRadius: 9999, background: t.color ? `${t.color}18` : "#f3f4f6", color: t.color ?? "#6b7280", font: `700 0.65rem/1 ${fd}` }}>
                {t.count}
              </span>
            )}
          </button>
        ))}
      </div>

      {/* Tabla */}
      <div style={{ background: "#fff", borderRadius: 16, border: "1px solid rgba(0,0,0,0.07)", overflow: "hidden" }}>
        {/* Header */}
        <div style={{ display: "grid", gridTemplateColumns: "150px 90px 110px 100px 90px 1fr 140px", gap: 0, padding: "10px 16px", background: "#f9fafb", borderBottom: "1px solid rgba(0,0,0,0.06)" }}>
          {["Recibido", "Fuente", "Payment ID", "Monto", "Estado", "Gym / Alumno", "Acciones"].map(h => (
            <span key={h} style={{ font: `600 0.68rem/1 ${fd}`, color: "#9ca3af", textTransform: "uppercase", letterSpacing: "0.06em" }}>{h}</span>
          ))}
        </div>

        {loading ? (
          <div style={{ padding: "40px 0", textAlign: "center", font: `400 0.82rem/1 ${fd}`, color: "#9ca3af" }}>
            Cargando...
          </div>
        ) : logs.length === 0 ? (
          <div style={{ padding: "40px 0", textAlign: "center", font: `400 0.82rem/1 ${fd}`, color: "#9ca3af" }}>
            No hay registros para este filtro.
          </div>
        ) : (
          logs.map((log, i) => {
            const s = STATUS_STYLE[log.status] ?? STATUS_STYLE.ignored;
            const isActing = acting === log.id;
            const canReprocess = (log.status === "error" || log.status === "received") && log.source === "gym" && !!log.payment_id && !!log.gym_id;
            const canResolve   = log.status === "error" || log.status === "received";
            return (
              <div
                key={log.id}
                style={{
                  display: "grid", gridTemplateColumns: "150px 90px 110px 100px 90px 1fr 140px",
                  gap: 0, padding: "11px 16px", alignItems: "center",
                  borderBottom: i < logs.length - 1 ? "1px solid rgba(0,0,0,0.04)" : "none",
                  background: log.status === "error" ? "rgba(239,68,68,0.02)" : "transparent",
                }}
              >
                <span style={{ font: `400 0.7rem/1.3 ${fd}`, color: "#6b7280" }}>{fmt(log.received_at)}</span>
                <span style={{ font: `600 0.7rem/1 ${fd}`, color: log.source === "gym" ? "#6366f1" : "#8b5cf6" }}>{log.source}</span>
                <span style={{ font: `400 0.7rem/1 'JetBrains Mono', monospace`, color: "#374151" }} title={log.payment_id ?? ""}>{shortId(log.payment_id)}</span>
                <span style={{ font: `600 0.74rem/1 ${fd}`, color: "#111827" }}>{fmtAmount(log.amount)}</span>
                <span style={{ display: "inline-flex", alignItems: "center", gap: 4, padding: "4px 8px", borderRadius: 9999, background: s.bg, color: s.color, font: `600 0.66rem/1 ${fd}` }}>
                  {s.icon}{s.label}
                </span>
                <div>
                  <p style={{ font: `500 0.7rem/1 ${fd}`, color: "#374151", marginBottom: 2 }}>{log.gym_id ? shortId(log.gym_id) : "—"}</p>
                  {log.error_msg && <p style={{ font: `400 0.65rem/1.3 ${fd}`, color: "#ef4444" }}>{log.error_msg}</p>}
                  {log.alumno_id && <p style={{ font: `400 0.65rem/1 ${fd}`, color: "#9ca3af" }}>alumno {shortId(log.alumno_id)}</p>}
                </div>
                <div style={{ display: "flex", gap: 6 }}>
                  {canReprocess && (
                    <button
                      onClick={() => reprocess(log)}
                      disabled={isActing}
                      title="Re-consultar MP y actualizar membresía"
                      style={{ display: "flex", alignItems: "center", gap: 4, padding: "5px 10px", borderRadius: 7, border: "1px solid rgba(99,102,241,0.3)", background: "rgba(99,102,241,0.05)", color: "#6366f1", font: `600 0.68rem/1 ${fd}`, cursor: "pointer", opacity: isActing ? 0.5 : 1, whiteSpace: "nowrap" }}
                    >
                      <RotateCcw size={11} />
                      Re-procesar
                    </button>
                  )}
                  {canResolve && (
                    <button
                      onClick={() => markResolved(log)}
                      disabled={isActing}
                      title="Marcar como resuelto manualmente"
                      style={{ display: "flex", alignItems: "center", gap: 4, padding: "5px 10px", borderRadius: 7, border: "1px solid rgba(0,0,0,0.10)", background: "transparent", color: "#6b7280", font: `600 0.68rem/1 ${fd}`, cursor: "pointer", opacity: isActing ? 0.5 : 1, whiteSpace: "nowrap" }}
                    >
                      ✓ Resolver
                    </button>
                  )}
                </div>
              </div>
            );
          })
        )}
      </div>

      <p style={{ font: `400 0.7rem/1.5 ${fd}`, color: "#9ca3af", marginTop: 14 }}>
        Mostrando últimos 100 eventos · <strong>Re-procesar</strong> vuelve a consultar MP y actualiza la membresía del alumno ·
        <strong> Resolver</strong> marca el evento como resuelto manualmente sin tocar datos
      </p>

      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </div>
  );
}
