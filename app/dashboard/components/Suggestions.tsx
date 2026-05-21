"use client";

import { useState } from "react";
import Link from "next/link";
import { Megaphone, Send, BadgeAlert, Clock, CheckCircle } from "lucide-react";
import { buildSuggestionItems } from "@/lib/dashboard-helpers";
import type { SuggestionItem } from "@/lib/dashboard-helpers";
import { useIsDesktop } from "@/hooks/useIsDesktop";

interface SuggestionsProps {
  setup: { alumnos: boolean; planes: boolean; landing: boolean; whatsapp: boolean; pagos: boolean } | null;
  morososCount: number;
  upcomingExpirations: unknown[];
  loading: boolean;
}

const iconMap: Record<SuggestionItem["key"], React.ReactNode> = {
  landing: <Megaphone size={14} />,
  whatsapp: <Send size={14} />,
  morosos: <BadgeAlert size={14} />,
  expirations: <Clock size={14} />,
  ok: <CheckCircle size={14} />,
};

export function Suggestions({ setup, morososCount, upcomingExpirations, loading }: SuggestionsProps) {
  const [sugerOpen, setSugerOpen] = useState(false);
  const isDesktop = useIsDesktop();

  if (loading) return null;

  const items = buildSuggestionItems(setup, morososCount, upcomingExpirations);
  const hasAlerts = items.some((s) => s.key !== "ok");

  if (isDesktop) {
    return (
      <div className="dashboard-card" style={{ padding: "20px 22px" }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 16 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <span style={{ font: `500 0.76rem/1 var(--font-family-display)`, color: "#6366F1" }}>✦</span>
            <p style={{ font: `700 0.96rem/1 var(--font-family-display)`, color: "var(--color-text-1)" }}>Sugerencias</p>
          </div>
          <span style={{ font: `400 0.72rem/1 var(--font-family-display)`, color: "var(--color-text-3)" }}>basadas en tu data</span>
        </div>
        <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
          {items.map((s, i) => (
            <Link
              key={s.key}
              href={s.href}
              style={{
                display: "flex",
                alignItems: "center",
                gap: 14,
                padding: "12px 14px",
                borderRadius: 12,
                background: "#F9FAFB",
                border: "1px solid rgba(15,17,21,0.06)",
                textDecoration: "none",
                cursor: "pointer",
              }}
            >
              <div
                style={{
                  width: 34,
                  height: 34,
                  borderRadius: 10,
                  background: s.iconBg,
                  color: "var(--color-text-1)",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  flexShrink: 0,
                }}
              >
                {iconMap[s.key]}
              </div>
              <div style={{ flex: 1 }}>
                <p style={{ font: `600 0.84rem/1 var(--font-family-display)`, color: "var(--color-text-1)", marginBottom: 3 }}>{s.title}</p>
                <p style={{ font: `400 0.72rem/1.4 var(--font-family-display)`, color: "var(--color-text-3)" }}>{s.desc}</p>
              </div>
              <span style={{ color: "var(--color-text-3)", fontSize: 14, flexShrink: 0 }}>›</span>
            </Link>
          ))}
        </div>
      </div>
    );
  }

  const isOpen = sugerOpen || hasAlerts;

  return (
    <div className="dashboard-card" style={{ overflow: "hidden" }}>
      <button
        onClick={() => setSugerOpen((v) => !v)}
        style={{
          width: "100%",
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          padding: "14px 16px",
          background: "none",
          border: "none",
          cursor: "pointer",
          textAlign: "left",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <span style={{ font: `500 0.8rem/1 var(--font-family-display)`, color: "#6366F1" }}>✦</span>
          <p style={{ font: `700 0.9rem/1 var(--font-family-display)`, color: "var(--color-text-1)" }}>Sugerencias</p>
          {hasAlerts && (
            <span
              style={{
                font: `700 0.6rem/1 var(--font-family-body)`,
                color: "#DC2626",
                background: "rgba(220,38,38,0.10)",
                border: "1px solid rgba(220,38,38,0.18)",
                borderRadius: 9999,
                padding: "2px 7px",
              }}
            >
              {items.length}
            </span>
          )}
        </div>
        <span
          style={{
            font: `400 1rem/1 var(--font-family-display)`,
            color: "var(--color-text-3)",
            transform: isOpen ? "rotate(180deg)" : "none",
            transition: "transform 0.2s",
          }}
        >
          ⌄
        </span>
      </button>
      {isOpen && (
        <div style={{ display: "flex", flexDirection: "column", gap: 1, borderTop: "1px solid rgba(15,17,21,0.07)" }}>
          {items.map((s, i) => (
            <Link
              key={s.key}
              href={s.href}
              style={{
                display: "flex",
                alignItems: "center",
                gap: 12,
                padding: "12px 16px",
                background: i % 2 === 0 ? "#FAFAFA" : "#FFFFFF",
                textDecoration: "none",
              }}
            >
              <div
                style={{
                  width: 30,
                  height: 30,
                  borderRadius: 9,
                  background: s.iconBg,
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  flexShrink: 0,
                }}
              >
                <span style={{ fontSize: 11, color: "var(--color-text-2)" }}>›</span>
              </div>
              <div style={{ flex: 1 }}>
                <p style={{ font: `600 0.82rem/1 var(--font-family-display)`, color: "var(--color-text-1)", marginBottom: 3 }}>{s.title}</p>
                <p style={{ font: `400 0.7rem/1.4 var(--font-family-display)`, color: "var(--color-text-3)" }}>{s.desc}</p>
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
