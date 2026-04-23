"use client";

import { useEffect, useState, useRef } from "react";
import {
  Users, CreditCard, AlertCircle, TrendingDown,
  ArrowUpRight, ArrowDownRight, Send, Target,
} from "lucide-react";
import { supabase } from "@/lib/supabase";
import { getPlanNombre, getRelationRecord } from "@/lib/supabase-relations";

const accent = "#FF6A00";
const fd = "var(--font-inter, 'Inter', sans-serif)";
const fb = "var(--font-inter, 'Inter', sans-serif)";
const t1 = "#1A1D23";
const t2 = "#475569";
const t3 = "#9CA3AF";

const cardBase: React.CSSProperties = {
  background: "#FFFFFF",
  borderRadius: 18,
  boxShadow: "0 20px 25px -5px rgba(0,0,0,0.05), 0 10px 10px -5px rgba(0,0,0,0.02)",
  transition: "box-shadow 0.2s, transform 0.2s",
};

interface RecenteAlumno { id: string; full_name: string; created_at: string; }
interface PlanDist { nombre: string; count: number; }
interface EgresoMontoRow { monto: number | null; }
interface CreatedAtRow { created_at: string; }
interface PlanPrecioRow { planes: unknown; }
interface PlanNombreRow { planes: unknown; }

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

