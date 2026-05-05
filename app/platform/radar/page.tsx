"use client";

import { useEffect, useState, useCallback } from "react";
import { Activity, AlertTriangle, CheckCircle2, Clock, RefreshCw, XCircle, Zap } from "lucide-react";

type HealthCheck = {
  status: "ok" | "degraded";
  checks: Record<string, "ok" | "error">;
  latency_ms: number;
  ts: string;
};

type LogEntry = {
  id: string;
  level: "INFO" | "WARN" | "ERROR";
  route: string | null;
  message: string;
  duration_ms: number | null;
  created_at: string;
};

type RadarData = {
  errors_last_1h: number;
  errors_last_24h: number;
  total_last_24h: number;
  error_rate_24h_pct: number;
  alert_threshold_pct: number;
  top_error_routes: { route: string; count: number }[];
  logs: LogEntry[];
};

const LEVEL_COLORS: Record<string, string> = {
  INFO: "#6366f1",
  WARN: "#f59e0b",
  ERROR: "#ef4444",
};

const LEVEL_BG: Record<string, string> = {
  INFO: "rgba(99,102,241,0.08)",
  WARN: "rgba(245,158,11,0.08)",
  ERROR: "rgba(239,68,68,0.08)",
};

function fmt(ts: string) {
  return new Date(ts).toLocaleString("es-AR", {
    day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit", second: "2-digit",
  });
}

