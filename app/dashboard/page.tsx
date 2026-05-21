"use client";

import React, { useEffect, useState, useRef, useMemo, useCallback } from "react";
import {
  Users, CreditCard, Zap,
  Send, CircleHelp, BadgeAlert, Activity, Clock, UserPlus, ClipboardList, Megaphone, RefreshCw,
} from "lucide-react";
import { getCachedProfile, getPageCache, setPageCache } from "@/lib/gym-cache";
import { supabase } from "@/lib/supabase";
import { OnboardingModal } from "@/app/dashboard/components/OnboardingModal";
import { OnboardingProgress } from "@/app/dashboard/components/OnboardingProgress";
import { OnboardingMobileBanner } from "@/app/dashboard/components/OnboardingMobileBanner";
import { Suggestions } from "@/app/dashboard/components/Suggestions";
import { DinoSVG } from "@/app/dashboard/components/DinoSVG";
import { QuickActions } from "@/app/dashboard/components/QuickActions";
import { Filters } from "@/app/dashboard/components/Filters";
import { OwnerPhoneAlert } from "@/app/dashboard/components/OwnerPhoneAlert";
import { AutomationStats } from "@/app/dashboard/components/AutomationStats";
import { initials, fmt, last5Months, metricDelta, formatMetricValue, getMetricTag, buildDonutSegments, MONTH_NAMES, getDinoState } from "@/lib/dashboard-helpers";
import { DashboardMetric, DashboardAlerts, DashboardSnapshot, RecenteAlumno, PlanDist, SetupFlags } from "@/lib/dashboard-types";
import { useIsDesktop } from "@/hooks/useIsDesktop";

const accent = "#FF7A18";
const accentDeep = "#E65A00";

const PLAN_COLORS = ["#1A1D23", "#374151", "#6B7280", "#9CA3AF", "#D1D5DB", "#E5E7EB"];

