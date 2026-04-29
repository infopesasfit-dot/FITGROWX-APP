"use client";

import { useState } from "react";
import {
  TrendingUp, Target, Users, DollarSign,
  Copy, Check, MessageCircle, Rocket,
  Zap, Brain, Sparkles,
  RefreshCw, ChevronRight, AlertTriangle, ArrowRight,
} from "lucide-react";

const accent  = "#FF6A00";
const accent2 = "#FF8C38";
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

const hoverOn = (e: React.MouseEvent<HTMLDivElement>) => {
  (e.currentTarget as HTMLDivElement).style.boxShadow = "0 20px 25px -5px rgba(0,0,0,0.08), 0 8px 10px -6px rgba(0,0,0,0.04)";
  (e.currentTarget as HTMLDivElement).style.transform = "translateY(-2px)";
};
const hoverOff = (e: React.MouseEvent<HTMLDivElement>) => {
  (e.currentTarget as HTMLDivElement).style.boxShadow = "0 20px 25px -5px rgba(0,0,0,0.05), 0 10px 10px -5px rgba(0,0,0,0.02)";
  (e.currentTarget as HTMLDivElement).style.transform = "none";
};

/* ── Chart data ── */
const DAYS = ["Lun", "Mar", "Mié", "Jue", "Vie", "Sáb", "Dom"];
const INVERSION  = [0, 0, 0, 0, 0, 0, 0];
const LEADS      = [0, 0, 0, 0, 0, 0, 0];

function buildLine(data: number[], maxVal: number, w: number, h: number) {
  const norm = maxVal || 1;
  const pts = data.map((v, i) => ({
    x: (i / (data.length - 1)) * w,
    y: h - (v / norm) * (h - 16),
  }));
  let d = `M${pts[0].x.toFixed(1)},${pts[0].y.toFixed(1)}`;
  for (let i = 1; i < pts.length; i++) {
    const p = pts[i - 1], c = pts[i];
    const cpx = ((p.x + c.x) / 2).toFixed(1);
    d += ` C${cpx},${p.y.toFixed(1)} ${cpx},${c.y.toFixed(1)} ${c.x.toFixed(1)},${c.y.toFixed(1)}`;
  }
  return { line: d, area: d + ` L${w},${h} L0,${h} Z`, pts };
}

const PROSPECTOS: { id: number; nombre: string; phone: string; hora: string; fuente: string }[] = [];

function initials(name: string) {
  return name.split(" ").slice(0, 2).map(w => w[0]).join("").toUpperCase();
}

