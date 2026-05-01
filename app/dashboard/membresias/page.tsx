"use client";

import { useState, useEffect, useCallback } from "react";
import {
  CreditCard, TrendingUp, Calendar,
  MessageSquareText, X,
} from "lucide-react";
import { supabase } from "@/lib/supabase";
import { getCachedProfile, getPageCache, setPageCache } from "@/lib/gym-cache";

const fd = "var(--font-inter, 'Inter', sans-serif)";
const fb = "var(--font-inter, 'Inter', sans-serif)";
const t1 = "#1A1D23";
const t2 = "#6B7280";
const t3 = "#9CA3AF";
const card = {
  background: "#FFFFFF",
  border: "1px solid rgba(0,0,0,0.05)",
  borderRadius: 14,
  boxShadow: "0 2px 8px rgba(0,0,0,0.06), 0 0 1px rgba(0,0,0,0.04)",
};

// ── Types ─────────────────────────────────────────────────────────────────────
interface PlanDB {
  id: string;
  nombre: string;
  precio: number;
  periodo: string;
  duracion_dias: number;
  access_type: "libre" | "clases_por_semana";
  classes_per_week: number | null;
  active: boolean;
  features: string[];
  destacado: boolean;
  accent_color: string | null;
}

type Draft = {
  nombre: string;
  precio: string;
  periodo: string;
  duracion_dias: string;
  access_type: "libre" | "clases_por_semana";
  classes_per_week: string;
  active: boolean;
  features: string;
  destacado: boolean;
  accent_color: string;
};

interface PromoDB {
  id: string;
  nombre: string;
  promo_type: "descuento" | "referido" | "2x1";
  discount_type: "monto" | "porcentaje";
  discount_value: number;
  note: string | null;
  active: boolean;
}

type PromoDraft = {
  nombre: string;
  promo_type: "descuento" | "referido" | "2x1";
  discount_type: "monto" | "porcentaje";
  discount_value: string;
  note: string;
  active: boolean;
};

// ── Seed templates ────────────────────────────────────────────────────────────
const DEF_COLORS = ["#8E8E93", "#8E8E93", "#8E8E93"];
const DEF_BGS    = ["#F2F2F7", "#F2F2F7", "#F2F2F7"];
const PLAN_ICONS = [
  (c: string) => <CreditCard size={20} color={c} />,
  (c: string) => <TrendingUp size={20} color={c} />,
  (c: string) => <Calendar   size={20} color={c} />,
];

function planStyleFn(accentColor: string | null, i: number) {
  const color = accentColor ?? DEF_COLORS[i % DEF_COLORS.length];
  const bg    = accentColor ? `${accentColor}18` : DEF_BGS[i % DEF_BGS.length];
  const icon  = PLAN_ICONS[i % PLAN_ICONS.length](color);
  return { icon, accentColor: color, accentBg: bg };
}

function planToDraft(p: PlanDB): Draft {
  return {
    nombre:        p.nombre,
    precio:        String(p.precio),
    periodo:       p.periodo,
    duracion_dias: String(p.duracion_dias ?? 30),
    access_type:   p.access_type ?? "libre",
    classes_per_week: p.classes_per_week ? String(p.classes_per_week) : "",
    active:        p.active ?? true,
    features:      (p.features ?? []).join("\n"),
    destacado:     p.destacado,
    accent_color:  p.accent_color ?? "",
  };
}

function promoToDraft(p: PromoDB): PromoDraft {
  return {
    nombre: p.nombre,
    promo_type: p.promo_type,
    discount_type: p.discount_type,
    discount_value: String(p.discount_value ?? ""),
    note: p.note ?? "",
    active: p.active ?? true,
  };
}

