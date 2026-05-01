"use client";

import { useState, useEffect, useCallback, useMemo } from "react";
import { useRouter } from "next/navigation";
import { Calendar, Dumbbell, User, Target } from "lucide-react";

const fd = "'Inter', sans-serif";
const DAYS = ["Dom", "Lun", "Mar", "Mié", "Jue", "Vie", "Sáb"];
const DAYS_FULL = ["Domingo", "Lunes", "Martes", "Miércoles", "Jueves", "Viernes", "Sábado"];

interface Session {
  alumno_id:  string;
  gym_id:     string;
  full_name:  string;
  status:     string;
  plan:       string | null;
  expiration: string | null;
  dni:        string | null;
  token?:     string | null;
}

interface GymClass {
  id:           string;
  class_name:   string;
  day_of_week:  number;
  start_time:   string;
  max_capacity: number;
  event_type:   "regular" | "especial";
  notes:        string | null;
  coach_name:   string | null;
}

interface Reserva { clase_id: string; fecha: string; }

interface Ejercicio {
  nombre:        string;
  series:        number;
  repeticiones:  number;
  peso_sugerido: string;
  // WOD fields
  _meta?:        boolean;
  modalidad?:    string;
  time_cap?:     string;
  reps?:         string;
}

interface Peso { id: string; ejercicio: string; peso: number; fecha: string; notas: string | null; }

function getNext7Days() {
  const days: { date: Date; label: string; iso: string; dow: number }[] = [];
  for (let i = 0; i < 7; i++) {
    const d = new Date();
    d.setDate(d.getDate() + i);
    days.push({ date: d, label: i === 0 ? "Hoy" : DAYS[d.getDay()], iso: d.toISOString().slice(0, 10), dow: d.getDay() });
  }
  return days;
}

// Glass card — subtle, clean
const gc: React.CSSProperties = {
  background: "rgba(255,255,255,0.04)",
  backdropFilter: "blur(20px)",
  WebkitBackdropFilter: "blur(20px)",
  border: "1px solid rgba(255,255,255,0.08)",
  borderRadius: 16,
};

