"use client";

import { useEffect, useState, useRef, useMemo, useCallback } from "react";
import {
  Users, CreditCard,
  ArrowUpRight, ArrowDownRight, Send, Target, CircleHelp, BadgeAlert, Activity, UserMinus,
} from "lucide-react";
import { getCachedProfile, getPageCache, setPageCache } from "@/lib/gym-cache";

const accent = "#FF7A18";
const accentDeep = "#E65A00";
const fd = "var(--font-inter, 'Inter', sans-serif)";
const fb = "var(--font-inter, 'Inter', sans-serif)";
const fm = "var(--font-mono, 'JetBrains Mono', monospace)";
const t1 = "#101114";
const t2 = "#515765";
const t3 = "#98A1B2";

const cardBase: React.CSSProperties = {
  background: "#FFFFFF",
  borderRadius: 28,
  border: "1px solid rgba(17,24,39,0.06)",
  boxShadow: "0 1px 0 rgba(255,255,255,0.8) inset, 0 18px 44px rgba(15,23,42,0.06), 0 4px 14px rgba(15,23,42,0.04)",
  transition: "box-shadow 0.25s ease, transform 0.25s ease",
};

interface RecenteAlumno { id: string; full_name: string; created_at: string; }
interface PlanDist { nombre: string; count: number; }
interface DashboardMetric {
  key: string;
  label: string;
  section: "Embudo" | "Fidelización" | "Eficiencia";
  tooltip: string;
  value: number | null;
  previous: number | null;
  format: "number" | "percent" | "currency" | "months";
  accent: "orange" | "ink" | "soft";
}
interface DashboardAlerts {
  inactiveCount: number;
  inactiveNames: string[];
  upcomingExpirations: { id: string; full_name: string; next_expiration_date: string | null }[];
}
interface DashboardSnapshot {
  activosCount: number;
  totalCount: number;
  ingresoProyectado: number;
  gastosTotal: number;
  recientes: RecenteAlumno[];
  captacion5: number[];
  planDist: PlanDist[];
  prospectos: number;
  asistDiarias: { fecha: string; count: number }[];
  asistHoras: number[];
  asistHoy: number;
  metrics: DashboardMetric[];
  alerts: DashboardAlerts;
}

function initials(name: string) {
  if (!name) return "?";
  return name.split(" ").slice(0, 2).map(w => w[0]).join("").toUpperCase();
}

