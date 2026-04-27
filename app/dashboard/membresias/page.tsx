"use client";

import { useState, useEffect, useCallback } from "react";
import {
  CreditCard, TrendingUp, Calendar,
  Sparkles, X, Send,
} from "lucide-react";
import { supabase } from "@/lib/supabase";
import { getCachedProfile, getPageCache, setPageCache } from "@/lib/gym-cache";
import MembershipCards, { type EmilioPlan } from "@/components/MembershipCards";

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
  active: boolean;
  features: string;
  destacado: boolean;
  accent_color: string;
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
    active:        p.active ?? true,
    features:      (p.features ?? []).join("\n"),
    destacado:     p.destacado,
    accent_color:  p.accent_color ?? "",
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
  const [loading,     setLoading]     = useState(true);
  const [drafts,      setDrafts]      = useState<Record<string, Draft>>({});
  const [dirty,       setDirty]       = useState<Set<string>>(new Set());
  const [savingSet,   setSavingSet]   = useState<Set<string>>(new Set());
  const [advanced,    setAdvanced]    = useState<string | null>(null);
  const [chatOpen,    setChatOpen]    = useState(false);
  const [chatMsg,     setChatMsg]     = useState("");
  const [chatLoading, setChatLoading] = useState(false);
  const [emilioPlans, setEmilioPlans] = useState<EmilioPlan[] | null>(null);
  const [chatHistory, setChatHistory] = useState<{ role: "user" | "ai"; text: string }[]>([
    { role: "ai", text: "Bueno. Antes de armar nada, necesito entender qué tenés. ¿Qué tipo de gym/box es y a quién le estás vendiendo hoy?" },
  ]);
  const [toast, setToast] = useState<{ msg: string; type: "ok" | "err" } | null>(null);
  const [alumnosPorPlan, setAlumnosPorPlan] = useState<Record<string, number>>({});
  const [activosCount,   setActivosCount]   = useState(0);

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

    type PlanesCache = { planes: PlanDB[]; alumnosPorPlan: Record<string, number>; activosCount: number };
    if (!background) {
      const cached = getPageCache<PlanesCache>(`membresias_${profile.gymId}`);
      if (cached) {
        setPlanes(cached.planes);

        const d: Record<string, Draft> = {};
        cached.planes.forEach(p => { d[p.id] = planToDraft(p); });
        setDrafts(d); setDirty(new Set());
        setAlumnosPorPlan(cached.alumnosPorPlan);
        setActivosCount(cached.activosCount);
        setLoading(false);
      } else setLoading(true);
    }

    const [{ data }, { data: alumnosData }, { count: activos }] = await Promise.all([
      supabase.from("planes").select("id, nombre, precio, periodo, duracion_dias, active, features, destacado, accent_color").eq("gym_id", profile.gymId).order("created_at"),
      supabase.from("alumnos").select("plan_id").eq("gym_id", profile.gymId).not("plan_id", "is", null),
      supabase.from("alumnos").select("id", { count: "exact", head: true }).eq("gym_id", profile.gymId).eq("status", "activo"),
    ]);

    const list: PlanDB[] = data ? (data as PlanDB[]) : [];
    setPlanes(list);
    const d: Record<string, Draft> = {};
    list.forEach(p => { d[p.id] = planToDraft(p); });
    setDrafts(d); setDirty(new Set());
    const counts: Record<string, number> = {};
    (alumnosData ?? []).forEach((a: { plan_id: string }) => {
      if (a.plan_id) counts[a.plan_id] = (counts[a.plan_id] ?? 0) + 1;
    });
    setAlumnosPorPlan(counts);
    setActivosCount(activos ?? 0);
    setPageCache(`membresias_${profile.gymId}`, { planes: list, alumnosPorPlan: counts, activosCount: activos ?? 0 });
    setLoading(false);
  }, []);

  useEffect(() => { void fetchPlanes(); }, [fetchPlanes]);

  // ── Hero CTA — only hides the mirror overlay ───────────────────────────────

  // ── Inline edit helpers ────────────────────────────────────────────────────
  const updateDraft = (planId: string, field: keyof Draft, value: string | boolean) => {
    setDrafts(prev => ({ ...prev, [planId]: { ...prev[planId], [field]: value } }));
    setDirty(prev => new Set(prev).add(planId));
  };

  const applyAdvanced = (planId: string, changes: Pick<Draft, "periodo">) => {
    setDrafts(prev => ({ ...prev, [planId]: { ...prev[planId], ...changes } }));
    setDirty(prev => new Set(prev).add(planId));
  };

  const updatePeriodo = (planId: string, periodo: string) => {
    const dias = periodo === "año" ? 365 : periodo === "trimestral" ? 90 : 30;
    setDrafts(prev => ({ ...prev, [planId]: { ...prev[planId], periodo, duracion_dias: String(dias) } }));
    setDirty(prev => new Set(prev).add(planId));
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
        setPlanes(prev => [...prev, newPlan]);
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
          .select("id, nombre, precio, periodo, features, destacado, accent_color")
          .maybeSingle();
        if (error) { clearSaving(); showToast(`Error: ${error.message}`, "err"); return; }
        if (!updated) { clearSaving(); showToast("No se pudo guardar. Verificá permisos en Supabase (RLS).", "err"); return; }
        setPlanes(prev => prev.map(p => p.id === planId ? (updated as PlanDB) : p));
        setDirty(prev => { const s = new Set(prev); s.delete(planId); return s; });
      }

      clearSaving();
      showToast("Plan guardado correctamente.", "ok");
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
  const EMPTY = (i: number): PlanDB => ({ id: `empty-${i}`, nombre: "", precio: 0, periodo: "mes", duracion_dias: 30, active: true, features: [], destacado: false, accent_color: null });
  const displayPlanes: PlanDB[] = [0, 1, 2].map(i => planes[i] ?? EMPTY(i));
  const displayIngresos = planes.length > 0
    ? displayPlanes.reduce((s, p) => {
        const mensual = p.periodo === "año" ? p.precio / 12 : p.precio;
        return s + mensual * (alumnosPorPlan[p.id] ?? 0);
      }, 0)
    : 0;
  // Chat — real OpenAI call
  const sendChat = async (quickMsg?: string) => {
    const text = (quickMsg ?? chatMsg).trim();
    if (!text || chatLoading) return;
    const nextHistory = [...chatHistory, { role: "user" as const, text }];
    setChatHistory(nextHistory);
    setChatMsg("");
    setChatLoading(true);
    try {
      // Inject plan occupancy context as a hidden preamble
      const planContext = planes.length > 0
        ? planes.map(p => {
            const n = alumnosPorPlan[p.id] ?? 0;
            return `"${p.nombre}" $${p.precio}/${p.periodo} → ${n} alumno${n !== 1 ? "s" : ""}`;
          }).join(", ")
        : null;

      const totalAlumnosForContext = Object.values(alumnosPorPlan).reduce((s, n) => s + n, 0);
      const egresosContext = `[Gym context: ${activosCount} alumnos activos · ${totalAlumnosForContext} alumnos con plan asignado]`;

      const apiMessages = [
        { role: "user" as const, content: egresosContext },
        { role: "assistant" as const, content: "Entendido, tengo los números del gym. Voy a asegurarme de que los planes cubran los costos y generen margen real." },
        ...(planContext ? [
          { role: "user" as const, content: `[Planes actuales: ${planContext}]` },
          { role: "assistant" as const, content: "Perfecto, tengo el panorama completo." },
        ] : []),
        ...nextHistory.map(m => ({
          role: m.role === "user" ? "user" as const : "assistant" as const,
          content: m.text,
        })),
      ];
      const res = await fetch("/api/emilio", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          messages: apiMessages,
          gymData: {
            price: planes.length > 0 ? Math.max(...planes.map(p => p.precio)) : undefined,
            students: activosCount,
            plans: planes.length,
          }
        }),
      });
      const data = await res.json() as { text: string };
      const reply = data.text ?? "";
      // Detect {"plans":[...]} array — extract insight separately
      const jsonStart = reply.indexOf('{"plans":');
      if (jsonStart !== -1) {
        try {
          let depth = 0, end = jsonStart;
          for (let j = jsonStart; j < reply.length; j++) {
            if (reply[j] === "{") depth++;
            else if (reply[j] === "}") { depth--; if (depth === 0) { end = j + 1; break; } }
          }
          const parsed = JSON.parse(reply.slice(jsonStart, end)) as { plans: EmilioPlan[] };
          setEmilioPlans(parsed.plans);
          const insightText = reply.slice(0, jsonStart).trim();
          setChatHistory(h => [...h, { role: "ai", text: insightText || "Acá están los 3 planes." }]);
        } catch {
          setChatHistory(h => [...h, { role: "ai", text: reply }]);
        }
      } else {
        setChatHistory(h => [...h, { role: "ai", text: reply }]);
      }
    } catch {
      setChatHistory(h => [...h, { role: "ai", text: "Error de conexión. Intentá de nuevo." }]);
    } finally {
      setChatLoading(false);
    }
  };

  const applyEmilioPlans = (plans: EmilioPlan[]) => {
    const ACCENT: Record<string, string> = { entry: t2, growth: "#F97316", vip: "#4B6BFB" };
    const newDrafts: Record<string, Draft> = {};
    const newDirty = new Set(dirty);
    plans.forEach((plan, i) => {
      const slot = displayPlanes[i] ?? { id: `empty-${i}` };
      newDrafts[slot.id] = {
        nombre: plan.nombre,
        precio: String(plan.precio),
        periodo: "mes",
        features: [
          ...plan.bonus,
          ...(plan.garantia ? [`Garantía: ${plan.garantia}`] : []),
          ...(plan.cupos > 0 ? [`Cupos: ${plan.cupos}`] : []),
        ].join("\n"),
        duracion_dias: "30",
        active: true,
        destacado: plan.tier === "growth",
        accent_color: ACCENT[plan.tier] ?? "#F97316",
      };
      newDirty.add(slot.id);
    });
    setDrafts(prev => ({ ...prev, ...newDrafts }));
    setDirty(newDirty);
    setChatOpen(false);
    setEmilioPlans(null);
  };

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
        @keyframes pulseGlow { 0%,100% { box-shadow: 0 8px 20px -2px rgba(249,115,22,0.45), inset 0 1px 0 rgba(255,255,255,0.20), 0 0 0 0 rgba(249,115,22,0.30); } 50% { box-shadow: 0 8px 20px -2px rgba(249,115,22,0.45), inset 0 1px 0 rgba(255,255,255,0.20), 0 0 0 7px rgba(249,115,22,0); } }
        @keyframes chatSlideUp { from { opacity:0; transform:translateY(24px) scale(0.98); } to { opacity:1; transform:translateY(0) scale(1); } }
        @keyframes msgIn { from { opacity:0; transform:translateY(6px); } to { opacity:1; transform:translateY(0); } }
        @keyframes dotBounce { 0%,80%,100% { transform:translateY(0); } 40% { transform:translateY(-5px); } }
        .pulse-btn { animation: pulseGlow 2.2s ease infinite; }
        .chat-panel { animation: chatSlideUp 0.32s cubic-bezier(0.34,1.56,0.64,1) both; }
        .msg-in { animation: msgIn 0.22s ease both; }
        .dot1 { animation: dotBounce 1.2s ease infinite 0s; }
        .dot2 { animation: dotBounce 1.2s ease infinite 0.18s; }
        .dot3 { animation: dotBounce 1.2s ease infinite 0.36s; }
        .inline-field:hover { background: rgba(0,0,0,0.03); }
        .inline-field:focus { background: rgba(0,0,0,0.04); box-shadow: 0 0 0 2px rgba(249,115,22,0.22); }
        .chip:hover { background: rgba(249,115,22,0.10) !important; border-color: rgba(249,115,22,0.35) !important; color: #EA580C !important; }
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
                              {(["mes", "trimestral", "año"] as const).map(op => (
                                <button key={op} type="button" onClick={() => updatePeriodo(p.id, op)} style={{ padding: "4px 8px", borderRadius: 6, border: "none", font: `500 0.68rem/1 ${fb}`, cursor: "pointer", transition: "all 0.16s", background: draft.periodo === op ? "white" : "transparent", color: draft.periodo === op ? "#1C1C1E" : "#8E8E93", boxShadow: draft.periodo === op ? "0 1px 3px rgba(0,0,0,0.12)" : "none" }}>
                                  {op === "mes" ? "Mensual" : op === "trimestral" ? "Trimestral" : "Anual"}
                                </button>
                              ))}
                            </div>
                          </div>
                        </div>
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
                <strong style={{ color: t1, fontWeight: 600 }}>¿Tenés una sola cuota mensual?</strong> Completá solo la primera tarjeta con tu plan y dejá las demás desactivadas. Si ofrecés varios planes (ej. mensual + trimestral), usá una tarjeta por plan. El precio que ponés acá es lo que verán los alumnos al pagar.
              </p>
            </div>
          </div>

          {/* ── Emilio banner — mesh orange texture ── */}
          <div style={{
            borderRadius: 18, padding: "28px 32px", position: "relative", overflow: "hidden",
            display: "flex", alignItems: "center", justifyContent: "space-between", gap: 20,
            background: "#0D0500",
            boxShadow: "0 8px 32px rgba(249,115,22,0.16)",
          }}>
            {/* Mesh layers */}
            <div style={{ position: "absolute", inset: 0, background: "radial-gradient(ellipse 65% 90% at 0% 50%, rgba(249,115,22,0.85) 0%, transparent 55%)", pointerEvents: "none" }} />
            <div style={{ position: "absolute", inset: 0, background: "radial-gradient(ellipse 45% 55% at 100% 20%, rgba(251,146,60,0.45) 0%, transparent 55%)", pointerEvents: "none" }} />
            <div style={{ position: "absolute", inset: 0, background: "radial-gradient(ellipse 35% 45% at 55% 100%, rgba(234,88,12,0.50) 0%, transparent 50%)", pointerEvents: "none" }} />
            {/* Dark overlay for legibility */}
            <div style={{ position: "absolute", inset: 0, background: "rgba(0,0,0,0.50)", borderRadius: 18, pointerEvents: "none" }} />
            {/* Decorative circles */}
            <div style={{ position: "absolute", top: -40, right: 120, width: 180, height: 180, borderRadius: "50%", border: "1px solid rgba(255,255,255,0.07)", pointerEvents: "none" }} />
            <div style={{ position: "absolute", bottom: -50, right: 40, width: 140, height: 140, borderRadius: "50%", border: "1px solid rgba(255,255,255,0.05)", pointerEvents: "none" }} />

            <div style={{ position: "relative", zIndex: 1 }}>
              <div style={{ display: "inline-flex", alignItems: "center", gap: 5, background: "rgba(255,255,255,0.12)", border: "1px solid rgba(255,255,255,0.22)", borderRadius: 9999, padding: "4px 12px", marginBottom: 14 }}>
                <Sparkles size={12} color="white" />
                <span style={{ font: `700 0.68rem/1 ${fb}`, color: "white", textTransform: "uppercase", letterSpacing: "0.09em" }}>Función Pro · IA</span>
              </div>
              <h2 style={{ font: `800 1.35rem/1.25 ${fd}`, color: "white", marginBottom: 8, letterSpacing: "-0.01em" }}>Optimizar tus planes para<br />facturar más</h2>
              <p style={{ font: `400 0.875rem/1.5 ${fb}`, color: "rgba(255,255,255,0.80)", marginBottom: 6 }}>
                <strong style={{ color: "white" }}>Emilio</strong> analiza tu gym y te propone mejoras concretas en minutos.
              </p>
              <p style={{ font: `400 0.78rem/1.5 ${fb}`, color: "rgba(255,255,255,0.50)" }}>
                Cuanto más completo esté tu gym (planes, precios y alumnos), más preciso va a ser el análisis.
              </p>
            </div>
            <button
              onClick={() => setChatOpen(true)}
              style={{ position: "relative", zIndex: 1, flexShrink: 0, display: "flex", alignItems: "center", gap: 8, background: "white", color: "#F97316", border: "none", padding: "13px 24px", borderRadius: 12, font: `700 0.875rem/1 ${fd}`, cursor: "pointer", boxShadow: "0 4px 20px rgba(0,0,0,0.20)", transition: "transform 0.14s, box-shadow 0.14s", whiteSpace: "nowrap" as const }}
              onMouseEnter={e => { (e.currentTarget as HTMLButtonElement).style.transform = "translateY(-2px)"; (e.currentTarget as HTMLButtonElement).style.boxShadow = "0 8px 28px rgba(0,0,0,0.26)"; }}
              onMouseLeave={e => { (e.currentTarget as HTMLButtonElement).style.transform = "none"; (e.currentTarget as HTMLButtonElement).style.boxShadow = "0 4px 20px rgba(0,0,0,0.20)"; }}
            >
              <Sparkles size={15} /> Analizar mis planes
            </button>
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

        {/* ── Chat Emilio — immersive full-width ── */}
        {chatOpen && (
          <div
            style={{ position: "fixed", inset: 0, zIndex: 100, display: "flex", alignItems: "center", justifyContent: "center", backdropFilter: "blur(18px) saturate(160%)", WebkitBackdropFilter: "blur(18px) saturate(160%)", background: "rgba(10,10,15,0.62)", padding: "20px 24px" }}
            onClick={() => setChatOpen(false)}
          >
            <div
              className="chat-panel"
              onClick={e => e.stopPropagation()}
              style={{ width: "100%", maxWidth: 920, height: "82vh", display: "flex", flexDirection: "column", background: "#0D0D12", border: "1px solid rgba(255,255,255,0.08)", borderRadius: 24, overflow: "hidden", boxShadow: "0 40px 100px rgba(0,0,0,0.70)" }}
            >
              {/* Header */}
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "18px 24px", borderBottom: "1px solid rgba(255,255,255,0.07)", flexShrink: 0 }}>
                <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                  <div style={{ width: 40, height: 40, borderRadius: 12, background: "linear-gradient(135deg,#F97316,#EA580C)", display: "flex", alignItems: "center", justifyContent: "center", boxShadow: "0 4px 14px rgba(249,115,22,0.40)" }}>
                    <Sparkles size={18} color="white" />
                  </div>
                  <div>
                    <p style={{ font: `700 0.95rem/1 ${fd}`, color: "white" }}>Emilio</p>
                    <div style={{ display: "flex", alignItems: "center", gap: 5, marginTop: 3 }}>
                      <span style={{ width: 6, height: 6, borderRadius: "50%", background: "#FF6A00", display: "inline-block" }} />
                      <span style={{ font: `400 0.7rem/1 ${fb}`, color: "rgba(255,255,255,0.45)" }}>Consultor IA · Grand Slam Offers</span>
                    </div>
                  </div>
                </div>
                <button onClick={() => setChatOpen(false)} style={{ width: 34, height: 34, borderRadius: "50%", background: "rgba(255,255,255,0.07)", border: "1px solid rgba(255,255,255,0.10)", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", color: "rgba(255,255,255,0.55)" }}>
                  <X size={15} />
                </button>
              </div>

              {/* Messages */}
              <div style={{ flex: 1, overflowY: "auto", padding: "20px 28px", display: "flex", flexDirection: "column", gap: 12 }}>
                {chatHistory.map((m, i) => (
                  <div key={i} className="msg-in" style={{ display: "flex", justifyContent: m.role === "user" ? "flex-end" : "flex-start" }}>
                    {m.role === "ai" && (
                      <div style={{ width: 28, height: 28, borderRadius: 8, background: "linear-gradient(135deg,#F97316,#EA580C)", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0, marginRight: 10, marginTop: 2 }}>
                        <Sparkles size={13} color="white" />
                      </div>
                    )}
                    <div style={{ maxWidth: "72%", padding: "11px 15px", background: m.role === "user" ? "linear-gradient(135deg,#F97316,#EA580C)" : "rgba(255,255,255,0.06)", color: m.role === "user" ? "white" : "rgba(255,255,255,0.90)", borderRadius: m.role === "user" ? "16px 16px 4px 16px" : "16px 16px 16px 4px", font: `400 0.875rem/1.6 ${fb}`, border: m.role === "ai" ? "1px solid rgba(255,255,255,0.08)" : "none", whiteSpace: "pre-wrap" as const }}>
                      {m.text}
                    </div>
                  </div>
                ))}

                {/* Loading — dots + contextual message */}
                {chatLoading && (
                  <div className="msg-in" style={{ display: "flex", alignItems: "center", gap: 10 }}>
                    <div style={{ width: 28, height: 28, borderRadius: 8, background: "linear-gradient(135deg,#F97316,#EA580C)", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                      <Sparkles size={13} color="white" />
                    </div>
                    <div style={{ display: "flex", flexDirection: "column", gap: 6, padding: "13px 16px", background: "rgba(255,255,255,0.06)", borderRadius: "16px 16px 16px 4px", border: "1px solid rgba(255,255,255,0.08)" }}>
                      <div style={{ display: "flex", gap: 5 }}>
                        {["dot1","dot2","dot3"].map(d => <span key={d} className={d} style={{ width: 6, height: 6, borderRadius: "50%", background: "#F97316", display: "inline-block" }} />)}
                      </div>
                      {chatHistory.some(m => m.role === "user" && /go|dale|listo|aplicar|sí|si/i.test(m.text)) && (
                        <span style={{ font: `400 0.75rem/1 ${fb}`, color: "rgba(255,255,255,0.40)" }}>
                          Analizando tu competencia y estructurando tus 3 niveles de oferta...
                        </span>
                      )}
                    </div>
                  </div>
                )}

                {/* 3-plan result — MembershipCards component */}
                {emilioPlans && (
                  <div className="msg-in">
                    <MembershipCards plans={emilioPlans} onApply={applyEmilioPlans} />
                  </div>
                )}
              </div>

              {/* Quick chips + input */}
              <div style={{ padding: "12px 24px 20px", borderTop: "1px solid rgba(255,255,255,0.06)", flexShrink: 0 }}>
                {chatHistory.length <= 1 && (
                  <div style={{ display: "flex", gap: 8, marginBottom: 10 }}>
                    {["Descenso de Peso", "Hipertrofia", "Membresía Premium"].map(chip => (
                      <button
                        key={chip}
                        className="chip"
                        onClick={() => sendChat(chip)}
                        disabled={chatLoading}
                        style={{ padding: "7px 14px", background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.12)", borderRadius: 9999, font: `500 0.78rem/1 ${fb}`, color: "rgba(255,255,255,0.65)", cursor: "pointer", transition: "all 0.15s", whiteSpace: "nowrap" as const }}
                      >
                        {chip}
                      </button>
                    ))}
                  </div>
                )}
                <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
                  <input
                    value={chatMsg}
                    onChange={e => setChatMsg(e.target.value)}
                    onKeyDown={e => e.key === "Enter" && !e.shiftKey && sendChat()}
                    placeholder="Describí tu negocio o hacé una pregunta..."
                    disabled={chatLoading}
                    style={{ flex: 1, padding: "13px 18px", background: "rgba(255,255,255,0.06)", border: "1px solid rgba(255,255,255,0.10)", borderRadius: 14, font: `400 0.875rem/1 ${fb}`, color: "white", outline: "none" }}
                  />
                  <button
                    onClick={() => sendChat()}
                    disabled={chatLoading || !chatMsg.trim()}
                    style={{ width: 44, height: 44, borderRadius: 14, background: chatMsg.trim() ? "linear-gradient(135deg,#F97316,#EA580C)" : "rgba(255,255,255,0.06)", border: "none", cursor: chatMsg.trim() ? "pointer" : "default", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0, transition: "all 0.15s", boxShadow: chatMsg.trim() ? "0 4px 14px rgba(249,115,22,0.35)" : "none" }}
                  >
                    <Send size={16} color={chatMsg.trim() ? "white" : "rgba(255,255,255,0.25)"} />
                  </button>
                </div>
              </div>
            </div>
          </div>
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
