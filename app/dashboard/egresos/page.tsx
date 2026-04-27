"use client";

import { useState, useEffect, useCallback } from "react";
import { Plus, Receipt, TrendingDown, Tag, Calendar, X, DollarSign } from "lucide-react";
import { getTodayDate } from "@/lib/date-utils";
import { supabase } from "@/lib/supabase";
import { getCachedProfile, getPageCache, setPageCache } from "@/lib/gym-cache";

const fd = "var(--font-inter, 'Inter', sans-serif)";
const fb = "var(--font-inter, 'Inter', sans-serif)";
const t1 = "#1A1D23";
const t2 = "#6B7280";
const t3 = "#9CA3AF";
const card = { background: "#FFFFFF", border: "1px solid rgba(0,0,0,0.05)", borderRadius: 14, boxShadow: "0 2px 8px rgba(0,0,0,0.06), 0 0 1px rgba(0,0,0,0.04)" };

const CATEGORIAS = ["Alquiler", "Servicios", "Sueldos", "Equipamiento", "Marketing", "Mantenimiento", "Otros"];

const CAT_COLOR: Record<string, { color: string; bg: string }> = {
  Alquiler:      { color: "#1E50F0", bg: "rgba(30,80,240,0.08)" },
  Servicios:     { color: "#6ea8fe", bg: "rgba(110,168,254,0.08)" },
  Sueldos:       { color: "#F97316", bg: "rgba(249,115,22,0.08)" },
  Equipamiento:  { color: "#FF6A00", bg: "rgba(255,106,0,0.08)" },
  Marketing:     { color: "#D97706", bg: "rgba(217,119,6,0.08)" },
  Mantenimiento: { color: "#F59E0B", bg: "rgba(245,158,11,0.08)" },
  Otros:         { color: "#64748B", bg: "rgba(100,116,139,0.08)" },
};

interface Egreso {
  id: string;
  titulo: string;
  monto: number;
  categoria: string;
  fecha: string;
  gym_id: string;
}

const EMPTY_FORM = { titulo: "", monto: "", categoria: CATEGORIAS[0], fecha: getTodayDate() };

