"use client";

import { useEffect, useState, useCallback } from "react";
import {
  Activity, AlertCircle, AlertTriangle, CheckCircle2,
  Clock, MessageSquareOff, RefreshCw, Smartphone,
  TrendingUp, Users, Wifi, WifiOff, Zap,
} from "lucide-react";

const fd = "'Inter', sans-serif";

type Trial = {
  id: string;
  company_name: string;
  owner_name: string | null;
  trial_ends_at: string | null;
  activation_score: number | null;
  status: string;
};

type WaMsgError = {
  id: string;
  message: string;
  meta: Record<string, unknown> | null;
  created_at: string;
};

type PagosPendientes = {
  id: string;
  amount: number;
  date: string;
  alumno_id: string | null;
};

type AlumnoVence = {
  id: string;
  full_name: string;
  gym_id: string;
};

type GymInactivo = {
  id: string;
  company_name: string;
  owner_name: string | null;
  phone: string | null;
  last_seen_at: string | null;
  status: string;
  activation_score: number | null;
};

type FraudeNombre = { id: string; full_name: string; gym_id: string; status: string };
type FraudeWaDup  = { phone: string; gym_ids: string[] };
type FraudeRatio  = { gym_id: string; asist_mes: number; alumnos_activos: number; ratio: number };

type PulsoData = {
  wa_disconnected_count: number;
  wa_no_session_count: number;
  wa_msg_errors_24h: number;
  wa_msg_error_details: WaMsgError[];
  pagos_pendientes_count: number;
  pagos_pendientes: PagosPendientes[];
  pagos_hoy_total: number;
  revenue_bruto_mes: number;
  alumnos_nuevos_hoy: number;
  alumnos_vencen_hoy: number;
  alumnos_vencen_sample: AlumnoVence[];
  trials_en_riesgo: Trial[];
  trials_vencidos_hoy: number;
  convertidos_este_mes: number;
  gyms_activos: number;
  prospectos_sin_seguimiento: number;
  gyms_inactivos_7d: GymInactivo[];
  errors_ultima_hora: number;
  fraude_nombres_sospechosos: FraudeNombre[];
  fraude_wa_duplicados: FraudeWaDup[];
  fraude_ratio_anomalos: FraudeRatio[];
  ts: string;
};

function daysUntil(dateStr: string | null) {
  if (!dateStr) return null;
  const diff = new Date(dateStr).getTime() - Date.now();
  return Math.ceil(diff / (1000 * 60 * 60 * 24));
}

function fmtMoney(n: number) {
  return new Intl.NumberFormat("es-AR", { style: "currency", currency: "ARS", maximumFractionDigits: 0 }).format(n);
}

function fmtTime(ts: string) {
  return new Date(ts).toLocaleString("es-AR", { hour: "2-digit", minute: "2-digit", second: "2-digit" });
}

type Severity = "ok" | "warn" | "critical";