export default function RadarPage() {
  const [health, setHealth] = useState<HealthCheck | null>(null);
  const [radar, setRadar] = useState<RadarData | null>(null);
  const [levelFilter, setLevelFilter] = useState<"ALL" | "INFO" | "WARN" | "ERROR">("ALL");
  const [loading, setLoading] = useState(true);
  const [lastRefresh, setLastRefresh] = useState<Date | null>(null);

  const fetchHealth = useCallback(async () => {
    try {
      const res = await fetch("/api/health");
      const data = await res.json();
      setHealth(data);
    } catch {
      setHealth(null);
    }
  }, []);

  const fetchRadar = useCallback(async () => {
    try {
      const res = await fetch("/api/platform/radar");
      if (res.ok) {
        const data = await res.json();
        setRadar(data);
      }
    } catch {
      // silencioso
    }
  }, []);

  const refresh = useCallback(async () => {
    setLoading(true);
    await Promise.all([fetchHealth(), fetchRadar()]);
    setLastRefresh(new Date());
    setLoading(false);
  }, [fetchHealth, fetchRadar]);

  useEffect(() => {
    refresh();
    const id = setInterval(refresh, 30_000);
    return () => clearInterval(id);
  }, [refresh]);

  const filteredLogs = radar?.logs.filter(
    (l) => levelFilter === "ALL" || l.level === levelFilter,
  ) ?? [];

  const errorRateHigh = (radar?.error_rate_24h_pct ?? 0) > (radar?.alert_threshold_pct ?? 1);

  return (
    <div style={{ maxWidth: 1100, margin: "0 auto", padding: "28px 24px 60px" }}>

      {/* Header */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 28 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <Activity size={18} color="#6366f1" />
          <span style={{ font: "700 1.1rem/1 'Inter', sans-serif", color: "#111827", letterSpacing: "-0.03em" }}>
            Radar de Observabilidad
          </span>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          {lastRefresh && (
            <span style={{ font: "400 0.72rem/1 'Inter', sans-serif", color: "#9ca3af" }}>
              Actualizado {lastRefresh.toLocaleTimeString("es-AR")}
            </span>
          )}
          <button
            onClick={refresh}
            disabled={loading}
            style={{
              display: "flex", alignItems: "center", gap: 6,
              padding: "6px 12px", borderRadius: 8,
              background: "rgba(0,0,0,0.05)", border: "none",
              font: "600 0.75rem/1 'Inter', sans-serif", color: "#374151",
              cursor: loading ? "not-allowed" : "pointer", opacity: loading ? 0.5 : 1,
            }}
          >
            <RefreshCw size={12} style={{ animation: loading ? "spin 1s linear infinite" : "none" }} />
            Refresh
          </button>
        </div>
      </div>

      {/* Health Cards */}
      <section style={{ marginBottom: 24 }}>
        <p style={{ font: "600 0.7rem/1 'Inter', sans-serif", color: "#9ca3af", letterSpacing: "0.07em", textTransform: "uppercase", marginBottom: 12 }}>
          Estado de servicios
        </p>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(180px, 1fr))", gap: 10 }}>
          {health ? (
            Object.entries(health.checks).map(([svc, state]) => (
              <div key={svc} style={{
                background: "#fff", borderRadius: 12,
                border: `1px solid ${state === "ok" ? "rgba(16,185,129,0.2)" : "rgba(239,68,68,0.2)"}`,
                padding: "14px 16px",
                display: "flex", alignItems: "center", gap: 10,
              }}>
                {state === "ok"
                  ? <CheckCircle2 size={15} color="#10b981" />
                  : <XCircle size={15} color="#ef4444" />}
                <div>
                  <p style={{ font: "600 0.78rem/1 'Inter', sans-serif", color: "#111827", marginBottom: 2 }}>
                    {svc.replace(/_/g, " ")}
                  </p>
                  <p style={{ font: "400 0.68rem/1 'Inter', sans-serif", color: state === "ok" ? "#10b981" : "#ef4444" }}>
                    {state === "ok" ? "Operativo" : "Error"}
                  </p>
                </div>
              </div>
            ))
          ) : (
            <div style={{ background: "#fff", borderRadius: 12, border: "1px solid rgba(0,0,0,0.08)", padding: "14px 16px", color: "#9ca3af", font: "400 0.78rem/1 'Inter', sans-serif" }}>
              Cargando...
            </div>
          )}
          {health && (
            <div style={{
              background: "#fff", borderRadius: 12,
              border: "1px solid rgba(99,102,241,0.15)",
              padding: "14px 16px",
              display: "flex", alignItems: "center", gap: 10,
            }}>
              <Zap size={15} color="#6366f1" />
              <div>
                <p style={{ font: "600 0.78rem/1 'Inter', sans-serif", color: "#111827", marginBottom: 2 }}>
                  Latencia DB
                </p>
                <p style={{ font: "400 0.68rem/1 'Inter', sans-serif", color: "#6366f1" }}>
                  {health.latency_ms} ms
                </p>
              </div>
            </div>
          )}
        </div>
      </section>

      {/* Stats */}
      <section style={{ marginBottom: 24 }}>
        <p style={{ font: "600 0.7rem/1 'Inter', sans-serif", color: "#9ca3af", letterSpacing: "0.07em", textTransform: "uppercase", marginBottom: 12 }}>
          Métricas 24h
        </p>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(200px, 1fr))", gap: 10 }}>
          {[
            { label: "Errores última hora", value: radar?.errors_last_1h ?? "—", color: "#ef4444", icon: <AlertTriangle size={14} color="#ef4444" /> },
            { label: "Errores últimas 24h", value: radar?.errors_last_24h ?? "—", color: "#f59e0b", icon: <AlertTriangle size={14} color="#f59e0b" /> },
            { label: "Tasa de error 24h", value: radar ? `${radar.error_rate_24h_pct}%` : "—", color: errorRateHigh ? "#ef4444" : "#10b981", icon: <Activity size={14} color={errorRateHigh ? "#ef4444" : "#10b981"} /> },
            { label: "Total logs 24h", value: radar?.total_last_24h ?? "—", color: "#6366f1", icon: <Clock size={14} color="#6366f1" /> },
          ].map((s) => (
            <div key={s.label} style={{ background: "#fff", borderRadius: 12, border: "1px solid rgba(0,0,0,0.07)", padding: "16px 18px" }}>
              <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 8 }}>
                {s.icon}
                <p style={{ font: "500 0.72rem/1 'Inter', sans-serif", color: "#6b7280" }}>{s.label}</p>
              </div>
              <p style={{ font: "700 1.6rem/1 'Inter', sans-serif", color: s.color, letterSpacing: "-0.04em" }}>
                {s.value}
              </p>
              {s.label === "Tasa de error 24h" && errorRateHigh && (
                <p style={{ font: "500 0.65rem/1 'Inter', sans-serif", color: "#ef4444", marginTop: 4 }}>
                  ⚠ Supera el umbral del 1%
                </p>
              )}
            </div>
          ))}
        </div>
      </section>

      {/* Top Error Routes */}
      {radar && radar.top_error_routes.length > 0 && (
        <section style={{ marginBottom: 24 }}>
          <p style={{ font: "600 0.7rem/1 'Inter', sans-serif", color: "#9ca3af", letterSpacing: "0.07em", textTransform: "uppercase", marginBottom: 12 }}>
            Rutas con más errores (24h)
          </p>
          <div style={{ background: "#fff", borderRadius: 12, border: "1px solid rgba(0,0,0,0.07)", overflow: "hidden" }}>
            {radar.top_error_routes.map((r, i) => (
              <div key={r.route} style={{
                display: "flex", alignItems: "center", justifyContent: "space-between",
                padding: "11px 16px",
                borderBottom: i < radar.top_error_routes.length - 1 ? "1px solid rgba(0,0,0,0.05)" : "none",
              }}>
                <span style={{ font: "500 0.78rem/1 'Inter', sans-serif", color: "#374151", fontFamily: "monospace" }}>
                  {r.route}
                </span>
                <span style={{
                  padding: "2px 8px", borderRadius: 9999,
                  background: "rgba(239,68,68,0.08)",
                  font: "600 0.7rem/1 'Inter', sans-serif", color: "#ef4444",
                }}>
                  {r.count} errores
                </span>
              </div>
            ))}
          </div>
        </section>
      )}

      {/* Log Table */}
      <section>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 12 }}>
          <p style={{ font: "600 0.7rem/1 'Inter', sans-serif", color: "#9ca3af", letterSpacing: "0.07em", textTransform: "uppercase" }}>
            Logs recientes
          </p>
          <div style={{ display: "flex", gap: 6 }}>
            {(["ALL", "INFO", "WARN", "ERROR"] as const).map((lvl) => (
              <button
                key={lvl}
                onClick={() => setLevelFilter(lvl)}
                style={{
                  padding: "4px 10px", borderRadius: 9999, border: "none",
                  font: "600 0.68rem/1 'Inter', sans-serif",
                  cursor: "pointer",
                  background: levelFilter === lvl
                    ? (lvl === "ALL" ? "#111827" : LEVEL_BG[lvl])
                    : "rgba(0,0,0,0.05)",
                  color: levelFilter === lvl
                    ? (lvl === "ALL" ? "#fff" : LEVEL_COLORS[lvl])
                    : "#9ca3af",
                }}
              >
                {lvl}
              </button>
            ))}
          </div>
        </div>

        <div style={{ background: "#fff", borderRadius: 12, border: "1px solid rgba(0,0,0,0.07)", overflow: "hidden" }}>
          {filteredLogs.length === 0 ? (
            <div style={{ padding: "32px", textAlign: "center", color: "#9ca3af", font: "400 0.82rem/1 'Inter', sans-serif" }}>
              Sin logs registrados
            </div>
          ) : (
            filteredLogs.map((log, i) => (
              <div
                key={log.id}
                style={{
                  display: "grid",
                  gridTemplateColumns: "72px 1fr auto",
                  alignItems: "start",
                  gap: 12,
                  padding: "10px 16px",
                  borderBottom: i < filteredLogs.length - 1 ? "1px solid rgba(0,0,0,0.04)" : "none",
                  background: log.level === "ERROR" ? "rgba(239,68,68,0.02)" : "transparent",
                }}
              >
                <span style={{
                  display: "inline-flex", alignSelf: "center",
                  padding: "2px 7px", borderRadius: 6,
                  background: LEVEL_BG[log.level],
                  font: "700 0.62rem/1 'Inter', sans-serif",
                  color: LEVEL_COLORS[log.level],
                  letterSpacing: "0.04em",
                }}>
                  {log.level}
                </span>
                <div>
                  <p style={{ font: "500 0.78rem/1.4 'Inter', sans-serif", color: "#111827", marginBottom: log.route ? 2 : 0 }}>
                    {log.message}
                  </p>
                  {log.route && (
                    <p style={{ font: "400 0.68rem/1 'Inter', sans-serif", color: "#9ca3af", fontFamily: "monospace" }}>
                      {log.route}
                      {log.duration_ms != null ? ` · ${log.duration_ms}ms` : ""}
                    </p>
                  )}
                </div>
                <span style={{ font: "400 0.68rem/1 'Inter', sans-serif", color: "#d1d5db", whiteSpace: "nowrap" }}>
                  {fmt(log.created_at)}
                </span>
              </div>
            ))
          )}
        </div>
      </section>

      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </div>
  );
}