// ─── Skeleton components ──────────────────────────────────────────────────────
function Skel({ w, h, r = 7 }: { w?: number | string; h: number; r?: number }) {
  return (
    <div style={{ width: w ?? "100%", height: h, borderRadius: r, flexShrink: 0, background: "linear-gradient(90deg,#ECEEF2 25%,#E4E6EB 50%,#ECEEF2 75%)", backgroundSize: "400% 100%", animation: "skelShimmer 1.6s ease infinite" }} />
  );
}
function SkelLight({ w, h, r = 7 }: { w?: number | string; h: number; r?: number }) {
  return (
    <span style={{ display: "inline-block", width: w ?? "100%", height: h, borderRadius: r, flexShrink: 0, background: "linear-gradient(90deg,rgba(255,255,255,0.15) 25%,rgba(255,255,255,0.30) 50%,rgba(255,255,255,0.15) 75%)", backgroundSize: "400% 100%", animation: "skelShimmer 1.6s ease infinite" }} />
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
    ingresos5: [420_000, 510_000, 480_000, 680_000, 847_000],
    gastos5:   [190_000, 210_000, 220_000, 260_000, 210_000],
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
  const isDesktop = useIsDesktop();
  const [ownerName, setOwnerName] = useState<string | null>(null);
  const [fetchedAt, setFetchedAt] = useState<Date | null>(null);
  const [lastCronRun, setLastCronRun] = useState<{ ran_at: string; status: string; summary: string | null } | null>(null);
  const [waStatus, setWaStatus] = useState<"active" | "disconnected" | "qr" | "unknown">("unknown");
  const [botActivity, setBotActivity] = useState<{ msgHoy: number; vencHoy: number; pagosHoyCount: number; feed: { ts: string; tipo: "wa" | "pago"; label: string; name: string }[] } | null>(null);
  const [gymName, setGymName] = useState("tu gym");
  const [greetPhase, setGreetPhase] = useState<"hola" | "exit" | "welcome">("hola");

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
  const [ingresos5,         setIngresos5]         = useState<number[]>([0, 0, 0, 0, 0]);
  const [gastos5,           setGastos5]           = useState<number[]>([0, 0, 0, 0, 0]);
  const [planDist,          setPlanDist]          = useState<PlanDist[]>([]);
  const [prospectos,        setProspectos]        = useState(0);
  const [asistDiarias,      setAsistDiarias]      = useState<{ fecha: string; count: number }[]>([]);
  const [asistHoras,        setAsistHoras]        = useState<number[]>(Array(24).fill(0));
  const [asistHoy,          setAsistHoy]          = useState(0);
  const [asistPromedioDiario, setAsistPromedioDiario] = useState(0);
  const [metrics,           setMetrics]           = useState<DashboardMetric[]>([]);
  const [alerts,            setAlerts]            = useState<DashboardAlerts>({ inactiveCount: 0, inactiveNames: [], upcomingExpirations: [] });
  const [activeInfo,        setActiveInfo]        = useState<{ title: string; body: string } | null>(null);
  const [setup, setSetup] = useState<SetupFlags | null>(null);
  const [planLabel, setPlanLabel] = useState<string | null>(null);
  const [ownerPhoneMissing, setOwnerPhoneMissing] = useState(false);
  const [onboardingOpen, setOnboardingOpen] = useState(false);
  const [demoMode, setDemoMode] = useState(false);
  const [metricSectionOpen, setMetricSectionOpen] = useState<Record<string, boolean>>({ Embudo: false, Fidelización: false, Eficiencia: false });
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
    setIngresos5(snapshot.ingresos5 ?? [0, 0, 0, 0, 0]);
    setGastos5(snapshot.gastos5 ?? [0, 0, 0, 0, 0]);
    setPlanDist(snapshot.planDist);
    setProspectos(snapshot.prospectos);
    setAsistDiarias(snapshot.asistDiarias);
    setAsistHoras(snapshot.asistHoras);
    setAsistHoy(snapshot.asistHoy);
    setAsistPromedioDiario(snapshot.asistPromedioDiario ?? 0);
    setMetrics(snapshot.metrics ?? []);
    setAlerts(snapshot.alerts ?? { inactiveCount: 0, inactiveNames: [], upcomingExpirations: [] });
  }, []);

  const realBotActivityRef = useRef<typeof botActivity>(null);

  const enterDemo = useCallback(() => {
    realSnapshotRef.current = { activosCount, totalCount, ingresoProyectado, proyeccionProximoMes, renovacionesPendientes, renovacionesCount, mensajesAutoEnviados, recuperadosCount, recuperadosRevenue, recaudadoEsteMes, deudaTotal, morososCount, gastosTotal, recientes, captacion5, ingresos5, gastos5, planDist, prospectos, asistDiarias, asistHoras, asistHoy, asistPromedioDiario, metrics, alerts };
    realBotActivityRef.current = botActivity;
    applySnapshot(buildDemoSnapshot());
    setBotActivity({
      msgHoy: 23, vencHoy: 5, pagosHoyCount: 8,
      feed: [
        { ts: new Date(Date.now() - 4 * 60000).toISOString(), tipo: "wa", label: "Recordatorio de vencimiento", name: "Valentina Ríos" },
        { ts: new Date(Date.now() - 18 * 60000).toISOString(), tipo: "pago", label: "Pago recibido", name: "Matías Fernández" },
        { ts: new Date(Date.now() - 42 * 60000).toISOString(), tipo: "wa", label: "Bienvenida enviada", name: "Luciana Herrera" },
      ],
    });
    setDemoMode(true);
  }, [activosCount, totalCount, ingresoProyectado, proyeccionProximoMes, renovacionesPendientes, renovacionesCount, mensajesAutoEnviados, recuperadosCount, recuperadosRevenue, recaudadoEsteMes, deudaTotal, morososCount, gastosTotal, recientes, captacion5, ingresos5, gastos5, planDist, prospectos, asistDiarias, asistHoras, asistHoy, asistPromedioDiario, metrics, alerts, botActivity, applySnapshot]);

  const exitDemo = useCallback(() => {
    if (realSnapshotRef.current) applySnapshot(realSnapshotRef.current);
    setBotActivity(realBotActivityRef.current);
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
    const cacheKey = `dashboard_v2_${gym_id}_${from}`;
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
      lastCronRun?: { ran_at: string; status: string; summary: string | null } | null;
      waStatus?: "active" | "disconnected" | "qr" | "unknown";
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
    setLastCronRun(payload.lastCronRun ?? null);
    if (payload.waStatus) setWaStatus(payload.waStatus);
    if (name) {
      setGreetPhase("exit");
      setTimeout(() => setGreetPhase("welcome"), 650);
    }
    const snapshot = payload.snapshot;

    applySnapshot(snapshot);
    setPageCache(cacheKey, snapshot);

    // Bot activity feed — fire and forget, doesn't block the dashboard
    fetch("/api/admin/bot-activity", { cache: "no-store" })
      .then(r => r.json())
      .then(d => { if (d.ok) setBotActivity(d); })
      .catch(() => {});

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
      const [settingsRes, alumnosRes, planesRes, profileRes, gymRes] = await Promise.all([
        supabase.from("gym_settings").select("whatsapp_connected, slug, mp_access_token, payment_info, onboarding_completed").eq("gym_id", profile.gymId).maybeSingle(),
        supabase.from("alumnos").select("id", { count: "exact", head: true }).eq("gym_id", profile.gymId).is("deleted_at", null),
        supabase.from("planes").select("id", { count: "exact", head: true }).eq("gym_id", profile.gymId),
        supabase.from("profiles").select("phone").eq("id", profile.userId).maybeSingle(),
        supabase.from("gyms").select("is_subscription_active, plan_type, trial_expires_at").eq("id", profile.gymId).maybeSingle(),
      ]);
      setOwnerPhoneMissing(!profileRes.data?.phone);
      const gym = gymRes.data as { is_subscription_active: boolean; plan_type: string | null; trial_expires_at: string | null } | null;
      if (gym) {
        const subscribed = Boolean(gym.is_subscription_active);
        if (subscribed) {
          const raw = gym.plan_type;
          setPlanLabel(raw ? raw.charAt(0).toUpperCase() + raw.slice(1).toLowerCase() : "Pro");
        } else if (gym.trial_expires_at) {
          const expired = new Date(gym.trial_expires_at).getTime() < Date.now();
          setPlanLabel(expired ? null : "Trial");
        }
      }
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
      if (!allDone && !localStorage.getItem("onboarding_dismissed")) setOnboardingOpen(true);
      if (allDone && !s?.onboarding_completed && profile.gymId) {
        void supabase.from("gym_settings").update({ onboarding_completed: true }).eq("gym_id", profile.gymId);
      }
    }
    void loadSetup();
  }, []);

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      const tag = (e.target as HTMLElement).tagName;
      if (tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT" || (e.target as HTMLElement).isContentEditable) return;
      if (e.key === "a" || e.key === "A") window.location.href = "/dashboard/alumnos";
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, []);

  const sinEgresos  = gastosTotal === 0;
  const balanceNeto = sinEgresos ? ingresoProyectado : ingresoProyectado - gastosTotal;
  const hasCapt     = captacion5.some(v => v > 0);

  const hour = useMemo(() => new Date().getHours(), []);
  const greeting = useMemo(() => {
    if (hour >= 6 && hour < 12) return "Buenos días";
    if (hour >= 12 && hour < 20) return "Buenas tardes";
    return "Buenas noches";
  }, [hour]);

  const quickActions = useMemo(() => {
    if (hour >= 6 && hour < 10) return [
      { emoji: "✅", label: "Asistencia de hoy", hint: asistHoy > 0 ? `${asistHoy} registradas` : "Sin registros aún", href: "/dashboard/asistencias" },
      { emoji: "📋", label: "Tomar asistencia", hint: "Manual o QR", href: "/dashboard/scanner" },
      { emoji: "⏰", label: alerts.upcomingExpirations.length > 0 ? `${alerts.upcomingExpirations.length} socios por vencer` : "Sin vencimientos hoy", hint: alerts.upcomingExpirations.length > 0 ? "Avisales antes de que venza" : "Todo al día", href: "/dashboard/alumnos" },
    ];
    if (hour >= 10 && hour < 14) return [
      { emoji: "💳", label: "Registrar un pago", hint: "Cobrar la cuota de un socio", href: "/dashboard/pagos" },
      { emoji: "⏰", label: alerts.upcomingExpirations.length > 0 ? `${alerts.upcomingExpirations.length} por vencer` : "Sin vencimientos hoy", hint: alerts.upcomingExpirations.length > 0 ? "Contactar para que renueven" : "Todo al día", href: "/dashboard/alumnos" },
      { emoji: "👤", label: "Agregar alumno", hint: "Sumarlo al sistema", href: "/dashboard/alumnos" },
    ];
    if (hour >= 14 && hour < 19) return [
      { emoji: "🎯", label: prospectos > 0 ? `${prospectos} prospectos` : "Ver prospectos", hint: prospectos > 0 ? "Pendientes de contacto" : "Sin prospectos nuevos", href: "/dashboard/prospectos" },
      { emoji: "👤", label: "Agregar alumno", hint: "Sumarlo al sistema", href: "/dashboard/alumnos" },
      { emoji: "💳", label: "Registrar un pago", hint: "Cobrar la cuota de un socio", href: "/dashboard/pagos" },
    ];
    return [
      { emoji: "📊", label: `${asistHoy} asistencias hoy`, hint: "Resumen del día", href: "/dashboard/asistencias" },
      { emoji: "📝", label: "Cargar egreso", hint: "Registrar gasto del día", href: "/dashboard/egresos" },
      { emoji: "⏰", label: alerts.upcomingExpirations.length > 0 ? `${alerts.upcomingExpirations.length} vencen pronto` : "Sin vencimientos pronto", hint: alerts.upcomingExpirations.length > 0 ? "Para mañana: contactar" : "Todo al día", href: "/dashboard/alumnos" },
    ];
  }, [hour, asistHoy, alerts.upcomingExpirations.length, prospectos]);

  // QuickActions moved to /app/dashboard/components/QuickActions.tsx

  const donutSlices    = planDist.map((p, i) => ({ value: p.count, color: PLAN_COLORS[i % PLAN_COLORS.length] }));
  const donutSegments  = buildDonutSegments(donutSlices);
  const totalDonut     = planDist.reduce((s, p) => s + p.count, 0);

  const pageShell: React.CSSProperties = {
    display: "flex",
    flexDirection: "column",
    gap: isDesktop ? 22 : 16,
    padding: isDesktop ? "4px 0 8px" : "4px 0 0",
    position: "relative",
  };

  const orangeGlow = "linear-gradient(135deg, rgba(255,122,24,0.98) 0%, rgba(255,154,61,0.94) 46%, rgba(230,90,0,0.96) 100%)";
  const shellBg = "linear-gradient(180deg, #FFFDF9 0%, #FFF7EF 100%)";
  const chipBg = "rgba(255,122,24,0.10)";
  const softBorder = "1px solid rgba(17,24,39,0.06)";
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

  const waBadge = (() => {
    if (waStatus === "active")       return { text: "WhatsApp", color: "#16A34A", bg: "rgba(22,163,74,0.07)",   border: "rgba(22,163,74,0.18)",   dot: "#16A34A", href: null };
    if (waStatus === "qr")           return { text: "WA: escanear QR", color: "#D97706", bg: "rgba(217,119,6,0.07)", border: "rgba(217,119,6,0.25)", dot: "#D97706", href: "/dashboard/conexiones" };
    if (waStatus === "disconnected") return { text: "WA desconectado", color: "#DC2626", bg: "rgba(220,38,38,0.07)",  border: "rgba(220,38,38,0.18)",  dot: "#DC2626", href: "/dashboard/conexiones" };
    return null;
  })();

  const cronSyncLabel = (() => {
    if (!lastCronRun) return { text: "Sin sincronización registrada", stale: true };
    const diffH = (Date.now() - new Date(lastCronRun.ran_at).getTime()) / 3_600_000;
    const diffMin = Math.floor(diffH * 60);
    const timeAgo = diffMin < 60
      ? `hace ${diffMin} min`
      : diffH < 24
        ? `hace ${Math.floor(diffH)}h`
        : `hace ${Math.floor(diffH / 24)}d`;
    const stale = lastCronRun.status === "error" || diffH > 26;
    return { text: `Sincronizado ${timeAgo}`, stale };
  })();

  // Filters moved to /app/dashboard/components/Filters.tsx

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
        className="dashboard-card" style={{ padding: isDesktop ? "20px 18px" : "18px 16px", cursor: href ? "pointer" : "default", display: "flex", flexDirection: "column", textDecoration: "none", color: "inherit" }}
        
      >
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10, marginBottom: 14 }}>
          <span style={{ font: `600 0.615rem/1 var(--font-family-body)`, color: "var(--color-text-3)", textTransform: "uppercase", letterSpacing: "0.12em" }}>{label}</span>
          <div style={{ width: 26, height: 26, borderRadius: 7, background: iconBg, color: iconColor, display: "flex", alignItems: "center", justifyContent: "center" }}>
            {icon}
          </div>
        </div>
        <div style={{ display: "flex", alignItems: "baseline", gap: 6, marginBottom: 8 }}>
          <span style={{ font: `600 ${isDesktop ? "1.875rem" : "1.55rem"}/1 var(--font-family-display)`, color: "var(--color-text-1)", letterSpacing: "-0.025em" }}>{value}</span>
        </div>
        <p style={{ font: `400 0.72rem/1.4 var(--font-family-display)`, color: "var(--color-text-2)", marginTop: "auto" }}>{hint}</p>
      </a>
    );
  };

  const renderMetricInfo = (metric: DashboardMetric) => (
    <div
      style={{ position: "relative", display: "inline-flex" }}
      onMouseEnter={() => { if (isDesktop) setActiveInfo({ title: metric.label, body: metric.tooltip }); }}
      onMouseLeave={() => { if (isDesktop) setActiveInfo(null); }}
    >
      <button
        onClick={() => { if (!isDesktop) setActiveInfo({ title: metric.label, body: metric.tooltip }); }}
        style={{ width: 22, height: 22, borderRadius: "50%", border: "1px solid rgba(17,24,39,0.08)", background: "#FFFFFF", color: "var(--color-text-3)", display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer", padding: 0 }}
      >
        <CircleHelp size={13} />
      </button>
      {isDesktop && activeInfo?.title === metric.label && (
        <div style={{ position: "absolute", left: "50%", bottom: "calc(100% + 8px)", transform: "translateX(-50%)", width: 220, padding: "10px 12px", borderRadius: 14, background: "#17181B", color: "white", boxShadow: "0 20px 40px rgba(0,0,0,0.18)", zIndex: 20 }}>
          <p style={{ font: `700 0.72rem/1 var(--font-family-display)`, marginBottom: 5 }}>{metric.label}</p>
          <p style={{ font: `500 0.68rem/1.45 var(--font-family-display)`, color: "rgba(255,255,255,0.75)" }}>{metric.tooltip}</p>
        </div>
      )}
    </div>
  );

  const renderMetricCell = (metric: DashboardMetric, idx: number, showStep: boolean, isLast: boolean) => {
    const delta = metricDelta(metric.value, metric.previous);
    const isPositive = metric.key === "cac" ? (delta ?? 0) <= 0 : metric.key === "churn" ? (delta ?? 0) <= 0 : (delta ?? 0) >= 0;
    const tag = getMetricTag(metric);
    const deltaText = delta == null ? "Sin datos" : delta === 0 ? "Sin cambios" : `${delta > 0 ? "▲" : "▼"} ${Math.abs(delta).toFixed(1)}%`;
    const deltaColor = delta == null ? "var(--color-text-3)" : delta === 0 ? "var(--color-text-3)" : isPositive ? statusPositive : statusNegative;
    return (
      <div key={metric.key} style={{ padding: isDesktop ? "18px 20px" : "14px 12px", display: "flex", flexDirection: "column", gap: 10, position: "relative" }}>
        {showStep && <span style={{ font: `500 0.62rem/1 var(--font-family-body)`, color: "var(--color-text-3)", letterSpacing: "0.06em" }}>0{idx + 1}</span>}
        <div>
          <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 10 }}>
            <p style={{ font: `600 0.64rem/1 var(--font-family-body)`, color: "var(--color-text-3)", textTransform: "uppercase", letterSpacing: "0.12em" }}>{metric.label}</p>
            {metric.tooltip && renderMetricInfo(metric)}
          </div>
          <p style={{ font: `700 ${isDesktop ? "1.75rem" : "1.4rem"}/0.94 var(--font-family-display)`, color: "var(--color-text-1)", letterSpacing: "-0.04em" }}>{formatMetricValue(metric)}</p>
        </div>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8, marginTop: "auto" }}>
          <span style={{ font: `700 0.62rem/1 var(--font-family-body)`, letterSpacing: "0.07em", padding: "4px 8px", borderRadius: 6, background: tag.green ? "rgba(22,163,74,0.10)" : "rgba(255,122,24,0.10)", color: tag.green ? "#15803D" : accentDeep }}>
            {tag.label}
          </span>
          <span style={{ font: `500 0.68rem/1 var(--font-family-display)`, color: deltaColor, whiteSpace: "nowrap" }}>{deltaText}</span>
        </div>
        {!isLast && isDesktop && (
          <div style={{ position: "absolute", right: 0, top: 0, bottom: 0, width: 1, background: "rgba(15,17,21,0.07)" }} />
        )}
      </div>
    );
  };

  const renderMetricSection = (section: DashboardMetric["section"]) => {
    const sectionMetrics = metrics.filter((m) => m.section === section);
    const isEmbudo = section === "Embudo";
    const isFidel  = section === "Fidelización";
    const cols = isEmbudo ? (isDesktop ? 2 : 1) : (isDesktop ? 3 : 1);
    const Icon = isEmbudo ? Megaphone : Zap;
    const iconColor = isEmbudo ? accentDeep : isFidel ? "#16A34A" : "#6366F1";
    const iconBg   = isEmbudo ? "rgba(255,122,24,0.10)" : isFidel ? "rgba(22,163,74,0.10)" : "rgba(111,99,232,0.10)";
    const title    = isEmbudo ? "Captación de socios" : isFidel ? "Retención" : "Eficiencia";
    const subtitle = isEmbudo ? "Personas que llegaron y cuántas terminaron pagando" : isFidel ? "Quiénes renuevan y quiénes se van" : "Rendimiento del negocio";

    const isOpen = metricSectionOpen[section] ?? true;
    return (
      <section className="dashboard-card" style={{ overflow: "hidden" }}>
        {/* Header */}
        <button
          onClick={() => setMetricSectionOpen(prev => ({ ...prev, [section]: !prev[section] }))}
          style={{ width: "100%", display: "flex", alignItems: "center", gap: 10, padding: isDesktop ? "16px 20px 14px" : "14px 16px 12px", borderBottom: "1px solid rgba(15,17,21,0.07)", background: "none", border: "none", cursor: "pointer", textAlign: "left" }}
        >
          <div style={{ width: 28, height: 28, borderRadius: 8, background: iconBg, color: iconColor, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
            <Icon size={14} />
          </div>
          <p style={{ font: `700 0.9rem/1 var(--font-family-display)`, color: "var(--color-text-1)" }}>{title}</p>
          {isEmbudo && prospectos > 0 && (
            <span style={{ font: `600 0.62rem/1 var(--font-family-body)`, color: accentDeep, background: "rgba(255,122,24,0.08)", border: "1px solid rgba(255,122,24,0.18)", borderRadius: 9999, padding: "3px 8px", whiteSpace: "nowrap" }}>
              ● {prospectos} lead{prospectos === 1 ? "" : "s"} activo{prospectos === 1 ? "" : "s"}
            </span>
          )}
          <span style={{ font: `400 0.74rem/1 var(--font-family-display)`, color: "var(--color-text-3)", marginLeft: "auto", whiteSpace: "nowrap" }}>{subtitle}</span>
          <span style={{ font: `400 1rem/1 var(--font-family-display)`, color: "var(--color-text-3)", transform: isOpen ? "rotate(180deg)" : "none", transition: "transform 0.2s", flexShrink: 0 }}>⌄</span>
        </button>
        {/* Grid */}
        {isOpen && (
          <>
            {loading && sectionMetrics.length === 0 ? (
              <div style={{ display: "grid", gridTemplateColumns: `repeat(${cols}, 1fr)` }}>
                {Array(cols * (isEmbudo ? 2 : 1)).fill(null).map((_, i) => (
                  <div key={i} style={{ padding: "18px 20px", display: "flex", flexDirection: "column", gap: 10 }}>
                    <Skel w="30%" h={9} r={4} />
                    <Skel w="55%" h={10} r={4} />
                    <Skel w="40%" h={28} r={7} />
                    <div style={{ display: "flex", justifyContent: "space-between" }}>
                      <Skel w={64} h={22} r={6} />
                      <Skel w={72} h={10} r={4} />
                    </div>
                  </div>
                ))}
              </div>
            ) : sectionMetrics.length === 0 ? (
              <div style={{ padding: "22px 20px", display: "grid", gridTemplateColumns: `repeat(${cols}, 1fr)` }}>
                {Array(cols).fill(null).map((_, i) => (
                  <div key={i} style={{ padding: "14px 20px", display: "flex", flexDirection: "column", gap: 8, opacity: 0.45 }}>
                    <Skel w="40%" h={8} r={4} />
                    <Skel w="30%" h={28} r={7} />
                    <Skel w="55%" h={8} r={4} />
                  </div>
                ))}
              </div>
            ) : (
              <div style={{ display: "grid", gridTemplateColumns: `repeat(${cols}, 1fr)` }}>
                {sectionMetrics.map((m, i) => {
                  const isRowLast = (i + 1) % cols === 0 || i === sectionMetrics.length - 1;
                  const isLastRow = i >= sectionMetrics.length - cols;
                  return (
                    <React.Fragment key={m.key}>
                      <div style={{ borderBottom: !isLastRow && isDesktop ? "1px solid rgba(15,17,21,0.07)" : "none" }}>
                        {renderMetricCell(m, i, isEmbudo, isRowLast)}
                      </div>
                    </React.Fragment>
                  );
                })}
              </div>
            )}
          </>
        )}
      </section>
    );
  };

  const renderPulsoPanel = () => {
    const now = Date.now();
    const relDate = (iso: string) => {
      const d = new Date(iso);
      const diff = Math.floor((now - d.getTime()) / 86400000);
      if (diff === 0) return `HOY · ${d.toLocaleTimeString("es-AR", { hour: "2-digit", minute: "2-digit" })}`;
      if (diff === 1) return "AYER";
      return `${diff} DÍAS`;
    };
    const AVATAR_COLORS = ["#FF7A18","#6366F1","#10B981","#F59E0B","#EC4899","#3B82F6"];

    return (
      <>
        {/* Últimas altas */}
        <section className="dashboard-card" style={{ overflow: "hidden" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 10, padding: "16px 20px", borderBottom: "1px solid rgba(15,17,21,0.07)" }}>
            <div style={{ width: 26, height: 26, borderRadius: 8, background: "rgba(99,102,241,0.10)", color: "#6366F1", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
              <Users size={13} />
            </div>
            <p style={{ font: `700 0.9rem/1 var(--font-family-display)`, color: "var(--color-text-1)" }}>Últimas altas</p>
            {recientes.length > 0 && (
              <span style={{ font: `600 0.62rem/1 var(--font-family-body)`, color: statusPositive, background: "rgba(22,163,74,0.08)", border: "1px solid rgba(22,163,74,0.18)", borderRadius: 9999, padding: "3px 8px" }}>
                ● +{recientes.length}
              </span>
            )}
            <a href="/dashboard/alumnos" style={{ font: `500 0.74rem/1 var(--font-family-display)`, color: "var(--color-text-3)", textDecoration: "none", marginLeft: "auto" }}>Ver todo →</a>
          </div>
          <div style={{ display: "flex", flexDirection: "column" }}>
            {recientes.length > 0 ? recientes.slice(0, 5).map((r, i) => (
              <div key={r.id} style={{ display: "flex", alignItems: "center", gap: 12, padding: "13px 20px", borderBottom: i < Math.min(recientes.length, 5) - 1 ? "1px solid rgba(15,17,21,0.06)" : "none" }}>
                <div style={{ width: 36, height: 36, borderRadius: 10, background: AVATAR_COLORS[i % AVATAR_COLORS.length], display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                  <span style={{ font: `700 0.7rem/1 var(--font-family-display)`, color: "white" }}>{initials(r.full_name)}</span>
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <p style={{ font: `600 0.84rem/1 var(--font-family-display)`, color: "var(--color-text-1)", marginBottom: 4 }}>{r.full_name}</p>
                </div>
                <span style={{ font: `500 0.65rem/1 var(--font-family-body)`, color: "var(--color-text-3)", flexShrink: 0, letterSpacing: "0.04em" }}>{relDate(r.created_at)}</span>
              </div>
            )) : (
              <p style={{ font: `500 0.74rem/1.5 var(--font-family-display)`, color: "var(--color-text-3)", padding: "16px 20px" }}>Todavía no hay socios registrados.</p>
            )}
          </div>
        </section>

        {/* Bot de WhatsApp */}
        <section className="dashboard-card" style={{ overflow: "hidden" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 10, padding: "16px 20px", borderBottom: "1px solid rgba(15,17,21,0.07)", flexWrap: isDesktop ? "nowrap" : "wrap" }}>
            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <div style={{ width: 26, height: 26, borderRadius: 8, background: "rgba(37,211,102,0.10)", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                <Send size={12} color="#16A34A" />
              </div>
              <p style={{ font: `700 0.9rem/1 var(--font-family-display)`, color: "var(--color-text-1)", margin: 0 }}>Bot de WhatsApp</p>
              <span style={{ font: `600 0.62rem/1 var(--font-family-body)`, color: "#16A34A", background: "rgba(22,163,74,0.08)", border: "1px solid rgba(22,163,74,0.18)", borderRadius: 9999, padding: "3px 8px", flexShrink: 0 }}>● activo</span>
            </div>
            <span style={{ font: `400 0.74rem/1 var(--font-family-display)`, color: "var(--color-text-3)", marginLeft: "auto" }}>Lo que mandó hoy</span>
          </div>
          <div style={{ padding: "16px 20px", display: "flex", flexDirection: "column", gap: 12 }}>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 10 }}>
              <div style={{ padding: "12px 14px", borderRadius: 10, background: "rgba(99,102,241,0.07)" }}>
                <p style={{ font: `700 1.5rem/1 var(--font-family-display)`, color: "#4338CA", marginBottom: 6, letterSpacing: "-0.04em" }}>{botActivity?.msgHoy ?? "0"}</p>
                <p style={{ font: `600 0.6rem/1 var(--font-family-body)`, color: "#6366F1", letterSpacing: "0.08em" }}>MENSAJES HOY</p>
              </div>
              <div style={{ padding: "12px 14px", borderRadius: 10, background: "rgba(249,115,22,0.07)" }}>
                <p style={{ font: `700 1.5rem/1 var(--font-family-display)`, color: accentDeep, marginBottom: 6, letterSpacing: "-0.04em" }}>{botActivity?.vencHoy ?? "0"}</p>
                <p style={{ font: `600 0.6rem/1 var(--font-family-body)`, color: accentDeep, letterSpacing: "0.08em" }}>VENCEN HOY</p>
              </div>
              <div style={{ padding: "12px 14px", borderRadius: 10, background: "rgba(22,163,74,0.07)" }}>
                <p style={{ font: `700 1.5rem/1 var(--font-family-display)`, color: "#15803D", marginBottom: 6, letterSpacing: "-0.04em" }}>{botActivity?.pagosHoyCount ?? "0"}</p>
                <p style={{ font: `600 0.6rem/1 var(--font-family-body)`, color: "#16A34A", letterSpacing: "0.08em" }}>PAGOS HOY</p>
              </div>
            </div>
            <div style={{ display: "flex", alignItems: "center", gap: 8, padding: "10px 12px", borderRadius: 10, background: "rgba(15,17,21,0.03)", border: "1px solid rgba(15,17,21,0.06)" }}>
              <Clock size={13} color={"var(--color-text-3)"} />
              <span style={{ font: `400 0.74rem/1 var(--font-family-display)`, color: "var(--color-text-2)" }}>
                {botActivity && botActivity.feed.length > 0
                  ? <>Último envío: <strong style={{ font: `600 0.74rem/1 var(--font-family-body)`, color: "var(--color-text-1)" }}>{new Date(botActivity.feed[0].ts).toLocaleTimeString("es-AR", { hour: "2-digit", minute: "2-digit" })} · {botActivity.feed[0].label}</strong></>
                  : <span style={{ color: "var(--color-text-3)" }}>Sin actividad hoy todavía</span>
                }
              </span>
            </div>
          </div>
        </section>
      </>
    );
  };

  const renderAutomationStats = () => {
    if (loading) return null;
    return (
      <AutomationStats mensajesAutoEnviados={mensajesAutoEnviados} renovacionesCount={renovacionesCount} recuperadosCount={recuperadosCount} recuperadosRevenue={recuperadosRevenue} selectedMonth={selectedMonth} />
    );
  };

  /* ─────────── MOBILE LAYOUT ─────────── */
  if (!isDesktop) return (
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
          <div style={{ display: "flex", alignItems: "center", gap: 7, marginBottom: 8 }}>
            <p style={{ font: `500 0.66rem/1.4 var(--font-family-body)`, color: "#7A3E13", letterSpacing: "0.06em", textTransform: "uppercase" }}>{gymName}</p>
            {planLabel && <span style={{ font: `600 0.6rem/1 var(--font-family-body)`, color: planLabel === "Trial" ? "#D97706" : "#16A34A", background: planLabel === "Trial" ? "rgba(217,119,6,0.12)" : "rgba(22,163,74,0.12)", border: `1px solid ${planLabel === "Trial" ? "rgba(217,119,6,0.25)" : "rgba(22,163,74,0.25)"}`, borderRadius: 9999, padding: "2px 7px", textTransform: "uppercase", letterSpacing: "0.06em" }}>{planLabel}</span>}
          </div>
          <h1 className={greetPhase === "exit" ? "greet-exit" : greetPhase === "welcome" ? "greet-welcome" : ""} style={{ font: `800 1.45rem/1.02 var(--font-family-display)`, color: "var(--color-text-1)", letterSpacing: "-0.06em", marginBottom: 8 }}>{greetPhase === "welcome" ? `Bienvenido, ${ownerName}.` : ownerName ? `${greeting}, ${ownerName}.` : `${greeting}.`}</h1>
          <p style={{ font: `500 0.8rem/1.55 var(--font-family-display)`, color: "var(--color-text-2)", marginBottom: 16 }}>Veamos cómo va tu negocio hoy.</p>
          <Filters compact selectedMonth={selectedMonth} isCurrentMonth={isCurrentMonth} fetchedAtLabel={fetchedAtLabel} waBadge={waBadge} cronSyncLabel={cronSyncLabel} lastCronRun={lastCronRun} onPrevMonth={() => setSelectedMonth(m => new Date(m.getFullYear(), m.getMonth() - 1, 1))} onNextMonth={() => setSelectedMonth(m => new Date(m.getFullYear(), m.getMonth() + 1, 1))} />

          {!loading && (
            <OnboardingMobileBanner demoMode={demoMode} setup={setup} onOpenModal={() => setOnboardingOpen(true)} />
          )}

          <div style={{ marginTop: 16, padding: "18px 16px 16px", borderRadius: 16, background: "linear-gradient(135deg, #1A1D24 0%, #0E0F12 100%)", color: "white", border: "1px solid rgba(255,255,255,0.06)", boxShadow: "0 1px 0 rgba(15,17,21,0.04), 0 2px 8px rgba(15,17,21,0.05)" }}>
            <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 10, marginBottom: 14 }}>
              <div>
                <span style={{ font: `500 0.59rem/1 var(--font-family-body)`, color: "#6B7280", textTransform: "uppercase", letterSpacing: "0.11em", display: "block", marginBottom: 10 }}>A cobrar este mes</span>
                <div style={{ display: "flex", alignItems: "baseline", gap: 6 }}>
                  {loading
                    ? <SkelLight w={140} h={36} r={10} />
                    : <span style={{ font: `600 2.1rem/0.92 var(--font-family-display)`, color: "#F9FAFB", letterSpacing: "-0.05em" }}>{fmt(ingresoProyectado)}</span>}
                  {!loading && <span style={{ font: `400 0.74rem/1 var(--font-family-display)`, color: "rgba(255,255,255,0.38)" }}>/ mes</span>}
                </div>
              </div>
              <div style={{ width: 34, height: 34, borderRadius: 10, background: "rgba(255,255,255,0.06)", border: "1px solid rgba(255,255,255,0.08)", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                <CreditCard size={15} color="rgba(255,255,255,0.65)" />
              </div>
            </div>
            <div style={{ display: "flex", alignItems: "center", gap: 6, flexWrap: "wrap", marginBottom: 14 }}>
              {!loading && recaudadoEsteMes > 0 && (
                <div style={{ display: "inline-flex", alignItems: "center", gap: 5, padding: "5px 10px", borderRadius: 9999, background: "rgba(255,255,255,0.06)", border: "1px solid rgba(255,255,255,0.08)" }}>
                  <span style={{ font: `400 0.62rem/1 var(--font-family-display)`, color: "rgba(255,255,255,0.42)" }}>Cobrado</span>
                  <span style={{ font: `600 0.66rem/1 var(--font-family-body)`, color: "rgba(255,255,255,0.78)" }}>{fmt(recaudadoEsteMes)}</span>
                </div>
              )}
              {!loading && proyeccionProximoMes > 0 && (
                <div style={{ display: "inline-flex", alignItems: "center", gap: 5, padding: "5px 10px", borderRadius: 9999, background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.06)" }}>
                  <span style={{ font: `400 0.60rem/1 var(--font-family-display)`, color: "rgba(255,255,255,0.36)" }}>Próx. mes</span>
                  <span style={{ font: `600 0.64rem/1 var(--font-family-body)`, color: "rgba(255,255,255,0.60)" }}>{fmt(proyeccionProximoMes)}</span>
                </div>
              )}
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 7 }}>
              {[
                { label: "Con membresía", value: loading ? <SkelLight w="50%" h={20} r={5} /> : String(activosCount) },
                { label: "Fueron hoy",    value: loading ? <SkelLight w="50%" h={20} r={5} /> : String(asistHoy) },
                { label: "Vencen pronto", value: loading ? <SkelLight w="50%" h={20} r={5} /> : String(alerts.upcomingExpirations.length), href: "/dashboard/alumnos" },
              ].map((item) => (
                <a key={item.label} href={item.href} style={{ padding: "10px 10px 9px", borderRadius: 12, background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.07)", cursor: item.href ? "pointer" : "default", textDecoration: "none", color: "inherit", display: "block" }}>
                  <p style={{ font: `600 0.92rem/1 var(--font-family-body)`, marginBottom: 5, letterSpacing: "-0.02em", color: "#F9FAFB" }}>{item.value}</p>
                  <p style={{ font: `500 0.55rem/1.3 var(--font-family-display)`, color: "rgba(255,255,255,0.42)", textTransform: "uppercase", letterSpacing: "0.09em" }}>{item.label}</p>
                </a>
              ))}
            </div>
          </div>
        </div>
      </div>

      <QuickActions asistHoy={asistHoy} alerts={alerts} accentDeep={accentDeep} />

      {!loading && (
        <a href="/dashboard/alumnos" className="dashboard-card" style={{ padding: "16px 16px", background: morososCount > 0 ? "linear-gradient(135deg, #FFF7ED 0%, #FFEDD5 100%)" : "linear-gradient(135deg, #F0FDF4 0%, #DCFCE7 100%)", border: morososCount > 0 ? "1px solid rgba(234,88,12,0.20)" : "1px solid rgba(34,197,94,0.18)", textDecoration: "none", display: "block" }} >
          <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
            <div style={{ width: 38, height: 38, borderRadius: 14, background: morososCount > 0 ? "rgba(234,88,12,0.12)" : "rgba(34,197,94,0.14)", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
              <CreditCard size={17} color={morososCount > 0 ? "#EA580C" : "#15803D"} />
            </div>
            <div>
              <p style={{ font: `700 0.65rem/1 var(--font-family-display)`, color: morososCount > 0 ? "#EA580C" : "#15803D", textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: 5 }}>Cuotas impagas</p>
              <p style={{ font: `700 0.9rem/1.3 var(--font-family-display)`, color: morososCount > 0 ? "#7C2D12" : "#14532D", letterSpacing: "-0.03em" }}>
                {morososCount > 0 ? `${morososCount} ${morososCount === 1 ? "alumno moroso" : "alumnos morosos"} · ${fmt(deudaTotal)} por cobrar` : "Sin deuda pendiente — todo al día ✅"}
              </p>
              <p style={{ font: `500 0.68rem/1.4 var(--font-family-display)`, color: morososCount > 0 ? "#9A3412" : "#166534", marginTop: 4 }}>
                {morososCount > 0 ? "Todavía no cobraste. Tocá para ver quiénes son." : "Todos los socios están al día. 🟢"}
              </p>
            </div>
          </div>
        </a>
      )}

      {renderPulsoPanel()}

      {renderAutomationStats()}

      {renderMetricSection("Embudo")}
      {renderMetricSection("Fidelización")}
      {renderMetricSection("Eficiencia")}

      {/* Nuevos socios – mobile */}
      <div className="dash-card dashboard-card" style={{ padding: "18px 16px", background: "#FFFFFF" }} >
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10, marginBottom: 14 }}>
          <p style={{ font: `700 0.94rem/1 var(--font-family-display)`, color: "var(--color-text-1)" }}>Nuevos socios por mes</p>
          <span style={{ font: `600 0.62rem/1 var(--font-family-body)`, color: "#16A34A", background: "rgba(22,163,74,0.09)", borderRadius: 9999, padding: "4px 8px" }}>● +{captacion5[captacion5.length - 1]} este mes</span>
        </div>
        {(() => {
          const H = 110, W = 400, padT = 20, padB = 14;
          const drawH = H - padT - padB;
          const max = Math.max(...captacion5, 1);
          const meta = Math.round(captacion5.reduce((s, v) => s + v, 0) / captacion5.length * 1.2) || 6;
          const metaY = padT + drawH - (meta / max) * drawH;
          const pts = captacion5.map((v, i) => ({
            x: captacion5.length > 1 ? (i / (captacion5.length - 1)) * W : W / 2,
            y: padT + drawH - (v / max) * drawH,
            v,
          }));
          const area = `M${pts[0].x},${H - padB} ` + pts.map(p => `L${p.x},${p.y}`).join(" ") + ` L${pts[pts.length - 1].x},${H - padB} Z`;
          const line = `M${pts[0].x},${pts[0].y} ` + pts.slice(1).map(p => `L${p.x},${p.y}`).join(" ");
          return (
            <svg width="100%" height={H} viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="none">
              <defs>
                <linearGradient id="captGradM" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor={accent} stopOpacity="0.18" />
                  <stop offset="100%" stopColor={accent} stopOpacity="0" />
                </linearGradient>
              </defs>
              {[padT + drawH * 0.5].map((y) => <line key={y} x1="0" y1={y} x2={W} y2={y} stroke="#F1F5F9" strokeWidth="1" />)}
              <line x1="0" y1={metaY} x2={W} y2={metaY} stroke="#CBD5E1" strokeWidth="1" strokeDasharray="5 4" />
              {hasCapt ? (
                <>
                  <path d={area} fill="url(#captGradM)" />
                  <path d={line} stroke={accent} strokeWidth="2.4" fill="none" strokeLinecap="round" strokeLinejoin="round" />
                  {pts.map((p, i) => (
                    <g key={i}>
                      <circle cx={p.x} cy={p.y} r="4.5" fill="#fff" stroke={accent} strokeWidth="2" />
                      <text x={p.x} y={p.y - 8} textAnchor="middle" fill={"var(--color-text-1)"} fontSize="9" fontFamily={"var(--font-family-display)"} fontWeight="700">{p.v}</text>
                    </g>
                  ))}
                </>
              ) : (
                <text x={W / 2} y={H / 2} textAnchor="middle" fill={"var(--color-text-3)"} fontSize="12" fontFamily={"var(--font-family-display)"}>Sin datos aún</text>
              )}
            </svg>
          );
        })()}
        <div style={{ display: "flex", justifyContent: "space-between", marginTop: 8 }}>
          {months5.map((m) => <span key={m.key} style={{ font: `500 0.65rem/1 var(--font-family-display)`, color: "var(--color-text-3)" }}>{m.label}</span>)}
        </div>
      </div>

      {/* Balance neto – mobile */}
      <div className="dash-card dashboard-card" style={{ padding: "18px 16px", background: "#FFFFFF" }} >
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10, marginBottom: 14 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <p style={{ font: `700 0.94rem/1 var(--font-family-display)`, color: "var(--color-text-1)" }}>Balance neto</p>
            {!loading && <span style={{ font: `600 0.62rem/1 var(--font-family-body)`, color: balanceNeto >= 0 ? "#16A34A" : "#DC2626", background: balanceNeto >= 0 ? "rgba(22,163,74,0.09)" : "rgba(220,38,38,0.09)", borderRadius: 9999, padding: "4px 8px" }}>● {balanceNeto >= 0 ? "+" : ""}{fmt(balanceNeto)}</span>}
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <span style={{ display: "flex", alignItems: "center", gap: 3, font: `400 0.62rem/1 var(--font-family-display)`, color: "var(--color-text-2)" }}><span style={{ width: 7, height: 7, borderRadius: 1, background: "#17181B", display: "inline-block" }} />Ingresos</span>
            <span style={{ display: "flex", alignItems: "center", gap: 3, font: `400 0.62rem/1 var(--font-family-display)`, color: "var(--color-text-3)" }}><span style={{ width: 7, height: 7, borderRadius: 1, background: "#F6B99A", display: "inline-block" }} />Gastos</span>
          </div>
        </div>
        {(() => {
          const H = 100, W = 400, padB = 14, padT = 14;
          const drawH = H - padT - padB;
          const allVals = [...ingresos5, ...gastos5];
          const max = Math.max(...allVals, 1);
          const nMonths = months5.length;
          const groupW = W / nMonths;
          const barW = Math.floor(groupW * 0.28);
          const gap = Math.floor(groupW * 0.04);
          const topIngreso = Math.max(...ingresos5);
          const topIdx = ingresos5.indexOf(topIngreso);
          return (
            <svg width="100%" height={H} viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="none">
              {[padT + drawH * 0.5].map((y) => <line key={y} x1="0" y1={y} x2={W} y2={y} stroke="#F1F5F9" strokeWidth="1" />)}
              {ingresos5.map((ing, i) => {
                const gasto = gastos5[i];
                const cx = (i + 0.5) * groupW;
                const ingH = Math.max((ing / max) * drawH, ing > 0 ? 2 : 0);
                const gasH = Math.max((gasto / max) * drawH, gasto > 0 ? 2 : 0);
                const ingX = cx - gap / 2 - barW;
                const gasX = cx + gap / 2;
                return (
                  <g key={i}>
                    <rect x={gasX} y={padT + drawH - gasH} width={barW} height={gasH} rx="2" fill="#F6B99A" />
                    <rect x={ingX} y={padT + drawH - ingH} width={barW} height={ingH} rx="2" fill="#17181B" />
                    {i === topIdx && ing > 0 && (
                      <text x={ingX + barW / 2} y={padT + drawH - ingH - 3} textAnchor="middle" fill={"var(--color-text-1)"} fontSize="8" fontFamily={"var(--font-family-display)"} fontWeight="700">{fmt(ing)}</text>
                    )}
                  </g>
                );
              })}
            </svg>
          );
        })()}
        <div style={{ display: "flex", justifyContent: "space-between", marginTop: 8 }}>
          {months5.map((m) => <span key={m.key} style={{ font: `500 0.65rem/1 var(--font-family-display)`, color: "var(--color-text-3)" }}>{m.label}</span>)}
        </div>
        {!loading && (
          <div style={{ display: "flex", justifyContent: "space-between", marginTop: 9, paddingTop: 9, borderTop: "1px solid rgba(15,17,21,0.06)" }}>
            <span style={{ display: "flex", alignItems: "center", gap: 4, font: `500 0.67rem/1 var(--font-family-display)`, color: "var(--color-text-2)" }}>
              <span style={{ width: 7, height: 7, borderRadius: 1, background: "#17181B", display: "inline-block", flexShrink: 0 }} />
              Ingresos <strong style={{ font: `700 0.67rem/1 var(--font-family-display)`, color: "var(--color-text-1)" }}>{fmt(ingresoProyectado)}</strong>
            </span>
            <span style={{ display: "flex", alignItems: "center", gap: 4, font: `500 0.67rem/1 var(--font-family-display)`, color: "var(--color-text-2)" }}>
              <span style={{ width: 7, height: 7, borderRadius: 1, background: "#F6B99A", display: "inline-block", flexShrink: 0 }} />
              Egresos <strong style={{ font: `700 0.67rem/1 var(--font-family-display)`, color: "var(--color-text-1)" }}>{fmt(gastosTotal)}</strong>
            </span>
          </div>
        )}
      </div>

      {asistDiarias.length > 0 && (() => {
        const maxA = Math.max(...asistDiarias.map((d) => d.count), 1);
        const peakH = asistHoras.indexOf(Math.max(...asistHoras));
        return (
          <div style={{ display: "grid", gridTemplateColumns: "1.1fr 0.9fr", gap: 12 }}>
            <div className="dash-card dashboard-card" style={{ padding: "18px 16px", background: "#FFFFFF" }} >
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10, marginBottom: 16 }}>
                <div>
                  <p style={{ font: `800 0.94rem/1 var(--font-family-display)`, color: "var(--color-text-1)", marginBottom: 4 }}>Asistencia diaria</p>
                  <p style={{ font: `500 0.7rem/1.45 var(--font-family-display)`, color: "var(--color-text-3)" }}>Últimos 14 días · prom. {asistPromedioDiario}/día operativo</p>
                </div>
                <span style={{ font: `700 0.68rem/1 var(--font-family-display)`, color: accentDeep, background: chipBg, borderRadius: 9999, padding: "7px 10px" }}>{asistHoy} hoy</span>
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

            <div className="dash-card dashboard-card" style={{ padding: "18px 16px", background: "#FFFFFF" }} >
              <p style={{ font: `800 0.94rem/1 var(--font-family-display)`, color: "var(--color-text-1)", marginBottom: 4 }}>Cuándo viene la gente</p>
              <p style={{ font: `500 0.7rem/1.45 var(--font-family-display)`, color: "var(--color-text-3)", marginBottom: 16 }}>El horario con más movimiento.</p>
              <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                {[6, 7, 8, 9, 10, 17, 18, 19, 20, 21, 22].map((h) => {
                  const count = asistHoras[h] ?? 0;
                  const pct = asistHoras[peakH] > 0 ? (count / asistHoras[peakH]) * 100 : 0;
                  const isPeak = h === peakH && count > 0;
                  return (
                    <div key={h} style={{ display: "flex", alignItems: "center", gap: 8 }}>
                      <span style={{ width: 28, flexShrink: 0, textAlign: "right", font: `600 0.62rem/1 var(--font-family-body)`, color: "var(--color-text-3)" }}>{h}h</span>
                      <div style={{ flex: 1, height: 7, background: "#EDF1F5", borderRadius: 9999, overflow: "hidden" }}>
                        <div style={{ width: `${pct}%`, height: "100%", background: isPeak ? orangeGlow : "#17181B", borderRadius: 9999 }} />
                      </div>
                      <span style={{ width: 16, flexShrink: 0, font: `700 0.62rem/1 var(--font-family-display)`, color: isPeak ? accentDeep : "var(--color-text-2)"}}>{count}</span>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        );
      })()}

      <Suggestions setup={setup} morososCount={morososCount} upcomingExpirations={alerts.upcomingExpirations} loading={loading} />

    </div>
    {activeInfo && (
      <div onClick={() => setActiveInfo(null)} style={{ position: "fixed", inset: 0, zIndex: 120, background: "rgba(0,0,0,0.42)", backdropFilter: "blur(4px)", display: "flex", alignItems: "flex-end" }}>
        <div onClick={(e) => e.stopPropagation()} style={{ width: "100%", background: "#FFFFFF", borderRadius: "22px 22px 0 0", padding: "20px 18px 24px", boxShadow: "0 -16px 36px rgba(0,0,0,0.14)" }}>
          <div style={{ width: 42, height: 4, borderRadius: 999, background: "#E5E7EB", margin: "0 auto 14px" }} />
          <p style={{ font: `800 0.98rem/1 var(--font-family-display)`, color: "var(--color-text-1)", marginBottom: 8 }}>{activeInfo.title}</p>
          <p style={{ font: `500 0.82rem/1.6 var(--font-family-display)`, color: "var(--color-text-2)" }}>{activeInfo.body}</p>
        </div>
      </div>
    )}
    <OnboardingModal
      open={onboardingOpen}
      onClose={() => { localStorage.setItem("onboarding_dismissed", "1"); setOnboardingOpen(false); }}
    />
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
            <p style={{ font: `600 0.8rem/1.3 var(--font-family-display)`, color: "#C2410C" }}>
              <strong>Modo demo</strong> — estos números son de ejemplo, no son tus datos reales.
            </p>
          </div>
          <button
            onClick={exitDemo}
            style={{ padding: "6px 14px", borderRadius: 9, border: "1.5px solid rgba(249,115,22,0.35)", background: "white", color: "#C2410C", font: `700 0.75rem/1 var(--font-family-display)`, cursor: "pointer", whiteSpace: "nowrap", flexShrink: 0 }}
          >
            Volver a mis datos
          </button>
        </div>
      )}

      <div style={{ display: "flex", alignItems: "flex-end", justifyContent: "space-between", gap: 16, flexWrap: "wrap" }}>
        <div>
          <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 8 }}>
            <p style={{ font: `500 0.7rem/1.4 var(--font-family-body)`, color: "#8A4516", letterSpacing: "0.06em", textTransform: "uppercase" }}>{gymName}</p>
            {planLabel && <span style={{ font: `600 0.62rem/1 var(--font-family-body)`, color: planLabel === "Trial" ? "#D97706" : "#16A34A", background: planLabel === "Trial" ? "rgba(217,119,6,0.12)" : "rgba(22,163,74,0.12)", border: `1px solid ${planLabel === "Trial" ? "rgba(217,119,6,0.25)" : "rgba(22,163,74,0.25)"}`, borderRadius: 9999, padding: "2px 8px", textTransform: "uppercase", letterSpacing: "0.06em" }}>{planLabel}</span>}
          </div>
          <h1 className={greetPhase === "exit" ? "greet-exit" : greetPhase === "welcome" ? "greet-welcome" : ""} style={{ font: `800 2rem/0.95 var(--font-family-display)`, color: "var(--color-text-1)", letterSpacing: "-0.08em", marginBottom: 8, maxWidth: 760 }}>{greetPhase === "welcome" ? `Bienvenido, ${ownerName}.` : ownerName ? `${greeting}, ${ownerName}.` : `${greeting}.`}</h1>
          <p style={{ font: `500 0.86rem/1.6 var(--font-family-display)`, color: "var(--color-text-2)", maxWidth: 720 }}>Veamos cómo va tu negocio y dónde conviene actuar primero.</p>
        </div>
        <div style={{ display: "flex", justifyContent: "flex-end" }}>
          <Filters selectedMonth={selectedMonth} isCurrentMonth={isCurrentMonth} fetchedAtLabel={fetchedAtLabel} waBadge={waBadge} cronSyncLabel={cronSyncLabel} lastCronRun={lastCronRun} onPrevMonth={() => setSelectedMonth(m => new Date(m.getFullYear(), m.getMonth() - 1, 1))} onNextMonth={() => setSelectedMonth(m => new Date(m.getFullYear(), m.getMonth() + 1, 1))} />
        </div>
      </div>

      <OnboardingProgress demoMode={demoMode} setup={setup} onEnterDemo={enterDemo} />

      <OwnerPhoneAlert ownerPhoneMissing={ownerPhoneMissing} demoMode={demoMode} />

      <QuickActions asistHoy={asistHoy} alerts={alerts} accentDeep={accentDeep} />

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
        {/* A cobrar — feature card */}
        <div style={{ background: "linear-gradient(135deg, #1A1D24 0%, #0E0F12 100%)", borderRadius: 16, border: "1px solid rgba(255,255,255,0.06)", padding: "20px 18px", display: "flex", flexDirection: "column", justifyContent: "space-between", position: "relative", overflow: "hidden" }}>
          <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 12, marginBottom: 14 }}>
            <p style={{ font: `600 0.615rem/1 var(--font-family-body)`, color: "#B2B5BB", textTransform: "uppercase", letterSpacing: "0.12em" }}>A cobrar este mes</p>
            <div style={{ width: 26, height: 26, borderRadius: 7, background: "rgba(255,255,255,0.08)", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
              <CreditCard size={14} color="rgba(255,255,255,0.80)" />
            </div>
          </div>
          <div style={{ display: "flex", alignItems: "baseline", gap: 6, marginBottom: 10 }}>
            {loading
              ? <SkelLight w={120} h={40} r={8} />
              : <span style={{ font: `600 1.875rem/1 var(--font-family-display)`, color: "#F9FAFB", letterSpacing: "-0.025em" }}>{fmt(ingresoProyectado)}</span>}
            {!loading && <span style={{ font: `500 0.875rem/1 var(--font-family-display)`, color: "#8A8E97" }}>/ mes</span>}
          </div>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8 }}>
            <span style={{ font: `400 0.72rem/1 var(--font-family-display)`, color: "#8A8E97" }}>Proyección sobre planes activos</span>
            {!loading && recaudadoEsteMes > 0 && (
              <span style={{ font: `600 0.65rem/1 var(--font-family-body)`, color: "#5EE9A4", background: "rgba(22,163,74,0.18)", borderRadius: 5, padding: "2px 7px", flexShrink: 0 }}>{fmt(recaudadoEsteMes)} cobrado</span>
            )}
          </div>
        </div>

        {renderKpiCard("Socios activos",  loading ? <Skel w={52} h={38} r={9} /> : String(activosCount),  "vs. mes anterior",                <Users size={16} color="#fff" />,          "ink",    undefined)}
        {renderKpiCard("Asistencias hoy", loading ? <Skel w={52} h={38} r={9} /> : String(asistHoy),      "Ocupación del día",               <Activity size={16} color={accentDeep} />, "orange", undefined)}
        {renderKpiCard("Cuotas impagas",  loading ? <Skel w={52} h={38} r={9} /> : String(morososCount),  morososCount > 0 ? `${fmt(deudaTotal)} por cobrar` : "Todos los socios al día", <BadgeAlert size={16} color="#fff" />, "ink", "/dashboard/alumnos")}
      </div>

      {renderPulsoPanel()}

      {renderAutomationStats()}

      {renderMetricSection("Embudo")}
      {renderMetricSection("Fidelización")}
      {renderMetricSection("Eficiencia")}

      {/* Nuevos socios + Balance neto */}
      <div style={{ display: "grid", gridTemplateColumns: isDesktop ? "minmax(0, 1.5fr) minmax(320px, 1fr)" : "1fr", gap: 20 }}>
        {/* Nuevos socios por mes */}
        <div className="dashboard-card" style={{ padding: "22px 22px 18px" }} >
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12, marginBottom: 18 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
              <p style={{ font: `700 1rem/1 var(--font-family-display)`, color: "var(--color-text-1)" }}>Nuevos socios por mes</p>
              <span style={{ font: `600 0.67rem/1 var(--font-family-body)`, color: "#16A34A", background: "rgba(22,163,74,0.09)", borderRadius: 9999, padding: "4px 8px" }}>● +{captacion5[captacion5.length - 1]} este mes</span>
            </div>
            <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
              <span style={{ display: "flex", alignItems: "center", gap: 4, font: `500 0.69rem/1 var(--font-family-display)`, color: "var(--color-text-2)" }}><span style={{ width: 8, height: 8, borderRadius: "50%", background: accent, display: "inline-block" }} />Altas</span>
              <span style={{ display: "flex", alignItems: "center", gap: 4, font: `500 0.69rem/1 var(--font-family-display)`, color: "var(--color-text-3)" }}><span style={{ width: 8, height: 8, borderRadius: "50%", background: "#CBD5E1", display: "inline-block" }} />Meta</span>
            </div>
          </div>
          {(() => {
            const H = 148, W = 400, padT = 24, padB = 20;
            const drawH = H - padT - padB;
            const max = Math.max(...captacion5, 1);
            const meta = Math.round(captacion5.reduce((s, v) => s + v, 0) / captacion5.length * 1.2) || 6;
            const metaY = padT + drawH - (meta / max) * drawH;
            const pts = captacion5.map((v, i) => ({
              x: captacion5.length > 1 ? (i / (captacion5.length - 1)) * W : W / 2,
              y: padT + drawH - (v / max) * drawH,
              v,
            }));
            const area = `M${pts[0].x},${H - padB} ` + pts.map(p => `L${p.x},${p.y}`).join(" ") + ` L${pts[pts.length - 1].x},${H - padB} Z`;
            const line = `M${pts[0].x},${pts[0].y} ` + pts.slice(1).map(p => `L${p.x},${p.y}`).join(" ");
            return (
              <svg width="100%" height={H} viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="none">
                <defs>
                  <linearGradient id="captGradD" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor={accent} stopOpacity="0.18" />
                    <stop offset="100%" stopColor={accent} stopOpacity="0" />
                  </linearGradient>
                </defs>
                {[padT + drawH * 0.25, padT + drawH * 0.5, padT + drawH * 0.75].map((y) => (
                  <line key={y} x1="0" y1={y} x2={W} y2={y} stroke="#F1F5F9" strokeWidth="1" />
                ))}
                {/* META dashed line */}
                <line x1="0" y1={metaY} x2={W} y2={metaY} stroke="#CBD5E1" strokeWidth="1.2" strokeDasharray="5 4" />
                <text x={W - 2} y={metaY - 5} textAnchor="end" fill="#94A3B8" fontSize="9" fontFamily={"var(--font-family-display)"}>META {meta}</text>
                {hasCapt ? (
                  <>
                    <path d={area} fill="url(#captGradD)" />
                    <path d={line} stroke={accent} strokeWidth="2.5" fill="none" strokeLinecap="round" strokeLinejoin="round" />
                    {pts.map((p, i) => (
                      <g key={i}>
                        <circle cx={p.x} cy={p.y} r="5" fill="#fff" stroke={accent} strokeWidth="2.2" />
                        <text x={p.x} y={p.y - 10} textAnchor="middle" fill={"var(--color-text-1)"} fontSize="10" fontFamily={"var(--font-family-display)"} fontWeight="700">{p.v}</text>
                      </g>
                    ))}
                  </>
                ) : (
                  <text x={W / 2} y={H / 2} textAnchor="middle" fill={"var(--color-text-3)"} fontSize="12" fontFamily={"var(--font-family-display)"}>Sin datos registrados aún</text>
                )}
              </svg>
            );
          })()}
          <div style={{ display: "flex", justifyContent: "space-between", marginTop: 8 }}>
            {months5.map((m) => <span key={m.key} style={{ font: `500 0.69rem/1 var(--font-family-display)`, color: "var(--color-text-3)" }}>{m.label}</span>)}
          </div>
        </div>

        {/* Balance neto con barras */}
        <div className="dashboard-card" style={{ padding: "22px 22px 18px" }} >
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12, marginBottom: 18 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
              <p style={{ font: `700 1rem/1 var(--font-family-display)`, color: "var(--color-text-1)" }}>Balance neto</p>
              {!loading && <span style={{ font: `600 0.67rem/1 var(--font-family-body)`, color: balanceNeto >= 0 ? "#16A34A" : "#DC2626", background: balanceNeto >= 0 ? "rgba(22,163,74,0.09)" : "rgba(220,38,38,0.09)", borderRadius: 9999, padding: "4px 8px" }}>● {balanceNeto >= 0 ? "+" : ""}{fmt(balanceNeto)}</span>}
            </div>
            <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
              <span style={{ display: "flex", alignItems: "center", gap: 4, font: `500 0.69rem/1 var(--font-family-display)`, color: "var(--color-text-2)" }}><span style={{ width: 8, height: 8, borderRadius: 2, background: "#17181B", display: "inline-block" }} />Ingresos</span>
              <span style={{ display: "flex", alignItems: "center", gap: 4, font: `500 0.69rem/1 var(--font-family-display)`, color: "var(--color-text-3)" }}><span style={{ width: 8, height: 8, borderRadius: 2, background: "#F6B99A", display: "inline-block" }} />Gastos</span>
            </div>
          </div>
          {(() => {
            const H = 148, W = 400, padB = 20, padT = 20;
            const drawH = H - padT - padB;
            const allVals = [...ingresos5, ...gastos5];
            const max = Math.max(...allVals, 1);
            const nMonths = months5.length;
            const groupW = W / nMonths;
            const barW = Math.floor(groupW * 0.28);
            const gap = Math.floor(groupW * 0.04);
            const topIngreso = Math.max(...ingresos5);
            const topIdx = ingresos5.indexOf(topIngreso);
            return (
              <svg width="100%" height={H} viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="none">
                {[padT + drawH * 0.33, padT + drawH * 0.66].map((y) => (
                  <line key={y} x1="0" y1={y} x2={W} y2={y} stroke="#F1F5F9" strokeWidth="1" />
                ))}
                {ingresos5.map((ing, i) => {
                  const gasto = gastos5[i];
                  const cx = (i + 0.5) * groupW;
                  const ingH = Math.max((ing / max) * drawH, ing > 0 ? 2 : 0);
                  const gasH = Math.max((gasto / max) * drawH, gasto > 0 ? 2 : 0);
                  const ingX = cx - gap / 2 - barW;
                  const gasX = cx + gap / 2;
                  const ingY = padT + drawH - ingH;
                  const gasY = padT + drawH - gasH;
                  return (
                    <g key={i}>
                      <rect x={gasX} y={gasY} width={barW} height={gasH} rx="3" fill="#F6B99A" />
                      <rect x={ingX} y={ingY} width={barW} height={ingH} rx="3" fill="#17181B" />
                      {i === topIdx && ing > 0 && (
                        <text x={ingX + barW / 2} y={ingY - 5} textAnchor="middle" fill={"var(--color-text-1)"} fontSize="10" fontFamily={"var(--font-family-display)"} fontWeight="700">{fmt(ing)}</text>
                      )}
                    </g>
                  );
                })}
              </svg>
            );
          })()}
          <div style={{ display: "flex", justifyContent: "space-between", marginTop: 8 }}>
            {months5.map((m) => <span key={m.key} style={{ font: `500 0.69rem/1 var(--font-family-display)`, color: "var(--color-text-3)" }}>{m.label}</span>)}
          </div>
          {!loading && (
            <div style={{ display: "flex", justifyContent: "space-between", marginTop: 10, paddingTop: 10, borderTop: "1px solid rgba(15,17,21,0.06)" }}>
              <span style={{ display: "flex", alignItems: "center", gap: 5, font: `500 0.71rem/1 var(--font-family-display)`, color: "var(--color-text-2)" }}>
                <span style={{ width: 8, height: 8, borderRadius: 2, background: "#17181B", display: "inline-block", flexShrink: 0 }} />
                Ingresos <strong style={{ font: `700 0.71rem/1 var(--font-family-display)`, color: "var(--color-text-1)" }}>{fmt(ingresoProyectado)}</strong>
              </span>
              <span style={{ display: "flex", alignItems: "center", gap: 5, font: `500 0.71rem/1 var(--font-family-display)`, color: "var(--color-text-2)" }}>
                <span style={{ width: 8, height: 8, borderRadius: 2, background: "#F6B99A", display: "inline-block", flexShrink: 0 }} />
                Egresos <strong style={{ font: `700 0.71rem/1 var(--font-family-display)`, color: "var(--color-text-1)" }}>{fmt(gastosTotal)}</strong>
              </span>
            </div>
          )}
        </div>
      </div>

      <Suggestions setup={setup} morososCount={morososCount} upcomingExpirations={alerts.upcomingExpirations} loading={loading} />

      {loading && asistDiarias.length === 0 && (
        <div style={{ display: "grid", gridTemplateColumns: isDesktop ? "minmax(0, 1.35fr) minmax(320px, 1fr)" : "1fr", gap: 20 }}>
          <div className="dashboard-card" style={{ padding: "24px 24px 20px" }}>
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
          <div className="dashboard-card" style={{ padding: "24px 22px" }}>
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
          <div style={{ display: "grid", gridTemplateColumns: isDesktop ? "minmax(0, 1.35fr) minmax(320px, 1fr)" : "1fr", gap: 20 }}>
            <div className="dashboard-card" style={{ padding: "24px 24px 20px" }} >
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 14, marginBottom: 18 }}>
                <div>
                  <p style={{ font: `800 1.02rem/1 var(--font-family-display)`, color: "var(--color-text-1)", marginBottom: 6 }}>Asistencia diaria</p>
                  <p style={{ font: `500 0.76rem/1.5 var(--font-family-display)`, color: "var(--color-text-3)" }}>Cuánta gente entrenó cada día · prom. <strong>{asistPromedioDiario}/día</strong> (solo días operativos)</p>
                </div>
                <a href="/dashboard/asistencias" style={{ font: `700 0.72rem/1 var(--font-family-display)`, color: "var(--color-text-2)", textDecoration: "none" }}>Ver detalle →</a>
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

            <div className="dashboard-card" style={{ padding: "24px 22px" }} >
              <p style={{ font: `800 1.02rem/1 var(--font-family-display)`, color: "var(--color-text-1)", marginBottom: 6 }}>Cuándo viene la gente</p>
              <p style={{ font: `500 0.76rem/1.5 var(--font-family-display)`, color: "var(--color-text-3)", marginBottom: 18 }}>El horario con más movimiento.</p>
              <div style={{ display: "flex", flexDirection: "column", gap: 9 }}>
                {[6, 7, 8, 9, 10, 17, 18, 19, 20, 21, 22].map((h) => {
                  const count = asistHoras[h] ?? 0;
                  const pct = asistHoras[peakH] > 0 ? (count / asistHoras[peakH]) * 100 : 0;
                  const isPeak = h === peakH && count > 0;
                  return (
                    <div key={h} style={{ display: "flex", alignItems: "center", gap: 10 }}>
                      <span style={{ width: 28, flexShrink: 0, textAlign: "right", font: `600 0.64rem/1 var(--font-family-body)`, color: "var(--color-text-3)" }}>{h}h</span>
                      <div style={{ flex: 1, height: 8, background: "#EDF1F5", borderRadius: 9999, overflow: "hidden" }}>
                        <div style={{ width: `${pct}%`, height: "100%", background: isPeak ? orangeGlow : "#17181B", borderRadius: 9999 }} />
                      </div>
                      <span style={{ width: 18, flexShrink: 0, font: `700 0.64rem/1 var(--font-family-display)`, color: isPeak ? accentDeep : "var(--color-text-2)"}}>{count}</span>
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
      onClose={() => { localStorage.setItem("onboarding_dismissed", "1"); setOnboardingOpen(false); }}
    />
    </>
  );
}
