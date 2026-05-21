import { DashboardMetric } from "./dashboard-types";

// ─────────────────────────────────────────────────────────────────────────
// Formatting helpers
// ─────────────────────────────────────────────────────────────────────────

export function initials(name: string): string {
  if (!name) return "?";
  return name.split(" ").slice(0, 2).map(w => w[0]).join("").toUpperCase();
}

export function fmt(n: number): string {
  if (n >= 1_000_000) return `$${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `$${(n / 1_000).toFixed(0)}k`;
  return `$${n}`;
}

// ─────────────────────────────────────────────────────────────────────────
// Date/month helpers
// ─────────────────────────────────────────────────────────────────────────

const MONTH_LABELS = ["Ene", "Feb", "Mar", "Abr", "May", "Jun", "Jul", "Ago", "Sep", "Oct", "Nov", "Dic"];

export const MONTH_NAMES = ["Enero", "Febrero", "Marzo", "Abril", "Mayo", "Junio", "Julio", "Agosto", "Septiembre", "Octubre", "Noviembre", "Diciembre"];

export function last5Months(referenceDate: Date = new Date()): { key: string; label: string }[] {
  return Array.from({ length: 5 }, (_, i) => {
    const d = new Date(referenceDate.getFullYear(), referenceDate.getMonth() - (4 - i), 1);
    return {
      key: `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`,
      label: MONTH_LABELS[d.getMonth()],
    };
  });
}

// ─────────────────────────────────────────────────────────────────────────
// Metric calculation helpers
// ─────────────────────────────────────────────────────────────────────────

export function metricDelta(current: number | null, previous: number | null): number | null {
  if (current == null || previous == null) return null;
  if (previous === 0) return current === 0 ? 0 : 100;
  return ((current - previous) / previous) * 100;
}

export function formatMetricValue(metric: DashboardMetric): string {
  if (metric.value == null) return "—";
  if (metric.format === "currency") return fmt(Math.round(metric.value));
  if (metric.format === "percent") return `${metric.value.toFixed(1)}%`;
  if (metric.format === "months") return `${metric.value.toFixed(1)}m`;
  return Number.isInteger(metric.value) ? String(metric.value) : metric.value.toFixed(1);
}

export function getMetricTag(metric: DashboardMetric): { label: string; green: boolean } {
  switch (metric.key) {
    case "leads":
      return { label: "CAPTACIÓN", green: false };
    case "lead_trial":
      return { label: "CONVERSIÓN", green: false };
    case "trial_member":
      return { label: "CIERRE", green: false };
    case "cac":
      return { label: "RENTABLE", green: true };
    case "churn":
      return { label: (metric.value ?? 0) <= 5 ? "SALUDABLE" : "RIESGO", green: (metric.value ?? 0) <= 5 };
    case "retention":
      return { label: (metric.value ?? 0) >= 70 ? "RENOVANDO" : "ESPERANDO", green: true };
    case "ltv":
      return { label: "VALOR", green: true };
    default:
      return { label: metric.section, green: false };
  }
}

// ─────────────────────────────────────────────────────────────────────────
// Donut chart helpers
// ─────────────────────────────────────────────────────────────────────────

const DONUT_R = 52;
const DONUT_CX = 74;
const DONUT_CY = 74;
const DONUT_CIRC = 2 * Math.PI * DONUT_R;
const DONUT_GAP = 5; // px gap accounts for round linecaps

export interface DonutSegment {
  dasharray: string;
  dashoffset: string;
  color: string;
  pct: number;
}

export function buildDonutSegments(slices: { value: number; color: string }[]): DonutSegment[] {
  const total = slices.reduce((s, d) => s + d.value, 0);
  if (total === 0) return [];
  let cumulative = 0;
  return slices.map((d) => {
    const fraction = d.value / total;
    const arcLen = Math.max(0, fraction * DONUT_CIRC - DONUT_GAP);
    const dasharray = `${arcLen.toFixed(2)} ${(DONUT_CIRC - arcLen).toFixed(2)}`;
    const dashoffset = (DONUT_CIRC * (1 - cumulative)).toFixed(2);
    cumulative += fraction;
    return { dasharray, dashoffset, color: d.color, pct: Math.round(fraction * 100) };
  });
}