function Card({
  label, value, sub, severity = "ok", icon: Icon, onClick, tooltip,
}: {
  label: string;
  value: string | number;
  sub?: string;
  severity?: Severity;
  icon: React.ElementType;
  onClick?: () => void;
  tooltip?: string;
}) {
  const colors: Record<Severity, { accent: string; bg: string; text: string }> = {
    ok:       { accent: "#10b981", bg: "rgba(16,185,129,0.07)",  text: "#065f46" },
    warn:     { accent: "#f59e0b", bg: "rgba(245,158,11,0.07)",  text: "#92400e" },
    critical: { accent: "#ef4444", bg: "rgba(239,68,68,0.08)",   text: "#991b1b" },
  };
  const c = colors[severity];
  return (
    <div
      onClick={onClick}
      title={tooltip}
      style={{
        background: "#fff",
        border: `1.5px solid ${severity !== "ok" ? c.accent : "#e5e7eb"}`,
        borderRadius: 14,
        padding: "18px 20px",
        display: "flex", flexDirection: "column", gap: 8,
        cursor: onClick ? "pointer" : "default",
        transition: "box-shadow 0.15s",
        boxShadow: severity !== "ok" ? `0 0 0 3px ${c.bg}` : "0 1px 4px rgba(0,0,0,0.06)",
      }}
    >
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
        <span style={{ font: `500 0.72rem/1 ${fd}`, color: "#9ca3af", letterSpacing: "0.04em", textTransform: "uppercase" }}>
          {label}
        </span>
        <Icon size={15} color={c.accent} />
      </div>
      <div style={{ font: `700 2rem/1 ${fd}`, color: severity !== "ok" ? c.text : "#111827" }}>
        {value}
      </div>
      {sub && (
        <div style={{ font: `400 0.75rem/1.3 ${fd}`, color: "#6b7280" }}>{sub}</div>
      )}
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
      <h2 style={{ font: `600 0.78rem/1 ${fd}`, color: "#6b7280", letterSpacing: "0.06em", textTransform: "uppercase", margin: 0 }}>
        {title}
      </h2>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(200px, 1fr))", gap: 12 }}>
        {children}
      </div>
    </div>
  );
}

function DetailPanel({ title, onClose, children }: { title: string; onClose: () => void; children: React.ReactNode }) {
  return (
    <div style={{
      position: "fixed", inset: 0, zIndex: 200,
      background: "rgba(0,0,0,0.35)", display: "flex", alignItems: "center", justifyContent: "center",
    }} onClick={onClose}>
      <div style={{
        background: "#fff", borderRadius: 16, padding: 24, maxWidth: 560, width: "90%",
        maxHeight: "80vh", overflowY: "auto",
        boxShadow: "0 20px 60px rgba(0,0,0,0.2)",
      }} onClick={e => e.stopPropagation()}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
          <h3 style={{ font: `700 1rem/1 ${fd}`, margin: 0 }}>{title}</h3>
          <button onClick={onClose} style={{ background: "none", border: "none", cursor: "pointer", color: "#9ca3af", font: `600 0.85rem/1 ${fd}` }}>✕</button>
        </div>
        {children}
      </div>
    </div>
  );
}

type Panel = "wa_errors" | "trials" | "pagos_pendientes" | "vencen_hoy" | "inactivos" | "fraude_wa" | "fraude_ratio" | "fraude_nombres" | null;

