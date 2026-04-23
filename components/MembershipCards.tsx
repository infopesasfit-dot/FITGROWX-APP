"use client";

import { useEffect, useState } from "react";
import { CreditCard, TrendingUp, Calendar, Sparkles, Star } from "lucide-react";

const fd = "var(--font-nunito, 'Nunito', sans-serif)";
const fb = "var(--font-inter, 'Inter', sans-serif)";
const t1 = "#1A1D23";
const t2 = "#6B7280";
const t3 = "#9CA3AF";

const TIER_META: Record<string, { label: string; color: string; bg: string; icon: React.ReactNode }> = {
  entry: {
    label: "Entrada",
    color: t2,
    bg: "#F0F2F8",
    icon: <CreditCard size={20} color={t2} />,
  },
  growth: {
    label: "Growth",
    color: "#F97316",
    bg: "rgba(249,115,22,0.08)",
    icon: <TrendingUp size={20} color="#F97316" />,
  },
  vip: {
    label: "VIP",
    color: "#4B6BFB",
    bg: "rgba(75,107,251,0.08)",
    icon: <Calendar size={20} color="#4B6BFB" />,
  },
};

export interface EmilioPlan {
  tier: "entry" | "growth" | "vip";
  nombre: string;
  precio: number;
  bonus: string[];
  garantia: string;
  cupos: number;
}

interface Props {
  plans: EmilioPlan[];
  onApply: (plans: EmilioPlan[]) => void;
}

function RetentionBar({ pct, color }: { pct: number; color: string }) {
  const [width, setWidth] = useState(0);
  useEffect(() => { const t = setTimeout(() => setWidth(pct), 120); return () => clearTimeout(t); }, [pct]);
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 8, padding: "8px 0 10px", borderTop: `1px solid rgba(0,0,0,0.05)`, borderBottom: `1px solid rgba(0,0,0,0.05)`, marginBottom: 12 }}>
      <span style={{ font: `500 0.68rem/1 ${fb}`, color: t3, whiteSpace: "nowrap" }}>Retención</span>
      <div style={{ flex: 1, height: 4, background: "rgba(0,0,0,0.07)", borderRadius: 9999, overflow: "hidden" }}>
        <div style={{ height: "100%", width: `${width}%`, background: `linear-gradient(90deg,${color}90,${color})`, borderRadius: 9999, transition: "width 0.8s cubic-bezier(0.34,1.56,0.64,1)" }} />
      </div>
      <span style={{ font: `800 0.75rem/1 ${fd}`, color, minWidth: 30, textAlign: "right" }}>{pct}%</span>
    </div>
  );
}

const RETENTION: Record<string, number> = { entry: 45, growth: 72, vip: 89 };

