"use client";

import { useState, useEffect, useCallback } from "react";
import {
  CreditCard, TrendingUp, Calendar, Settings,
  Sparkles, X, Send, Star, Zap,
} from "lucide-react";
import { supabase } from "@/lib/supabase";
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
  features: string[];
  destacado: boolean;
  accent_color: string | null;
}

type Draft = {
  nombre: string;
  precio: string;
  periodo: string;
  features: string;
  destacado: boolean;
  accent_color: string;
};

// ── Seed templates ────────────────────────────────────────────────────────────
const SEED: Omit<PlanDB, "id">[] = [
  {
    nombre: "Básico", precio: 35000, periodo: "mes",
    features: ["Acceso a sala de pesas", "Horario libre", "Sin clases grupales"],
    destacado: false, accent_color: null,
  },
  {
    nombre: "Transformación", precio: 58000, periodo: "mes",
    features: ["Todo en Básico", "Clases grupales", "App de seguimiento", "Nutricionista"],
    destacado: true, accent_color: "#F97316",
  },
  {
    nombre: "VIP", precio: 95000, periodo: "mes",
    features: ["Todo en Transformación", "Sesiones 1:1", "Plan de nutrición", "Prioridad reservas"],
    destacado: false, accent_color: "#4B6BFB",
  },
];

const DEF_COLORS = [t2, "#F97316", "#4B6BFB"];
const DEF_BGS    = ["#F0F2F8", "rgba(249,115,22,0.08)", "rgba(75,107,251,0.08)"];
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
    nombre:       p.nombre,
    precio:       String(p.precio),
    periodo:      p.periodo,
    features:     (p.features ?? []).join("\n"),
    destacado:    p.destacado,
    accent_color: p.accent_color ?? "",
  };
}

