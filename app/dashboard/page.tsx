"use client";

import React, { useEffect, useState, useRef, useMemo, useCallback } from "react";
import {
  Users, CreditCard, Zap,
  ArrowUpRight, ArrowDownRight, Send, Target, CircleHelp, BadgeAlert, Activity, UserMinus, Clock, UserPlus,
} from "lucide-react";
import { getCachedProfile, getPageCache, setPageCache } from "@/lib/gym-cache";
import { supabase } from "@/lib/supabase";
import { OnboardingModal, DinoSVG, getDinoState } from "@/app/dashboard/components/OnboardingModal";

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
  proyeccionProximoMes: number;
  renovacionesPendientes: number;
  renovacionesCount: number;
  mensajesAutoEnviados: number;
  recuperadosCount: number;
  recuperadosRevenue: number;
  recaudadoEsteMes: number;
  deudaTotal: number;
  morososCount: number;
  gastosTotal: number;
  recientes: RecenteAlumno[];
  captacion5: number[];
  planDist: PlanDist[];
  prospectos: number;
  asistDiarias: { fecha: string; count: number }[];
  asistHoras: number[];
  asistHoy: number;
  asistPromedioDiario: number;
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

const MONTH_NAMES = ["Enero","Febrero","Marzo","Abril","Mayo","Junio","Julio","Agosto","Septiembre","Octubre","Noviembre","Diciembre"];

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

// ─── Skeleton components ──────────────────────────────────────────────────────
function Skel({ w, h, r = 7 }: { w?: number | string; h: number; r?: number }) {
  return (
    <div style={{ width: w ?? "100%", height: h, borderRadius: r, flexShrink: 0, background: "linear-gradient(90deg,#ECEEF2 25%,#E4E6EB 50%,#ECEEF2 75%)", backgroundSize: "400% 100%", animation: "skelShimmer 1.6s ease infinite" }} />
  );
}
function SkelLight({ w, h, r = 7 }: { w?: number | string; h: number; r?: number }) {
  return (
    <div style={{ width: w ?? "100%", height: h, borderRadius: r, flexShrink: 0, background: "linear-gradient(90deg,rgba(255,255,255,0.15) 25%,rgba(255,255,255,0.30) 50%,rgba(255,255,255,0.15) 75%)", backgroundSize: "400% 100%", animation: "skelShimmer 1.6s ease infinite" }} />
  );
}
// ─────────────────────────────────────────────────────────────────────────────

// ─── datos de demo ────────────────────────────────────────────────────────────
function buildDemoSnapshot(): DashboardSnapshot {
  const today = new Date();
  const asistDiarias = Array.from({ length: 30 }, (_, i) => {
    const d = new Date(today); d.setDate(d.getDate() - (29 - i));
    const dow = d.getDay(); // 0=dom
    const base = dow === 0 ? 5 : dow === 6 ? 8 : [14, 18, 17, 19, 16][i % 5];
    const jitter = Math.round((Math.sin(i * 1.7) * 3));
    return { fecha: d.toISOString().slice(0, 10), count: Math.max(3, base + jitter) };
  });
  const asistHoras = Array(24).fill(0).map((_, h) => {
    if (h >= 7  && h <= 9)  return Math.round(8  + Math.sin(h) * 2);
    if (h >= 17 && h <= 20) return Math.round(12 + Math.sin(h) * 3);
    if (h >= 10 && h <= 12) return Math.round(5  + Math.sin(h) * 1);
    return 0;
  });
  return {
    activosCount: 47, totalCount: 54, ingresoProyectado: 847_000, proyeccionProximoMes: 520_000, renovacionesPendientes: 28, renovacionesCount: 31, mensajesAutoEnviados: 47, recuperadosCount: 7, recuperadosRevenue: 126_000, recaudadoEsteMes: 612_000, deudaTotal: 85_000, morososCount: 6, gastosTotal: 210_000,
    recientes: [
      { id: "d1", full_name: "Valentina Ríos",    created_at: new Date(Date.now() - 1 * 86400000).toISOString() },
      { id: "d2", full_name: "Matías Fernández",  created_at: new Date(Date.now() - 2 * 86400000).toISOString() },
      { id: "d3", full_name: "Luciana Herrera",   created_at: new Date(Date.now() - 3 * 86400000).toISOString() },
      { id: "d4", full_name: "Gonzalo Pereyra",   created_at: new Date(Date.now() - 5 * 86400000).toISOString() },
      { id: "d5", full_name: "Camila Rodríguez",  created_at: new Date(Date.now() - 7 * 86400000).toISOString() },
    ],
    captacion5: [3, 5, 4, 7, 6],
    planDist: [{ nombre: "Mensual", count: 29 }, { nombre: "3 meses", count: 12 }, { nombre: "Anual", count: 6 }],
    prospectos: 14,
    asistDiarias,
    asistHoras,
    asistHoy: 17, asistPromedioDiario: 14,
    metrics: [
      { key: "leads",        label: "Consultas recibidas",   section: "Embudo",        tooltip: "Personas nuevas que preguntaron o se contactaron este mes.",               value: 23,   previous: 18,  format: "number",   accent: "orange" },
      { key: "lead_trial",   label: "De consulta a prueba",  section: "Embudo",        tooltip: "De cada 100 personas que consultaron, cuántas llegaron a probar el gym.",  value: 60.9, previous: 55.6,format: "percent",  accent: "soft"   },
      { key: "trial_member", label: "De prueba a socio",     section: "Embudo",        tooltip: "De cada 100 que probaron, cuántas terminaron siendo socios.",               value: 71.4, previous: 66.7,format: "percent",  accent: "soft"   },
      { key: "cac",          label: "Costo por socio nuevo", section: "Embudo",        tooltip: "Cuánto te costó conseguir cada socio nuevo este mes.",                      value: 4200, previous: 5100,format: "currency", accent: "ink"    },
      { key: "churn",        label: "Socios que se van",     section: "Fidelización",  tooltip: "De cada 100 socios, cuántos dejaron de renovar este mes.",                  value: 4.3,  previous: 6.1, format: "percent",  accent: "orange" },
      { key: "retention",    label: "Socios que renuevan",   section: "Fidelización",  tooltip: "De los socios por vencer, cuántos siguieron con la membresía.",             value: 87.2, previous: 83.0,format: "percent",  accent: "soft"   },
      { key: "ltv",          label: "Valor de un socio",     section: "Fidelización",  tooltip: "Cuánto genera en promedio un socio durante todo el tiempo en tu gym.",      value: 54000,previous: 49000,format: "currency", accent: "ink"   },
      { key: "arpu",         label: "Ingreso por socio",     section: "Eficiencia",    tooltip: "Cuánto generás por cada socio activo este mes.",                            value: 18000,previous: 17200,format: "currency", accent: "soft"   },
      { key: "ocupacion",    label: "Ocupación de clases",   section: "Eficiencia",    tooltip: "De todos los lugares disponibles en clases, cuántos se ocuparon.",          value: 73.5, previous: 68.0,format: "percent",  accent: "orange" },
      { key: "m2",           label: "Ingreso por metro²",    section: "Eficiencia",    tooltip: "Lo activamos cuando cargues la superficie del local.",                       value: null, previous: null,format: "currency", accent: "ink"    },
    ],
    alerts: {
      inactiveCount: 9,
      inactiveNames: ["Tomás García", "Sofía López", "Nicolás Castro", "Agustina Paz", "Ramiro Sosa"],
      upcomingExpirations: [
        { id: "e1", full_name: "Valentina Ríos",   next_expiration_date: new Date(Date.now() + 2 * 86400000).toISOString().slice(0, 10) },
        { id: "e2", full_name: "Matías Fernández", next_expiration_date: new Date(Date.now() + 3 * 86400000).toISOString().slice(0, 10) },
        { id: "e3", full_name: "Luciana Herrera",  next_expiration_date: new Date(Date.now() + 5 * 86400000).toISOString().slice(0, 10) },
        { id: "e4", full_name: "Gonzalo Pereyra",  next_expiration_date: new Date(Date.now() + 6 * 86400000).toISOString().slice(0, 10) },
        { id: "e5", full_name: "Camila Rodríguez", next_expiration_date: new Date(Date.now() + 7 * 86400000).toISOString().slice(0, 10) },
      ],
    },
  };
}
// ─────────────────────────────────────────────────────────────────────────────