// ── Advanced settings modal ───────────────────────────────────────────────────
function AdvancedModal({
  draft, onSave, onClose,
}: {
  draft: Draft;
  onSave: (changes: Pick<Draft, "periodo">) => void;
  onClose: () => void;
}) {
    const [periodo, setPeriodo] = useState(draft.periodo);

  return (
    <div onClick={onClose} style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.40)", backdropFilter: "blur(6px)", WebkitBackdropFilter: "blur(6px)", zIndex: 100, display: "flex", alignItems: "center", justifyContent: "center", padding: 20 }}>
      <div onClick={e => e.stopPropagation()} style={{ background: "#FFFFFF", borderRadius: 20, boxShadow: "0 24px 60px rgba(0,0,0,0.18), 0 0 0 1px rgba(0,0,0,0.06)", width: "100%", maxWidth: 320, overflow: "hidden" }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "20px 22px 16px" }}>
          <div>
            <h2 style={{ font: `800 1rem/1 ${fd}`, color: t1 }}>Configuración del plan</h2>
            <p style={{ font: `400 0.72rem/1 ${fb}`, color: t3, marginTop: 4 }}>Período de cobro.</p>
          </div>
          <button onClick={onClose} style={{ width: 32, height: 32, borderRadius: "50%", background: "#F0F2F8", border: "none", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", color: t2, flexShrink: 0 }}>
            <X size={16} />
          </button>
        </div>
        <div style={{ height: 1, background: "rgba(0,0,0,0.06)", margin: "0 22px" }} />
        <div style={{ padding: "18px 22px 22px", display: "flex", flexDirection: "column", gap: 16 }}>
          <div>
            <label style={{ display: "block", font: `500 0.78rem/1 ${fb}`, color: t1, marginBottom: 8 }}>Período de cobro</label>
            <div style={{ display: "flex", gap: 8 }}>
              {(["mes", "año"] as const).map(op => (
                <button key={op} onClick={() => setPeriodo(op)} style={{ flex: 1, padding: "9px", borderRadius: 10, border: "none", font: `600 0.83rem/1 ${fb}`, cursor: "pointer", transition: "all 0.14s", background: periodo === op ? "#2C2C2E" : "#F0F2F8", color: periodo === op ? "white" : t2 }}>
                  Por {op}
                </button>
              ))}
            </div>
          </div>
          <button onClick={() => { onSave({ periodo }); onClose(); }} style={{ width: "100%", padding: "12px", background: "#FF6A00", color: "white", border: "none", borderRadius: 12, font: `700 0.95rem/1 ${fd}`, cursor: "pointer", boxShadow: "0 4px 16px rgba(255,106,0,0.28)" }}>
            Aplicar
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Page ──────────────────────────────────────────────────────────────────────
export default function MembresiasPage() {
  const [isMobile, setIsMobile] = useState(false);
  const [planes,      setPlanes]      = useState<PlanDB[]>([]);
  const [promos,      setPromos]      = useState<PromoDB[]>([]);
  const [loading,     setLoading]     = useState(true);
  const [drafts,      setDrafts]      = useState<Record<string, Draft>>({});
  const [promoDrafts, setPromoDrafts] = useState<Record<string, PromoDraft>>({});
  const [dirty,       setDirty]       = useState<Set<string>>(new Set());
  const [promoDirty,  setPromoDirty]  = useState<Set<string>>(new Set());
  const [savingSet,   setSavingSet]   = useState<Set<string>>(new Set());
  const [promoSavingSet, setPromoSavingSet] = useState<Set<string>>(new Set());
  const [advanced,    setAdvanced]    = useState<string | null>(null);
  const [toast, setToast] = useState<{ msg: string; type: "ok" | "err" } | null>(null);
  const [alumnosPorPlan, setAlumnosPorPlan] = useState<Record<string, number>>({});
  const [activosCount,   setActivosCount]   = useState(0);

  const syncMembresiasCache = useCallback((nextPlanes: PlanDB[], nextPromos = promos, nextCounts = alumnosPorPlan, nextActivos = activosCount) => {
    if (nextPlanes.length === 0 && nextPromos.length === 0) return;
    getCachedProfile().then(profile => {
      if (!profile) return;
      setPageCache(`membresias_${profile.gymId}`, {
        planes: nextPlanes,
        promos: nextPromos,
        alumnosPorPlan: nextCounts,
        activosCount: nextActivos,
      });
    });
  }, [promos, alumnosPorPlan, activosCount]);

  useEffect(() => {
    const check = () => setIsMobile(window.innerWidth < 768);
    check();
    window.addEventListener("resize", check);
    return () => window.removeEventListener("resize", check);
  }, []);

  const showToast = (msg: string, type: "ok" | "err") => {
    setToast({ msg, type });
    setTimeout(() => setToast(null), 3200);
  };

  // ── Fetch planes ──────────────────────────────────────────────────────────
  const fetchPlanes = useCallback(async (background = false) => {
    const profile = await getCachedProfile();
    if (!profile) { setLoading(false); return; }

    type PlanesCache = { planes: PlanDB[]; promos: PromoDB[]; alumnosPorPlan: Record<string, number>; activosCount: number };
    if (!background) {
      const cached = getPageCache<PlanesCache>(`membresias_${profile.gymId}`);
      if (cached) {
        setPlanes(cached.planes);
        setPromos(cached.promos ?? []);

        const d: Record<string, Draft> = {};
        cached.planes.forEach(p => { d[p.id] = planToDraft(p); });
        setDrafts(d); setDirty(new Set());
        const promoD: Record<string, PromoDraft> = {};
        (cached.promos ?? []).forEach((p) => { promoD[p.id] = promoToDraft(p); });
        setPromoDrafts(promoD); setPromoDirty(new Set());
        setAlumnosPorPlan(cached.alumnosPorPlan);
        setActivosCount(cached.activosCount);
        setLoading(false);
      } else setLoading(true);
    }

      const [{ data }, { data: promosData }, { data: alumnosData }, { count: activos }] = await Promise.all([
      supabase.from("planes").select("id, nombre, precio, periodo, duracion_dias, access_type, classes_per_week, active, features, destacado, accent_color").eq("gym_id", profile.gymId).order("created_at"),
      supabase.from("gym_promotions").select("id, nombre, promo_type, discount_type, discount_value, note, active").eq("gym_id", profile.gymId).order("created_at"),
      supabase.from("alumnos").select("plan_id").eq("gym_id", profile.gymId).not("plan_id", "is", null),
      supabase.from("alumnos").select("id", { count: "exact", head: true }).eq("gym_id", profile.gymId).eq("status", "activo"),
    ]);

    const list: PlanDB[] = data ? (data as PlanDB[]) : [];
    const promoList: PromoDB[] = promosData ? (promosData as PromoDB[]) : [];
    setPlanes(list);
    setPromos(promoList);
    const d: Record<string, Draft> = {};
    list.forEach(p => { d[p.id] = planToDraft(p); });
    setDrafts(d); setDirty(new Set());
    const promoD: Record<string, PromoDraft> = {};
    promoList.forEach((p) => { promoD[p.id] = promoToDraft(p); });
    setPromoDrafts(promoD); setPromoDirty(new Set());
    const counts: Record<string, number> = {};
    (alumnosData ?? []).forEach((a: { plan_id: string }) => {
      if (a.plan_id) counts[a.plan_id] = (counts[a.plan_id] ?? 0) + 1;
    });
    setAlumnosPorPlan(counts);
    setActivosCount(activos ?? 0);
    setPageCache(`membresias_${profile.gymId}`, { planes: list, promos: promoList, alumnosPorPlan: counts, activosCount: activos ?? 0 });
    setLoading(false);
  }, []);

  useEffect(() => { void fetchPlanes(); }, [fetchPlanes]);

  // ── Hero CTA — only hides the mirror overlay ───────────────────────────────

  // ── Inline edit helpers ────────────────────────────────────────────────────
  const updateDraft = (planId: string, field: keyof Draft, value: string | boolean) => {
    setDrafts(prev => ({ ...prev, [planId]: { ...prev[planId], [field]: value } }));
    setDirty(prev => new Set(prev).add(planId));
  };

  const applyTrialPreset = (planId: string) => {
    setDrafts(prev => ({
      ...prev,
      [planId]: {
        ...prev[planId],
        nombre: prev[planId]?.nombre || "Clase de prueba 24hs",
        precio: "0",
        periodo: "24h",
        duracion_dias: "1",
        access_type: "libre",
        classes_per_week: "",
        features: prev[planId]?.features || "Acceso de prueba por 24 horas",
      },
    }));
    setDirty(prev => new Set(prev).add(planId));
  };

  const applyAdvanced = (planId: string, changes: Pick<Draft, "periodo">) => {
    setDrafts(prev => ({ ...prev, [planId]: { ...prev[planId], ...changes } }));
    setDirty(prev => new Set(prev).add(planId));
  };

  const updatePeriodo = (planId: string, periodo: string) => {
    const dias = periodo === "año" ? 365 : periodo === "trimestral" ? 90 : periodo === "24h" ? 1 : 30;
    setDrafts(prev => ({ ...prev, [planId]: { ...prev[planId], periodo, duracion_dias: String(dias) } }));
    setDirty(prev => new Set(prev).add(planId));
  };

  const updatePromoDraft = (promoId: string, field: keyof PromoDraft, value: string | boolean) => {
    setPromoDrafts(prev => ({ ...prev, [promoId]: { ...prev[promoId], [field]: value } }));
    setPromoDirty(prev => new Set(prev).add(promoId));
  };

  // ── Save individual card — INSERT if new slot, UPDATE if existing ─────────
  const saveCard = async (planId: string) => {
    const isNew = planId.startsWith("empty-");
    const draft = drafts[planId];
    if (!draft?.nombre.trim()) { showToast("El nombre del plan es obligatorio.", "err"); return; }

    setSavingSet(prev => new Set(prev).add(planId));

    const clearSaving = () => setSavingSet(prev => { const s = new Set(prev); s.delete(planId); return s; });

    try {
      const profile = await getCachedProfile();
      if (!profile) { clearSaving(); showToast("Sesión expirada. Recargá la página.", "err"); return; }
      const gymId = profile.gymId;

      const featuresArr = (draft.features || "").split("\n").map(f => f.trim()).filter(Boolean);
      const payload = {
        gym_id:        gymId,
        nombre:        draft.nombre.trim(),
        precio:        parseFloat(draft.precio) || 0,
        periodo:       draft.periodo,
        duracion_dias: parseInt(draft.duracion_dias) || 30,
        access_type:   draft.access_type,
        classes_per_week: draft.access_type === "clases_por_semana" ? (parseInt(draft.classes_per_week) || 0) : null,
        active:        draft.active,
        features:      featuresArr,
        destacado:     draft.destacado,
        accent_color:  (draft.accent_color || "").trim() || null,
      };

      if (isNew) {
        const { data: inserted, error } = await supabase
          .from("planes")
          .upsert([payload], { onConflict: "id" })
          .select()
          .maybeSingle();
        if (error) { clearSaving(); showToast(`Error: ${error.message}`, "err"); return; }
        if (!inserted) { clearSaving(); showToast("No se pudo crear el plan. Verificá tu sesión.", "err"); return; }
        const newPlan = inserted as PlanDB;
        setPlanes(prev => {
          const next = [...prev, newPlan];
          syncMembresiasCache(next);
          return next;
        });
        setDrafts(prev => {
          const { [planId]: removedDraft, ...rest } = prev;
          void removedDraft;
          return { ...rest, [newPlan.id]: planToDraft(newPlan) };
        });
        setDirty(prev => { const s = new Set(prev); s.delete(planId); return s; });
      } else {
        const { data: updated, error } = await supabase
          .from("planes")
          .upsert([{ id: planId, ...payload }], { onConflict: "id" })
          .eq("gym_id", gymId)
          .select("id, nombre, precio, periodo, duracion_dias, access_type, classes_per_week, active, features, destacado, accent_color")
          .maybeSingle();
        if (error) { clearSaving(); showToast(`Error: ${error.message}`, "err"); return; }
        if (!updated) { clearSaving(); showToast("No se pudo guardar. Verificá permisos en Supabase (RLS).", "err"); return; }
        setPlanes(prev => {
          const next = prev.map(p => p.id === planId ? (updated as PlanDB) : p);
          syncMembresiasCache(next);
          return next;
        });
        setDirty(prev => { const s = new Set(prev); s.delete(planId); return s; });
      }

      clearSaving();
      showToast("Plan guardado correctamente.", "ok");
    } catch (err: unknown) {
      clearSaving();
      showToast(`Error inesperado: ${err instanceof Error ? err.message : String(err)}`, "err");
    }
  };

  const savePromo = async (promoId: string) => {
    const isNew = promoId.startsWith("promo-empty-");
    const draft = promoDrafts[promoId];
    if (!draft?.nombre.trim()) { showToast("El nombre de la promo es obligatorio.", "err"); return; }
    if (!(parseFloat(draft.discount_value) > 0)) { showToast("Definí un descuento válido.", "err"); return; }

    setPromoSavingSet(prev => new Set(prev).add(promoId));
    const clearSaving = () => setPromoSavingSet(prev => { const s = new Set(prev); s.delete(promoId); return s; });

    try {
      const profile = await getCachedProfile();
      if (!profile) { clearSaving(); showToast("Sesión expirada. Recargá la página.", "err"); return; }

      const payload = {
        gym_id: profile.gymId,
        nombre: draft.nombre.trim(),
        promo_type: draft.promo_type,
        discount_type: draft.discount_type,
        discount_value: parseFloat(draft.discount_value) || 0,
        note: draft.note.trim() || null,
        active: draft.active,
      };

      if (isNew) {
        const { data: inserted, error } = await supabase
          .from("gym_promotions")
          .insert([payload])
          .select("id, nombre, promo_type, discount_type, discount_value, note, active")
          .maybeSingle();
        if (error) { clearSaving(); showToast(`Error: ${error.message}`, "err"); return; }
        if (!inserted) { clearSaving(); showToast("No se pudo crear la promo.", "err"); return; }
        const newPromo = inserted as PromoDB;
        setPromos(prev => {
          const next = [...prev, newPromo];
          syncMembresiasCache(planes, next);
          return next;
        });
        setPromoDrafts(prev => {
          const { [promoId]: removed, ...rest } = prev;
          void removed;
          return { ...rest, [newPromo.id]: promoToDraft(newPromo) };
        });
      } else {
        const { data: updated, error } = await supabase
          .from("gym_promotions")
          .upsert([{ id: promoId, ...payload }], { onConflict: "id" })
          .eq("gym_id", profile.gymId)
          .select("id, nombre, promo_type, discount_type, discount_value, note, active")
          .maybeSingle();
        if (error) { clearSaving(); showToast(`Error: ${error.message}`, "err"); return; }
        if (!updated) { clearSaving(); showToast("No se pudo guardar la promo.", "err"); return; }
        setPromos(prev => {
          const next = prev.map(p => p.id === promoId ? (updated as PromoDB) : p);
          syncMembresiasCache(planes, next);
          return next;
        });
      }

      setPromoDirty(prev => { const s = new Set(prev); s.delete(promoId); return s; });
      clearSaving();
      showToast("Promo guardada correctamente.", "ok");
    } catch (err: unknown) {
      clearSaving();
      showToast(`Error inesperado: ${err instanceof Error ? err.message : String(err)}`, "err");
    }
  };

  // ── Toggle active — va por draft igual que nombre/precio ─────────────────
  const toggleActive = (planId: string, currentActive: boolean) => {
    if (planId.startsWith("empty-")) return;
    updateDraft(planId, "active", !currentActive);
  };

  // ── Derived ───────────────────────────────────────────────────────────────
  // Always exactly 3 slots: real planes first, empty placeholders for the rest
  const EMPTY = (i: number): PlanDB => ({ id: `empty-${i}`, nombre: "", precio: 0, periodo: "mes", duracion_dias: 30, access_type: "libre", classes_per_week: null, active: true, features: [], destacado: false, accent_color: null });
  const EMPTY_PROMO = (i: number): PromoDB => ({ id: `promo-empty-${i}`, nombre: "", promo_type: i === 0 ? "2x1" : "referido", discount_type: "porcentaje", discount_value: i === 0 ? 50 : 10, note: i === 0 ? "Promo 2x1" : "Descuento por referido", active: true });
  const displayPlanes: PlanDB[] = [0, 1, 2].map(i => planes[i] ?? EMPTY(i));
  const displayPromos: PromoDB[] = [0, 1].map(i => promos[i] ?? EMPTY_PROMO(i));
  const displayIngresos = planes.length > 0
    ? displayPlanes.reduce((s, p) => {
        const mensual = p.periodo === "año" ? p.precio / 12 : p.precio;
        return s + mensual * (alumnosPorPlan[p.id] ?? 0);
      }, 0)
    : 0;
  // ── Input style (looks like text, editable on click) ─────────────────────
  const inlineInput: React.CSSProperties = {
    background: "transparent", border: "none", outline: "none",
    width: "100%", padding: "2px 4px", margin: "-2px -4px",
    borderRadius: 6, transition: "background 0.12s, box-shadow 0.12s",
  };

  return (
    <>
      <style>{`
        @keyframes slideUp { from { opacity:0; transform:translateY(10px); } to { opacity:1; transform:translateY(0); } }
        @keyframes fadeInUp { from { opacity:0; transform:translateY(18px); } to { opacity:1; transform:translateY(0); } }
        .inline-field:hover { background: rgba(0,0,0,0.03); }
        .inline-field:focus { background: rgba(0,0,0,0.04); box-shadow: 0 0 0 2px rgba(249,115,22,0.22); }
      `}</style>

      <div style={{ display: "flex", flexDirection: "column", gap: 18 }}>

        {/* ── KPI row + cards + banner ── */}
        <div style={{ display: "flex", flexDirection: "column", gap: 18 }}>

          {/* KPI row */}
          <div style={{ display: "grid", gridTemplateColumns: isMobile ? "1fr 1fr" : "repeat(3, 1fr)", gap: isMobile ? 10 : 14 }}>
            {[
              { label: "Ingreso Est. Mensual", value: loading ? "—" : `$${displayIngresos.toLocaleString("es-AR")}`, icon: <TrendingUp size={16} color="white" />, sub: `${activosCount} alumnos activos` },
              { label: "Planes Activos",       value: loading ? "—" : planes.length,                               icon: <CreditCard  size={16} color="white" />, sub: "configurados" },
              { label: "Renovaciones",         value: 0,                                                            icon: <Calendar   size={16} color="white" />, sub: "este mes" },
            ].map(s => (
              <div key={s.label} style={{ ...card, padding: "16px 18px", transition: "box-shadow 0.2s, transform 0.2s" }}
                onMouseEnter={e => { (e.currentTarget as HTMLDivElement).style.boxShadow = "0 8px 28px rgba(0,0,0,0.10)"; (e.currentTarget as HTMLDivElement).style.transform = "translateY(-2px)"; }}
                onMouseLeave={e => { (e.currentTarget as HTMLDivElement).style.boxShadow = card.boxShadow; (e.currentTarget as HTMLDivElement).style.transform = "none"; }}
              >
                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 10 }}>
                  <span style={{ font: `500 0.72rem/1 ${fb}`, color: t3, textTransform: "uppercase", letterSpacing: "0.06em" }}>{s.label}</span>
                  <div style={{ width: 30, height: 30, borderRadius: 8, background: "#2C2C2E", display: "flex", alignItems: "center", justifyContent: "center" }}>{s.icon}</div>
                </div>
                <p style={{ font: `800 1.8rem/1 ${fd}`, color: t1, marginBottom: 4 }}>{s.value}</p>
                <p style={{ font: `400 0.72rem/1 ${fb}`, color: t3 }}>{s.sub}</p>
              </div>
            ))}
          </div>

          {/* ── Plan cards ── */}
          <div style={{ position: "relative" }}>
            <div style={{ marginBottom: 16 }}>
              <h2 style={{ font: `700 0.95rem/1 ${fd}`, color: t1 }}>Tus planes</h2>
            </div>

            {loading ? (
              <div style={{ textAlign: "center", padding: 48, color: t3, font: `400 0.875rem/1 ${fb}` }}>Cargando planes...</div>
            ) : (
              <div style={{ position: "relative" }}>
              {/* Real cards */}
              <div style={{ display: "grid", gridTemplateColumns: isMobile ? "1fr" : "repeat(3, 1fr)", gap: isMobile ? 16 : 32 }}>
                {displayPlanes.map((p, i) => {
                  const isEmpty    = p.id.startsWith("empty-");
                  const draft      = drafts[p.id] ?? planToDraft(p);
                  const isDirty    = dirty.has(p.id);
                  const isSaving   = savingSet.has(p.id);
                  const isActive   = draft.active ?? true;
                  const { icon } = planStyleFn(draft.accent_color || p.accent_color, i);

                  return (
                    <div key={p.id} style={{
                      ...card, padding: "22px",
                      position: "relative",
                      transition: "box-shadow 0.2s, transform 0.2s, filter 0.25s, opacity 0.25s",
                      filter: isActive ? "none" : "grayscale(1)",
                      opacity: isActive ? 1 : 0.55,
                    }}>
                      {/* Top row: icon + toggle (solo planes guardados) */}
                      <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", marginBottom: 16 }}>
                        <div style={{ width: 36, height: 36, borderRadius: 10, background: "#F2F2F7", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>{icon}</div>
                        <button
                            type="button"
                            onClick={() => isEmpty ? updateDraft(p.id, "active", !isActive) : toggleActive(p.id, isActive)}
                            title={isActive ? "Desactivar plan" : "Activar plan"}
                            style={{ display: "flex", alignItems: "center", gap: 6, background: "none", border: "none", cursor: "pointer", padding: 0 }}
                          >
                            <span style={{ font: `500 0.7rem/1 ${fb}`, color: isActive ? "#34C759" : "#AEAEB2" }}>
                              {isActive ? "Activo" : "Inactivo"}
                            </span>
                            <div style={{ width: 36, height: 20, borderRadius: 9999, background: isActive ? "#34C759" : "rgba(120,120,128,0.18)", position: "relative", transition: "background 0.22s", flexShrink: 0 }}>
                              <span style={{ position: "absolute", top: 2, left: isActive ? 18 : 2, width: 16, height: 16, borderRadius: "50%", background: "white", boxShadow: "0 1px 3px rgba(0,0,0,0.18)", transition: "left 0.22s", display: "block" }} />
                            </div>
                          </button>
                      </div>

                      {/* Nombre */}
                      <div style={{ marginBottom: 6 }}>
                        <p style={{ font: `500 0.65rem/1 ${fb}`, color: t3, textTransform: "uppercase" as const, letterSpacing: "0.07em", marginBottom: 6 }}>Nombre del plan</p>
                        <input
                          className="inline-field"
                          value={draft.nombre}
                          onChange={e => updateDraft(p.id, "nombre", e.target.value)}
                          placeholder="Ej: Plan Básico"
                          style={{ ...inlineInput, font: `800 1.25rem/1.2 ${fd}`, color: t1, display: "block" }}
                        />
                        <button
                          type="button"
                          onClick={() => applyTrialPreset(p.id)}
                          style={{ marginTop: 8, padding: "6px 10px", borderRadius: 999, border: "1px solid rgba(255,106,0,0.14)", background: "rgba(255,106,0,0.06)", color: "#FF6A00", font: `600 0.7rem/1 ${fb}`, cursor: "pointer" }}
                        >
                          Usar como clase de prueba 24hs
                        </button>
                      </div>

                      {/* Precio + Período */}
                      <div style={{ marginBottom: 16, paddingBottom: 14, borderBottom: "1px solid rgba(0,0,0,0.06)" }}>
                        <div style={{ display: "flex", alignItems: "flex-end", justifyContent: "space-between", gap: 10 }}>
                          <div>
                            <p style={{ font: `500 0.65rem/1 ${fb}`, color: "#AEAEB2", textTransform: "uppercase" as const, letterSpacing: "0.07em", marginBottom: 6 }}>Precio</p>
                            <div style={{ display: "flex", alignItems: "baseline", gap: 2 }}>
                              <span style={{ font: `400 1rem/1 ${fd}`, color: "#AEAEB2" }}>$</span>
                              <input
                                className="inline-field no-spin"
                                type="number"
                                value={draft.precio}
                                onChange={e => updateDraft(p.id, "precio", e.target.value)}
                                style={{ ...inlineInput, font: `600 1.15rem/1 ${fd}`, color: t1, width: 110 }}
                              />
                            </div>
                          </div>
                          <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-end", gap: 5 }}>
                            <p style={{ font: `500 0.65rem/1 ${fb}`, color: "#AEAEB2", textTransform: "uppercase" as const, letterSpacing: "0.07em" }}>Período</p>
                            <div style={{ display: "flex", gap: 3, background: "#F2F2F7", borderRadius: 8, padding: 2 }}>
                              {(["mes", "trimestral", "año", "24h"] as const).map(op => (
                                <button key={op} type="button" onClick={() => updatePeriodo(p.id, op)} style={{ padding: "4px 8px", borderRadius: 6, border: "none", font: `500 0.68rem/1 ${fb}`, cursor: "pointer", transition: "all 0.16s", background: draft.periodo === op ? "white" : "transparent", color: draft.periodo === op ? "#1C1C1E" : "#8E8E93", boxShadow: draft.periodo === op ? "0 1px 3px rgba(0,0,0,0.12)" : "none" }}>
                                  {op === "mes" ? "Mensual" : op === "trimestral" ? "Trimestral" : op === "24h" ? "24 hs" : "Anual"}
                                </button>
                              ))}
                            </div>
                          </div>
                        </div>
                      </div>

                      <div style={{ marginBottom: 16, paddingBottom: 14, borderBottom: "1px solid rgba(0,0,0,0.06)", display: "grid", gap: 10 }}>
                        <div>
                          <p style={{ font: `500 0.65rem/1 ${fb}`, color: "#AEAEB2", textTransform: "uppercase" as const, letterSpacing: "0.07em", marginBottom: 8 }}>Tipo de acceso</p>
                          <div style={{ display: "flex", gap: 6, background: "#F2F2F7", borderRadius: 10, padding: 3 }}>
                            {[
                              { key: "libre", label: "Libre" },
                              { key: "clases_por_semana", label: "Clases por semana" },
                            ].map((option) => (
                              <button
                                key={option.key}
                                type="button"
                                onClick={() => updateDraft(p.id, "access_type", option.key as Draft["access_type"])}
                                style={{
                                  flex: 1,
                                  padding: "7px 8px",
                                  borderRadius: 8,
                                  border: "none",
                                  font: `600 0.68rem/1.1 ${fb}`,
                                  cursor: "pointer",
                                  transition: "all 0.16s",
                                  background: draft.access_type === option.key ? "white" : "transparent",
                                  color: draft.access_type === option.key ? "#1C1C1E" : "#8E8E93",
                                  boxShadow: draft.access_type === option.key ? "0 1px 3px rgba(0,0,0,0.12)" : "none",
                                }}
                              >
                                {option.label}
                              </button>
                            ))}
                          </div>
                        </div>

                        {draft.access_type === "clases_por_semana" && (
                          <div>
                            <p style={{ font: `500 0.65rem/1 ${fb}`, color: "#AEAEB2", textTransform: "uppercase" as const, letterSpacing: "0.07em", marginBottom: 8 }}>Cantidad permitida</p>
                            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                              <input
                                className="inline-field no-spin"
                                type="number"
                                min={1}
                                max={14}
                                value={draft.classes_per_week}
                                onChange={e => updateDraft(p.id, "classes_per_week", e.target.value.replace(/[^\d]/g, ""))}
                                placeholder="2"
                                style={{ ...inlineInput, width: 72, background: "#F2F2F7", padding: "10px 12px", margin: 0, font: `700 0.95rem/1 ${fd}`, color: t1, borderRadius: 10 }}
                              />
                              <span style={{ font: `500 0.76rem/1.4 ${fb}`, color: t2 }}>
                                clases por semana
                              </span>
                            </div>
                          </div>
                        )}
                      </div>

                      {/* Características */}
                      <div style={{ marginBottom: 16, flex: 1 }}>
                        <p style={{ font: `500 0.65rem/1 ${fb}`, color: t3, textTransform: "uppercase" as const, letterSpacing: "0.07em", marginBottom: 8 }}>Características</p>
                        <textarea
                          value={draft.features}
                          onChange={e => updateDraft(p.id, "features", e.target.value)}
                          placeholder={"Ej: Acceso a sala de pesas\nClases grupales\nAplicación de seguimiento"}
                          rows={Math.max(3, (draft.features?.split("\n") || []).length)}
                          style={{
                            width: "100%", padding: "10px 12px",
                            background: "#F2F2F7",
                            border: "1px solid transparent",
                            borderRadius: 10,
                            font: `400 0.82rem/1.6 ${fb}`,
                            color: t1, outline: "none", resize: "none",
                            boxSizing: "border-box",
                            transition: "border-color 0.16s",
                          } as React.CSSProperties}
                          onFocus={e => (e.currentTarget.style.borderColor = "rgba(0,122,255,0.35)")}
                          onBlur={e => (e.currentTarget.style.borderColor = "transparent")}
                        />
                      </div>

                      {/* Acciones */}
                      <div style={{ display: "flex", gap: 8 }}>
                        {!isEmpty && !isDirty ? (
                          <button
                            onClick={() => setDirty(prev => new Set(prev).add(p.id))}
                            style={{ flex: 1, padding: "10px 12px", borderRadius: 10, border: "1px solid rgba(0,0,0,0.08)", font: `500 0.82rem/1 ${fd}`, cursor: "pointer", background: "#F2F2F7", color: "#3C3C43", transition: "all 0.16s" }}
                          >
                            Editar
                          </button>
                        ) : (
                          <button
                            onClick={() => saveCard(p.id)}
                            disabled={isSaving}
                            style={{ flex: 1, padding: "10px 12px", borderRadius: 10, border: "none", font: `600 0.82rem/1 ${fd}`, cursor: isSaving ? "wait" : "pointer", background: isSaving ? "#C7C7CC" : "#1C1C1E", color: "white", transition: "all 0.16s" }}
                          >
                            {isSaving ? "Guardando..." : isEmpty ? "Guardar" : "Guardar cambios"}
                          </button>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
              </div>
            )}

            <div style={{ marginTop: 16, padding: "12px 16px", background: "rgba(255,106,0,0.05)", border: "1px solid rgba(255,106,0,0.12)", borderRadius: 12, display: "flex", alignItems: "flex-start", gap: 10 }}>
              <span style={{ fontSize: "1rem", lineHeight: 1, marginTop: 1, flexShrink: 0 }}>💡</span>
              <p style={{ font: `400 0.78rem/1.55 ${fb}`, color: t2, margin: 0 }}>
                <strong style={{ color: t1, fontWeight: 600 }}>¿Tenés una sola cuota mensual?</strong> Completá solo la primera tarjeta con tu plan y dejá las demás desactivadas. Si ofrecés varios planes (ej. mensual + trimestral), usá una tarjeta por plan. También podés usar el preset de <strong style={{ color: t1, fontWeight: 600 }}>clase de prueba 24hs</strong> con precio $0 para pruebas rápidas.
              </p>
            </div>
          </div>

          <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
            <div>
              <h2 style={{ font: `700 0.95rem/1 ${fd}`, color: t1, marginBottom: 6 }}>Promos</h2>
              <p style={{ font: `400 0.78rem/1.45 ${fb}`, color: t3, margin: 0 }}>
                Dejá configuradas promos simples como <strong style={{ color: t1 }}>2x1</strong> o <strong style={{ color: t1 }}>referidos</strong> para que el staff tenga claro qué descuento aplicar y por qué.
              </p>
            </div>

            <div style={{ display: "grid", gridTemplateColumns: isMobile ? "1fr" : "repeat(2, 1fr)", gap: 18 }}>
              {displayPromos.map((promo, index) => {
                const isEmpty = promo.id.startsWith("promo-empty-");
                const draft = promoDrafts[promo.id] ?? promoToDraft(promo);
                const isDirty = promoDirty.has(promo.id);
                const isSaving = promoSavingSet.has(promo.id);
                const promoTitle = draft.promo_type === "2x1" ? "Promo 2x1" : draft.promo_type === "referido" ? "Referidos" : "Descuento general";
                return (
                  <div key={promo.id} style={{ ...card, padding: "20px 22px", display: "flex", flexDirection: "column", gap: 14 }}>
                    <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 12 }}>
                      <div>
                        <p style={{ font: `500 0.65rem/1 ${fb}`, color: t3, textTransform: "uppercase", letterSpacing: "0.07em", marginBottom: 6 }}>Promo</p>
                        <input
                          className="inline-field"
                          value={draft.nombre}
                          onChange={e => updatePromoDraft(promo.id, "nombre", e.target.value)}
                          placeholder={promoTitle}
                          style={{ ...inlineInput, font: `800 1.02rem/1.2 ${fd}`, color: t1, display: "block" }}
                        />
                      </div>
                      <button
                        type="button"
                        onClick={() => updatePromoDraft(promo.id, "active", !draft.active)}
                        style={{
                          width: 44,
                          height: 24,
                          borderRadius: 999,
                          border: "none",
                          cursor: "pointer",
                          background: draft.active ? "#4ADE80" : "#D1D5DB",
                          position: "relative",
                        }}
                      >
                        <span style={{ position: "absolute", top: 3, left: draft.active ? 23 : 3, width: 18, height: 18, borderRadius: "50%", background: "#fff", transition: "left 0.16s" }} />
                      </button>
                    </div>

                    <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
                      <div>
                        <p style={{ font: `500 0.65rem/1 ${fb}`, color: "#AEAEB2", textTransform: "uppercase", letterSpacing: "0.07em", marginBottom: 8 }}>Tipo</p>
                        <select
                          value={draft.promo_type}
                          onChange={e => updatePromoDraft(promo.id, "promo_type", e.target.value)}
                          style={{ width: "100%", padding: "10px 12px", background: "#F2F2F7", border: "1px solid transparent", borderRadius: 10, font: `600 0.78rem/1 ${fb}`, color: t1, outline: "none" }}
                        >
                          <option value="2x1">2x1</option>
                          <option value="referido">Referido</option>
                          <option value="descuento">Descuento</option>
                        </select>
                      </div>
                      <div>
                        <p style={{ font: `500 0.65rem/1 ${fb}`, color: "#AEAEB2", textTransform: "uppercase", letterSpacing: "0.07em", marginBottom: 8 }}>Formato</p>
                        <select
                          value={draft.discount_type}
                          onChange={e => updatePromoDraft(promo.id, "discount_type", e.target.value)}
                          style={{ width: "100%", padding: "10px 12px", background: "#F2F2F7", border: "1px solid transparent", borderRadius: 10, font: `600 0.78rem/1 ${fb}`, color: t1, outline: "none" }}
                        >
                          <option value="porcentaje">Porcentaje</option>
                          <option value="monto">Monto</option>
                        </select>
                      </div>
                    </div>

                    <div>
                      <p style={{ font: `500 0.65rem/1 ${fb}`, color: "#AEAEB2", textTransform: "uppercase", letterSpacing: "0.07em", marginBottom: 8 }}>Beneficio</p>
                      <div style={{ position: "relative" }}>
                        <span style={{ position: "absolute", left: 12, top: "50%", transform: "translateY(-50%)", color: t3, font: `700 0.88rem/1 ${fd}` }}>
                          {draft.discount_type === "monto" ? "$" : "%"}
                        </span>
                        <input
                          type="number"
                          min="0"
                          step="any"
                          value={draft.discount_value}
                          onChange={e => updatePromoDraft(promo.id, "discount_value", e.target.value)}
                          style={{ width: "100%", padding: "10px 12px 10px 26px", background: "#F2F2F7", border: "1px solid transparent", borderRadius: 10, font: `700 0.92rem/1 ${fd}`, color: t1, outline: "none", boxSizing: "border-box" }}
                        />
                      </div>
                    </div>

                    <div>
                      <p style={{ font: `500 0.65rem/1 ${fb}`, color: "#AEAEB2", textTransform: "uppercase", letterSpacing: "0.07em", marginBottom: 8 }}>Nota para el staff</p>
                      <textarea
                        value={draft.note}
                        onChange={e => updatePromoDraft(promo.id, "note", e.target.value)}
                        placeholder={index === 0 ? "Ej: Promo 2x1 en inscripción." : "Ej: 10% off por traer a un amigo."}
                        rows={2}
                        style={{ width: "100%", padding: "10px 12px", background: "#F2F2F7", border: "1px solid transparent", borderRadius: 10, font: `400 0.8rem/1.5 ${fb}`, color: t1, outline: "none", resize: "none", boxSizing: "border-box" }}
                      />
                    </div>

                    <button
                      type="button"
                      onClick={() => savePromo(promo.id)}
                      disabled={isSaving || (!isDirty && !isEmpty)}
                      style={{ width: "100%", padding: "10px 12px", borderRadius: 10, border: "none", font: `700 0.82rem/1 ${fd}`, cursor: isSaving ? "wait" : "pointer", background: isSaving ? "#C7C7CC" : "#1C1C1E", color: "white", opacity: (!isDirty && !isEmpty) ? 0.72 : 1 }}
                    >
                      {isSaving ? "Guardando..." : isEmpty ? "Guardar promo" : "Guardar cambios"}
                    </button>
                  </div>
                );
              })}
            </div>
          </div>

          <div style={{
            borderRadius: 18,
            padding: "24px 26px",
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            gap: 18,
            background: "linear-gradient(135deg, rgba(255,106,0,0.08) 0%, rgba(255,106,0,0.02) 100%)",
            border: "1px solid rgba(255,106,0,0.14)",
          }}>
            <div style={{ display: "flex", alignItems: "flex-start", gap: 12 }}>
              <div style={{ width: 42, height: 42, borderRadius: 14, background: "rgba(255,106,0,0.10)", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                <MessageSquareText size={18} color="#F97316" />
              </div>
              <div>
                <p style={{ font: `800 0.98rem/1 ${fd}`, color: t1, marginBottom: 6 }}>¿Querés revisar tu estructura de planes?</p>
                <p style={{ font: `400 0.8rem/1.55 ${fb}`, color: t2, maxWidth: 620 }}>
                  Definí primero tus planes base acá y, si necesitás ayuda para ordenarlos o comunicar mejor la propuesta, te acompañamos desde soporte con ChatGPT.
                </p>
              </div>
            </div>
          </div>

        </div>

        {/* ── Advanced settings modal ── */}
        {advanced && drafts[advanced] && (
          <AdvancedModal
            draft={drafts[advanced]}
            onSave={changes => applyAdvanced(advanced, changes)}
            onClose={() => setAdvanced(null)}
          />
        )}

        {/* ── Toast ── */}
        {toast && (
          <div style={{ position: "fixed", bottom: isMobile ? 90 : 28, right: 28, zIndex: 100, display: "flex", alignItems: "center", gap: 10, background: toast.type === "ok" ? "#FF6A00" : "#DC2626", color: "white", padding: "13px 20px", borderRadius: 14, boxShadow: "0 8px 32px rgba(0,0,0,0.18)", font: `600 0.875rem/1 ${fb}`, minWidth: 260, animation: "slideUp 0.22s ease" }}>
            <span style={{ fontSize: "1.1rem" }}>{toast.type === "ok" ? "✓" : "✕"}</span>
            {toast.msg}
          </div>
        )}

      </div>
    </>
  );
}