function fmt(n: number) {
  if (n >= 1_000_000) return `$${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `$${(n / 1_000).toFixed(0)}k`;
  return `$${n}`;
}

type DateFilter = "hoy" | "semana" | "mes";

const MONTH_LABELS = ["Ene","Feb","Mar","Abr","May","Jun","Jul","Ago","Sep","Oct","Nov","Dic"];
function last5Months() {
  const now = new Date();
  return Array.from({ length: 5 }, (_, i) => {
    const d = new Date(now.getFullYear(), now.getMonth() - (4 - i), 1);
    return { key: `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`, label: MONTH_LABELS[d.getMonth()] };
  });
}

function captacionPath(data: number[]) {
  const max = Math.max(...data, 1);
  const pts = data.map((v, i) => ({
    x: (i / (data.length - 1)) * 400,
    y: 120 - (v / max) * 100,
  }));
  let line = `M${pts[0].x.toFixed(1)},${pts[0].y.toFixed(1)}`;
  for (let i = 1; i < pts.length; i++) {
    const p = pts[i - 1], c = pts[i];
    const cpx = ((p.x + c.x) / 2).toFixed(1);
    line += ` C${cpx},${p.y.toFixed(1)} ${cpx},${c.y.toFixed(1)} ${c.x.toFixed(1)},${c.y.toFixed(1)}`;
  }
  return { line, area: line + " L400,130 L0,130 Z" };
}

function metricDelta(current: number | null, previous: number | null) {
  if (current == null || previous == null) return null;
  if (previous === 0) return current === 0 ? 0 : 100;
  return ((current - previous) / previous) * 100;
}

function formatMetricValue(metric: DashboardMetric) {
  if (metric.value == null) return "—";
  if (metric.format === "currency") return fmt(Math.round(metric.value));
  if (metric.format === "percent") return `${metric.value.toFixed(1)}%`;
  if (metric.format === "months") return `${metric.value.toFixed(1)}m`;
  return Number.isInteger(metric.value) ? String(metric.value) : metric.value.toFixed(1);
}

const PLAN_COLORS = ["#1A1D23", "#374151", "#6B7280", "#9CA3AF", "#D1D5DB", "#E5E7EB"];

const DONUT_R    = 52;
const DONUT_CX   = 74;
const DONUT_CY   = 74;
const DONUT_CIRC = 2 * Math.PI * DONUT_R;
const DONUT_GAP  = 5; // px gap accounts for round linecaps

function buildDonutSegments(slices: { value: number; color: string }[]) {
  const total = slices.reduce((s, d) => s + d.value, 0);
  if (total === 0) return [];
  let cumulative = 0;
  return slices.map(d => {
    const fraction  = d.value / total;
    const arcLen    = Math.max(0, fraction * DONUT_CIRC - DONUT_GAP);
    const dasharray = `${arcLen.toFixed(2)} ${(DONUT_CIRC - arcLen).toFixed(2)}`;
    const dashoffset = (DONUT_CIRC * (1 - cumulative)).toFixed(2);
    cumulative += fraction;
    return { dasharray, dashoffset, color: d.color, pct: Math.round(fraction * 100) };
  });
}

export default function DashboardPage() {
  const months5 = useMemo(() => last5Months(), []);
  const [loading, setLoading] = useState(true);
  const [dateFilter, setDateFilter] = useState<DateFilter>("mes");
  const gymIdRef = useRef<string | null>(null);
  const userIdRef = useRef<string | null>(null);
  const [isMobile, setIsMobile] = useState(false);
  const [ownerName, setOwnerName] = useState("dueño");
  const [gymName, setGymName] = useState("tu gym");

  useEffect(() => {
    const check = () => setIsMobile(window.innerWidth < 768);
    check();
    window.addEventListener("resize", check);
    return () => window.removeEventListener("resize", check);
  }, []);

  const [activosCount,      setActivosCount]      = useState(0);
  const [totalCount,        setTotalCount]        = useState(0);
  const [ingresoProyectado, setIngresoProyectado] = useState(0);
  const [gastosTotal,       setGastosTotal]       = useState(0);
  const [recientes,         setRecientes]         = useState<RecenteAlumno[]>([]);
  const [captacion5,        setCaptacion5]        = useState<number[]>([0, 0, 0, 0, 0]);
  const [planDist,          setPlanDist]          = useState<PlanDist[]>([]);
  const [prospectos,        setProspectos]        = useState(0);
  const [asistDiarias,      setAsistDiarias]      = useState<{ fecha: string; count: number }[]>([]);
  const [asistHoras,        setAsistHoras]        = useState<number[]>(Array(24).fill(0));
  const [asistHoy,          setAsistHoy]          = useState(0);
  const [metrics,           setMetrics]           = useState<DashboardMetric[]>([]);
  const [alerts,            setAlerts]            = useState<DashboardAlerts>({ inactiveCount: 0, inactiveNames: [], upcomingExpirations: [] });
  const [activeInfo,        setActiveInfo]        = useState<{ title: string; body: string } | null>(null);

  const applySnapshot = useCallback((snapshot: DashboardSnapshot) => {
    setActivosCount(snapshot.activosCount);
    setTotalCount(snapshot.totalCount);
    setIngresoProyectado(snapshot.ingresoProyectado);
    setGastosTotal(snapshot.gastosTotal);
    setRecientes(snapshot.recientes);
    setCaptacion5(snapshot.captacion5);
    setPlanDist(snapshot.planDist);
    setProspectos(snapshot.prospectos);
    setAsistDiarias(snapshot.asistDiarias);
    setAsistHoras(snapshot.asistHoras);
    setAsistHoy(snapshot.asistHoy);
    setMetrics(snapshot.metrics);
    setAlerts(snapshot.alerts);
  }, []);

  const fetchData = useCallback(async (filter: DateFilter) => {
    setLoading(true);
    let gym_id = gymIdRef.current;
    if (!gym_id) {
      const profile = await getCachedProfile();
      if (!profile) { setLoading(false); return; }
      gym_id = profile.gymId;
      gymIdRef.current = gym_id;
      userIdRef.current = profile.userId;
    }
    const cacheKey = `dashboard_${gym_id}_${filter}`;
    const cached = getPageCache<DashboardSnapshot>(cacheKey);
    if (cached) {
      applySnapshot(cached);
      setLoading(false);
    }

    const res = await fetch(`/api/admin/dashboard?filter=${filter}`, { cache: "no-store" });
    const payload = await res.json().catch(() => null) as {
      ok?: boolean;
      error?: string;
      ownerName?: string;
      gymName?: string;
      snapshot?: DashboardSnapshot;
    } | null;

    if (!res.ok || !payload?.ok || !payload.snapshot) {
      console.error("dashboard_load_error", payload?.error ?? `HTTP ${res.status}`);
      setLoading(false);
      return;
    }

    setOwnerName(payload.ownerName?.trim() || "dueño");
    setGymName(payload.gymName?.trim() || "tu gym");
    const snapshot = payload.snapshot;

    applySnapshot(snapshot);
    setPageCache(cacheKey, snapshot);

    setLoading(false);
  }, [applySnapshot]);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      void fetchData(dateFilter);
    }, 0);
    return () => window.clearTimeout(timer);
  }, [dateFilter, fetchData]);

  const sinEgresos  = gastosTotal === 0;
  const balanceNeto = sinEgresos ? ingresoProyectado : ingresoProyectado - gastosTotal;
  const hasCapt     = captacion5.some(v => v > 0);
  const { line: captLine, area: captArea } = captacionPath(captacion5);

  const donutSlices    = planDist.map((p, i) => ({ value: p.count, color: PLAN_COLORS[i % PLAN_COLORS.length] }));
  const donutSegments  = buildDonutSegments(donutSlices);
  const totalDonut     = planDist.reduce((s, p) => s + p.count, 0);

  const hoverOn  = (e: React.MouseEvent<HTMLElement>) => {
    e.currentTarget.style.boxShadow = "0 1px 0 rgba(255,255,255,0.85) inset, 0 22px 60px rgba(15,23,42,0.09), 0 8px 20px rgba(15,23,42,0.05)";
    e.currentTarget.style.transform = "translateY(-4px)";
  };
  const hoverOff = (e: React.MouseEvent<HTMLElement>) => {
    e.currentTarget.style.boxShadow = cardBase.boxShadow ?? "";
    e.currentTarget.style.transform = "none";
  };

  const filterLabels: { key: DateFilter; label: string }[] = [
    { key: "hoy",    label: "Hoy" },
    { key: "semana", label: "Semana" },
    { key: "mes",    label: "Mes" },
  ];

  const pageShell: React.CSSProperties = {
    display: "flex",
    flexDirection: "column",
    gap: isMobile ? 16 : 22,
    padding: isMobile ? "4px 0 0" : "4px 0 8px",
    position: "relative",
  };

  const cardHover = {
    onMouseEnter: hoverOn,
    onMouseLeave: hoverOff,
  };

  const orangeGlow = "linear-gradient(135deg, rgba(255,122,24,0.98) 0%, rgba(255,154,61,0.94) 46%, rgba(230,90,0,0.96) 100%)";
  const whitePanel = "#FFFFFF";
  const shellBg = "linear-gradient(180deg, #FFFDF9 0%, #FFF7EF 100%)";
  const chipBg = "rgba(255,122,24,0.10)";
  const softBorder = "1px solid rgba(17,24,39,0.06)";
  const chartStroke = accentDeep;
  const peakStroke = "#18181B";
  const statusPositive = "#11A869";
  const statusNegative = "#E6543A";
  const todayStr = new Date().toISOString().slice(0, 10);

  const renderFilters = (compact = false) => (
    <div style={{ display: "inline-flex", gap: 4, background: "#F5F7FA", borderRadius: compact ? 14 : 16, padding: 4, border: "1px solid rgba(17,24,39,0.06)" }}>
      {filterLabels.map((f) => {
        const active = dateFilter === f.key;
        return (
          <button
            key={f.key}
            onClick={() => setDateFilter(f.key)}
            style={{
              minWidth: compact ? 58 : 70,
              padding: compact ? "7px 10px" : "8px 13px",
              borderRadius: compact ? 10 : 12,
              border: active ? "1px solid rgba(17,24,39,0.08)" : "1px solid transparent",
              cursor: "pointer",
              font: `700 ${compact ? "0.7rem" : "0.74rem"}/1 ${fb}`,
              color: active ? t1 : t2,
              background: active ? "#FFFFFF" : "transparent",
              boxShadow: active ? "0 6px 18px rgba(15,23,42,0.06)" : "none",
            }}
          >
            {f.label}
          </button>
        );
      })}
    </div>
  );

  const renderKpiCard = (
    label: string,
    value: string,
    hint: string,
    icon: React.ReactNode,
    tone: "orange" | "ink" | "soft" = "soft",
    href?: string,
  ) => {
    const iconBg =
      tone === "orange"
        ? "linear-gradient(135deg, rgba(255,122,24,0.18), rgba(255,154,61,0.1))"
        : tone === "ink"
          ? "linear-gradient(135deg, rgba(16,17,20,0.92), rgba(49,52,61,0.92))"
          : "rgba(245,247,250,0.9)";
    const iconColor = tone === "ink" ? "#FFFFFF" : accentDeep;
    return (
      <a
        href={href}
        style={{ ...cardBase, padding: isMobile ? "18px 16px" : "20px 18px", background: whitePanel, cursor: href ? "pointer" : "default", display: "block", textDecoration: "none", color: "inherit" }}
        {...cardHover}
      >
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10, marginBottom: 18 }}>
          <span style={{ font: `500 0.73rem/1 ${fb}`, color: t3, textTransform: "uppercase", letterSpacing: "0.08em" }}>{label}</span>
          <div style={{ width: 38, height: 38, borderRadius: 14, background: iconBg, color: iconColor, display: "flex", alignItems: "center", justifyContent: "center", boxShadow: tone === "orange" ? "inset 0 1px 0 rgba(255,255,255,0.35)" : "none" }}>
            {icon}
          </div>
        </div>
        <div style={{ display: "flex", alignItems: "baseline", gap: 6, marginBottom: 8 }}>
          <span style={{ font: `800 ${isMobile ? "1.65rem" : "2rem"}/0.95 ${fd}`, color: t1, letterSpacing: "-0.05em" }}>{value}</span>
        </div>
        <p style={{ font: `500 0.74rem/1.45 ${fb}`, color: t2 }}>{hint}</p>
      </a>
    );
  };

  const renderMetricInfo = (metric: DashboardMetric) => (
    <div
      style={{ position: "relative", display: "inline-flex" }}
      onMouseEnter={() => { if (!isMobile) setActiveInfo({ title: metric.label, body: metric.tooltip }); }}
      onMouseLeave={() => { if (!isMobile) setActiveInfo(null); }}
    >
      <button
        onClick={() => { if (isMobile) setActiveInfo({ title: metric.label, body: metric.tooltip }); }}
        style={{ width: 22, height: 22, borderRadius: "50%", border: "1px solid rgba(17,24,39,0.08)", background: "#FFFFFF", color: t3, display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer", padding: 0 }}
      >
        <CircleHelp size={13} />
      </button>
      {!isMobile && activeInfo?.title === metric.label && (
        <div style={{ position: "absolute", left: "50%", bottom: "calc(100% + 8px)", transform: "translateX(-50%)", width: 220, padding: "10px 12px", borderRadius: 14, background: "#17181B", color: "white", boxShadow: "0 20px 40px rgba(0,0,0,0.18)", zIndex: 20 }}>
          <p style={{ font: `700 0.72rem/1 ${fd}`, marginBottom: 5 }}>{metric.label}</p>
          <p style={{ font: `500 0.68rem/1.45 ${fb}`, color: "rgba(255,255,255,0.75)" }}>{metric.tooltip}</p>
        </div>
      )}
    </div>
  );

  const renderMetricCard = (metric: DashboardMetric) => {
    const delta = metricDelta(metric.value, metric.previous);
    const isPositive = metric.key === "cac" ? (delta ?? 0) <= 0 : metric.key === "churn" ? (delta ?? 0) <= 0 : (delta ?? 0) >= 0;
    const toneBg =
      metric.accent === "orange"
        ? "rgba(255,122,24,0.10)"
        : metric.accent === "ink"
          ? "rgba(16,17,20,0.08)"
          : "rgba(92,107,131,0.08)";
    const toneColor = metric.accent === "orange" ? accentDeep : metric.accent === "ink" ? t1 : t2;
    return (
      <div key={metric.key} style={{ ...cardBase, padding: isMobile ? "16px 14px" : "17px 16px", background: "#FFFFFF" }} {...cardHover}>
        <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 12, marginBottom: 12 }}>
          <div>
            <p style={{ font: `700 0.72rem/1 ${fb}`, color: t3, textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: 6 }}>{metric.label}</p>
            <p style={{ font: `800 ${isMobile ? "1.35rem" : "1.55rem"}/0.94 ${fd}`, color: t1, letterSpacing: "-0.05em" }}>{formatMetricValue(metric)}</p>
          </div>
          {renderMetricInfo(metric)}
        </div>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10 }}>
          <span style={{ display: "inline-flex", alignItems: "center", gap: 6, padding: "7px 9px", borderRadius: 9999, background: toneBg, color: toneColor, font: `700 0.66rem/1 ${fb}` }}>
            {metric.section}
          </span>
          <span style={{ font: `700 0.68rem/1 ${fb}`, color: delta == null ? t3 : isPositive ? statusPositive : statusNegative }}>
            {delta == null ? "Sin MoM" : `${delta >= 0 ? "+" : ""}${delta.toFixed(1)}% MoM`}
          </span>
        </div>
      </div>
    );
  };

  const renderMetricSection = (section: DashboardMetric["section"], boxed = false) => {
    const sectionMetrics = metrics.filter((metric) => metric.section === section);
    const content = (
      <>
        <div>
          <p style={{ font: `800 ${isMobile ? "0.96rem" : "1rem"}/1 ${fd}`, color: t1, marginBottom: 4 }}>{section}</p>
          <p style={{ font: `500 0.74rem/1.45 ${fb}`, color: t3 }}>
            {section === "Embudo" && "Cómo se mueven las consultas hasta convertirse en socios."}
            {section === "Fidelización" && "Qué tan bien sostenés y renovás la base actual."}
            {section === "Eficiencia" && "Qué tan rentable y ordenada está la operación."}
          </p>
        </div>
        <div
          style={{
            display: "grid",
            gridTemplateColumns: boxed
              ? "1fr"
              : isMobile
                ? "1fr 1fr"
                : "repeat(4, minmax(0, 1fr))",
            gap: 12,
          }}
        >
          {sectionMetrics.map(renderMetricCard)}
        </div>
      </>
    );

    if (boxed) {
      return (
        <section
          style={{ ...cardBase, padding: isMobile ? "18px 16px" : "20px 20px", background: "#FFFFFF", display: "flex", flexDirection: "column", gap: 12 }}
          {...cardHover}
        >
          {content}
        </section>
      );
    }

    return <section style={{ display: "flex", flexDirection: "column", gap: 12 }}>{content}</section>;
  };

  const renderAlertsPanel = () => (
    <section id="dashboard-alertas" style={{ ...cardBase, padding: isMobile ? "18px 16px" : "20px 20px", background: "#FFFFFF", scrollMarginTop: isMobile ? 84 : 112 }} {...cardHover}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12, marginBottom: 16 }}>
        <div>
          <p style={{ font: `800 ${isMobile ? "0.96rem" : "1rem"}/1 ${fd}`, color: t1, marginBottom: 4 }}>Alertas de acción</p>
          <p style={{ font: `500 0.74rem/1.45 ${fb}`, color: t3 }}>Lo que conviene mirar hoy para no perder alumnos ni seguimiento.</p>
        </div>
        <div style={{ width: 36, height: 36, borderRadius: 14, background: "rgba(255,122,24,0.10)", color: accentDeep, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
          <BadgeAlert size={17} />
        </div>
      </div>
      <div style={{ display: "grid", gridTemplateColumns: isMobile ? "1fr" : "1fr 1fr", gap: 12 }}>
        <div style={{ padding: "14px 14px", borderRadius: 18, background: "#FFF8F1", border: "1px solid rgba(255,122,24,0.12)" }}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10, marginBottom: 8 }}>
            <p style={{ font: `700 0.78rem/1 ${fd}`, color: t1 }}>Inactivos +7 días</p>
            <span style={{ font: `800 0.86rem/1 ${fd}`, color: accentDeep }}>{alerts.inactiveCount}</span>
          </div>
          <p style={{ font: `500 0.7rem/1.45 ${fb}`, color: t2, marginBottom: 10 }}>Socios vigentes que dejaron de venir esta última semana.</p>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
            {alerts.inactiveNames.length > 0 ? alerts.inactiveNames.map((name) => (
              <span key={name} style={{ font: `600 0.66rem/1 ${fb}`, color: "#7A3E13", background: "rgba(255,122,24,0.10)", borderRadius: 9999, padding: "6px 9px" }}>{name}</span>
            )) : (
              <span style={{ font: `500 0.68rem/1.45 ${fb}`, color: t3 }}>Sin alumnos inactivos detectados.</span>
            )}
          </div>
        </div>
        <div style={{ padding: "14px 14px", borderRadius: 18, background: "#FFF7F4", border: "1px solid rgba(230,84,58,0.10)" }}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10, marginBottom: 8 }}>
            <p style={{ font: `700 0.78rem/1 ${fd}`, color: t1 }}>Vencimientos 72h</p>
            <span style={{ font: `800 0.86rem/1 ${fd}`, color: statusNegative }}>{alerts.upcomingExpirations.length}</span>
          </div>
          <p style={{ font: `500 0.7rem/1.45 ${fb}`, color: t2, marginBottom: 10 }}>Bajas próximas que conviene contactar antes de que venzan.</p>
          <div style={{ display: "flex", flexDirection: "column", gap: 7 }}>
            {alerts.upcomingExpirations.length > 0 ? alerts.upcomingExpirations.map((row) => (
              <div key={row.id} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10 }}>
                <span style={{ font: `600 0.68rem/1 ${fb}`, color: t1 }}>{row.full_name}</span>
                <span style={{ font: `700 0.66rem/1 ${fm}`, color: statusNegative }}>{row.next_expiration_date ?? "—"}</span>
              </div>
            )) : (
              <span style={{ font: `500 0.68rem/1.45 ${fb}`, color: t3 }}>No hay vencimientos cercanos.</span>
            )}
          </div>
        </div>
      </div>
    </section>
  );

  /* ─────────── MOBILE LAYOUT ─────────── */
  if (isMobile) return (
    <>
    <div style={pageShell}>
      <style>{`
        @keyframes fadeUp {
          from { opacity: 0; transform: translateY(10px); }
          to   { opacity: 1; transform: translateY(0); }
        }
        .dash-card { animation: fadeUp 0.28s cubic-bezier(0.16,1,0.3,1) both; }
        .dash-card:nth-child(2) { animation-delay: 0.05s; }
        .dash-card:nth-child(3) { animation-delay: 0.10s; }
        .dash-card:nth-child(4) { animation-delay: 0.15s; }
        .dash-card:nth-child(5) { animation-delay: 0.20s; }
        .stat-scroll::-webkit-scrollbar { display: none; }
        .stat-scroll { -ms-overflow-style: none; scrollbar-width: none; }
        .dashboard-grain::before {
          content: "";
          position: absolute;
          inset: 0;
          pointer-events: none;
          opacity: 0.1;
          mix-blend-mode: soft-light;
          background-image:
            radial-gradient(rgba(255,255,255,0.5) 0.5px, transparent 0.5px),
            radial-gradient(rgba(0,0,0,0.26) 0.6px, transparent 0.6px);
          background-size: 9px 9px, 11px 11px;
          background-position: 0 0, 3px 5px;
        }
      `}</style>
      <div style={{ background: shellBg, borderRadius: 30, border: softBorder, padding: "20px 18px 16px", position: "relative", overflow: "hidden", boxShadow: "0 16px 40px rgba(15,23,42,0.05)" }}>
        <div style={{ position: "absolute", inset: 0, pointerEvents: "none", background: "radial-gradient(circle at top left, rgba(255,122,24,0.16), transparent 42%), radial-gradient(circle at bottom right, rgba(255,180,120,0.24), transparent 30%)" }} />
        <div className="dashboard-grain" style={{ position: "absolute", inset: 0, pointerEvents: "none" }} />
        <div style={{ position: "relative", zIndex: 1 }}>
          <p style={{ font: `500 0.66rem/1.4 ${fm}`, color: "#7A3E13", letterSpacing: "0.06em", marginBottom: 8, textTransform: "uppercase" }}>{`Dashboard de ${gymName} | vista general`}</p>
          <h1 style={{ font: `800 1.45rem/1.02 ${fd}`, color: t1, letterSpacing: "-0.06em", marginBottom: 8 }}>{`Hola, ${ownerName}`}</h1>
          <p style={{ font: `500 0.8rem/1.55 ${fb}`, color: t2, marginBottom: 16 }}>Veamos cómo va tu negocio hoy.</p>
          {renderFilters(true)}
          <div style={{ marginTop: 16, padding: "16px 16px 14px", borderRadius: 22, background: orangeGlow, color: "white", position: "relative", overflow: "hidden", boxShadow: "0 16px 34px rgba(255,122,24,0.26)" }}>
            <div className="dashboard-grain" style={{ position: "absolute", inset: 0, pointerEvents: "none", opacity: 0.18 }} />
            <div style={{ position: "relative", zIndex: 1 }}>
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10, marginBottom: 12 }}>
                <span style={{ font: `700 0.68rem/1 ${fb}`, color: "rgba(255,255,255,0.82)", textTransform: "uppercase", letterSpacing: "0.09em" }}>Ingreso proyectado</span>
                <div style={{ width: 32, height: 32, borderRadius: 13, background: "rgba(255,255,255,0.16)", display: "flex", alignItems: "center", justifyContent: "center" }}>
                  <CreditCard size={15} color="white" />
                </div>
              </div>
              <div style={{ display: "flex", alignItems: "baseline", gap: 7, marginBottom: 14 }}>
                <span style={{ font: `800 2rem/0.95 ${fd}`, letterSpacing: "-0.06em" }}>{loading ? "—" : fmt(ingresoProyectado)}</span>
                <span style={{ font: `500 0.74rem/1 ${fb}`, color: "rgba(255,255,255,0.72)" }}>/ mes</span>
              </div>
              <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 8 }}>
                {[
                  { label: "Activos", value: loading ? "—" : String(activosCount) },
                  { label: "Asistencia", value: loading ? "—" : String(asistHoy) },
                  { label: "Vencen 72h", value: loading ? "—" : String(alerts.upcomingExpirations.length), href: "#dashboard-alertas" },
                ].map((item) => (
                  <a
                    key={item.label}
                    href={item.href}
                    style={{ padding: "9px 9px 10px", borderRadius: 16, background: "rgba(255,255,255,0.14)", border: "1px solid rgba(255,255,255,0.16)", cursor: item.href ? "pointer" : "default", textDecoration: "none", color: "inherit" }}
                  >
                    <p style={{ font: `700 0.86rem/1 ${fd}`, marginBottom: 4 }}>{item.value}</p>
                    <p style={{ font: `500 0.58rem/1.35 ${fb}`, color: "rgba(255,255,255,0.72)", textTransform: "uppercase", letterSpacing: "0.08em" }}>{item.label}</p>
                  </a>
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>

      {renderMetricSection("Embudo")}
      <div style={{ display: "grid", gridTemplateColumns: "1fr", gap: 12 }}>
        {renderMetricSection("Fidelización", true)}
        {renderMetricSection("Eficiencia", true)}
      </div>
      {renderAlertsPanel()}

      <div className="dash-card" style={{ ...cardBase, padding: "20px 18px", background: whitePanel }} {...cardHover}>
        <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 12, marginBottom: 18 }}>
          <div>
            <p style={{ font: `800 1rem/1 ${fd}`, color: t1, marginBottom: 5 }}>Captación de alumnos</p>
            <p style={{ font: `500 0.72rem/1.5 ${fb}`, color: t3 }}>Tendencia de los últimos cinco meses.</p>
          </div>
          <div style={{ padding: "9px 12px", borderRadius: 16, background: chipBg, color: accentDeep, display: "flex", alignItems: "center", gap: 8 }}>
            <Target size={14} />
            <span style={{ font: `700 0.72rem/1 ${fb}` }}>{loading ? "—" : `${prospectos} prospectos`}</span>
          </div>
        </div>
        <svg width="100%" height="118" viewBox="0 0 400 118" preserveAspectRatio="none">
          <defs>
            <linearGradient id="areaGradMobileWarm" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor={accent} stopOpacity="0.22" />
              <stop offset="100%" stopColor={accent} stopOpacity="0" />
            </linearGradient>
          </defs>
          {[24, 56, 88].map((y) => <line key={y} x1="0" y1={y} x2="400" y2={y} stroke="#F2F4F7" strokeWidth="1" />)}
          {hasCapt ? (
            <>
              <path d={captArea} fill="url(#areaGradMobileWarm)" />
              <path d={captLine} stroke={chartStroke} strokeWidth="2.6" fill="none" strokeLinecap="round" strokeLinejoin="round" />
              {captacion5.map((v, i) => {
                const max = Math.max(...captacion5, 1);
                const x = (i / (captacion5.length - 1)) * 400;
                const y = 120 - (v / max) * 100;
                return <circle key={i} cx={x} cy={y} r="4" fill="#fff" stroke={chartStroke} strokeWidth="2" />;
              })}
            </>
          ) : (
            <text x="200" y="62" textAnchor="middle" fill={t3} fontSize="12" fontFamily={fb}>Sin datos registrados aún</text>
          )}
        </svg>
        <div style={{ display: "flex", justifyContent: "space-between", marginTop: 10 }}>
          {months5.map((m) => <span key={m.key} style={{ font: `500 0.68rem/1 ${fb}`, color: t3 }}>{m.label}</span>)}
        </div>
      </div>

      <div className="dash-card dashboard-grain" style={{ padding: "18px 16px", borderRadius: 28, background: orangeGlow, color: "white", position: "relative", overflow: "hidden", boxShadow: "0 18px 42px rgba(255,122,24,0.24)" }}>
          <div style={{ position: "relative", zIndex: 1 }}>
            <p style={{ font: `800 0.94rem/1 ${fd}`, marginBottom: 4 }}>Balance neto</p>
            <p style={{ font: `500 0.7rem/1.45 ${fb}`, color: "rgba(255,255,255,0.78)", marginBottom: 16 }}>Vista rápida del período actual.</p>
            {sinEgresos ? (
              <>
                <p style={{ font: `800 2rem/0.94 ${fd}`, letterSpacing: "-0.05em", marginBottom: 8 }}>—</p>
                <p style={{ font: `500 0.72rem/1.5 ${fb}`, color: "rgba(255,255,255,0.78)" }}>Cargá egresos para ver el neto real del gimnasio.</p>
              </>
            ) : (
              <>
                <p style={{ font: `800 2rem/0.94 ${fd}`, letterSpacing: "-0.05em", marginBottom: 14 }}>{loading ? "—" : fmt(Math.abs(balanceNeto))}</p>
                <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 16 }}>
                  {balanceNeto >= 0 ? <ArrowUpRight size={13} color="white" /> : <ArrowDownRight size={13} color="white" />}
                  <span style={{ font: `700 0.72rem/1 ${fb}`, color: "white" }}>{balanceNeto >= 0 ? "Superávit" : "Déficit"}</span>
                </div>
                <div style={{ display: "grid", gap: 8 }}>
                  <div style={{ display: "flex", justifyContent: "space-between", padding: "10px 12px", borderRadius: 16, background: "rgba(255,255,255,0.14)" }}>
                    <span style={{ font: `500 0.68rem/1 ${fb}`, color: "rgba(255,255,255,0.76)" }}>Ingresos</span>
                    <span style={{ font: `700 0.7rem/1 ${fd}` }}>{fmt(ingresoProyectado)}</span>
                  </div>
                  <div style={{ display: "flex", justifyContent: "space-between", padding: "10px 12px", borderRadius: 16, background: "rgba(255,255,255,0.14)" }}>
                    <span style={{ font: `500 0.68rem/1 ${fb}`, color: "rgba(255,255,255,0.76)" }}>Egresos</span>
                    <span style={{ font: `700 0.7rem/1 ${fd}` }}>{fmt(gastosTotal)}</span>
                  </div>
                </div>
              </>
            )}
          </div>
        </div>

      {asistDiarias.length > 0 && (() => {
        const maxA = Math.max(...asistDiarias.map((d) => d.count), 1);
        const peakH = asistHoras.indexOf(Math.max(...asistHoras));
        return (
          <div style={{ display: "grid", gridTemplateColumns: "1.1fr 0.9fr", gap: 12 }}>
            <div className="dash-card" style={{ ...cardBase, padding: "18px 16px", background: whitePanel }} {...cardHover}>
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10, marginBottom: 16 }}>
                <div>
                  <p style={{ font: `800 0.94rem/1 ${fd}`, color: t1, marginBottom: 4 }}>Asistencia diaria</p>
                  <p style={{ font: `500 0.7rem/1.45 ${fb}`, color: t3 }}>Últimos 14 días.</p>
                </div>
                <span style={{ font: `700 0.68rem/1 ${fb}`, color: accentDeep, background: chipBg, borderRadius: 9999, padding: "7px 10px" }}>{asistHoy} hoy</span>
              </div>
              <div style={{ display: "flex", alignItems: "flex-end", gap: 4, height: 84 }}>
                {asistDiarias.map((d) => {
                  const h = maxA > 0 ? Math.max((d.count / maxA) * 72, d.count > 0 ? 4 : 0) : 0;
                  const isToday = d.fecha === todayStr;
                  return (
                    <div key={d.fecha} style={{ flex: 1, display: "flex", alignItems: "flex-end", height: "100%" }}>
                      <div style={{ width: "100%", height: h || 2, borderRadius: 9999, background: isToday ? orangeGlow : d.count > 0 ? peakStroke : "#EDF1F5", opacity: isToday ? 1 : 0.75 }} />
                    </div>
                  );
                })}
              </div>
            </div>

            <div className="dash-card" style={{ ...cardBase, padding: "18px 16px", background: whitePanel }} {...cardHover}>
              <p style={{ font: `800 0.94rem/1 ${fd}`, color: t1, marginBottom: 4 }}>Horario pico</p>
              <p style={{ font: `500 0.7rem/1.45 ${fb}`, color: t3, marginBottom: 16 }}>Dónde se concentra la asistencia.</p>
              <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                {[6, 7, 8, 9, 10, 17, 18, 19, 20, 21, 22].map((h) => {
                  const count = asistHoras[h] ?? 0;
                  const pct = asistHoras[peakH] > 0 ? (count / asistHoras[peakH]) * 100 : 0;
                  const isPeak = h === peakH && count > 0;
                  return (
                    <div key={h} style={{ display: "flex", alignItems: "center", gap: 8 }}>
                      <span style={{ width: 28, flexShrink: 0, textAlign: "right", font: `600 0.62rem/1 ${fm}`, color: t3 }}>{h}h</span>
                      <div style={{ flex: 1, height: 7, background: "#EDF1F5", borderRadius: 9999, overflow: "hidden" }}>
                        <div style={{ width: `${pct}%`, height: "100%", background: isPeak ? orangeGlow : "#17181B", borderRadius: 9999 }} />
                      </div>
                      <span style={{ width: 16, flexShrink: 0, font: `700 0.62rem/1 ${fd}`, color: isPeak ? accentDeep : t2 }}>{count}</span>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        );
      })()}

    </div>
    {activeInfo && (
      <div onClick={() => setActiveInfo(null)} style={{ position: "fixed", inset: 0, zIndex: 120, background: "rgba(0,0,0,0.42)", backdropFilter: "blur(4px)", display: "flex", alignItems: "flex-end" }}>
        <div onClick={(e) => e.stopPropagation()} style={{ width: "100%", background: "#FFFFFF", borderRadius: "22px 22px 0 0", padding: "20px 18px 24px", boxShadow: "0 -16px 36px rgba(0,0,0,0.14)" }}>
          <div style={{ width: 42, height: 4, borderRadius: 999, background: "#E5E7EB", margin: "0 auto 14px" }} />
          <p style={{ font: `800 0.98rem/1 ${fd}`, color: t1, marginBottom: 8 }}>{activeInfo.title}</p>
          <p style={{ font: `500 0.82rem/1.6 ${fb}`, color: t2 }}>{activeInfo.body}</p>
        </div>
      </div>
    )}
    </>
  );

  /* ─────────── DESKTOP LAYOUT ─────────── */
  return (
    <>
    <div style={pageShell}>
      <style>{`
        .dashboard-grain::before {
          content: "";
          position: absolute;
          inset: 0;
          pointer-events: none;
          opacity: 0.08;
          mix-blend-mode: soft-light;
          background-image:
            radial-gradient(rgba(255,255,255,0.6) 0.6px, transparent 0.6px),
            radial-gradient(rgba(0,0,0,0.2) 0.5px, transparent 0.5px);
          background-size: 10px 10px, 12px 12px;
          background-position: 0 0, 4px 6px;
        }
      `}</style>

      <div style={{ display: "flex", alignItems: "flex-end", justifyContent: "space-between", gap: 16, flexWrap: "wrap" }}>
        <div>
          <p style={{ font: `500 0.7rem/1.4 ${fm}`, color: "#8A4516", letterSpacing: "0.06em", marginBottom: 8, textTransform: "uppercase" }}>{`Dashboard de ${gymName} | vista general`}</p>
          <h1 style={{ font: `800 2rem/0.95 ${fd}`, color: t1, letterSpacing: "-0.08em", marginBottom: 8, maxWidth: 760 }}>{`Hola, ${ownerName}`}</h1>
          <p style={{ font: `500 0.86rem/1.6 ${fb}`, color: t2, maxWidth: 720 }}>Veamos cómo va tu negocio y dónde conviene actuar primero.</p>
        </div>
        <div style={{ minWidth: 240, maxWidth: 300, width: "100%" }}>
          {renderFilters(false)}
        </div>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "minmax(0, 1.55fr) minmax(320px, 1fr)", gap: 20 }}>
        <div className="dashboard-grain" style={{ borderRadius: 30, background: orangeGlow, padding: "22px 22px 20px", position: "relative", overflow: "hidden", boxShadow: "0 22px 54px rgba(255,122,24,0.24)" }}>
          <div style={{ position: "absolute", inset: 0, background: "radial-gradient(circle at top right, rgba(255,255,255,0.26), transparent 28%), radial-gradient(circle at bottom left, rgba(255,210,170,0.25), transparent 24%)", pointerEvents: "none" }} />
          <div style={{ position: "relative", zIndex: 1 }}>
            <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 16, marginBottom: 20 }}>
              <div>
                <p style={{ font: `700 0.72rem/1 ${fb}`, color: "rgba(255,255,255,0.82)", textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: 8 }}>Ingreso proyectado</p>
                <div style={{ display: "flex", alignItems: "baseline", gap: 8, marginBottom: 8 }}>
                  <span style={{ font: `800 3rem/0.92 ${fd}`, color: "white", letterSpacing: "-0.08em" }}>{loading ? "—" : fmt(ingresoProyectado)}</span>
                  <span style={{ font: `500 0.82rem/1 ${fb}`, color: "rgba(255,255,255,0.78)" }}>/ mes</span>
                </div>
                <div style={{ display: "inline-flex", alignItems: "center", gap: 7, padding: "8px 12px", borderRadius: 9999, background: "rgba(255,255,255,0.14)", border: "1px solid rgba(255,255,255,0.18)" }}>
                  <ArrowUpRight size={14} color="white" />
                  <span style={{ font: `700 0.74rem/1 ${fb}`, color: "white" }}>Suma de planes activos</span>
                </div>
              </div>
              <div style={{ width: 48, height: 48, borderRadius: 18, background: "rgba(255,255,255,0.16)", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                <CreditCard size={20} color="white" />
              </div>
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 10 }}>
                {[
                  { label: "Activos", value: loading ? "—" : String(activosCount) },
                  { label: "Asistencia", value: loading ? "—" : String(asistHoy) },
                  { label: "Vencen 72h", value: loading ? "—" : String(alerts.upcomingExpirations.length), href: "#dashboard-alertas" },
                ].map((item) => (
                <a key={item.label} href={item.href} style={{ padding: "12px 12px 11px", borderRadius: 18, background: "rgba(255,255,255,0.14)", border: "1px solid rgba(255,255,255,0.16)", cursor: item.href ? "pointer" : "default", textAlign: "left", textDecoration: "none", color: "inherit" }}>
                  <p style={{ font: `800 1.1rem/1 ${fd}`, color: "white", marginBottom: 5 }}>{item.value}</p>
                  <p style={{ font: `600 0.63rem/1.35 ${fb}`, color: "rgba(255,255,255,0.74)", textTransform: "uppercase", letterSpacing: "0.08em" }}>{item.label}</p>
                </a>
              ))}
            </div>
          </div>
        </div>

        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 18 }}>
          {renderKpiCard("Alumnos", loading ? "—" : String(activosCount), `${totalCount} registrados en total`, <Users size={17} color="#fff" />, "ink")}
          {renderKpiCard("Asistencia hoy", loading ? "—" : String(asistHoy), "Escaneos registrados en el día", <Activity size={17} color={accentDeep} />, "orange")}
          {renderKpiCard("Inactivos +7d", loading ? "—" : String(alerts.inactiveCount), "Socios vigentes para recuperar", <UserMinus size={17} color={accentDeep} />, "soft", "#dashboard-alertas")}
          {renderKpiCard("Vencen 72h", loading ? "—" : String(alerts.upcomingExpirations.length), "Bajas próximas para contactar", <BadgeAlert size={17} color="#fff" />, "ink", "#dashboard-alertas")}
        </div>
      </div>

      {renderMetricSection("Embudo")}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(2, minmax(0, 1fr))", gap: 18 }}>
        {renderMetricSection("Fidelización", true)}
        {renderMetricSection("Eficiencia", true)}
      </div>
      {renderAlertsPanel()}

      <div style={{ display: "grid", gridTemplateColumns: "minmax(0, 1.5fr) minmax(320px, 1fr)", gap: 20 }}>
        <div style={{ ...cardBase, padding: "24px 24px 20px", background: whitePanel }} {...cardHover}>
          <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 14, marginBottom: 22 }}>
            <div>
              <p style={{ font: `800 1.02rem/1 ${fd}`, color: t1, marginBottom: 6 }}>Captación de alumnos</p>
              <p style={{ font: `500 0.76rem/1.5 ${fb}`, color: t3 }}>Cómo viene entrando la demanda en los últimos cinco meses.</p>
            </div>
            <div style={{ padding: "10px 13px", borderRadius: 18, background: chipBg, color: accentDeep, display: "flex", alignItems: "center", gap: 8 }}>
              <Target size={14} />
              <span style={{ font: `700 0.74rem/1 ${fb}` }}>{loading ? "—" : `${prospectos} abiertos`}</span>
            </div>
          </div>
          <svg width="100%" height="152" viewBox="0 0 400 152" preserveAspectRatio="none">
            <defs>
              <linearGradient id="areaGradDesktopWarm" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor={accent} stopOpacity="0.24" />
                <stop offset="100%" stopColor={accent} stopOpacity="0" />
              </linearGradient>
            </defs>
            {[34, 76, 118].map((y) => <line key={y} x1="0" y1={y} x2="400" y2={y} stroke="#F2F4F7" strokeWidth="1" />)}
            {hasCapt ? (
              <>
                <path d={captArea} fill="url(#areaGradDesktopWarm)" />
                <path d={captLine} stroke={chartStroke} strokeWidth="2.8" fill="none" strokeLinecap="round" strokeLinejoin="round" />
                {captacion5.map((v, i) => {
                  const max = Math.max(...captacion5, 1);
                  const x = (i / (captacion5.length - 1)) * 400;
                  const y = 120 - (v / max) * 100;
                  return <circle key={i} cx={x} cy={y} r="4.5" fill="#fff" stroke={chartStroke} strokeWidth="2.3" />;
                })}
              </>
            ) : (
              <text x="200" y="80" textAnchor="middle" fill={t3} fontSize="12" fontFamily={fb}>Sin datos registrados aún</text>
            )}
          </svg>
          <div style={{ display: "flex", justifyContent: "space-between", marginTop: 10 }}>
            {months5.map((m) => <span key={m.key} style={{ font: `500 0.71rem/1 ${fb}`, color: t3 }}>{m.label}</span>)}
          </div>
        </div>

        <div className="dashboard-grain" style={{ borderRadius: 30, background: whitePanel, border: softBorder, padding: "24px 22px", position: "relative", overflow: "hidden", boxShadow: cardBase.boxShadow }}>
          <div style={{ position: "absolute", inset: 0, background: "radial-gradient(circle at top right, rgba(255,122,24,0.10), transparent 34%), radial-gradient(circle at bottom left, rgba(255,179,107,0.12), transparent 34%)", pointerEvents: "none" }} />
          <div style={{ position: "relative", zIndex: 1 }}>
            <p style={{ font: `800 1.02rem/1 ${fd}`, color: t1, marginBottom: 6 }}>Balance neto</p>
            <p style={{ font: `500 0.76rem/1.5 ${fb}`, color: t3, marginBottom: 18 }}>Ingresos contra egresos del período actual.</p>
            {sinEgresos ? (
              <div style={{ padding: "18px 18px", borderRadius: 22, background: "#FFF6ED", border: "1px solid rgba(255,122,24,0.12)" }}>
                <p style={{ font: `800 2rem/0.95 ${fd}`, color: accentDeep, letterSpacing: "-0.05em", marginBottom: 8 }}>—</p>
                <p style={{ font: `500 0.76rem/1.55 ${fb}`, color: t2 }}>Todavía no hay egresos cargados para calcular el neto real.</p>
              </div>
            ) : (
              <>
                <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 10 }}>
                  {balanceNeto >= 0 ? <ArrowUpRight size={15} color={statusPositive} /> : <ArrowDownRight size={15} color={statusNegative} />}
                  <span style={{ font: `700 0.75rem/1 ${fb}`, color: balanceNeto >= 0 ? statusPositive : statusNegative }}>{balanceNeto >= 0 ? "Superávit" : "Déficit"}</span>
                </div>
                <p style={{ font: `800 2.8rem/0.94 ${fd}`, color: t1, letterSpacing: "-0.06em", marginBottom: 20 }}>{loading ? "—" : fmt(Math.abs(balanceNeto))}</p>
                <div style={{ display: "grid", gap: 10 }}>
                  <div style={{ display: "flex", justifyContent: "space-between", padding: "14px 14px", borderRadius: 18, background: "#F7FAF9" }}>
                    <span style={{ font: `600 0.72rem/1 ${fb}`, color: t2 }}>Ingresos</span>
                    <span style={{ font: `700 0.76rem/1 ${fd}`, color: statusPositive }}>{fmt(ingresoProyectado)}</span>
                  </div>
                  <div style={{ display: "flex", justifyContent: "space-between", padding: "14px 14px", borderRadius: 18, background: "#FFF7F5" }}>
                    <span style={{ font: `600 0.72rem/1 ${fb}`, color: t2 }}>Egresos</span>
                    <span style={{ font: `700 0.76rem/1 ${fd}`, color: statusNegative }}>{fmt(gastosTotal)}</span>
                  </div>
                </div>
              </>
            )}
          </div>
        </div>
      </div>

      {asistDiarias.length > 0 && (() => {
        const maxA = Math.max(...asistDiarias.map((d) => d.count), 1);
        const peakH = asistHoras.indexOf(Math.max(...asistHoras));
        return (
          <div style={{ display: "grid", gridTemplateColumns: "minmax(0, 1.35fr) minmax(320px, 1fr)", gap: 20 }}>
            <div style={{ ...cardBase, padding: "24px 24px 20px", background: whitePanel }} {...cardHover}>
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 14, marginBottom: 18 }}>
                <div>
                  <p style={{ font: `800 1.02rem/1 ${fd}`, color: t1, marginBottom: 6 }}>Asistencia diaria</p>
                  <p style={{ font: `500 0.76rem/1.5 ${fb}`, color: t3 }}>Últimos 14 días del gimnasio.</p>
                </div>
                <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                  <span style={{ font: `700 0.72rem/1 ${fb}`, color: accentDeep, background: chipBg, borderRadius: 9999, padding: "8px 12px" }}>{asistHoy} hoy</span>
                  <a href="/dashboard/asistencias" style={{ font: `700 0.72rem/1 ${fb}`, color: t2, textDecoration: "none" }}>Ver detalle →</a>
                </div>
              </div>
              <div style={{ display: "flex", alignItems: "flex-end", gap: 6, height: 100 }}>
                {asistDiarias.map((d) => {
                  const h = maxA > 0 ? Math.max((d.count / maxA) * 84, d.count > 0 ? 4 : 0) : 0;
                  const isToday = d.fecha === todayStr;
                  return (
                    <div key={d.fecha} style={{ flex: 1, display: "flex", alignItems: "flex-end", height: "100%" }}>
                      <div style={{ width: "100%", height: h || 2, borderRadius: 9999, background: isToday ? orangeGlow : d.count > 0 ? peakStroke : "#EDF1F5", opacity: isToday ? 1 : 0.76 }} />
                    </div>
                  );
                })}
              </div>
            </div>

            <div style={{ ...cardBase, padding: "24px 22px", background: whitePanel }} {...cardHover}>
              <p style={{ font: `800 1.02rem/1 ${fd}`, color: t1, marginBottom: 6 }}>Horario pico</p>
              <p style={{ font: `500 0.76rem/1.5 ${fb}`, color: t3, marginBottom: 18 }}>Dónde se concentra el entrenamiento.</p>
              <div style={{ display: "flex", flexDirection: "column", gap: 9 }}>
                {[6, 7, 8, 9, 10, 17, 18, 19, 20, 21, 22].map((h) => {
                  const count = asistHoras[h] ?? 0;
                  const pct = asistHoras[peakH] > 0 ? (count / asistHoras[peakH]) * 100 : 0;
                  const isPeak = h === peakH && count > 0;
                  return (
                    <div key={h} style={{ display: "flex", alignItems: "center", gap: 10 }}>
                      <span style={{ width: 28, flexShrink: 0, textAlign: "right", font: `600 0.64rem/1 ${fm}`, color: t3 }}>{h}h</span>
                      <div style={{ flex: 1, height: 8, background: "#EDF1F5", borderRadius: 9999, overflow: "hidden" }}>
                        <div style={{ width: `${pct}%`, height: "100%", background: isPeak ? orangeGlow : "#17181B", borderRadius: 9999 }} />
                      </div>
                      <span style={{ width: 18, flexShrink: 0, font: `700 0.64rem/1 ${fd}`, color: isPeak ? accentDeep : t2 }}>{count}</span>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        );
      })()}

    </div>
    </>
  );
}
