"use client";

import { useCallback, useEffect, useState } from "react";
import { ChevronDown, ChevronLeft, ChevronRight, ChevronUp, ClipboardList, RefreshCw } from "lucide-react";

const fd = "'Inter', sans-serif";

type AuditLog = {
  id: string;
  actor_id: string;
  action: string;
  resource_type: string;
  resource_id: string | null;
  before_state: Record<string, unknown> | null;
  after_state: Record<string, unknown> | null;
  meta: Record<string, unknown> | null;
  created_at: string;
};

type GymOption = { id: string; name: string };

const ACTION_STYLE: Record<string, { color: string; bg: string }> = {
  delete_lead:            { color: "#ef4444", bg: "rgba(239,68,68,0.09)" },
  delete_account:         { color: "#dc2626", bg: "rgba(220,38,38,0.1)" },
  update_lead_status:     { color: "#6366f1", bg: "rgba(99,102,241,0.09)" },
  mark_contacted:         { color: "#8b5cf6", bg: "rgba(139,92,246,0.09)" },
  send_manual_wa:         { color: "#0ea5e9", bg: "rgba(14,165,233,0.09)" },
  reprocess_payment:      { color: "#f59e0b", bg: "rgba(245,158,11,0.09)" },
  mark_webhook_resolved:  { color: "#10b981", bg: "rgba(16,185,129,0.09)" },
  resolve_feedback:       { color: "#10b981", bg: "rgba(16,185,129,0.09)" },
  unresolve_feedback:     { color: "#6b7280", bg: "rgba(107,114,128,0.09)" },
  extend_trial:           { color: "#6366f1", bg: "rgba(99,102,241,0.09)" },
  impersonate_start:      { color: "#dc2626", bg: "rgba(220,38,38,0.1)" },
  impersonate_stop:       { color: "#10b981", bg: "rgba(16,185,129,0.09)" },
  cron_trigger:           { color: "#9ca3af", bg: "rgba(156,163,175,0.09)" },
};

function fmt(ts: string) {
  return new Date(ts).toLocaleString("es-AR", {
    day: "2-digit", month: "2-digit", year: "2-digit",
    hour: "2-digit", minute: "2-digit", second: "2-digit",
  });
}

function shortId(id: string | null | undefined) {
  if (!id) return "—";
  if (id.length <= 16) return id;
  return `${id.slice(0, 8)}…${id.slice(-4)}`;
}

const inputStyle: React.CSSProperties = {
  padding: "7px 12px", borderRadius: 8,
  border: "1px solid rgba(0,0,0,0.12)",
  font: `400 0.78rem/1 ${fd}`, color: "#374151",
  background: "#fff",
};

const labelStyle: React.CSSProperties = {
  font: `500 0.65rem/1 ${fd}`, color: "#9ca3af",
  textTransform: "uppercase", letterSpacing: "0.06em",
  marginBottom: 4, display: "block",
};

