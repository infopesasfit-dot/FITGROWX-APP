"use client";

import { useEffect, useState, useRef, useMemo, useCallback } from "react";
import {
  Users, CreditCard,
  ArrowUpRight, ArrowDownRight, Send, Target, CircleHelp, BadgeAlert, Activity, UserMinus,
} from "lucide-react";
import { supabase } from "@/lib/supabase";
import { getPlanNombre, getRelationRecord } from "@/lib/supabase-relations";
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
interface EgresoMontoRow { monto: number | null; }
interface CreatedAtRow { created_at: string; }
interface PlanPrecioRow { planes: unknown; }
interface PlanNombreRow { planes: unknown; }
interface ProspectoRow { created_at: string; }
interface PagoMetricRow { amount: number; date: string; status: string | null; concepto: string | null; alumno_id: string | null; }
interface EgresoMetricRow { monto: number | null; fecha: string; categoria: string | null; }
interface AlumnoMetricRow { id: string; full_name: string; phone: string | null; status: string | null; created_at: string; next_expiration_date: string | null; }
interface ReservaMetricRow { class_id: string; fecha: string; lead_phone: string | null; estado: string | null; }
interface AsistenciaMetricRow { alumno_id: string; fecha: string; }
interface GymClassMetricRow { id: string; day_of_week: number; max_capacity: number; event_type: "regular" | "especial" | null; event_date: string | null; }
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