export default function PublicidadPage() {
  const [copyLoading, setCopyLoading] = useState(false);
  const [copies, setCopies] = useState<{ estilo: string; texto: string }[]>([]);
  const [copiedIdx, setCopiedIdx] = useState<number | null>(null);
  const [activeTab, setActiveTab] = useState<"resumen" | "google" | "meta">("resumen");
  const [googleConnected, setGoogleConnected] = useState(false);
  const [metaConnected, setMetaConnected] = useState(false);
  const [gCampaigns, setGCampaigns] = useState([
    { id: 1, name: "Membresías - CABA", active: true, budget: 500, impressions: "14.2k", clicks: 423, conversions: 18, cpc: 32 },
    { id: 2, name: "Clases Trial - Zona Norte", active: true, budget: 300, impressions: "8.6k", clicks: 241, conversions: 9, cpc: 28 },
  ]);
  const [mCampaigns, setMCampaigns] = useState([
    { id: 1, name: "Verano Fitness 2026", active: true, budget: 800, reach: "22.4k", clicks: 612, leads: 28, cpl: 246 },
    { id: 2, name: "Lead Form - Plan Mensual", active: false, budget: 400, reach: "11.1k", clicks: 289, leads: 11, cpl: 318 },
  ]);

  /* chart */
  const maxInv   = Math.max(...INVERSION);
  const maxLeads = Math.max(...LEADS);
  const invChart   = buildLine(INVERSION, maxInv,   500, 120);
  const leadsChart = buildLine(LEADS,     maxLeads,  500, 120);

  /* kpis */
  const totalInv   = INVERSION.reduce((s, v) => s + v, 0);
  const totalLeads = LEADS.reduce((s, v) => s + v, 0);
  const cplVal     = totalLeads > 0 ? Math.round(totalInv / totalLeads) : 0;
  const cpl        = totalLeads > 0 ? String(cplVal) : "—";
  const roas       = "3.8x";
  const roasNum    = 3.8;

  /* industry benchmark */
  const INDUSTRY_CPL = 380;
  const cplDiff = INDUSTRY_CPL - cplVal;
  const cplBetter = cplDiff > 0;

  /* emilio dynamic insights */
  const insights: { type: "good" | "warn" | "action"; text: string }[] = [];
  if (cplBetter) {
    insights.push({ type: "good", text: `Tu CPL está $${cplDiff} por debajo del promedio de la industria. La campaña está funcionando — no toques el creativo, subí el presupuesto.` });
  } else {
    insights.push({ type: "warn", text: `Tu CPL está $${Math.abs(cplDiff)} por encima del mercado. Probá cambiar el creativo: nueva imagen, nuevo hook en el primer segundo del video.` });
  }
  if (roasNum >= 3) {
    insights.push({ type: "good", text: `Con un ROAS de ${roas} cada peso que invertís te devuelve casi 4. Es momento de escalar, no de frenar.` });
  } else {
    insights.push({ type: "warn", text: `Tu ROAS de ${roas} está por debajo del breakeven. Revisá la oferta de la landing — el problema no es el anuncio, es lo que pasa después del clic.` });
  }
  insights.push({ type: "action", text: `Tus mejores leads entran sábado y domingo. Concentrá el 60% del presupuesto en el fin de semana y pausá martes y miércoles.` });

  const generateCopy = async () => {
    setCopyLoading(true);
    setCopies([]);
    try {
      const res = await fetch("/api/emilio-ads", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ planes: "mensual, trimestral, anual", cpl: cplVal, roas }),
      });
      const data = await res.json();
      setCopies(data.copies ?? []);
    } catch {
      setCopies([]);
    } finally {
      setCopyLoading(false);
    }
  };

  const handleCopyText = (text: string, idx: number) => {
    navigator.clipboard.writeText(text);
    setCopiedIdx(idx);
    setTimeout(() => setCopiedIdx(null), 2000);
  };

  const metrics = [
    { label: "Inversión Semanal", value: `$${(totalInv / 1000).toFixed(1)}k`, sub: "Semana actual", icon: DollarSign },
    { label: "Leads Generados",   value: String(totalLeads),                   sub: "Esta semana",   icon: Users      },
    { label: "Costo por Lead",    value: cpl === "—" ? "—" : `$${cpl}`,        sub: "Promedio",      icon: Target     },
    { label: "ROAS",              value: totalLeads > 0 ? roas : "—",          sub: "Retorno s/inv", icon: TrendingUp },
  ];

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 24, position: "relative", paddingBottom: 80 }}>

      {/* ── HEADER ── */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: 10 }}>
        <div>
          <p style={{ font: `500 0.68rem/1 ${fb}`, color: t3, textTransform: "uppercase", letterSpacing: "0.1em", marginBottom: 4 }}>Marketing</p>
          <h1 style={{ font: `800 1.45rem/1 ${fd}`, color: t1, letterSpacing: "-0.025em" }}>Centro de Campañas</h1>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 8, background: "rgba(255,106,0,0.08)", border: "1px solid rgba(255,106,0,0.18)", borderRadius: 9999, padding: "7px 14px" }}>
          <div style={{ width: 7, height: 7, borderRadius: "50%", background: accent, boxShadow: `0 0 6px ${accent}` }} />
          <span style={{ font: `600 0.75rem/1 ${fb}`, color: accent }}>Campaña activa</span>
        </div>
      </div>

      {/* ── TABS ── */}
      <div style={{ display: "flex", gap: 4, background: "#F1F2F6", borderRadius: 14, padding: 4, width: "fit-content" }}>
        {([
          { id: "resumen" as const, label: "Resumen" },
          { id: "google" as const, label: "Google Ads" },
          { id: "meta" as const, label: "Meta Ads" },
        ]).map(tab => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            style={{
              padding: "8px 18px",
              borderRadius: 10,
              border: "none",
              font: `600 0.78rem/1 ${fd}`,
              cursor: "pointer",
              transition: "all 0.18s",
              background: activeTab === tab.id ? "white" : "transparent",
              color: activeTab === tab.id ? (tab.id === "google" ? "#4285F4" : tab.id === "meta" ? "#1877F2" : accent) : t3,
              boxShadow: activeTab === tab.id ? "0 1px 4px rgba(0,0,0,0.08)" : "none",
            }}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {activeTab === "resumen" && (<>
      {/* ══ ZONA 1 — MÉTRICAS (4 cards) ══ */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 16 }}>
        {metrics.map(m => (
          <div
            key={m.label}
            style={{ ...cardBase, padding: "20px 22px" }}
            onMouseEnter={hoverOn} onMouseLeave={hoverOff}
          >
            <div style={{ display: "flex", alignItems: "center", gap: 9, marginBottom: 12 }}>
              <div style={{ width: 32, height: 32, borderRadius: 9, background: "#1A1D23", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                <m.icon size={14} color={accent} />
              </div>
              <span style={{ font: `500 0.72rem/1.2 ${fb}`, color: t2 }}>{m.label}</span>
            </div>
            <p style={{ font: `800 2rem/1 ${fd}`, color: t1, letterSpacing: "-0.03em", marginBottom: 6 }}>{m.value}</p>
            <p style={{ font: `400 0.68rem/1 ${fb}`, color: t3 }}>{m.sub}</p>
          </div>
        ))}
      </div>

      {/* ══ ZONA 2 — GRÁFICO ══ */}
      <div style={{ ...cardBase, padding: "24px 26px" }} onMouseEnter={hoverOn} onMouseLeave={hoverOff}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 20 }}>
            <div>
              <span style={{ font: `800 1rem/1 ${fd}`, color: t1, display: "block", marginBottom: 3 }}>Rendimiento Semanal</span>
              <span style={{ font: `400 0.72rem/1 ${fb}`, color: t3 }}>Inversión vs. Leads generados</span>
            </div>
            <div style={{ display: "flex", gap: 16 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                <div style={{ width: 10, height: 3, borderRadius: 9999, background: accent }} />
                <span style={{ font: `500 0.68rem/1 ${fb}`, color: t3 }}>Inversión</span>
              </div>
              <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                <div style={{ width: 10, height: 3, borderRadius: 9999, background: "#1E50F0" }} />
                <span style={{ font: `500 0.68rem/1 ${fb}`, color: t3 }}>Leads</span>
              </div>
            </div>
          </div>

          <svg width="100%" height="140" viewBox="0 0 500 140" preserveAspectRatio="none">
            <defs>
              <linearGradient id="invGrad" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor={accent} stopOpacity="0.18" />
                <stop offset="100%" stopColor={accent} stopOpacity="0" />
              </linearGradient>
              <linearGradient id="leadsGrad" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="#1E50F0" stopOpacity="0.15" />
                <stop offset="100%" stopColor="#1E50F0" stopOpacity="0" />
              </linearGradient>
            </defs>
            {[30, 65, 100].map(y => (
              <line key={y} x1="0" y1={y} x2="500" y2={y} stroke="#F1F2F6" strokeWidth="1" />
            ))}
            {/* Inversión area + line */}
            <path d={invChart.area} fill="url(#invGrad)" />
            <path d={invChart.line} stroke={accent} strokeWidth="2.5" fill="none" strokeLinecap="round" strokeLinejoin="round" />
            {invChart.pts.map((pt, i) => (
              <circle key={`inv-${i}`} cx={pt.x} cy={pt.y} r="4" fill="white" stroke={accent} strokeWidth="2" />
            ))}
            {/* Leads area + line */}
            <path d={leadsChart.area} fill="url(#leadsGrad)" />
            <path d={leadsChart.line} stroke="#1E50F0" strokeWidth="2.5" fill="none" strokeLinecap="round" strokeLinejoin="round" />
            {leadsChart.pts.map((pt, i) => (
              <circle key={`leads-${i}`} cx={pt.x} cy={pt.y} r="4" fill="white" stroke="#1E50F0" strokeWidth="2" />
            ))}
          </svg>

          <div style={{ display: "flex", justifyContent: "space-between", marginTop: 10 }}>
            {DAYS.map(d => (
              <span key={d} style={{ font: `400 0.68rem/1 ${fb}`, color: t3 }}>{d}</span>
            ))}
          </div>

          {/* mini stats row */}
          <div style={{ display: "flex", gap: 12, marginTop: 18 }}>
            {[
              { label: "Mejor día", value: "—", sub: "Sin datos aún" },
              { label: "CTR promedio", value: "—", sub: "Tasa de clic" },
              { label: "Impresiones", value: "—", sub: "Esta semana" },
            ].map(s => (
              <div key={s.label} style={{ flex: 1, background: "#F8FAFC", borderRadius: 12, padding: "12px 14px" }}>
                <p style={{ font: `400 0.65rem/1 ${fb}`, color: t3, marginBottom: 5, textTransform: "uppercase", letterSpacing: "0.06em" }}>{s.label}</p>
                <p style={{ font: `700 1rem/1 ${fd}`, color: t1, marginBottom: 3 }}>{s.value}</p>
                <p style={{ font: `400 0.65rem/1 ${fb}`, color: t3 }}>{s.sub}</p>
              </div>
            ))}
          </div>
        </div>

      {/* ══ ZONA 3 — PROSPECTOS CALIENTES ══ */}
      <div style={{ ...cardBase, padding: "22px 24px" }} onMouseEnter={hoverOn} onMouseLeave={hoverOff}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 18 }}>
          <div>
            <span style={{ font: `800 1rem/1 ${fd}`, color: t1, display: "block", marginBottom: 3 }}>Prospectos Calientes</span>
            <span style={{ font: `400 0.72rem/1 ${fb}`, color: t3 }}>Últimos leads que entraron por tu landing</span>
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 6, background: "rgba(255,106,0,0.08)", border: "1px solid rgba(255,106,0,0.15)", borderRadius: 9999, padding: "5px 12px" }}>
            <Zap size={12} color={accent} />
            <span style={{ font: `600 0.68rem/1 ${fb}`, color: accent }}>{PROSPECTOS.length} nuevos hoy</span>
          </div>
        </div>

        {PROSPECTOS.length === 0 && (
          <div style={{ textAlign: "center" as const, padding: "32px 0", color: t3 }}>
            <p style={{ font: `400 0.82rem/1 ${fb}` }}>Aún no hay prospectos. Conectá tus cuentas de Google Ads o Meta Ads para empezar a recibir leads.</p>
          </div>
        )}
        <div style={{ display: "flex", flexDirection: "column", gap: 0 }}>
          {PROSPECTOS.map((p, i) => (
            <div
              key={p.id}
              style={{ display: "flex", alignItems: "center", gap: 14, padding: "13px 0", borderBottom: i < PROSPECTOS.length - 1 ? "1px solid rgba(0,0,0,0.05)" : "none" }}
            >
              <div style={{ width: 38, height: 38, borderRadius: "50%", background: "#1A1D23", color: "white", display: "flex", alignItems: "center", justifyContent: "center", font: `700 0.7rem/1 ${fd}`, flexShrink: 0 }}>
                {initials(p.nombre)}
              </div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <p style={{ font: `600 0.875rem/1 ${fd}`, color: t1, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{p.nombre}</p>
                <p style={{ font: `400 0.68rem/1 ${fb}`, color: t3, marginTop: 3 }}>{p.hora} · Vía {p.fuente}</p>
              </div>
              <span style={{ font: `400 0.72rem/1 ${fb}`, color: t2, whiteSpace: "nowrap" }}>+{p.phone.slice(0, 6)}···</span>
              <a
                href={`https://wa.me/${p.phone}?text=Hola%20${encodeURIComponent(p.nombre.split(" ")[0])}%2C%20vi%20que%20te%20interesaste%20en%20nuestro%20gimnasio%20%F0%9F%92%AA%20%C2%BFcuando%20podes%20pasar%3F`}
                target="_blank"
                rel="noopener noreferrer"
                style={{ display: "flex", alignItems: "center", gap: 6, background: "#25D366", color: "white", border: "none", borderRadius: 10, padding: "8px 14px", font: `600 0.72rem/1 ${fd}`, textDecoration: "none", flexShrink: 0, transition: "opacity 0.15s" }}
                onMouseEnter={e => { (e.currentTarget as HTMLAnchorElement).style.opacity = "0.85"; }}
                onMouseLeave={e => { (e.currentTarget as HTMLAnchorElement).style.opacity = "1"; }}
              >
                <MessageCircle size={13} />
                WhatsApp
              </a>
            </div>
          ))}
        </div>
      </div>

      {/* ══ ZONA 4 — EMILIO + COMPARATIVA ══ */}
      <div style={{ display: "grid", gridTemplateColumns: "1.5fr 1fr", gap: 20 }}>

        {/* Análisis Estratégico de Emilio */}
        <div
          style={{ borderRadius: 18, background: "linear-gradient(145deg, #0d1117 0%, #161b22 60%, #0a0f18 100%)", boxShadow: "0 20px 40px rgba(0,0,0,0.18)", padding: "24px 26px", position: "relative", overflow: "hidden" }}
        >
          {/* glow */}
          <div style={{ position: "absolute", top: -30, right: -30, width: 160, height: 160, borderRadius: "50%", background: "radial-gradient(circle, rgba(255,106,0,0.12) 0%, transparent 70%)", pointerEvents: "none" }} />
          <div style={{ position: "absolute", bottom: -20, left: -20, width: 120, height: 120, borderRadius: "50%", background: "radial-gradient(circle, rgba(30,80,240,0.08) 0%, transparent 70%)", pointerEvents: "none" }} />

          {/* header */}
          <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 20, position: "relative", zIndex: 1 }}>
            <div style={{ width: 40, height: 40, borderRadius: 12, background: "linear-gradient(135deg, rgba(255,106,0,0.25), rgba(255,106,0,0.10))", border: "1px solid rgba(255,106,0,0.30)", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
              <Brain size={18} color={accent} />
            </div>
            <div>
              <p style={{ font: `800 0.95rem/1 ${fd}`, color: "white", marginBottom: 2 }}>Análisis Estratégico de Emilio</p>
              <p style={{ font: `400 0.68rem/1 ${fb}`, color: "rgba(255,255,255,0.38)" }}>Basado en tus métricas de esta semana</p>
            </div>
            <div style={{ marginLeft: "auto", display: "flex", alignItems: "center", gap: 5, background: "rgba(255,106,0,0.12)", border: "1px solid rgba(255,106,0,0.22)", borderRadius: 9999, padding: "4px 10px" }}>
              <div style={{ width: 6, height: 6, borderRadius: "50%", background: "#FF6A00", boxShadow: "0 0 5px #FF6A00" }} />
              <span style={{ font: `600 0.62rem/1 ${fb}`, color: "#FF6A00" }}>En vivo</span>
            </div>
          </div>

          {/* insights */}
          <div style={{ display: "flex", flexDirection: "column", gap: 10, position: "relative", zIndex: 1 }}>
            {insights.map((ins, i) => {
              const colors = {
                good:   { bg: "rgba(255,106,0,0.08)",   border: "rgba(255,106,0,0.20)",   icon: "#FF6A00",   dot: "#FF6A00" },
                warn:   { bg: "rgba(245,158,11,0.08)",  border: "rgba(245,158,11,0.22)",  icon: "#F59E0B",   dot: "#F59E0B" },
                action: { bg: "rgba(30,80,240,0.08)",  border: "rgba(30,80,240,0.20)",  icon: "#1E50F0",   dot: "#1E50F0" },
              }[ins.type];
              const Icon = ins.type === "warn" ? AlertTriangle : ins.type === "action" ? ArrowRight : ChevronRight;
              return (
                <div key={i} style={{ background: colors.bg, border: `1px solid ${colors.border}`, borderRadius: 12, padding: "12px 14px", display: "flex", gap: 10, alignItems: "flex-start" }}>
                  <div style={{ width: 24, height: 24, borderRadius: 7, background: `${colors.dot}18`, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0, marginTop: 1 }}>
                    <Icon size={12} color={colors.icon} />
                  </div>
                  <p style={{ font: `400 0.78rem/1.55 ${fb}`, color: "rgba(255,255,255,0.78)", margin: 0 }}>{ins.text}</p>
                </div>
              );
            })}
          </div>

          {/* footer */}
          <div style={{ display: "flex", alignItems: "center", gap: 6, marginTop: 16, position: "relative", zIndex: 1 }}>
            <Sparkles size={12} color="rgba(255,255,255,0.25)" />
            <span style={{ font: `400 0.62rem/1 ${fb}`, color: "rgba(255,255,255,0.25)" }}>Análisis generado con IA basado en tus datos reales</span>
          </div>
        </div>

        {/* Comparativa de Mercado */}
        <div style={{ ...cardBase, padding: "24px 22px" }} onMouseEnter={hoverOn} onMouseLeave={hoverOff}>
          <span style={{ font: `800 1rem/1 ${fd}`, color: t1, display: "block", marginBottom: 3 }}>Tu CPL vs Industria</span>
          <span style={{ font: `400 0.72rem/1 ${fb}`, color: t3, display: "block", marginBottom: 20 }}>Costo por lead · Promedio fitness Argentina</span>

          {/* bars */}
          <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
            {[
              { label: "Tu gimnasio",  value: cplVal,        color: cplBetter ? "#FF6A00" : "#EF4444", max: INDUSTRY_CPL * 1.3 },
              { label: "Industria",    value: INDUSTRY_CPL,  color: "#9CA3AF",                         max: INDUSTRY_CPL * 1.3 },
            ].map(bar => (
              <div key={bar.label}>
                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 7 }}>
                  <span style={{ font: `500 0.75rem/1 ${fb}`, color: t2 }}>{bar.label}</span>
                  <span style={{ font: `700 0.85rem/1 ${fd}`, color: bar.color }}>${bar.value}</span>
                </div>
                <div style={{ height: 10, borderRadius: 9999, background: "#F1F2F6", overflow: "hidden" }}>
                  <div style={{ height: "100%", width: `${Math.min(100, (bar.value / bar.max) * 100)}%`, background: bar.color, borderRadius: 9999, transition: "width 0.8s ease" }} />
                </div>
              </div>
            ))}
          </div>

          {/* verdict */}
          <div style={{ marginTop: 20, background: cplBetter ? "rgba(255,106,0,0.06)" : "rgba(239,68,68,0.06)", border: `1px solid ${cplBetter ? "rgba(255,106,0,0.18)" : "rgba(239,68,68,0.18)"}`, borderRadius: 12, padding: "12px 14px" }}>
            <p style={{ font: `700 0.78rem/1 ${fd}`, color: cplBetter ? "#FF6A00" : "#EF4444", marginBottom: 4 }}>
              {cplBetter ? `$${cplDiff} más barato que el mercado` : `$${Math.abs(cplDiff)} más caro que el mercado`}
            </p>
            <p style={{ font: `400 0.68rem/1.4 ${fb}`, color: t3 }}>
              {cplBetter
                ? "Tus anuncios convierten mejor que el promedio del sector. Ventaja competitiva real."
                : "Hay margen para optimizar. Revisá segmentación y creativo."}
            </p>
          </div>

          {/* benchmark source */}
          <p style={{ font: `400 0.6rem/1 ${fb}`, color: t3, marginTop: 12, textAlign: "center" as const }}>
            Benchmark FitGrowX · Fitness LATAM 2025
          </p>
        </div>
      </div>

      {/* ══ ZONA 5 — GENERADOR DE COPY ══ */}
      <div style={{ ...cardBase, padding: "24px 26px" }} onMouseEnter={hoverOn} onMouseLeave={hoverOff}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: copies.length > 0 ? 20 : 0 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
            <div style={{ width: 38, height: 38, borderRadius: 11, background: "#1A1D23", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
              <Sparkles size={16} color={accent} />
            </div>
            <div>
              <span style={{ font: `800 1rem/1 ${fd}`, color: t1, display: "block", marginBottom: 3 }}>Generador de Copy para Ads</span>
              <span style={{ font: `400 0.72rem/1 ${fb}`, color: t3 }}>Emilio te redacta 3 textos listos para Instagram basados en tus planes</span>
            </div>
          </div>
          <button
            onClick={generateCopy}
            disabled={copyLoading}
            style={{
              display: "flex", alignItems: "center", gap: 8,
              background: copyLoading ? "#F1F2F6" : `linear-gradient(135deg, ${accent}, ${accent2})`,
              color: copyLoading ? t3 : "white",
              border: "none", borderRadius: 10, padding: "10px 20px",
              font: `600 0.8rem/1 ${fd}`, cursor: copyLoading ? "not-allowed" : "pointer",
              boxShadow: copyLoading ? "none" : `0 4px 14px rgba(255,106,0,0.30)`,
              transition: "all 0.2s", flexShrink: 0,
            }}
          >
            {copyLoading
              ? <><RefreshCw size={14} style={{ animation: "spin 1s linear infinite" }} /> Generando...</>
              : <><Sparkles size={14} /> {copies.length > 0 ? "Regenerar" : "Generar Copy con IA"}</>
            }
          </button>
        </div>

        <style>{`@keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }`}</style>

        {copies.length > 0 && (
          <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 14 }}>
            {copies.map((c, i) => {
              const styleColors = [
                { bg: "rgba(255,106,0,0.04)", border: "rgba(255,106,0,0.14)", label: accent, badge: "rgba(255,106,0,0.10)" },
                { bg: "rgba(30,80,240,0.04)", border: "rgba(30,80,240,0.14)", label: "#1E50F0", badge: "rgba(30,80,240,0.10)" },
                { bg: "rgba(239,68,68,0.04)", border: "rgba(239,68,68,0.12)", label: "#EF4444", badge: "rgba(239,68,68,0.10)" },
              ][i] ?? { bg: "#F8FAFC", border: "rgba(0,0,0,0.06)", label: t1, badge: "#F1F2F6" };
              return (
                <div key={i} style={{ background: styleColors.bg, border: `1px solid ${styleColors.border}`, borderRadius: 14, padding: "16px 16px 12px" }}>
                  <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 12 }}>
                    <span style={{ font: `700 0.68rem/1 ${fd}`, color: styleColors.label, background: styleColors.badge, borderRadius: 9999, padding: "3px 10px", textTransform: "uppercase", letterSpacing: "0.06em" }}>{c.estilo}</span>
                  </div>
                  <p style={{ font: `400 0.82rem/1.6 ${fb}`, color: t1, marginBottom: 14, minHeight: 60 }}>{c.texto}</p>
                  <button
                    onClick={() => handleCopyText(c.texto, i)}
                    style={{ display: "flex", alignItems: "center", gap: 6, background: copiedIdx === i ? "#FF6A00" : "#1A1D23", color: "white", border: "none", borderRadius: 8, padding: "7px 12px", font: `600 0.68rem/1 ${fd}`, cursor: "pointer", transition: "background 0.2s", width: "100%" }}
                  >
                    {copiedIdx === i ? <Check size={12} /> : <Copy size={12} />}
                    {copiedIdx === i ? "¡Copiado!" : "Copiar texto"}
                  </button>
                </div>
              );
            })}
          </div>
        )}

        {copies.length === 0 && !copyLoading && (
          <div style={{ display: "flex", alignItems: "center", gap: 16, marginTop: 20, background: "#F8FAFC", borderRadius: 12, padding: "16px 18px" }}>
            {["Persuasivo", "Directo", "Urgencia"].map(label => (
              <div key={label} style={{ flex: 1, background: "white", borderRadius: 10, padding: "12px 14px", boxShadow: "0 1px 4px rgba(0,0,0,0.04)" }}>
                <div style={{ height: 8, borderRadius: 4, background: "#F1F2F6", marginBottom: 8, width: "50%" }} />
                <div style={{ height: 6, borderRadius: 4, background: "#F1F2F6", marginBottom: 5 }} />
                <div style={{ height: 6, borderRadius: 4, background: "#F1F2F6", width: "75%" }} />
                <p style={{ font: `500 0.68rem/1 ${fb}`, color: t3, marginTop: 10 }}>{label}</p>
              </div>
            ))}
          </div>
        )}
      </div>
      </>)}

      {/* ── GOOGLE ADS ── */}
      {activeTab === "google" && (
        !googleConnected ? (
          <div style={{ display: "flex", alignItems: "center", justifyContent: "center", minHeight: 360 }}>
            <div style={{ ...cardBase, padding: "44px 52px", textAlign: "center" as const, maxWidth: 460 }}>
              <div style={{ width: 64, height: 64, borderRadius: 18, background: "white", boxShadow: "0 2px 16px rgba(0,0,0,0.10)", display: "flex", alignItems: "center", justifyContent: "center", margin: "0 auto 24px" }}>
                <svg viewBox="0 0 48 48" width="38" height="38">
                  <path fill="#4285F4" d="M43.6 20.1H42V20H24v8h11.3C33.6 33.4 29.2 36 24 36c-6.6 0-12-5.4-12-12s5.4-12 12-12c3.1 0 5.8 1.1 7.9 2.9l5.7-5.7C34.1 6.5 29.3 4 24 4 12.9 4 4 12.9 4 24s8.9 20 20 20 20-8.9 20-20c0-1.3-.1-2.6-.4-3.9z"/>
                  <path fill="#34A853" d="M6.3 14.7l6.6 4.8C14.7 15.1 19 12 24 12c3.1 0 5.8 1.1 7.9 2.9l5.7-5.7C34.1 6.5 29.3 4 24 4c-7.7 0-14.3 4.4-17.7 10.7z"/>
                  <path fill="#FBBC05" d="M24 44c5.2 0 9.9-2 13.4-5.2l-6.2-5.2C29.2 35.3 26.7 36 24 36c-5.2 0-9.6-3.5-11.2-8.3l-6.5 5C9.5 39.5 16.2 44 24 44z"/>
                  <path fill="#EA4335" d="M43.6 20.1H42V20H24v8h11.3c-.8 2.3-2.3 4.3-4.3 5.7l6.2 5.2C36.9 37.2 44 32 44 24c0-1.3-.1-2.6-.4-3.9z"/>
                </svg>
              </div>
              <h2 style={{ font: `800 1.3rem/1.2 ${fd}`, color: t1, marginBottom: 10 }}>Conectá Google Ads</h2>
              <p style={{ font: `400 0.82rem/1.65 ${fb}`, color: t2, marginBottom: 28 }}>Gestioná tus campañas de búsqueda y display directamente desde FitGrowX sin salir del panel.</p>
              <div style={{ display: "flex", flexDirection: "column" as const, gap: 10, marginBottom: 28, textAlign: "left" as const }}>
                {["Ver gasto, clics e impresiones en tiempo real", "Pausar o activar campañas con un clic", "Recibir alertas cuando el CPL supera el benchmark"].map(feat => (
                  <div key={feat} style={{ display: "flex", alignItems: "center", gap: 10 }}>
                    <div style={{ width: 20, height: 20, borderRadius: "50%", background: "rgba(66,133,244,0.12)", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                      <Check size={11} color="#4285F4" />
                    </div>
                    <span style={{ font: `400 0.78rem/1 ${fb}`, color: t2 }}>{feat}</span>
                  </div>
                ))}
              </div>
              <button
                onClick={() => setGoogleConnected(true)}
                style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 10, width: "100%", background: "#4285F4", color: "white", border: "none", borderRadius: 12, padding: "13px 24px", font: `700 0.875rem/1 ${fd}`, cursor: "pointer", boxShadow: "0 4px 16px rgba(66,133,244,0.32)", transition: "all 0.2s" }}
              >
                Conectar cuenta de Google Ads
              </button>
              <p style={{ font: `400 0.62rem/1 ${fb}`, color: t3, marginTop: 12 }}>Requiere acceso OAuth · Tus datos son privados y no se comparten</p>
            </div>
          </div>
        ) : (
          <>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 16 }}>
              {[
                { label: "Gasto Semanal", value: "$2.3k", sub: "+12% vs anterior", color: "#4285F4" },
                { label: "Clics", value: "664", sub: "CTR 4.6%", color: "#34A853" },
                { label: "Impresiones", value: "22.8k", sub: "Esta semana", color: "#FBBC05" },
                { label: "Conversiones", value: "27", sub: "CPC prom. $30", color: "#EA4335" },
              ].map(m => (
                <div key={m.label} style={{ ...cardBase, padding: "18px 20px", borderTop: `3px solid ${m.color}` }} onMouseEnter={hoverOn} onMouseLeave={hoverOff}>
                  <p style={{ font: `500 0.72rem/1 ${fb}`, color: t2, marginBottom: 10 }}>{m.label}</p>
                  <p style={{ font: `800 1.8rem/1 ${fd}`, color: t1, marginBottom: 5 }}>{m.value}</p>
                  <p style={{ font: `400 0.65rem/1 ${fb}`, color: t3 }}>{m.sub}</p>
                </div>
              ))}
            </div>
            <div style={{ ...cardBase, padding: "22px 24px" }} onMouseEnter={hoverOn} onMouseLeave={hoverOff}>
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 18 }}>
                <div>
                  <span style={{ font: `800 1rem/1 ${fd}`, color: t1, display: "block", marginBottom: 3 }}>Campañas de búsqueda</span>
                  <span style={{ font: `400 0.72rem/1 ${fb}`, color: t3 }}>Google Search & Display · cuenta vinculada</span>
                </div>
                <button style={{ display: "flex", alignItems: "center", gap: 6, background: "#4285F4", color: "white", border: "none", borderRadius: 10, padding: "8px 16px", font: `600 0.75rem/1 ${fd}`, cursor: "pointer" }}>
                  + Nueva campaña
                </button>
              </div>
              <div style={{ display: "flex", flexDirection: "column" as const, gap: 0 }}>
                {gCampaigns.map((c, i) => (
                  <div key={c.id} style={{ display: "flex", alignItems: "center", gap: 14, padding: "16px 0", borderBottom: i < gCampaigns.length - 1 ? "1px solid rgba(0,0,0,0.05)" : "none" }}>
                    <button
                      onClick={() => setGCampaigns(prev => prev.map(x => x.id === c.id ? { ...x, active: !x.active } : x))}
                      style={{ width: 42, height: 24, borderRadius: 12, background: c.active ? "#34A853" : "#E5E7EB", border: "none", cursor: "pointer", position: "relative" as const, transition: "background 0.2s", flexShrink: 0 }}
                    >
                      <div style={{ position: "absolute" as const, top: 3, left: c.active ? 21 : 3, width: 18, height: 18, borderRadius: "50%", background: "white", boxShadow: "0 1px 4px rgba(0,0,0,0.18)", transition: "left 0.2s" }} />
                    </button>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <p style={{ font: `600 0.875rem/1 ${fd}`, color: t1, marginBottom: 4 }}>{c.name}</p>
                      <p style={{ font: `400 0.68rem/1 ${fb}`, color: t3 }}>Presupuesto: ${c.budget}/día · CPC prom: ${c.cpc}</p>
                    </div>
                    <div style={{ display: "flex", gap: 20, flexShrink: 0 }}>
                      {[
                        { label: "Impresiones", value: c.impressions, color: "#4285F4" },
                        { label: "Clics", value: String(c.clicks), color: "#34A853" },
                        { label: "Conversiones", value: String(c.conversions), color: "#EA4335" },
                      ].map(stat => (
                        <div key={stat.label} style={{ textAlign: "center" as const }}>
                          <p style={{ font: `700 0.95rem/1 ${fd}`, color: stat.color, marginBottom: 2 }}>{stat.value}</p>
                          <p style={{ font: `400 0.6rem/1 ${fb}`, color: t3 }}>{stat.label}</p>
                        </div>
                      ))}
                    </div>
                    <span style={{ font: `500 0.68rem/1 ${fb}`, color: c.active ? "#34A853" : t3, background: c.active ? "rgba(52,168,83,0.10)" : "#F1F2F6", borderRadius: 9999, padding: "4px 10px", flexShrink: 0 }}>
                      {c.active ? "Activa" : "Pausada"}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          </>
        )
      )}

      {/* ── META ADS ── */}
      {activeTab === "meta" && (
        !metaConnected ? (
          <div style={{ display: "flex", alignItems: "center", justifyContent: "center", minHeight: 360 }}>
            <div style={{ ...cardBase, padding: "44px 52px", textAlign: "center" as const, maxWidth: 460 }}>
              <div style={{ width: 64, height: 64, borderRadius: 18, background: "linear-gradient(135deg, #1877F2 0%, #E1306C 100%)", display: "flex", alignItems: "center", justifyContent: "center", margin: "0 auto 24px" }}>
                <svg viewBox="0 0 36 36" width="28" height="28" fill="white">
                  <path d="M20.18 35.84v-13.7h4.6l.69-5.35h-5.29V13.4c0-1.55.43-2.6 2.65-2.6h2.83V6c-.49-.07-2.16-.21-4.11-.21-4.07 0-6.86 2.49-6.86 7.07v3.93h-4.6v5.35h4.6v13.7h5.49z" />
                </svg>
              </div>
              <h2 style={{ font: `800 1.3rem/1.2 ${fd}`, color: t1, marginBottom: 10 }}>Conectá Meta Ads</h2>
              <p style={{ font: `400 0.82rem/1.65 ${fb}`, color: t2, marginBottom: 28 }}>Administrá tus campañas de Facebook e Instagram desde un solo lugar sin salir de FitGrowX.</p>
              <div style={{ display: "flex", flexDirection: "column" as const, gap: 10, marginBottom: 28, textAlign: "left" as const }}>
                {["Gestionar campañas de Facebook e Instagram juntas", "Ver alcance, leads y CPL en tiempo real", "Activar o pausar conjuntos de anuncios al instante"].map(feat => (
                  <div key={feat} style={{ display: "flex", alignItems: "center", gap: 10 }}>
                    <div style={{ width: 20, height: 20, borderRadius: "50%", background: "rgba(24,119,242,0.12)", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                      <Check size={11} color="#1877F2" />
                    </div>
                    <span style={{ font: `400 0.78rem/1 ${fb}`, color: t2 }}>{feat}</span>
                  </div>
                ))}
              </div>
              <button
                onClick={() => setMetaConnected(true)}
                style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 10, width: "100%", background: "linear-gradient(135deg, #1877F2, #E1306C)", color: "white", border: "none", borderRadius: 12, padding: "13px 24px", font: `700 0.875rem/1 ${fd}`, cursor: "pointer", boxShadow: "0 4px 16px rgba(24,119,242,0.28)", transition: "all 0.2s" }}
              >
                Conectar cuenta de Meta Business
              </button>
              <p style={{ font: `400 0.62rem/1 ${fb}`, color: t3, marginTop: 12 }}>Requiere acceso a Meta Business Suite · Tus datos son privados</p>
            </div>
          </div>
        ) : (
          <>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 16 }}>
              {[
                { label: "Gasto Semanal", value: "$4.7k", sub: "+8% vs anterior", color: "#1877F2" },
                { label: "Alcance", value: "33.5k", sub: "Personas únicas", color: "#E1306C" },
                { label: "Leads", value: "39", sub: "Formulario + mensajes", color: "#6B21A8" },
                { label: "CPL", value: "$280", sub: "Costo por lead", color: "#F59E0B" },
              ].map(m => (
                <div key={m.label} style={{ ...cardBase, padding: "18px 20px", borderTop: `3px solid ${m.color}` }} onMouseEnter={hoverOn} onMouseLeave={hoverOff}>
                  <p style={{ font: `500 0.72rem/1 ${fb}`, color: t2, marginBottom: 10 }}>{m.label}</p>
                  <p style={{ font: `800 1.8rem/1 ${fd}`, color: t1, marginBottom: 5 }}>{m.value}</p>
                  <p style={{ font: `400 0.65rem/1 ${fb}`, color: t3 }}>{m.sub}</p>
                </div>
              ))}
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
              {[
                { name: "Facebook", color: "#1877F2", reach: "19.2k", leads: 22 },
                { name: "Instagram", color: "#E1306C", reach: "14.3k", leads: 17 },
              ].map(platform => (
                <div key={platform.name} style={{ ...cardBase, padding: "20px 22px", borderLeft: `4px solid ${platform.color}` }} onMouseEnter={hoverOn} onMouseLeave={hoverOff}>
                  <p style={{ font: `700 0.85rem/1 ${fd}`, color: platform.color, marginBottom: 14 }}>{platform.name}</p>
                  <div style={{ display: "flex", gap: 24 }}>
                    <div>
                      <p style={{ font: `700 1.5rem/1 ${fd}`, color: t1, marginBottom: 3 }}>{platform.reach}</p>
                      <p style={{ font: `400 0.65rem/1 ${fb}`, color: t3 }}>Alcance</p>
                    </div>
                    <div>
                      <p style={{ font: `700 1.5rem/1 ${fd}`, color: t1, marginBottom: 3 }}>{platform.leads}</p>
                      <p style={{ font: `400 0.65rem/1 ${fb}`, color: t3 }}>Leads</p>
                    </div>
                  </div>
                </div>
              ))}
            </div>
            <div style={{ ...cardBase, padding: "22px 24px" }} onMouseEnter={hoverOn} onMouseLeave={hoverOff}>
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 18 }}>
                <div>
                  <span style={{ font: `800 1rem/1 ${fd}`, color: t1, display: "block", marginBottom: 3 }}>Campañas de Meta</span>
                  <span style={{ font: `400 0.72rem/1 ${fb}`, color: t3 }}>Facebook + Instagram · cuenta vinculada</span>
                </div>
                <button style={{ display: "flex", alignItems: "center", gap: 6, background: "linear-gradient(135deg, #1877F2, #E1306C)", color: "white", border: "none", borderRadius: 10, padding: "8px 16px", font: `600 0.75rem/1 ${fd}`, cursor: "pointer" }}>
                  + Nueva campaña
                </button>
              </div>
              <div style={{ display: "flex", flexDirection: "column" as const, gap: 0 }}>
                {mCampaigns.map((c, i) => (
                  <div key={c.id} style={{ display: "flex", alignItems: "center", gap: 14, padding: "16px 0", borderBottom: i < mCampaigns.length - 1 ? "1px solid rgba(0,0,0,0.05)" : "none" }}>
                    <button
                      onClick={() => setMCampaigns(prev => prev.map(x => x.id === c.id ? { ...x, active: !x.active } : x))}
                      style={{ width: 42, height: 24, borderRadius: 12, background: c.active ? "#1877F2" : "#E5E7EB", border: "none", cursor: "pointer", position: "relative" as const, transition: "background 0.2s", flexShrink: 0 }}
                    >
                      <div style={{ position: "absolute" as const, top: 3, left: c.active ? 21 : 3, width: 18, height: 18, borderRadius: "50%", background: "white", boxShadow: "0 1px 4px rgba(0,0,0,0.18)", transition: "left 0.2s" }} />
                    </button>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <p style={{ font: `600 0.875rem/1 ${fd}`, color: t1, marginBottom: 4 }}>{c.name}</p>
                      <p style={{ font: `400 0.68rem/1 ${fb}`, color: t3 }}>Presupuesto: ${c.budget}/día · CPL: ${c.cpl}</p>
                    </div>
                    <div style={{ display: "flex", gap: 20, flexShrink: 0 }}>
                      {[
                        { label: "Alcance", value: c.reach, color: "#1877F2" },
                        { label: "Clics", value: String(c.clicks), color: "#E1306C" },
                        { label: "Leads", value: String(c.leads), color: "#6B21A8" },
                      ].map(stat => (
                        <div key={stat.label} style={{ textAlign: "center" as const }}>
                          <p style={{ font: `700 0.95rem/1 ${fd}`, color: stat.color, marginBottom: 2 }}>{stat.value}</p>
                          <p style={{ font: `400 0.6rem/1 ${fb}`, color: t3 }}>{stat.label}</p>
                        </div>
                      ))}
                    </div>
                    <span style={{ font: `500 0.68rem/1 ${fb}`, color: c.active ? "#1877F2" : t3, background: c.active ? "rgba(24,119,242,0.10)" : "#F1F2F6", borderRadius: 9999, padding: "4px 10px", flexShrink: 0 }}>
                      {c.active ? "Activa" : "Pausada"}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          </>
        )
      )}

      {/* ══ FAB — Lanzar Nueva Campaña ══ */}
      <div style={{ position: "fixed", bottom: 32, right: 32, zIndex: 40 }}>
        <button
          style={{
            display: "flex",
            alignItems: "center",
            gap: 10,
            background: `linear-gradient(135deg, ${accent}, ${accent2})`,
            color: "white",
            border: "none",
            borderRadius: 9999,
            padding: "14px 24px",
            font: `700 0.875rem/1 ${fd}`,
            cursor: "pointer",
            boxShadow: `0 8px 24px rgba(255,106,0,0.40), 0 2px 8px rgba(255,106,0,0.25)`,
            transition: "transform 0.2s, box-shadow 0.2s",
            letterSpacing: "0.01em",
          }}
          onMouseEnter={e => {
            (e.currentTarget as HTMLButtonElement).style.transform = "translateY(-2px) scale(1.02)";
            (e.currentTarget as HTMLButtonElement).style.boxShadow = `0 12px 32px rgba(255,106,0,0.50), 0 4px 12px rgba(255,106,0,0.30)`;
          }}
          onMouseLeave={e => {
            (e.currentTarget as HTMLButtonElement).style.transform = "none";
            (e.currentTarget as HTMLButtonElement).style.boxShadow = `0 8px 24px rgba(255,106,0,0.40), 0 2px 8px rgba(255,106,0,0.25)`;
          }}
        >
          <Rocket size={16} />
          Lanzar Nueva Campaña
        </button>
      </div>

    </div>
  );
}
