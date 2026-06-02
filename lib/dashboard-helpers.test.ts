import { describe, it, expect } from "vitest";
import {
  initials,
  fmt,
  last5Months,
  metricDelta,
  formatMetricValue,
  getMetricTag,
  buildDonutSegments,
  getDinoState,
} from "./dashboard-helpers";
import { DashboardMetric } from "../types/dashboard";

describe("dashboard-helpers", () => {
  describe("initials", () => {
    it("extracts initials from full name", () => {
      expect(initials("Valentina Ríos")).toBe("VR");
      expect(initials("Matías Fernández")).toBe("MF");
    });

    it("handles single names", () => {
      expect(initials("Valentina")).toBe("V");
    });

    it("handles multiple names (takes first 2)", () => {
      expect(initials("Juan Carlos María García")).toBe("JC");
    });

    it("returns ? for empty string", () => {
      expect(initials("")).toBe("?");
    });

    it("returns ? for falsy input", () => {
      expect(initials("" as any)).toBe("?");
    });

    it("returns ? for null", () => {
      expect(initials(null as any)).toBe("?");
    });

    it("returns ? for undefined", () => {
      expect(initials(undefined as any)).toBe("?");
    });

    it("handles whitespace-only string", () => {
      expect(initials("   ")).toBe("");
    });

    it("handles single space", () => {
      expect(initials(" ")).toBe("");
    });
  });

  describe("fmt", () => {
    it("formats millions", () => {
      expect(fmt(1_500_000)).toBe("$1.5M");
      expect(fmt(2_000_000)).toBe("$2.0M");
    });

    it("formats thousands", () => {
      expect(fmt(1_500)).toBe("$2k");
      expect(fmt(1_000)).toBe("$1k");
    });

    it("formats small numbers", () => {
      expect(fmt(500)).toBe("$500");
      expect(fmt(0)).toBe("$0");
    });
  });

  describe("last5Months", () => {
    it("returns 5 months", () => {
      const months = last5Months(new Date("2026-05-15"));
      expect(months).toHaveLength(5);
    });

    it("generates correct month keys", () => {
      const months = last5Months(new Date("2026-05-15"));
      expect(months[0].key).toBe("2026-01");
      expect(months[4].key).toBe("2026-05");
    });

    it("generates correct month labels", () => {
      const months = last5Months(new Date("2026-05-15"));
      expect(months[0].label).toBe("Ene");
      expect(months[4].label).toBe("May");
    });

    it("uses current date when no argument provided", () => {
      const months = last5Months();
      expect(months).toHaveLength(5);
      expect(months[4].key).toMatch(/^\d{4}-\d{2}$/);
    });
  });

  describe("metricDelta", () => {
    it("calculates percentage change", () => {
      expect(metricDelta(100, 80)).toBeCloseTo(25);
      expect(metricDelta(50, 100)).toBeCloseTo(-50);
    });

    it("handles zero previous", () => {
      expect(metricDelta(50, 0)).toBe(100);
      expect(metricDelta(0, 0)).toBe(0);
    });

    it("returns null when either is null", () => {
      expect(metricDelta(100, null)).toBeNull();
      expect(metricDelta(null, 100)).toBeNull();
      expect(metricDelta(null, null)).toBeNull();
    });
  });

  describe("formatMetricValue", () => {
    const baseMeta: DashboardMetric = {
      key: "test",
      label: "Test",
      section: "Eficiencia",
      tooltip: "",
      value: null,
      previous: null,
      format: "number",
      accent: "soft",
    };

    it("formats currency values", () => {
      const meta = { ...baseMeta, format: "currency" as const, value: 1500 };
      expect(formatMetricValue(meta)).toBe("$2k");
    });

    it("formats percent values", () => {
      const meta = { ...baseMeta, format: "percent" as const, value: 45.678 };
      expect(formatMetricValue(meta)).toBe("45.7%");
    });

    it("formats months values", () => {
      const meta = { ...baseMeta, format: "months" as const, value: 3.5 };
      expect(formatMetricValue(meta)).toBe("3.5m");
    });

    it("formats number values (integer)", () => {
      const meta = { ...baseMeta, format: "number" as const, value: 42 };
      expect(formatMetricValue(meta)).toBe("42");
    });

    it("formats number values (decimal)", () => {
      const meta = { ...baseMeta, format: "number" as const, value: 42.567 };
      expect(formatMetricValue(meta)).toBe("42.6");
    });

    it("returns — for null values", () => {
      const meta = { ...baseMeta, format: "number" as const, value: null };
      expect(formatMetricValue(meta)).toBe("—");
    });
  });

  describe("getMetricTag", () => {
    const baseMeta: DashboardMetric = {
      key: "test",
      label: "Test",
      section: "Eficiencia",
      tooltip: "",
      value: null,
      previous: null,
      accent: "soft",
      format: "number",
    };

    it("returns CAPTACIÓN for leads", () => {
      const result = getMetricTag({ ...baseMeta, key: "leads", value: 10 });
      expect(result).toEqual({ label: "CAPTACIÓN", green: false });
    });

    it("returns CONVERSIÓN for lead_trial", () => {
      const result = getMetricTag({ ...baseMeta, key: "lead_trial", value: 5 });
      expect(result).toEqual({ label: "CONVERSIÓN", green: false });
    });

    it("returns CIERRE for trial_member", () => {
      const result = getMetricTag({ ...baseMeta, key: "trial_member", value: 3 });
      expect(result).toEqual({ label: "CIERRE", green: false });
    });

    it("returns RENTABLE for cac", () => {
      const result = getMetricTag({ ...baseMeta, key: "cac", value: 500 });
      expect(result).toEqual({ label: "RENTABLE", green: true });
    });

    it("returns SALUDABLE for low churn", () => {
      const result = getMetricTag({ ...baseMeta, key: "churn", value: 3 });
      expect(result).toEqual({ label: "SALUDABLE", green: true });
    });

    it("returns RIESGO for high churn", () => {
      const result = getMetricTag({ ...baseMeta, key: "churn", value: 8 });
      expect(result).toEqual({ label: "RIESGO", green: false });
    });

    it("returns RENOVANDO for high retention", () => {
      const result = getMetricTag({ ...baseMeta, key: "retention", value: 85 });
      expect(result).toEqual({ label: "RENOVANDO", green: true });
    });

    it("returns ESPERANDO for low retention", () => {
      const result = getMetricTag({ ...baseMeta, key: "retention", value: 60 });
      expect(result).toEqual({ label: "ESPERANDO", green: true });
    });

    it("returns VALOR for ltv", () => {
      const result = getMetricTag({ ...baseMeta, key: "ltv", value: 5000 });
      expect(result).toEqual({ label: "VALOR", green: true });
    });

    it("returns section for unknown keys", () => {
      const result = getMetricTag({ ...baseMeta, key: "unknown", value: 100 });
      expect(result).toEqual({ label: "Eficiencia", green: false });
    });
  });

  describe("buildDonutSegments", () => {
    it("builds segments with correct percentages", () => {
      const slices = [
        { value: 50, color: "#FF0000" },
        { value: 50, color: "#00FF00" },
      ];
      const segments = buildDonutSegments(slices);
      expect(segments).toHaveLength(2);
      expect(segments[0].pct).toBe(50);
      expect(segments[1].pct).toBe(50);
    });

    it("calculates dasharray and dashoffset", () => {
      const slices = [{ value: 100, color: "#FF0000" }];
      const segments = buildDonutSegments(slices);
      expect(segments[0].dasharray).toBeDefined();
      expect(segments[0].dashoffset).toBeDefined();
      expect(segments[0].color).toBe("#FF0000");
    });

    it("returns empty array for zero total", () => {
      const segments = buildDonutSegments([]);
      expect(segments).toEqual([]);
    });

    it("handles unequal segments", () => {
      const slices = [
        { value: 70, color: "#FF0000" },
        { value: 20, color: "#00FF00" },
        { value: 10, color: "#0000FF" },
      ];
      const segments = buildDonutSegments(slices);
      expect(segments).toHaveLength(3);
      expect(segments[0].pct).toBe(70);
      expect(segments[1].pct).toBe(20);
      expect(segments[2].pct).toBe(10);
    });
  });

  describe("getDinoState", () => {
    it("returns flaco for 0 completed tasks", () => {
      expect(getDinoState(0)).toBe("flaco");
    });

    it("returns flaco for 1 completed task", () => {
      expect(getDinoState(1)).toBe("flaco");
    });

    it("returns normal for 2-3 completed tasks", () => {
      expect(getDinoState(2)).toBe("normal");
      expect(getDinoState(3)).toBe("normal");
    });

    it("returns jacked for 4 or more completed tasks", () => {
      expect(getDinoState(4)).toBe("jacked");
      expect(getDinoState(5)).toBe("jacked");
      expect(getDinoState(100)).toBe("jacked");
    });

    it("handles edge cases: negative and very high values", () => {
      expect(getDinoState(-5)).toBe("flaco");
      expect(getDinoState(-100)).toBe("flaco");
    });
  });
});