// ── Advanced settings modal ───────────────────────────────────────────────────
function AdvancedModal({
  draft, onSave, onClose,
}: {
  draft: Draft;
  onSave: (changes: Pick<Draft, "periodo" | "destacado" | "accent_color">) => void;
  onClose: () => void;
}) {
  const [periodo,     setPeriodo]     = useState(draft.periodo);
  const [destacado,   setDestacado]   = useState(draft.destacado);
  const [accentColor, setAccentColor] = useState(draft.accent_color || "#F97316");

  return (
    <div onClick={onClose} style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.40)", backdropFilter: "blur(6px)", WebkitBackdropFilter: "blur(6px)", zIndex: 50, display: "flex", alignItems: "center", justifyContent: "center", padding: 20 }}>
      <div onClick={e => e.stopPropagation()} style={{ background: "#FFFFFF", borderRadius: 20, boxShadow: "0 24px 60px rgba(0,0,0,0.18), 0 0 0 1px rgba(0,0,0,0.06)", width: "100%", maxWidth: 360, overflow: "hidden" }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "22px 24px 18px" }}>
          <div>
            <h2 style={{ font: `800 1rem/1 ${fd}`, color: t1 }}>Ajustes avanzados</h2>
            <p style={{ font: `400 0.72rem/1 ${fb}`, color: t3, marginTop: 4 }}>Período, badge y color del plan.</p>
          </div>
          <button onClick={onClose} style={{ width: 32, height: 32, borderRadius: "50%", background: "#F0F2F8", border: "none", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", color: t2, flexShrink: 0 }}>
            <X size={16} />
          </button>
        </div>
        <div style={{ height: 1, background: "rgba(0,0,0,0.06)", margin: "0 24px" }} />
        <div style={{ padding: "20px 24px 24px", display: "flex", flexDirection: "column", gap: 16 }}>

          {/* Período */}
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

          {/* Destacado toggle */}
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "12px 14px", background: "#F9FAFB", borderRadius: 10, border: "1px solid rgba(0,0,0,0.06)" }}>
            <div>
              <p style={{ font: `600 0.83rem/1 ${fb}`, color: t1, marginBottom: 3 }}>Más popular</p>
              <p style={{ font: `400 0.72rem/1 ${fb}`, color: t3 }}>Muestra el badge naranja en la card</p>
            </div>
            <button type="button" onClick={() => setDestacado(d => !d)} style={{ width: 44, height: 24, borderRadius: 9999, border: "none", background: destacado ? "#F97316" : "rgba(0,0,0,0.12)", position: "relative", cursor: "pointer", transition: "background 0.2s", flexShrink: 0 }}>
              <span style={{ position: "absolute", top: 3, left: destacado ? 23 : 3, width: 18, height: 18, borderRadius: "50%", background: "white", boxShadow: "0 1px 4px rgba(0,0,0,0.20)", transition: "left 0.2s", display: "block" }} />
            </button>
          </div>

          {/* Color picker */}
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
            <div>
              <label style={{ display: "block", font: `500 0.78rem/1 ${fb}`, color: t1, marginBottom: 3 }}>Color del plan</label>
              <p style={{ font: `400 0.72rem/1 ${fb}`, color: t3 }}>Afecta ícono, badge y barra de retención</p>
            </div>
            <input type="color" value={accentColor} onChange={e => setAccentColor(e.target.value)} style={{ width: 40, height: 34, border: "1px solid rgba(0,0,0,0.09)", borderRadius: 8, cursor: "pointer", padding: 2, background: "none" }} />
          </div>

          <button onClick={() => { onSave({ periodo, destacado, accent_color: accentColor }); onClose(); }} style={{ width: "100%", padding: "12px", background: "#F97316", color: "white", border: "none", borderRadius: 12, font: `700 0.95rem/1 ${fd}`, cursor: "pointer", boxShadow: "0 4px 16px rgba(249,115,22,0.28)", marginTop: 2 }}>
            Aplicar cambios
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Skeleton card (blueprint mode) ───────────────────────────────────────────
function SkeletonCard() {
  const bar = (w: string, h = 8, extra: React.CSSProperties = {}) => (
    <div style={{ width: w, height: h, background: "#E2E8F0", borderRadius: 4, ...extra }} />
  );
  return (
    <div style={{ border: "1px solid #E2E8F0", borderRadius: 14, background: "rgba(248,250,252,0.55)", padding: "22px", display: "flex", flexDirection: "column" }}>
      <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", marginBottom: 16 }}>
        <div style={{ width: 38, height: 38, borderRadius: 10, background: "#E2E8F0" }} />
        <div style={{ width: 24, height: 24, borderRadius: "50%", background: "#E2E8F0" }} />
      </div>
      <div style={{ marginBottom: 12, display: "flex", flexDirection: "column", gap: 6 }}>
        {bar("38%", 6)}
        {bar("62%", 13)}
      </div>
      <div style={{ marginBottom: 14, display: "flex", flexDirection: "column", gap: 6 }}>
        {bar("28%", 6)}
        {bar("48%", 20)}
      </div>
      <div style={{ display: "flex", alignItems: "center", gap: 8, padding: "10px 0 12px", borderTop: "1px solid #E2E8F0", borderBottom: "1px solid #E2E8F0", marginBottom: 14 }}>
        {bar("44px", 5)}
        <div style={{ flex: 1, height: 5, background: "#E2E8F0", borderRadius: 9999 }} />
        {bar("28px", 5)}
      </div>
      <div style={{ marginBottom: 16, display: "flex", flexDirection: "column", gap: 7 }}>
        {bar("30%", 5)}
        {[82, 68, 90].map((w, i) => bar(`${w}%`, 7, { marginTop: i === 0 ? 4 : 0 }))}
      </div>
      <div style={{ display: "flex", gap: 6, marginTop: "auto" }}>
        <div style={{ width: 88, height: 32, borderRadius: 9, background: "#E2E8F0" }} />
        <div style={{ flex: 1, height: 32, borderRadius: 9, background: "#E2E8F0" }} />
      </div>
    </div>
  );
}

