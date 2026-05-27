"use client";

import { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import { Users, CheckCircle, XCircle, Clock, TrendingUp, ScanLine, ChevronRight, Dumbbell, UserPlus, Unlock } from "lucide-react";
import Link from "next/link";
import { getTodayDate } from "@/lib/date-utils";
import { supabase } from "@/lib/supabase";
import { getCachedProfile, getPageCache, setPageCache, invalidateDashboardCache, invalidateAsistenciasCache } from "@/lib/gym-cache";
import { useBrandConfirm } from "@/components/brand-confirm";

const fd = "var(--font-inter, 'Inter', sans-serif)";
const fb = "var(--font-inter, 'Inter', sans-serif)";
const t1 = "#1A1D23";
const t2 = "#6B7280";
const t3 = "#9CA3AF";
const card: React.CSSProperties = {
  background: "#FFFFFF",
  border: "1px solid rgba(0,0,0,0.05)",
  borderRadius: 18,
  boxShadow: "0 2px 8px rgba(0,0,0,0.05)",
};

interface Presente {
  id: string;
  alumno_id: string;
  hora: string;
  clase_id: string | null;
  gym_classes: { class_name: string } | null;
  alumnos: { full_name: string; planes: { nombre: string; accent_color: string | null } | null } | null;
}

interface Ausente {
  id: string;
  full_name: string;
  next_expiration_date: string | null;
  planes: { nombre: string; accent_color: string | null } | null;
}

interface TodayClass {
  id: string;
  class_name: string;
  start_time: string;
  max_capacity: number;
  reservas: number;
}

interface ClasePrueba {
  id: string;
  full_name: string;
  phone: string | null;
  clase_gratis_status: string;
}

function initials(name: string) {
  return name.split(" ").slice(0, 2).map(w => w[0]).join("").toUpperCase();
}

function fmt2(s: string) {
  return s.slice(0, 5);
}

export default function AsistenciasPage() {
  const confirm = useBrandConfirm();
  const [loading, setLoading] = useState(true);
  const [presentes, setPresentes] = useState<Presente[]>([]);
  const [ausentes, setAusentes] = useState<Ausente[]>([]);
  const [todayCount, setTodayCount] = useState(0);
  const [totalMonth, setTotalMonth] = useState(0);
  const [weeklyAvg, setWeeklyAvg] = useState(0);
  const [tab, setTab] = useState<"presentes" | "ausentes">("presentes");
  const [todayClasses, setTodayClasses] = useState<TodayClass[]>([]);
  const [clasesPrueba, setClasesPrueba] = useState<ClasePrueba[]>([]);
  const [gymId, setGymId] = useState<string | null>(null);
  const [isMobile, setIsMobile] = useState(false);
  const [converting, setConverting] = useState<string | null>(null);
  const [convertModal, setConvertModal] = useState<ClasePrueba | null>(null);
  const [convertDni, setConvertDni] = useState("");
  const [checkingIn, setCheckingIn] = useState<Set<string>>(new Set());
  const [checkinError, setCheckinError] = useState<string | null>(null);
  const [deletingAsist, setDeletingAsist] = useState<Set<string>>(new Set());
  const router = useRouter();
  const [ausentesLoading, setAusentesLoading] = useState(false);
  const [ausentesLoaded, setAusentesLoaded] = useState(false);
  const [emergencyLoading, setEmergencyLoading] = useState(false);
  const [emergencyStatus, setEmergencyStatus] = useState<"idle" | "pending" | "consumed" | "expired" | "error">("idle");
  const [molineteModalOpen, setMolineteModalOpen] = useState(false);
  const emergencyPollRef = useState<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    const check = () => setIsMobile(window.innerWidth < 768);
    check();
    window.addEventListener("resize", check);
    return () => window.removeEventListener("resize", check);
  }, []);

  const today = getTodayDate();

  const applySnapshot = useCallback((snapshot: {
    todayCount: number;
    totalMonth: number;
    weeklyAvg: number;
    presentes: Presente[];
    todayClasses: TodayClass[];
  }) => {
    setTodayCount(snapshot.todayCount);
    setTotalMonth(snapshot.totalMonth);
    setWeeklyAvg(snapshot.weeklyAvg);
    setPresentes(snapshot.presentes);
    setTodayClasses(snapshot.todayClasses);
  }, []);

  const fetchAll = useCallback(async () => {
    setLoading(true);
    const profile = await getCachedProfile();
    if (!profile) { setLoading(false); return; }
    setGymId(profile.gymId);
    setAusentes([]);
    setAusentesLoaded(false);

    const cacheKey = `asistencias_${profile.gymId}_${today}`;
    const cached = getPageCache<{
      todayCount: number;
      totalMonth: number;
      weeklyAvg: number;
      presentes: Presente[];
      todayClasses: TodayClass[];
    }>(cacheKey);
    if (cached) {
      applySnapshot(cached);
      setLoading(false);
    }

    const dayOfWeek = new Date().getDay();

    const monthStart = `${today.slice(0, 7)}-01`;
    const [presentesRes, clasesRes, pruebaRes, monthlyRes] = await Promise.all([
      supabase
        .from("asistencias")
        .select("id, alumno_id, hora, clase_id, gym_classes(*), alumnos(full_name, planes(nombre, accent_color))")
        .eq("gym_id", profile.gymId)
        .eq("fecha", today)
        .order("hora", { ascending: false }),
      supabase
        .from("gym_classes")
        .select("id, class_name, start_time, max_capacity, class_reservations!class_id(id)")
        .eq("gym_id", profile.gymId)
        .eq("day_of_week", dayOfWeek)
        .order("start_time"),
      supabase
        .from("prospectos")
        .select("id, full_name, phone, clase_gratis_status")
        .eq("gym_id", profile.gymId)
        .eq("clase_gratis_date", today)
        .in("clase_gratis_status", ["registrado", "asistio", "no_show"]),
      supabase
        .from("asistencias")
        .select("fecha")
        .eq("gym_id", profile.gymId)
        .gte("fecha", monthStart)
        .lte("fecha", today),
    ]);

    const presenteRows = (presentesRes.data ?? []) as unknown as Presente[];
    const monthlyRows = (monthlyRes.data ?? []) as unknown as { fecha: string }[];

    // todayCount directly from presentes list (unified source)
    const todayCountValue = presenteRows.length;
    const totalMonthValue = monthlyRows.length;

    // Weekly avg (last 7 days)
    const dailyMap: Record<string, number> = {};
    for (const row of monthlyRows) {
      dailyMap[row.fecha] = (dailyMap[row.fecha] ?? 0) + 1;
    }
    const start = new Date(monthStart);
    const end = new Date(today);
    const dailyCounts: number[] = [];
    for (let d = new Date(start); d <= end; d.setDate(d.getDate() + 1)) {
      const key = d.toISOString().slice(0, 10);
      dailyCounts.push(dailyMap[key] ?? 0);
    }
    const last7 = dailyCounts.slice(-7);
    const weeklyAvgValue = last7.length > 0 ? Math.round(last7.reduce((s, c) => s + c, 0) / last7.length) : 0;

    setTodayCount(todayCountValue);
    setTotalMonth(totalMonthValue);
    setWeeklyAvg(weeklyAvgValue);

    const rawClases = (clasesRes.data ?? []) as unknown as Array<{
      id: string; class_name: string; start_time: string; max_capacity: number;
      class_reservations: Array<{ id: string }>;
    }>;
    const nextTodayClasses = rawClases.map(c => ({
      id: c.id,
      class_name: c.class_name,
      start_time: c.start_time,
      max_capacity: c.max_capacity,
      reservas: c.class_reservations?.length ?? 0,
    }));
    setTodayClasses(nextTodayClasses);

    setClasesPrueba((pruebaRes.data ?? []) as unknown as ClasePrueba[]);

    setPresentes(presenteRows);
    setPageCache(cacheKey, {
      todayCount: todayCountValue,
      totalMonth: totalMonthValue,
      weeklyAvg: weeklyAvgValue,
      presentes: presenteRows,
      todayClasses: nextTodayClasses,
    });

    // Load ausentes eagerly so the counter is populated on initial render
    const presenteIds = new Set(presenteRows.map(p => p.alumno_id));
    const { data: ausentesData } = await supabase
      .from("alumnos")
      .select("id, full_name, next_expiration_date, planes!plan_id(nombre, accent_color)")
      .eq("gym_id", profile.gymId)
      .eq("status", "activo")
      .is("deleted_at", null)
      .or(`next_expiration_date.is.null,next_expiration_date.gte.${today}`);
    const ausenteRows = (ausentesData ?? []) as unknown as Ausente[];
    setAusentes(ausenteRows.filter(a => !presenteIds.has(a.id)));
    setAusentesLoaded(true);

    setLoading(false);
  }, [today, applySnapshot]);

  const loadAusentes = useCallback(async (forceGymId?: string) => {
    const gid = forceGymId ?? gymId;
    if (!gid || ausentesLoaded || ausentesLoading) return;
    setAusentesLoading(true);
    const { data } = await supabase
      .from("alumnos")
      .select("id, full_name, next_expiration_date, planes!plan_id(nombre, accent_color)")
      .eq("gym_id", gid)
      .eq("status", "activo")
      .is("deleted_at", null)
      .or(`next_expiration_date.is.null,next_expiration_date.gte.${today}`);
    const presenteIds = new Set(presentes.map(p => p.alumno_id));
    const activos = (data ?? []) as unknown as Ausente[];
    setAusentes(activos.filter(a => !presenteIds.has(a.id)));
    setAusentesLoaded(true);
    setAusentesLoading(false);
  }, [gymId, ausentesLoaded, ausentesLoading, presentes, today]);

  const handleDeleteAsist = useCallback(async (asistId: string) => {
    setDeletingAsist(prev => new Set(prev).add(asistId));
    setPresentes(prev => prev.filter(p => p.id !== asistId));
    setTodayCount(prev => Math.max(0, prev - 1));
    await fetch(`/api/admin/asistencias/${asistId}`, { method: "DELETE" });
    setDeletingAsist(prev => { const s = new Set(prev); s.delete(asistId); return s; });
  }, []);

  const markClasePrueba = useCallback(async (id: string, status: "asistio" | "no_show") => {
    setClasesPrueba(prev => prev.map(p => p.id === id ? { ...p, clase_gratis_status: status } : p));
    await supabase.from("prospectos").update({ clase_gratis_status: status }).eq("id", id);
  }, []);

  const markPresente = useCallback(async (ausente: Ausente) => {
    if (checkingIn.has(ausente.id)) return;

    // — Optimistic update —
    const hora = new Date().toTimeString().slice(0, 8);
    const optimistic: Presente = {
      id: `opt-${ausente.id}`,
      alumno_id: ausente.id,
      hora,
      clase_id: null,
      gym_classes: null,
      alumnos: { full_name: ausente.full_name, planes: ausente.planes as { nombre: string; accent_color: string | null } | null },
    };
    setCheckingIn(prev => new Set(prev).add(ausente.id));
    setAusentes(prev => prev.filter(a => a.id !== ausente.id));
    setPresentes(prev => [optimistic, ...prev]);
    setTodayCount(prev => prev + 1);
    setCheckinError(null);

    // — API call in background —
    const res = await fetch("/api/admin/checkin-manual", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ alumno_id: ausente.id }),
    }).catch(() => null);

    setCheckingIn(prev => { const s = new Set(prev); s.delete(ausente.id); return s; });

    if (!res?.ok) {
      // — Revert on failure —
      setPresentes(prev => prev.filter(p => p.alumno_id !== ausente.id));
      setAusentes(prev => [ausente, ...prev]);
      setTodayCount(prev => prev - 1);
      const data = await res?.json().catch(() => null) as { error?: string } | null;
      setCheckinError(data?.error ?? "No se pudo registrar la asistencia.");
      window.setTimeout(() => setCheckinError(null), 4000);
    } else {
      invalidateAsistenciasCache();
      invalidateDashboardCache();
    }
  }, [checkingIn]);

  const convertirProspecto = useCallback(async (p: ClasePrueba, dni: string) => {
    if (!gymId || converting) return;
    setConverting(p.id);
    setConvertModal(null);
    const defaultExpiry = new Date();
    defaultExpiry.setDate(defaultExpiry.getDate() + 30);
    const expiryStr = defaultExpiry.toISOString().slice(0, 10);

    const { data: alumno, error } = await supabase.from("alumnos").insert({
      gym_id:               gymId,
      full_name:            p.full_name,
      phone:                p.phone ?? null,
      dni:                  dni.replace(/\D/g, "") || null,
      status:               "activo",
      next_expiration_date: expiryStr,
    }).select("id").single();
    if (!error && alumno) {
      await Promise.all([
        supabase.from("prospectos")
          .update({ clase_gratis_status: "convertido", status: "contactado" })
          .eq("id", p.id),
        fetch("/api/alumno/send-welcome", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ alumno_id: alumno.id, type: "welcome" }),
        }),
      ]);
      router.push("/dashboard/alumnos");
    }
    setConverting(null);
  }, [gymId, converting, router]);

  useEffect(() => {
    const timeoutId = window.setTimeout(() => {
      void fetchAll();
    }, 0);

    return () => window.clearTimeout(timeoutId);
  }, [fetchAll]);

  const handleEmergencyOpen = async () => {
    setEmergencyLoading(true);
    setEmergencyStatus("idle");
    if (emergencyPollRef[0]) clearInterval(emergencyPollRef[0]);

    const res = await fetch("/api/admin/molinete-emergency", { method: "POST" });
    setEmergencyLoading(false);

    if (!res.ok) {
      const data = await res.json().catch(() => ({})) as { error?: string; message?: string };
      if (data.error === "no_molinete") {
        setMolineteModalOpen(true);
        return;
      }
      setEmergencyStatus("error");
      return;
    }

    setEmergencyStatus("pending");

    // Poll every 2 seconds for up to 45s to detect when hardware consumed the token
    const interval = setInterval(async () => {
      const r = await fetch("/api/admin/molinete-emergency");
      if (!r.ok) return;
      const d = await r.json() as { status: string };
      if (d.status === "consumed") {
        setEmergencyStatus("consumed");
        clearInterval(interval);
      } else if (d.status === "expired" || d.status === "none") {
        setEmergencyStatus("expired");
        clearInterval(interval);
      }
    }, 2000);
    emergencyPollRef[0] = interval;
    // Safety: always clear after 50s
    setTimeout(() => { clearInterval(interval); setEmergencyStatus(s => s === "pending" ? "expired" : s); }, 50_000);
  };

  const scrollToSection = (targetId: string) => {
    window.requestAnimationFrame(() => {
      const element = document.getElementById(targetId);
      if (!element) return;
      element.scrollIntoView({ behavior: "smooth", block: "start" });
    });
  };

  const jumpToSection = async (
    targetId: string,
    nextTab?: "presentes" | "ausentes",
  ) => {
    if (nextTab) {
      setTab(nextTab);
      if (nextTab === "ausentes") {
        await loadAusentes();
      }
    }
    scrollToSection(targetId);
  };



  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>

      {/* Modal: No molinete configurado */}
      {molineteModalOpen && (
        <div style={{
          position: "fixed", inset: 0, zIndex: 50,
          background: "rgba(0,0,0,0.5)",
          display: "flex", alignItems: "center", justifyContent: "center",
          padding: "20px"
        }}>
          <div style={{
            background: "#FFFFFF", borderRadius: 16,
            boxShadow: "0 20px 60px rgba(0,0,0,0.3)",
            padding: "32px 24px", maxWidth: 420, width: "100%"
          }}>
            <div style={{ textAlign: "center", marginBottom: 24 }}>
              <div style={{
                width: 64, height: 64, borderRadius: "50%",
                background: "rgba(220,38,38,0.1)", margin: "0 auto 16px",
                display: "flex", alignItems: "center", justifyContent: "center"
              }}>
                <Unlock size={32} color="#DC2626" />
              </div>
              <h2 style={{ font: `700 1.25rem/1.2 ${fd}`, color: "#1A1D23", margin: "0 0 12px" }}>
                Molinete no configurado
              </h2>
              <p style={{ font: `400 0.9rem/1.5 ${fb}`, color: "#6B7280", margin: 0 }}>
                No hay API keys de molinete generadas. Necesitás crear una para habilitar la función de apertura de puerta.
              </p>
            </div>

            <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
              <button
                onClick={() => { setMolineteModalOpen(false); router.push("/dashboard/ajustes?tab=equipo"); }}
                style={{
                  padding: "12px 16px", borderRadius: 12, border: "none",
                  background: "#FF7A18", color: "white", font: `600 0.9rem/1 ${fd}`,
                  cursor: "pointer", width: "100%", transition: "background 0.2s"
                }}
                onMouseEnter={e => e.currentTarget.style.background = "#E65A00"}
                onMouseLeave={e => e.currentTarget.style.background = "#FF7A18"}
              >
                Ir a Configuración
              </button>
              <button
                onClick={() => setMolineteModalOpen(false)}
                style={{
                  padding: "12px 16px", borderRadius: 12, border: "1px solid #E5E7EB",
                  background: "transparent", color: "#6B7280", font: `600 0.9rem/1 ${fd}`,
                  cursor: "pointer", width: "100%", transition: "all 0.2s"
                }}
                onMouseEnter={e => { e.currentTarget.style.background = "#F9FAFB"; }}
                onMouseLeave={e => { e.currentTarget.style.background = "transparent"; }}
              >
                Cerrar
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Header */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: 10 }}>
        <div>
          <p style={{ font: `500 0.68rem/1 ${fb}`, color: t3, textTransform: "uppercase", letterSpacing: "0.1em", marginBottom: 4 }}>Hoy · {new Date().toLocaleDateString("es-AR", { weekday: "long", day: "numeric", month: "long" })}</p>
          <h1 style={{ font: `800 1.45rem/1 ${fd}`, color: t1, letterSpacing: "-0.025em" }}>Asistencias</h1>
        </div>
        <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
          <button
            onClick={handleEmergencyOpen}
            disabled={emergencyLoading || emergencyStatus === "pending"}
            title="Envía una señal de apertura al molinete. Requiere hardware con polling activo."
            style={{
              display: "flex", alignItems: "center", gap: 7, padding: "9px 14px",
              background: emergencyStatus === "consumed" ? "#16A34A" : emergencyStatus === "expired" || emergencyStatus === "error" ? "#DC2626" : emergencyStatus === "pending" ? "#D97706" : "rgba(220,38,38,0.08)",
              color: emergencyStatus === "idle" ? "#DC2626" : "white",
              border: emergencyStatus === "idle" ? "1px solid rgba(220,38,38,0.25)" : "none",
              borderRadius: 12, font: `600 0.8rem/1 ${fd}`, cursor: (emergencyLoading || emergencyStatus === "pending") ? "not-allowed" : "pointer",
              opacity: (emergencyLoading || emergencyStatus === "pending") ? 0.85 : 1, transition: "background 0.2s",
            }}
          >
            <Unlock size={14} />
            {emergencyStatus === "pending" ? "Esperando hardware…" : emergencyStatus === "consumed" ? "¡Puerta abierta!" : emergencyStatus === "expired" ? "Sin respuesta" : emergencyStatus === "error" ? "Error" : "Abrir Molinete"}
          </button>
          <Link href="/dashboard/scanner" style={{ display: "flex", alignItems: "center", gap: 8, padding: "9px 16px", background: "#1A1D23", color: "white", borderRadius: 12, textDecoration: "none", font: `600 0.8rem/1 ${fd}` }}>
            <ScanLine size={15} /> Escáner QR
          </Link>
        </div>
      </div>

      {/* Stats row */}
      <div style={{ display: "grid", gridTemplateColumns: isMobile ? "1fr 1fr" : "1fr 1fr 1fr 1fr", gap: 12 }}>
        {[
          {
            label: "Presentes hoy",
            value: loading ? "—" : todayCount,
            icon: <CheckCircle size={15} color="#FF6A00" />,
            bg: "rgba(255,106,0,0.07)",
            color: "#FF6A00",
            action: () => void jumpToSection("asistencias-listado", "presentes"),
          },
          {
            label: "Ausentes hoy",
            value: loading ? "—" : ausentes.length,
            icon: <XCircle size={15} color="#EF4444" />,
            bg: "rgba(239,68,68,0.07)",
            color: "#EF4444",
            action: () => void jumpToSection("asistencias-listado", "ausentes"),
          },
          {
            label: "Total del mes",
            value: loading ? "—" : totalMonth,
            icon: <TrendingUp size={15} color="#6366F1" />,
            bg: "rgba(99,102,241,0.07)",
            color: "#6366F1",
            action: () => void jumpToSection("asistencias-diaria"),
          },
          {
            label: "Prom. semanal",
            value: loading ? "—" : weeklyAvg,
            icon: <Users size={15} color="#0EA5E9" />,
            bg: "rgba(14,165,233,0.07)",
            color: "#0EA5E9",
            action: () => void jumpToSection("asistencias-pico"),
          },
        ].map(s => (
          <button
            key={s.label}
            type="button"
            onClick={s.action}
            style={{
              ...card,
              padding: "16px 18px",
              textAlign: "left",
              cursor: "pointer",
              transition: "transform 0.14s ease, box-shadow 0.14s ease, border-color 0.14s ease",
            }}
            onMouseEnter={(event) => {
              event.currentTarget.style.transform = "translateY(-2px)";
              event.currentTarget.style.boxShadow = "0 10px 22px rgba(15,23,42,0.10)";
              event.currentTarget.style.borderColor = "rgba(255,106,0,0.16)";
            }}
            onMouseLeave={(event) => {
              event.currentTarget.style.transform = "translateY(0)";
              event.currentTarget.style.boxShadow = card.boxShadow as string;
              event.currentTarget.style.borderColor = "rgba(0,0,0,0.05)";
            }}
          >
            <div style={{ width: 32, height: 32, borderRadius: 10, background: s.bg, display: "flex", alignItems: "center", justifyContent: "center", marginBottom: 10 }}>{s.icon}</div>
            <p style={{ font: `800 1.6rem/1 ${fd}`, color: t1, letterSpacing: "-0.03em", marginBottom: 4 }}>{s.value}</p>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10 }}>
              <p style={{ font: `400 0.68rem/1 ${fb}`, color: t3 }}>{s.label}</p>
              <span style={{ font: `700 0.66rem/1 ${fb}`, color: s.color, whiteSpace: "nowrap" }}>Ver detalle</span>
            </div>
          </button>
        ))}
      </div>

      {/* Clases de Hoy */}
      {(todayClasses.length > 0 || loading) && (
        <div>
          <p style={{ font: `700 0.78rem/1 ${fd}`, color: t1, marginBottom: 10, letterSpacing: "-0.01em" }}>
            Clases de hoy
          </p>
          <div style={{ display: "flex", gap: 10, overflowX: "auto", paddingBottom: 4 }}>
            {loading
              ? [1, 2, 3].map(i => (
                  <div key={i} style={{ ...card, minWidth: 148, padding: "14px 16px", flexShrink: 0, background: "#F8F9FB" }} />
                ))
              : todayClasses.map(c => {
                  const pct = c.max_capacity > 0 ? c.reservas / c.max_capacity : 0;
                  const full = pct >= 1;
                  const near = pct >= 0.75 && !full;
                  const fillColor = full ? "#EF4444" : near ? "#F59E0B" : "#FF6A00";
                  return (
                    <div key={c.id} style={{ ...card, minWidth: 148, padding: "14px 16px", flexShrink: 0 }}>
                      <div style={{ display: "flex", alignItems: "center", gap: 7, marginBottom: 10 }}>
                        <div style={{ width: 28, height: 28, borderRadius: 8, background: "rgba(255,106,0,0.08)", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                          <Dumbbell size={13} color="#FF6A00" />
                        </div>
                        <p style={{ font: `700 0.8rem/1.2 ${fd}`, color: t1, overflow: "hidden", display: "-webkit-box", WebkitLineClamp: 2, WebkitBoxOrient: "vertical" }}>
                          {c.class_name}
                        </p>
                      </div>
                      <p style={{ font: `500 0.68rem/1 ${fb}`, color: t3, marginBottom: 8 }}>
                        {c.start_time.slice(0, 5)}h
                      </p>
                      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 6 }}>
                        <span style={{ font: `800 1rem/1 ${fd}`, color: fillColor }}>
                          {c.reservas}
                          <span style={{ font: `400 0.65rem/1 ${fb}`, color: t3 }}>/{c.max_capacity}</span>
                        </span>
                        <span style={{ font: `500 0.6rem/1 ${fb}`, color: t3 }}>cupos</span>
                      </div>
                      <div style={{ height: 4, background: "#F1F2F6", borderRadius: 9999, overflow: "hidden" }}>
                        <div style={{ width: `${Math.min(pct * 100, 100)}%`, height: "100%", background: fillColor, borderRadius: 9999, transition: "width 0.4s ease" }} />
                      </div>
                    </div>
                  );
                })}
          </div>
        </div>
      )}

      {/* Clase de Prueba Hoy */}
      <div>
        <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 10 }}>
          <p style={{ font: `700 0.78rem/1 ${fd}`, color: t1, letterSpacing: "-0.01em" }}>Clase de prueba hoy</p>
          <span style={{ font: `600 0.66rem/1 ${fb}`, color: "#EC4899", background: "rgba(236,72,153,0.08)", border: "1px solid rgba(236,72,153,0.2)", borderRadius: 9999, padding: "2px 8px" }}>
            {clasesPrueba.length}
          </span>
        </div>
        {loading ? (
          <div style={{ ...card, padding: "16px 20px" }}>
            <p style={{ font: `400 0.78rem/1 ${fb}`, color: t3 }}>Cargando...</p>
          </div>
        ) : clasesPrueba.length === 0 ? (
          <div style={{ ...card, padding: "18px 20px", display: "flex", alignItems: "center", gap: 10 }}>
            <span style={{ fontSize: 18 }}>🎯</span>
            <p style={{ font: `400 0.8rem/1.4 ${fb}`, color: t3 }}>No hay alumnos para su clase de prueba hoy.</p>
          </div>
        ) : (
          <div style={{ ...card, overflow: "hidden" }}>
            {clasesPrueba.map((p, i) => (
              <div key={p.id} style={{ display: "flex", alignItems: "center", gap: 12, padding: "12px 18px", borderBottom: i < clasesPrueba.length - 1 ? "1px solid rgba(0,0,0,0.04)" : "none" }}>
                <div style={{ width: 34, height: 34, borderRadius: "50%", background: "linear-gradient(135deg,#EC4899,#8B5CF6)", display: "flex", alignItems: "center", justifyContent: "center", font: `700 0.62rem/1 ${fd}`, color: "white", flexShrink: 0 }}>
                  {initials(p.full_name)}
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <p style={{ font: `600 0.875rem/1 ${fd}`, color: t1, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{p.full_name}</p>
                  <p style={{ font: `400 0.7rem/1 ${fb}`, color: t3, marginTop: 2 }}>{p.phone ?? "Sin teléfono"}</p>
                </div>
                {p.clase_gratis_status === "registrado" ? (
                  <div style={{ display: "flex", gap: 6, flexShrink: 0 }}>
                    <button onClick={() => markClasePrueba(p.id, "asistio")} style={{ padding: "5px 10px", borderRadius: 8, border: "1px solid rgba(16,185,129,0.35)", background: "rgba(16,185,129,0.08)", color: "#10B981", font: `700 0.72rem/1 ${fb}`, cursor: "pointer" }}>✓ Asistió</button>
                    <button onClick={() => markClasePrueba(p.id, "no_show")} style={{ padding: "5px 10px", borderRadius: 8, border: "1px solid rgba(156,163,175,0.25)", background: "rgba(156,163,175,0.06)", color: "#9CA3AF", font: `700 0.72rem/1 ${fb}`, cursor: "pointer" }}>✗ No vino</button>
                  </div>
                ) : p.clase_gratis_status === "asistio" ? (
                  <div style={{ display: "flex", gap: 6, flexShrink: 0, alignItems: "center" }}>
                    <span style={{ font: `700 0.72rem/1 ${fb}`, color: "#10B981", background: "rgba(16,185,129,0.08)", border: "1px solid rgba(16,185,129,0.2)", borderRadius: 8, padding: "5px 10px" }}>✓ Asistió</span>
                    <button
                      onClick={() => { setConvertModal(p); setConvertDni(""); }}
                      disabled={converting === p.id}
                      style={{ display: "flex", alignItems: "center", gap: 5, padding: "5px 10px", borderRadius: 8, border: "none", background: "#1A1D23", color: "#fff", font: `700 0.72rem/1 ${fb}`, cursor: "pointer", opacity: converting === p.id ? 0.6 : 1 }}
                    >
                      <UserPlus size={11} />
                      {converting === p.id ? "..." : "Convertir"}
                    </button>
                  </div>
                ) : (
                  <span style={{ font: `700 0.72rem/1 ${fb}`, color: "#9CA3AF", background: "rgba(156,163,175,0.06)", border: "1px solid rgba(156,163,175,0.2)", borderRadius: 8, padding: "5px 10px", flexShrink: 0 }}>✗ No vino</span>
                )}
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Presentes / Ausentes tabs */}
      <div id="asistencias-listado" style={{ ...card, overflow: "hidden", scrollMarginTop: 110 }}>
        <div style={{ display: "flex", borderBottom: "1px solid rgba(0,0,0,0.06)" }}>
          {(["presentes", "ausentes"] as const).map(t => (
            <button
              key={t}
              onClick={() => {
                setTab(t);
                if (t === "ausentes") {
                  void loadAusentes();
                }
              }}
              style={{
                flex: 1, padding: "14px 0", border: "none", background: "transparent", cursor: "pointer",
                font: `${tab === t ? "700" : "500"} 0.82rem/1 ${fd}`,
                color: tab === t ? t1 : t3,
                borderBottom: `2px solid ${tab === t ? "#FF6A00" : "transparent"}`,
                transition: "all 0.15s",
              }}
            >
              {t === "presentes"
                ? `Presentes (${presentes.length})`
                : ausentesLoaded
                  ? `Ausentes (${ausentes.length})`
                  : "Ausentes"}
            </button>
          ))}
        </div>

        {checkinError && (
          <div style={{ margin: "10px 16px 0", padding: "9px 13px", borderRadius: 10, background: "rgba(220,38,38,0.07)", border: "1px solid rgba(220,38,38,0.18)", font: `500 0.78rem/1.4 ${fb}`, color: "#DC2626" }}>
            {checkinError}
          </div>
        )}

        <div style={{ maxHeight: 480, overflowY: "auto" }}>
          {loading ? (
            <p style={{ textAlign: "center", padding: "32px 0", font: `400 0.8rem/1 ${fb}`, color: t3 }}>Cargando...</p>
          ) : tab === "presentes" ? (
            presentes.length === 0 ? (
              <>
                {[
                  { name: "Valentina Gómez",   plan: "Full",   time: "09:15" },
                  { name: "Martín Rodríguez",  plan: "Básico", time: "10:30" },
                  { name: "Carlos Benítez",    plan: "VIP",    time: "11:00" },
                ].map((ghost, i) => (
                  <div key={i} style={{ display: "flex", alignItems: "center", gap: 12, padding: "12px 20px", borderBottom: "1px solid rgba(0,0,0,0.04)", opacity: i === 0 ? 0.55 : i === 1 ? 0.35 : 0.2, filter: "blur(0.5px)", pointerEvents: "none", userSelect: "none" }}>
                    <div style={{ width: 36, height: 36, borderRadius: "50%", background: "#1A1D23", color: "white", display: "flex", alignItems: "center", justifyContent: "center", font: `700 0.65rem/1 ${fd}`, flexShrink: 0 }}>{initials(ghost.name)}</div>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <p style={{ font: `600 0.875rem/1 ${fd}`, color: t1, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{ghost.name}</p>
                      <p style={{ font: `400 0.68rem/1 ${fb}`, color: t3, marginTop: 2 }}>{ghost.plan}</p>
                    </div>
                    <div style={{ display: "flex", alignItems: "center", gap: 5, background: "rgba(52,211,153,0.08)", border: "1px solid rgba(52,211,153,0.2)", borderRadius: 9999, padding: "4px 10px" }}>
                      <Clock size={11} color="#34D399" />
                      <span style={{ font: `600 0.7rem/1 ${fd}`, color: "#34D399" }}>{ghost.time}</span>
                    </div>
                  </div>
                ))}
                <div style={{ textAlign: "center", padding: "28px 24px" }}>
                  <p style={{ font: `500 0.85rem/1 ${fd}`, color: t3 }}>Nadie escaneó aún hoy.</p>
                  <Link href="/dashboard/scanner" style={{ display: "inline-block", marginTop: 14, font: `600 0.78rem/1 ${fd}`, color: "#FF6A00" }}>Ir al escáner →</Link>
                </div>
              </>
            ) : (
              <div>
                {presentes.map((p, i) => {
                  const name = p.alumnos?.full_name ?? "—";
                  const plan = (p.alumnos?.planes as { nombre?: string } | null)?.nombre ?? null;
                  const claseLabel = (p.gym_classes as { class_name?: string } | null)?.class_name ?? "Entrada al gym";
                  const isClase = Boolean(p.clase_id);
                  return (
                    <div key={p.id} style={{ display: "flex", alignItems: "center", gap: 12, padding: "12px 20px", borderBottom: i < presentes.length - 1 ? "1px solid rgba(0,0,0,0.04)" : "none" }}>
                      <div style={{ width: 36, height: 36, borderRadius: "50%", background: "#1A1D23", color: "white", display: "flex", alignItems: "center", justifyContent: "center", font: `700 0.65rem/1 ${fd}`, flexShrink: 0 }}>{initials(name)}</div>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <p style={{ font: `600 0.875rem/1 ${fd}`, color: t1, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{name}</p>
                        {plan && <p style={{ font: `400 0.68rem/1 ${fb}`, color: t3, marginTop: 2 }}>{plan}</p>}
                      </div>
                      <span style={{ font: `500 0.68rem/1 ${fb}`, color: isClase ? "#6366F1" : t3, background: isClase ? "rgba(99,102,241,0.08)" : "#F1F2F6", border: `1px solid ${isClase ? "rgba(99,102,241,0.2)" : "transparent"}`, borderRadius: 9999, padding: "3px 9px", flexShrink: 0, maxWidth: isMobile ? 90 : 140, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                        {claseLabel}
                      </span>
                      <div style={{ display: "flex", alignItems: "center", gap: 5, background: "rgba(52,211,153,0.08)", border: "1px solid rgba(52,211,153,0.2)", borderRadius: 9999, padding: "4px 10px", flexShrink: 0 }}>
                        <Clock size={11} color="#34D399" />
                        <span style={{ font: `600 0.7rem/1 ${fd}`, color: "#34D399" }}>{fmt2(p.hora)}</span>
                      </div>
                      <button
                        onClick={async () => {
                          if (!await confirm({
                            eyebrow: "Anular asistencia",
                            title: `¿Anular asistencia de ${name}?`,
                            message: "El registro saldrá del listado de presentes de hoy.",
                            confirmLabel: "Anular",
                            variant: "danger",
                          })) return;
                          void handleDeleteAsist(p.id);
                        }}
                        disabled={deletingAsist.has(p.id)}
                        title="Anular asistencia"
                        style={{ background: "none", border: "none", cursor: "pointer", color: "#94A3B8", padding: "4px 6px", borderRadius: 6, lineHeight: 1, flexShrink: 0, opacity: deletingAsist.has(p.id) ? 0.4 : 1 }}
                      >✕</button>
                    </div>
                  );
                })}
              </div>
            )
          ) : ausentesLoading ? (
            <p style={{ textAlign: "center", padding: "32px 0", font: `400 0.8rem/1 ${fb}`, color: t3 }}>Cargando ausentes...</p>
          ) : (
            ausentes.length === 0 ? (
              <div style={{ textAlign: "center", padding: "48px 24px" }}>
                <CheckCircle size={32} color="#34D399" style={{ margin: "0 auto 12px", display: "block" }} />
                <p style={{ font: `500 0.85rem/1 ${fd}`, color: t3 }}>Todos los activos ya están presentes.</p>
              </div>
            ) : (
              <div>
                {ausentes.map((a, i) => {
                  const plan = (a.planes as { nombre?: string } | null)?.nombre ?? null;
                  const busy = checkingIn.has(a.id);
                  return (
                    <div key={a.id} style={{ display: "flex", alignItems: "center", gap: 12, padding: "12px 20px", borderBottom: i < ausentes.length - 1 ? "1px solid rgba(0,0,0,0.04)" : "none", transition: "opacity 0.15s", opacity: busy ? 0.5 : 1 }}>
                      <div style={{ width: 36, height: 36, borderRadius: "50%", background: "#F1F2F6", color: t2, display: "flex", alignItems: "center", justifyContent: "center", font: `700 0.65rem/1 ${fd}`, flexShrink: 0 }}>{initials(a.full_name)}</div>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <p style={{ font: `600 0.875rem/1 ${fd}`, color: t1, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{a.full_name}</p>
                        {plan && <p style={{ font: `400 0.68rem/1 ${fb}`, color: t3, marginTop: 2 }}>{plan}</p>}
                      </div>
                      <button
                        onClick={() => void markPresente(a)}
                        disabled={busy}
                        style={{ display: "flex", alignItems: "center", gap: 5, padding: "6px 12px", borderRadius: 9, border: "1px solid rgba(52,211,153,0.3)", background: "rgba(52,211,153,0.07)", color: "#10B981", font: `700 0.72rem/1 ${fd}`, cursor: busy ? "not-allowed" : "pointer", flexShrink: 0, transition: "all 0.15s" }}
                        onMouseEnter={e => { if (!busy) { e.currentTarget.style.background = "rgba(52,211,153,0.14)"; e.currentTarget.style.borderColor = "rgba(52,211,153,0.5)"; } }}
                        onMouseLeave={e => { e.currentTarget.style.background = "rgba(52,211,153,0.07)"; e.currentTarget.style.borderColor = "rgba(52,211,153,0.3)"; }}
                      >
                        {busy ? (
                          <span style={{ display: "inline-block", width: 10, height: 10, borderRadius: "50%", border: "1.5px solid rgba(16,185,129,0.3)", borderTopColor: "#10B981", animation: "spin 0.7s linear infinite" }} />
                        ) : (
                          <CheckCircle size={12} />
                        )}
                        {busy ? "..." : "Marcar"}
                      </button>
                    </div>
                  );
                })}
              </div>
            )
          )}
        </div>
      </div>

      {/* void gymId */}
      {gymId && <span style={{ display: "none" }}>{gymId}</span>}

      {/* ── Modal Convertir prospecto ── */}
      {convertModal && (
        <div
          onClick={() => setConvertModal(null)}
          style={{ position: "fixed", inset: 0, zIndex: 1000, background: "rgba(0,0,0,0.45)", display: "flex", alignItems: "center", justifyContent: "center", padding: 20 }}
        >
          <div
            onClick={e => e.stopPropagation()}
            style={{ background: "#fff", borderRadius: 18, padding: "28px 24px", width: "100%", maxWidth: 380, boxShadow: "0 16px 48px rgba(0,0,0,0.18)" }}
          >
            <p style={{ font: `700 1rem/1.3 ${fb}`, color: t1, marginBottom: 4 }}>Convertir en alumno</p>
            <p style={{ font: `400 0.8rem/1.5 ${fb}`, color: t2, marginBottom: 20 }}>
              {convertModal.full_name} · DNI para que pueda ingresar al portal
            </p>
            <label style={{ display: "block", font: `600 0.7rem/1 ${fb}`, color: t3, letterSpacing: "0.06em", textTransform: "uppercase", marginBottom: 8 }}>DNI <span style={{ color: t3, fontWeight: 400 }}>(opcional)</span></label>
            <input
              type="text"
              inputMode="numeric"
              value={convertDni}
              onChange={e => setConvertDni(e.target.value.replace(/\D/g, ""))}
              placeholder="Sin puntos"
              autoFocus
              style={{ width: "100%", padding: "10px 14px", borderRadius: 10, border: "1.5px solid #E5E7EB", font: `400 0.9rem/1 ${fb}`, color: t1, outline: "none", boxSizing: "border-box", marginBottom: 20 }}
              onKeyDown={e => { if (e.key === "Enter") convertirProspecto(convertModal, convertDni); }}
            />
            <div style={{ display: "flex", gap: 10 }}>
              <button
                onClick={() => setConvertModal(null)}
                style={{ flex: 1, padding: "10px 0", borderRadius: 10, border: "1px solid #E5E7EB", background: "#F9FAFB", font: `600 0.82rem/1 ${fb}`, color: t2, cursor: "pointer" }}
              >
                Cancelar
              </button>
              <button
                onClick={() => convertirProspecto(convertModal, convertDni)}
                style={{ flex: 2, padding: "10px 0", borderRadius: 10, border: "none", background: "#1A1D23", font: `700 0.82rem/1 ${fb}`, color: "#fff", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", gap: 7 }}
              >
                <UserPlus size={13} />
                Confirmar
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