function getDateRange(filter: DateFilter) {
  const today = new Date();
  const to = today.toISOString().slice(0, 10);
  if (filter === "hoy") return { from: to, to };
  if (filter === "semana") {
    const d = new Date(today);
    d.setDate(d.getDate() - d.getDay() + (d.getDay() === 0 ? -6 : 1));
    return { from: d.toISOString().slice(0, 10), to };
  }
  const from = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, "0")}-01`;
  return { from, to };
}

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

function startOfMonth(date = new Date()) {
  return new Date(date.getFullYear(), date.getMonth(), 1);
}

function endOfMonth(date = new Date()) {
  return new Date(date.getFullYear(), date.getMonth() + 1, 0);
}

function isoDate(date: Date) {
  return date.toISOString().slice(0, 10);
}

function normalizePhone(raw: string | null | undefined) {
  return String(raw ?? "").replace(/\D/g, "");
}

function isWithin(dateStr: string | null | undefined, from: string, to: string) {
  if (!dateStr) return false;
  return dateStr >= from && dateStr <= to;
}

function metricDelta(current: number | null, previous: number | null) {
  if (current == null || previous == null) return null;
  if (previous === 0) return current === 0 ? 0 : 100;
  return ((current - previous) / previous) * 100;
}

function countWeekdayInMonth(year: number, monthIndex: number, dayOfWeek: number) {
  const daysInMonth = new Date(year, monthIndex + 1, 0).getDate();
  let count = 0;
  for (let day = 1; day <= daysInMonth; day += 1) {
    if (new Date(year, monthIndex, day).getDay() === dayOfWeek) count += 1;
  }
  return count;
}

function averageMonthsFromCreated(rows: AlumnoMetricRow[]) {
  if (rows.length === 0) return 0;
  const now = Date.now();
  const months = rows.map((row) => {
    const diffMs = Math.max(0, now - new Date(row.created_at).getTime());
    return diffMs / (1000 * 60 * 60 * 24 * 30.4375);
  });
  return months.reduce((sum, value) => sum + value, 0) / months.length;
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

    const { from, to } = getDateRange(filter);
    const today = new Date();
    const thirtyDaysAgo = new Date(today);
    thirtyDaysAgo.setDate(today.getDate() - 30);
    const thirtyStr = thirtyDaysAgo.toISOString().slice(0, 10);
    const nowMonthStart = startOfMonth(today);
    const nowMonthEnd = endOfMonth(today);
    const prevMonthDate = new Date(today.getFullYear(), today.getMonth() - 1, 1);
    const prevMonthStart = startOfMonth(prevMonthDate);
    const prevMonthEnd = endOfMonth(prevMonthDate);
    const thisMonthFrom = isoDate(nowMonthStart);
    const thisMonthTo = isoDate(nowMonthEnd);
    const prevMonthFrom = isoDate(prevMonthStart);
    const prevMonthTo = isoDate(prevMonthEnd);
    const recentInactiveCutoff = new Date(today);
    recentInactiveCutoff.setDate(today.getDate() - 7);
    const recentInactiveCutoffStr = isoDate(recentInactiveCutoff);
    const expiration72h = new Date(today);
    expiration72h.setHours(0, 0, 0, 0);
    expiration72h.setDate(expiration72h.getDate() + 3);
    const expiration72hStr = isoDate(expiration72h);

    const oldestMonthKey = months5[0]?.key ? `${months5[0].key}-01` : undefined;

    const [
      { count: total },
      { count: activos },
      { data: todasCreatedAt },
      { data: egresosData },
      { data: recientesData },
      { data: activosConPlan },
      { data: activosConNombrePlan },
      { count: prospectosPendientes },
      statsRes,
      { data: ownerProfile },
      { data: gymSettings },
      { data: prospectosRows },
      { data: pagosMetricRows },
      { data: egresosMetricRows },
      { data: alumnosMetricRows },
      { data: reservasMetricRows },
      { data: asistenciasMetricRows },
      { data: gymClassesMetricRows },
    ] = await Promise.all([
      supabase.from("alumnos").select("id", { count: "exact", head: true }).eq("gym_id", gym_id),
      supabase.from("alumnos").select("id", { count: "exact", head: true }).eq("gym_id", gym_id).eq("status", "activo"),
      supabase.from("alumnos").select("created_at").eq("gym_id", gym_id).gte("created_at", oldestMonthKey ?? "1900-01-01"),
      supabase.from("egresos").select("monto").eq("gym_id", gym_id).gte("fecha", from).lte("fecha", to),
      supabase.from("alumnos").select("id, full_name, created_at").eq("gym_id", gym_id).order("created_at", { ascending: false }).limit(4),
      supabase.from("alumnos").select("planes!plan_id(precio)").eq("gym_id", gym_id).eq("status", "activo"),
      supabase.from("alumnos").select("planes!plan_id(nombre)").eq("gym_id", gym_id).eq("status", "activo"),
      supabase.from("prospectos").select("id", { count: "exact", head: true }).eq("gym_id", gym_id).eq("status", "pendiente"),
      fetch(`/api/admin/asistencias-stats?gym_id=${gym_id}`).then(async (r) => {
        if (!r.ok) return null;
        return r.json() as Promise<{
          dailyCounts?: { fecha: string; count: number }[];
          hourlyCounts?: number[];
          todayCount?: number;
        }>;
      }).catch(() => null),
      userIdRef.current
        ? supabase.from("profiles").select("full_name").eq("id", userIdRef.current).maybeSingle()
        : Promise.resolve({ data: null }),
      supabase.from("gym_settings").select("gym_name").eq("gym_id", gym_id).maybeSingle(),
      supabase.from("prospectos").select("created_at").eq("gym_id", gym_id).gte("created_at", prevMonthFrom).lte("created_at", thisMonthTo),
      supabase.from("pagos").select("amount, date, status, concepto, alumno_id").eq("gym_id", gym_id).gte("date", prevMonthFrom).lte("date", thisMonthTo),
      supabase.from("egresos").select("monto, fecha, categoria").eq("gym_id", gym_id).gte("fecha", prevMonthFrom).lte("fecha", thisMonthTo),
      supabase.from("alumnos").select("id, full_name, phone, status, created_at, next_expiration_date").eq("gym_id", gym_id),
      supabase.from("reservas").select("class_id, fecha, lead_phone, estado").eq("gym_id", gym_id).gte("fecha", prevMonthFrom).lte("fecha", thisMonthTo),
      supabase.from("asistencias").select("alumno_id, fecha").eq("gym_id", gym_id).gte("fecha", thirtyStr).lte("fecha", isoDate(today)),
      supabase.from("gym_classes").select("id, day_of_week, max_capacity, event_type, event_date").eq("gym_id", gym_id),
    ] as const);

    const ownerDisplay = typeof ownerProfile?.full_name === "string" && ownerProfile.full_name.trim()
      ? ownerProfile.full_name.trim().split(" ")[0]
      : "dueño";
    const gymDisplay = typeof gymSettings?.gym_name === "string" && gymSettings.gym_name.trim()
      ? gymSettings.gym_name.trim()
      : "tu gym";
    setOwnerName(ownerDisplay);
    setGymName(gymDisplay);
    const proyectado = (activosConPlan ?? []).reduce((sum, row) => {
      const plan = getRelationRecord((row as PlanPrecioRow).planes);
      return sum + (typeof plan?.precio === "number" ? plan.precio : 0);
    }, 0);

    const captMap: Record<string, number> = {};
    (todasCreatedAt ?? []).forEach((row) => {
      const m = (row as CreatedAtRow).created_at.slice(0, 7);
      captMap[m] = (captMap[m] || 0) + 1;
    });
    const nextCaptacion5 = months5.map(m => captMap[m.key] || 0);

    const planMap: Record<string, number> = {};
    (activosConNombrePlan ?? []).forEach((row) => {
      const nombre = getPlanNombre((row as PlanNombreRow).planes) ?? "Sin plan";
      planMap[nombre] = (planMap[nombre] || 0) + 1;
    });
    const nextPlanDist = Object.entries(planMap)
      .sort((a, b) => b[1] - a[1])
      .map(([nombre, count]) => ({ nombre, count }));

    const prospectRows = (prospectosRows ?? []) as ProspectoRow[];
    const pagoRows = ((pagosMetricRows ?? []) as PagoMetricRow[]).filter((row) => row.status === "validado");
    const egresoRows = (egresosMetricRows ?? []) as EgresoMetricRow[];
    const alumnoRows = (alumnosMetricRows ?? []) as AlumnoMetricRow[];
    const reservaRows = ((reservasMetricRows ?? []) as ReservaMetricRow[]).filter((row) => row.estado === "confirmada");
    const asistenciaRows = (asistenciasMetricRows ?? []) as AsistenciaMetricRow[];
    const classRows = (gymClassesMetricRows ?? []) as GymClassMetricRow[];

    const leadPhonesThisMonth = new Set(
      reservaRows
        .filter((row) => isWithin(row.fecha, thisMonthFrom, thisMonthTo))
        .map((row) => normalizePhone(row.lead_phone))
        .filter(Boolean),
    );
    const leadPhonesPrevMonth = new Set(
      reservaRows
        .filter((row) => isWithin(row.fecha, prevMonthFrom, prevMonthTo))
        .map((row) => normalizePhone(row.lead_phone))
        .filter(Boolean),
    );

    const leadCountCurrent = prospectRows.filter((row) => isWithin(row.created_at.slice(0, 10), thisMonthFrom, thisMonthTo)).length;
    const leadCountPrevious = prospectRows.filter((row) => isWithin(row.created_at.slice(0, 10), prevMonthFrom, prevMonthTo)).length;
    const trialCountCurrent = leadPhonesThisMonth.size;
    const trialCountPrevious = leadPhonesPrevMonth.size;

    const normalizedActivePhonesCurrent = new Set(
      alumnoRows
        .filter((row) => row.status === "activo" && isWithin(row.created_at.slice(0, 10), thisMonthFrom, thisMonthTo))
        .map((row) => normalizePhone(row.phone))
        .filter(Boolean),
    );
    const normalizedActivePhonesPrevious = new Set(
      alumnoRows
        .filter((row) => row.status === "activo" && isWithin(row.created_at.slice(0, 10), prevMonthFrom, prevMonthTo))
        .map((row) => normalizePhone(row.phone))
        .filter(Boolean),
    );

    const trialToMemberCurrentCount = Array.from(leadPhonesThisMonth).filter((phone) => normalizedActivePhonesCurrent.has(phone)).length;
    const trialToMemberPreviousCount = Array.from(leadPhonesPrevMonth).filter((phone) => normalizedActivePhonesPrevious.has(phone)).length;

    const marketingCurrent = egresoRows
      .filter((row) => row.categoria === "Marketing" && isWithin(row.fecha, thisMonthFrom, thisMonthTo))
      .reduce((sum, row) => sum + (row.monto ?? 0), 0);
    const marketingPrevious = egresoRows
      .filter((row) => row.categoria === "Marketing" && isWithin(row.fecha, prevMonthFrom, prevMonthTo))
      .reduce((sum, row) => sum + (row.monto ?? 0), 0);

    const newMembersCurrent = alumnoRows.filter((row) => isWithin(row.created_at.slice(0, 10), thisMonthFrom, thisMonthTo)).length;
    const newMembersPrevious = alumnoRows.filter((row) => isWithin(row.created_at.slice(0, 10), prevMonthFrom, prevMonthTo)).length;

    const churnedCurrent = alumnoRows.filter((row) => ["vencido", "inactivo"].includes(row.status ?? "") && isWithin(row.next_expiration_date, thisMonthFrom, thisMonthTo)).length;
    const churnedPrevious = alumnoRows.filter((row) => ["vencido", "inactivo"].includes(row.status ?? "") && isWithin(row.next_expiration_date, prevMonthFrom, prevMonthTo)).length;
    const activeBaseCurrent = Math.max(activos ?? 0, 1);
    const activeBasePrevious = Math.max((activos ?? 0) + churnedCurrent - newMembersCurrent, 1);

    const renewedMembersCurrent = new Set(
      pagoRows.filter((row) => row.concepto === "membresia" && isWithin(row.date, thisMonthFrom, thisMonthTo) && row.alumno_id).map((row) => row.alumno_id as string),
    ).size;
    const renewedMembersPrevious = new Set(
      pagoRows.filter((row) => row.concepto === "membresia" && isWithin(row.date, prevMonthFrom, prevMonthTo) && row.alumno_id).map((row) => row.alumno_id as string),
    ).size;

    const retentionDenominatorCurrent = renewedMembersCurrent + churnedCurrent;
    const retentionDenominatorPrevious = renewedMembersPrevious + churnedPrevious;

    const currentRevenue = pagoRows.filter((row) => isWithin(row.date, thisMonthFrom, thisMonthTo)).reduce((sum, row) => sum + row.amount, 0);
    const previousRevenue = pagoRows.filter((row) => isWithin(row.date, prevMonthFrom, prevMonthTo)).reduce((sum, row) => sum + row.amount, 0);
    const currentActiveCount = activos ?? 0;
    const arpuCurrent = currentActiveCount > 0 ? currentRevenue / currentActiveCount : 0;
    const previousActiveCount = Math.max((activos ?? 0) + churnedCurrent - newMembersCurrent, 0);
    const arpuPrevious = previousActiveCount > 0 ? previousRevenue / previousActiveCount : 0;
    const avgTenureMonths = averageMonthsFromCreated(alumnoRows);
    const ltvCurrent = arpuCurrent * avgTenureMonths;
    const ltvPrevious = arpuPrevious * avgTenureMonths;

    const buildOccupancy = (rangeStart: Date) => {
      const year = rangeStart.getFullYear();
      const month = rangeStart.getMonth();
      const monthFrom = isoDate(startOfMonth(rangeStart));
      const monthTo = isoDate(endOfMonth(rangeStart));
      const confirmedReservations = reservaRows.filter((row) => isWithin(row.fecha, monthFrom, monthTo)).length;
      const totalCapacity = classRows.reduce((sum, row) => {
        if ((row.event_type ?? "regular") === "especial") {
          return sum + (isWithin(row.event_date, monthFrom, monthTo) ? row.max_capacity : 0);
        }
        return sum + countWeekdayInMonth(year, month, row.day_of_week) * row.max_capacity;
      }, 0);
      return totalCapacity > 0 ? (confirmedReservations / totalCapacity) * 100 : 0;
    };

    const occupancyCurrent = buildOccupancy(today);
    const occupancyPrevious = buildOccupancy(prevMonthDate);

    const lastAttendanceMap: Record<string, string> = {};
    for (const row of asistenciaRows) {
      if (!lastAttendanceMap[row.alumno_id] || row.fecha > lastAttendanceMap[row.alumno_id]) {
        lastAttendanceMap[row.alumno_id] = row.fecha;
      }
    }
    const inactiveRows = alumnoRows.filter((row) => {
      if (row.status !== "activo") return false;
      if (row.next_expiration_date && row.next_expiration_date < isoDate(today)) return false;
      const lastAttendance = lastAttendanceMap[row.id];
      return !lastAttendance || lastAttendance < recentInactiveCutoffStr;
    });
    const upcomingExpirations = alumnoRows
      .filter((row) => row.status === "activo" && isWithin(row.next_expiration_date, isoDate(today), expiration72hStr))
      .sort((a, b) => (a.next_expiration_date ?? "").localeCompare(b.next_expiration_date ?? ""))
      .slice(0, 6)
      .map((row) => ({ id: row.id, full_name: row.full_name, next_expiration_date: row.next_expiration_date }));

    const leadToTrialCurrent = leadCountCurrent > 0 ? (trialCountCurrent / leadCountCurrent) * 100 : 0;
    const leadToTrialPrevious = leadCountPrevious > 0 ? (trialCountPrevious / leadCountPrevious) * 100 : 0;
    const trialToMemberCurrent = trialCountCurrent > 0 ? (trialToMemberCurrentCount / trialCountCurrent) * 100 : 0;
    const trialToMemberPrevious = trialCountPrevious > 0 ? (trialToMemberPreviousCount / trialCountPrevious) * 100 : 0;
    const cacCurrent = newMembersCurrent > 0 ? marketingCurrent / newMembersCurrent : 0;
    const cacPrevious = newMembersPrevious > 0 ? marketingPrevious / newMembersPrevious : 0;
    const churnRateCurrent = activeBaseCurrent > 0 ? (churnedCurrent / activeBaseCurrent) * 100 : 0;
    const churnRatePrevious = activeBasePrevious > 0 ? (churnedPrevious / activeBasePrevious) * 100 : 0;
    const retentionCurrent = retentionDenominatorCurrent > 0 ? (renewedMembersCurrent / retentionDenominatorCurrent) * 100 : 0;
    const retentionPrevious = retentionDenominatorPrevious > 0 ? (renewedMembersPrevious / retentionDenominatorPrevious) * 100 : 0;

    const metricCards: DashboardMetric[] = [
      { key: "leads", label: "Leads Totales", section: "Embudo", tooltip: "Consultas nuevas que entraron este mes.", value: leadCountCurrent, previous: leadCountPrevious, format: "number", accent: "orange" },
      { key: "lead_trial", label: "Lead-to-Trial", section: "Embudo", tooltip: "Qué porcentaje de consultas llegó a reservar una prueba.", value: leadToTrialCurrent, previous: leadToTrialPrevious, format: "percent", accent: "soft" },
      { key: "trial_member", label: "Trial-to-Member", section: "Embudo", tooltip: "Qué porcentaje de pruebas terminó en socio activo.", value: trialToMemberCurrent, previous: trialToMemberPrevious, format: "percent", accent: "soft" },
      { key: "cac", label: "CAC", section: "Embudo", tooltip: "Cuánto costó conseguir cada socio nuevo este mes.", value: cacCurrent, previous: cacPrevious, format: "currency", accent: "ink" },
      { key: "churn", label: "Churn Rate", section: "Fidelización", tooltip: "Porcentaje de socios que se cayeron este mes.", value: churnRateCurrent, previous: churnRatePrevious, format: "percent", accent: "orange" },
      { key: "retention", label: "Retention Rate", section: "Fidelización", tooltip: "Qué parte de los socios que estaban por renovar siguió activa.", value: retentionCurrent, previous: retentionPrevious, format: "percent", accent: "soft" },
      { key: "ltv", label: "LTV", section: "Fidelización", tooltip: "Valor estimado que deja un alumno durante su permanencia.", value: ltvCurrent, previous: ltvPrevious, format: "currency", accent: "ink" },
      { key: "arpu", label: "ARPU", section: "Eficiencia", tooltip: "Ingreso promedio por alumno activo este mes.", value: arpuCurrent, previous: arpuPrevious, format: "currency", accent: "soft" },
      { key: "ocupacion", label: "Ocupación por Clase", section: "Eficiencia", tooltip: "Reserva confirmada sobre cupo disponible del mes.", value: occupancyCurrent, previous: occupancyPrevious, format: "percent", accent: "orange" },
      { key: "m2", label: "Ingreso/m²", section: "Eficiencia", tooltip: "Facturación total dividida por metros del local. Lo activamos cuando cargues la superficie.", value: null, previous: null, format: "currency", accent: "ink" },
    ];

    const snapshot: DashboardSnapshot = {
      activosCount: activos ?? 0,
      totalCount: total ?? 0,
      ingresoProyectado: proyectado,
      gastosTotal: (egresosData ?? []).reduce((sum, row) => sum + ((row as EgresoMontoRow).monto ?? 0), 0),
      recientes: (recientesData ?? []) as RecenteAlumno[],
      captacion5: nextCaptacion5,
      planDist: nextPlanDist,
      prospectos: prospectosPendientes ?? 0,
      asistDiarias: (statsRes?.dailyCounts ?? []).slice(-14),
      asistHoras: statsRes?.hourlyCounts ?? Array(24).fill(0),
      asistHoy: statsRes?.todayCount ?? 0,
      metrics: metricCards,
      alerts: {
        inactiveCount: inactiveRows.length,
        inactiveNames: inactiveRows.slice(0, 6).map((row) => row.full_name),
        upcomingExpirations,
      },
    };

    applySnapshot(snapshot);
    setPageCache(cacheKey, snapshot);

    setLoading(false);
  }, [months5, applySnapshot]);

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

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
        <div className="dash-card" style={{ ...cardBase, padding: "18px 16px", background: whitePanel }} {...cardHover}>
          <p style={{ font: `800 0.94rem/1 ${fd}`, color: t1, marginBottom: 4 }}>Mix de planes</p>
          <p style={{ font: `500 0.7rem/1.45 ${fb}`, color: t3, marginBottom: 14 }}>Cómo se reparte la base activa.</p>
          {loading || planDist.length === 0 ? (
            <div style={{ height: 104, display: "flex", alignItems: "center", justifyContent: "center" }}>
              <p style={{ font: `500 0.75rem/1 ${fb}`, color: t3 }}>{loading ? "Cargando…" : "Sin datos"}</p>
            </div>
          ) : (
            <>
              <div style={{ display: "flex", justifyContent: "center", marginBottom: 12 }}>
                <svg width="104" height="104" viewBox="0 0 148 148">
                  <defs>
                    {PLAN_COLORS.map((color, idx) => (
                      <linearGradient key={`dgm${idx}`} id={`dgm${idx}`} x1="0" y1="0" x2="148" y2="148" gradientUnits="userSpaceOnUse">
                        <stop offset="0%" stopColor={color} stopOpacity="0.72" />
                        <stop offset="100%" stopColor={color} stopOpacity="1" />
                      </linearGradient>
                    ))}
                  </defs>
                  <circle cx={DONUT_CX} cy={DONUT_CY} r={DONUT_R} fill="none" stroke="#F3F4F6" strokeWidth="14" />
                  {donutSegments.map((seg, i) => (
                    <circle key={i} cx={DONUT_CX} cy={DONUT_CY} r={DONUT_R} fill="none" stroke={`url(#dgm${i})`} strokeWidth="14" strokeDasharray={seg.dasharray} strokeDashoffset={seg.dashoffset} strokeLinecap="round" transform={`rotate(-90 ${DONUT_CX} ${DONUT_CY})`} />
                  ))}
                  <circle cx={DONUT_CX} cy={DONUT_CY} r="35" fill="#fff" />
                  <text x={DONUT_CX} y="70" textAnchor="middle" fill={t1} fontSize="17" fontWeight="800" fontFamily={fd}>{totalDonut}</text>
                  <text x={DONUT_CX} y="83" textAnchor="middle" fill={t3} fontSize="9" fontFamily={fb}>activos</text>
                </svg>
              </div>
              <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                {planDist.slice(0, 3).map((p, i) => {
                  const color = PLAN_COLORS[i % PLAN_COLORS.length];
                  const pct = totalDonut > 0 ? ((p.count / totalDonut) * 100).toFixed(0) : "0";
                  return (
                    <div key={p.nombre} style={{ display: "flex", alignItems: "center", gap: 6 }}>
                      <span style={{ width: 7, height: 7, borderRadius: "50%", background: color, flexShrink: 0 }} />
                      <span style={{ flex: 1, minWidth: 0, font: `500 0.66rem/1 ${fb}`, color: t2, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{p.nombre}</span>
                      <span style={{ font: `700 0.66rem/1 ${fd}`, color: t1 }}>{pct}%</span>
                    </div>
                  );
                })}
              </div>
            </>
          )}
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

      <div className="dash-card" style={{ ...cardBase, padding: "18px 16px", background: whitePanel }} {...cardHover}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10, marginBottom: 14 }}>
          <div>
            <p style={{ font: `800 0.94rem/1 ${fd}`, color: t1, marginBottom: 4 }}>Registros recientes</p>
            <p style={{ font: `500 0.7rem/1.45 ${fb}`, color: t3 }}>Los últimos alumnos cargados en el sistema.</p>
          </div>
          <span style={{ font: `700 0.66rem/1 ${fb}`, color: accentDeep, background: chipBg, borderRadius: 9999, padding: "7px 10px" }}>Últimos</span>
        </div>
        {loading ? (
          <p style={{ font: `500 0.78rem/1 ${fb}`, color: t3 }}>Cargando…</p>
        ) : recientes.length === 0 ? (
          <p style={{ font: `500 0.78rem/1 ${fb}`, color: t3 }}>Sin registros recientes.</p>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            {recientes.map((r) => (
              <div key={r.id} style={{ display: "flex", alignItems: "center", gap: 12, padding: "10px 0", borderBottom: "1px solid rgba(17,24,39,0.05)" }}>
                <div style={{ width: 40, height: 40, borderRadius: 16, background: "linear-gradient(135deg, #191B20, #353844)", color: "white", display: "flex", alignItems: "center", justifyContent: "center", font: `700 0.68rem/1 ${fd}`, flexShrink: 0 }}>{initials(r.full_name)}</div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <p style={{ font: `700 0.84rem/1 ${fd}`, color: t1, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{r.full_name}</p>
                  <p style={{ font: `500 0.68rem/1.45 ${fb}`, color: t3, marginTop: 4 }}>{new Date(r.created_at).toLocaleDateString("es-AR", { day: "numeric", month: "short" })}</p>
                </div>
                <div style={{ width: 32, height: 32, borderRadius: 12, background: "#F5F7FA", display: "flex", alignItems: "center", justifyContent: "center" }}>
                  <Send size={13} color={accentDeep} />
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
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

      <div style={{ display: "grid", gridTemplateColumns: "minmax(0, 1fr) minmax(360px, 0.92fr)", gap: 20 }}>
        <div style={{ ...cardBase, padding: "24px 24px 18px", background: whitePanel }} {...cardHover}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 14, marginBottom: 18 }}>
            <div>
              <p style={{ font: `800 1.02rem/1 ${fd}`, color: t1, marginBottom: 6 }}>Registros recientes</p>
              <p style={{ font: `500 0.76rem/1.5 ${fb}`, color: t3 }}>Los últimos alumnos ingresados al sistema.</p>
            </div>
            <span style={{ font: `700 0.7rem/1 ${fb}`, color: accentDeep, background: chipBg, borderRadius: 9999, padding: "8px 12px" }}>Recientes</span>
          </div>
          {loading ? (
            <p style={{ color: t3, font: `500 0.8rem/1 ${fb}` }}>Cargando…</p>
          ) : recientes.length === 0 ? (
            <p style={{ color: t3, font: `500 0.8rem/1 ${fb}` }}>Sin registros recientes.</p>
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: 0 }}>
              {recientes.map((r, i) => (
                <div key={r.id} style={{ display: "flex", alignItems: "center", gap: 14, padding: "12px 0", borderBottom: i < recientes.length - 1 ? "1px solid rgba(17,24,39,0.05)" : "none" }}>
                  <div style={{ width: 42, height: 42, borderRadius: 16, background: "linear-gradient(135deg, #191B20, #353844)", color: "white", display: "flex", alignItems: "center", justifyContent: "center", font: `700 0.72rem/1 ${fd}`, flexShrink: 0 }}>{initials(r.full_name)}</div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <p style={{ font: `700 0.9rem/1 ${fd}`, color: t1, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{r.full_name}</p>
                    <p style={{ font: `500 0.7rem/1.45 ${fb}`, color: t3, marginTop: 4 }}>{new Date(r.created_at).toLocaleDateString("es-AR", { day: "numeric", month: "short", year: "numeric" })}</p>
                  </div>
                  <div style={{ width: 34, height: 34, borderRadius: 14, background: "#F5F7FA", display: "flex", alignItems: "center", justifyContent: "center" }}>
                    <Send size={13} color={accentDeep} />
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        <div style={{ ...cardBase, padding: "24px 22px", background: whitePanel }} {...cardHover}>
          <p style={{ font: `800 1.02rem/1 ${fd}`, color: t1, marginBottom: 6 }}>Mix de planes</p>
          <p style={{ font: `500 0.76rem/1.5 ${fb}`, color: t3, marginBottom: 18 }}>Distribución actual de la base activa.</p>
          {loading || planDist.length === 0 ? (
            <div style={{ display: "flex", alignItems: "center", justifyContent: "center", height: 140 }}>
              <p style={{ font: `500 0.8rem/1 ${fb}`, color: t3 }}>{loading ? "Cargando…" : "Sin datos"}</p>
            </div>
          ) : (
            <div style={{ display: "grid", gridTemplateColumns: "148px minmax(0, 1fr)", alignItems: "center", gap: 18 }}>
              <svg width="148" height="148" viewBox="0 0 148 148">
                <defs>
                  {PLAN_COLORS.map((color, idx) => (
                    <linearGradient key={`dg${idx}`} id={`dg${idx}`} x1="0" y1="0" x2="148" y2="148" gradientUnits="userSpaceOnUse">
                      <stop offset="0%" stopColor={color} stopOpacity="0.68" />
                      <stop offset="100%" stopColor={color} stopOpacity="1" />
                    </linearGradient>
                  ))}
                </defs>
                <circle cx={DONUT_CX} cy={DONUT_CY} r={DONUT_R} fill="none" stroke="#F1F4F7" strokeWidth="14" />
                {donutSegments.map((seg, i) => (
                  <circle key={i} cx={DONUT_CX} cy={DONUT_CY} r={DONUT_R} fill="none" stroke={`url(#dg${i})`} strokeWidth="14" strokeDasharray={seg.dasharray} strokeDashoffset={seg.dashoffset} strokeLinecap="round" transform={`rotate(-90 ${DONUT_CX} ${DONUT_CY})`} />
                ))}
                <circle cx={DONUT_CX} cy={DONUT_CY} r="35" fill="white" />
                <text x={DONUT_CX} y="70" textAnchor="middle" fill={t1} fontSize="18" fontWeight="800" fontFamily={fd}>{totalDonut}</text>
                <text x={DONUT_CX} y="84" textAnchor="middle" fill={t3} fontSize="9" fontFamily={fb}>activos</text>
              </svg>
              <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                {planDist.map((p, i) => {
                  const color = PLAN_COLORS[i % PLAN_COLORS.length];
                  const pct = totalDonut > 0 ? ((p.count / totalDonut) * 100).toFixed(0) : "0";
                  return (
                    <div key={p.nombre}>
                      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10, marginBottom: 5 }}>
                        <div style={{ display: "flex", alignItems: "center", gap: 8, minWidth: 0 }}>
                          <span style={{ width: 7, height: 7, borderRadius: "50%", background: color, flexShrink: 0 }} />
                          <span style={{ font: `600 0.74rem/1 ${fb}`, color: t2, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{p.nombre}</span>
                        </div>
                        <span style={{ font: `700 0.74rem/1 ${fd}`, color: t1 }}>{pct}%</span>
                      </div>
                      <div style={{ height: 6, borderRadius: 9999, background: "#F1F4F7", overflow: "hidden" }}>
                        <div style={{ width: `${pct}%`, height: "100%", borderRadius: 9999, background: color }} />
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
    </>
  );
}