// ── Hero center card (blueprint mode) ────────────────────────────────────────
function HeroCenterCard({ onCTA }: { onCTA: () => void }) {
  const fd2 = "var(--font-inter, 'Inter', sans-serif)";
  const fb2 = "var(--font-inter, 'Inter', sans-serif)";
  return (
    <div style={{ border: "1px solid #E2E8F0", borderRadius: 14, background: "white", padding: "28px 24px", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", textAlign: "center", boxShadow: "0 4px 20px rgba(0,0,0,0.06)" }}>
      <div style={{ display: "inline-flex", alignItems: "center", gap: 5, background: "rgba(249,115,22,0.09)", border: "1px solid rgba(249,115,22,0.18)", borderRadius: 9999, padding: "3px 12px", marginBottom: 14 }}>
        <Zap size={10} color="#F97316" />
        <span style={{ font: `700 0.62rem/1 ${fb2}`, color: "#F97316", textTransform: "uppercase" as const, letterSpacing: "0.09em" }}>Oferta · Hormozi</span>
      </div>
      <h2 style={{ font: `800 1.15rem/1.3 ${fd2}`, color: "#1A1D23", letterSpacing: "-0.02em", marginBottom: 10 }}>
        ¿Cuál va a ser tu<br />oferta irresistible?
      </h2>
      <p style={{ font: `400 0.775rem/1.6 ${fb2}`, color: "#6B7280", marginBottom: 22 }}>
        Diseñá planes que tus<br />alumnos no puedan rechazar.
      </p>
      <button
        onClick={onCTA}
        className="pulse-btn"
        style={{
          background: "linear-gradient(180deg, #FB923C 0%, #EA580C 100%)",
          color: "white",
          border: "1px solid rgba(255,220,140,0.40)",
          padding: "12px 26px",
          borderRadius: 12,
          font: `700 0.875rem/1 ${fd2}`,
          cursor: "pointer",
          boxShadow: "0 8px 20px -2px rgba(249,115,22,0.45), inset 0 1px 0 rgba(255,255,255,0.20)",
          transition: "transform 0.2s, box-shadow 0.2s",
        }}
        onMouseEnter={e => { (e.currentTarget as HTMLButtonElement).style.transform = "translateY(-2px)"; (e.currentTarget as HTMLButtonElement).style.boxShadow = "0 14px 30px -4px rgba(249,115,22,0.60), inset 0 1px 0 rgba(255,255,255,0.20)"; }}
        onMouseLeave={e => { (e.currentTarget as HTMLButtonElement).style.transform = "none"; (e.currentTarget as HTMLButtonElement).style.boxShadow = "0 8px 20px -2px rgba(249,115,22,0.45), inset 0 1px 0 rgba(255,255,255,0.20)"; }}
      >
        Diseñar mi oferta
      </button>
    </div>
  );
}

// ── Page ──────────────────────────────────────────────────────────────────────
export default function MembresiasPage() {
  const [planes,      setPlanes]      = useState<PlanDB[]>([]);
  const [loading,     setLoading]     = useState(true);
  const [showHero,    setShowHero]    = useState(true);   // hides when planes exist or CTA clicked
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

  const showToast = (msg: string, type: "ok" | "err") => {
    setToast({ msg, type });
    setTimeout(() => setToast(null), 3200);
  };

  // ── Fetch planes ──────────────────────────────────────────────────────────
  const fetchPlanes = useCallback(async () => {
    setLoading(true);
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) { setLoading(false); return; }

    const { data } = await supabase
      .from("planes")
      .select("id, nombre, precio, periodo, features, destacado, accent_color")
      .eq("gym_id", user.id)
      .order("created_at");

    const list: PlanDB[] = data ? (data as PlanDB[]) : [];
    setPlanes(list);
    if (list.length > 0) setShowHero(false);
    const d: Record<string, Draft> = {};
    list.forEach(p => { d[p.id] = planToDraft(p); });
    setDrafts(d);
    setDirty(new Set());

    // Count alumnos per plan + total activos
    const [{ data: alumnosData }, { count: activos }] = await Promise.all([
      supabase.from("alumnos").select("plan_id").eq("gym_id", user.id).not("plan_id", "is", null),
      supabase.from("alumnos").select("id", { count: "exact", head: true }).eq("gym_id", user.id).eq("status", "activo"),
    ]);
    const counts: Record<string, number> = {};
    (alumnosData ?? []).forEach((a: { plan_id: string }) => {
      if (a.plan_id) counts[a.plan_id] = (counts[a.plan_id] ?? 0) + 1;
    });
    setAlumnosPorPlan(counts);
    setActivosCount(activos ?? 0);

    setLoading(false);
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => { fetchPlanes(); }, [fetchPlanes]);

  // ── Hero CTA — only hides the mirror overlay ───────────────────────────────
  const handleHeroCTA = () => { setShowHero(false); };

  // ── Inline edit helpers ────────────────────────────────────────────────────
  const updateDraft = (planId: string, field: keyof Draft, value: string | boolean) => {
    setDrafts(prev => ({ ...prev, [planId]: { ...prev[planId], [field]: value } }));
    setDirty(prev => new Set(prev).add(planId));
  };

  const applyAdvanced = (planId: string, changes: Pick<Draft, "periodo" | "destacado" | "accent_color">) => {
    setDrafts(prev => ({ ...prev, [planId]: { ...prev[planId], ...changes } }));
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
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) { clearSaving(); showToast("Sesión expirada. Recargá la página.", "err"); return; }

      const featuresArr = (draft.features || "").split("\n").map(f => f.trim()).filter(Boolean);
      const payload = {
        gym_id:       user.id,
        nombre:       draft.nombre.trim(),
        precio:       parseFloat(draft.precio) || 0,
        periodo:      draft.periodo,
        features:     featuresArr,
        destacado:    draft.destacado,
        accent_color: (draft.accent_color || "").trim() || null,
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
        setDrafts(prev => { const { [planId]: _removed, ...rest } = prev; return { ...rest, [newPlan.id]: planToDraft(newPlan) }; });
        setDirty(prev => { const s = new Set(prev); s.delete(planId); return s; });
      } else {
        const { data: updated, error } = await supabase
          .from("planes")
          .upsert([{ id: planId, ...payload }], { onConflict: "id" })
          .eq("gym_id", user.id)
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

  // ── Derived ───────────────────────────────────────────────────────────────
  const ingresosMes = planes.reduce((s, p) => {
    const mensual = p.periodo === "año" ? p.precio / 12 : p.precio;
    return s + mensual * (alumnosPorPlan[p.id] ?? 0);
  }, 0);
  const maxMensual  = planes.length > 1 ? Math.max(...planes.map(p => p.periodo === "año" ? p.precio / 12 : p.precio)) : -1;

  // Always exactly 3 slots: real planes first, empty placeholders for the rest
  const EMPTY = (i: number): PlanDB => ({ id: `empty-${i}`, nombre: "", precio: 0, periodo: "mes", features: [], destacado: false, accent_color: null });
  const displayPlanes: PlanDB[] = [0, 1, 2].map(i => planes[i] ?? EMPTY(i));
  const displayIngresos = planes.length > 0
    ? displayPlanes.reduce((s, p) => {
        const mensual = p.periodo === "año" ? p.precio / 12 : p.precio;
        return s + mensual * (alumnosPorPlan[p.id] ?? 0);
      }, 0)
    : 0;
  const displayMax = displayPlanes.length > 1 ? Math.max(...displayPlanes.map(p => p.periodo === "año" ? p.precio / 12 : p.precio)) : -1;
  const totalAlumnos = Object.values(alumnosPorPlan).reduce((s, n) => s + n, 0);

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
        destacado: plan.tier === "growth",
        accent_color: ACCENT[plan.tier] ?? "#F97316",
      };
      newDirty.add(slot.id);
    });
    setDrafts(prev => ({ ...prev, ...newDrafts }));
    setDirty(newDirty);
    setChatOpen(false);
    setEmilioPlans(null);
    setShowHero(false);
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
          <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 14 }}>
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
              <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 32, opacity: showHero ? 0 : 1, transition: "opacity 0.55s ease", pointerEvents: showHero ? "none" : "auto" }}>
                {displayPlanes.map((p, i) => {
                  const draft      = drafts[p.id] ?? planToDraft(p);
                  const isDirty    = dirty.has(p.id);
                  const isSaving   = savingSet.has(p.id);
                  const { icon, accentColor } = planStyleFn(draft.accent_color || p.accent_color, i);
                  const mensualDraft = draft.periodo === "año" ? (parseFloat(draft.precio) || 0) / 12 : (parseFloat(draft.precio) || 0);
                  const esEstrella = displayPlanes.length > 1 && (p.periodo === "año" ? p.precio / 12 : p.precio) === displayMax;

                  return (
                    <div key={p.id} style={{
                      ...card, padding: "22px",
                      position: "relative",
                      transition: "box-shadow 0.2s, transform 0.2s",
                    }}>
                      {/* "Más popular" badge */}
                      {draft.destacado && (
                        <div style={{ position: "absolute", top: -11, left: "50%", transform: "translateX(-50%)", background: "#F97316", color: "white", font: `700 0.65rem/1 ${fb}`, textTransform: "uppercase", letterSpacing: "0.07em", padding: "4px 12px", borderRadius: 9999, whiteSpace: "nowrap" as const }}>
                          Más popular
                        </div>
                      )}

                      {/* Top row: icon + estrella + gear */}
                      <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", marginBottom: 16 }}>
                        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                          <div style={{ width: 38, height: 38, borderRadius: 10, background: "#F4F5F9", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>{icon}</div>
                          {esEstrella && (
                            <div style={{ display: "flex", alignItems: "center", gap: 4, background: "linear-gradient(135deg,#FBBF24,#F59E0B)", padding: "3px 8px", borderRadius: 9999 }}>
                              <Star size={10} color="white" fill="white" />
                              <span style={{ font: `700 0.62rem/1 ${fb}`, color: "white", textTransform: "uppercase", letterSpacing: "0.06em" }}>Estrella</span>
                            </div>
                          )}
                        </div>
                        <button
                          title="Ajustes avanzados"
                          onClick={() => setAdvanced(p.id)}
                          style={{ background: "none", border: "none", cursor: "pointer", color: t3, width: 28, height: 28, borderRadius: "50%", display: "flex", alignItems: "center", justifyContent: "center", transition: "background 0.14s", flexShrink: 0 }}
                          onMouseEnter={e => { (e.currentTarget as HTMLButtonElement).style.background = "#F0F2F8"; (e.currentTarget as HTMLButtonElement).style.color = t1; }}
                          onMouseLeave={e => { (e.currentTarget as HTMLButtonElement).style.background = "none"; (e.currentTarget as HTMLButtonElement).style.color = t3; }}
                        >
                          <Settings size={15} />
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

                      {/* Precio */}
                      <div style={{ marginBottom: 20, paddingBottom: 16, borderBottom: `2px solid ${accentColor}18` }}>
                        <p style={{ font: `500 0.65rem/1 ${fb}`, color: t3, textTransform: "uppercase" as const, letterSpacing: "0.07em", marginBottom: 6 }}>Precio</p>
                        <div style={{ display: "flex", alignItems: "baseline", gap: 2 }}>
                          <span style={{ font: `800 2.2rem/1 ${fd}`, color: t2 }}>$</span>
                          <input
                            className="inline-field"
                            type="number"
                            value={draft.precio}
                            onChange={e => updateDraft(p.id, "precio", e.target.value)}
                            style={{ ...inlineInput, font: `800 2.2rem/1 ${fd}`, color: t2, width: 130 }}
                          />
                          <span style={{ font: `500 0.85rem/1 ${fb}`, color: t3, marginLeft: 2 }}>/{draft.periodo}</span>
                        </div>
                        {draft.periodo === "año" && (
                          <span style={{ font: `500 0.72rem/1 ${fb}`, color: "#FF6A00", background: "rgba(255,106,0,0.09)", padding: "3px 8px", borderRadius: 9999, display: "inline-block", marginTop: 6 }}>
                            ${Math.round(mensualDraft).toLocaleString("es-AR")}/mes
                          </span>
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
                            background: "#F9FAFB",
                            border: "1px solid rgba(0,0,0,0.06)",
                            borderRadius: 10,
                            font: `400 0.82rem/1.6 ${fb}`,
                            color: t1, outline: "none", resize: "none",
                            boxSizing: "border-box",
                            transition: "border-color 0.14s",
                          } as React.CSSProperties}
                          onFocus={e => (e.currentTarget.style.borderColor = accentColor + "55")}
                          onBlur={e => (e.currentTarget.style.borderColor = "rgba(0,0,0,0.06)")}
                        />
                      </div>

                      {/* Guardar */}
                      <div>
                        {isDirty ? (
                          <button
                            onClick={() => saveCard(p.id)}
                            disabled={isSaving}
                            style={{ width: "100%", padding: "10px", borderRadius: 10, border: "none", font: `700 0.82rem/1 ${fd}`, cursor: isSaving ? "wait" : "pointer", background: isSaving ? "#9CA3AF" : "#FF6A00", color: "white", transition: "all 0.14s", boxShadow: isSaving ? "none" : "0 3px 10px rgba(255,106,0,0.28)" }}
                          >
                            {isSaving ? "Guardando..." : "Guardar cambios"}
                          </button>
                        ) : (
                          <div style={{ display: "flex", alignItems: "center", justifyContent: "center", padding: "10px", borderRadius: 10, background: "#F9FAFB", font: `500 0.75rem/1 ${fb}`, color: t3, gap: 6 }}>
                            <span style={{ width: 7, height: 7, borderRadius: "50%", background: "#FF6A00", display: "inline-block" }} />
                            Guardado
                          </div>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
              {/* Blueprint skeleton overlay — only when hero is active */}
              {showHero && (
                <div style={{ position: "absolute", inset: 0, display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 32 }}>
                  <SkeletonCard />
                  <HeroCenterCard onCTA={handleHeroCTA} />
                  <SkeletonCard />
                </div>
              )}
              </div>
            )}

            {!showHero && (
              <p style={{ font: `400 0.75rem/1 ${fb}`, color: t3, marginTop: 14, textAlign: "center" as const }}>
                Clic en nombre o precio para editar directo
              </p>
            )}
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
            style={{ position: "fixed", inset: 0, zIndex: 50, display: "flex", alignItems: "center", justifyContent: "center", backdropFilter: "blur(18px) saturate(160%)", WebkitBackdropFilter: "blur(18px) saturate(160%)", background: "rgba(10,10,15,0.62)", padding: "20px 24px" }}
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
          <div style={{ position: "fixed", bottom: 28, right: 28, zIndex: 100, display: "flex", alignItems: "center", gap: 10, background: toast.type === "ok" ? "#FF6A00" : "#DC2626", color: "white", padding: "13px 20px", borderRadius: 14, boxShadow: "0 8px 32px rgba(0,0,0,0.18)", font: `600 0.875rem/1 ${fb}`, minWidth: 260, animation: "slideUp 0.22s ease" }}>
            <span style={{ fontSize: "1.1rem" }}>{toast.type === "ok" ? "✓" : "✕"}</span>
            {toast.msg}
          </div>
        )}

      </div>
    </>
  );
}
