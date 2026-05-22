import React from "react";
import { Megaphone, Zap, CircleHelp } from "lucide-react";
import { DashboardMetric } from "@/lib/dashboard-types";
import { metricDelta, formatMetricValue, getMetricTag } from "@/lib/dashboard-helpers";

const ACCENT_DEEP = "#E65A00";
const STATUS_POSITIVE = "#11A869";
const STATUS_NEGATIVE = "#E6543A";

function Skel({ w, h, r = 7 }: { w?: number | string; h: number; r?: number }) {
  return (
    <div style={{ width: w ?? "100%", height: h, borderRadius: r, flexShrink: 0, background: "linear-gradient(90deg,#ECEEF2 25%,#E4E6EB 50%,#ECEEF2 75%)", backgroundSize: "400% 100%", animation: "skelShimmer 1.6s ease infinite" }} />
  );
}

interface MetricSectionProps {
  section: "Embudo" | "Fidelización" | "Eficiencia";
  metrics: DashboardMetric[];
  prospectos: number;
  loading: boolean;
  isDesktop: boolean;
  isOpen: boolean;
  onToggle: () => void;
  activeInfo: { title: string; body: string } | null;
  setActiveInfo: (info: { title: string; body: string } | null) => void;
}

export function MetricSection({
  section,
  metrics,
  prospectos,
  loading,
  isDesktop,
  isOpen,
  onToggle,
  activeInfo,
  setActiveInfo,
}: MetricSectionProps) {
  const sectionMetrics = metrics.filter((m) => m.section === section);

  const renderMetricInfo = (metric: DashboardMetric) => (
    <div
      style={{ position: "relative", display: "inline-flex" }}
      onMouseEnter={() => { if (isDesktop) setActiveInfo({ title: metric.label, body: metric.tooltip }); }}
      onMouseLeave={() => { if (isDesktop) setActiveInfo(null); }}
    >
      <button
        onClick={() => { if (!isDesktop) setActiveInfo({ title: metric.label, body: metric.tooltip }); }}
        style={{ width: 22, height: 22, borderRadius: "50%", border: "1px solid rgba(17,24,39,0.08)", background: "#FFFFFF", color: "var(--color-text-3)", display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer", padding: 0 }}
      >
        <CircleHelp size={13} />
      </button>
      {isDesktop && activeInfo?.title === metric.label && (
        <div style={{ position: "absolute", left: "50%", bottom: "calc(100% + 8px)", transform: "translateX(-50%)", width: 220, padding: "10px 12px", borderRadius: 14, background: "#17181B", color: "white", boxShadow: "0 20px 40px rgba(0,0,0,0.18)", zIndex: 20 }}>
          <p style={{ font: `700 0.72rem/1 var(--font-family-display)`, marginBottom: 5 }}>{metric.label}</p>
          <p style={{ font: `500 0.68rem/1.45 var(--font-family-display)`, color: "rgba(255,255,255,0.75)" }}>{metric.tooltip}</p>
        </div>
      )}
    </div>
  );

  const renderMetricCell = (metric: DashboardMetric, idx: number, showStep: boolean, isLast: boolean) => {
    const delta = metricDelta(metric.value, metric.previous);
    const isPositive = metric.key === "cac" ? (delta ?? 0) <= 0 : metric.key === "churn" ? (delta ?? 0) <= 0 : (delta ?? 0) >= 0;
    const tag = getMetricTag(metric);
    const deltaText = delta == null ? "Sin datos" : delta === 0 ? "Sin cambios" : `${delta > 0 ? "▲" : "▼"} ${Math.abs(delta).toFixed(1)}%`;
    const deltaColor = delta == null ? "var(--color-text-3)" : delta === 0 ? "var(--color-text-3)" : isPositive ? STATUS_POSITIVE : STATUS_NEGATIVE;
    return (
      <div key={metric.key} style={{ padding: isDesktop ? "18px 20px" : "14px 12px", display: "flex", flexDirection: "column", gap: 10, position: "relative" }}>
        {showStep && <span style={{ font: `500 0.62rem/1 var(--font-family-body)`, color: "var(--color-text-3)", letterSpacing: "0.06em" }}>0{idx + 1}</span>}
        <div>
          <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 10 }}>
            <p style={{ font: `600 0.64rem/1 var(--font-family-body)`, color: "var(--color-text-3)", textTransform: "uppercase", letterSpacing: "0.12em" }}>{metric.label}</p>
            {metric.tooltip && renderMetricInfo(metric)}
          </div>
          <p style={{ font: `700 ${isDesktop ? "1.75rem" : "1.4rem"}/0.94 var(--font-family-display)`, color: "var(--color-text-1)", letterSpacing: "-0.04em" }}>{formatMetricValue(metric)}</p>
        </div>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8, marginTop: "auto" }}>
          <span style={{ font: `700 0.62rem/1 var(--font-family-body)`, letterSpacing: "0.07em", padding: "4px 8px", borderRadius: 6, background: tag.green ? "rgba(22,163,74,0.10)" : "rgba(255,122,24,0.10)", color: tag.green ? "#15803D" : ACCENT_DEEP }}>
            {tag.label}
          </span>
          <span style={{ font: `500 0.68rem/1 var(--font-family-display)`, color: deltaColor, whiteSpace: "nowrap" }}>{deltaText}</span>
        </div>
        {!isLast && isDesktop && (
          <div style={{ position: "absolute", right: 0, top: 0, bottom: 0, width: 1, background: "rgba(15,17,21,0.07)" }} />
        )}
      </div>
    );
  };

  const isEmbudo = section === "Embudo";
  const isFidel = section === "Fidelización";
  const cols = isEmbudo
    ? (isDesktop ? 2 : 1)
    : (isDesktop ? Math.min(sectionMetrics.length, 3) : 1);
  const Icon = isEmbudo ? Megaphone : Zap;
  const iconColor = isEmbudo ? ACCENT_DEEP : isFidel ? "#16A34A" : "#6366F1";
  const iconBg = isEmbudo ? "rgba(255,122,24,0.10)" : isFidel ? "rgba(22,163,74,0.10)" : "rgba(111,99,232,0.10)";
  const title = isEmbudo ? "Captación de socios" : isFidel ? "Retención" : "Eficiencia";
  const subtitle = isEmbudo ? "Personas que llegaron y cuántas terminaron pagando" : isFidel ? "Quiénes renuevan y quiénes se van" : "Rendimiento del negocio";

  return (
    <section className="dashboard-card" style={{ overflow: "hidden" }}>
      {/* Header */}
      <button
        onClick={onToggle}
        style={{ width: "100%", display: "flex", alignItems: "center", gap: 10, padding: isDesktop ? "16px 20px 14px" : "14px 16px 12px", borderBottom: "1px solid rgba(15,17,21,0.07)", background: "none", border: "none", cursor: "pointer", textAlign: "left" }}
      >
        <div style={{ width: 28, height: 28, borderRadius: 8, background: iconBg, color: iconColor, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
          <Icon size={14} />
        </div>
        <p style={{ font: `700 0.9rem/1 var(--font-family-display)`, color: "var(--color-text-1)" }}>{title}</p>
        {isEmbudo && prospectos > 0 && (
          <span style={{ font: `600 0.62rem/1 var(--font-family-body)`, color: ACCENT_DEEP, background: "rgba(255,122,24,0.08)", border: "1px solid rgba(255,122,24,0.18)", borderRadius: 9999, padding: "3px 8px", whiteSpace: "nowrap" }}>
            ● {prospectos} lead{prospectos === 1 ? "" : "s"} activo{prospectos === 1 ? "" : "s"}
          </span>
        )}
        <span style={{ font: `400 0.74rem/1 var(--font-family-display)`, color: "var(--color-text-3)", marginLeft: "auto", whiteSpace: "nowrap" }}>{subtitle}</span>
        <span style={{ font: `400 1rem/1 var(--font-family-display)`, color: "var(--color-text-3)", transform: isOpen ? "rotate(180deg)" : "none", transition: "transform 0.2s", flexShrink: 0 }}>⌄</span>
      </button>
      {/* Grid */}
      {isOpen && (
        <>
          {loading && sectionMetrics.length === 0 ? (
            <div style={{ display: "grid", gridTemplateColumns: `repeat(${cols}, 1fr)` }}>
              {Array(cols * (isEmbudo ? 2 : 1)).fill(null).map((_, i) => (
                <div key={i} style={{ padding: "18px 20px", display: "flex", flexDirection: "column", gap: 10 }}>
                  <Skel w="30%" h={9} r={4} />
                  <Skel w="55%" h={10} r={4} />
                  <Skel w="40%" h={28} r={7} />
                  <div style={{ display: "flex", justifyContent: "space-between" }}>
                    <Skel w={64} h={22} r={6} />
                    <Skel w={72} h={10} r={4} />
                  </div>
                </div>
              ))}
            </div>
          ) : sectionMetrics.length === 0 ? (
            <div style={{ padding: "22px 20px", display: "grid", gridTemplateColumns: `repeat(${cols}, 1fr)` }}>
              {Array(cols).fill(null).map((_, i) => (
                <div key={i} style={{ padding: "14px 20px", display: "flex", flexDirection: "column", gap: 8, opacity: 0.45 }}>
                  <Skel w="40%" h={8} r={4} />
                  <Skel w="30%" h={28} r={7} />
                  <Skel w="55%" h={8} r={4} />
                </div>
              ))}
            </div>
          ) : (
            <div style={{ display: "grid", gridTemplateColumns: `repeat(${cols}, 1fr)` }}>
              {sectionMetrics.map((m, i) => {
                const isRowLast = (i + 1) % cols === 0 || i === sectionMetrics.length - 1;
                const isLastRow = i >= sectionMetrics.length - cols;
                return (
                  <React.Fragment key={m.key}>
                    <div style={{ borderBottom: !isLastRow && isDesktop ? "1px solid rgba(15,17,21,0.07)" : "none" }}>
                      {renderMetricCell(m, i, isEmbudo, isRowLast)}
                    </div>
                  </React.Fragment>
                );
              })}
            </div>
          )}
        </>
      )}
    </section>
  );
}
