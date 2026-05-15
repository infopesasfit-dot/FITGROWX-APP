"use client";

import { useState, useEffect, useDeferredValue, useMemo, useCallback } from "react";
import {
  Target, Phone, Clock, CheckCircle, X, MessageSquare, Search, CalendarCheck, CalendarPlus,
} from "lucide-react";
import { supabase } from "@/lib/supabase";
import { getCachedProfile, getPageCache, setPageCache } from "@/lib/gym-cache";

const fd = "var(--font-inter, 'Inter', sans-serif)";
const fb = "var(--font-inter, 'Inter', sans-serif)";
const fm = "var(--font-mono, 'JetBrains Mono', monospace)";
const t1 = "#1A1D23";
const t2 = "#6B7280";
const t3 = "#9CA3AF";
const ORANGE = "#F97316";

const card = {
  background: "#FFFFFF",
  border: "1px solid rgba(0,0,0,0.05)",
  borderRadius: 14,
  boxShadow: "0 2px 8px rgba(0,0,0,0.06), 0 0 1px rgba(0,0,0,0.04)",
};

type Status = "pendiente" | "contactado" | "descartado";
type ClaseStatus = "registrado" | "asistio" | "no_show" | "convertido" | "perdido" | null;

interface Prospecto {
  id: string;
  full_name: string;
  phone: string | null;
  email: string | null;
  created_at: string;
  status: Status;
  clase_gratis_date: string | null;
  clase_gratis_status: ClaseStatus;
  followup_step: number;
}

const FOLLOWUP_LABEL: Record<number, { label: string; color: string }> = {
  0: { label: "Pendiente",   color: "#9CA3AF" },
  1: { label: "Día 0 ✓",    color: "#10B981" },
  2: { label: "Día 2 ✓",    color: "#F59E0B" },
  3: { label: "Completo ✓",  color: "#EC4899" },
};

const STATUS_CFG: Record<Status, { label: string; color: string; bg: string; border: string; icon: React.ReactNode }> = {
  pendiente:  { label: "Nuevo",       color: "#D97706", bg: "rgba(217,119,6,0.09)",   border: "rgba(217,119,6,0.22)",   icon: <Clock size={10} color="#D97706" /> },
  contactado: { label: "Contactado",  color: "#FF6A00", bg: "rgba(255,106,0,0.09)",   border: "rgba(255,106,0,0.22)",   icon: <CheckCircle size={10} color="#FF6A00" /> },
  descartado: { label: "Descartado",  color: "#9CA3AF", bg: "rgba(156,163,175,0.12)", border: "rgba(156,163,175,0.25)", icon: <X size={10} color="#9CA3AF" /> },
};

const NEXT_STATUS: Record<Status, Status> = {
  pendiente:  "contactado",
  contactado: "descartado",
  descartado: "pendiente",
};

type GuestPass = { id: string; code: string; status: string; lead_name: string | null; lead_phone: string | null; claimed_at: string | null; expires_at: string; alumnos: { full_name: string } | null };