export default function PulsoPage() {
  const [data, setData] = useState<PulsoData | null>(null);
  const [loading, setLoading] = useState(true);
  const [panel, setPanel] = useState<Panel>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/platform/pulso");
      if (res.ok) setData(await res.json());
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  // Auto-refresh cada 60s
  useEffect(() => {
    const id = setInterval(load, 60_000);
    return () => clearInterval(id);
  }, [load]);

  if (loading && !data) {
    return (
      <div style={{ padding: 48, textAlign: "center", color: "#9ca3af", font: `400 0.9rem/1 ${fd}` }}>
        Cargando pulso…
      </div>
    );
  }

  if (!data) {
    return (
      <div style={{ padding: 48, textAlign: "center", color: "#ef4444", font: `400 0.9rem/1 ${fd}` }}>
        Error al cargar datos.
      </div>
    );
  }

  const waSev: Severity = data.wa_disconnected_count >= 3 ? "critical" : data.wa_disconnected_count >= 1 ? "warn" : "ok";
  const waMsgSev: Severity = data.wa_msg_errors_24h >= 5 ? "critical" : data.wa_msg_errors_24h >= 1 ? "warn" : "ok";
  const pagosSev: Severity = data.pagos_pendientes_count >= 5 ? "critical" : data.pagos_pendientes_count >= 1 ? "warn" : "ok";
  const trialsSev: Severity = data.trials_vencidos_hoy >= 1 ? "critical" : data.trials_en_riesgo.length >= 1 ? "warn" : "ok";
  const errorsSev: Severity = data.errors_ultima_hora >= 5 ? "critical" : data.errors_ultima_hora >= 1 ? "warn" : "ok";
  const prospectosSev: Severity = data.prospectos_sin_seguimiento >= 10 ? "critical" : data.prospectos_sin_seguimiento >= 3 ? "warn" : "ok";
  const inactivosSev: Severity = data.gyms_inactivos_7d.length >= 3 ? "critical" : data.gyms_inactivos_7d.length >= 1 ? "warn" : "ok";

  return (
    <div style={{ padding: "16px 32px 48px", maxWidth: 1100, margin: "0 auto", fontFamily: fd }}>
      {/* Header */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 16 }}>
        <div>
          <h1 style={{ font: `700 1rem/1 ${fd}`, margin: 0, color: "#111827" }}>Pulso <span style={{ font: `400 0.75rem/1 ${fd}`, color: "#9ca3af" }}>· última vez {data.ts ? fmtTime(data.ts) : "—"}</span></h1>
        </div>
        <button
          onClick={load}
          disabled={loading}
          style={{
            display: "flex", alignItems: "center", gap: 6,
            padding: "8px 14px", borderRadius: 8,
            background: "rgba(99,102,241,0.08)", border: "1px solid rgba(99,102,241,0.2)",
            font: `600 0.8rem/1 ${fd}`, color: "#6366f1",
            cursor: "pointer", opacity: loading ? 0.5 : 1,
          }}
        >
          <RefreshCw size={13} style={{ animation: loading ? "spin 1s linear infinite" : "none" }} />
          Actualizar
        </button>
      </div>

      <div style={{ display: "flex", flexDirection: "column", gap: 28 }}>
        {/* WhatsApp */}
        <Section title="WhatsApp">
          <Card
            label="Sesiones desconectadas"
            value={data.wa_disconnected_count}
            sub={data.wa_no_session_count > 0 ? `${data.wa_no_session_count} sin sesión configurada` : "Todas tienen sesión"}
            severity={waSev}
            icon={waSev === "ok" ? Wifi : WifiOff}
          />
          <Card
            label="Mensajes fallidos (24h)"
            value={data.wa_msg_errors_24h}
            sub="Errores en send-welcome"
            severity={waMsgSev}
            icon={MessageSquareOff}
            onClick={data.wa_msg_errors_24h > 0 ? () => setPanel("wa_errors") : undefined}
          />
        </Section>

        {/* Negocio */}
        <Section title="Negocio de hoy">
          <Card
            label="Pagos registrados hoy"
            value={fmtMoney(data.pagos_hoy_total)}
            sub={`Revenue bruto del mes: ${fmtMoney(data.revenue_bruto_mes)}`}
            severity="ok"
            icon={TrendingUp}
            tooltip="Suma de pagos de alumnos validados este mes en todos los gyms"
          />
          <Card
            label="Alumnos nuevos hoy"
            value={data.alumnos_nuevos_hoy}
            sub={`${data.gyms_activos} gyms activos en plataforma`}
            severity={data.alumnos_nuevos_hoy === 0 ? "warn" : "ok"}
            icon={Users}
          />
          <Card
            label="Pagos MP pendientes"
            value={data.pagos_pendientes_count}
            sub="Sin validar"
            severity={pagosSev}
            icon={Clock}
            onClick={data.pagos_pendientes_count > 0 ? () => setPanel("pagos_pendientes") : undefined}
          />
          <Card
            label="Alumnos vencen hoy"
            value={data.alumnos_vencen_hoy}
            sub="En toda la plataforma"
            severity={data.alumnos_vencen_hoy >= 10 ? "warn" : "ok"}
            icon={AlertCircle}
            onClick={data.alumnos_vencen_hoy > 0 ? () => setPanel("vencen_hoy") : undefined}
          />
        </Section>

        {/* Trials / cuentas */}
        <Section title="Cuentas y trials">
          <Card
            label="Trials en riesgo (≤3 días)"
            value={data.trials_en_riesgo.length}
            sub={data.trials_vencidos_hoy > 0 ? `⚠️ ${data.trials_vencidos_hoy} vencieron HOY sin convertir` : "Sin vencimientos hoy"}
            severity={trialsSev}
            icon={AlertTriangle}
            onClick={data.trials_en_riesgo.length > 0 ? () => setPanel("trials") : undefined}
          />
          <Card
            label="Convertidos este mes"
            value={data.convertidos_este_mes}
            severity="ok"
            icon={CheckCircle2}
          />
          <Card
            label="Prospectos sin seguimiento"
            value={data.prospectos_sin_seguimiento}
            sub="+48h sin contacto"
            severity={prospectosSev}
            icon={Smartphone}
          />
          <Card
            label="Sin actividad +7 días"
            value={data.gyms_inactivos_7d.length}
            sub={data.gyms_inactivos_7d.length > 0 ? "Contactar hoy — mensajes listos" : "Todos activos esta semana"}
            severity={inactivosSev}
            icon={Users}
            onClick={data.gyms_inactivos_7d.length > 0 ? () => setPanel("inactivos") : undefined}
          />
        </Section>

        {/* Integridad */}
        <Section title="Integridad">
          <Card
            label="WA duplicado"
            value={data.fraude_wa_duplicados.length}
            sub={data.fraude_wa_duplicados.length > 0 ? "Mismo tel en múltiples cuentas" : "Sin duplicados"}
            severity={data.fraude_wa_duplicados.length > 0 ? "warn" : "ok"}
            icon={Users}
            onClick={data.fraude_wa_duplicados.length > 0 ? () => setPanel("fraude_wa") : undefined}
          />
          <Card
            label="Ratio sospechoso"
            value={data.fraude_ratio_anomalos.length}
            sub={data.fraude_ratio_anomalos.length > 0 ? "<8 alumnos, +40 asistencias/mes" : "Sin anomalías"}
            severity={data.fraude_ratio_anomalos.length > 0 ? "warn" : "ok"}
            icon={AlertTriangle}
            onClick={data.fraude_ratio_anomalos.length > 0 ? () => setPanel("fraude_ratio") : undefined}
          />
          <Card
            label="Alumnos ficticios"
            value={data.fraude_nombres_sospechosos.length}
            sub={data.fraude_nombres_sospechosos.length > 0 ? "Nombres como 'Varios', 'General'…" : "Sin sospechosos"}
            severity={data.fraude_nombres_sospechosos.length > 0 ? "warn" : "ok"}
            icon={AlertCircle}
            onClick={data.fraude_nombres_sospechosos.length > 0 ? () => setPanel("fraude_nombres") : undefined}
          />
        </Section>

        {/* Sistema */}
        <Section title="Sistema">
          <Card
            label="Errores última hora"
            value={data.errors_ultima_hora}
            sub="Logs nivel ERROR"
            severity={errorsSev}
            icon={Activity}
          />
          <Card
            label="Estado general"
            value={data.errors_ultima_hora === 0 && data.wa_disconnected_count === 0 ? "Todo OK" : "Revisar"}
            severity={data.errors_ultima_hora >= 5 || data.wa_disconnected_count >= 3 ? "critical" : data.errors_ultima_hora > 0 || data.wa_disconnected_count > 0 ? "warn" : "ok"}
            icon={Zap}
          />
        </Section>
      </div>

      {/* Panels */}
      {panel === "wa_errors" && (
        <DetailPanel title={`Mensajes WA fallidos — últimas 24h (${data.wa_msg_error_details.length})`} onClose={() => setPanel(null)}>
          {data.wa_msg_error_details.length === 0 ? (
            <p style={{ color: "#9ca3af", font: `400 0.85rem/1 ${fd}` }}>Sin errores.</p>
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
              {data.wa_msg_error_details.map(e => (
                <div key={e.id} style={{ background: "rgba(239,68,68,0.05)", border: "1px solid rgba(239,68,68,0.15)", borderRadius: 10, padding: "10px 14px" }}>
                  <div style={{ font: `600 0.8rem/1.4 ${fd}`, color: "#991b1b", marginBottom: 4 }}>{e.message}</div>
                  {e.meta && (
                    <div style={{ font: `400 0.72rem/1.4 ${fd}`, color: "#6b7280", fontFamily: "monospace" }}>
                      {Object.entries(e.meta).map(([k, v]) => (
                        <span key={k} style={{ marginRight: 10 }}>{k}: {String(v)}</span>
                      ))}
                    </div>
                  )}
                  <div style={{ font: `400 0.7rem/1 ${fd}`, color: "#9ca3af", marginTop: 4 }}>{fmtTime(e.created_at)}</div>
                </div>
              ))}
            </div>
          )}
        </DetailPanel>
      )}

      {panel === "trials" && (
        <DetailPanel title="Trials en riesgo" onClose={() => setPanel(null)}>
          <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            {data.trials_en_riesgo.map(t => {
              const days = daysUntil(t.trial_ends_at);
              const urgent = (days ?? 99) <= 1;
              return (
                <div key={t.id} style={{
                  background: urgent ? "rgba(239,68,68,0.05)" : "rgba(245,158,11,0.05)",
                  border: `1px solid ${urgent ? "rgba(239,68,68,0.2)" : "rgba(245,158,11,0.2)"}`,
                  borderRadius: 10, padding: "10px 14px",
                  display: "flex", justifyContent: "space-between", alignItems: "center",
                }}>
                  <div>
                    <div style={{ font: `600 0.85rem/1 ${fd}`, color: "#111827" }}>{t.company_name}</div>
                    {t.owner_name && <div style={{ font: `400 0.75rem/1 ${fd}`, color: "#6b7280", marginTop: 3 }}>{t.owner_name}</div>}
                    <div style={{ font: `400 0.72rem/1 ${fd}`, color: "#9ca3af", marginTop: 3 }}>
                      Score: {t.activation_score ?? "—"} · {t.status}
                    </div>
                  </div>
                  <div style={{ font: `700 0.9rem/1 ${fd}`, color: urgent ? "#ef4444" : "#f59e0b" }}>
                    {days === 0 ? "hoy" : days === 1 ? "mañana" : `${days}d`}
                  </div>
                </div>
              );
            })}
          </div>
        </DetailPanel>
      )}

      {panel === "pagos_pendientes" && (
        <DetailPanel title={`Pagos MP pendientes (${data.pagos_pendientes_count})`} onClose={() => setPanel(null)}>
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            {data.pagos_pendientes.map(p => (
              <div key={p.id} style={{ display: "flex", justifyContent: "space-between", padding: "8px 0", borderBottom: "1px solid #f3f4f6" }}>
                <span style={{ font: `400 0.82rem/1 ${fd}`, color: "#374151" }}>{p.date}</span>
                <span style={{ font: `600 0.82rem/1 ${fd}`, color: "#111827" }}>{fmtMoney(p.amount)}</span>
              </div>
            ))}
            {data.pagos_pendientes_count > data.pagos_pendientes.length && (
              <p style={{ font: `400 0.75rem/1 ${fd}`, color: "#9ca3af", textAlign: "center" }}>
                + {data.pagos_pendientes_count - data.pagos_pendientes.length} más
              </p>
            )}
          </div>
        </DetailPanel>
      )}

      {panel === "vencen_hoy" && (
        <DetailPanel title={`Alumnos que vencen hoy (${data.alumnos_vencen_hoy})`} onClose={() => setPanel(null)}>
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            {data.alumnos_vencen_sample.map(a => (
              <div key={a.id} style={{ display: "flex", justifyContent: "space-between", padding: "8px 0", borderBottom: "1px solid #f3f4f6" }}>
                <span style={{ font: `500 0.82rem/1 ${fd}`, color: "#374151" }}>{a.full_name}</span>
                <span style={{ font: `400 0.72rem/1 ${fd}`, color: "#9ca3af" }}>gym: {a.gym_id.slice(0, 8)}…</span>
              </div>
            ))}
            {data.alumnos_vencen_hoy > data.alumnos_vencen_sample.length && (
              <p style={{ font: `400 0.75rem/1 ${fd}`, color: "#9ca3af", textAlign: "center" }}>
                + {data.alumnos_vencen_hoy - data.alumnos_vencen_sample.length} más
              </p>
            )}
          </div>
        </DetailPanel>
      )}

      {panel === "inactivos" && (
        <DetailPanel title={`Sin actividad +7 días (${data.gyms_inactivos_7d.length})`} onClose={() => setPanel(null)}>
          <p style={{ font: `400 0.78rem/1.5 ${fd}`, color: "#6b7280", marginBottom: 16 }}>
            Mensajes listos para copiar y mandar desde tu WhatsApp personal. Editá el nombre y mandalo vos — no automatizados.
          </p>
          <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
            {data.gyms_inactivos_7d.map(g => {
              const diasSinVer = g.last_seen_at
                ? Math.floor((Date.now() - new Date(g.last_seen_at).getTime()) / 86_400_000)
                : null;
              const nombre = g.owner_name?.split(" ")[0] ?? g.company_name.split(" ")[0];
              const msgA = `Hola ${nombre}! Soy Eli de FitGrowX 👋\n\n¿Cómo va el gym? ¿Pudieron arrancar a usar el sistema o todavía están poniéndolo a punto?\n\nCualquier cosa me avisás`;
              const msgB = `Ey ${nombre}! Eli de FitGrowX. Quería saber cómo la están pasando con la plataforma.\n\nSi hay algo que no quedó claro o algo que no les funciona, me decís y lo vemos juntos 🙌`;
              return (
                <div key={g.id} style={{ border: "1px solid #e5e7eb", borderRadius: 12, overflow: "hidden" }}>
                  <div style={{ padding: "12px 14px", borderBottom: "1px solid #f3f4f6", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                    <div>
                      <span style={{ font: `700 0.85rem/1 ${fd}`, color: "#111827" }}>{g.company_name}</span>
                      {g.owner_name && <span style={{ font: `400 0.75rem/1 ${fd}`, color: "#6b7280", marginLeft: 8 }}>{g.owner_name}</span>}
                    </div>
                    <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
                      {diasSinVer !== null && (
                        <span style={{ font: `600 0.72rem/1 ${fd}`, color: "#f59e0b", background: "rgba(245,158,11,0.1)", padding: "3px 8px", borderRadius: 6 }}>
                          {diasSinVer}d sin entrar
                        </span>
                      )}
                      {g.phone && (
                        <a
                          href={`https://wa.me/${g.phone.replace(/\D/g, "")}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          style={{ font: `700 0.72rem/1 ${fd}`, color: "#16a34a", background: "rgba(22,163,74,0.08)", padding: "4px 10px", borderRadius: 6, textDecoration: "none" }}
                        >
                          Abrir WA
                        </a>
                      )}
                    </div>
                  </div>
                  <div style={{ padding: "12px 14px", display: "flex", flexDirection: "column", gap: 10 }}>
                    {[{ label: "Mensaje A — apertura simple", msg: msgA }, { label: "Mensaje B — oferta de ayuda", msg: msgB }].map(({ label, msg }) => (
                      <div key={label}>
                        <p style={{ font: `600 0.68rem/1 ${fd}`, color: "#9ca3af", textTransform: "uppercase", letterSpacing: "0.05em", marginBottom: 6 }}>{label}</p>
                        <div
                          style={{ background: "#f9fafb", border: "1px solid #e5e7eb", borderRadius: 8, padding: "10px 12px", font: `400 0.8rem/1.55 ${fd}`, color: "#374151", whiteSpace: "pre-wrap", cursor: "pointer" }}
                          title="Click para copiar"
                          onClick={() => navigator.clipboard?.writeText(msg)}
                        >
                          {msg}
                        </div>
                        <p style={{ font: `400 0.68rem/1 ${fd}`, color: "#d1d5db", marginTop: 4 }}>Click para copiar</p>
                      </div>
                    ))}
                  </div>
                </div>
              );
            })}
          </div>
        </DetailPanel>
      )}

      {panel === "fraude_wa" && (
        <DetailPanel title={`WhatsApp duplicado (${data.fraude_wa_duplicados.length})`} onClose={() => setPanel(null)}>
          <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            {data.fraude_wa_duplicados.map(d => (
              <div key={d.phone} style={{ background: "rgba(245,158,11,0.06)", border: "1px solid rgba(245,158,11,0.2)", borderRadius: 10, padding: "10px 14px" }}>
                <div style={{ font: `600 0.82rem/1 ${fd}`, color: "#92400e", marginBottom: 4 }}>+{d.phone}</div>
                <div style={{ font: `400 0.72rem/1.5 ${fd}`, color: "#6b7280" }}>{d.gym_ids.length} cuentas: {d.gym_ids.join(", ")}</div>
              </div>
            ))}
          </div>
        </DetailPanel>
      )}

      {panel === "fraude_ratio" && (
        <DetailPanel title={`Ratio asistencias/alumnos sospechoso (${data.fraude_ratio_anomalos.length})`} onClose={() => setPanel(null)}>
          <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            {data.fraude_ratio_anomalos.map(r => (
              <div key={r.gym_id} style={{ background: "rgba(245,158,11,0.06)", border: "1px solid rgba(245,158,11,0.2)", borderRadius: 10, padding: "10px 14px" }}>
                <div style={{ font: `600 0.78rem/1 ${fd}`, color: "#6b7280", marginBottom: 6 }}>{r.gym_id}</div>
                <div style={{ display: "flex", gap: 16 }}>
                  <span style={{ font: `400 0.8rem/1 ${fd}`, color: "#374151" }}><strong>{r.alumnos_activos}</strong> alumnos activos</span>
                  <span style={{ font: `400 0.8rem/1 ${fd}`, color: "#374151" }}><strong>{r.asist_mes}</strong> asistencias este mes</span>
                  <span style={{ font: `700 0.8rem/1 ${fd}`, color: "#92400e" }}>×{r.ratio} ratio</span>
                </div>
              </div>
            ))}
          </div>
        </DetailPanel>
      )}

      {panel === "fraude_nombres" && (
        <DetailPanel title={`Alumnos con nombres sospechosos (${data.fraude_nombres_sospechosos.length})`} onClose={() => setPanel(null)}>
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            {data.fraude_nombres_sospechosos.map(a => (
              <div key={a.id} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "8px 12px", background: "rgba(239,68,68,0.04)", border: "1px solid rgba(239,68,68,0.1)", borderRadius: 8 }}>
                <div>
                  <div style={{ font: `600 0.82rem/1 ${fd}`, color: "#1f2937" }}>{a.full_name}</div>
                  <div style={{ font: `400 0.68rem/1 ${fd}`, color: "#9ca3af", marginTop: 2 }}>{a.gym_id}</div>
                </div>
                <span style={{ font: `500 0.7rem/1 ${fd}`, color: a.status === "activo" ? "#059669" : "#6b7280", background: a.status === "activo" ? "rgba(5,150,105,0.08)" : "rgba(107,114,128,0.08)", padding: "3px 8px", borderRadius: 99 }}>{a.status}</span>
              </div>
            ))}
          </div>
        </DetailPanel>
      )}

      <style>{`@keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }`}</style>
    </div>
  );
}