export default function DashboardPage() {
  const months5 = useMemo(() => last5Months(), []);
  const [loading, setLoading] = useState(true);
  const [selectedMonth, setSelectedMonth] = useState(() => { const d = new Date(); return new Date(d.getFullYear(), d.getMonth(), 1); });
  const gymIdRef = useRef<string | null>(null);
  const userIdRef = useRef<string | null>(null);
  const [isMobile, setIsMobile] = useState(false);
  const [ownerName, setOwnerName] = useState<string | null>(null);
  const [fetchedAt, setFetchedAt] = useState<Date | null>(null);
  const [gymName, setGymName] = useState("tu gym");
  const [greetPhase, setGreetPhase] = useState<"hola" | "exit" | "welcome">("hola");

  useEffect(() => {
    const check = () => setIsMobile(window.innerWidth < 768);
    check();
    window.addEventListener("resize", check);
    return () => window.removeEventListener("resize", check);
  }, []);

  const [activosCount,      setActivosCount]      = useState(0);
  const [totalCount,        setTotalCount]        = useState(0);
  const [ingresoProyectado,     setIngresoProyectado]     = useState(0);
  const [proyeccionProximoMes,  setProyeccionProximoMes]  = useState(0);
  const [renovacionesPendientes,setRenovacionesPendientes]= useState(0);
  const [renovacionesCount,     setRenovacionesCount]     = useState(0);
  const [mensajesAutoEnviados,  setMensajesAutoEnviados]  = useState(0);
  const [recuperadosCount,      setRecuperadosCount]      = useState(0);
  const [recuperadosRevenue,    setRecuperadosRevenue]    = useState(0);
  const [recaudadoEsteMes,      setRecaudadoEsteMes]      = useState(0);
  const [deudaTotal,            setDeudaTotal]            = useState(0);
  const [morososCount,          setMorososCount]          = useState(0);
  const [gastosTotal,           setGastosTotal]           = useState(0);
  const [recientes,         setRecientes]         = useState<RecenteAlumno[]>([]);
  const [captacion5,        setCaptacion5]        = useState<number[]>([0, 0, 0, 0, 0]);
  const [planDist,          setPlanDist]          = useState<PlanDist[]>([]);
  const [prospectos,        setProspectos]        = useState(0);
  const [asistDiarias,      setAsistDiarias]      = useState<{ fecha: string; count: number }[]>([]);
  const [asistHoras,        setAsistHoras]        = useState<number[]>(Array(24).fill(0));
  const [asistHoy,          setAsistHoy]          = useState(0);
  const [asistPromedioDiario, setAsistPromedioDiario] = useState(0);
  const [metrics,           setMetrics]           = useState<DashboardMetric[]>([]);
  const [alerts,            setAlerts]            = useState<DashboardAlerts>({ inactiveCount: 0, inactiveNames: [], upcomingExpirations: [] });
  const [activeInfo,        setActiveInfo]        = useState<{ title: string; body: string } | null>(null);
  const [setup, setSetup] = useState<{ alumnos: boolean; planes: boolean; landing: boolean; whatsapp: boolean; pagos: boolean } | null>(null);
  const [ownerPhoneMissing, setOwnerPhoneMissing] = useState(false);
  const [onboardingOpen, setOnboardingOpen] = useState(false);
  const [demoMode, setDemoMode] = useState(false);
  const realSnapshotRef = useRef<DashboardSnapshot | null>(null);

  const applySnapshot = useCallback((snapshot: DashboardSnapshot) => {
    setActivosCount(snapshot.activosCount);
    setTotalCount(snapshot.totalCount);
    setIngresoProyectado(snapshot.ingresoProyectado);
    setProyeccionProximoMes(snapshot.proyeccionProximoMes);
    setRenovacionesPendientes(snapshot.renovacionesPendientes);
    setRenovacionesCount(snapshot.renovacionesCount ?? 0);
    setMensajesAutoEnviados(snapshot.mensajesAutoEnviados);
    setRecuperadosCount(snapshot.recuperadosCount);
    setRecuperadosRevenue(snapshot.recuperadosRevenue);
    setRecaudadoEsteMes(snapshot.recaudadoEsteMes ?? 0);
    setDeudaTotal(snapshot.deudaTotal ?? 0);
    setMorososCount(snapshot.morososCount ?? 0);
    setGastosTotal(snapshot.gastosTotal);
    setRecientes(snapshot.recientes);
    setCaptacion5(snapshot.captacion5);
    setPlanDist(snapshot.planDist);
    setProspectos(snapshot.prospectos);
    setAsistDiarias(snapshot.asistDiarias);
    setAsistHoras(snapshot.asistHoras);
    setAsistHoy(snapshot.asistHoy);
    setAsistPromedioDiario(snapshot.asistPromedioDiario ?? 0);
    setMetrics(snapshot.metrics);
    setAlerts(snapshot.alerts);
  }, []);

  const enterDemo = useCallback(() => {
    realSnapshotRef.current = { activosCount, totalCount, ingresoProyectado, proyeccionProximoMes, renovacionesPendientes, renovacionesCount, mensajesAutoEnviados, recuperadosCount, recuperadosRevenue, recaudadoEsteMes, deudaTotal, morososCount, gastosTotal, recientes, captacion5, planDist, prospectos, asistDiarias, asistHoras, asistHoy, asistPromedioDiario, metrics, alerts };
    applySnapshot(buildDemoSnapshot());
    setDemoMode(true);
  }, [activosCount, totalCount, ingresoProyectado, gastosTotal, recientes, captacion5, planDist, prospectos, asistDiarias, asistHoras, asistHoy, metrics, alerts, applySnapshot]);

  const exitDemo = useCallback(() => {
    if (realSnapshotRef.current) applySnapshot(realSnapshotRef.current);
    setDemoMode(false);
  }, [applySnapshot]);

  const fetchData = useCallback(async (month: Date) => {
    setLoading(true);
    let gym_id = gymIdRef.current;
    if (!gym_id) {
      const profile = await getCachedProfile();
      if (!profile) { setLoading(false); return; }
      gym_id = profile.gymId;
      gymIdRef.current = gym_id;
      userIdRef.current = profile.userId;
    }
    const y = month.getFullYear(), m = month.getMonth();
    const from = `${y}-${String(m + 1).padStart(2, "0")}-01`;
    const lastDay = new Date(y, m + 1, 0).getDate();
    const to = `${y}-${String(m + 1).padStart(2, "0")}-${String(lastDay).padStart(2, "0")}`;
    const cacheKey = `dashboard_${gym_id}_${from}`;
    const cached = getPageCache<DashboardSnapshot>(cacheKey);
    if (cached) {
      applySnapshot(cached);
      setLoading(false);
    }

    const res = await fetch(`/api/admin/dashboard?from=${from}&to=${to}`, { cache: "no-store" });
    const payload = await res.json().catch(() => null) as {
      ok?: boolean;
      error?: string;
      ownerName?: string;
      gymName?: string;
      fetchedAt?: string;
      snapshot?: DashboardSnapshot;
    } | null;

    if (!res.ok || !payload?.ok || !payload.snapshot) {
      console.error("dashboard_load_error", payload?.error ?? `HTTP ${res.status}`);
      setLoading(false);
      return;
    }

    const name = payload.ownerName?.trim() || null;
    setOwnerName(name);
    setGymName(payload.gymName?.trim() || "tu gym");
    if (payload.fetchedAt) setFetchedAt(new Date(payload.fetchedAt));
    if (name) {
      setGreetPhase("exit");
      setTimeout(() => setGreetPhase("welcome"), 650);
    }
    const snapshot = payload.snapshot;

    applySnapshot(snapshot);
    setPageCache(cacheKey, snapshot);

    setLoading(false);
  }, [applySnapshot]);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      void fetchData(selectedMonth);
    }, 0);
    return () => window.clearTimeout(timer);
  }, [selectedMonth, fetchData]);

  useEffect(() => {
    async function loadSetup() {
      const profile = await getCachedProfile();
      if (!profile) return;
      const [settingsRes, alumnosRes, planesRes, profileRes] = await Promise.all([
        supabase.from("gym_settings").select("whatsapp_connected, slug, mp_access_token, payment_info, onboarding_completed").eq("gym_id", profile.gymId).maybeSingle(),
        supabase.from("alumnos").select("id", { count: "exact", head: true }).eq("gym_id", profile.gymId).is("deleted_at", null),
        supabase.from("planes").select("id", { count: "exact", head: true }).eq("gym_id", profile.gymId),
        supabase.from("profiles").select("phone").eq("id", profile.userId).maybeSingle(),
      ]);
      setOwnerPhoneMissing(!profileRes.data?.phone);
      const s = settingsRes.data;
      const computed = {
        alumnos:  (alumnosRes.count ?? 0) > 0,
        planes:   (planesRes.count ?? 0) > 0,
        landing:  !!s?.slug,
        whatsapp: !!s?.whatsapp_connected,
        pagos:    !!(s?.mp_access_token || s?.payment_info),
      };
      setSetup(computed);
      const allDone = Object.values(computed).every(Boolean);
      if (!allDone) setOnboardingOpen(true);
      if (allDone && !s?.onboarding_completed && profile.gymId) {
        void supabase.from("gym_settings").update({ onboarding_completed: true }).eq("gym_id", profile.gymId);
      }
    }
    void loadSetup();
  }, []);

  const sinEgresos  = gastosTotal === 0;
  const balanceNeto = sinEgresos ? ingresoProyectado : ingresoProyectado - gastosTotal;
  const hasCapt     = captacion5.some(v => v > 0);

  const hour = useMemo(() => new Date().getHours(), []);

  const quickActions = useMemo(() => {
    if (hour >= 6 && hour < 10) return [
      { emoji: "✅", label: "Asistencia de hoy", hint: asistHoy > 0 ? `${asistHoy} registradas` : "Sin registros aún", href: "/dashboard/asistencias" },
      { emoji: "📋", label: "Tomar asistencia", hint: "Manual o QR", href: "/dashboard/scanner" },
      { emoji: "⏰", label: alerts.upcomingExpirations.length > 0 ? `${alerts.upcomingExpirations.length} socios por vencer` : "Sin vencimientos hoy", hint: alerts.upcomingExpirations.length > 0 ? "Avisales antes de que venza" : "Todo al día", href: "#dashboard-alertas" },
    ];
    if (hour >= 10 && hour < 14) return [
      { emoji: "💳", label: "Registrar un pago", hint: "Marcar cobro de membresía", href: "/dashboard/pagos" },
      { emoji: "⏰", label: alerts.upcomingExpirations.length > 0 ? `${alerts.upcomingExpirations.length} por vencer` : "Sin vencimientos hoy", hint: alerts.upcomingExpirations.length > 0 ? "Contactar para que renueven" : "Todo al día", href: "#dashboard-alertas" },
      { emoji: "👤", label: "Agregar alumno", hint: "Registrar uno nuevo", href: "/dashboard/alumnos" },
    ];
    if (hour >= 14 && hour < 19) return [
      { emoji: "🎯", label: prospectos > 0 ? `${prospectos} prospectos` : "Ver prospectos", hint: prospectos > 0 ? "Pendientes de contacto" : "Sin prospectos nuevos", href: "/dashboard/prospectos" },
      { emoji: "👤", label: "Agregar alumno", hint: "Nuevo registro", href: "/dashboard/alumnos" },
      { emoji: "💳", label: "Registrar un pago", hint: "Marcar cobro de membresía", href: "/dashboard/pagos" },
    ];
    return [
      { emoji: "📊", label: `${asistHoy} asistencias hoy`, hint: "Resumen del día", href: "#dashboard-alertas" },
      { emoji: "📝", label: "Cargar egreso", hint: "Registrar gasto del día", href: "/dashboard/egresos" },
      { emoji: "⏰", label: alerts.upcomingExpirations.length > 0 ? `${alerts.upcomingExpirations.length} vencen pronto` : "Sin vencimientos pronto", hint: alerts.upcomingExpirations.length > 0 ? "Para mañana: contactar" : "Todo al día", href: "#dashboard-alertas" },
    ];
  }, [hour, asistHoy, alerts.upcomingExpirations.length, prospectos]);

  const renderQuickActions = () => {
    const timeLabel = hour >= 6 && hour < 10 ? "Mañana" : hour >= 10 && hour < 14 ? "Mediodía" : hour >= 14 && hour < 19 ? "Tarde" : "Noche";
    return (
      <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
        <p style={{ font: `600 0.68rem/1 ${fb}`, color: t3, textTransform: "uppercase", letterSpacing: "0.08em" }}>
          Acciones rápidas · {timeLabel}
        </p>
        <div className="stat-scroll" style={{ display: "flex", gap: 10, overflowX: "auto", paddingBottom: 2 }}>
          {quickActions.map((a) => (
            <a
              key={a.label}
              href={a.href}
              style={{ display: "flex", flexDirection: "column", gap: 6, padding: "12px 14px", borderRadius: 16, background: "#FFFFFF", border: "1px solid rgba(17,24,39,0.07)", boxShadow: "0 2px 8px rgba(15,23,42,0.05)", textDecoration: "none", color: "inherit", minWidth: 140, flexShrink: 0, cursor: "pointer" }}
            >
              <span style={{ fontSize: "1.1rem", lineHeight: 1 }}>{a.emoji}</span>
              <p style={{ font: `700 0.76rem/1.2 ${fd}`, color: t1, margin: 0 }}>{a.label}</p>
              <p style={{ font: `400 0.66rem/1.3 ${fb}`, color: t3, margin: 0 }}>{a.hint}</p>
            </a>
          ))}
        </div>
      </div>
    );
  };
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

  const isCurrentMonth = selectedMonth.getFullYear() === new Date().getFullYear() && selectedMonth.getMonth() === new Date().getMonth();

  const fetchedAtLabel = (() => {
    if (!fetchedAt) return null;
    const diff = Math.floor((Date.now() - fetchedAt.getTime()) / 60000);
    if (diff < 1) return "Actualizado ahora";
    if (diff === 1) return "Actualizado hace 1 min";
    if (diff < 60) return `Actualizado hace ${diff} min`;
    return `Actualizado hace ${Math.floor(diff / 60)}h`;
  })();

  const renderFilters = (compact = false) => (
    <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
      <div style={{ display: "inline-flex", alignItems: "center", gap: 2, background: "#F5F7FA", borderRadius: compact ? 14 : 16, padding: 4, border: "1px solid rgba(17,24,39,0.06)" }}>
        <button
          onClick={() => setSelectedMonth(m => new Date(m.getFullYear(), m.getMonth() - 1, 1))}
          style={{ width: compact ? 28 : 32, height: compact ? 28 : 32, borderRadius: compact ? 9 : 10, border: "none", background: "transparent", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", color: t2, fontSize: 14 }}
        >‹</button>
        <span style={{ font: `700 ${compact ? "0.72rem" : "0.76rem"}/1 ${fb}`, color: t1, minWidth: compact ? 110 : 130, textAlign: "center", padding: "0 4px" }}>
          {MONTH_NAMES[selectedMonth.getMonth()]} {selectedMonth.getFullYear()}
        </span>
        <button
          onClick={() => setSelectedMonth(m => new Date(m.getFullYear(), m.getMonth() + 1, 1))}
          disabled={isCurrentMonth}
          style={{ width: compact ? 28 : 32, height: compact ? 28 : 32, borderRadius: compact ? 9 : 10, border: "none", background: "transparent", cursor: isCurrentMonth ? "default" : "pointer", display: "flex", alignItems: "center", justifyContent: "center", color: isCurrentMonth ? t3 : t2, fontSize: 14 }}
        >›</button>
      </div>
      {fetchedAtLabel && !compact && (
        <span style={{ font: `400 0.68rem/1 ${fb}`, color: t3, whiteSpace: "nowrap" }}>{fetchedAtLabel}</span>
      )}
    </div>
  );

  const renderKpiCard = (
    label: string,
    value: React.ReactNode,
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
            {metric.section === "Embudo" ? "Captación" : metric.section === "Fidelización" ? "Retención" : "Eficiencia"}
          </span>
          <span style={{ font: `500 0.68rem/1 ${fb}`, color: delta == null ? t3 : isPositive ? statusPositive : statusNegative }}>
            {delta == null
              ? "Sin datos del mes anterior"
              : delta === 0
                ? "Igual que el mes pasado"
                : `${delta > 0 ? "▲" : "▼"} ${Math.abs(delta).toFixed(1)}% vs mes pasado`}
          </span>
        </div>
      </div>
    );
  };

  const renderMetricSection = (section: DashboardMetric["section"], boxed = false) => {
    const sectionMetrics = metrics.filter((metric) => metric.section === section);
    const skelCount = section === "Embudo" ? 4 : section === "Fidelización" ? 4 : 2;
    const skelCard = (
      <div style={{ ...cardBase, padding: isMobile ? "16px 14px" : "17px 16px", background: "#FFFFFF", display: "flex", flexDirection: "column", gap: 14 }}>
        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          <Skel w="65%" h={11} r={5} />
          <Skel w="42%" h={32} r={9} />
        </div>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10 }}>
          <Skel w={72} h={26} r={9999} />
          <Skel w={88} h={10} r={5} />
        </div>
      </div>
    );
    const content = (
      <>
        <div>
          <p style={{ font: `800 ${isMobile ? "0.96rem" : "1rem"}/1 ${fd}`, color: t1, marginBottom: 4 }}>
            {section === "Embudo" ? "Captación de socios" : section === "Fidelización" ? "Retención" : "Eficiencia"}
          </p>
          <p style={{ font: `500 0.74rem/1.45 ${fb}`, color: t3 }}>
            {section === "Embudo" && "Cuántas personas nuevas llegaron y cuántas terminaron siendo socios."}
            {section === "Fidelización" && "Cuántos socios renuevan y cuántos se van cada mes."}
            {section === "Eficiencia" && "Cuánto genera tu gym por cada socio que tenés."}
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
          {loading && sectionMetrics.length === 0
            ? Array(boxed ? 1 : skelCount).fill(null).map((_, i) => <React.Fragment key={i}>{skelCard}</React.Fragment>)
            : sectionMetrics.map(renderMetricCard)}
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

  const renderPulsoPanel = () => {
    const now = Date.now();
    const relDate = (iso: string) => {
      const diff = Math.floor((now - new Date(iso).getTime()) / 86400000);
      if (diff === 0) return "Hoy";
      if (diff === 1) return "Ayer";
      return `Hace ${diff} días`;
    };
    const daysUntil = (iso: string | null) => {
      if (!iso) return null;
      return Math.max(0, Math.ceil((new Date(iso).getTime() - now) / 86400000));
    };
    const initials = (name: string) => name.split(" ").map(w => w[0]).join("").slice(0, 2).toUpperCase();
    const AVATAR_COLORS = ["#FF7A18","#6366F1","#10B981","#F59E0B","#EC4899","#3B82F6"];

    return (
      <section style={{ ...cardBase, padding: isMobile ? "18px 16px" : "22px 22px", background: "#FFFFFF" }} {...cardHover}>
        <div style={{ display: "grid", gridTemplateColumns: isMobile ? "1fr" : "1fr 1fr", gap: isMobile ? 20 : 24 }}>

          {/* Últimas altas */}
          <div>
            <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 16 }}>
              <div style={{ width: 32, height: 32, borderRadius: 12, background: "rgba(99,102,241,0.10)", color: "#6366F1", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                <UserPlus size={15} />
              </div>
              <div>
                <p style={{ font: `700 0.88rem/1 ${fd}`, color: t1 }}>Últimas altas</p>
                <p style={{ font: `500 0.68rem/1 ${fb}`, color: t3 }}>Socios que se sumaron recientemente</p>
              </div>
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
              {recientes.length > 0 ? recientes.slice(0, 5).map((r, i) => (
                <div key={r.id} style={{ display: "flex", alignItems: "center", gap: 10 }}>
                  <div style={{ width: 34, height: 34, borderRadius: 12, background: AVATAR_COLORS[i % AVATAR_COLORS.length], display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                    <span style={{ font: `700 0.68rem/1 ${fd}`, color: "white" }}>{initials(r.full_name)}</span>
                  </div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <p style={{ font: `600 0.8rem/1 ${fd}`, color: t1, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{r.full_name}</p>
                  </div>
                  <span style={{ font: `500 0.68rem/1 ${fb}`, color: t3, flexShrink: 0 }}>{relDate(r.created_at)}</span>
                </div>
              )) : (
                <p style={{ font: `500 0.74rem/1.5 ${fb}`, color: t3 }}>Todavía no hay socios registrados.</p>
              )}
            </div>
          </div>

          {/* Vencimientos próximos */}
          <div>
            <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 16 }}>
              <div style={{ width: 32, height: 32, borderRadius: 12, background: "rgba(239,68,68,0.08)", color: statusNegative, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                <Clock size={15} />
              </div>
              <div>
                <p style={{ font: `700 0.88rem/1 ${fd}`, color: t1 }}>Vencimientos próximos</p>
                <p style={{ font: `500 0.68rem/1 ${fb}`, color: t3 }}>Avisales antes de que pierdan su lugar</p>
              </div>
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
              {alerts.upcomingExpirations.length > 0 ? alerts.upcomingExpirations.map((row) => {
                const days = daysUntil(row.next_expiration_date);
                const urgent = days !== null && days <= 1;
                return (
                  <div key={row.id} style={{ display: "flex", alignItems: "center", gap: 10 }}>
                    <div style={{ width: 34, height: 34, borderRadius: 12, background: urgent ? "rgba(239,68,68,0.08)" : "rgba(245,158,11,0.08)", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                      <span style={{ font: `800 0.68rem/1 ${fd}`, color: urgent ? statusNegative : "#D97706" }}>{days === 0 ? "Hoy" : `${days}d`}</span>
                    </div>
                    <p style={{ font: `600 0.8rem/1 ${fd}`, color: t1, flex: 1, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{row.full_name}</p>
                    <span style={{ font: `500 0.68rem/1 ${fb}`, color: t3, flexShrink: 0 }}>{row.next_expiration_date ?? "—"}</span>
                  </div>
                );
              }) : (
                <div style={{ padding: "14px 14px", borderRadius: 16, background: "#F0FDF4", border: "1px solid rgba(16,185,129,0.15)", display: "flex", alignItems: "center", gap: 10 }}>
                  <span style={{ fontSize: "1.1rem" }}>✅</span>
                  <p style={{ font: `500 0.74rem/1.45 ${fb}`, color: "#166534" }}>Sin vencimientos en los próximos días.</p>
                </div>
              )}
            </div>
          </div>

        </div>
      </section>
    );
  };

  /* ─────────── MOBILE LAYOUT ─────────── */
  if (isMobile) return (
    <>
    <div style={pageShell}>
      <style>{`
        @keyframes fadeUp {
          from { opacity: 0; transform: translateY(10px); }
          to   { opacity: 1; transform: translateY(0); }
        }
        @keyframes greetExit {
          from { opacity: 1; transform: translateY(0); }
          to   { opacity: 0; transform: translateY(-8px); }
        }
        @keyframes greetEnter {
          from { opacity: 0; transform: translateY(8px); }
          to   { opacity: 1; transform: translateY(0); }
        }
        .greet-exit    { animation: greetExit  0.5s cubic-bezier(0.4,0,1,1) forwards; }
        .greet-welcome { animation: greetEnter 0.6s cubic-bezier(0.16,1,0.3,1) both; }
        .dash-card { animation: fadeUp 0.28s cubic-bezier(0.16,1,0.3,1) both; }
        .dash-card:nth-child(2) { animation-delay: 0.05s; }
        .dash-card:nth-child(3) { animation-delay: 0.10s; }
        .dash-card:nth-child(4) { animation-delay: 0.15s; }
        .dash-card:nth-child(5) { animation-delay: 0.20s; }
        .stat-scroll::-webkit-scrollbar { display: none; }
        .stat-scroll { -ms-overflow-style: none; scrollbar-width: none; }
        @keyframes skelShimmer {
          0%   { background-position: 100% 0; }
          100% { background-position: -100% 0; }
        }
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
          <p style={{ font: `500 0.66rem/1.4 ${fm}`, color: "#7A3E13", letterSpacing: "0.06em", marginBottom: 8, textTransform: "uppercase" }}>{`${gymName}`}</p>
          <h1 className={greetPhase === "exit" ? "greet-exit" : greetPhase === "welcome" ? "greet-welcome" : ""} style={{ font: `800 1.45rem/1.02 ${fd}`, color: t1, letterSpacing: "-0.06em", marginBottom: 8 }}>{greetPhase === "welcome" ? `Bienvenido, ${ownerName}` : "Hola 👋"}</h1>
          <p style={{ font: `500 0.8rem/1.55 ${fb}`, color: t2, marginBottom: 16 }}>Veamos cómo va tu negocio hoy.</p>
          {renderFilters(true)}
          <div style={{ marginTop: 16, padding: "18px 16px 16px", borderRadius: 24, background: orangeGlow, color: "white", position: "relative", overflow: "hidden", boxShadow: "0 16px 40px rgba(255,100,0,0.28), inset 0 1px 0 rgba(255,255,255,0.22)" }}>
            <div style={{ position: "absolute", inset: 0, background: "radial-gradient(ellipse at 90% 10%, rgba(255,255,255,0.30) 0%, transparent 45%), radial-gradient(ellipse at 5% 90%, rgba(180,60,0,0.28) 0%, transparent 45%)", pointerEvents: "none" }} />
            <div className="dashboard-grain" style={{ position: "absolute", inset: 0, pointerEvents: "none", opacity: 0.14 }} />
            <div style={{ position: "relative", zIndex: 1 }}>
              <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 10, marginBottom: 14 }}>
                <div>
                  <span style={{ font: `600 0.62rem/1 ${fb}`, color: "rgba(255,255,255,0.65)", textTransform: "uppercase", letterSpacing: "0.11em", display: "block", marginBottom: 10 }}>Lo que vas a cobrar este mes</span>
                  <div style={{ display: "flex", alignItems: "baseline", gap: 6 }}>
                    {loading
                      ? <SkelLight w={140} h={36} r={10} />
                      : <span style={{ font: `800 2.2rem/0.92 ${fd}`, letterSpacing: "-0.06em" }}>{fmt(ingresoProyectado)}</span>}
                    {!loading && <span style={{ font: `400 0.76rem/1 ${fb}`, color: "rgba(255,255,255,0.58)" }}>/ mes</span>}
                  </div>
                </div>
                <div style={{ width: 34, height: 34, borderRadius: 12, background: "rgba(0,0,0,0.18)", border: "1px solid rgba(255,255,255,0.14)", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                  <CreditCard size={15} color="rgba(255,255,255,0.90)" />
                </div>
              </div>
              <div style={{ display: "flex", alignItems: "center", gap: 6, flexWrap: "wrap", marginBottom: 14 }}>
                {!loading && recaudadoEsteMes > 0 && (
                  <div style={{ display: "inline-flex", alignItems: "center", gap: 5, padding: "5px 10px", borderRadius: 9999, background: "rgba(0,0,0,0.18)", border: "1px solid rgba(255,255,255,0.10)" }}>
                    <span style={{ font: `400 0.62rem/1 ${fb}`, color: "rgba(255,255,255,0.60)" }}>Cobrado</span>
                    <span style={{ font: `700 0.66rem/1 ${fd}`, color: "white" }}>{fmt(recaudadoEsteMes)}</span>
                  </div>
                )}
                {!loading && proyeccionProximoMes > 0 && (
                  <div style={{ display: "inline-flex", alignItems: "center", gap: 5, padding: "5px 10px", borderRadius: 9999, background: "rgba(0,0,0,0.12)", border: "1px solid rgba(255,255,255,0.08)" }}>
                    <span style={{ font: `400 0.60rem/1 ${fb}`, color: "rgba(255,255,255,0.52)" }}>Próx. mes</span>
                    <span style={{ font: `700 0.64rem/1 ${fd}`, color: "rgba(255,255,255,0.80)" }}>{fmt(proyeccionProximoMes)}</span>
                  </div>
                )}
              </div>
              <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 7 }}>
                {[
                  { label: "Con membresía", value: loading ? <SkelLight w="50%" h={20} r={5} /> : String(activosCount) },
                  { label: "Mensajes auto",  value: loading ? <SkelLight w="50%" h={20} r={5} /> : String(mensajesAutoEnviados) },
                  { label: "Vencen pronto", value: loading ? <SkelLight w="50%" h={20} r={5} /> : String(alerts.upcomingExpirations.length), href: "#dashboard-alertas" },
                ].map((item) => (
                  <a key={item.label} href={item.href} style={{ padding: "10px 10px 9px", borderRadius: 16, background: "rgba(0,0,0,0.18)", border: "1px solid rgba(255,255,255,0.10)", cursor: item.href ? "pointer" : "default", textDecoration: "none", color: "inherit", display: "block" }}>
                    <p style={{ font: `800 0.92rem/1 ${fd}`, marginBottom: 5, letterSpacing: "-0.03em" }}>{item.value}</p>
                    <p style={{ font: `500 0.56rem/1.3 ${fb}`, color: "rgba(255,255,255,0.60)", textTransform: "uppercase", letterSpacing: "0.09em" }}>{item.label}</p>
                  </a>
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>

      {renderQuickActions()}

      {!loading && (
        <a href="/dashboard/alumnos" style={{ ...cardBase, padding: "16px 16px", background: morososCount > 0 ? "linear-gradient(135deg, #FFF7ED 0%, #FFEDD5 100%)" : "linear-gradient(135deg, #F0FDF4 0%, #DCFCE7 100%)", border: morososCount > 0 ? "1px solid rgba(234,88,12,0.20)" : "1px solid rgba(34,197,94,0.18)", textDecoration: "none", display: "block" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
            <div style={{ width: 38, height: 38, borderRadius: 14, background: morososCount > 0 ? "rgba(234,88,12,0.12)" : "rgba(34,197,94,0.14)", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
              <CreditCard size={17} color={morososCount > 0 ? "#EA580C" : "#15803D"} />
            </div>
            <div>
              <p style={{ font: `700 0.65rem/1 ${fb}`, color: morososCount > 0 ? "#EA580C" : "#15803D", textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: 5 }}>Cuotas impagas</p>
              <p style={{ font: `700 0.9rem/1.3 ${fd}`, color: morososCount > 0 ? "#7C2D12" : "#14532D", letterSpacing: "-0.03em" }}>
                {morososCount > 0 ? `${morososCount} ${morososCount === 1 ? "alumno moroso" : "alumnos morosos"} · ${fmt(deudaTotal)} por cobrar` : "Sin deuda pendiente — todo al día ✅"}
              </p>
              <p style={{ font: `500 0.68rem/1.4 ${fb}`, color: morososCount > 0 ? "#9A3412" : "#166534", marginTop: 4 }}>
                {morososCount > 0 ? "Membresías vencidas sin pago registrado este ciclo." : "Todos los socios tienen su membresía al día."}
              </p>
            </div>
          </div>
        </a>
      )}

      {!loading && (
        <div style={{ ...cardBase, padding: "16px 16px", background: "linear-gradient(135deg, #F5F3FF 0%, #EDE9FE 100%)", border: "1px solid rgba(99,102,241,0.18)" }}>
          <p style={{ font: `700 0.65rem/1 ${fb}`, color: "#6366F1", textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: 12 }}>Lo que FitGrowX hizo por vos este mes</p>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 10 }}>
            <div style={{ padding: "10px 10px", borderRadius: 12, background: "rgba(99,102,241,0.08)" }}>
              <p style={{ font: `800 1.3rem/1 ${fd}`, color: "#4338CA", marginBottom: 4 }}>{mensajesAutoEnviados}</p>
              <p style={{ font: `500 0.64rem/1.35 ${fb}`, color: "#6366F1" }}>mensajes enviados automáticamente</p>
            </div>
            <div style={{ padding: "10px 10px", borderRadius: 12, background: "rgba(16,185,129,0.08)" }}>
              <p style={{ font: `800 1.3rem/1 ${fd}`, color: "#047857", marginBottom: 4 }}>{renovacionesCount}</p>
              <p style={{ font: `500 0.64rem/1.35 ${fb}`, color: "#059669" }}>socios que renovaron</p>
            </div>
            <div style={{ padding: "10px 10px", borderRadius: 12, background: recuperadosCount > 0 ? "rgba(34,197,94,0.12)" : "rgba(99,102,241,0.06)" }}>
              <p style={{ font: `800 1.3rem/1 ${fd}`, color: recuperadosCount > 0 ? "#14532D" : "#6366F1", marginBottom: 4 }}>{recuperadosCount > 0 ? fmt(recuperadosRevenue) : "—"}</p>
              <p style={{ font: `500 0.64rem/1.35 ${fb}`, color: recuperadosCount > 0 ? "#15803D" : "#818CF8" }}>{recuperadosCount > 0 ? `${recuperadosCount} ${recuperadosCount === 1 ? "socio recuperado" : "socios recuperados"}` : "sin recuperados aún"}</p>
            </div>
          </div>
        </div>
      )}

      {renderMetricSection("Embudo")}
      <div style={{ display: "grid", gridTemplateColumns: "1fr", gap: 12 }}>
        {renderMetricSection("Fidelización", true)}
        {renderMetricSection("Eficiencia", true)}
      </div>
      {renderPulsoPanel()}

      <div className="dash-card" style={{ ...cardBase, padding: "20px 18px", background: whitePanel }} {...cardHover}>
        <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 12, marginBottom: 18 }}>
          <div>
            <p style={{ font: `800 1rem/1 ${fd}`, color: t1, marginBottom: 5 }}>Nuevos socios por mes</p>
            <p style={{ font: `500 0.72rem/1.5 ${fb}`, color: t3 }}>Altas de los últimos 5 meses.</p>
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
                <p style={{ font: `500 0.72rem/1.5 ${fb}`, color: "rgba(255,255,255,0.78)" }}>Cuando cargues tus gastos vas a ver cuánto te quedó realmente.</p>
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
                  <p style={{ font: `500 0.7rem/1.45 ${fb}`, color: t3 }}>Últimos 14 días · prom. {asistPromedioDiario}/día operativo</p>
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
              <p style={{ font: `800 0.94rem/1 ${fd}`, color: t1, marginBottom: 4 }}>Cuándo viene la gente</p>
              <p style={{ font: `500 0.7rem/1.45 ${fb}`, color: t3, marginBottom: 16 }}>El horario con más movimiento.</p>
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
        @keyframes greetExit {
          from { opacity: 1; transform: translateY(0); }
          to   { opacity: 0; transform: translateY(-8px); }
        }
        @keyframes greetEnter {
          from { opacity: 0; transform: translateY(8px); }
          to   { opacity: 1; transform: translateY(0); }
        }
        .greet-exit    { animation: greetExit  0.5s cubic-bezier(0.4,0,1,1) forwards; }
        .greet-welcome { animation: greetEnter 0.6s cubic-bezier(0.16,1,0.3,1) both; }
        .stat-scroll::-webkit-scrollbar { display: none; }
        .stat-scroll { -ms-overflow-style: none; scrollbar-width: none; }
        @keyframes skelShimmer {
          0%   { background-position: 100% 0; }
          100% { background-position: -100% 0; }
        }
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

      {demoMode && (
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12, padding: "10px 16px", borderRadius: 14, background: "rgba(249,115,22,0.10)", border: "1.5px solid rgba(249,115,22,0.28)", flexWrap: "wrap" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <span style={{ fontSize: 16 }}>👁</span>
            <p style={{ font: `600 0.8rem/1.3 ${fd}`, color: "#C2410C" }}>
              <strong>Modo demo</strong> — estos números son de ejemplo, no son tus datos reales.
            </p>
          </div>
          <button
            onClick={exitDemo}
            style={{ padding: "6px 14px", borderRadius: 9, border: "1.5px solid rgba(249,115,22,0.35)", background: "white", color: "#C2410C", font: `700 0.75rem/1 ${fd}`, cursor: "pointer", whiteSpace: "nowrap", flexShrink: 0 }}
          >
            Volver a mis datos
          </button>
        </div>
      )}

      <div style={{ display: "flex", alignItems: "flex-end", justifyContent: "space-between", gap: 16, flexWrap: "wrap" }}>
        <div>
          <p style={{ font: `500 0.7rem/1.4 ${fm}`, color: "#8A4516", letterSpacing: "0.06em", marginBottom: 8, textTransform: "uppercase" }}>{`${gymName}`}</p>
          <h1 className={greetPhase === "exit" ? "greet-exit" : greetPhase === "welcome" ? "greet-welcome" : ""} style={{ font: `800 2rem/0.95 ${fd}`, color: t1, letterSpacing: "-0.08em", marginBottom: 8, maxWidth: 760 }}>{greetPhase === "welcome" ? `Bienvenido, ${ownerName}` : "Hola 👋"}</h1>
          <p style={{ font: `500 0.86rem/1.6 ${fb}`, color: t2, maxWidth: 720 }}>Veamos cómo va tu negocio y dónde conviene actuar primero.</p>
        </div>
        <div style={{ display: "flex", flexDirection: "column", gap: 10, alignItems: "flex-end", minWidth: 240, maxWidth: 300, width: "100%" }}>
          {renderFilters(false)}
        </div>
      </div>

      {setup && !Object.values(setup).every(Boolean) && (() => {
        const tasks: { key: keyof typeof setup; label: string; desc: string; href: string; time: string }[] = [
          { key: "alumnos",  label: "Cargá tu primer alumno", desc: "El sistema cobra vida cuando hay gente adentro",  href: "/dashboard/alumnos", time: "1 min"  },
          { key: "planes",   label: "Creá un plan",           desc: "Definí qué incluye cada membresía y su precio",   href: "/dashboard/membresias",  time: "2 min"  },
          { key: "whatsapp", label: "Conectá WhatsApp",       desc: "Recordatorios y bienvenidas automáticas",         href: "/dashboard/conexiones", time: "2 min"  },
          { key: "landing",  label: "Publicá tu landing",     desc: "Página pública para captar prospectos",           href: "/dashboard/landing", time: "3 min"  },
          { key: "pagos",    label: "Configurá pagos",        desc: "MercadoPago o datos de transferencia",            href: "/dashboard/conexiones", time: "2 min"  },
        ];
        const done      = tasks.filter(t => setup[t.key]).length;
        const nextTask  = tasks.find(t => !setup[t.key]);
        const dinoState = getDinoState(done);
        return (
          <div style={{ background: "#FFFBF6", border: "1px solid rgba(249,115,22,0.18)", borderRadius: 20, padding: "18px 20px" }}>
            <div style={{ display: "flex", alignItems: "center", gap: 14, marginBottom: 14 }}>
              <div style={{ position: "relative", flexShrink: 0 }}>
                <DinoSVG state={dinoState} pixelSize={3} />
              </div>
              <div style={{ flex: 1 }}>
                <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 5 }}>
                  <p style={{ font: `700 0.9rem/1 ${fd}`, color: t1 }}>Quick Start</p>
                  {nextTask && (
                    <span style={{ font: `600 0.68rem/1 ${fd}`, color: "#F97316", background: "rgba(249,115,22,0.10)", border: "1px solid rgba(249,115,22,0.2)", borderRadius: 999, padding: "2px 8px" }}>
                      Próximo: {nextTask.label} · {nextTask.time}
                    </span>
                  )}
                </div>
                <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                  <div style={{ flex: 1, height: 5, borderRadius: 999, background: "rgba(0,0,0,0.07)", overflow: "hidden" }}>
                    <div style={{ width: `${(done / 5) * 100}%`, height: "100%", borderRadius: 999, background: accent, transition: "width 0.4s ease" }} />
                  </div>
                  <p style={{ font: `500 0.75rem/1 ${fb}`, color: t2, whiteSpace: "nowrap" }}>{done} de 5 completados</p>
                </div>
              </div>
              {nextTask && (
                <a
                  href={nextTask.href}
                  style={{ padding: "9px 16px", borderRadius: 11, background: accent, border: "none", font: `700 0.78rem/1 ${fd}`, color: "white", cursor: "pointer", whiteSpace: "nowrap", flexShrink: 0, textDecoration: "none", display: "inline-flex", alignItems: "center", gap: 6, boxShadow: "0 4px 14px rgba(249,115,22,0.30)" }}
                >
                  Hacerlo ahora
                  <svg width="12" height="12" viewBox="0 0 12 12" fill="none"><path d="M2 6h8M6 2l4 4-4 4" stroke="white" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"/></svg>
                </a>
              )}
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(5, 1fr)", gap: 8 }}>
              {tasks.map((t, i) => {
                const isDone    = setup[t.key];
                const isNext    = !isDone && tasks.slice(0, i).every(prev => setup[prev.key]);
                return (
                  <a key={t.key} href={isDone ? undefined : t.href} style={{ textDecoration: "none", display: "block", padding: "11px 12px", borderRadius: 12, background: isDone ? "rgba(34,197,94,0.06)" : isNext ? "rgba(249,115,22,0.04)" : "white", border: `1px solid ${isDone ? "rgba(34,197,94,0.18)" : isNext ? "rgba(249,115,22,0.25)" : "rgba(0,0,0,0.07)"}`, cursor: isDone ? "default" : "pointer", transition: "box-shadow 0.15s" }}>
                    <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 7 }}>
                      <div style={{ width: 20, height: 20, borderRadius: 999, background: isDone ? "#22C55E" : isNext ? "rgba(249,115,22,0.15)" : "rgba(0,0,0,0.07)", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                        {isDone
                          ? <svg width="10" height="10" viewBox="0 0 10 10" fill="none"><path d="M2 5l2.5 2.5 4-4" stroke="white" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/></svg>
                          : isNext
                            ? <svg width="8" height="8" viewBox="0 0 8 8" fill="none"><circle cx="4" cy="4" r="3" fill="#F97316" opacity="0.7"/></svg>
                            : <svg width="8" height="8" viewBox="0 0 8 8" fill="none"><circle cx="4" cy="4" r="2.5" stroke="rgba(0,0,0,0.22)" strokeWidth="1.2"/></svg>
                        }
                      </div>
                      {!isDone && <span style={{ font: `500 0.6rem/1 ${fd}`, color: isNext ? "#F97316" : t3 }}>{t.time}</span>}
                    </div>
                    <p style={{ font: `600 0.76rem/1.3 ${fd}`, color: isDone ? "#15803D" : isNext ? "#C2410C" : t1, marginBottom: 2 }}>{t.label}</p>
                    <p style={{ font: `400 0.68rem/1.4 ${fb}`, color: t2 }}>{t.desc}</p>
                  </a>
                );
              })}
            </div>
            {!demoMode && (
              <div style={{ marginTop: 12, paddingTop: 12, borderTop: "1px solid rgba(249,115,22,0.12)", display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12, flexWrap: "wrap" }}>
                <p style={{ font: `400 0.78rem/1.4 ${fb}`, color: t2 }}>
                  ¿Querés ver cómo se vería tu dashboard con 50 alumnos?
                </p>
                <button
                  onClick={enterDemo}
                  style={{ display: "inline-flex", alignItems: "center", gap: 7, padding: "8px 16px", borderRadius: 10, border: "1.5px solid rgba(249,115,22,0.30)", background: "white", color: "#C2410C", font: `700 0.78rem/1 ${fd}`, cursor: "pointer", whiteSpace: "nowrap", flexShrink: 0 }}
                >
                  <span>👁</span> Ver demo
                </button>
              </div>
            )}
          </div>
        );
      })()}

      {ownerPhoneMissing && (
        <a
          href="/dashboard/ajustes"
          style={{
            display: "flex", alignItems: "center", gap: 12,
            padding: "12px 16px", borderRadius: 14, textDecoration: "none",
            background: "rgba(234,179,8,0.07)", border: "1px solid rgba(234,179,8,0.25)",
          }}
        >
          <span style={{ fontSize: "1rem", flexShrink: 0 }}>⚠️</span>
          <div style={{ flex: 1 }}>
            <p style={{ font: `600 0.82rem/1.3 ${fd}`, color: "#92400E", margin: 0 }}>
              Falta tu número de WhatsApp
            </p>
            <p style={{ font: `400 0.74rem/1.4 ${fb}`, color: "#B45309", margin: 0 }}>
              Sin él, las alertas de pagos, socios en riesgo y transferencias pendientes no te llegan. Agregalo en Ajustes →
            </p>
          </div>
        </a>
      )}

      {renderQuickActions()}

      <div style={{ display: "grid", gridTemplateColumns: "minmax(0, 1.55fr) minmax(320px, 1fr)", gap: 20, alignItems: "start" }}>
        <div className="dashboard-grain" style={{ borderRadius: 30, background: orangeGlow, padding: "26px 24px 24px", position: "relative", overflow: "hidden", boxShadow: "0 24px 60px rgba(255,100,0,0.28), inset 0 1px 0 rgba(255,255,255,0.22)" }}>
          <div style={{ position: "absolute", inset: 0, background: "radial-gradient(ellipse at 90% 10%, rgba(255,255,255,0.32) 0%, transparent 45%), radial-gradient(ellipse at 10% 90%, rgba(180,60,0,0.30) 0%, transparent 45%)", pointerEvents: "none" }} />
          <div style={{ position: "relative", zIndex: 1, display: "flex", flexDirection: "column", gap: 20 }}>
            <div>
              <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 16, marginBottom: 18 }}>
                <div style={{ flex: 1 }}>
                  <p style={{ font: `600 0.65rem/1 ${fb}`, color: "rgba(255,255,255,0.68)", textTransform: "uppercase", letterSpacing: "0.12em", marginBottom: 12 }}>Lo que vas a cobrar este mes</p>
                  <div style={{ display: "flex", alignItems: "baseline", gap: 8 }}>
                    {loading
                      ? <SkelLight w={200} h={54} r={12} />
                      : <span style={{ font: `800 3.4rem/0.9 ${fd}`, color: "white", letterSpacing: "-0.06em" }}>{fmt(ingresoProyectado)}</span>}
                    {!loading && <span style={{ font: `400 0.88rem/1 ${fb}`, color: "rgba(255,255,255,0.60)" }}>/ mes</span>}
                  </div>
                </div>
                <div style={{ width: 44, height: 44, borderRadius: 15, background: "rgba(0,0,0,0.18)", border: "1px solid rgba(255,255,255,0.16)", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                  <CreditCard size={18} color="rgba(255,255,255,0.92)" />
                </div>
              </div>
              <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
                <div style={{ display: "inline-flex", alignItems: "center", gap: 6, padding: "6px 11px", borderRadius: 9999, background: "rgba(0,0,0,0.18)", border: "1px solid rgba(255,255,255,0.12)" }}>
                  <ArrowUpRight size={12} color="rgba(255,255,255,0.85)" />
                  <span style={{ font: `600 0.70rem/1 ${fb}`, color: "rgba(255,255,255,0.85)" }}>Membresías vigentes</span>
                </div>
                {!loading && recaudadoEsteMes > 0 && (
                  <div style={{ display: "inline-flex", alignItems: "center", gap: 6, padding: "6px 11px", borderRadius: 9999, background: "rgba(0,0,0,0.18)", border: "1px solid rgba(255,255,255,0.12)" }}>
                    <span style={{ font: `400 0.66rem/1 ${fb}`, color: "rgba(255,255,255,0.60)" }}>Cobrado</span>
                    <span style={{ font: `700 0.70rem/1 ${fd}`, color: "white" }}>{fmt(recaudadoEsteMes)}</span>
                  </div>
                )}
                {!loading && proyeccionProximoMes > 0 && (
                  <div style={{ display: "inline-flex", alignItems: "center", gap: 6, padding: "6px 11px", borderRadius: 9999, background: "rgba(0,0,0,0.12)", border: "1px solid rgba(255,255,255,0.08)" }}>
                    <span style={{ font: `400 0.64rem/1 ${fb}`, color: "rgba(255,255,255,0.52)" }}>Próx. mes · {renovacionesPendientes} renov.</span>
                    <span style={{ font: `700 0.68rem/1 ${fd}`, color: "rgba(255,255,255,0.80)" }}>{fmt(proyeccionProximoMes)}</span>
                  </div>
                )}
              </div>
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 8 }}>
              {[
                { label: "Con membresía", value: loading ? <SkelLight w={36} h={26} r={5} /> : String(activosCount) },
                { label: "Fueron hoy",    value: loading ? <SkelLight w={36} h={26} r={5} /> : String(asistHoy) },
                { label: "Vencen pronto", value: loading ? <SkelLight w={36} h={26} r={5} /> : String(alerts.upcomingExpirations.length), href: "#dashboard-alertas" },
              ].map((item) => (
                <a key={item.label} href={item.href} style={{ padding: "13px 14px 12px", borderRadius: 18, background: "rgba(0,0,0,0.18)", border: "1px solid rgba(255,255,255,0.10)", cursor: item.href ? "pointer" : "default", textAlign: "left", textDecoration: "none", color: "inherit", display: "block", backdropFilter: "blur(8px)" }}>
                  <p style={{ font: `800 1.4rem/1 ${fd}`, color: "white", marginBottom: 6, letterSpacing: "-0.04em" }}>{item.value}</p>
                  <p style={{ font: `500 0.58rem/1.3 ${fb}`, color: "rgba(255,255,255,0.58)", textTransform: "uppercase", letterSpacing: "0.10em" }}>{item.label}</p>
                </a>
              ))}
            </div>
          </div>
        </div>

        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 18 }}>
          {renderKpiCard("Tus socios",           loading ? <Skel w={52} h={38} r={9} /> : String(activosCount),                    `${totalCount} en total`,                <Users size={17} color="#fff" />,       "ink",    undefined)}
          {renderKpiCard("Fueron hoy",            loading ? <Skel w={52} h={38} r={9} /> : String(asistHoy),                       "Personas que entrenaron hoy",           <Activity size={17} color={accentDeep} />, "orange", undefined)}
          {renderKpiCard("Sin venir en 7 días",   loading ? <Skel w={52} h={38} r={9} /> : String(alerts.inactiveCount),           "Todavía tienen membresía activa",       <UserMinus size={17} color={accentDeep} />, "soft", "#dashboard-alertas")}
          {renderKpiCard("Membresías por vencer", loading ? <Skel w={52} h={38} r={9} /> : String(alerts.upcomingExpirations.length), "Contactalos antes que venzan",      <BadgeAlert size={17} color="#fff" />,  "ink",    "#dashboard-alertas")}
          <div style={{ gridColumn: "1 / -1" }}>
            {renderKpiCard("Mensajes automáticos", loading ? <Skel w={52} h={38} r={9} /> : String(mensajesAutoEnviados), "Enviados por el sistema este mes", <Zap size={17} color={accentDeep} />, "soft", undefined)}
          </div>
        </div>
      </div>

      {!loading && (
        <a href="/dashboard/alumnos" style={{ ...cardBase, padding: "20px 22px", background: morososCount > 0 ? "linear-gradient(135deg, #FFF7ED 0%, #FFEDD5 100%)" : "linear-gradient(135deg, #F0FDF4 0%, #DCFCE7 100%)", border: morososCount > 0 ? "1px solid rgba(234,88,12,0.20)" : "1px solid rgba(34,197,94,0.18)", textDecoration: "none", display: "block" }}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 16, flexWrap: "wrap" }}>
            <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
              <div style={{ width: 44, height: 44, borderRadius: 16, background: morososCount > 0 ? "rgba(234,88,12,0.12)" : "rgba(34,197,94,0.14)", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                <CreditCard size={20} color={morososCount > 0 ? "#EA580C" : "#15803D"} />
              </div>
              <div>
                <p style={{ font: `700 0.7rem/1 ${fb}`, color: morososCount > 0 ? "#EA580C" : "#15803D", textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: 6 }}>Cuotas impagas</p>
                <p style={{ font: `800 1.1rem/1.2 ${fd}`, color: morososCount > 0 ? "#7C2D12" : "#14532D", letterSpacing: "-0.03em" }}>
                  {morososCount > 0 ? `${morososCount} ${morososCount === 1 ? "alumno moroso" : "alumnos morosos"} · ${fmt(deudaTotal)} por cobrar` : "Sin deuda pendiente — todo al día ✅"}
                </p>
              </div>
            </div>
            <p style={{ font: `500 0.76rem/1.5 ${fb}`, color: morososCount > 0 ? "#9A3412" : "#166534", maxWidth: 340 }}>
              {morososCount > 0 ? "Membresías vencidas sin pago registrado. Hacé clic para verlos." : "Todos los socios tienen su membresía al día."}
            </p>
          </div>
        </a>
      )}

      {!loading && (
        <div style={{ ...cardBase, padding: "20px 22px", background: "linear-gradient(135deg, #F5F3FF 0%, #EDE9FE 100%)", border: "1px solid rgba(99,102,241,0.18)" }}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12, marginBottom: 16, flexWrap: "wrap" }}>
            <div>
              <p style={{ font: `700 0.7rem/1 ${fb}`, color: "#6366F1", textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: 4 }}>Lo que FitGrowX hizo por vos este mes</p>
              <p style={{ font: `500 0.74rem/1.4 ${fb}`, color: "#818CF8" }}>El sistema trabajó por vos mientras te ocupabas del gym.</p>
            </div>
            <div style={{ width: 40, height: 40, borderRadius: 14, background: "rgba(99,102,241,0.12)", color: "#6366F1", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
              <Zap size={18} />
            </div>
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 12 }}>
            <div style={{ padding: "14px 14px", borderRadius: 16, background: "rgba(99,102,241,0.08)" }}>
              <p style={{ font: `800 1.6rem/1 ${fd}`, color: "#4338CA", marginBottom: 6, letterSpacing: "-0.04em" }}>{mensajesAutoEnviados}</p>
              <p style={{ font: `600 0.72rem/1.35 ${fd}`, color: "#4338CA", marginBottom: 2 }}>Mensajes enviados</p>
              <p style={{ font: `400 0.66rem/1.4 ${fb}`, color: "#818CF8" }}>recordatorios, bienvenidas y alertas automáticas</p>
            </div>
            <div style={{ padding: "14px 14px", borderRadius: 16, background: "rgba(16,185,129,0.09)" }}>
              <p style={{ font: `800 1.6rem/1 ${fd}`, color: "#047857", marginBottom: 6, letterSpacing: "-0.04em" }}>{renovacionesCount}</p>
              <p style={{ font: `600 0.72rem/1.35 ${fd}`, color: "#047857", marginBottom: 2 }}>Renovaciones</p>
              <p style={{ font: `400 0.66rem/1.4 ${fb}`, color: "#059669" }}>socios que pagaron su membresía este mes</p>
            </div>
            <div style={{ padding: "14px 14px", borderRadius: 16, background: recuperadosCount > 0 ? "rgba(34,197,94,0.10)" : "rgba(99,102,241,0.05)", border: recuperadosCount > 0 ? "1.5px solid rgba(34,197,94,0.22)" : "none" }}>
              <p style={{ font: `800 1.6rem/1 ${fd}`, color: recuperadosCount > 0 ? "#14532D" : "#A5B4FC", marginBottom: 6, letterSpacing: "-0.04em" }}>
                {recuperadosCount > 0 ? fmt(recuperadosRevenue) : "—"}
              </p>
              <p style={{ font: `600 0.72rem/1.35 ${fd}`, color: recuperadosCount > 0 ? "#14532D" : "#A5B4FC", marginBottom: 2 }}>Recuperados</p>
              <p style={{ font: `400 0.66rem/1.4 ${fb}`, color: recuperadosCount > 0 ? "#15803D" : "#C7D2FE" }}>
                {recuperadosCount > 0 ? `${recuperadosCount} ${recuperadosCount === 1 ? "socio que volvió" : "socios que volvieron"} a pagar` : "aún no hay socios recuperados"}
              </p>
            </div>
          </div>
        </div>
      )}

      {renderMetricSection("Embudo")}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(2, minmax(0, 1fr))", gap: 18 }}>
        {renderMetricSection("Fidelización", true)}
        {renderMetricSection("Eficiencia", true)}
      </div>
      {renderPulsoPanel()}

      <div style={{ display: "grid", gridTemplateColumns: "minmax(0, 1.5fr) minmax(320px, 1fr)", gap: 20 }}>
        <div style={{ ...cardBase, padding: "24px 24px 20px", background: whitePanel }} {...cardHover}>
          <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 14, marginBottom: 22 }}>
            <div>
              <p style={{ font: `800 1.02rem/1 ${fd}`, color: t1, marginBottom: 6 }}>Nuevos socios por mes</p>
              <p style={{ font: `500 0.76rem/1.5 ${fb}`, color: t3 }}>Cuántos socios nuevos entraron en los últimos 5 meses.</p>
            </div>
            <div style={{ padding: "10px 13px", borderRadius: 18, background: chipBg, color: accentDeep, display: "flex", alignItems: "center", gap: 8 }}>
              <Target size={14} />
              <span style={{ font: `700 0.74rem/1 ${fb}` }}>{loading ? "—" : `${prospectos} interesados`}</span>
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
            <p style={{ font: `500 0.76rem/1.5 ${fb}`, color: t3, marginBottom: 18 }}>Ingresos menos gastos del período.</p>
            {sinEgresos ? (
              <div style={{ padding: "18px 18px", borderRadius: 22, background: "#FFF6ED", border: "1px solid rgba(255,122,24,0.12)" }}>
                <p style={{ font: `800 2rem/0.95 ${fd}`, color: accentDeep, letterSpacing: "-0.05em", marginBottom: 8 }}>—</p>
                <p style={{ font: `500 0.76rem/1.55 ${fb}`, color: t2 }}>Cuando cargues tus gastos acá vas a ver cuánto te quedó realmente.</p>
              </div>
            ) : (
              <>
                <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 10 }}>
                  {balanceNeto >= 0 ? <ArrowUpRight size={15} color={statusPositive} /> : <ArrowDownRight size={15} color={statusNegative} />}
                  <span style={{ font: `700 0.75rem/1 ${fb}`, color: balanceNeto >= 0 ? statusPositive : statusNegative }}>{balanceNeto >= 0 ? "Superávit" : "Déficit"}</span>
                </div>
                {loading
                  ? <div style={{ marginBottom: 20 }}><Skel w={160} h={52} r={12} /></div>
                  : <p style={{ font: `800 2.8rem/0.94 ${fd}`, color: t1, letterSpacing: "-0.06em", marginBottom: 20 }}>{fmt(Math.abs(balanceNeto))}</p>}
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

      {loading && asistDiarias.length === 0 && (
        <div style={{ display: "grid", gridTemplateColumns: "minmax(0, 1.35fr) minmax(320px, 1fr)", gap: 20 }}>
          <div style={{ ...cardBase, padding: "24px 24px 20px", background: whitePanel }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 20 }}>
              <div style={{ display: "flex", flexDirection: "column", gap: 8 }}><Skel w={160} h={16} r={6} /><Skel w={200} h={12} r={5} /></div>
              <Skel w={72} h={30} r={9999} />
            </div>
            <div style={{ display: "flex", alignItems: "flex-end", gap: 6, height: 100 }}>
              {[55,70,38,85,47,65,90,42,78,60,35,82,50,68].map((h, i) => (
                <div key={i} style={{ flex: 1, display: "flex", alignItems: "flex-end", height: "100%" }}>
                  <Skel h={h} r={3} />
                </div>
              ))}
            </div>
          </div>
          <div style={{ ...cardBase, padding: "24px 22px", background: whitePanel }}>
            <div style={{ display: "flex", flexDirection: "column", gap: 8, marginBottom: 20 }}><Skel w={140} h={16} r={6} /><Skel w={180} h={12} r={5} /></div>
            <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
              {[45,70,90,60,30,85,55,75,40,65,50].map((pct, i) => (
                <div key={i} style={{ display: "flex", alignItems: "center", gap: 10 }}>
                  <Skel w={28} h={10} r={4} />
                  <div style={{ flex: 1, height: 8, borderRadius: 9999, background: "#EDF1F5", overflow: "hidden" }}>
                    <div style={{ width: `${pct}%`, height: "100%", background: "#E4E6EB", borderRadius: 9999 }} />
                  </div>
                  <Skel w={18} h={10} r={4} />
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {asistDiarias.length > 0 && (() => {
        const maxA = Math.max(...asistDiarias.map((d) => d.count), 1);
        const peakH = asistHoras.indexOf(Math.max(...asistHoras));
        return (
          <div style={{ display: "grid", gridTemplateColumns: "minmax(0, 1.35fr) minmax(320px, 1fr)", gap: 20 }}>
            <div style={{ ...cardBase, padding: "24px 24px 20px", background: whitePanel }} {...cardHover}>
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 14, marginBottom: 18 }}>
                <div>
                  <p style={{ font: `800 1.02rem/1 ${fd}`, color: t1, marginBottom: 6 }}>Asistencia diaria</p>
                  <p style={{ font: `500 0.76rem/1.5 ${fb}`, color: t3 }}>Cuánta gente entrenó cada día · prom. <strong>{asistPromedioDiario}/día</strong> (solo días operativos)</p>
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
              <p style={{ font: `800 1.02rem/1 ${fd}`, color: t1, marginBottom: 6 }}>Cuándo viene la gente</p>
              <p style={{ font: `500 0.76rem/1.5 ${fb}`, color: t3, marginBottom: 18 }}>El horario con más movimiento.</p>
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

    <OnboardingModal
      open={onboardingOpen}
      onClose={() => setOnboardingOpen(false)}
    />
    </>
  );
}
