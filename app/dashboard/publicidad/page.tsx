"use client";

import { useState } from "react";
import {
  TrendingUp, Target, Users, DollarSign,
  Copy, Check, MessageCircle, Rocket,
  Activity, Globe, Zap, Brain, Sparkles,
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
const INVERSION  = [1200, 1800, 1500, 2200, 1900, 2600, 2100];
const LEADS      = [4,    7,    5,    9,    8,    12,   10];

function buildLine(data: number[], maxVal: number, w: number, h: number) {
  const pts = data.map((v, i) => ({
    x: (i / (data.length - 1)) * w,
    y: h - (v / maxVal) * (h - 16),
  }));
  let d = `M${pts[0].x.toFixed(1)},${pts[0].y.toFixed(1)}`;
  for (let i = 1; i < pts.length; i++) {
    const p = pts[i - 1], c = pts[i];
    const cpx = ((p.x + c.x) / 2).toFixed(1);
    d += ` C${cpx},${p.y.toFixed(1)} ${cpx},${c.y.toFixed(1)} ${c.x.toFixed(1)},${c.y.toFixed(1)}`;
  }
  return { line: d, area: d + ` L${w},${h} L0,${h} Z`, pts };
}

/* ── Prospectos mock ── */
const PROSPECTOS = [
  { id: 1, nombre: "Valentina Ríos",   phone: "5491161234567", hora: "Hace 10 min",  fuente: "Meta Ads" },
  { id: 2, nombre: "Matías Gómez",     phone: "5491170987654", hora: "Hace 38 min",  fuente: "Meta Ads" },
  { id: 3, nombre: "Luciana Torres",   phone: "5491155443322", hora: "Hace 1h 12m",  fuente: "Google"   },
  { id: 4, nombre: "Ezequiel Suárez",  phone: "5491144556677", hora: "Hace 2h 05m",  fuente: "Meta Ads" },
  { id: 5, nombre: "Camila Benítez",   phone: "5491133445566", hora: "Hace 3h 40m",  fuente: "Orgánico" },
];

function initials(name: string) {
  return name.split(" ").slice(0, 2).map(w => w[0]).join("").toUpperCase();
}

export default function PublicidadPage() {
  const [copied, setCopied] = useState(false);
  const [copyLoading, setCopyLoading] = useState(false);
  const [copies, setCopies] = useState<{ estilo: string; texto: string }[]>([]);
  const [copiedIdx, setCopiedIdx] = useState<number | null>(null);

  const landingUrl = "fitgrowx.app/l/tu-gimnasio";

  const handleCopy = () => {
    navigator.clipboard.writeText(`https://${landingUrl}`);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

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
    {
      label: "Inversión Semanal",
      value: `$${(totalInv / 1000).toFixed(1)}k`,
      sub: "+18% vs semana anterior",
      icon: DollarSign,
      iconBg: "#1A1D23",
      iconColor: accent,
      accent: accent,
    },
    {
      label: "Leads Generados",
      value: String(totalLeads),
      sub: "Esta semana",
      icon: Users,
      iconBg: "#1E50F0",
      iconColor: "white",
      accent: "#1E50F0",
    },
    {
      label: "Costo por Lead",
      value: cpl === "—" ? "—" : `$${cpl}`,
      sub: "Promedio semanal",
      icon: Target,
      iconBg: "#FF6A00",
      iconColor: "white",
      accent: "#FF6A00",
    },
    {
      label: "ROAS",
      value: roas,
      sub: "Retorno sobre inversión",
      icon: TrendingUp,
      iconBg: "#F59E0B",
      iconColor: "white",
      accent: "#F59E0B",
    },
  ];

  const healthPct = 85;

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

      {/* ══ ZONA 1 — MÉTRICAS (4 cards) ══ */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 16 }}>
        {metrics.map(m => (
          <div
            key={m.label}
            style={{ ...cardBase, padding: "20px 22px", borderTop: `3px solid ${m.accent}`, position: "relative", overflow: "hidden" }}
            onMouseEnter={hoverOn} onMouseLeave={hoverOff}
          >
            <div style={{ position: "absolute", right: -14, top: -14, width: 80, height: 80, borderRadius: "50%", background: `radial-gradient(circle, ${m.accent}12 0%, transparent 70%)`, pointerEvents: "none" }} />
            <div style={{ display: "flex", alignItems: "center", gap: 9, marginBottom: 12 }}>
              <div style={{ width: 32, height: 32, borderRadius: 9, background: m.iconBg, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                <m.icon size={14} color={m.iconColor} />
              </div>
              <span style={{ font: `500 0.72rem/1.2 ${fb}`, color: t2 }}>{m.label}</span>
            </div>
            <p style={{ font: `800 2rem/1 ${fd}`, color: t1, letterSpacing: "-0.03em", marginBottom: 6 }}>{m.value}</p>
            <p style={{ font: `400 0.68rem/1 ${fb}`, color: t3 }}>{m.sub}</p>
          </div>
        ))}
      </div>

      {/* ══ ZONA 2 — ASIMÉTRICA: Gráfico | Landing ══ */}
      <div style={{ display: "grid", gridTemplateColumns: "2.2fr 1fr", gap: 20 }}>

        {/* Gráfico Rendimiento Semanal */}
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
              { label: "Mejor día", value: "Sábado", sub: "12 leads", color: accent },
              { label: "CTR promedio", value: "4.3%", sub: "Tasa de clic", color: "#1E50F0" },
              { label: "Impresiones", value: "28.4k", sub: "Esta semana", color: "#FF6A00" },
            ].map(s => (
              <div key={s.label} style={{ flex: 1, background: "#F8FAFC", borderRadius: 12, padding: "12px 14px" }}>
                <p style={{ font: `400 0.65rem/1 ${fb}`, color: t3, marginBottom: 5, textTransform: "uppercase", letterSpacing: "0.06em" }}>{s.label}</p>
                <p style={{ font: `700 1rem/1 ${fd}`, color: t1, marginBottom: 3 }}>{s.value}</p>
                <p style={{ font: `400 0.65rem/1 ${fb}`, color: t3 }}>{s.sub}</p>
              </div>
            ))}
          </div>
        </div>

        {/* Estado de tu Landing */}
        <div style={{ ...cardBase, padding: "24px 22px", display: "flex", flexDirection: "column", gap: 20 }} onMouseEnter={hoverOn} onMouseLeave={hoverOff}>
          <div>
            <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 4 }}>
              <Globe size={15} color={accent} />
              <span style={{ font: `800 1rem/1 ${fd}`, color: t1 }}>Estado de tu Landing</span>
            </div>
            <span style={{ font: `400 0.72rem/1 ${fb}`, color: t3 }}>Tu página de captación activa</span>
          </div>

          {/* URL card */}
          <div style={{ background: "#F8FAFC", borderRadius: 12, padding: "12px 14px" }}>
            <p style={{ font: `400 0.62rem/1 ${fb}`, color: t3, marginBottom: 5, textTransform: "uppercase", letterSpacing: "0.07em" }}>URL de landing</p>
            <p style={{ font: `600 0.78rem/1.3 ${fd}`, color: t1, wordBreak: "break-all", marginBottom: 10 }}>{landingUrl}</p>
            <button
              onClick={handleCopy}
              style={{ display: "flex", alignItems: "center", gap: 6, background: copied ? "#FF6A00" : "#1A1D23", color: "white", border: "none", borderRadius: 8, padding: "7px 14px", font: `600 0.72rem/1 ${fd}`, cursor: "pointer", transition: "background 0.2s", width: "100%" }}
            >
              {copied ? <Check size={13} /> : <Copy size={13} />}
              {copied ? "¡Copiado!" : "Copiar Enlace"}
            </button>
          </div>

          {/* Salud de la landing */}
          <div>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 10 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 7 }}>
                <Activity size={14} color="#FF6A00" />
                <span style={{ font: `600 0.78rem/1 ${fd}`, color: t1 }}>Salud de la Landing</span>
              </div>
              <span style={{ font: `800 1.1rem/1 ${fd}`, color: "#FF6A00" }}>{healthPct}%</span>
            </div>
            <div style={{ height: 7, borderRadius: 9999, background: "#F1F2F6", overflow: "hidden", marginBottom: 8 }}>
              <div style={{ height: "100%", width: `${healthPct}%`, background: "linear-gradient(90deg, #FF6A00, #FF6A00)", borderRadius: 9999, transition: "width 0.8s ease" }} />
            </div>
            <p style={{ font: `400 0.65rem/1 ${fb}`, color: t3 }}>Tasa de conversión estimada</p>
          </div>

          {/* checks */}
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            {[
              { label: "Carga rápida (<2s)", ok: true },
              { label: "Formulario activo", ok: true },
              { label: "Pixel Meta instalado", ok: true },
              { label: "Pruebas A/B activas", ok: false },
            ].map(item => (
              <div key={item.label} style={{ display: "flex", alignItems: "center", gap: 8 }}>
                <div style={{ width: 18, height: 18, borderRadius: "50%", background: item.ok ? "rgba(255,106,0,0.1)" : "rgba(156,163,175,0.15)", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                  <Check size={10} color={item.ok ? "#FF6A00" : t3} />
                </div>
                <span style={{ font: `400 0.72rem/1 ${fb}`, color: item.ok ? t2 : t3 }}>{item.label}</span>
              </div>
            ))}
          </div>
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