export default function EgresosPage() {
  const [isMobile, setIsMobile]   = useState(false);
  const [egresos, setEgresos]     = useState<Egreso[]>([]);
  const [loading, setLoading]     = useState(true);
  const [modalOpen, setModalOpen] = useState(false);
  const [form, setForm]           = useState(EMPTY_FORM);
  const [saving, setSaving]       = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [gymId, setGymId]         = useState<string | null>(null);

  const fetchEgresos = useCallback(async (background = false) => {
    const profile = await getCachedProfile();
    if (!profile) { setLoading(false); return; }
    setGymId(profile.gymId);

    if (!background) {
      const cached = getPageCache<Egreso[]>(`egresos_${profile.gymId}`);
      if (cached) { setEgresos(cached); setLoading(false); }
      else setLoading(true);
    }

    const { data } = await supabase
      .from("egresos").select("id, titulo, monto, categoria, fecha, gym_id")
      .eq("gym_id", profile.gymId).order("fecha", { ascending: false }).limit(200);

    const rows = (data as Egreso[]) ?? [];
    setEgresos(rows);
    setPageCache(`egresos_${profile.gymId}`, rows);
    setLoading(false);
  }, []);

  useEffect(() => {
    const timeoutId = window.setTimeout(() => {
      void fetchEgresos();
    }, 0);

    return () => window.clearTimeout(timeoutId);
  }, [fetchEgresos]);

  useEffect(() => {
    const check = () => setIsMobile(window.innerWidth < 768);
    check();
    window.addEventListener("resize", check);
    return () => window.removeEventListener("resize", check);
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.titulo.trim()) { setFormError("El título es obligatorio."); return; }
    const monto = parseFloat(form.monto);
    if (!monto || monto <= 0) { setFormError("El monto debe ser mayor a 0."); return; }
    if (!gymId) { setFormError("No se pudo obtener el gym."); return; }

    setSaving(true);
    setFormError(null);

    const { error } = await supabase.from("egresos").insert([{
      gym_id:    gymId,
      titulo:    form.titulo.trim(),
      monto,
      categoria: form.categoria,
      fecha:     form.fecha,
    }]);

    if (error) { setFormError(error.message); setSaving(false); return; }

    setModalOpen(false);
    setForm(EMPTY_FORM);
    setSaving(false);
    fetchEgresos();
  };

  const now = new Date();
  const mesActual = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
  const totalMes  = egresos.filter(e => e.fecha.startsWith(mesActual)).reduce((s, e) => s + e.monto, 0);
  const totalAcum = egresos.reduce((s, e) => s + e.monto, 0);

  const porCategoria: Record<string, number> = {};
  egresos.forEach(e => {
    porCategoria[e.categoria] = (porCategoria[e.categoria] ?? 0) + e.monto;
  });
  const topCat = Object.entries(porCategoria).sort((a, b) => b[1] - a[1]);

  return (
    <>
    <div style={{ display: "flex", flexDirection: "column", gap: 18 }}>

      {/* Header */}
      <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between" }}>
        <div>
          {!isMobile && <p style={{ font: `500 0.72rem/1 ${fb}`, color: t3, textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: 6 }}>Finanzas</p>}
          <h1 style={{ font: `800 ${isMobile ? "1.5rem" : "2rem"}/1 ${fd}`, color: t1, letterSpacing: "-0.02em" }}>Egresos</h1>
          {!isMobile && <p style={{ font: `400 0.875rem/1.4 ${fb}`, color: t2, marginTop: 4 }}>Registrá y analizá todos los gastos del gym.</p>}
        </div>
        <button
          onClick={() => { setForm(EMPTY_FORM); setFormError(null); setModalOpen(true); }}
          style={{ display: "flex", alignItems: "center", gap: 6, background: "#F97316", color: "white", border: "none", padding: "10px 20px", borderRadius: 12, font: `700 0.875rem/1 ${fd}`, cursor: "pointer", boxShadow: "0 4px 14px rgba(249,115,22,0.25)" }}
          onMouseEnter={e => (e.currentTarget.style.opacity = "0.9")}
          onMouseLeave={e => (e.currentTarget.style.opacity = "1")}
        >
          <Plus size={15} /> {isMobile ? "Nuevo" : "Nuevo Egreso"}
        </button>
      </div>

      {/* KPI row */}
      <div style={{ display: "grid", gridTemplateColumns: isMobile ? "1fr 1fr" : "repeat(3, 1fr)", gap: isMobile ? 10 : 14 }}>
        {[
          { label: "Gastos del Mes",  value: totalMes,   icon: <TrendingDown size={16} color="white" />, sub: "mes actual" },
          { label: "Acumulado",       value: totalAcum,  icon: <Receipt      size={16} color="white" />, sub: "total registrado" },
          { label: "Categorías",      value: topCat.length, icon: <Tag       size={16} color="white" />, sub: "tipos de gasto", isCount: true },
        ].map(s => (
          <div key={s.label} style={{ ...card, padding: "16px 18px" }}>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 10 }}>
              <span style={{ font: `500 0.72rem/1 ${fb}`, color: t3, textTransform: "uppercase", letterSpacing: "0.06em" }}>{s.label}</span>
              <div style={{ width: 30, height: 30, borderRadius: 8, background: "#2C2C2E", display: "flex", alignItems: "center", justifyContent: "center" }}>{s.icon}</div>
            </div>
            <p style={{ font: `800 ${isMobile ? "1.1rem" : "1.8rem"}/1 ${fd}`, color: t1, marginBottom: 4, wordBreak: "break-all" }}>
              {loading ? "—" : s.isCount ? s.value : `$${(s.value as number).toLocaleString("es-AR")}`}
            </p>
            <p style={{ font: `400 0.72rem/1 ${fb}`, color: t3 }}>{s.sub}</p>
          </div>
        ))}
      </div>

      {/* Main grid: table + breakdown */}
      <div style={{ display: "grid", gridTemplateColumns: isMobile ? "1fr" : "2fr 1fr", gap: 16, alignItems: "start" }}>

        {/* Table — desktop */}
        {!isMobile && (
        <div style={{ ...card, padding: 0, overflow: "hidden" }}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "16px 20px", borderBottom: "1px solid rgba(0,0,0,0.06)" }}>
            <span style={{ font: `700 0.95rem/1 ${fd}`, color: t1 }}>Historial de Egresos</span>
            <span style={{ font: `400 0.75rem/1 ${fb}`, color: t3 }}>{egresos.length} registros</span>
          </div>
          <table style={{ width: "100%", borderCollapse: "collapse" }}>
            <thead>
              <tr style={{ borderBottom: "1px solid rgba(0,0,0,0.06)" }}>
                {["Título", "Categoría", "Fecha", "Monto"].map(h => (
                  <th key={h} style={{ padding: "10px 20px", textAlign: "left", font: `600 0.7rem/1 ${fb}`, color: t3, textTransform: "uppercase", letterSpacing: "0.07em" }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr><td colSpan={4} style={{ padding: "40px", textAlign: "center", font: `400 0.875rem/1 ${fb}`, color: t3 }}>Cargando egresos...</td></tr>
              ) : egresos.length === 0 ? (
                <tr><td colSpan={4} style={{ padding: "40px", textAlign: "center", font: `400 0.875rem/1 ${fb}`, color: t3 }}>Sin egresos registrados.</td></tr>
              ) : egresos.map((e, i) => {
                const cat = CAT_COLOR[e.categoria] ?? CAT_COLOR.Otros;
                return (
                  <tr key={e.id}
                    style={{ borderBottom: i < egresos.length - 1 ? "1px solid rgba(0,0,0,0.04)" : "none" }}
                    onMouseEnter={ev => (ev.currentTarget.style.background = "#FAFBFD")}
                    onMouseLeave={ev => (ev.currentTarget.style.background = "transparent")}
                  >
                    <td style={{ padding: "13px 20px" }}>
                      <div style={{ display: "flex", alignItems: "center", gap: 9 }}>
                        <div style={{ width: 32, height: 32, borderRadius: 9, background: cat.bg, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                          <DollarSign size={14} color={cat.color} />
                        </div>
                        <span style={{ font: `600 0.85rem/1 ${fd}`, color: t1 }}>{e.titulo}</span>
                      </div>
                    </td>
                    <td style={{ padding: "13px 20px" }}>
                      <span style={{ font: `600 0.72rem/1 ${fb}`, color: cat.color, background: cat.bg, padding: "4px 10px", borderRadius: 9999 }}>{e.categoria}</span>
                    </td>
                    <td style={{ padding: "13px 20px", font: `400 0.83rem/1 ${fb}`, color: t2, fontVariantNumeric: "tabular-nums" }}>
                      {new Date(e.fecha + "T12:00:00").toLocaleDateString("es-AR", { day: "2-digit", month: "short", year: "numeric" })}
                    </td>
                    <td style={{ padding: "13px 20px", font: `700 0.9rem/1 ${fd}`, color: "#DC2626", fontVariantNumeric: "tabular-nums" }}>
                      −${e.monto.toLocaleString("es-AR")}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
        )}

        {/* Card list — mobile */}
        {isMobile && (
        <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
            <span style={{ font: `700 0.95rem/1 ${fd}`, color: t1 }}>Historial</span>
            <span style={{ font: `400 0.75rem/1 ${fb}`, color: t3 }}>{egresos.length} registros</span>
          </div>
          {loading ? (
            <p style={{ padding: "40px 20px", font: `400 0.8rem/1 ${fb}`, color: t3, textAlign: "center" }}>Cargando...</p>
          ) : egresos.length === 0 ? (
            <p style={{ padding: "40px 20px", font: `400 0.8rem/1 ${fb}`, color: t3, textAlign: "center" }}>Sin egresos registrados.</p>
          ) : egresos.map((e, i) => {
            const cat = CAT_COLOR[e.categoria] ?? CAT_COLOR.Otros;
            return (
              <div key={e.id} style={{ ...card, padding: "14px 16px", animation: `fadeUp 0.2s ease ${i * 30}ms both` }}>
                <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 8 }}>
                  <div style={{ width: 36, height: 36, borderRadius: 10, background: cat.bg, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                    <DollarSign size={15} color={cat.color} />
                  </div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <p style={{ font: `600 0.85rem/1 ${fd}`, color: t1, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{e.titulo}</p>
                    <p style={{ font: `400 0.7rem/1 ${fb}`, color: t3, marginTop: 2 }}>{new Date(e.fecha + "T12:00:00").toLocaleDateString("es-AR", { day: "2-digit", month: "short", year: "numeric" })}</p>
                  </div>
                  <span style={{ font: `700 0.9rem/1 ${fd}`, color: "#DC2626", flexShrink: 0 }}>−${e.monto.toLocaleString("es-AR")}</span>
                </div>
                <span style={{ font: `600 0.72rem/1 ${fb}`, color: cat.color, background: cat.bg, padding: "3px 10px", borderRadius: 9999 }}>{e.categoria}</span>
              </div>
            );
          })}
        </div>
        )}

        {/* Category breakdown */}
        <div style={{ ...card, padding: "18px 20px" }}>
          <span style={{ font: `700 0.95rem/1 ${fd}`, color: t1, display: "block", marginBottom: 16 }}>Por Categoría</span>
          {topCat.length === 0 ? (
            <p style={{ font: `400 0.83rem/1 ${fb}`, color: t3 }}>Sin datos.</p>
          ) : topCat.map(([cat, total]) => {
            const c = CAT_COLOR[cat] ?? CAT_COLOR.Otros;
            const pct = totalAcum > 0 ? Math.round((total / totalAcum) * 100) : 0;
            return (
              <div key={cat} style={{ marginBottom: 14 }}>
                <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 5 }}>
                  <span style={{ font: `500 0.8rem/1 ${fb}`, color: t2 }}>{cat}</span>
                  <span style={{ font: `700 0.8rem/1 ${fd}`, color: t1 }}>${total.toLocaleString("es-AR")}</span>
                </div>
                <div style={{ height: 5, background: "rgba(0,0,0,0.07)", borderRadius: 9999, overflow: "hidden" }}>
                  <div style={{ height: "100%", width: `${pct}%`, background: `linear-gradient(90deg, ${c.color}80, ${c.color})`, borderRadius: 9999, transition: "width 0.6s cubic-bezier(0.34,1.56,0.64,1)" }} />
                </div>
                <span style={{ font: `400 0.68rem/1 ${fb}`, color: t3, marginTop: 3, display: "block" }}>{pct}% del total</span>
              </div>
            );
          })}
        </div>

      </div>
    </div>

    {/* ── Modal: Nuevo Egreso ── */}
    {modalOpen && (
      <div
        onClick={() => setModalOpen(false)}
        style={{ position: "fixed", inset: 0, zIndex: 100, background: "rgba(0,0,0,0.40)", backdropFilter: "blur(6px)", WebkitBackdropFilter: "blur(6px)", display: "flex", alignItems: isMobile ? "flex-end" : "center", justifyContent: "center", padding: isMobile ? 0 : 20, paddingBottom: isMobile ? "calc(64px + env(safe-area-inset-bottom, 0px))" : undefined }}
      >
        <div
          onClick={e => e.stopPropagation()}
          style={{ background: "#FFFFFF", borderRadius: isMobile ? "20px 20px 0 0" : 20, boxShadow: "0 24px 60px rgba(0,0,0,0.18), 0 0 0 1px rgba(0,0,0,0.06)", width: "100%", maxWidth: isMobile ? "100%" : 460, maxHeight: isMobile ? "calc(90vh - 64px)" : undefined, overflowY: "auto" }}
        >
          {/* Modal header */}
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "22px 24px 0" }}>
            <div>
              <h2 style={{ font: `800 1.2rem/1 ${fd}`, color: t1 }}>Nuevo Egreso</h2>
              <p style={{ font: `400 0.8rem/1.4 ${fb}`, color: t3, marginTop: 4 }}>Registrá un gasto del gym.</p>
            </div>
            <button onClick={() => setModalOpen(false)} style={{ background: "#F0F2F8", border: "none", borderRadius: "50%", width: 32, height: 32, display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer", color: t2 }}>
              <X size={16} />
            </button>
          </div>

          <form onSubmit={handleSubmit} style={{ padding: "20px 24px 24px", display: "flex", flexDirection: "column", gap: 14 }}>
            {/* Título */}
            <div>
              <label style={{ font: `600 0.78rem/1 ${fb}`, color: t2, display: "block", marginBottom: 6 }}>Título *</label>
              <input
                value={form.titulo}
                onChange={e => setForm(f => ({ ...f, titulo: e.target.value }))}
                placeholder="Ej: Alquiler de Mayo"
                style={{ width: "100%", padding: "10px 14px", border: "1px solid rgba(0,0,0,0.10)", borderRadius: 10, font: `400 0.875rem/1 ${fb}`, color: t1, outline: "none", boxSizing: "border-box" }}
              />
            </div>

            {/* Monto */}
            <div>
              <label style={{ font: `600 0.78rem/1 ${fb}`, color: t2, display: "block", marginBottom: 6 }}>Monto (ARS) *</label>
              <input
                type="number"
                min="1"
                step="1"
                value={form.monto}
                onChange={e => setForm(f => ({ ...f, monto: e.target.value }))}
                placeholder="Ej: 150000"
                style={{ width: "100%", padding: "10px 14px", border: "1px solid rgba(0,0,0,0.10)", borderRadius: 10, font: `400 0.875rem/1 ${fb}`, color: t1, outline: "none", boxSizing: "border-box" }}
              />
            </div>

            {/* Categoría */}
            <div>
              <label style={{ font: `600 0.78rem/1 ${fb}`, color: t2, display: "block", marginBottom: 6 }}>Categoría</label>
              <select
                value={form.categoria}
                onChange={e => setForm(f => ({ ...f, categoria: e.target.value }))}
                style={{ width: "100%", padding: "10px 14px", border: "1px solid rgba(0,0,0,0.10)", borderRadius: 10, font: `400 0.875rem/1 ${fb}`, color: t1, outline: "none", background: "white", boxSizing: "border-box" }}
              >
                {CATEGORIAS.map(c => <option key={c} value={c}>{c}</option>)}
              </select>
            </div>

            {/* Fecha */}
            <div>
              <label style={{ font: `600 0.78rem/1 ${fb}`, color: t2, display: "block", marginBottom: 6 }}>
                <Calendar size={12} style={{ display: "inline", marginRight: 4 }} />Fecha
              </label>
              <input
                type="date"
                value={form.fecha}
                onChange={e => setForm(f => ({ ...f, fecha: e.target.value }))}
                style={{ width: "100%", padding: "10px 14px", border: "1px solid rgba(0,0,0,0.10)", borderRadius: 10, font: `400 0.875rem/1 ${fb}`, color: t1, outline: "none", boxSizing: "border-box" }}
              />
            </div>

            {formError && (
              <p style={{ font: `400 0.8rem/1 ${fb}`, color: "#DC2626", padding: "8px 12px", background: "rgba(220,38,38,0.06)", borderRadius: 8 }}>{formError}</p>
            )}

            <button
              type="submit"
              disabled={saving}
              style={{ width: "100%", padding: "13px", background: saving ? "#E5E7EB" : "#F97316", color: saving ? t3 : "white", border: "none", borderRadius: 12, font: `700 0.9rem/1 ${fd}`, cursor: saving ? "default" : "pointer", marginTop: 4, transition: "opacity 0.14s" }}
            >
              {saving ? "Guardando..." : "Registrar Egreso"}
            </button>
          </form>
        </div>
      </div>
    )}
    </>
  );
}
