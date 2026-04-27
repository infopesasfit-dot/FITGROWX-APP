"use client";

import { useState, useEffect } from "react";
import {
  Target, Phone, Mail, Clock, CheckCircle, X, MessageSquare, Search, Filter,
} from "lucide-react";
import { supabase } from "@/lib/supabase";
import { getCachedProfile, getPageCache, setPageCache } from "@/lib/gym-cache";

const fd = "var(--font-inter, 'Inter', sans-serif)";
const fb = "var(--font-inter, 'Inter', sans-serif)";
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

interface Prospecto {
  id: string;
  full_name: string;
  phone: string | null;
  email: string | null;
  created_at: string;
  status: Status;
}

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

export default function ProspectosPage() {
  const [isMobile, setIsMobile]     = useState(false);
  const [prospectos, setProspectos] = useState<Prospecto[]>([]);
  const [loading,    setLoading]    = useState(true);
  const [search,     setSearch]     = useState("");
  const [filter,     setFilter]     = useState<Status | "todos">("todos");
  const [gymId,      setGymId]      = useState<string | null>(null);

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
        .select("id, full_name, phone, email, created_at, status")
        .eq("gym_id", profile.gymId)
        .order("created_at", { ascending: false });

      const rows = (data ?? []) as Prospecto[];
      setProspectos(rows);
      setPageCache(`prospectos_${profile.gymId}`, rows);
      setLoading(false);
    })();
  }, []);

  const updateStatus = async (id: string, newStatus: Status) => {
    setProspectos(prev => prev.map(p => p.id === id ? { ...p, status: newStatus } : p));
    await supabase.from("prospectos").update({ status: newStatus }).eq("id", id);
  };

  const sendWelcome = (phone: string | null, name: string) => {
    if (!phone) return;
    const msg = encodeURIComponent(`¡Hola ${name}! Recibimos tu pedido de clase gratis. ¿En qué horario te queda mejor? 💪`);
    window.open(`https://wa.me/${phone.replace(/\D/g, "")}?text=${msg}`, "_blank");
  };

  const filtered = prospectos
    .filter(p => filter === "todos" || p.status === filter)
    .filter(p => p.full_name.toLowerCase().includes(search.toLowerCase()) || (p.phone ?? "").includes(search));

  const pendingCount = prospectos.filter(p => p.status === "pendiente").length;

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 18 }}>
      {/* Header */}
      <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between" }}>
        <div>
          {!isMobile && <p style={{ font: `500 0.72rem/1 ${fb}`, color: t3, textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: 6 }}>Captación</p>}
          <h1 style={{ font: `800 ${isMobile ? "1.5rem" : "2rem"}/1 ${fd}`, color: t1, letterSpacing: "-0.02em" }}>Prospectos</h1>
          {!isMobile && <p style={{ font: `400 0.875rem/1.4 ${fb}`, color: t2, marginTop: 4 }}>
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

      {/* Filters */}
      <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
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
      <div style={{ ...card, overflow: "hidden" }}>
        <div style={{
          display: "grid", gridTemplateColumns: "1fr 140px 130px 120px 180px",
          padding: "12px 22px", borderBottom: "1px solid rgba(0,0,0,0.06)",
          background: "#F9FAFB",
        }}>
          {["Nombre", "Teléfono", "Fecha", "Estado", "Acción"].map(h => (
            <span key={h} style={{ font: `600 0.72rem/1 ${fb}`, color: t3, textTransform: "uppercase", letterSpacing: "0.06em" }}>{h}</span>
          ))}
        </div>

        {loading && (
          <div style={{ padding: "48px 22px", textAlign: "center" as const }}>
            <p style={{ font: `400 0.875rem/1 ${fb}`, color: t3 }}>Cargando prospectos…</p>
          </div>
        )}

        {!loading && filtered.length === 0 && (
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
        )}

        {!loading && filtered.map((p, i) => {
          const s = STATUS_CFG[p.status];
          const date = new Date(p.created_at);
          const dateStr = date.toLocaleDateString("es-AR", { day: "numeric", month: "short" });
          const timeStr = date.toLocaleTimeString("es-AR", { hour: "2-digit", minute: "2-digit" });

          return (
            <div
              key={p.id}
              style={{
                display: "grid", gridTemplateColumns: "1fr 140px 130px 120px 180px",
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
                <span style={{ font: `600 0.875rem/1 ${fd}`, color: t1 }}>{p.full_name}</span>
              </div>
              <div style={{ display: "flex", alignItems: "center", gap: 5 }}>
                <Phone size={12} color={t3} />
                <span style={{ font: `400 0.82rem/1 ${fb}`, color: t2 }}>{p.phone ?? "—"}</span>
              </div>
              {p.email && (
                <div style={{ display: "flex", alignItems: "center", gap: 5 }}>
                  <Mail size={12} color={t3} />
                  <span style={{ font: `400 0.78rem/1 ${fb}`, color: t2 }}>{p.email}</span>
                </div>
              )}
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
              <button
                onClick={() => sendWelcome(p.phone, p.full_name.split(" ")[0])}
                disabled={!p.phone}
                style={{ display: "inline-flex", alignItems: "center", gap: 6, padding: "8px 14px", borderRadius: 9, border: "none", background: p.phone ? "#25D366" : "#F0F2F8", color: p.phone ? "white" : t3, font: `600 0.78rem/1 ${fd}`, cursor: p.phone ? "pointer" : "default", boxShadow: p.phone ? "0 2px 8px rgba(37,211,102,0.30)" : "none", transition: "opacity 0.14s" }}
                onMouseEnter={e => { if (p.phone) e.currentTarget.style.opacity = "0.85"; }}
                onMouseLeave={e => { e.currentTarget.style.opacity = "1"; }}
              >
                <MessageSquare size={13} />Enviar bienvenida
              </button>
            </div>
          );
        })}
      </div>
      )}

      {/* Mobile card list */}
      {isMobile && (
      <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
        {loading && <p style={{ padding: "48px 22px", textAlign: "center", font: `400 0.875rem/1 ${fb}`, color: t3 }}>Cargando prospectos…</p>}
        {!loading && filtered.length === 0 && (
          <div style={{ ...card, padding: "48px 22px", display: "flex", flexDirection: "column", alignItems: "center", gap: 12 }}>
            <Target size={28} color="#1E50F0" />
            <p style={{ font: `700 0.95rem/1 ${fd}`, color: t1 }}>{search || filter !== "todos" ? "Sin resultados" : "Todavía no hay prospectos"}</p>
          </div>
        )}
        {!loading && filtered.map((p, i) => {
          const s = STATUS_CFG[p.status];
          const date = new Date(p.created_at);
          const dateStr = date.toLocaleDateString("es-AR", { day: "numeric", month: "short" });
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
