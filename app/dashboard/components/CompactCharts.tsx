import React from "react";

interface CompactChartsProps {
  fd: string;
  fb: string;
  t1: string;
  t2: string;
  t3: string;
  accent: string;
  accentDeep: string;
}

export function CompactCaptacion({
  value,
  delta,
  fd,
  fm,
  t1,
  t3,
  accentDeep,
}: {
  value: number;
  delta?: number;
  fd: string;
  fm: string;
  t1: string;
  t3: string;
  accentDeep: string;
}) {
  const deltaText = delta == null ? "Sin datos" : delta === 0 ? "Sin cambios" : `${delta > 0 ? "▲" : "▼"} ${Math.abs(delta).toFixed(1)}%`;
  const deltaColor = delta == null ? t3 : delta === 0 ? t3 : delta > 0 ? "#16A34A" : "#DC2626";

  return (
    <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
      <div>
        <p style={{ font: `700 1.1rem/1 ${fd}`, color: t1, margin: 0, letterSpacing: "-0.03em" }}>↑ {value}</p>
        <p style={{ font: `500 0.65rem/1 ${fm}`, color: t3, margin: "4px 0 0 0" }}>altas este mes</p>
      </div>
      <span style={{ font: `600 0.68rem/1 ${fm}`, color: deltaColor, whiteSpace: "nowrap" }}>{deltaText}</span>
    </div>
  );
}

export function CompactBalance({
  value,
  delta,
  fd,
  fm,
  t1,
  t3,
}: {
  value: number;
  delta?: number;
  fd: string;
  fm: string;
  t1: string;
  t3: string;
}) {
  const fmt = (n: number) => n.toLocaleString("es-AR", { style: "currency", currency: "ARS", maximumFractionDigits: 0 });
  const deltaText = delta == null ? "—" : `${delta > 0 ? "+" : ""}${delta.toFixed(1)}%`;
  const deltaColor = delta == null ? t3 : delta > 0 ? "#16A34A" : "#DC2626";

  return (
    <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
      <div>
        <p style={{ font: `700 1.1rem/1 ${fd}`, color: value >= 0 ? "#16A34A" : "#DC2626", margin: 0, letterSpacing: "-0.03em" }}>
          {value >= 0 ? "+" : ""}{fmt(value)}
        </p>
        <p style={{ font: `500 0.65rem/1 ${fm}`, color: t3, margin: "4px 0 0 0" }}>neto este mes</p>
      </div>
      <span style={{ font: `600 0.68rem/1 ${fm}`, color: deltaColor, whiteSpace: "nowrap" }}>{deltaText}</span>
    </div>
  );
}

export function CompactAsistencia({
  asistHoy,
  promedioDiario,
  peakHour,
  fd,
  fm,
  t1,
  t3,
  accentDeep,
}: {
  asistHoy: number;
  promedioDiario: number;
  peakHour: number;
  fd: string;
  fm: string;
  t1: string;
  t3: string;
  accentDeep: string;
}) {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
      <div>
        <p style={{ font: `700 1.1rem/1 ${fd}`, color: t1, margin: 0, letterSpacing: "-0.03em" }}>⌀ {promedioDiario}/día</p>
        <p style={{ font: `500 0.65rem/1 ${fm}`, color: t3, margin: "4px 0 0 0" }}>
          {asistHoy} hoy · pico {peakHour}h
        </p>
      </div>
    </div>
  );
}

export function MiniSparkline({
  data,
  width = 60,
  height = 20,
  color = "#2563EB",
}: {
  data: number[];
  width?: number;
  height?: number;
  color?: string;
}) {
  if (!data.length) return <span style={{ color: "#999", fontSize: "0.7rem" }}>—</span>;

  const max = Math.max(...data, 1);
  const points = data.map((v, i) => ({
    x: (i / (data.length - 1)) * width,
    y: height - (v / max) * height,
  }));

  const line = `M${points[0].x},${points[0].y} ` + points.slice(1).map((p) => `L${p.x},${p.y}`).join(" ");

  return (
    <svg width={width} height={height} viewBox={`0 0 ${width} ${height}`} style={{ display: "inline-block" }}>
      <path d={line} stroke={color} strokeWidth="1.5" fill="none" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}