export default function ProspectosPage() {
  const [isMobile,        setIsMobile]        = useState(false);
  const [prospectos,      setProspectos]      = useState<Prospecto[]>([]);
  const [loading,         setLoading]         = useState(true);
  const [search,          setSearch]          = useState("");
  const [filter,          setFilter]          = useState<Status | "todos">("todos");
  const [gymId,           setGymId]           = useState<string | null>(null);
  const [clasePickingId,  setClasePickingId]  = useState<string | null>(null);
  const [guestLeads,       setGuestLeads]       = useState<GuestPass[]>([]);
  const [guestLeadsOpen,   setGuestLeadsOpen]   = useState(false);
  const [guestLeadsLoaded, setGuestLeadsLoaded] = useState(false);
  const deferredSearch = useDeferredValue(search);
  useEffect(() => {
    const check = () => setIsMobile(window.innerWidth < 768);
    check();
    window.addEventListener("resize", check);
    return () => window.removeEventListener("resize", check);
  }, []);

  useEffect(() => {
    (async () => {
      const profile = await getCachedProfile();
      if (!profile) { setLoading(false); return; }
      setGymId(profile.gymId);

      const cached = getPageCache<Prospecto[]>(`prospectos_${profile.gymId}`);
      if (cached) { setProspectos(cached); setLoading(false); }

      const { data } = await supabase
        .from("prospectos")
        .select("id, full_name, phone, email, created_at, status, clase_gratis_date, clase_gratis_status, followup_step")
        .eq("gym_id", profile.gymId)
        .order("created_at", { ascending: false });

      const rows = (data ?? []) as Prospecto[];
      setProspectos(rows);
      setPageCache(`prospectos_${profile.gymId}`, rows);
      setLoading(false);
    })();
  }, []);

  const scrollToList = () => {
    window.requestAnimationFrame(() => {
      const element = document.getElementById("prospectos-listado");
      if (!element) return;
      element.scrollIntoView({ behavior: "smooth", block: "start" });
    });
  };

  const updateStatus = useCallback(async (id: string, newStatus: Status) => {
    setProspectos(prev => prev.map(p => p.id === id ? { ...p, status: newStatus } : p));
    if (gymId) {
      const cached = getPageCache<Prospecto[]>(`prospectos_${gymId}`) ?? prospectos;
      setPageCache(
        `prospectos_${gymId}`,
        cached.map(p => (p.id === id ? { ...p, status: newStatus } : p)),
      );
    }
    await supabase.from("prospectos").update({ status: newStatus }).eq("id", id);
  }, [gymId, prospectos]);

  const setClaseGratis = useCallback(async (id: string, date: string) => {
    setProspectos(prev => prev.map(p => p.id === id ? { ...p, clase_gratis_date: date, followup_step: 0, clase_gratis_status: "registrado" as ClaseStatus } : p));
    setClasePickingId(null);
    await supabase.from("prospectos").update({ clase_gratis_date: date, followup_step: 0, clase_gratis_status: "registrado" }).eq("id", id);
  }, []);

  const updateClaseStatus = useCallback(async (id: string, claseStatus: ClaseStatus) => {
    setProspectos(prev => prev.map(p => p.id === id ? { ...p, clase_gratis_status: claseStatus } : p));
    await supabase.from("prospectos").update({ clase_gratis_status: claseStatus }).eq("id", id);
  }, []);

  const sendWelcome = (phone: string | null, name: string) => {
    if (!phone) return;
    const msg = encodeURIComponent(`¡Hola ${name}! Recibimos tu pedido de clase gratis. ¿En qué horario te queda mejor? 💪`);
    window.open(`https://wa.me/${phone.replace(/\D/g, "")}?text=${msg}`, "_blank");
  };

  const filtered = useMemo(() => {
    const searchValue = deferredSearch.trim().toLowerCase();
    return prospectos
      .filter(p => filter === "todos" || p.status === filter)
      .filter(p => {
        if (!searchValue) return true;
        return p.full_name.toLowerCase().includes(searchValue) || (p.phone ?? "").includes(searchValue);
      });
  }, [prospectos, filter, deferredSearch]);

  const pendingCount = useMemo(
    () => prospectos.filter(p => p.status === "pendiente").length,
    [prospectos],
  );
  const contactedCount = useMemo(
    () => prospectos.filter(p => p.status === "contactado").length,
    [prospectos],
  );
  const discardedCount = useMemo(
    () => prospectos.filter(p => p.status === "descartado").length,
    [prospectos],
  );

  const jumpToFilter = (nextFilter: Status | "todos") => {
    setFilter(nextFilter);
    scrollToList();
  };

  const loadGuestLeads = async () => {
    if (guestLeadsLoaded) return;
    const r = await fetch("/api/admin/guest-passes").catch(() => null);
    if (r?.ok) { const d = await r.json(); setGuestLeads(d.passes ?? []); }
    setGuestLeadsLoaded(true);
  };

  const markPassUsed = async (passId: string) => {
    await fetch("/api/admin/guest-passes", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ passId }),
    });
    setGuestLeads(prev => prev.map(p => p.id === passId ? { ...p, status: "used" } : p));
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 18 }}>
      {/* Header */}
      <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between" }}>
        <div>
          {!isMobile && <p style={{ font: `500 0.72rem/1 ${fb}`, color: t3, textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: 6 }}>Captación</p>}
          <h1 style={{ font: `800 ${isMobile ? "1.5rem" : "2rem"}/1 ${fd}`, color: t1, letterSpacing: "-0.02em" }}>Prospectos</h1>
          {!isMobile && <p style={{ font: `400 0.875rem/1.4 ${fm}`, color: t2, marginTop: 4 }}>
            Leads que agendaron una clase gratis desde tu landing.
          </p>}
        </div>
        {pendingCount > 0 && (
          <div style={{ display: "flex", alignItems: "center", gap: 7, background: "rgba(249,115,22,0.09)", border: "1px solid rgba(249,115,22,0.22)", borderRadius: 9999, padding: "8px 16px" }}>
            <Clock size={13} color={ORANGE} />
            <span style={{ font: `700 0.78rem/1 ${fb}`, color: ORANGE }}>{pendingCount} sin contactar</span>
          </div>
        )}
      </div>

      <div style={{ display: "grid", gridTemplateColumns: isMobile ? "1fr 1fr" : "repeat(4, 1fr)", gap: 12 }}>
        {[
          { label: "Todos", value: prospectos.length, color: "#1A1D23", bg: "rgba(15,23,42,0.06)", icon: <Target size={15} color="#1A1D23" />, action: () => jumpToFilter("todos") },
          { label: "Sin contactar", value: pendingCount, color: "#D97706", bg: "rgba(217,119,6,0.09)", icon: <Clock size={15} color="#D97706" />, action: () => jumpToFilter("pendiente") },
          { label: "Contactados", value: contactedCount, color: "#FF6A00", bg: "rgba(255,106,0,0.09)", icon: <CheckCircle size={15} color="#FF6A00" />, action: () => jumpToFilter("contactado") },
          { label: "Descartados", value: discardedCount, color: "#9CA3AF", bg: "rgba(156,163,175,0.12)", icon: <X size={15} color="#9CA3AF" />, action: () => jumpToFilter("descartado") },
        ].map((item) => (
          <button
            key={item.label}
            type="button"
            onClick={item.action}
            style={{
              ...card,
              padding: "16px 18px",
              textAlign: "left",
              cursor: "pointer",
              transition: "transform 0.14s ease, box-shadow 0.14s ease, border-color 0.14s ease",
            }}
            onMouseEnter={(event) => {
              event.currentTarget.style.transform = "translateY(-2px)";
              event.currentTarget.style.boxShadow = "0 10px 24px rgba(15,23,42,0.10)";
              event.currentTarget.style.borderColor = "rgba(249,115,22,0.14)";
            }}
            onMouseLeave={(event) => {
              event.currentTarget.style.transform = "translateY(0)";
              event.currentTarget.style.boxShadow = card.boxShadow as string;
              event.currentTarget.style.borderColor = "rgba(0,0,0,0.05)";
            }}
          >
            <div style={{ width: 32, height: 32, borderRadius: 10, background: item.bg, display: "flex", alignItems: "center", justifyContent: "center", marginBottom: 10 }}>
              {item.icon}
            </div>
            <p style={{ font: `800 1.6rem/1 ${fd}`, color: t1, letterSpacing: "-0.03em", marginBottom: 4 }}>
              {loading ? "—" : item.value}
            </p>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8 }}>
              <p style={{ font: `400 0.68rem/1 ${fb}`, color: t3 }}>{item.label}</p>
              <span style={{ font: `700 0.66rem/1 ${fb}`, color: item.color, whiteSpace: "nowrap" }}>Filtrar</span>
            </div>
          </button>
        ))}
      </div>

      {/* Guest Pass Leads */}
      <div style={{ background: "white", border: "1px solid rgba(0,0,0,0.07)", borderRadius: 16, overflow: "hidden" }}>
        <button
          onClick={() => { setGuestLeadsOpen(o => !o); if (!guestLeadsLoaded) void loadGuestLeads(); }}
          style={{ width: "100%", display: "flex", alignItems: "center", justifyContent: "space-between", padding: "14px 18px", background: "none", border: "none", cursor: "pointer", textAlign: "left" }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <span style={{ fontSize: 18 }}>🎟️</span>
            <div>
              <p style={{ font: `600 0.88rem/1.2 ${fb}`, color: t1, margin: 0 }}>Leads de Pases Libres</p>
              <p style={{ font: `400 0.7rem/1 ${fb}`, color: t2, margin: "2px 0 0" }}>Amigos invitados por tus alumnos</p>
            </div>
          </div>
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke={t2} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ transform: guestLeadsOpen ? "rotate(180deg)" : "none", transition: "transform 0.2s" }}>
            <polyline points="6 9 12 15 18 9"/>
          </svg>
        </button>
        {guestLeadsOpen && (
          <div style={{ borderTop: "1px solid rgba(0,0,0,0.06)", padding: "12px 0" }}>
            {!guestLeadsLoaded ? (
              <p style={{ font: `400 0.8rem/1 ${fb}`, color: t2, textAlign: "center", padding: "12px 0" }}>Cargando...</p>
            ) : guestLeads.length === 0 ? (
              <p style={{ font: `400 0.8rem/1.5 ${fb}`, color: t2, textAlign: "center", padding: "12px 20px" }}>
                Ningún alumno generó un pase aún. Aparecerán aquí cuando un amigo reclame uno.
              </p>
            ) : (
              <div style={{ display: "flex", flexDirection: "column" }}>
                {guestLeads.map(p => (
                  <div key={p.id} style={{ display: "flex", alignItems: "center", gap: 12, padding: "10px 18px", borderBottom: "1px solid rgba(0,0,0,0.04)" }}>
                    <div style={{ width: 8, height: 8, borderRadius: "50%", background: p.status === "used" ? "#9CA3AF" : p.status === "claimed" ? "#22C55E" : "#F59E0B", flexShrink: 0 }} />
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <p style={{ font: `600 0.83rem/1.2 ${fb}`, color: t1, margin: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                        {p.lead_name ?? "—"} · {p.lead_phone ?? "—"}
                      </p>
                      <p style={{ font: `400 0.7rem/1 ${fb}`, color: t2, margin: "2px 0 0" }}>
                        Invitado por {p.alumnos?.full_name ?? "?"} · Código: <strong>{p.code}</strong>
                      </p>
                    </div>
                    <span style={{ font: `500 0.65rem/1 ${fb}`, color: p.status === "used" ? t2 : p.status === "claimed" ? "#16A34A" : "#D97706", background: p.status === "used" ? "rgba(0,0,0,0.04)" : p.status === "claimed" ? "rgba(34,197,94,0.08)" : "rgba(245,158,11,0.1)", padding: "3px 8px", borderRadius: 9999, flexShrink: 0, textTransform: "uppercase" as const, letterSpacing: "0.05em" }}>
                      {p.status === "used" ? "Usado" : p.status === "claimed" ? "Reclamado" : "Pendiente"}
                    </span>
                    {p.status === "claimed" && (
                      <button
                        onClick={() => void markPassUsed(p.id)}
                        style={{ flexShrink: 0, padding: "5px 10px", background: "#1A1D23", color: "white", border: "none", borderRadius: 8, font: `600 0.7rem/1 ${fb}`, cursor: "pointer" }}
                      >
                        Marcar usado
                      </button>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>

      {/* Filters */}
      <div id="prospectos-filtros" style={{ display: "flex", flexDirection: "column", gap: 8, scrollMarginTop: 110 }}>
        {/* Search */}
        <div style={{ position: "relative" }}>
          <Search size={13} style={{ position: "absolute", left: 12, top: "50%", transform: "translateY(-50%)", color: t3 }} />
          <input
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Buscar por nombre o teléfono…"
            style={{ width: "100%", padding: "9px 14px 9px 32px", background: "white", border: "1px solid rgba(0,0,0,0.08)", borderRadius: 9999, font: `400 0.83rem/1 ${fb}`, color: t2, outline: "none", boxSizing: "border-box" as const }}
          />
        </div>
        {/* Status filter pills */}
        <div style={{ display: "flex", gap: 6, overflowX: "auto", paddingBottom: 2 }}>
          {(["todos", "pendiente", "contactado", "descartado"] as const).map(s => (
            <button
              key={s}
              onClick={() => setFilter(s)}
              style={{
                padding: "7px 14px", borderRadius: 9999, border: "none", cursor: "pointer",
                font: `600 0.75rem/1 ${fb}`, transition: "all 0.14s", flexShrink: 0,
                background: filter === s ? t1 : "white",
                color: filter === s ? "white" : t2,
                boxShadow: filter === s ? "none" : "0 1px 3px rgba(0,0,0,0.08)",
              }}
            >
              {s === "todos" ? "Todos" : STATUS_CFG[s].label}
            </button>
          ))}
        </div>
      </div>

      {/* Desktop table */}
      {!isMobile && (
      <div id="prospectos-listado" style={{ ...card, overflow: "hidden", scrollMarginTop: 110 }}>
        <div style={{
          display: "grid", gridTemplateColumns: "1fr 130px 110px 120px 180px 150px",
          padding: "12px 22px", borderBottom: "1px solid rgba(0,0,0,0.06)",
          background: "#F9FAFB",
        }}>
          {["Nombre", "Teléfono", "Fecha", "Estado", "Clase gratis", "Acción"].map(h => (
            <span key={h} style={{ font: `600 0.72rem/1 ${fb}`, color: t3, textTransform: "uppercase", letterSpacing: "0.06em" }}>{h}</span>
          ))}
        </div>

        {loading && (
          <div style={{ padding: "48px 22px", textAlign: "center" as const }}>
            <p style={{ font: `400 0.875rem/1 ${fb}`, color: t3 }}>Cargando prospectos…</p>
          </div>
        )}

        {!loading && filtered.length === 0 && (
          <>
            {!search && filter === "todos" && [
              { name: "Lucas Fernández", status: "pendiente"  as const, date: "hoy",  source: "Landing" },
              { name: "Camila Torres",   status: "contactado" as const, date: "ayer", source: "Instagram" },
              { name: "Agustín García",  status: "pendiente"  as const, date: "ayer", source: "Landing" },
            ].map((ghost, i) => {
              const s = STATUS_CFG[ghost.status];
              return (
                <div key={i} style={{ display: "grid", gridTemplateColumns: "1fr 130px 110px 120px 180px 150px", padding: "14px 22px", alignItems: "center", borderBottom: "1px solid rgba(0,0,0,0.04)", opacity: i === 0 ? 0.55 : i === 1 ? 0.35 : 0.2, filter: "blur(0.5px)", pointerEvents: "none", userSelect: "none" }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                    <div style={{ width: 32, height: 32, borderRadius: "50%", background: "linear-gradient(135deg,#FF6A00,#1E50F0)", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                      <span style={{ font: `700 0.62rem/1 ${fd}`, color: "white" }}>
                        {ghost.name.split(" ").slice(0, 2).map(w => w[0]).join("").toUpperCase()}
                      </span>
                    </div>
                    <div style={{ minWidth: 0 }}>
                      <p style={{ font: `600 0.875rem/1 ${fd}`, color: t1, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{ghost.name}</p>
                      <p style={{ font: `400 0.7rem/1 ${fb}`, color: t3, marginTop: 2 }}>{ghost.source}</p>
                    </div>
                  </div>
                  <span style={{ font: `400 0.82rem/1 ${fb}`, color: t2 }}>—</span>
                  <div>
                    <p style={{ font: `500 0.82rem/1 ${fb}`, color: t1 }}>{ghost.date}</p>
                  </div>
                  <div style={{ display: "inline-flex", alignItems: "center", gap: 5, padding: "5px 10px", borderRadius: 9999, background: s.bg, border: `1px solid ${s.border}`, color: s.color, font: `700 0.72rem/1 ${fb}` }}>
                    {s.icon}{s.label}
                  </div>
                  <span />
                  <span />
                </div>
              );
            })}
            <div style={{ padding: "52px 22px", display: "flex", flexDirection: "column", alignItems: "center", gap: 12 }}>
              <div style={{ width: 48, height: 48, borderRadius: 12, background: "rgba(30,80,240,0.08)", display: "flex", alignItems: "center", justifyContent: "center" }}>
                <Target size={22} color="#1E50F0" />
              </div>
              <p style={{ font: `700 0.95rem/1 ${fd}`, color: t1 }}>
                {search || filter !== "todos" ? "Sin resultados" : "Todavía no hay prospectos"}
              </p>
              <p style={{ font: `400 0.82rem/1.4 ${fb}`, color: t2, textAlign: "center" as const, maxWidth: 320 }}>
                {search || filter !== "todos"
                  ? "Probá ajustar los filtros de búsqueda."
                  : "Activá tu landing desde Automatizaciones para empezar a recibir leads automáticamente."}
              </p>
            </div>
          </>
        )}

        {!loading && filtered.map((p, i) => {
          const s = STATUS_CFG[p.status];
          const date = new Date(p.created_at);
          const dateStr = date.toLocaleDateString("es-AR", { day: "numeric", month: "short" });
          const timeStr = date.toLocaleTimeString("es-AR", { hour: "2-digit", minute: "2-digit" });
          const fw = FOLLOWUP_LABEL[p.followup_step] ?? FOLLOWUP_LABEL[0];
          const isPicking = clasePickingId === p.id;

          return (
            <div
              key={p.id}
              style={{
                display: "grid", gridTemplateColumns: "1fr 130px 110px 120px 180px 150px",
                padding: "14px 22px", alignItems: "center",
                borderBottom: i < filtered.length - 1 ? "1px solid rgba(0,0,0,0.04)" : "none",
                transition: "background 0.12s",
              }}
              onMouseEnter={e => (e.currentTarget.style.background = "#FAFAFA")}
              onMouseLeave={e => (e.currentTarget.style.background = "transparent")}
            >
              <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                <div style={{ width: 32, height: 32, borderRadius: "50%", background: "linear-gradient(135deg,#FF6A00,#1E50F0)", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                  <span style={{ font: `700 0.62rem/1 ${fd}`, color: "white" }}>
                    {p.full_name.split(" ").slice(0, 2).map(w => w[0]).join("").toUpperCase()}
                  </span>
                </div>
                <div style={{ minWidth: 0 }}>
                  <p style={{ font: `600 0.875rem/1 ${fd}`, color: t1, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{p.full_name}</p>
                  {p.email && <p style={{ font: `400 0.7rem/1 ${fb}`, color: t3, marginTop: 2, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{p.email}</p>}
                </div>
              </div>
              <div style={{ display: "flex", alignItems: "center", gap: 5 }}>
                <Phone size={12} color={t3} />
                <span style={{ font: `400 0.82rem/1 ${fb}`, color: t2 }}>{p.phone ?? "—"}</span>
              </div>
              <div>
                <p style={{ font: `500 0.82rem/1 ${fb}`, color: t1 }}>{dateStr}</p>
                <p style={{ font: `400 0.7rem/1 ${fb}`, color: t3, marginTop: 3 }}>{timeStr}</p>
              </div>
              <button
                onClick={() => updateStatus(p.id, NEXT_STATUS[p.status])}
                title="Click para cambiar estado"
                style={{ display: "inline-flex", alignItems: "center", gap: 5, padding: "5px 10px", borderRadius: 9999, background: s.bg, border: `1px solid ${s.border}`, color: s.color, font: `700 0.72rem/1 ${fb}`, cursor: "pointer" }}
              >
                {s.icon}{s.label}
              </button>
              <div style={{ position: "relative" }}>
                {isPicking ? (
                  <input
                    type="date"
                    autoFocus
                    defaultValue={p.clase_gratis_date ?? new Date().toISOString().slice(0, 10)}
                    onBlur={e => { if (e.target.value) setClaseGratis(p.id, e.target.value); else setClasePickingId(null); }}
                    onChange={e => { if (e.target.value) setClaseGratis(p.id, e.target.value); }}
                    style={{ font: `500 0.75rem/1 ${fb}`, color: t1, border: "1px solid rgba(236,72,153,0.4)", borderRadius: 8, padding: "5px 8px", outline: "none", width: "100%" }}
                  />
                ) : p.clase_gratis_date ? (
                  <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
                    <button
                      onClick={() => setClasePickingId(p.id)}
                      style={{ display: "inline-flex", alignItems: "center", gap: 4, background: "none", border: "none", cursor: "pointer", padding: 0 }}
                    >
                      <span style={{ display: "flex", alignItems: "center", gap: 4, font: `600 0.75rem/1 ${fb}`, color: "#EC4899" }}>
                        <CalendarCheck size={11} color="#EC4899" />
                        {new Date(p.clase_gratis_date + "T00:00:00").toLocaleDateString("es-AR", { day: "numeric", month: "short" })}
                      </span>
                    </button>
                    {(!p.clase_gratis_status || p.clase_gratis_status === "registrado") && (
                      <div style={{ display: "flex", gap: 3 }}>
                        <button onClick={() => updateClaseStatus(p.id, "asistio")} style={{ padding: "2px 6px", borderRadius: 5, border: "1px solid rgba(16,185,129,0.35)", background: "rgba(16,185,129,0.08)", color: "#10B981", font: `700 0.64rem/1 ${fb}`, cursor: "pointer" }}>✓ Asistió</button>
                        <button onClick={() => updateClaseStatus(p.id, "no_show")} style={{ padding: "2px 6px", borderRadius: 5, border: "1px solid rgba(156,163,175,0.3)", background: "rgba(156,163,175,0.06)", color: "#9CA3AF", font: `700 0.64rem/1 ${fb}`, cursor: "pointer" }}>✗ No vino</button>
                      </div>
                    )}
                    {p.clase_gratis_status === "asistio" && (
                      <span style={{ font: `600 0.66rem/1 ${fb}`, color: "#10B981" }}>✓ Asistió · {fw.label}</span>
                    )}
                    {p.clase_gratis_status === "no_show" && (
                      <span style={{ font: `600 0.66rem/1 ${fb}`, color: "#9CA3AF" }}>✗ No vino</span>
                    )}
                    {p.clase_gratis_status === "convertido" && (
                      <span style={{ font: `700 0.66rem/1 ${fb}`, color: "#F59E0B" }}>🎉 Convirtió</span>
                    )}
                    {p.clase_gratis_status === "perdido" && (
                      <span style={{ font: `600 0.66rem/1 ${fb}`, color: "#EF4444" }}>✗ Sin respuesta</span>
                    )}
                  </div>
                ) : (
                  <button
                    onClick={() => setClasePickingId(p.id)}
                    style={{ display: "inline-flex", alignItems: "center", gap: 5, padding: "5px 10px", borderRadius: 8, border: "1px dashed rgba(236,72,153,0.35)", background: "rgba(236,72,153,0.04)", color: "#EC4899", font: `600 0.72rem/1 ${fb}`, cursor: "pointer" }}
                  >
                    <CalendarPlus size={11} />Marcar clase
                  </button>
                )}
              </div>
              <button
                onClick={() => sendWelcome(p.phone, p.full_name.split(" ")[0])}
                disabled={!p.phone}
                style={{ display: "inline-flex", alignItems: "center", gap: 6, padding: "8px 12px", borderRadius: 9, border: "none", background: p.phone ? "#25D366" : "#F0F2F8", color: p.phone ? "white" : t3, font: `600 0.76rem/1 ${fd}`, cursor: p.phone ? "pointer" : "default", boxShadow: p.phone ? "0 2px 8px rgba(37,211,102,0.30)" : "none", transition: "opacity 0.14s" }}
                onMouseEnter={e => { if (p.phone) e.currentTarget.style.opacity = "0.85"; }}
                onMouseLeave={e => { e.currentTarget.style.opacity = "1"; }}
              >
                <MessageSquare size={13} />WA
              </button>
            </div>
          );
        })}
      </div>
      )}

      {/* Mobile card list */}
      {isMobile && (
      <div id="prospectos-listado" style={{ display: "flex", flexDirection: "column", gap: 10, scrollMarginTop: 110 }}>
        {loading && <p style={{ padding: "48px 22px", textAlign: "center", font: `400 0.875rem/1 ${fb}`, color: t3 }}>Cargando prospectos…</p>}
        {!loading && filtered.length === 0 && (
          <div style={{ ...card, padding: "48px 22px", display: "flex", flexDirection: "column", alignItems: "center", gap: 12 }}>
            <Target size={28} color="#1E50F0" />
            <p style={{ font: `700 0.95rem/1 ${fd}`, color: t1 }}>{search || filter !== "todos" ? "Sin resultados" : "Todavía no hay prospectos"}</p>
          </div>
        )}
        {!loading && filtered.map((p) => {
          const s = STATUS_CFG[p.status];
          const date = new Date(p.created_at);
          const dateStr = date.toLocaleDateString("es-AR", { day: "numeric", month: "short" });
          const fw = FOLLOWUP_LABEL[p.followup_step] ?? FOLLOWUP_LABEL[0];
          const isPicking = clasePickingId === p.id;
          return (
            <div key={p.id} style={{ ...card, padding: "14px 16px" }}>
              <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 10 }}>
                <div style={{ width: 38, height: 38, borderRadius: "50%", background: "linear-gradient(135deg,#FF6A00,#1E50F0)", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                  <span style={{ font: `700 0.65rem/1 ${fd}`, color: "white" }}>
                    {p.full_name.split(" ").slice(0, 2).map(w => w[0]).join("").toUpperCase()}
                  </span>
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <p style={{ font: `600 0.88rem/1 ${fd}`, color: t1, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{p.full_name}</p>
                  <p style={{ font: `400 0.72rem/1 ${fb}`, color: t3, marginTop: 2 }}>{p.phone ?? "Sin teléfono"} · {dateStr}</p>
                </div>
                <button
                  onClick={() => updateStatus(p.id, NEXT_STATUS[p.status])}
                  style={{ display: "inline-flex", alignItems: "center", gap: 4, padding: "5px 10px", borderRadius: 9999, background: s.bg, border: `1px solid ${s.border}`, color: s.color, font: `700 0.7rem/1 ${fb}`, cursor: "pointer", flexShrink: 0 }}
                >
                  {s.icon}{s.label}
                </button>
              </div>
              <div style={{ display: "flex", flexDirection: "column", gap: 6, marginBottom: 8 }}>
                {isPicking ? (
                  <input
                    type="date"
                    autoFocus
                    defaultValue={p.clase_gratis_date ?? new Date().toISOString().slice(0, 10)}
                    onBlur={e => { if (e.target.value) setClaseGratis(p.id, e.target.value); else setClasePickingId(null); }}
                    onChange={e => { if (e.target.value) setClaseGratis(p.id, e.target.value); }}
                    style={{ font: `500 0.8rem/1 ${fb}`, color: t1, border: "1px solid rgba(236,72,153,0.4)", borderRadius: 8, padding: "8px 10px", outline: "none" }}
                  />
                ) : (
                  <button
                    onClick={() => setClasePickingId(p.id)}
                    style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 6, padding: "8px", borderRadius: 10, border: p.clase_gratis_date ? "1px solid rgba(236,72,153,0.25)" : "1px dashed rgba(236,72,153,0.35)", background: p.clase_gratis_date ? "rgba(236,72,153,0.06)" : "rgba(236,72,153,0.04)", color: "#EC4899", font: `600 0.78rem/1 ${fb}`, cursor: "pointer" }}
                  >
                    {p.clase_gratis_date ? <CalendarCheck size={12} /> : <CalendarPlus size={12} />}
                    {p.clase_gratis_date
                      ? new Date(p.clase_gratis_date + "T00:00:00").toLocaleDateString("es-AR", { day: "numeric", month: "short" })
                      : "Marcar clase gratis"}
                  </button>
                )}
                {p.clase_gratis_date && (!p.clase_gratis_status || p.clase_gratis_status === "registrado") && (
                  <div style={{ display: "flex", gap: 6 }}>
                    <button onClick={() => updateClaseStatus(p.id, "asistio")} style={{ flex: 1, padding: "7px", borderRadius: 9, border: "1px solid rgba(16,185,129,0.35)", background: "rgba(16,185,129,0.08)", color: "#10B981", font: `700 0.75rem/1 ${fb}`, cursor: "pointer" }}>✓ Asistió</button>
                    <button onClick={() => updateClaseStatus(p.id, "no_show")} style={{ flex: 1, padding: "7px", borderRadius: 9, border: "1px solid rgba(156,163,175,0.3)", background: "rgba(156,163,175,0.06)", color: "#9CA3AF", font: `700 0.75rem/1 ${fb}`, cursor: "pointer" }}>✗ No vino</button>
                  </div>
                )}
                {p.clase_gratis_status === "asistio"    && <span style={{ font: `600 0.72rem/1 ${fb}`, color: "#10B981", textAlign: "center" as const }}>✓ Asistió · {fw.label}</span>}
                {p.clase_gratis_status === "no_show"    && <span style={{ font: `600 0.72rem/1 ${fb}`, color: "#9CA3AF", textAlign: "center" as const }}>✗ No vino</span>}
                {p.clase_gratis_status === "convertido" && <span style={{ font: `700 0.72rem/1 ${fb}`, color: "#F59E0B", textAlign: "center" as const }}>🎉 Convirtió</span>}
                {p.clase_gratis_status === "perdido"    && <span style={{ font: `600 0.72rem/1 ${fb}`, color: "#EF4444", textAlign: "center" as const }}>✗ Sin respuesta</span>}
              </div>
              <button
                onClick={() => sendWelcome(p.phone, p.full_name.split(" ")[0])}
                disabled={!p.phone}
                style={{ width: "100%", display: "flex", alignItems: "center", justifyContent: "center", gap: 6, padding: "9px", borderRadius: 10, border: "none", background: p.phone ? "#25D366" : "#F0F2F8", color: p.phone ? "white" : t3, font: `600 0.82rem/1 ${fd}`, cursor: p.phone ? "pointer" : "default" }}
              >
                <MessageSquare size={13} />WhatsApp bienvenida
              </button>
            </div>
          );
        })}
      </div>
      )}
    </div>
  );
}