export default function AuditoriaPage() {
  const [logs,    setLogs]    = useState<AuditLog[]>([]);
  const [total,   setTotal]   = useState(0);
  const [page,    setPage]    = useState(1);
  const [pages,   setPages]   = useState(1);
  const [actions, setActions] = useState<string[]>([]);
  const [gyms,    setGyms]    = useState<GymOption[]>([]);
  const [loading, setLoading] = useState(true);
  const [expanded, setExpanded] = useState<string | null>(null);

  // Filters
  const [filterGym,    setFilterGym]    = useState("");
  const [filterAction, setFilterAction] = useState("");
  const [filterFrom,   setFilterFrom]   = useState("");
  const [filterTo,     setFilterTo]     = useState("");

  // Populate gym dropdown from /api/platform/gyms
  useEffect(() => {
    fetch("/api/platform/gyms")
      .then(r => r.json())
      .then((d: { gyms?: { gym_id: string; gym_name: string | null }[] }) => {
        const rows = (d.gyms ?? [])
          .filter(g => g.gym_id)
          .map(g => ({ id: g.gym_id, name: g.gym_name ?? g.gym_id }));
        setGyms(rows);
      })
      .catch(() => {});
  }, []);

  const fetchLogs = useCallback(async (p: number, filters: {
    gym: string; action: string; from: string; to: string;
  }) => {
    setLoading(true);
    try {
      const params = new URLSearchParams({ page: String(p) });
      if (filters.gym)    params.set("gym_id", filters.gym);
      if (filters.action) params.set("action", filters.action);
      if (filters.from)   params.set("from",   new Date(filters.from).toISOString());
      if (filters.to) {
        const d = new Date(filters.to);
        d.setDate(d.getDate() + 1);
        params.set("to", d.toISOString());
      }

      const res  = await fetch(`/api/platform/audit-logs?${params}`);
      const data = await res.json() as {
        ok: boolean;
        logs: AuditLog[];
        total: number;
        page: number;
        pages: number;
        actions: string[];
      };

      if (data.ok) {
        setLogs(data.logs);
        setTotal(data.total);
        setPage(data.page);
        setPages(data.pages);
        if (data.actions.length) setActions(data.actions);
      }
    } finally {
      setLoading(false);
    }
  }, []);

  // Initial load
  useEffect(() => {
    void fetchLogs(1, { gym: "", action: "", from: "", to: "" });
  }, [fetchLogs]);

  function applyFilters(p = 1) {
    void fetchLogs(p, {
      gym:    filterGym,
      action: filterAction,
      from:   filterFrom,
      to:     filterTo,
    });
  }

  function clearFilters() {
    setFilterGym("");
    setFilterAction("");
    setFilterFrom("");
    setFilterTo("");
    void fetchLogs(1, { gym: "", action: "", from: "", to: "" });
  }

  const hasFilters = !!(filterGym || filterAction || filterFrom || filterTo);

  return (
    <div style={{ maxWidth: 1140, margin: "0 auto", padding: "16px 24px 48px" }}>
      {/* Title row */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 20, flexWrap: "wrap", gap: 12 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <ClipboardList size={16} color="#6366f1" />
          <h1 style={{ font: `700 1rem/1 ${fd}`, color: "#111827", letterSpacing: "-0.02em" }}>
            Auditoría de acciones
          </h1>
          {total > 0 && (
            <span style={{ padding: "2px 9px", borderRadius: 9999, background: "rgba(99,102,241,0.08)", font: `600 0.68rem/1 ${fd}`, color: "#6366f1" }}>
              {total.toLocaleString("es-AR")} registros
            </span>
          )}
        </div>
        <button
          onClick={() => applyFilters(page)}
          disabled={loading}
          style={{ display: "flex", alignItems: "center", gap: 6, padding: "7px 13px", borderRadius: 8, background: "rgba(0,0,0,0.05)", border: "none", font: `600 0.75rem/1 ${fd}`, color: "#374151", cursor: "pointer", opacity: loading ? 0.5 : 1 }}
        >
          <RefreshCw size={12} style={{ animation: loading ? "spin 1s linear infinite" : "none" }} />
          Refresh
        </button>
      </div>

      {/* Filters bar */}
      <div style={{ display: "flex", gap: 10, flexWrap: "wrap", marginBottom: 18, alignItems: "flex-end" }}>
        <div>
          <label style={labelStyle}>Gym</label>
          <select
            value={filterGym}
            onChange={e => { setFilterGym(e.target.value); void fetchLogs(1, { gym: e.target.value, action: filterAction, from: filterFrom, to: filterTo }); }}
            style={{ ...inputStyle, minWidth: 190 }}
          >
            <option value="">Todos los gyms</option>
            {gyms.map(g => <option key={g.id} value={g.id}>{g.name}</option>)}
          </select>
        </div>
        <div>
          <label style={labelStyle}>Acción</label>
          <select
            value={filterAction}
            onChange={e => { setFilterAction(e.target.value); void fetchLogs(1, { gym: filterGym, action: e.target.value, from: filterFrom, to: filterTo }); }}
            style={{ ...inputStyle, minWidth: 210 }}
          >
            <option value="">Todas las acciones</option>
            {actions.map(a => <option key={a} value={a}>{a}</option>)}
          </select>
        </div>
        <div>
          <label style={labelStyle}>Desde</label>
          <input
            type="date"
            value={filterFrom}
            onChange={e => { setFilterFrom(e.target.value); void fetchLogs(1, { gym: filterGym, action: filterAction, from: e.target.value, to: filterTo }); }}
            style={inputStyle}
          />
        </div>
        <div>
          <label style={labelStyle}>Hasta</label>
          <input
            type="date"
            value={filterTo}
            onChange={e => { setFilterTo(e.target.value); void fetchLogs(1, { gym: filterGym, action: filterAction, from: filterFrom, to: e.target.value }); }}
            style={inputStyle}
          />
        </div>
        {hasFilters && (
          <button
            onClick={clearFilters}
            style={{ padding: "7px 12px", borderRadius: 8, border: "1px solid rgba(0,0,0,0.10)", background: "transparent", font: `500 0.75rem/1 ${fd}`, color: "#6b7280", cursor: "pointer" }}
          >
            Limpiar filtros
          </button>
        )}
      </div>

      {/* Table */}
      <div style={{ background: "#fff", borderRadius: 16, border: "1px solid rgba(0,0,0,0.07)", overflow: "hidden" }}>
        {/* Header */}
        <div style={{ display: "grid", gridTemplateColumns: "152px 190px 130px 120px 1fr 36px", padding: "10px 16px", background: "#f9fafb", borderBottom: "1px solid rgba(0,0,0,0.06)", gap: 0 }}>
          {["Fecha", "Acción", "Tipo recurso", "Recurso ID", "Actor / Gym", ""].map(h => (
            <span key={h} style={{ font: `600 0.65rem/1 ${fd}`, color: "#9ca3af", textTransform: "uppercase", letterSpacing: "0.06em" }}>{h}</span>
          ))}
        </div>

        {loading ? (
          <div style={{ padding: "40px 0", textAlign: "center", font: `400 0.82rem/1 ${fd}`, color: "#9ca3af" }}>Cargando...</div>
        ) : logs.length === 0 ? (
          <div style={{ padding: "40px 0", textAlign: "center", font: `400 0.82rem/1 ${fd}`, color: "#9ca3af" }}>No hay registros para estos filtros.</div>
        ) : (
          logs.map(log => {
            const ac       = ACTION_STYLE[log.action] ?? { color: "#6b7280", bg: "rgba(107,114,128,0.09)" };
            const isExp    = expanded === log.id;
            const hasDetail = log.before_state != null || log.after_state != null || log.meta != null;
            const gymId    = (log.after_state?.gym_id ?? log.before_state?.gym_id) as string | undefined;
            const gym      = gymId ? gyms.find(g => g.id === gymId) : null;

            return (
              <div key={log.id} style={{ borderBottom: "1px solid rgba(0,0,0,0.04)" }}>
                {/* Main row */}
                <div style={{
                  display: "grid", gridTemplateColumns: "152px 190px 130px 120px 1fr 36px",
                  padding: "11px 16px", alignItems: "center",
                  background: isExp ? "rgba(99,102,241,0.02)" : "transparent",
                  gap: 0,
                }}>
                  <span style={{ font: `400 0.7rem/1.4 ${fd}`, color: "#6b7280" }}>{fmt(log.created_at)}</span>
                  <div>
                    <span style={{
                      display: "inline-block", padding: "3px 9px", borderRadius: 9999,
                      background: ac.bg, color: ac.color,
                      font: `600 0.67rem/1 ${fd}`,
                    }}>
                      {log.action}
                    </span>
                  </div>
                  <span style={{ font: `400 0.72rem/1 ${fd}`, color: "#374151" }}>{log.resource_type}</span>
                  <span
                    style={{ font: `400 0.7rem/1 'JetBrains Mono', monospace`, color: "#9ca3af", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}
                    title={log.resource_id ?? ""}
                  >
                    {shortId(log.resource_id)}
                  </span>
                  <div>
                    <p style={{ font: `500 0.7rem/1 ${fd}`, color: "#374151", marginBottom: gym ? 3 : 0 }}>
                      {shortId(log.actor_id)}
                    </p>
                    {gym && (
                      <p style={{ font: `400 0.65rem/1 ${fd}`, color: "#9ca3af" }}>{gym.name}</p>
                    )}
                    {!gym && gymId && (
                      <p style={{ font: `400 0.65rem/1 'JetBrains Mono', monospace`, color: "#d1d5db" }}>{shortId(gymId)}</p>
                    )}
                  </div>
                  {hasDetail ? (
                    <button
                      onClick={() => setExpanded(isExp ? null : log.id)}
                      style={{ background: "none", border: "none", cursor: "pointer", color: "#9ca3af", display: "flex", alignItems: "center", justifyContent: "center", padding: 4 }}
                    >
                      {isExp ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
                    </button>
                  ) : <span />}
                </div>

                {/* Expanded detail */}
                {isExp && (
                  <div style={{
                    padding: "14px 16px 16px",
                    background: "rgba(248,250,252,0.8)",
                    display: "grid",
                    gridTemplateColumns: log.before_state != null && log.after_state != null ? "1fr 1fr" : "1fr",
                    gap: 16,
                  }}>
                    {log.before_state != null && (
                      <div>
                        <p style={{ font: `600 0.63rem/1 ${fd}`, color: "#9ca3af", textTransform: "uppercase", letterSpacing: "0.07em", marginBottom: 8 }}>Before</p>
                        <pre style={{ font: `400 0.71rem/1.55 'JetBrains Mono', monospace`, color: "#374151", background: "#fff", borderRadius: 8, padding: "10px 12px", overflow: "auto", maxHeight: 220, margin: 0, border: "1px solid rgba(0,0,0,0.07)" }}>
                          {JSON.stringify(log.before_state, null, 2)}
                        </pre>
                      </div>
                    )}
                    {log.after_state != null && (
                      <div>
                        <p style={{ font: `600 0.63rem/1 ${fd}`, color: "#9ca3af", textTransform: "uppercase", letterSpacing: "0.07em", marginBottom: 8 }}>After</p>
                        <pre style={{ font: `400 0.71rem/1.55 'JetBrains Mono', monospace`, color: "#374151", background: "#fff", borderRadius: 8, padding: "10px 12px", overflow: "auto", maxHeight: 220, margin: 0, border: "1px solid rgba(0,0,0,0.07)" }}>
                          {JSON.stringify(log.after_state, null, 2)}
                        </pre>
                      </div>
                    )}
                    {log.meta != null && (
                      <div style={{ gridColumn: log.before_state != null || log.after_state != null ? "1 / -1" : undefined }}>
                        <p style={{ font: `600 0.63rem/1 ${fd}`, color: "#9ca3af", textTransform: "uppercase", letterSpacing: "0.07em", marginBottom: 8 }}>Meta</p>
                        <pre style={{ font: `400 0.71rem/1.55 'JetBrains Mono', monospace`, color: "#374151", background: "#fff", borderRadius: 8, padding: "10px 12px", overflow: "auto", maxHeight: 120, margin: 0, border: "1px solid rgba(0,0,0,0.07)" }}>
                          {JSON.stringify(log.meta, null, 2)}
                        </pre>
                      </div>
                    )}
                  </div>
                )}
              </div>
            );
          })
        )}
      </div>

      {/* Pagination */}
      {pages > 1 && (
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginTop: 16 }}>
          <span style={{ font: `400 0.75rem/1 ${fd}`, color: "#9ca3af" }}>
            Página {page} de {pages} · {total.toLocaleString("es-AR")} registros
          </span>
          <div style={{ display: "flex", gap: 8 }}>
            <button
              onClick={() => { const p = page - 1; applyFilters(p); }}
              disabled={page <= 1 || loading}
              style={{
                display: "flex", alignItems: "center", gap: 4, padding: "6px 12px",
                borderRadius: 8, border: "1px solid rgba(0,0,0,0.10)",
                background: page <= 1 ? "#f3f4f6" : "#fff",
                font: `600 0.75rem/1 ${fd}`,
                color: page <= 1 ? "#d1d5db" : "#374151",
                cursor: page <= 1 ? "default" : "pointer",
              }}
            >
              <ChevronLeft size={13} /> Anterior
            </button>
            <button
              onClick={() => { const p = page + 1; applyFilters(p); }}
              disabled={page >= pages || loading}
              style={{
                display: "flex", alignItems: "center", gap: 4, padding: "6px 12px",
                borderRadius: 8, border: "1px solid rgba(0,0,0,0.10)",
                background: page >= pages ? "#f3f4f6" : "#fff",
                font: `600 0.75rem/1 ${fd}`,
                color: page >= pages ? "#d1d5db" : "#374151",
                cursor: page >= pages ? "default" : "pointer",
              }}
            >
              Siguiente <ChevronRight size={13} />
            </button>
          </div>
        </div>
      )}

      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </div>
  );
}