const PLAN_COLORS = ["#FF6A00", "#6366F1", "#22C55E", "#F59E0B", "#EC4899", "#14B8A6"];

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
  const [loading, setLoading] = useState(true);
  const [dateFilter, setDateFilter] = useState<DateFilter>("mes");
  const gymIdRef = useRef<string | null>(null);

  const [activosCount,      setActivosCount]      = useState(0);
  const [totalCount,        setTotalCount]        = useState(0);
  const [ingresoProyectado, setIngresoProyectado] = useState(0);
  const [gastosTotal,       setGastosTotal]       = useState(0);
  const [churnCount,        setChurnCount]        = useState(0);
  const [recientes,         setRecientes]         = useState<RecenteAlumno[]>([]);
  const [captacion5,        setCaptacion5]        = useState<number[]>([0, 0, 0, 0, 0]);
  const [planDist,          setPlanDist]          = useState<PlanDist[]>([]);
  const [prospectos,        setProspectos]        = useState(0);

  const fetchData = async (filter: DateFilter) => {
    setLoading(true);
    let gym_id = gymIdRef.current;
    if (!gym_id) {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) { setLoading(false); return; }
      gym_id = user.id;
      gymIdRef.current = gym_id;
    }

    const { from, to } = getDateRange(filter);
    const today = new Date();
    const thirtyDaysAgo = new Date(today);
    thirtyDaysAgo.setDate(today.getDate() - 30);
    const thirtyStr = thirtyDaysAgo.toISOString().slice(0, 10);

    const [
      { count: total },
      { count: activos },
      { data: todasCreatedAt },
      { data: egresosData },
      { data: recientesData },
      { data: activosConPlan },
      { count: churn },
      { data: activosConNombrePlan },
      { count: prospectosPendientes },
    ] = await Promise.all([
      supabase.from("alumnos").select("id", { count: "exact", head: true }).eq("gym_id", gym_id),
      supabase.from("alumnos").select("id", { count: "exact", head: true }).eq("gym_id", gym_id).eq("status", "activo"),
      supabase.from("alumnos").select("created_at").eq("gym_id", gym_id),
      supabase.from("egresos").select("monto").eq("gym_id", gym_id).gte("fecha", from).lte("fecha", to),
      supabase.from("alumnos").select("id, full_name, created_at").eq("gym_id", gym_id).order("created_at", { ascending: false }).limit(4),
      supabase.from("alumnos").select("planes!plan_id(precio)").eq("gym_id", gym_id).eq("status", "activo"),
      supabase.from("alumnos").select("id", { count: "exact", head: true }).eq("gym_id", gym_id).in("status", ["inactivo", "vencido"]).gte("next_expiration_date", thirtyStr),
      supabase.from("alumnos").select("planes!plan_id(nombre)").eq("gym_id", gym_id).eq("status", "activo"),
      supabase.from("prospectos").select("id", { count: "exact", head: true }).eq("gym_id", gym_id).eq("status", "pendiente"),
    ] as const);

    setTotalCount(total ?? 0);
    setActivosCount(activos ?? 0);
    const proyectado = (activosConPlan ?? []).reduce((sum, row) => {
      const plan = getRelationRecord((row as PlanPrecioRow).planes);
      return sum + (typeof plan?.precio === "number" ? plan.precio : 0);
    }, 0);
    setIngresoProyectado(proyectado);
    setGastosTotal((egresosData ?? []).reduce((sum, row) => sum + ((row as EgresoMontoRow).monto ?? 0), 0));
    setChurnCount(churn ?? 0);
    setRecientes((recientesData ?? []) as RecenteAlumno[]);
    setProspectos(prospectosPendientes ?? 0);

    const months = last5Months();
    const captMap: Record<string, number> = {};
    (todasCreatedAt ?? []).forEach((row) => {
      const m = (row as CreatedAtRow).created_at.slice(0, 7);
      captMap[m] = (captMap[m] || 0) + 1;
    });
    setCaptacion5(months.map(m => captMap[m.key] || 0));

    const planMap: Record<string, number> = {};
    (activosConNombrePlan ?? []).forEach((row) => {
      const nombre = getPlanNombre((row as PlanNombreRow).planes) ?? "Sin plan";
      planMap[nombre] = (planMap[nombre] || 0) + 1;
    });
    const dist = Object.entries(planMap)
      .sort((a, b) => b[1] - a[1])
      .map(([nombre, count]) => ({ nombre, count }));
    setPlanDist(dist);

    setLoading(false);
  };

  useEffect(() => {
    const timer = window.setTimeout(() => {
      void fetchData(dateFilter);
    }, 0);
    return () => window.clearTimeout(timer);
  }, [dateFilter]);

  const sinEgresos  = gastosTotal === 0;
  const balanceNeto = sinEgresos ? ingresoProyectado : ingresoProyectado - gastosTotal;
  const churnRate   = activosCount > 0 ? (churnCount / activosCount) * 100 : 0;
  const churnColor  = churnRate <= 5 ? "#22C55E" : churnRate <= 9 ? "#EAB308" : "#EF4444";
  const churnLabel  = churnRate <= 5 ? "Excelente retención" : churnRate <= 9 ? "Revisar servicio" : "Crítico: fuga";
  const months5     = last5Months();
  const hasCapt     = captacion5.some(v => v > 0);
  const { line: captLine, area: captArea } = captacionPath(captacion5);

  const donutSlices    = planDist.map((p, i) => ({ value: p.count, color: PLAN_COLORS[i % PLAN_COLORS.length] }));
  const donutSegments  = buildDonutSegments(donutSlices);
  const totalDonut     = planDist.reduce((s, p) => s + p.count, 0);

  const hoverOn  = (e: React.MouseEvent<HTMLDivElement>) => {
    (e.currentTarget as HTMLDivElement).style.boxShadow = "0 20px 25px -5px rgba(0,0,0,0.08), 0 8px 10px -6px rgba(0,0,0,0.04)";
    (e.currentTarget as HTMLDivElement).style.transform = "translateY(-2px)";
  };
  const hoverOff = (e: React.MouseEvent<HTMLDivElement>) => {
    (e.currentTarget as HTMLDivElement).style.boxShadow = "0 20px 25px -5px rgba(0,0,0,0.05), 0 10px 10px -5px rgba(0,0,0,0.02)";
    (e.currentTarget as HTMLDivElement).style.transform = "none";
  };

  const filterLabels: { key: DateFilter; label: string }[] = [
    { key: "hoy",    label: "Hoy" },
    { key: "semana", label: "Semana" },
    { key: "mes",    label: "Mes" },
  ];

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 24 }}>

      {/* ── HEADER ── */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: 10 }}>
        <div>
          <p style={{ font: `500 0.68rem/1 ${fb}`, color: t3, textTransform: "uppercase", letterSpacing: "0.1em", marginBottom: 4 }}>Panel de Control</p>
          <h1 style={{ font: `800 1.45rem/1 ${fd}`, color: t1, letterSpacing: "-0.025em" }}>Overview</h1>
        </div>
        <div style={{ display: "flex", gap: 4, background: "#F1F2F6", borderRadius: 12, padding: 3 }}>
          {filterLabels.map(f => (
            <button
              key={f.key}
              onClick={() => setDateFilter(f.key)}
              style={{ padding: "7px 18px", borderRadius: 10, border: "none", font: `600 0.75rem/1 ${fb}`, background: dateFilter === f.key ? "white" : "transparent", color: dateFilter === f.key ? t1 : t3, boxShadow: dateFilter === f.key ? "0 1px 4px rgba(0,0,0,0.10)" : "none", cursor: "pointer", transition: "all 0.15s" }}
            >
              {f.label}
            </button>
          ))}
        </div>
      </div>

      {/* ══════════════════════════════════════════
          ZONA 1 — MÉTRICAS DE SALUD (prioridad alta)
          Asimétrica: MRR grande | Activos medio | Churn medio
      ══════════════════════════════════════════ */}
      <div style={{ display: "grid", gridTemplateColumns: "1.5fr 1fr 1fr", gap: 20 }}>

        {/* MRR — card héroe */}
        <div
          style={{ ...cardBase, padding: "26px 28px", position: "relative", overflow: "hidden", borderLeft: `3px solid ${accent}` }}
          onMouseEnter={hoverOn} onMouseLeave={hoverOff}
        >
          {/* fondo decorativo */}
          <div style={{ position: "absolute", right: -20, top: -20, width: 120, height: 120, borderRadius: "50%", background: `radial-gradient(circle, rgba(255,106,0,0.07) 0%, transparent 70%)`, pointerEvents: "none" }} />
          <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 14 }}>
            <div style={{ width: 36, height: 36, borderRadius: 10, background: "#1A1D23", display: "flex", alignItems: "center", justifyContent: "center" }}>
              <CreditCard size={16} color={accent} />
            </div>
            <span style={{ font: `500 0.78rem/1 ${fb}`, color: t2 }}>Ingreso Proyectado (MRR)</span>
          </div>
          <div style={{ display: "flex", alignItems: "baseline", gap: 6, marginBottom: 8 }}>
            <span style={{ font: `800 2.6rem/1 ${fd}`, color: t1, letterSpacing: "-0.03em" }}>{loading ? "—" : fmt(ingresoProyectado)}</span>
            <span style={{ font: `400 0.78rem/1 ${fb}`, color: t3 }}>/ mes</span>
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 5 }}>
            <ArrowUpRight size={13} color="#22C55E" />
            <span style={{ font: `400 0.72rem/1 ${fb}`, color: t3 }}>Suma de planes activos</span>
          </div>
        </div>

        {/* Alumnos Activos */}
        <div
          style={{ ...cardBase, padding: "22px 24px" }}
          onMouseEnter={hoverOn} onMouseLeave={hoverOff}
        >
          <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 12 }}>
            <div style={{ width: 34, height: 34, borderRadius: 10, background: "#1A1D23", display: "flex", alignItems: "center", justifyContent: "center" }}>
              <Users size={15} color="white" />
            </div>
            <span style={{ font: `500 0.78rem/1 ${fb}`, color: t2 }}>Alumnos Activos</span>
          </div>
          <div style={{ display: "flex", alignItems: "baseline", gap: 5, marginBottom: 8 }}>
            <span style={{ font: `800 2.2rem/1 ${fd}`, color: t1, letterSpacing: "-0.03em" }}>{loading ? "—" : activosCount}</span>
            <span style={{ font: `400 0.75rem/1 ${fb}`, color: t3 }}>miembros</span>
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 5, marginBottom: 10 }}>
            <ArrowUpRight size={12} color="#22C55E" />
            <span style={{ font: `400 0.7rem/1 ${fb}`, color: t3 }}>{loading ? "" : `${totalCount} totales`}</span>
          </div>
          {/* mini barra de ocupación */}
          {totalCount > 0 && (
            <div style={{ height: 4, borderRadius: 9999, background: "#F1F2F6", overflow: "hidden" }}>
              <div style={{ height: "100%", width: `${Math.min(100, (activosCount / totalCount) * 100)}%`, background: accent, borderRadius: 9999, transition: "width 0.6s" }} />
            </div>
          )}
        </div>

        {/* Tasa de Abandono — semáforo */}
        <div
          style={{ ...cardBase, padding: "22px 24px", borderTop: `3px solid ${churnColor}` }}
          onMouseEnter={hoverOn} onMouseLeave={hoverOff}
        >
          <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 12 }}>
            <div style={{ width: 34, height: 34, borderRadius: 10, background: churnColor, display: "flex", alignItems: "center", justifyContent: "center" }}>
              <AlertCircle size={15} color="white" />
            </div>
            <span style={{ font: `500 0.78rem/1 ${fb}`, color: t2 }}>Tasa de Abandono</span>
          </div>
          <div style={{ display: "flex", alignItems: "baseline", gap: 5, marginBottom: 8 }}>
            <span style={{ font: `800 2.2rem/1 ${fd}`, color: loading ? t3 : churnColor, letterSpacing: "-0.03em" }}>
              {loading ? "—" : `${churnRate.toFixed(1)}%`}
            </span>
          </div>
          <div style={{ display: "inline-flex", alignItems: "center", gap: 5, background: `${churnColor}14`, border: `1px solid ${churnColor}30`, borderRadius: 9999, padding: "4px 10px" }}>
            <div style={{ width: 6, height: 6, borderRadius: "50%", background: churnColor }} />
            <span style={{ font: `600 0.68rem/1 ${fb}`, color: churnColor }}>{loading ? "Calculando…" : churnLabel}</span>
          </div>
          <p style={{ font: `400 0.65rem/1.4 ${fb}`, color: t3, marginTop: 10 }}>Alumnos que no renovaron en 30 días</p>
        </div>
      </div>

      {/* ══════════════════════════════════════════
          ZONA 2 — CAPTACIÓN + MIX DE PLANES
          Captación ancho (con badge prospectos) | Donut compacto
      ══════════════════════════════════════════ */}
      <div style={{ display: "grid", gridTemplateColumns: "2.2fr 1fr", gap: 20 }}>

        {/* Captación de Alumnos + Prospectos badge */}
        <div style={{ ...cardBase, padding: "22px 24px" }} onMouseEnter={hoverOn} onMouseLeave={hoverOff}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 20 }}>
            <div>
              <span style={{ font: `800 1rem/1 ${fd}`, color: t1, display: "block", marginBottom: 3 }}>Captación de Alumnos</span>
              <span style={{ font: `400 0.72rem/1 ${fb}`, color: t3 }}>Tendencia últimos 5 meses</span>
            </div>
            {/* Prospectos badge integrado */}
            <div style={{ display: "flex", alignItems: "center", gap: 8, background: "#1A1D23", borderRadius: 12, padding: "10px 16px" }}>
              <Target size={14} color={accent} />
              <div>
                <p style={{ font: `800 1.2rem/1 ${fd}`, color: "white" }}>{loading ? "—" : prospectos}</p>
                <p style={{ font: `400 0.6rem/1 ${fb}`, color: "rgba(255,255,255,0.45)", marginTop: 2, textTransform: "uppercase", letterSpacing: "0.06em" }}>Prospectos</p>
              </div>
            </div>
          </div>

          <svg width="100%" height="130" viewBox="0 0 400 130" preserveAspectRatio="none">
            <defs>
              <linearGradient id="areaGrad" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor={accent} stopOpacity="0.20" />
                <stop offset="100%" stopColor={accent} stopOpacity="0" />
              </linearGradient>
            </defs>
            {[30, 65, 100].map(y => (
              <line key={y} x1="0" y1={y} x2="400" y2={y} stroke="#F1F2F6" strokeWidth="1" />
            ))}
            {hasCapt ? (
              <>
                <path d={captArea} fill="url(#areaGrad)" />
                <path d={captLine} stroke={accent} strokeWidth="2.5" fill="none" strokeLinecap="round" strokeLinejoin="round" />
                {captacion5.map((v, i) => {
                  const max = Math.max(...captacion5, 1);
                  const x = (i / (captacion5.length - 1)) * 400;
                  const y = 120 - (v / max) * 100;
                  return <circle key={i} cx={x} cy={y} r="4" fill="white" stroke={accent} strokeWidth="2" />;
                })}
              </>
            ) : (
              <text x="200" y="72" textAnchor="middle" fill={t3} fontSize="12" fontFamily={fb}>Sin datos registrados aún</text>
            )}
          </svg>

          <div style={{ display: "flex", justifyContent: "space-between", marginTop: 10 }}>
            {months5.map(m => (
              <span key={m.key} style={{ font: `400 0.7rem/1 ${fb}`, color: t3 }}>{m.label}</span>
            ))}
          </div>
        </div>

        {/* Mix de Planes — donut */}
        <div style={{ ...cardBase, padding: "22px 22px" }} onMouseEnter={hoverOn} onMouseLeave={hoverOff}>
          <span style={{ font: `800 1rem/1 ${fd}`, color: t1, display: "block", marginBottom: 4 }}>Mix de Planes</span>
          <span style={{ font: `400 0.72rem/1 ${fb}`, color: t3, display: "block", marginBottom: 18 }}>Distribución de alumnos activos</span>

          {loading || planDist.length === 0 ? (
            <div style={{ display: "flex", alignItems: "center", justifyContent: "center", height: 112 }}>
              <p style={{ font: `400 0.8rem/1 ${fb}`, color: t3 }}>{loading ? "Cargando…" : "Sin datos"}</p>
            </div>
          ) : (
            <>
              <div style={{ display: "flex", alignItems: "center", gap: 16, marginBottom: 18 }}>
                <svg width="148" height="148" viewBox="0 0 148 148" style={{ flexShrink: 0 }}>
                  <defs>
                    {PLAN_COLORS.map((color, idx) => (
                      <linearGradient key={`dg${idx}`} id={`dg${idx}`} x1="0" y1="0" x2="148" y2="148" gradientUnits="userSpaceOnUse">
                        <stop offset="0%" stopColor={color} stopOpacity="0.65" />
                        <stop offset="100%" stopColor={color} stopOpacity="1" />
                      </linearGradient>
                    ))}
                  </defs>
                  {/* track ring */}
                  <circle
                    cx={DONUT_CX} cy={DONUT_CY} r={DONUT_R}
                    fill="none" stroke="#F1F2F6" strokeWidth="14"
                  />
                  {/* segments via stroke-dasharray */}
                  {donutSegments.map((seg, i) => (
                    <circle
                      key={i}
                      cx={DONUT_CX} cy={DONUT_CY} r={DONUT_R}
                      fill="none"
                      stroke={`url(#dg${i})`}
                      strokeWidth="14"
                      strokeDasharray={seg.dasharray}
                      strokeDashoffset={seg.dashoffset}
                      strokeLinecap="round"
                      transform={`rotate(-90 ${DONUT_CX} ${DONUT_CY})`}
                      style={{ transition: "stroke-dasharray 0.5s ease" }}
                    />
                  ))}
                  {/* center label */}
                  <circle cx={DONUT_CX} cy={DONUT_CY} r="35" fill="white" />
                  <text x={DONUT_CX} y="70" textAnchor="middle" fill={t1} fontSize="17" fontWeight="800" fontFamily={fd}>{totalDonut}</text>
                  <text x={DONUT_CX} y="83" textAnchor="middle" fill={t3} fontSize="9" fontFamily={fb}>activos</text>
                </svg>
                <div style={{ display: "flex", flexDirection: "column", gap: 8, flex: 1 }}>
                  {planDist.map((p, i) => {
                    const color = PLAN_COLORS[i % PLAN_COLORS.length];
                    const pct = totalDonut > 0 ? ((p.count / totalDonut) * 100).toFixed(0) : "0";
                    return (
                      <div key={p.nombre}>
                        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 4 }}>
                          <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                            <div style={{ width: 6, height: 6, borderRadius: "50%", background: color, flexShrink: 0 }} />
                            <span style={{ font: `500 0.72rem/1 ${fb}`, color: t2, maxWidth: 80, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{p.nombre}</span>
                          </div>
                          <span style={{ font: `700 0.72rem/1 ${fd}`, color: t1 }}>{pct}%</span>
                        </div>
                        <div style={{ height: 3, borderRadius: 9999, background: "#F1F2F6", overflow: "hidden" }}>
                          <div style={{ height: "100%", width: `${pct}%`, background: color, borderRadius: 9999 }} />
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            </>
          )}
        </div>
      </div>

      {/* ══════════════════════════════════════════
          ZONA 3 — OPERATIVAS (prioridad baja)
          Registros recientes | Balance Neto
      ══════════════════════════════════════════ */}
      <div style={{ display: "grid", gridTemplateColumns: "1.1fr 1fr", gap: 20 }}>

        {/* Registros Recientes */}
        <div style={{ ...cardBase, padding: "22px 24px" }} onMouseEnter={hoverOn} onMouseLeave={hoverOff}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 16 }}>
            <span style={{ font: `800 1rem/1 ${fd}`, color: t1 }}>Registros Recientes</span>
            <span style={{ font: `500 0.68rem/1 ${fb}`, color: t3, background: "#F1F2F6", borderRadius: 9999, padding: "4px 10px" }}>Últimos ingresados</span>
          </div>
          {loading ? (
            <p style={{ color: t3, font: `400 0.8rem/1 ${fb}` }}>Cargando...</p>
          ) : recientes.length === 0 ? (
            <p style={{ color: t3, font: `400 0.8rem/1 ${fb}` }}>Sin registros recientes.</p>
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: 0 }}>
              {recientes.map((r, i) => (
                <div
                  key={r.id}
                  style={{ display: "flex", alignItems: "center", gap: 12, padding: "11px 0", borderBottom: i < recientes.length - 1 ? "1px solid rgba(0,0,0,0.05)" : "none" }}
                >
                  <div style={{ width: 36, height: 36, borderRadius: "50%", background: "#1A1D23", color: "white", display: "flex", alignItems: "center", justifyContent: "center", font: `700 0.7rem/1 ${fd}`, flexShrink: 0 }}>
                    {initials(r.full_name)}
                  </div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <p style={{ font: `600 0.85rem/1 ${fd}`, color: t1, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{r.full_name}</p>
                    <p style={{ font: `400 0.68rem/1 ${fb}`, color: t3, marginTop: 3 }}>{new Date(r.created_at).toLocaleDateString("es-AR", { day: "numeric", month: "short", year: "numeric" })}</p>
                  </div>
                  <div style={{ width: 28, height: 28, borderRadius: 8, background: "#F1F2F6", display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer" }}>
                    <Send size={12} color={t3} />
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Balance Neto */}
        <div
          style={{ ...cardBase, padding: "22px 24px", borderLeft: sinEgresos ? "none" : `3px solid ${balanceNeto >= 0 ? "#22C55E" : "#EF4444"}` }}
          onMouseEnter={hoverOn} onMouseLeave={hoverOff}
        >
          <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 14 }}>
            <div style={{ width: 34, height: 34, borderRadius: 10, background: "#1A1D23", display: "flex", alignItems: "center", justifyContent: "center" }}>
              <TrendingDown size={15} color={sinEgresos ? "white" : balanceNeto >= 0 ? "#22C55E" : "#EF4444"} />
            </div>
            <span style={{ font: `500 0.78rem/1 ${fb}`, color: t2 }}>Balance Neto</span>
          </div>

          {sinEgresos ? (
            <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
              <span style={{ font: `800 2rem/1 ${fd}`, color: t3, letterSpacing: "-0.03em" }}>—</span>
              <div style={{ background: "rgba(249,115,22,0.06)", border: "1px solid rgba(249,115,22,0.18)", borderRadius: 12, padding: "14px 16px" }}>
                <p style={{ font: `600 0.78rem/1.4 ${fd}`, color: accent, marginBottom: 4 }}>Recordatorio</p>
                <p style={{ font: `400 0.72rem/1.5 ${fb}`, color: t2 }}>
                  Cargá tus egresos del mes para calcular el balance real de tu negocio.
                </p>
              </div>
            </div>
          ) : (
            <div>
              <div style={{ display: "flex", alignItems: "baseline", gap: 5, marginBottom: 8 }}>
                <span style={{ font: `800 2rem/1 ${fd}`, color: balanceNeto >= 0 ? "#22C55E" : "#EF4444", letterSpacing: "-0.03em" }}>
                  {loading ? "—" : fmt(Math.abs(balanceNeto))}
                </span>
              </div>
              <div style={{ display: "flex", alignItems: "center", gap: 5, marginBottom: 14 }}>
                {balanceNeto >= 0 ? <ArrowUpRight size={13} color="#22C55E" /> : <ArrowDownRight size={13} color="#EF4444" />}
                <span style={{ font: `500 0.72rem/1 ${fb}`, color: t2 }}>{balanceNeto >= 0 ? "Superávit" : "Déficit"}</span>
              </div>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
                <div style={{ background: "rgba(34,197,94,0.06)", borderRadius: 10, padding: "10px 12px" }}>
                  <p style={{ font: `400 0.65rem/1 ${fb}`, color: t3, marginBottom: 4, textTransform: "uppercase", letterSpacing: "0.07em" }}>Ingresos</p>
                  <p style={{ font: `700 0.9rem/1 ${fd}`, color: "#22C55E" }}>{fmt(ingresoProyectado)}</p>
                </div>
                <div style={{ background: "rgba(239,68,68,0.06)", borderRadius: 10, padding: "10px 12px" }}>
                  <p style={{ font: `400 0.65rem/1 ${fb}`, color: t3, marginBottom: 4, textTransform: "uppercase", letterSpacing: "0.07em" }}>Egresos</p>
                  <p style={{ font: `700 0.9rem/1 ${fd}`, color: "#EF4444" }}>{fmt(gastosTotal)}</p>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>

    </div>
  );
}