export default function AlumnoPanelPage() {
  const router = useRouter();

  const [session,      setSession]      = useState<Session | null>(null);
  const [tab,          setTab]          = useState<"calendario" | "entrenamiento" | "metas" | "perfil">("calendario");
  const [selectedDayIdx, setSelectedDayIdx] = useState(0);
  const [clases,       setClases]       = useState<GymClass[]>([]);
  const [reservas,     setReservas]     = useState<Reserva[]>([]);
  const [countsMap,    setCountsMap]    = useState<Record<string, number>>({});
  const [rutina,       setRutina]       = useState<{ nombre: string; ejercicios: Ejercicio[] } | null>(null);
  const [pesos,        setPesos]        = useState<Peso[]>([]);
  const [loading,      setLoading]      = useState(true);
  const [toast,        setToast]        = useState<{ msg: string; ok: boolean } | null>(null);
  const [reservando,   setReservando]   = useState<string | null>(null);
  const [gymInfo,      setGymInfo]      = useState<{ gym_name: string | null; logo_url: string | null; accent_color: string | null; plan_type: string | null } | null>(null);
  const [inlineKg,     setInlineKg]     = useState<Record<string, string>>({});
  const [inlineSaving, setInlineSaving] = useState<Record<string, boolean>>({});
  const [showQR,        setShowQR]        = useState(false);
  const [checkinMode,   setCheckinMode]   = useState<"qr" | "checkin" | "dni">("qr");
  const [checkinLoading, setCheckinLoading] = useState(false);
  const [checkinResult, setCheckinResult] = useState<{ ok: boolean; already?: boolean; full_name?: string; hora?: string; error?: string } | null>(null);
  const [asistFechas,  setAsistFechas]  = useState<string[]>([]);
  const [asistCount,   setAsistCount]   = useState(0);
  const [isCompactScreen, setIsCompactScreen] = useState(false);

  const showToast = (msg: string, ok = true) => {
    setToast({ msg, ok });
    setTimeout(() => setToast(null), 3000);
  };

  // Load session + refresh from server
  useEffect(() => {
    const raw = localStorage.getItem("fitgrowx_alumno");
    if (!raw) { router.replace("/alumno/login"); return; }
    let parsed: Session;
    try { parsed = JSON.parse(raw); } catch { router.replace("/alumno/login"); return; }
    if (!parsed.token) { router.replace("/alumno/login"); return; }
    setSession(parsed);
    fetch(`/api/alumno/me?alumno_id=${parsed.alumno_id}`, {
      headers: { Authorization: `Bearer ${parsed.token}` },
    })
      .then(r => r.json())
      .then(d => {
        if (d.error) return;
        const fresh: Session = { alumno_id: d.alumno_id, gym_id: d.gym_id, full_name: d.full_name, status: d.status, plan: d.plan, expiration: d.expiration, dni: d.dni ?? null, token: parsed.token };
        localStorage.setItem("fitgrowx_alumno", JSON.stringify(fresh));
        setSession(fresh);
      })
      .catch(() => {});
  }, [router]);

  useEffect(() => {
    const check = () => setIsCompactScreen(window.innerWidth <= 430);
    check();
    window.addEventListener("resize", check);
    return () => window.removeEventListener("resize", check);
  }, []);

  const fetchBootstrap = useCallback(async (s: Session, includeTraining = false) => {
    const suffix = includeTraining ? "&include=training" : "";
    const r = await fetch(`/api/alumno/bootstrap?alumno_id=${s.alumno_id}&gym_id=${s.gym_id}${suffix}`, {
      headers: { Authorization: `Bearer ${s.token}` },
    });
    const d = await r.json();
    if (d.clases) setClases(d.clases);
    if (d.reservas) setReservas(d.reservas);
    if (d.counts_map) setCountsMap(d.counts_map);
    if (d.gym_info) {
      setGymInfo({
        gym_name: d.gym_info.gym_name,
        logo_url: d.gym_info.logo_url,
        accent_color: d.gym_info.accent_color,
        plan_type: d.gym_info.plan_type ?? null,
      });
    }
    if (d.asistencias) {
      setAsistFechas(d.asistencias.fechas ?? []);
      setAsistCount(d.asistencias.count ?? 0);
    }
    if (includeTraining) {
      setRutina(d.rutina ?? null);
      setPesos(d.pesos ?? []);
    }
  }, []);

  const fetchPesos = useCallback(async (s: Session) => {
    const r = await fetch(`/api/alumno/pesos?alumno_id=${s.alumno_id}`, {
      headers: { Authorization: `Bearer ${s.token}` },
    });
    const d = await r.json();
    setPesos(d.pesos ?? []);
  }, []);

  useEffect(() => {
    if (!session) return;
    setLoading(true);
    fetchBootstrap(session).finally(() => setLoading(false));
  }, [session, fetchBootstrap]);

  useEffect(() => {
    if (!session) return;
    if (tab !== "entrenamiento" || rutina) return;
    void fetchBootstrap(session, true);
  }, [session, tab, rutina, fetchBootstrap]);

  useEffect(() => {
    if (!session) return;
    if ((tab !== "entrenamiento" && tab !== "metas" && tab !== "perfil") || pesos.length > 0) return;
    void fetchBootstrap(session, true);
  }, [session, tab, pesos.length, fetchBootstrap]);

  const handleReservar = async (clase_id: string, fecha: string) => {
    if (!session) return;
    const key = `${clase_id}|${fecha}`;
    setReservando(key);
    try {
      const isReserved = reservas.some(r => r.clase_id === clase_id && r.fecha === fecha);
      if (isReserved) {
        const res = await fetch("/api/alumno/reservar", { method: "DELETE", headers: { "Content-Type": "application/json", Authorization: `Bearer ${session.token}` }, body: JSON.stringify({ alumno_id: session.alumno_id, clase_id, fecha }) });
        const d = await res.json();
        if (d.ok) { setReservas(prev => prev.filter(r => !(r.clase_id === clase_id && r.fecha === fecha))); showToast("Reserva cancelada."); }
        else showToast(d.error ?? "Error.", false);
      } else {
        const res = await fetch("/api/alumno/reservar", { method: "POST", headers: { "Content-Type": "application/json", Authorization: `Bearer ${session.token}` }, body: JSON.stringify({ alumno_id: session.alumno_id, gym_id: session.gym_id, clase_id, fecha }) });
        const d = await res.json();
        if (d.ok) { setReservas(prev => [...prev, { clase_id, fecha }]); showToast("Reserva confirmada!"); }
        else showToast(d.error ?? "Error.", false);
      }
    } catch {
      showToast("Error de conexion. Intentá de nuevo.", false);
    } finally {
      setReservando(null);
    }
  };

  const handleInlineKgSave = async (ejercicio: string) => {
    if (!session) return;
    const val = inlineKg[ejercicio];
    if (!val || isNaN(parseFloat(val))) return;
    setInlineSaving(prev => ({ ...prev, [ejercicio]: true }));
    try {
      const res = await fetch("/api/alumno/pesos", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${session.token}` },
        body: JSON.stringify({ alumno_id: session.alumno_id, gym_id: session.gym_id, ejercicio, peso: parseFloat(val), notas: null }),
      });
      const d = await res.json();
      if (d.ok) {
        setInlineKg(prev => ({ ...prev, [ejercicio]: "" }));
        if (d.peso) {
          setPesos(prev => [d.peso as Peso, ...prev].slice(0, 50));
        } else {
          void fetchPesos(session);
        }
        showToast("Peso registrado!");
      }
      else showToast(d.error ?? "Error.", false);
    } catch {
      showToast("Error de conexion.", false);
    }
    setInlineSaving(prev => ({ ...prev, [ejercicio]: false }));
  };

  const doCheckin = async () => {
    if (!session) return;
    setCheckinLoading(true);
    setCheckinResult(null);
    try {
      const res = await fetch("/api/alumno/checkin-publico", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${session.token}` },
        body: JSON.stringify({ gym_id: session.gym_id }),
      });
      const d = await res.json();
      setCheckinResult({ ok: d.ok, already: d.already, full_name: d.alumno?.full_name, hora: d.hora, error: d.error });
    } catch {
      setCheckinResult({ ok: false, error: "Error de conexión." });
    }
    setCheckinLoading(false);
  };

  const logout = () => { localStorage.removeItem("fitgrowx_alumno"); router.replace("/alumno/login"); };

  const days7 = useMemo(() => getNext7Days(), []);
  const latestPesoByExercise = useMemo(() => {
    const map = new Map<string, Peso>();
    for (const peso of pesos) {
      if (!map.has(peso.ejercicio)) {
        map.set(peso.ejercicio, peso);
      }
    }
    return map;
  }, [pesos]);

  if (!session) return null;

  // Lock screen
  if (session.status !== "activo") {
    const gymName = gymInfo?.gym_name ?? "tu gimnasio";
    return (
      <div style={{ minHeight: "100svh", background: "#020202", fontFamily: fd, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", padding: "32px 24px", position: "relative", overflow: "hidden" }}>
        <style>{`@keyframes fadeUp { from { opacity:0; transform:translateY(16px); } to { opacity:1; transform:translateY(0); } }`}</style>
        <div style={{ position: "fixed", top: "50%", left: "50%", transform: "translate(-50%,-50%)", width: 700, height: 700, background: "radial-gradient(circle, rgba(239,68,68,0.08) 0%, transparent 65%)", filter: "blur(80px)", pointerEvents: "none" }} />
        <div style={{ position: "fixed", inset: 0, pointerEvents: "none", backgroundImage: "linear-gradient(rgba(255,255,255,0.015) 1px,transparent 1px),linear-gradient(90deg,rgba(255,255,255,0.015) 1px,transparent 1px)", backgroundSize: "44px 44px" }} />
        <div style={{ position: "relative", zIndex: 1, textAlign: "center", maxWidth: 360, width: "100%", animation: "fadeUp 0.4s cubic-bezier(0.16,1,0.3,1)" }}>
          <div style={{ width: 80, height: 80, borderRadius: 28, background: "rgba(239,68,68,0.06)", border: "1px solid rgba(239,68,68,0.15)", display: "flex", alignItems: "center", justifyContent: "center", margin: "0 auto 32px" }}>
            <svg width="34" height="34" viewBox="0 0 24 24" fill="none" stroke="#EF4444" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
              <rect x="3" y="11" width="18" height="11" rx="2" ry="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/>
            </svg>
          </div>
          {gymInfo?.logo_url ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={gymInfo.logo_url} alt={gymName} style={{ height: 28, maxWidth: 140, objectFit: "contain", margin: "0 auto 24px", display: "block", opacity: 0.4, filter: "grayscale(1)" }} />
          ) : (
            <p style={{ font: `300 0.58rem/1 ${fd}`, color: "rgba(255,255,255,0.18)", letterSpacing: "0.3em", textTransform: "uppercase", marginBottom: 24 }}>{gymName}</p>
          )}
          <h1 style={{ font: `700 1.9rem/1.1 ${fd}`, color: "#FFFFFF", letterSpacing: "-0.03em", marginBottom: 6 }}>Acceso suspendido</h1>
          <div style={{ background: "rgba(239,68,68,0.05)", border: "1px solid rgba(239,68,68,0.12)", borderRadius: 16, padding: "20px 22px", marginBottom: 28, marginTop: 20 }}>
            <p style={{ font: `400 0.85rem/1.65 ${fd}`, color: "rgba(255,255,255,0.5)" }}>
              Tu membresia ha expirado. Comunicate con la recepcion de{" "}
              <span style={{ color: "#FFFFFF", fontWeight: 600 }}>{gymName}</span>{" "}
              para regularizar tu estado.
            </p>
          </div>
          <div style={{ display: "inline-flex", alignItems: "center", gap: 7, background: "rgba(239,68,68,0.06)", border: "1px solid rgba(239,68,68,0.15)", borderRadius: 9999, padding: "7px 14px", marginBottom: 36 }}>
            <div style={{ width: 6, height: 6, borderRadius: "50%", background: "#EF4444" }} />
            <span style={{ font: `500 0.65rem/1 ${fd}`, color: "#EF4444", letterSpacing: "0.08em", textTransform: "uppercase" }}>
              {session.status === "vencido" ? "Membresia vencida" : "Membresia inactiva"}
            </span>
          </div>
          <button onClick={logout} style={{ display: "block", width: "100%", padding: "13px 0", background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.06)", borderRadius: 14, font: `500 0.7rem/1 ${fd}`, color: "rgba(255,255,255,0.25)", cursor: "pointer", letterSpacing: "0.08em" }}>
            CERRAR SESION
          </button>
        </div>
      </div>
    );
  }

  const initials = session.full_name.split(" ").slice(0, 2).map((w: string) => w[0]).join("").toUpperCase();

  const misReservas = days7.flatMap(day =>
    clases
      .filter(c => c.day_of_week === day.dow && reservas.some(r => r.clase_id === c.id && r.fecha === day.iso))
      .map(c => ({ ...c, day }))
  );

  const selectedDay = days7[selectedDayIdx] ?? days7[0];

  return (
    <div style={{ minHeight: "100svh", background: "#0A0A0F", fontFamily: fd, paddingBottom: 110, position: "relative", overflowX: "hidden" }}>

      <style>{`
        @keyframes spin   { to { transform: rotate(360deg); } }
        @keyframes fadeUp { from { opacity: 0; transform: translateY(10px); } to { opacity: 1; transform: translateY(0); } }
        .tap-active       { transition: opacity 0.12s; }
        .tap-active:active { opacity: 0.6; }
        input[type=number]::-webkit-inner-spin-button,
        input[type=number]::-webkit-outer-spin-button { -webkit-appearance: none; }
      `}</style>

      {/* Subtle top glow only */}
      {!isCompactScreen && (
        <div style={{ position: "fixed", top: -200, left: "50%", transform: "translateX(-50%)", width: 600, height: 400, background: "radial-gradient(ellipse, rgba(255,255,255,0.03) 0%, transparent 70%)", filter: "blur(60px)", pointerEvents: "none", zIndex: 0 }} />
      )}

      {/* Grid */}
      {!isCompactScreen && (
        <div style={{ position: "fixed", inset: 0, pointerEvents: "none", zIndex: 0, backgroundImage: "linear-gradient(rgba(255,255,255,0.02) 1px,transparent 1px),linear-gradient(90deg,rgba(255,255,255,0.02) 1px,transparent 1px)", backgroundSize: "40px 40px" }} />
      )}

      {/* Header */}
      <div style={{ position: "sticky", top: 0, zIndex: 50, backdropFilter: isCompactScreen ? "blur(18px)" : "blur(32px)", WebkitBackdropFilter: isCompactScreen ? "blur(18px)" : "blur(32px)", background: "rgba(10,10,15,0.9)", borderBottom: "1px solid rgba(255,255,255,0.06)", padding: isCompactScreen ? "12px 16px" : "13px 20px" }}>
        <div style={{ maxWidth: 520, margin: "0 auto", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          {gymInfo?.logo_url ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={gymInfo.logo_url} alt={gymInfo.gym_name ?? "Logo"} style={{ height: 28, maxWidth: 120, objectFit: "contain", borderRadius: 6 }} />
          ) : (
            <span style={{ font: `700 0.95rem/1 ${fd}`, color: "#FFFFFF", letterSpacing: "-0.02em" }}>
              FitGrow<span style={{ color: "#F97316" }}>X</span>
            </span>
          )}
          <button onClick={logout} style={{ minHeight: 44, background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.08)", borderRadius: 12, padding: "0 14px", font: `500 0.68rem/1 ${fd}`, color: "rgba(255,255,255,0.35)", cursor: "pointer", letterSpacing: "0.05em" }}>
            SALIR
          </button>
        </div>
      </div>

      {/* Hero greeting */}
      <div style={{ position: "relative", zIndex: 1, padding: tab === "entrenamiento" && isCompactScreen ? "18px 16px 10px" : "28px 20px 16px", maxWidth: 520, margin: "0 auto" }}>
        {tab === "entrenamiento" && isCompactScreen ? (
          <div style={{ display: "grid", gap: 8 }}>
            <p style={{ font: `500 0.7rem/1 ${fd}`, color: "rgba(255,255,255,0.28)", letterSpacing: "0.08em", textTransform: "uppercase" }}>
              Entrenamiento
            </p>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10 }}>
              <h1 style={{ font: `700 1.7rem/1 ${fd}`, color: "#FFFFFF", letterSpacing: "-0.04em" }}>
                {session.full_name.split(" ")[0]}
              </h1>
              {session.plan && (
                <span style={{ font: `500 0.65rem/1 ${fd}`, color: "rgba(255,255,255,0.42)", background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.08)", padding: "6px 10px", borderRadius: 9999, maxWidth: 140, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                  {session.plan}
                </span>
              )}
            </div>
          </div>
        ) : (
          <>
            <p style={{ font: `400 0.72rem/1 ${fd}`, color: "rgba(255,255,255,0.3)", letterSpacing: "0.06em", marginBottom: 8 }}>
              Bienvenido
            </p>
            <h1 style={{ font: `700 ${isCompactScreen ? "1.9rem" : "2.2rem"}/1 ${fd}`, color: "#FFFFFF", letterSpacing: "-0.04em", marginBottom: 14 }}>
              {session.full_name.split(" ")[0]}
            </h1>
            <div style={{ display: "flex", gap: 6, alignItems: "center", flexWrap: "wrap" }}>
              <span style={{ font: `500 0.65rem/1 ${fd}`, color: "#34D399", background: "rgba(52,211,153,0.08)", border: "1px solid rgba(52,211,153,0.15)", padding: "4px 10px", borderRadius: 9999, letterSpacing: "0.06em" }}>
                ACTIVO
              </span>
              {session.plan && (
                <span style={{ font: `400 0.65rem/1 ${fd}`, color: "rgba(255,255,255,0.35)", border: "1px solid rgba(255,255,255,0.08)", padding: "4px 10px", borderRadius: 9999, letterSpacing: "0.04em" }}>
                  {session.plan}
                </span>
              )}
              {asistCount > 0 && (
                <span style={{ font: `600 0.65rem/1 ${fd}`, color: "#F97316", background: "rgba(249,115,22,0.1)", border: "1px solid rgba(249,115,22,0.2)", padding: "4px 10px", borderRadius: 9999, letterSpacing: "0.02em" }}>
                  {asistCount} asistencia{asistCount !== 1 ? "s" : ""} este mes 💪
                </span>
              )}
            </div>
          </>
        )}
      </div>

      {/* Content */}
      <div style={{ position: "relative", zIndex: 1, padding: tab === "entrenamiento" && isCompactScreen ? "2px 12px 0" : "4px 16px 0", maxWidth: 520, margin: "0 auto" }}>

        {loading ? (
          <div style={{ textAlign: "center", paddingTop: 80 }}>
            <div style={{ width: 28, height: 28, borderRadius: "50%", border: "2px solid rgba(255,255,255,0.08)", borderTopColor: "rgba(255,255,255,0.5)", margin: "0 auto 14px", animation: "spin 0.8s linear infinite" }} />
            <p style={{ font: `400 0.72rem/1 ${fd}`, color: "rgba(255,255,255,0.2)", letterSpacing: "0.1em" }}>CARGANDO</p>
          </div>
        ) : (
          <>
            {/* TAB — CALENDARIO */}
            {tab === "calendario" && (
              <div style={{ display: "flex", flexDirection: "column", gap: 10, animation: "fadeUp 0.22s ease" }}>

                {/* Weekly day slider */}
                <div style={{ display: "flex", gap: 6, overflowX: "auto", paddingBottom: 4, scrollbarWidth: "none" }}>
                  <style>{`.day-scroll::-webkit-scrollbar{display:none}`}</style>
                  {days7.map((day, idx) => {
                    const active = idx === selectedDayIdx;
                    const hasCls = clases.some(c => c.day_of_week === day.dow);
                    return (
                      <button
                        key={day.iso}
                        onClick={() => setSelectedDayIdx(idx)}
                        className="tap-active"
                        style={{ flexShrink: 0, display: "flex", flexDirection: "column", alignItems: "center", gap: 4, padding: "10px 0", width: 52, borderRadius: 14, border: `1.5px solid ${active ? "#F97316" : "rgba(255,255,255,0.07)"}`, background: active ? "rgba(249,115,22,0.12)" : "rgba(255,255,255,0.03)", cursor: "pointer" }}
                      >
                        <span style={{ font: `500 0.6rem/1 ${fd}`, color: active ? "#F97316" : "rgba(255,255,255,0.3)", letterSpacing: "0.06em", textTransform: "uppercase" }}>
                          {day.label === "Hoy" ? "HOY" : DAYS[day.dow].slice(0, 3).toUpperCase()}
                        </span>
                        <span style={{ font: `700 1.1rem/1 ${fd}`, color: active ? "#FFFFFF" : "rgba(255,255,255,0.45)" }}>
                          {day.date.getDate()}
                        </span>
                        {hasCls && <div style={{ width: 4, height: 4, borderRadius: "50%", background: active ? "#F97316" : "rgba(255,255,255,0.15)" }} />}
                      </button>
                    );
                  })}
                </div>

                {/* Day label */}
                <p style={{ font: `600 0.72rem/1 ${fd}`, color: "rgba(255,255,255,0.3)", letterSpacing: "0.08em", textTransform: "uppercase" }}>
                  {selectedDay.label === "Hoy" ? `Hoy · ${DAYS_FULL[selectedDay.dow]}` : `${DAYS_FULL[selectedDay.dow]} ${selectedDay.date.getDate()}`}
                </p>

                {/* Class cards for selected day */}
                {(() => {
                  const dayClases = clases.filter(c => c.day_of_week === selectedDay.dow);
                  if (dayClases.length === 0) return (
                    <div style={{ ...gc, padding: "36px 24px", textAlign: "center" }}>
                      <Calendar size={22} color="rgba(255,255,255,0.15)" strokeWidth={1.5} style={{ margin: "0 auto 14px" }} />
                      <p style={{ font: `500 0.85rem/1.4 ${fd}`, color: "rgba(255,255,255,0.3)" }}>No hay clases este día.</p>
                    </div>
                  );
                  return (
                    <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                      {dayClases.map(c => {
                        const reserved = reservas.some(r => r.clase_id === c.id && r.fecha === selectedDay.iso);
                        const busy = reservando === `${c.id}|${selectedDay.iso}`;
                        const count = countsMap[`${c.id}|${selectedDay.iso}`] ?? 0;
                        const isFull = !reserved && count >= c.max_capacity;
                        const available = c.max_capacity - count;
                        const isEspecial = c.event_type === "especial";
                        return (
                          <div
                            key={c.id}
                            style={{
                              background: isEspecial ? "rgba(245,158,11,0.06)" : "rgba(255,255,255,0.04)",
                              backdropFilter: "blur(20px)",
                              WebkitBackdropFilter: "blur(20px)",
                              border: `1px solid ${reserved ? "rgba(52,211,153,0.2)" : isEspecial ? "rgba(245,158,11,0.2)" : "rgba(255,255,255,0.07)"}`,
                              borderRadius: 14,
                              padding: "14px 15px",
                            }}
                          >
                            <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 10 }}>
                              <div style={{ flex: 1, minWidth: 0 }}>
                                <div style={{ display: "flex", alignItems: "center", gap: 7, marginBottom: 5 }}>
                                  <span style={{ font: `400 0.72rem/1 ${fd}`, color: isEspecial ? "rgba(245,158,11,0.7)" : "rgba(255,255,255,0.35)", letterSpacing: "0.04em" }}>{c.start_time.slice(0, 5)}h</span>
                                  {isEspecial && (
                                    <span style={{ font: `700 0.55rem/1 ${fd}`, color: "#D97706", background: "rgba(245,158,11,0.12)", border: "1px solid rgba(245,158,11,0.25)", padding: "2px 7px", borderRadius: 9999, letterSpacing: "0.06em" }}>ESPECIAL</span>
                                  )}
                                  {reserved && (
                                    <span style={{ font: `600 0.55rem/1 ${fd}`, color: "#34D399", background: "rgba(52,211,153,0.1)", border: "1px solid rgba(52,211,153,0.2)", padding: "2px 7px", borderRadius: 9999, letterSpacing: "0.06em" }}>RESERVADO</span>
                                  )}
                                </div>
                                <p style={{ font: `600 1rem/1.1 ${fd}`, color: "#FFFFFF", marginBottom: 4 }}>{c.class_name}</p>
                                <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                                  {c.coach_name && (
                                    <span style={{ font: `400 0.72rem/1 ${fd}`, color: "rgba(255,255,255,0.35)" }}>{c.coach_name}</span>
                                  )}
                                  {!reserved && !isFull && (
                                    <span style={{ font: `400 0.72rem/1 ${fd}`, color: available <= 3 ? "#F97316" : "rgba(255,255,255,0.25)" }}>
                                      {available} cupo{available !== 1 ? "s" : ""}
                                    </span>
                                  )}
                                  {isFull && (
                                    <span style={{ font: `500 0.72rem/1 ${fd}`, color: "#EF4444" }}>Sin cupos</span>
                                  )}
                                </div>
                                {c.notes && (
                                  <p style={{ font: `400 0.7rem/1.45 ${fd}`, color: "rgba(255,255,255,0.25)", marginTop: 6 }}>{c.notes}</p>
                                )}
                              </div>
                              <div style={{ flexShrink: 0 }}>
                                {reserved ? (
                                  <button
                                    onClick={() => handleReservar(c.id, selectedDay.iso)}
                                    disabled={busy}
                                    className="tap-active"
                                    style={{ padding: "8px 14px", borderRadius: 9, border: "1px solid rgba(239,68,68,0.25)", background: "rgba(239,68,68,0.07)", color: "#EF4444", font: `500 0.72rem/1 ${fd}`, cursor: busy ? "not-allowed" : "pointer", opacity: busy ? 0.5 : 1, whiteSpace: "nowrap" }}
                                  >
                                    {busy ? "..." : "Cancelar"}
                                  </button>
                                ) : isFull ? (
                                  <button
                                    disabled
                                    style={{ padding: "8px 14px", borderRadius: 9, border: "1px solid rgba(255,255,255,0.07)", background: "transparent", color: "rgba(255,255,255,0.2)", font: `500 0.72rem/1 ${fd}`, cursor: "not-allowed", whiteSpace: "nowrap" }}
                                  >
                                    Lista de espera
                                  </button>
                                ) : (
                                  <button
                                    onClick={() => handleReservar(c.id, selectedDay.iso)}
                                    disabled={busy}
                                    className="tap-active"
                                    style={{ padding: "8px 14px", borderRadius: 9, border: "none", background: isEspecial ? "#D97706" : "#F97316", color: "#FFFFFF", font: `600 0.72rem/1 ${fd}`, cursor: busy ? "not-allowed" : "pointer", opacity: busy ? 0.5 : 1, whiteSpace: "nowrap" }}
                                  >
                                    {busy ? "..." : "Reservar"}
                                  </button>
                                )}
                              </div>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  );
                })()}

                {/* My upcoming reservations summary */}
                {misReservas.length > 0 && (
                  <div style={{ ...gc, padding: "13px 15px", marginTop: 4 }}>
                    <p style={{ font: `500 0.62rem/1 ${fd}`, color: "rgba(255,255,255,0.3)", letterSpacing: "0.1em", textTransform: "uppercase", marginBottom: 10 }}>Mis reservas esta semana</p>
                    <div style={{ display: "flex", flexDirection: "column", gap: 7 }}>
                      {misReservas.map(c => (
                        <div key={`${c.id}|${c.day.iso}`} style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                          <div>
                            <span style={{ font: `500 0.82rem/1 ${fd}`, color: "#FFFFFF" }}>{c.class_name}</span>
                            <span style={{ font: `400 0.7rem/1 ${fd}`, color: "rgba(255,255,255,0.3)", marginLeft: 8 }}>{c.day.label === "Hoy" ? "Hoy" : c.day.label} · {c.start_time.slice(0, 5)}h</span>
                          </div>
                          <button
                            onClick={() => handleReservar(c.id, c.day.iso)}
                            disabled={reservando === `${c.id}|${c.day.iso}`}
                            className="tap-active"
                            style={{ padding: "5px 10px", borderRadius: 7, border: "1px solid rgba(239,68,68,0.2)", background: "rgba(239,68,68,0.05)", color: "#EF4444", font: `500 0.65rem/1 ${fd}`, cursor: "pointer", whiteSpace: "nowrap" }}
                          >
                            {reservando === `${c.id}|${c.day.iso}` ? "..." : "Cancelar"}
                          </button>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* TAB — ENTRENAMIENTO */}
            {tab === "entrenamiento" && (
              <div style={{ display: "flex", flexDirection: "column", gap: isCompactScreen ? 10 : 8, animation: "fadeUp 0.22s ease" }}>
                {rutina ? (() => {
                  const isWod = !!(rutina.ejercicios[0]?._meta);
                  const wodMeta = isWod ? rutina.ejercicios[0] : null;
                  const items = isWod ? rutina.ejercicios.slice(1) : rutina.ejercicios;
                  return (
                  <>
                    <div style={{
                      ...(isCompactScreen ? {
                        background: "rgba(255,255,255,0.03)",
                        border: "1px solid rgba(255,255,255,0.06)",
                        borderRadius: 18,
                      } : gc),
                      padding: isCompactScreen ? "14px 16px" : "16px 18px",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "space-between",
                      gap: 12,
                    }}>
                      <div>
                        <p style={{ font: `400 0.65rem/1 ${fd}`, color: "rgba(255,255,255,0.3)", letterSpacing: "0.08em", textTransform: "uppercase", marginBottom: 6 }}>
                          {isWod ? "Tu WOD" : "Tu rutina"}
                        </p>
                        <h2 style={{ font: `700 ${isCompactScreen ? "1.04rem" : "1.2rem"}/1.1 ${fd}`, color: "#FFFFFF", letterSpacing: "-0.02em" }}>{rutina.nombre}</h2>
                      </div>
                      {isWod && wodMeta ? (
                        <div style={{ textAlign: "right" }}>
                          <span style={{ padding: "4px 10px", borderRadius: 9999, background: "rgba(99,102,241,0.18)", border: "1px solid rgba(99,102,241,0.25)", font: `700 0.7rem/1 ${fd}`, color: "#818cf8" }}>{wodMeta.modalidad}</span>
                          <p style={{ font: `400 0.62rem/1 ${fd}`, color: "rgba(255,255,255,0.25)", marginTop: 4 }}>{wodMeta.time_cap} min</p>
                        </div>
                      ) : (
                        <span style={{ font: `500 0.72rem/1 ${fd}`, color: "rgba(255,255,255,0.32)", flexShrink: 0 }}>{items.length} ejercicios</span>
                      )}
                    </div>

                    {isWod ? (
                      // WOD: lista simple de movimientos
                      <div style={{ ...(isCompactScreen ? { background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.06)", borderRadius: 18 } : gc), padding: "14px 16px" }}>
                        <div style={{ display: "flex", flexDirection: "column", gap: 0 }}>
                          {items.map((m, i) => (
                            <div key={i} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10, padding: isCompactScreen ? "12px 0" : "10px 0", borderBottom: i < items.length - 1 ? "1px solid rgba(255,255,255,0.06)" : "none" }}>
                              <p style={{ font: `500 ${isCompactScreen ? "0.98rem" : "0.9rem"}/1.3 ${fd}`, color: "#FFFFFF" }}>{m.nombre}</p>
                              <span style={{ font: `700 ${isCompactScreen ? "0.95rem" : "0.88rem"}/1 ${fd}`, color: "#818cf8", flexShrink: 0 }}>{m.reps}</span>
                            </div>
                          ))}
                        </div>
                      </div>
                    ) : (
                      // Gym: tabla con kg tracking
                      items.map((ej, i) => {
                        const lastPeso = latestPesoByExercise.get(ej.nombre);
                        const saving = !!inlineSaving[ej.nombre];
                        return (
                          <div key={i} style={{
                            ...(isCompactScreen ? {
                              background: "rgba(255,255,255,0.03)",
                              border: "1px solid rgba(255,255,255,0.06)",
                              borderRadius: 18,
                            } : gc),
                            padding: isCompactScreen ? "16px 14px" : "15px 16px",
                          }}>
                            <div style={{ display: "grid", gap: 12, marginBottom: 14 }}>
                              <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 10 }}>
                                <p style={{ font: `600 ${isCompactScreen ? "1rem" : "0.95rem"}/1.2 ${fd}`, color: "#FFFFFF", marginBottom: 0, flex: 1 }}>{ej.nombre}</p>
                                {lastPeso && (
                                  <div style={{ textAlign: "right", flexShrink: 0 }}>
                                    <div style={{ display: "flex", alignItems: "baseline", gap: 3, justifyContent: "flex-end" }}>
                                      <span style={{ font: `700 ${isCompactScreen ? "1.15rem" : "1.3rem"}/1 ${fd}`, color: "#FFFFFF" }}>{lastPeso.peso}</span>
                                      <span style={{ font: `500 0.62rem/1 ${fd}`, color: "rgba(255,255,255,0.3)", textTransform: "uppercase", letterSpacing: "0.06em" }}>kg</span>
                                    </div>
                                    <p style={{ font: `400 0.62rem/1 ${fd}`, color: "rgba(255,255,255,0.22)", marginTop: 4 }}>último {lastPeso.fecha}</p>
                                  </div>
                                )}
                              </div>
                              <div style={{ display: "flex", gap: 8, alignItems: "stretch", flexWrap: "wrap" }}>
                                  {[
                                    { val: ej.series, label: "series" },
                                    { val: ej.repeticiones, label: "reps" },
                                    ...(ej.peso_sugerido ? [{ val: ej.peso_sugerido, label: "sug." }] : []),
                                  ].map((item) => (
                                    <div key={item.label} style={{ minWidth: 68, padding: "8px 10px", background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.06)", borderRadius: 12, textAlign: "center" }}>
                                      <span style={{ font: `700 1rem/1 ${fd}`, color: "#FFFFFF" }}>{item.val}</span>
                                      <p style={{ font: `500 0.56rem/1 ${fd}`, color: "rgba(255,255,255,0.28)", letterSpacing: "0.07em", textTransform: "uppercase", marginTop: 4 }}>{item.label}</p>
                                    </div>
                                  ))}
                                </div>
                              </div>
                            <div style={{ display: "grid", gridTemplateColumns: isCompactScreen ? "1fr" : "1fr auto", gap: 10, alignItems: "stretch", borderTop: "1px solid rgba(255,255,255,0.06)", paddingTop: 12 }}>
                              <div style={{ position: "relative", flex: 1 }}>
                                <input
                                  type="number" step="0.5" min="0" placeholder="kg hoy"
                                  value={inlineKg[ej.nombre] ?? ""}
                                  onChange={e => setInlineKg(prev => ({ ...prev, [ej.nombre]: e.target.value }))}
                                  onKeyDown={e => e.key === "Enter" && handleInlineKgSave(ej.nombre)}
                                  inputMode="decimal"
                                  style={{ width: "100%", minHeight: 48, padding: "0 44px 0 14px", background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.10)", borderRadius: 14, font: `600 0.98rem/1 ${fd}`, color: "#FFFFFF", outline: "none", boxSizing: "border-box" }}
                                  onFocus={e => (e.currentTarget.style.borderColor = "rgba(249,115,22,0.55)")}
                                  onBlur={e => (e.currentTarget.style.borderColor = "rgba(255,255,255,0.10)")}
                                />
                                <span style={{ position: "absolute", right: 14, top: "50%", transform: "translateY(-50%)", font: `500 0.68rem/1 ${fd}`, color: "rgba(255,255,255,0.28)", pointerEvents: "none", letterSpacing: "0.05em" }}>KG</span>
                              </div>
                              <button
                                onClick={() => handleInlineKgSave(ej.nombre)}
                                disabled={saving || !inlineKg[ej.nombre]}
                                style={{
                                  minHeight: 48,
                                  minWidth: isCompactScreen ? "100%" : 120,
                                  padding: isCompactScreen ? "0 14px" : "0 16px",
                                  background: saving || !inlineKg[ej.nombre] ? "rgba(255,255,255,0.05)" : "linear-gradient(135deg, #F97316 0%, #EA580C 100%)",
                                  border: "none",
                                  borderRadius: 14,
                                  color: saving || !inlineKg[ej.nombre] ? "rgba(255,255,255,0.22)" : "#FFFFFF",
                                  font: `700 0.82rem/1 ${fd}`,
                                  cursor: saving || !inlineKg[ej.nombre] ? "not-allowed" : "pointer",
                                  whiteSpace: "nowrap",
                                  letterSpacing: "0.03em",
                                  transition: "all 0.15s",
                                }}
                              >
                                {saving ? "Guardando..." : "Guardar kg"}
                              </button>
                            </div>
                          </div>
                        );
                      })
                    )}
                  </>
                  );
                })() : (
                  <div style={{ ...gc, padding: "48px 24px", textAlign: "center" }}>
                    <Dumbbell size={28} color="rgba(255,255,255,0.15)" strokeWidth={1.5} style={{ margin: "0 auto 16px" }} />
                    <p style={{ font: `600 0.95rem/1 ${fd}`, color: "#FFFFFF", marginBottom: 6 }}>Sin rutina asignada</p>
                    <p style={{ font: `400 0.78rem/1.5 ${fd}`, color: "rgba(255,255,255,0.3)" }}>Tu entrenador aun no configuro tu rutina.</p>
                  </div>
                )}
              </div>
            )}

            {/* TAB — METAS */}
            {tab === "metas" && (
              <div style={{ display: "flex", flexDirection: "column", gap: 8, animation: "fadeUp 0.22s ease" }}>
                <div style={{ ...gc, padding: "18px 20px" }}>
                  <p style={{ font: `400 0.65rem/1 ${fd}`, color: "rgba(255,255,255,0.3)", letterSpacing: "0.08em", textTransform: "uppercase", marginBottom: 6 }}>Tu progreso</p>
                  <h2 style={{ font: `700 1.5rem/1 ${fd}`, color: "#FFFFFF", letterSpacing: "-0.03em", marginBottom: 16 }}>Metas</h2>
                  <div style={{ display: "flex", gap: 8 }}>
                    {[
                      { label: "Racha", value: "—", unit: "dias" },
                      { label: "Sesiones", value: pesos.length > 0 ? `${pesos.length}` : "—", unit: "registros" },
                    ].map(m => (
                      <div key={m.label} style={{ flex: 1, background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.06)", borderRadius: 12, padding: "14px 12px", textAlign: "center" }}>
                        <span style={{ font: `700 1.5rem/1 ${fd}`, color: "#FFFFFF" }}>{m.value}</span>
                        <p style={{ font: `400 0.6rem/1 ${fd}`, color: "rgba(255,255,255,0.25)", textTransform: "uppercase", letterSpacing: "0.08em", marginTop: 5 }}>{m.unit}</p>
                      </div>
                    ))}
                  </div>
                </div>

                {[
                  { title: "Consistencia", desc: "Entrana 3 veces esta semana", progress: 0, total: 3 },
                  { title: "Fuerza", desc: "Registra un nuevo maximo personal", progress: 0, total: 1 },
                  { title: "Asistencia", desc: "Reserva y asiste a 5 clases", progress: Math.min(misReservas.length, 5), total: 5 },
                ].map(r => (
                  <div key={r.title} style={{ ...gc, padding: "15px 16px" }}>
                    <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 10 }}>
                      <div>
                        <p style={{ font: `600 0.85rem/1 ${fd}`, color: "#FFFFFF", marginBottom: 3 }}>{r.title}</p>
                        <p style={{ font: `400 0.72rem/1 ${fd}`, color: "rgba(255,255,255,0.3)" }}>{r.desc}</p>
                      </div>
                      <span style={{ font: `600 0.8rem/1 ${fd}`, color: r.progress >= r.total ? "#34D399" : "rgba(255,255,255,0.2)" }}>
                        {r.progress}/{r.total}
                      </span>
                    </div>
                    <div style={{ height: 2, background: "rgba(255,255,255,0.06)", borderRadius: 99 }}>
                      <div style={{ height: "100%", width: `${Math.min((r.progress / r.total) * 100, 100)}%`, background: r.progress >= r.total ? "#34D399" : "rgba(255,255,255,0.2)", borderRadius: 99, transition: "width 0.5s ease" }} />
                    </div>
                  </div>
                ))}

                <div style={{ ...gc, padding: "24px 20px", textAlign: "center" }}>
                  <Target size={20} color="rgba(255,255,255,0.15)" strokeWidth={1.5} style={{ margin: "0 auto 10px" }} />
                  <p style={{ font: `400 0.7rem/1 ${fd}`, color: "rgba(255,255,255,0.2)", letterSpacing: "0.1em", textTransform: "uppercase" }}>Mas retos proxximamente</p>
                </div>
              </div>
            )}

            {/* TAB — PERFIL */}
            {tab === "perfil" && (
              <div style={{ display: "flex", flexDirection: "column", gap: 8, animation: "fadeUp 0.22s ease" }}>
                <div style={{ ...gc, padding: "18px 18px", display: "flex", alignItems: "center", gap: 14 }}>
                  <div style={{ width: 50, height: 50, borderRadius: "50%", background: "#1C1F26", border: "1px solid rgba(255,255,255,0.1)", display: "flex", alignItems: "center", justifyContent: "center", font: `700 1.1rem/1 ${fd}`, color: "rgba(255,255,255,0.8)", flexShrink: 0 }}>
                    {initials}
                  </div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <p style={{ font: `600 1rem/1.2 ${fd}`, color: "#FFFFFF", marginBottom: 3, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{session.full_name}</p>
                    <p style={{ font: `400 0.72rem/1 ${fd}`, color: "rgba(255,255,255,0.3)" }}>Miembro</p>
                  </div>
                  <span style={{ font: `500 0.62rem/1 ${fd}`, color: "#34D399", background: "rgba(52,211,153,0.08)", border: "1px solid rgba(52,211,153,0.15)", padding: "4px 10px", borderRadius: 9999, letterSpacing: "0.06em", flexShrink: 0 }}>
                    ACTIVO
                  </span>
                </div>

                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 6 }}>
                  {[
                    { label: "Estado", value: "Activo", color: "#34D399" },
                    { label: "Plan", value: session.plan ?? "Sin plan", color: "#FFFFFF" },
                    { label: "Vence", value: session.expiration ? `${session.expiration.slice(8,10)}/${session.expiration.slice(5,7)}` : "—", color: "#FFFFFF" },
                  ].map(item => (
                    <div key={item.label} style={{ ...gc, padding: "14px 10px", textAlign: "center" }}>
                      <p style={{ font: `400 0.55rem/1 ${fd}`, color: "rgba(255,255,255,0.25)", letterSpacing: "0.12em", textTransform: "uppercase", marginBottom: 8 }}>{item.label}</p>
                      <p style={{ font: `600 0.82rem/1.2 ${fd}`, color: item.color, wordBreak: "break-word" }}>{item.value}</p>
                    </div>
                  ))}
                </div>

                {/* Expiry warning */}
                {session.expiration && (() => {
                  const exp = new Date(session.expiration);
                  const daysLeft = Math.ceil((exp.getTime() - Date.now()) / 86_400_000);
                  if (daysLeft > 3) return null;
                  return (
                    <div style={{ background: "rgba(251,191,36,0.08)", border: "1px solid rgba(251,191,36,0.25)", borderRadius: 14, padding: "12px 14px", display: "flex", gap: 10, alignItems: "flex-start" }}>
                      <span style={{ fontSize: 16, flexShrink: 0 }}>⚠️</span>
                      <p style={{ font: `500 0.8rem/1.45 ${fd}`, color: "rgba(255,255,255,0.7)" }}>
                        Tu plan vence en <strong style={{ color: "#FBBF24" }}>{daysLeft <= 0 ? "hoy" : `${daysLeft} día${daysLeft !== 1 ? "s" : ""}`}</strong>. Acercate a recepción para renovarlo.
                      </p>
                    </div>
                  );
                })()}

                {/* Monthly attendance calendar */}
                {asistCount > 0 && (() => {
                  const now = new Date();
                  const year = now.getFullYear();
                  const month = now.getMonth();
                  const daysInMonth = new Date(year, month + 1, 0).getDate();
                  const firstDow = new Date(year, month, 1).getDay(); // 0=Sun
                  const attended = new Set(asistFechas);
                  const cells: (number | null)[] = Array(firstDow).fill(null);
                  for (let d = 1; d <= daysInMonth; d++) cells.push(d);
                  while (cells.length % 7 !== 0) cells.push(null);
                  const monthName = now.toLocaleDateString("es-AR", { month: "long" });
                  return (
                    <div style={{ ...gc, padding: "16px 14px" }}>
                      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 12 }}>
                        <p style={{ font: `600 0.8rem/1 ${fd}`, color: "rgba(255,255,255,0.7)", textTransform: "capitalize" }}>{monthName}</p>
                        <span style={{ font: `600 0.7rem/1 ${fd}`, color: "#F97316", background: "rgba(249,115,22,0.1)", border: "1px solid rgba(249,115,22,0.2)", padding: "3px 9px", borderRadius: 9999 }}>
                          {asistCount} día{asistCount !== 1 ? "s" : ""}
                        </span>
                      </div>
                      <div style={{ display: "grid", gridTemplateColumns: "repeat(7, 1fr)", gap: 4, marginBottom: 8 }}>
                        {["D","L","M","X","J","V","S"].map(d => (
                          <div key={d} style={{ textAlign: "center", font: `500 0.52rem/1 ${fd}`, color: "rgba(255,255,255,0.2)", letterSpacing: "0.05em" }}>{d}</div>
                        ))}
                      </div>
                      <div style={{ display: "grid", gridTemplateColumns: "repeat(7, 1fr)", gap: 4 }}>
                        {cells.map((day, i) => {
                          if (!day) return <div key={i} />;
                          const iso = `${year}-${String(month + 1).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
                          const isToday = iso === now.toISOString().slice(0, 10);
                          const wasHere = attended.has(iso);
                          return (
                            <div key={i} style={{ aspectRatio: "1", display: "flex", alignItems: "center", justifyContent: "center", borderRadius: "50%", position: "relative", background: wasHere ? "rgba(52,211,153,0.15)" : isToday ? "rgba(249,115,22,0.12)" : "transparent", border: isToday ? "1px solid rgba(249,115,22,0.3)" : "none" }}>
                              <span style={{ font: `${wasHere || isToday ? "700" : "400"} 0.65rem/1 ${fd}`, color: wasHere ? "#34D399" : isToday ? "#F97316" : "rgba(255,255,255,0.35)" }}>{day}</span>
                              {wasHere && <div style={{ position: "absolute", bottom: 1, width: 3, height: 3, borderRadius: "50%", background: "#34D399" }} />}
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  );
                })()}

                {pesos.length > 0 && (
                  <div style={{ ...gc, padding: "16px 18px" }}>
                    <p style={{ font: `500 0.65rem/1 ${fd}`, color: "rgba(255,255,255,0.3)", letterSpacing: "0.1em", textTransform: "uppercase", marginBottom: 14 }}>Historial de cargas</p>
                    <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                      {pesos.slice(0, 8).map(p => (
                        <div key={p.id} style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                          <span style={{ font: `400 0.82rem/1 ${fd}`, color: "rgba(255,255,255,0.55)" }}>{p.ejercicio}</span>
                          <div style={{ textAlign: "right" }}>
                            <div style={{ display: "flex", alignItems: "baseline", gap: 2, justifyContent: "flex-end" }}>
                              <span style={{ font: `600 1rem/1 ${fd}`, color: "#FFFFFF" }}>{p.peso}</span>
                              <span style={{ font: `400 0.58rem/1 ${fd}`, color: "rgba(255,255,255,0.25)", textTransform: "uppercase", letterSpacing: "0.06em" }}>kg</span>
                            </div>
                            <span style={{ display: "block", font: `400 0.6rem/1 ${fd}`, color: "rgba(255,255,255,0.2)", marginTop: 2 }}>{p.fecha}</span>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}
          </>
        )}
      </div>

      {/* Dock */}
      <style>{`
        @keyframes qrPulse {
          0%, 100% { box-shadow: 0 0 0 0 rgba(249,115,22,0), 0 0 0 5px rgba(10,10,15,0.98), 0 8px 32px rgba(0,0,0,0.7); }
          50%       { box-shadow: 0 0 0 5px rgba(249,115,22,0.08), 0 0 0 5px rgba(10,10,15,0.98), 0 8px 32px rgba(0,0,0,0.7); }
        }
      `}</style>
      <div style={{
        position: "fixed", bottom: 20, left: "50%", transform: "translateX(-50%)",
        width: "92%", maxWidth: 520, zIndex: 100,
        display: "flex", alignItems: "flex-end",
        backdropFilter: isCompactScreen ? "blur(18px)" : "blur(40px)", WebkitBackdropFilter: isCompactScreen ? "blur(18px)" : "blur(40px)",
        background: "rgba(18,18,24,0.92)",
        border: "1px solid rgba(255,255,255,0.07)",
        borderRadius: 28, padding: isCompactScreen ? "8px 6px 10px" : "6px 6px 8px",
        boxShadow: "0 20px 60px rgba(0,0,0,0.6), inset 0 1px 0 rgba(255,255,255,0.04)",
      }}>
        {([
          { key: "calendario",    label: "Clases",   Icon: Calendar },
          { key: "entrenamiento", label: "Entrena",  Icon: Dumbbell },
        ] as const).map(({ key, label, Icon }) => {
          const active = tab === key;
          return (
            <button key={key} onClick={() => setTab(key)} className="tap-active" style={{ flex: 1, minHeight: 52, background: "transparent", border: "none", borderRadius: 20, padding: "8px 6px 5px", cursor: "pointer", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 3 }}>
              <Icon size={20} color={active ? "#FFFFFF" : "rgba(255,255,255,0.25)"} strokeWidth={active ? 2 : 1.5} />
              <span style={{ font: `${active ? "600" : "400"} 0.6rem/1 ${fd}`, color: active ? "rgba(255,255,255,0.8)" : "rgba(255,255,255,0.25)", letterSpacing: "0.03em" }}>{label}</span>
              <div style={{ width: active ? 12 : 0, height: 1.5, background: "#F97316", borderRadius: 99, transition: "width 0.2s ease", marginTop: 1 }} />
            </button>
          );
        })}

        {/* QR center */}
        <div style={{ flexShrink: 0, display: "flex", flexDirection: "column", alignItems: "center", margin: "0 3px" }}>
          <button
            onClick={() => { setCheckinMode("qr"); setCheckinResult(null); setShowQR(true); }}
            className="tap-active"
            style={{ position: "relative", bottom: 16, width: isCompactScreen ? 58 : 62, height: isCompactScreen ? 58 : 62, background: "rgba(12,12,18,0.98)", border: "1px solid rgba(249,115,22,0.4)", borderRadius: 20, cursor: "pointer", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 4, animation: "qrPulse 3s ease-in-out infinite" }}
          >
            <svg width="26" height="26" viewBox="0 0 28 28" fill="none">
              <path d="M4 11V5a1 1 0 0 1 1-1h6" stroke="#FFFFFF" strokeWidth="1.8" strokeLinecap="round"/>
              <path d="M17 4h6a1 1 0 0 1 1 1v6" stroke="#FFFFFF" strokeWidth="1.8" strokeLinecap="round"/>
              <path d="M4 17v6a1 1 0 0 0 1 1h6" stroke="#FFFFFF" strokeWidth="1.8" strokeLinecap="round"/>
              <path d="M17 24h6a1 1 0 0 0 1-1v-6" stroke="#FFFFFF" strokeWidth="1.8" strokeLinecap="round"/>
              <circle cx="14" cy="14" r="2" fill="#F97316"/>
            </svg>
            <span style={{ font: `700 0.4rem/1 ${fd}`, color: "rgba(255,255,255,0.4)", letterSpacing: "0.18em" }}>SCAN</span>
          </button>
          <div style={{ width: 3, height: 3, borderRadius: "50%", background: "#F97316", opacity: 0.5, marginTop: -18 }} />
        </div>

        {([
          { key: "metas",  label: "Metas",  Icon: Target },
          { key: "perfil", label: "Perfil", Icon: User   },
        ] as const).map(({ key, label, Icon }) => {
          const active = tab === key;
          return (
            <button key={key} onClick={() => setTab(key)} className="tap-active" style={{ flex: 1, minHeight: 52, background: "transparent", border: "none", borderRadius: 20, padding: "8px 6px 5px", cursor: "pointer", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 3 }}>
              <Icon size={20} color={active ? "#FFFFFF" : "rgba(255,255,255,0.25)"} strokeWidth={active ? 2 : 1.5} />
              <span style={{ font: `${active ? "600" : "400"} 0.6rem/1 ${fd}`, color: active ? "rgba(255,255,255,0.8)" : "rgba(255,255,255,0.25)", letterSpacing: "0.03em" }}>{label}</span>
              <div style={{ width: active ? 12 : 0, height: 1.5, background: "#F97316", borderRadius: 99, transition: "width 0.2s ease", marginTop: 1 }} />
            </button>
          );
        })}
      </div>

      {/* QR Modal */}
      {showQR && (
        <div onClick={() => setShowQR(false)} style={{ position: "fixed", inset: 0, zIndex: 400, background: "rgba(0,0,0,0.88)", backdropFilter: "blur(32px)", WebkitBackdropFilter: "blur(32px)", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", padding: 20 }}>
          <div onClick={e => e.stopPropagation()} style={{ textAlign: "center", maxWidth: 300, width: "100%", animation: "fadeUp 0.22s cubic-bezier(0.16,1,0.3,1)" }}>

            {/* Tab switcher */}
            <div style={{ display: "flex", gap: 4, background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.08)", borderRadius: 14, padding: 4, marginBottom: 20 }}>
              {([
                { key: "qr",      label: "Mi QR" },
                { key: "checkin", label: "Check-in" },
                { key: "dni",     label: "Mi DNI" },
              ] as const).map(({ key, label }) => (
                <button
                  key={key}
                  onClick={() => { setCheckinMode(key); setCheckinResult(null); }}
                  style={{ flex: 1, padding: "8px 0", borderRadius: 10, border: "none", background: checkinMode === key ? "rgba(249,115,22,0.18)" : "transparent", color: checkinMode === key ? "#F97316" : "rgba(255,255,255,0.3)", font: `${checkinMode === key ? "700" : "500"} 0.7rem/1 ${fd}`, cursor: "pointer", transition: "all 0.15s", letterSpacing: "0.02em" }}
                >
                  {label}
                </button>
              ))}
            </div>

            {/* Mode: Mi QR */}
            {checkinMode === "qr" && (
              <>
                <p style={{ font: `400 0.62rem/1 ${fd}`, color: "rgba(255,255,255,0.2)", letterSpacing: "0.2em", textTransform: "uppercase", marginBottom: 16 }}>El staff escanea este codigo</p>
                <div style={{ background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.08)", borderRadius: 24, padding: 24, position: "relative", overflow: "hidden", marginBottom: 16 }}>
                  <div style={{ position: "absolute", top: 14, left: 14, width: 16, height: 16, borderTop: "1.5px solid rgba(249,115,22,0.4)", borderLeft: "1.5px solid rgba(249,115,22,0.4)", borderRadius: "3px 0 0 0" }} />
                  <div style={{ position: "absolute", top: 14, right: 14, width: 16, height: 16, borderTop: "1.5px solid rgba(249,115,22,0.4)", borderRight: "1.5px solid rgba(249,115,22,0.4)", borderRadius: "0 3px 0 0" }} />
                  <div style={{ position: "absolute", bottom: 14, left: 14, width: 16, height: 16, borderBottom: "1.5px solid rgba(249,115,22,0.4)", borderLeft: "1.5px solid rgba(249,115,22,0.4)", borderRadius: "0 0 0 3px" }} />
                  <div style={{ position: "absolute", bottom: 14, right: 14, width: 16, height: 16, borderBottom: "1.5px solid rgba(249,115,22,0.4)", borderRight: "1.5px solid rgba(249,115,22,0.4)", borderRadius: "0 0 3px 0" }} />
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={`https://api.qrserver.com/v1/create-qr-code/?size=220x220&data=FITGROWX:ID:${session.alumno_id}&color=FFFFFF&bgcolor=0D0D14&qzone=1`} alt="QR" width={220} height={220} style={{ display: "block", margin: "0 auto", borderRadius: 4 }} />
                </div>
                <p style={{ font: `600 0.95rem/1 ${fd}`, color: "#FFFFFF", letterSpacing: "-0.01em", marginBottom: 4 }}>{session.full_name}</p>
                <p style={{ font: `400 0.6rem/1 ${fd}`, color: "rgba(255,255,255,0.18)", letterSpacing: "0.1em", marginBottom: 20, fontVariantNumeric: "tabular-nums" }}>DNI {session.dni ?? "—"}</p>
              </>
            )}

            {/* Mode: Check-in automático */}
            {checkinMode === "checkin" && (
              <div style={{ marginBottom: 20 }}>
                <p style={{ font: `400 0.62rem/1 ${fd}`, color: "rgba(255,255,255,0.2)", letterSpacing: "0.2em", textTransform: "uppercase", marginBottom: 20 }}>Escanéaste el QR del gym</p>
                {checkinResult ? (
                  <div style={{ background: checkinResult.ok ? "rgba(52,211,153,0.06)" : "rgba(239,68,68,0.06)", border: `1px solid ${checkinResult.ok ? "rgba(52,211,153,0.18)" : "rgba(239,68,68,0.18)"}`, borderRadius: 16, padding: "14px 16px", display: "flex", alignItems: "center", gap: 12 }}>
                    <div style={{ width: 36, height: 36, borderRadius: "50%", background: checkinResult.ok ? "rgba(52,211,153,0.12)" : "rgba(239,68,68,0.12)", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                      {checkinResult.ok
                        ? <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#34D399" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12"/></svg>
                        : <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#EF4444" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
                      }
                    </div>
                    <div style={{ flex: 1, minWidth: 0, textAlign: "left" }}>
                      <p style={{ font: `700 0.9rem/1.2 ${fd}`, color: "#FFFFFF", letterSpacing: "-0.01em" }}>
                        {checkinResult.already ? "Ya registrado hoy" : checkinResult.ok ? "¡Buen entreno!" : "Sin acceso"}
                      </p>
                      {checkinResult.ok && checkinResult.hora && <p style={{ font: `400 0.62rem/1 ${fd}`, color: "rgba(255,255,255,0.25)", marginTop: 3 }}>{checkinResult.hora.slice(0, 5)}h · Entrada registrada</p>}
                      {!checkinResult.ok && checkinResult.error && <p style={{ font: `400 0.72rem/1.3 ${fd}`, color: "#EF4444", marginTop: 3 }}>{checkinResult.error}</p>}
                    </div>
                  </div>
                ) : (
                  <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                    <p style={{ font: `400 0.75rem/1.5 ${fd}`, color: "rgba(255,255,255,0.35)", textAlign: "left" }}>
                      Registrá tu ingreso sin escanear nada — tu sesión identifica al gym automáticamente.
                    </p>
                    <button
                      onClick={doCheckin}
                      disabled={checkinLoading}
                      style={{ width: "100%", padding: "13px 0", background: checkinLoading ? "rgba(249,115,22,0.3)" : "linear-gradient(135deg, #F97316 0%, #EA580C 100%)", border: "none", borderRadius: 14, font: `700 0.85rem/1 ${fd}`, color: "#FFFFFF", cursor: checkinLoading ? "not-allowed" : "pointer", display: "flex", alignItems: "center", justifyContent: "center", gap: 8 }}
                    >
                      {checkinLoading
                        ? <><div style={{ width: 14, height: 14, borderRadius: "50%", border: "2px solid rgba(255,255,255,0.2)", borderTopColor: "#fff", animation: "spin 0.7s linear infinite" }} /> Registrando...</>
                        : "Registrar mi ingreso"
                      }
                    </button>
                  </div>
                )}
              </div>
            )}

            {/* Mode: Mi DNI */}
            {checkinMode === "dni" && (
              <div style={{ marginBottom: 20 }}>
                <p style={{ font: `400 0.62rem/1 ${fd}`, color: "rgba(255,255,255,0.2)", letterSpacing: "0.2em", textTransform: "uppercase", marginBottom: 16 }}>El staff ingresa tu DNI</p>
                <div style={{ background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.08)", borderRadius: 24, padding: "32px 20px", marginBottom: 14 }}>
                  <p style={{ font: `800 2.6rem/1 ${fd}`, color: "#FFFFFF", letterSpacing: "0.04em", fontVariantNumeric: "tabular-nums" }}>
                    {session.dni ?? "—"}
                  </p>
                  <p style={{ font: `400 0.62rem/1 ${fd}`, color: "rgba(255,255,255,0.2)", letterSpacing: "0.2em", textTransform: "uppercase", marginTop: 10 }}>DNI</p>
                </div>
                <p style={{ font: `600 0.95rem/1 ${fd}`, color: "#FFFFFF", letterSpacing: "-0.01em", marginBottom: 4 }}>{session.full_name}</p>
              </div>
            )}

            <button onClick={() => setShowQR(false)} style={{ width: "100%", padding: "13px 0", background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.07)", borderRadius: 14, font: `500 0.7rem/1 ${fd}`, color: "rgba(255,255,255,0.35)", cursor: "pointer", letterSpacing: "0.08em" }}>
              CERRAR
            </button>
          </div>
        </div>
      )}

      {/* Toast */}
      {toast && (
        <div style={{ position: "fixed", bottom: 106, left: "50%", transform: "translateX(-50%)", zIndex: 300, background: toast.ok ? "rgba(52,211,153,0.15)" : "rgba(239,68,68,0.15)", backdropFilter: "blur(20px)", WebkitBackdropFilter: "blur(20px)", color: toast.ok ? "#34D399" : "#EF4444", padding: "10px 18px", borderRadius: 10, font: `500 0.78rem/1 ${fd}`, letterSpacing: "0.02em", boxShadow: "0 8px 32px rgba(0,0,0,0.4)", whiteSpace: "nowrap", pointerEvents: "none", border: `1px solid ${toast.ok ? "rgba(52,211,153,0.2)" : "rgba(239,68,68,0.2)"}` }}>
          {toast.msg}
        </div>
      )}
    </div>
  );
}