export default function MembershipCards({ plans, onApply }: Props) {
  const [visible, setVisible] = useState(false);

  // Staggered entrance
  useEffect(() => {
    const t = setTimeout(() => setVisible(true), 60);
    return () => clearTimeout(t);
  }, []);

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
      {/* Insight header */}
      <div style={{ display: "flex", alignItems: "center", gap: 8, padding: "10px 14px", background: "rgba(249,115,22,0.08)", border: "1px solid rgba(249,115,22,0.18)", borderRadius: 12 }}>
        <Sparkles size={14} color="#F97316" />
        <span style={{ font: `600 0.78rem/1.4 ${fb}`, color: "#EA580C" }}>
          3 planes listos — revisalos y aplicá todos de una.
        </span>
      </div>

      {/* Cards grid */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 12 }}>
        {plans.map((plan, i) => {
          const meta = TIER_META[plan.tier] ?? TIER_META.entry;
          const pct = RETENTION[plan.tier] ?? 60;
          const delay = i * 80;

          return (
            <div
              key={plan.tier}
              style={{
                background: "rgba(255,255,255,0.06)",
                border: "1px solid rgba(255,255,255,0.10)",
                borderRadius: 14,
                padding: "16px",
                display: "flex",
                flexDirection: "column",
                opacity: visible ? 1 : 0,
                transform: visible ? "translateY(0)" : "translateY(12px)",
                transition: `opacity 0.4s ease ${delay}ms, transform 0.4s cubic-bezier(0.34,1.56,0.64,1) ${delay}ms`,
              }}
            >
              {/* Tier badge + icon */}
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 12 }}>
                <div style={{ width: 34, height: 34, borderRadius: 9, background: meta.bg, display: "flex", alignItems: "center", justifyContent: "center" }}>
                  {meta.icon}
                </div>
                <span style={{ font: `700 0.62rem/1 ${fb}`, color: meta.color, textTransform: "uppercase", letterSpacing: "0.08em", background: `${meta.color}18`, padding: "3px 8px", borderRadius: 9999 }}>
                  {meta.label}
                </span>
              </div>

              {/* Name + price */}
              <p style={{ font: `700 0.85rem/1.3 ${fd}`, color: "rgba(255,255,255,0.90)", marginBottom: 6 }}>{plan.nombre}</p>
              <p style={{ font: `800 1.4rem/1 ${fd}`, color: meta.color, marginBottom: 12 }}>
                ${plan.precio.toLocaleString("es-AR")}
                <span style={{ font: `400 0.72rem/1 ${fb}`, color: "rgba(255,255,255,0.35)", marginLeft: 3 }}>/mes</span>
              </p>

              <RetentionBar pct={pct} color={meta.color} />

              {/* Bonus list */}
              {plan.bonus.length > 0 && (
                <div style={{ display: "flex", flexDirection: "column", gap: 5, marginBottom: 10 }}>
                  {plan.bonus.map((b, bi) => (
                    <div key={bi} style={{ display: "flex", gap: 6, font: `400 0.75rem/1.4 ${fb}`, color: "rgba(255,255,255,0.65)" }}>
                      <span style={{ color: "#22C55E", flexShrink: 0 }}>✓</span>{b}
                    </div>
                  ))}
                </div>
              )}

              {/* Guarantee + cupos */}
              {plan.garantia && (
                <p style={{ font: `400 0.7rem/1.4 ${fb}`, color: "rgba(255,255,255,0.40)", marginTop: "auto", paddingTop: 8, borderTop: "1px solid rgba(255,255,255,0.06)" }}>
                  🛡️ {plan.garantia}
                  {plan.cupos > 0 && ` · ${plan.cupos} cupos`}
                </p>
              )}
              {!plan.garantia && plan.cupos > 0 && (
                <p style={{ font: `400 0.7rem/1.4 ${fb}`, color: "rgba(255,255,255,0.40)", marginTop: "auto" }}>
                  {plan.cupos} cupos disponibles
                </p>
              )}
            </div>
          );
        })}
      </div>

      {/* Apply CTA */}
      <button
        onClick={() => onApply(plans)}
        style={{
          width: "100%",
          padding: "13px",
          background: "linear-gradient(180deg, #FB923C 0%, #EA580C 100%)",
          color: "white",
          border: "1px solid rgba(255,220,140,0.30)",
          borderRadius: 12,
          font: `700 0.9rem/1 ${fd}`,
          cursor: "pointer",
          boxShadow: "0 6px 20px rgba(249,115,22,0.35)",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          gap: 8,
          transition: "transform 0.15s, box-shadow 0.15s",
        }}
        onMouseEnter={e => { (e.currentTarget as HTMLButtonElement).style.transform = "translateY(-2px)"; (e.currentTarget as HTMLButtonElement).style.boxShadow = "0 10px 28px rgba(249,115,22,0.50)"; }}
        onMouseLeave={e => { (e.currentTarget as HTMLButtonElement).style.transform = "none"; (e.currentTarget as HTMLButtonElement).style.boxShadow = "0 6px 20px rgba(249,115,22,0.35)"; }}
      >
        <Star size={15} fill="white" color="white" />
        Aplicar los 3 planes a mis membresías
      </button>
    </div>
  );
}
