"use client";

import { useState, useEffect, useCallback } from "react";
import { Users, CheckCircle, XCircle, Clock, TrendingUp, ScanLine, ChevronRight } from "lucide-react";
import Link from "next/link";
import { getTodayDate } from "@/lib/date-utils";
import { supabase } from "@/lib/supabase";
import { getCachedProfile } from "@/lib/gym-cache";

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
  alumno_id: string;
  hora: string;
  alumnos: { full_name: string; planes: { nombre: string; accent_color: string | null } | null } | null;
}

interface Ausente {
  id: string;
  full_name: string;
  planes: { nombre: string; accent_color: string | null } | null;
}

interface DayBar { fecha: string; count: number; }

function initials(name: string) {
  return name.split(" ").slice(0, 2).map(w => w[0]).join("").toUpperCase();
}

function fmt2(s: string) {
  return s.slice(0, 5);
}

export default function AsistenciasPage() {
  const [loading, setLoading] = useState(true);
  const [presentes, setPresentes] = useState<Presente[]>([]);
  const [ausentes, setAusentes] = useState<Ausente[]>([]);
  const [todayCount, setTodayCount] = useState(0);
  const [totalMonth, setTotalMonth] = useState(0);
  const [weeklyAvg, setWeeklyAvg] = useState(0);
  const [dailyBars, setDailyBars] = useState<DayBar[]>([]);
  const [hourlyCounts, setHourlyCounts] = useState<number[]>(Array(24).fill(0));
  const [tab, setTab] = useState<"presentes" | "ausentes">("presentes");
  const [gymId, setGymId] = useState<string | null>(null);
  const [isMobile, setIsMobile] = useState(false);

  useEffect(() => {
    const check = () => setIsMobile(window.innerWidth < 768);
    check();
    window.addEventListener("resize", check);
    return () => window.removeEventListener("resize", check);
  }, []);

  const today = getTodayDate();

  const fetchAll = useCallback(async () => {
    setLoading(true);
    const profile = await getCachedProfile();
    if (!profile) { setLoading(false); return; }
    setGymId(profile.gymId);

    const [statsRes, presentesRes, activosRes] = await Promise.all([
      fetch(`/api/admin/asistencias-stats?gym_id=${profile.gymId}`),
      supabase
        .from("asistencias")
        .select("alumno_id, hora, alumnos!alumno_id(full_name, planes!plan_id(nombre, accent_color))")
        .eq("gym_id", profile.gymId)
        .eq("fecha", today)
        .order("hora", { ascending: false }),
      supabase
        .from("alumnos")
        .select("id, full_name, planes!plan_id(nombre, accent_color)")
        .eq("gym_id", profile.gymId)
        .eq("status", "activo"),
    ]);

    if (statsRes.ok) {
      const stats = await statsRes.json();
      setTodayCount(stats.todayCount ?? 0);
      setTotalMonth(stats.totalMonth ?? 0);
      setWeeklyAvg(stats.weeklyAvg ?? 0);
      setDailyBars((stats.dailyCounts ?? []).slice(-14));
      setHourlyCounts(stats.hourlyCounts ?? Array(24).fill(0));
    }

    const presenteRows = (presentesRes.data ?? []) as unknown as Presente[];
    setPresentes(presenteRows);

    const presenteIds = new Set(presenteRows.map(p => p.alumno_id));
    const activos = (activosRes.data ?? []) as unknown as Ausente[];
    setAusentes(activos.filter(a => !presenteIds.has(a.id)));

    setLoading(false);
  }, [today]);

  useEffect(() => {
    const timeoutId = window.setTimeout(() => {
      void fetchAll();
    }, 0);

    return () => window.clearTimeout(timeoutId);
  }, [fetchAll]);

  const maxBar = Math.max(...dailyBars.map(d => d.count), 1);
  const maxHour = Math.max(...hourlyCounts, 1);
  const peakHour = hourlyCounts.indexOf(Math.max(...hourlyCounts));

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>

      {/* Header */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: 10 }}>
        <div>
          <p style={{ font: `500 0.68rem/1 ${fb}`, color: t3, textTransform: "uppercase", letterSpacing: "0.1em", marginBottom: 4 }}>Hoy · {new Date().toLocaleDateString("es-AR", { weekday: "long", day: "numeric", month: "long" })}</p>
          <h1 style={{ font: `800 1.45rem/1 ${fd}`, color: t1, letterSpacing: "-0.025em" }}>Asistencias</h1>
        </div>
        <Link href="/dashboard/scanner" style={{ display: "flex", alignItems: "center", gap: 8, padding: "9px 16px", background: "#1A1D23", color: "white", borderRadius: 12, textDecoration: "none", font: `600 0.8rem/1 ${fd}` }}>
          <ScanLine size={15} /> Escáner QR
        </Link>
      </div>

      {/* Stats row */}
      <div style={{ display: "grid", gridTemplateColumns: isMobile ? "1fr 1fr" : "1fr 1fr 1fr 1fr", gap: 12 }}>
        {[
          { label: "Presentes hoy", value: loading ? "—" : todayCount, icon: <CheckCircle size={15} color="#FF6A00" />, bg: "rgba(255,106,0,0.07)", color: "#FF6A00" },
          { label: "Ausentes hoy", value: loading ? "—" : ausentes.length, icon: <XCircle size={15} color="#EF4444" />, bg: "rgba(239,68,68,0.07)", color: "#EF4444" },
          { label: "Total del mes", value: loading ? "—" : totalMonth, icon: <TrendingUp size={15} color="#6366F1" />, bg: "rgba(99,102,241,0.07)", color: "#6366F1" },
          { label: "Prom. semanal", value: loading ? "—" : weeklyAvg, icon: <Users size={15} color="#0EA5E9" />, bg: "rgba(14,165,233,0.07)", color: "#0EA5E9" },
        ].map(s => (
          <div key={s.label} style={{ ...card, padding: "16px 18px" }}>
            <div style={{ width: 32, height: 32, borderRadius: 10, background: s.bg, display: "flex", alignItems: "center", justifyContent: "center", marginBottom: 10 }}>{s.icon}</div>
            <p style={{ font: `800 1.6rem/1 ${fd}`, color: t1, letterSpacing: "-0.03em", marginBottom: 4 }}>{s.value}</p>
            <p style={{ font: `400 0.68rem/1 ${fb}`, color: t3 }}>{s.label}</p>
          </div>
        ))}
      </div>

      {/* Charts row */}
      <div style={{ display: "grid", gridTemplateColumns: isMobile ? "1fr" : "1.6fr 1fr", gap: 16 }}>

        {/* Daily bar chart */}
        <div style={{ ...card, padding: "20px 22px" }}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 16 }}>
            <span style={{ font: `700 0.9rem/1 ${fd}`, color: t1 }}>Asistencia diaria</span>
            <span style={{ font: `500 0.65rem/1 ${fb}`, color: t3, background: "#F1F2F6", borderRadius: 9999, padding: "3px 9px" }}>Últimos 14 días</span>
          </div>
          {loading ? (
            <div style={{ height: 90, display: "flex", alignItems: "center", justifyContent: "center" }}>
              <p style={{ color: t3, font: `400 0.8rem/1 ${fb}` }}>Cargando...</p>
            </div>
          ) : (
            <div style={{ overflowX: "auto" }}>
              <div style={{ display: "flex", alignItems: "flex-end", gap: 6, minWidth: dailyBars.length * 26, height: 90, paddingBottom: 24, position: "relative" }}>
                {dailyBars.map(d => {
                  const h = maxBar > 0 ? Math.max((d.count / maxBar) * 66, d.count > 0 ? 4 : 0) : 0;
                  const isToday = d.fecha === today;
                  return (
                    <div key={d.fecha} style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 4, flex: 1, minWidth: 20 }}>
                      {d.count > 0 && (
                        <span style={{ font: `700 0.55rem/1 ${fd}`, color: isToday ? "#FF6A00" : t3 }}>{d.count}</span>
                      )}
                      <div style={{ width: "100%", height: h || 2, background: isToday ? "#FF6A00" : d.count > 0 ? "#1A1D23" : "#F1F2F6", borderRadius: "3px 3px 0 0", transition: "height 0.3s ease" }} />
                      <span style={{ font: `400 0.5rem/1 ${fb}`, color: isToday ? "#FF6A00" : t3, position: "absolute", bottom: 0 }}>
                        {new Date(d.fecha + "T12:00:00").getDate()}
                      </span>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>

        {/* Peak hours chart */}
        <div style={{ ...card, padding: "20px 22px" }}>
          <div style={{ marginBottom: 14 }}>
            <span style={{ font: `700 0.9rem/1 ${fd}`, color: t1 }}>Horario pico</span>
            {!loading && maxHour >= 0 && hourlyCounts[peakHour] > 0 && (
              <p style={{ font: `400 0.68rem/1 ${fb}`, color: t3, marginTop: 3 }}>
                Más concurrido: <strong style={{ color: t1 }}>{peakHour}:00 – {peakHour + 1}:00h</strong>
              </p>
            )}
          </div>
          {loading ? (
            <p style={{ color: t3, font: `400 0.8rem/1 ${fb}` }}>Cargando...</p>
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
              {[6,7,8,9,10,17,18,19,20,21,22].map(h => {
                const count = hourlyCounts[h] ?? 0;
                const pct = maxHour > 0 ? (count / maxHour) * 100 : 0;
                const isPeak = h === peakHour && count > 0;
                return (
                  <div key={h} style={{ display: "flex", alignItems: "center", gap: 8 }}>
                    <span style={{ font: `500 0.62rem/1 ${fb}`, color: t3, width: 30, textAlign: "right", flexShrink: 0 }}>{h}h</span>
                    <div style={{ flex: 1, height: 6, background: "#F1F2F6", borderRadius: 9999, overflow: "hidden" }}>
                      <div style={{ width: `${pct}%`, height: "100%", background: isPeak ? "#FF6A00" : "#1A1D23", borderRadius: 9999, transition: "width 0.4s ease" }} />
                    </div>
                    <span style={{ font: `600 0.62rem/1 ${fd}`, color: isPeak ? "#FF6A00" : t2, width: 18, flexShrink: 0 }}>{count}</span>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>

      {/* Presentes / Ausentes tabs */}
      <div style={{ ...card, overflow: "hidden" }}>
        <div style={{ display: "flex", borderBottom: "1px solid rgba(0,0,0,0.06)" }}>
          {(["presentes", "ausentes"] as const).map(t => (
            <button
              key={t}
              onClick={() => setTab(t)}
              style={{
                flex: 1, padding: "14px 0", border: "none", background: "transparent", cursor: "pointer",
                font: `${tab === t ? "700" : "500"} 0.82rem/1 ${fd}`,
                color: tab === t ? t1 : t3,
                borderBottom: `2px solid ${tab === t ? "#FF6A00" : "transparent"}`,
                transition: "all 0.15s",
              }}
            >
              {t === "presentes" ? `Presentes (${presentes.length})` : `Ausentes (${ausentes.length})`}
            </button>
          ))}
        </div>

        <div style={{ maxHeight: 480, overflowY: "auto" }}>
          {loading ? (
            <p style={{ textAlign: "center", padding: "32px 0", font: `400 0.8rem/1 ${fb}`, color: t3 }}>Cargando...</p>
          ) : tab === "presentes" ? (
            presentes.length === 0 ? (
              <div style={{ textAlign: "center", padding: "48px 24px" }}>
                <Clock size={32} color={t3} style={{ margin: "0 auto 12px", display: "block" }} />
                <p style={{ font: `500 0.85rem/1 ${fd}`, color: t3 }}>Nadie escaneó aún hoy.</p>
                <Link href="/dashboard/scanner" style={{ display: "inline-block", marginTop: 14, font: `600 0.78rem/1 ${fd}`, color: "#FF6A00" }}>Ir al escáner →</Link>
              </div>
            ) : (
              <div>
                {presentes.map((p, i) => {
                  const name = p.alumnos?.full_name ?? "—";
                  const plan = (p.alumnos?.planes as { nombre?: string } | null)?.nombre ?? null;
                  return (
                    <div key={p.alumno_id} style={{ display: "flex", alignItems: "center", gap: 12, padding: "12px 20px", borderBottom: i < presentes.length - 1 ? "1px solid rgba(0,0,0,0.04)" : "none" }}>
                      <div style={{ width: 36, height: 36, borderRadius: "50%", background: "#1A1D23", color: "white", display: "flex", alignItems: "center", justifyContent: "center", font: `700 0.65rem/1 ${fd}`, flexShrink: 0 }}>{initials(name)}</div>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <p style={{ font: `600 0.875rem/1 ${fd}`, color: t1, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{name}</p>
                        {plan && <p style={{ font: `400 0.68rem/1 ${fb}`, color: t3, marginTop: 2 }}>{plan}</p>}
                      </div>
                      <div style={{ display: "flex", alignItems: "center", gap: 5, background: "rgba(52,211,153,0.08)", border: "1px solid rgba(52,211,153,0.2)", borderRadius: 9999, padding: "4px 10px" }}>
                        <Clock size={11} color="#34D399" />
                        <span style={{ font: `600 0.7rem/1 ${fd}`, color: "#34D399" }}>{fmt2(p.hora)}</span>
                      </div>
                    </div>
                  );
                })}
              </div>
            )
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
                  return (
                    <div key={a.id} style={{ display: "flex", alignItems: "center", gap: 12, padding: "12px 20px", borderBottom: i < ausentes.length - 1 ? "1px solid rgba(0,0,0,0.04)" : "none" }}>
                      <div style={{ width: 36, height: 36, borderRadius: "50%", background: "#F1F2F6", color: t2, display: "flex", alignItems: "center", justifyContent: "center", font: `700 0.65rem/1 ${fd}`, flexShrink: 0 }}>{initials(a.full_name)}</div>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <p style={{ font: `600 0.875rem/1 ${fd}`, color: t1, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{a.full_name}</p>
                        {plan && <p style={{ font: `400 0.68rem/1 ${fb}`, color: t3, marginTop: 2 }}>{plan}</p>}
                      </div>
                      <ChevronRight size={15} color={t3} />
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
    </div>
  );
}
