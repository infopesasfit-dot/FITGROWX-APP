"use client";

import { useEffect, useState } from "react";
import { CheckCircle, Clock, CreditCard, Sparkles, X } from "lucide-react";
import { supabase } from "@/lib/supabase";
import { getGymSummary } from "@/lib/supabase-relations";
import { FITGROWX_PLANS } from "@/lib/fitgrowx-plans";

const fd = "var(--font-inter, 'Inter', sans-serif)";
const fb = "var(--font-inter, 'Inter', sans-serif)";
const fm = "var(--font-mono, 'JetBrains Mono', monospace)";
const t1 = "#1A1D23";
const t2 = "#6B7280";
const t3 = "#9CA3AF";
const ORANGE = "#F97316";
const PLAN = FITGROWX_PLANS[0];

function fmt(n: number) {
  return n.toLocaleString("es-AR", { maximumFractionDigits: 0 });
}

function daysLeft(expiresAt: string | null): number {
  if (!expiresAt) return 15;
  const diff = new Date(expiresAt).getTime() - Date.now();
  return Math.max(0, Math.ceil(diff / 86_400_000));
}

export default function PlanesPage() {
  const [trialExpiresAt, setTrialExpiresAt] = useState<string | null>(null);
  const [isSubscribed, setIsSubscribed] = useState(false);
  const [mpLoading, setMpLoading] = useState(false);
  const [mpError, setMpError] = useState<string | null>(null);
  const [payModalOpen, setPayModalOpen] = useState(false);
  const [billing, setBilling] = useState<"mensual" | "anual">("mensual");

  useEffect(() => {
    void (async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;
      const { data: profile } = await supabase
        .from("profiles")
        .select("gyms(trial_expires_at, is_subscription_active, plan_type)")
        .eq("id", user.id)
        .maybeSingle();
      const gym = getGymSummary(profile?.gyms);
      setTrialExpiresAt(gym?.trial_expires_at ?? null);
      setIsSubscribed(gym?.is_subscription_active ?? false);
    })();
  }, []);

  const annualPrice = PLAN.priceAnnual * 12;
  const annualSavings = (PLAN.priceMonthly - PLAN.priceAnnual) * 12;
  const displayPrice = billing === "mensual" ? PLAN.priceMonthly : annualPrice;
  const displayLabel = billing === "mensual" ? "por mes" : `por año · equiv. $${fmt(PLAN.priceAnnual)}/mes`;
  const days = daysLeft(trialExpiresAt);
  const trialExpired = trialExpiresAt ? new Date(trialExpiresAt) < new Date() : false;

  const handleMpPay = async () => {
    setMpLoading(true);
    setMpError(null);
    try {
      const res = await fetch("/api/mp/create-preference", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          plan_key: PLAN.key,
          plan_label: `${PLAN.name} ${billing}`,
          price_ars: displayPrice,
        }),
      });
      const data = await res.json();
      if (data.init_point) {
        window.open(data.init_point, "_blank", "noopener,noreferrer");
        setPayModalOpen(false);
      } else {
        setMpError(data.error ?? "No se pudo generar el link de pago.");
      }
    } catch {
      setMpError("Error de conexión. Intentá de nuevo.");
    } finally {
      setMpLoading(false);
    }
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 24 }}>
      <div>
        <p style={{ font: `500 0.72rem/1 ${fb}`, color: t3, textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: 6 }}>Cuenta</p>
        <h1 style={{ font: `800 2rem/1 ${fd}`, color: t1, letterSpacing: "-0.02em" }}>FitGrowX</h1>
        <p style={{ font: `400 0.875rem/1.4 ${fm}`, color: t2, marginTop: 4 }}>
          Unificá captación, retención, cobros y operación en una sola membresía.
        </p>
      </div>

      <div style={{ display: "flex", alignItems: "center", gap: 12, padding: "14px 20px", background: trialExpired ? "rgba(220,38,38,0.07)" : "rgba(249,115,22,0.07)", border: `1px solid ${trialExpired ? "#DC2626" : ORANGE}25`, borderRadius: 14 }}>
        <div style={{ width: 36, height: 36, borderRadius: 10, background: trialExpired ? "rgba(220,38,38,0.14)" : "rgba(249,115,22,0.14)", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
          {isSubscribed ? <CheckCircle size={17} color={ORANGE} /> : <Clock size={17} color={trialExpired ? "#DC2626" : ORANGE} />}
        </div>
        <div>
          <p style={{ font: `700 0.9rem/1 ${fd}`, color: trialExpired ? "#DC2626" : ORANGE }}>
            {isSubscribed ? "Plan activo" : trialExpired ? "Prueba vencida" : `${days} días de prueba restantes`}
          </p>
          <p style={{ font: `400 0.78rem/1.4 ${fb}`, color: t2, marginTop: 3 }}>
            {isSubscribed
              ? "Tu gimnasio ya tiene acceso completo al sistema."
              : "Probás 15 días gratis. Después activás el plan anual con 20% OFF."}
          </p>
        </div>
      </div>

      {/* Billing toggle — centered, prominent */}
      <div style={{ display: "flex", justifyContent: "center" }}>
        <div style={{ display: "inline-flex", alignItems: "center", gap: 0, padding: 4, borderRadius: 14, background: "#F3F4F6", border: "1px solid #E5E7EB" }}>
          {(["mensual", "anual"] as const).map((b) => (
            <button
              key={b}
              onClick={() => setBilling(b)}
              style={{
                padding: "9px 22px",
                borderRadius: 11,
                border: "none",
                background: billing === b ? "white" : "transparent",
                color: billing === b ? t1 : t2,
                font: `${billing === b ? 700 : 500} 0.875rem/1 ${fd}`,
                cursor: "pointer",
                boxShadow: billing === b ? "0 1px 4px rgba(0,0,0,0.10)" : "none",
                transition: "all 0.15s",
                display: "flex",
                alignItems: "center",
                gap: 7,
              }}
            >
              {b === "mensual" ? "Mensual" : (
                <>
                  Anual
                  <span style={{ padding: "2px 7px", borderRadius: 6, background: "rgba(249,115,22,0.10)", color: ORANGE, font: `700 0.68rem/1 ${fd}` }}>
                    20% OFF
                  </span>
                </>
              )}
            </button>
          ))}
        </div>
      </div>

      {/* Pricing card */}
      <section
        style={{
          position: "relative",
          overflow: "hidden",
          borderRadius: 24,
          border: billing === "anual" ? "1.5px solid rgba(249,115,22,0.30)" : "1.5px solid #E5E7EB",
          background: billing === "anual"
            ? "linear-gradient(145deg, #0D0D12 0%, #13131A 55%, #0A0A0F 100%)"
            : "white",
          padding: "36px 32px",
          boxShadow: billing === "anual" ? "0 20px 48px rgba(0,0,0,0.16)" : "0 4px 24px rgba(0,0,0,0.06)",
          transition: "all 0.25s",
        }}
      >
        {billing === "anual" && (
          <>
            <div style={{ position: "absolute", top: -60, right: -60, width: 240, height: 240, borderRadius: "50%", background: "radial-gradient(circle, rgba(249,115,22,0.18) 0%, transparent 70%)", pointerEvents: "none" }} />
            <div style={{ position: "absolute", inset: 0, opacity: 0.04, pointerEvents: "none", backgroundImage: "radial-gradient(rgba(255,255,255,0.9) 0.7px, transparent 0.7px)", backgroundSize: "8px 8px" }} />
          </>
        )}

        <div style={{ position: "relative", zIndex: 1, display: "grid", gap: 32, gridTemplateColumns: "minmax(0, 1fr) 300px", alignItems: "start" }}>
          {/* Left — plan info + features */}
          <div>
            {billing === "anual" && (
              <div style={{ display: "inline-flex", alignItems: "center", gap: 7, padding: "5px 11px", borderRadius: 9999, background: "rgba(249,115,22,0.12)", border: "1px solid rgba(249,115,22,0.22)", marginBottom: 16 }}>
                <Sparkles size={11} color="#FDBA74" />
                <span style={{ font: `700 0.66rem/1 ${fd}`, color: "#FDBA74", textTransform: "uppercase", letterSpacing: "0.09em" }}>Ahorrás ${fmt(annualSavings)} por año</span>
              </div>
            )}
            <h2 style={{ font: `800 1.75rem/1.05 ${fd}`, color: billing === "anual" ? "white" : t1, letterSpacing: "-0.03em", marginBottom: 8 }}>{PLAN.name}</h2>
            <p style={{ font: `400 0.88rem/1.55 ${fb}`, color: billing === "anual" ? "rgba(255,255,255,0.55)" : t2, maxWidth: 560, marginBottom: 24 }}>
              {PLAN.tagline}
            </p>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(2, minmax(0, 1fr))", gap: 10 }}>
              {PLAN.features.map((feature) => (
                <div key={feature} style={{ display: "flex", alignItems: "flex-start", gap: 9 }}>
                  <div style={{ width: 16, height: 16, borderRadius: "50%", background: billing === "anual" ? "rgba(249,115,22,0.18)" : "rgba(249,115,22,0.10)", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0, marginTop: 1 }}>
                    <div style={{ width: 5, height: 5, borderRadius: "50%", background: ORANGE }} />
                  </div>
                  <span style={{ font: `400 0.8rem/1.45 ${fb}`, color: billing === "anual" ? "rgba(255,255,255,0.58)" : t2 }}>{feature}</span>
                </div>
              ))}
            </div>
          </div>

          {/* Right — price + CTA */}
          <div style={{ borderRadius: 20, background: billing === "anual" ? "rgba(255,255,255,0.05)" : "#F9FAFB", border: billing === "anual" ? "1px solid rgba(255,255,255,0.08)" : "1px solid #E5E7EB", padding: "24px 22px", display: "flex", flexDirection: "column", gap: 20 }}>
            <div>
              <p style={{ font: `500 0.7rem/1 ${fd}`, color: billing === "anual" ? "rgba(255,255,255,0.3)" : t3, textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: 8 }}>
                {billing === "mensual" ? "Precio mensual" : "Precio anual"}
              </p>
              <div style={{ display: "flex", alignItems: "flex-end", gap: 6, marginBottom: 4 }}>
                <p style={{ font: `800 2.8rem/1 ${fd}`, color: billing === "anual" ? "white" : t1, letterSpacing: "-0.04em" }}>
                  ${fmt(billing === "mensual" ? PLAN.priceMonthly : PLAN.priceAnnual)}
                </p>
                <p style={{ font: `500 0.84rem/1 ${fb}`, color: billing === "anual" ? "rgba(255,255,255,0.4)" : t3, marginBottom: 6 }}>/mes</p>
              </div>
              {billing === "anual" && (
                <p style={{ font: `400 0.76rem/1.4 ${fb}`, color: "rgba(255,255,255,0.38)" }}>
                  Facturado como ${fmt(annualPrice)} ARS/año
                </p>
              )}
              {billing === "mensual" && (
                <p style={{ font: `400 0.76rem/1.4 ${fb}`, color: t3 }}>
                  Facturado mensualmente
                </p>
              )}
            </div>

            {billing === "anual" && (
              <div style={{ padding: "12px 14px", borderRadius: 14, background: "rgba(249,115,22,0.10)", border: "1px solid rgba(249,115,22,0.18)" }}>
                <p style={{ font: `400 0.76rem/1.45 ${fb}`, color: "rgba(255,255,255,0.65)" }}>
                  Antes ${fmt(PLAN.priceMonthly)}/mes · ahorrás <strong style={{ color: "#FDBA74" }}>${fmt(annualSavings)} ARS</strong> por año.
                </p>
              </div>
            )}

            <button
              onClick={() => { setPayModalOpen(true); setMpError(null); }}
              style={{
                width: "100%",
                padding: "14px 16px",
                borderRadius: 13,
                border: "none",
                background: "linear-gradient(180deg,#ff7a1a 0%,#ff6000 58%,#de4f00 100%)",
                color: "white",
                font: `800 0.88rem/1 ${fd}`,
                cursor: "pointer",
                boxShadow: "0 8px 24px rgba(255,96,0,0.28)",
              }}
            >
              {billing === "mensual" ? "Activar plan mensual" : "Activar plan anual · 20% OFF"}
            </button>
          </div>
        </div>
      </section>

      {payModalOpen && (
        <div
          onClick={() => { setPayModalOpen(false); setMpError(null); }}
          style={{ position: "fixed", inset: 0, zIndex: 500, background: "rgba(0,0,0,0.52)", backdropFilter: "blur(6px)", display: "flex", alignItems: "center", justifyContent: "center", padding: 24 }}
        >
          <div
            onClick={(event) => event.stopPropagation()}
            style={{ background: "white", borderRadius: 20, padding: "28px 28px 24px", width: "100%", maxWidth: 420, boxShadow: "0 24px 64px rgba(0,0,0,0.2)", position: "relative" }}
          >
            <button onClick={() => { setPayModalOpen(false); setMpError(null); }} style={{ position: "absolute", top: 16, right: 16, background: "none", border: "none", cursor: "pointer", color: t3, display: "flex", alignItems: "center" }}>
              <X size={18} />
            </button>

            <p style={{ font: `400 0.65rem/1 ${fb}`, color: t3, textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: 4 }}>Checkout {billing}</p>
            <h2 style={{ font: `800 1.35rem/1 ${fd}`, color: t1, marginBottom: 2 }}>{PLAN.name}</h2>
            <p style={{ font: `400 0.8rem/1.45 ${fb}`, color: t2, marginBottom: 24 }}>
              {billing === "anual"
                ? <>Vas a pagar <strong>${fmt(annualPrice)} ARS</strong> en un único pago anual. El descuento del 20% ya está aplicado.</>
                : <>Vas a pagar <strong>${fmt(PLAN.priceMonthly)} ARS/mes</strong>. Podés cancelar cuando quieras.</>}
            </p>

            <div style={{ border: "1.5px solid rgba(0,0,0,0.09)", borderRadius: 14, padding: "18px 20px" }}>
              <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 16 }}>
                <div style={{ width: 32, height: 32, borderRadius: 9, background: "rgba(249,115,22,0.08)", display: "flex", alignItems: "center", justifyContent: "center" }}>
                  <CreditCard size={15} color={ORANGE} />
                </div>
                <div style={{ flex: 1 }}>
                  <p style={{ font: `700 0.875rem/1 ${fd}`, color: t1 }}>Mercado Pago</p>
                  <p style={{ font: `400 0.72rem/1 ${fb}`, color: t2 }}>Tarjeta, transferencia o efectivo</p>
                </div>
                <p style={{ font: `800 1.1rem/1 ${fd}`, color: t1 }}>${fmt(displayPrice)} ARS</p>
              </div>
              {mpError && <p style={{ font: `400 0.75rem/1 ${fb}`, color: "#DC2626", marginBottom: 10 }}>{mpError}</p>}
              <button
                onClick={handleMpPay}
                disabled={mpLoading}
                style={{ width: "100%", padding: "12px 0", borderRadius: 10, border: "none", background: mpLoading ? "rgba(249,115,22,0.5)" : ORANGE, color: "white", font: `700 0.875rem/1 ${fd}`, cursor: mpLoading ? "not-allowed" : "pointer", boxShadow: `0 4px 16px ${ORANGE}40` }}
              >
                {mpLoading ? "Generando link..." : "Pagar con Mercado Pago"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
