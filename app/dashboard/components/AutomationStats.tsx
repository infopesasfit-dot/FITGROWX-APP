'use client';

import { Send, CheckCircle, RefreshCw, Clock } from 'lucide-react';
import { fmt, MONTH_NAMES } from '@/lib/dashboard-helpers';
import { useIsDesktop } from '@/hooks/useIsDesktop';

interface AutomationStatsProps {
  mensajesAutoEnviados: number;
  renovacionesCount: number;
  recuperadosCount: number;
  recuperadosRevenue: number;
  selectedMonth: Date;
}

export function AutomationStats({
  mensajesAutoEnviados,
  renovacionesCount,
  recuperadosCount,
  recuperadosRevenue,
  selectedMonth,
}: AutomationStatsProps) {
  const isDesktop = useIsDesktop();
  const monthLabel = MONTH_NAMES[selectedMonth.getMonth()].toUpperCase();
  const horasSaved = Math.round(mensajesAutoEnviados / 6);

  // Desktop version: 4-column grid with individual card divs
  const Desktop = (
    <div className="dashboard-card" style={{ padding: "22px 24px" }}>
      <p style={{ font: `600 0.66rem/1 var(--font-family-body)`, color: "#6366F1", textTransform: "uppercase", letterSpacing: "0.12em", marginBottom: 4 }}>AUTOMATIZACIONES · {monthLabel}</p>
      <p style={{ font: `700 1rem/1 var(--font-family-display)`, color: "var(--color-text-1)", marginBottom: 3 }}>Lo que FitGrowX hizo por vos</p>
      <p style={{ font: `400 0.74rem/1.4 var(--font-family-display)`, color: "var(--color-text-3)", marginBottom: 18 }}>El sistema trabajó mientras te ocupabas del gym.</p>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 12 }}>
        {/* Card 1: Mensajes */}
        <div style={{ padding: "14px 14px", borderRadius: 12, background: "rgba(111,99,232,0.05)", border: "1px solid rgba(111,99,232,0.12)" }}>
          <div style={{ width: 28, height: 28, borderRadius: 8, background: "rgba(111,99,232,0.12)", color: "#6366F1", display: "flex", alignItems: "center", justifyContent: "center", marginBottom: 10 }}><Send size={14} /></div>
          <p style={{ font: `700 1.55rem/1 var(--font-family-display)`, color: "#4338CA", marginBottom: 5, letterSpacing: "-0.04em" }}>{mensajesAutoEnviados}</p>
          <p style={{ font: `600 0.66rem/1 var(--font-family-body)`, color: "#6366F1", letterSpacing: "0.06em", marginBottom: 3 }}>MENSAJES ENVIADOS</p>
          <p style={{ font: `400 0.67rem/1.4 var(--font-family-display)`, color: "var(--color-text-3)" }}>recordatorios, bienvenidas y alertas</p>
        </div>

        {/* Card 2: Renovaciones */}
        <div style={{ padding: "14px 14px", borderRadius: 12, background: "rgba(111,99,232,0.05)", border: "1px solid rgba(111,99,232,0.12)" }}>
          <div style={{ width: 28, height: 28, borderRadius: 8, background: "rgba(111,99,232,0.12)", color: "#6366F1", display: "flex", alignItems: "center", justifyContent: "center", marginBottom: 10 }}><CheckCircle size={14} /></div>
          <p style={{ font: `700 1.55rem/1 var(--font-family-display)`, color: "#4338CA", marginBottom: 5, letterSpacing: "-0.04em" }}>{renovacionesCount}</p>
          <p style={{ font: `600 0.66rem/1 var(--font-family-body)`, color: "#6366F1", letterSpacing: "0.06em", marginBottom: 3 }}>RENOVACIONES</p>
          <p style={{ font: `400 0.67rem/1.4 var(--font-family-display)`, color: "var(--color-text-3)" }}>socios que renovaron su membresía</p>
        </div>

        {/* Card 3: Recuperados */}
        <div style={{ padding: "14px 14px", borderRadius: 12, background: "rgba(111,99,232,0.05)", border: "1px solid rgba(111,99,232,0.12)" }}>
          <div style={{ width: 28, height: 28, borderRadius: 8, background: "rgba(111,99,232,0.12)", color: "#6366F1", display: "flex", alignItems: "center", justifyContent: "center", marginBottom: 10 }}><RefreshCw size={14} /></div>
          <p style={{ font: `700 1.55rem/1 var(--font-family-display)`, color: "#4338CA", marginBottom: 5, letterSpacing: "-0.04em" }}>{recuperadosCount}</p>
          <p style={{ font: `600 0.66rem/1 var(--font-family-body)`, color: "#6366F1", letterSpacing: "0.06em", marginBottom: 3 }}>SOCIOS RECUPERADOS</p>
          <p style={{ font: `400 0.67rem/1.4 var(--font-family-display)`, color: recuperadosRevenue > 0 ? "#15803D" : "var(--color-text-3)"}}>{recuperadosRevenue > 0 ? `${fmt(recuperadosRevenue)} recuperados` : "sin recuperados aún"}</p>
        </div>

        {/* Card 4: Tiempo ahorrado */}
        <div style={{ padding: "14px 14px", borderRadius: 12, background: "rgba(111,99,232,0.05)", border: "1px solid rgba(111,99,232,0.12)" }}>
          <div style={{ width: 28, height: 28, borderRadius: 8, background: "rgba(111,99,232,0.12)", color: "#6366F1", display: "flex", alignItems: "center", justifyContent: "center", marginBottom: 10 }}><Clock size={14} /></div>
          <p style={{ font: `700 1.55rem/1 var(--font-family-display)`, color: "#4338CA", marginBottom: 5, letterSpacing: "-0.04em" }}>{horasSaved} hs</p>
          <p style={{ font: `600 0.66rem/1 var(--font-family-body)`, color: "#6366F1", letterSpacing: "0.06em", marginBottom: 3 }}>TIEMPO AHORRADO</p>
          <p style={{ font: `400 0.67rem/1.4 var(--font-family-display)`, color: "var(--color-text-3)" }}>trabajo manual evitado</p>
        </div>
      </div>
    </div>
  );

  // Mobile version: .map() loop with responsive grid
  const Mobile = (
    <div className="dashboard-card" style={{ padding: "16px 14px" }}>
      <p style={{ font: `600 0.62rem/1 var(--font-family-body)`, color: "#6366F1", textTransform: "uppercase", letterSpacing: "0.12em", marginBottom: 3 }}>AUTOMATIZACIONES · {monthLabel}</p>
      <p style={{ font: `700 0.84rem/1 var(--font-family-display)`, color: "var(--color-text-1)", marginBottom: 2 }}>Lo que FitGrowX hizo por vos</p>
      <p style={{ font: `400 0.68rem/1.4 var(--font-family-display)`, color: "var(--color-text-3)", marginBottom: 12 }}>El sistema trabajó mientras te ocupabas del gym.</p>
      <div style={{ display: "grid", gridTemplateColumns: "1fr", gap: 8 }}>
        {[
          { icon: <Send size={13} />, value: mensajesAutoEnviados, label: "MENSAJES" },
          { icon: <CheckCircle size={13} />, value: renovacionesCount, label: "RENOVAC." },
          { icon: <RefreshCw size={13} />, value: recuperadosCount, label: "RECUP.", sub: recuperadosRevenue > 0 ? fmt(recuperadosRevenue) : null },
          { icon: <Clock size={13} />, value: `${horasSaved} hs`, label: "AHORRADAS" },
        ].map((item, i) => (
          <div key={i} style={{ padding: "12px 12px", borderRadius: 10, background: "rgba(111,99,232,0.06)", border: "1px solid rgba(111,99,232,0.10)", display: "flex", alignItems: "center", gap: 10 }}>
            <div style={{ width: 28, height: 28, borderRadius: 8, background: "rgba(111,99,232,0.12)", color: "#6366F1", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>{item.icon}</div>
            <div>
              <p style={{ font: `700 1.1rem/1 var(--font-family-display)`, color: "#4338CA", marginBottom: 2, letterSpacing: "-0.03em" }}>{item.value}</p>
              <p style={{ font: `500 0.57rem/1.3 var(--font-family-body)`, color: "#6366F1", letterSpacing: "0.04em" }}>{item.label}</p>
              {item.sub && <p style={{ font: `500 0.58rem/1 var(--font-family-display)`, color: "#15803D", marginTop: 2 }}>{item.sub}</p>}
            </div>
          </div>
        ))}
      </div>
    </div>
  );

  return isDesktop ? Desktop : Mobile;
}
