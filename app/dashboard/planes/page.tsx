"use client";

import { useEffect, useState } from "react";
import { CheckCircle2, Clock, CreditCard, X, Zap } from "lucide-react";
import { supabase } from "@/lib/supabase";
import { getGymSummary } from "@/lib/supabase-relations";
import { FITGROWX_PLANS, formatArs } from "@/lib/fitgrowx-plans";

const fd = "var(--font-inter, 'Inter', sans-serif)";
const fb = "var(--font-inter, 'Inter', sans-serif)";
const t1 = "#1A1D23";
const t2 = "#6B7280";
const t3 = "#9CA3AF";
const ORANGE = "#F97316";
const PLAN = FITGROWX_PLANS[0];

function daysLeft(expiresAt: string | null): number {
  if (!expiresAt) return 15;
  return Math.max(0, Math.ceil((new Date(expiresAt).getTime() - Date.now()) / 86_400_000));
}

function fmtDate(iso: string | null) {
  if (!iso) return "—";
  return new Date(iso).toLocaleDateString("es-AR", { day: "numeric", month: "long", year: "numeric" });
}

export default function PlanesPage() {
  const [trialExpiresAt, setTrialExpiresAt]     = useState<string | null>(null);
  const [subscriptionExpiresAt, setSubExpAt]    = useState<string | null>(null);
  const [isSubscribed, setIsSubscribed]         = useState(false);
  const [mpLoading, setMpLoading]               = useState(false);
  const [mpError, setMpError]                   = useState<string | null>(null);
  const [checkoutOpen, setCheckoutOpen]         = useState(false);
  const [billing, setBilling]                   = useState<"mensual" | "anual">("anual");

  useEffect(() => {
    void (async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;
      const { data: profile } = await supabase
        .from("profiles")
        .select("gyms(trial_expires_at, is_subscription_active, plan_type, subscription_expires_at)")
        .eq("id", user.id)
        .maybeSingle();
      const gym = getGymSummary(profile?.gyms);
      setTrialExpiresAt(gym?.trial_expires_at ?? null);
      setIsSubscribed(gym?.is_subscription_active ?? false);
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      setSubExpAt((gym as any)?.subscription_expires_at ?? null);
    })();
  }, []);

  const days         = daysLeft(trialExpiresAt);
  const trialExpired = trialExpiresAt ? new Date(trialExpiresAt) < new Date() : false;
  const priceDisplay = billing === "mensual" ? PLAN.priceMonthly : PLAN.priceAnnual;
  const annualTotal  = PLAN.priceAnnual * 12;
  const annualSaving = (PLAN.priceMonthly - PLAN.priceAnnual) * 12;

  const handlePay = async () => {
    setMpLoading(true);
    setMpError(null);
    try {
      const amount = billing === "anual" ? annualTotal : PLAN.priceMonthly;
      const res = await fetch("/api/mp/create-preference", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ plan_key: PLAN.key, plan_label: `FitGrowX ${billing}`, price_ars: amount }),
      });
      const data = await res.json();
      if (data.init_point) {
        window.open(data.init_point, "_blank", "noopener,noreferrer");
        setCheckoutOpen(false);
      } else {
        setMpError(data.error ?? "No se pudo generar el link.");
      }
    } catch {
      setMpError("Error de conexión. Intentá de nuevo.");
    } finally {
      setMpLoading(false);
    }
  };

  return (
    <div style={{ maxWidth: 680, display: "flex", flexDirection: "column", gap: 20 }}>

      {/* Header */}
      <div>
        <p style={{ font: `500 0.72rem/1 ${fb}`, color: t3, textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: 6 }}>
          Cuenta
        </p>
        <h1 style={{ font: `800 1.8rem/1 ${fd}`, color: t1, letterSpacing: "-0.03em" }}>
          Tu suscripción
        </h1>
      </div>

      {/* Status card */}
      <div style={{
        display: "flex", alignItems: "center", gap: 14,
        padding: "16px 20px", borderRadius: 16,
        background: isSubscribed ? "rgba(22,163,74,0.06)" : trialExpired ? "rgba(220,38,38,0.06)" : "rgba(249,115,22,0.06)",
        border: `1px solid ${isSubscribed ? "rgba(22,163,74,0.20)" : trialExpired ? "rgba(220,38,38,0.20)" : "rgba(249,115,22,0.20)"}`,
      }}>
        <div style={{
          width: 40, height: 40, borderRadius: 12, flexShrink: 0,
          background: isSubscribed ? "rgba(22,163,74,0.12)" : trialExpired ? "rgba(220,38,38,0.12)" : "rgba(249,115,22,0.12)",
          display: "flex", alignItems: "center", justifyContent: "center",
        }}>
          {isSubscribed
            ? <CheckCircle2 size={18} color="#16A34A" />
            : <Clock size={18} color={trialExpired ? "#DC2626" : ORANGE} />}
        </div>
        <div style={{ flex: 1 }}>
          <p style={{ font: `700 0.9rem/1 ${fd}`, color: isSubscribed ? "#15803D" : trialExpired ? "#DC2626" : "#C2410C", marginBottom: 3 }}>
            {isSubscribed
              ? "Plan activo"
              : trialExpired ? "Período de prueba vencido"
              : `${days} día${days !== 1 ? "s" : ""} de prueba restante${days !== 1 ? "s" : ""}`}
          </p>
          <p style={{ font: `400 0.78rem/1.4 ${fb}`, color: t2 }}>
            {isSubscribed
              ? subscriptionExpiresAt ? `Válido hasta el ${fmtDate(subscriptionExpiresAt)}` : "Acceso completo activo"
              : trialExpired ? "Activá tu plan para seguir usando el sistema."
              : trialExpiresAt ? `Tu prueba vence el ${fmtDate(trialExpiresAt)}.` : ""}
          </p>
        </div>
        {!isSubscribed && (
          <button
            onClick={() => { setCheckoutOpen(true); setMpError(null); }}
            style={{
              padding: "10px 18px", borderRadius: 10, border: "none", cursor: "pointer",
              background: ORANGE, color: "white", font: `700 0.82rem/1 ${fd}`, whiteSpace: "nowrap",
              flexShrink: 0,
            }}
          >
            Activar plan
          </button>
        )}
      </div>

      {/* Plan detail card */}
      <div style={{ background: "white", borderRadius: 20, border: "1px solid #E5E7EB", overflow: "hidden" }}>
        {/* Plan header */}
        <div style={{ padding: "24px 28px 20px", borderBottom: "1px solid #F3F4F6" }}>
          <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 16, flexWrap: "wrap" }}>
            <div>
              <div style={{ display: "inline-flex", alignItems: "center", gap: 6, padding: "3px 10px", borderRadius: 9999, background: "rgba(249,115,22,0.08)", border: "1px solid rgba(249,115,22,0.16)", marginBottom: 10 }}>
                <Zap size={11} color={ORANGE} />
                <span style={{ font: `700 0.65rem/1 ${fd}`, color: ORANGE, textTransform: "uppercase", letterSpacing: "0.08em" }}>
                  Plan único
                </span>
              </div>
              <h2 style={{ font: `800 1.3rem/1 ${fd}`, color: t1, letterSpacing: "-0.03em", marginBottom: 6 }}>
                FitGrowX Crecimiento
              </h2>
              <p style={{ font: `400 0.82rem/1.5 ${fb}`, color: t2, maxWidth: 420 }}>
                {PLAN.tagline}
              </p>
            </div>

            {/* Billing toggle */}
            <div style={{ display: "inline-flex", alignItems: "center", gap: 0, padding: 3, borderRadius: 11, background: "#F3F4F6", border: "1px solid #E5E7EB", flexShrink: 0 }}>
              {(["mensual", "anual"] as const).map((b) => (
                <button key={b} onClick={() => setBilling(b)} style={{
                  padding: "7px 16px", borderRadius: 9, border: "none",
                  background: billing === b ? "white" : "transparent",
                  color: billing === b ? t1 : t3,
                  font: `${billing === b ? 700 : 500} 0.78rem/1 ${fd}`,
                  cursor: "pointer",
                  boxShadow: billing === b ? "0 1px 3px rgba(0,0,0,0.10)" : "none",
                  display: "flex", alignItems: "center", gap: 5,
                }}>
                  {b === "mensual" ? "Mensual" : (
                    <>Anual <span style={{ padding: "1px 5px", borderRadius: 4, background: "rgba(249,115,22,0.10)", color: ORANGE, font: `700 0.62rem/1 ${fd}` }}>−20%</span></>
                  )}
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Price + features */}
        <div style={{ padding: "20px 28px", display: "grid", gridTemplateColumns: "minmax(0,1fr) auto", gap: 24, alignItems: "start" }}>
          {/* Features */}
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(200px, 1fr))", gap: "8px 16px" }}>
            {PLAN.features.map((f) => (
              <div key={f} style={{ display: "flex", alignItems: "flex-start", gap: 8 }}>
                <div style={{ width: 5, height: 5, borderRadius: "50%", background: ORANGE, marginTop: 6, flexShrink: 0 }} />
                <span style={{ font: `400 0.78rem/1.45 ${fb}`, color: t2 }}>{f}</span>
              </div>
            ))}
          </div>

          {/* Price block */}
          <div style={{ textAlign: "right", flexShrink: 0 }}>
            <p style={{ font: `500 0.68rem/1 ${fd}`, color: t3, textTransform: "uppercase", letterSpacing: "0.07em", marginBottom: 6 }}>
              {billing === "mensual" ? "por mes" : "por mes · pago anual"}
            </p>
            <p style={{ font: `800 2rem/1 ${fd}`, color: t1, letterSpacing: "-0.04em" }}>
              ${formatArs(priceDisplay)}
            </p>
            {billing === "anual" && (
              <p style={{ font: `400 0.72rem/1.4 ${fb}`, color: "#16A34A", marginTop: 4 }}>
                Ahorrás ${formatArs(annualSaving)}/año
              </p>
            )}
          </div>
        </div>

        {/* CTA footer */}
        {!isSubscribed && (
          <div style={{ padding: "16px 28px", borderTop: "1px solid #F3F4F6", display: "flex", alignItems: "center", justifyContent: "flex-end", gap: 12 }}>
            <p style={{ font: `400 0.75rem/1.4 ${fb}`, color: t3, flex: 1 }}>
              {billing === "anual"
                ? `Un pago de $${formatArs(annualTotal)} ARS · sin renovación automática.`
                : "Se renueva mensualmente. Cancelá cuando quieras."}
            </p>
            <button
              onClick={() => { setCheckoutOpen(true); setMpError(null); }}
              style={{
                padding: "11px 22px", borderRadius: 11, border: "none", cursor: "pointer",
                background: "linear-gradient(180deg,#ff7a1a 0%,#ff6000 58%,#de4f00 100%)",
                color: "white", font: `700 0.85rem/1 ${fd}`,
                boxShadow: "0 6px 20px rgba(255,96,0,0.24)", whiteSpace: "nowrap",
              }}
            >
              {billing === "mensual" ? "Activar mensual" : "Activar anual · −20%"}
            </button>
          </div>
        )}
      </div>

      {/* Checkout modal */}
      {checkoutOpen && (
        <div
          onClick={() => { setCheckoutOpen(false); setMpError(null); }}
          style={{ position: "fixed", inset: 0, zIndex: 500, background: "rgba(0,0,0,0.48)", backdropFilter: "blur(5px)", display: "flex", alignItems: "center", justifyContent: "center", padding: 24 }}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            style={{ background: "white", borderRadius: 20, padding: "28px 28px 24px", width: "100%", maxWidth: 400, boxShadow: "0 24px 64px rgba(0,0,0,0.18)", position: "relative" }}
          >
            <button onClick={() => { setCheckoutOpen(false); setMpError(null); }} style={{ position: "absolute", top: 14, right: 14, background: "#F3F4F6", border: "none", cursor: "pointer", width: 30, height: 30, borderRadius: 9, display: "flex", alignItems: "center", justifyContent: "center", color: t2 }}>
              <X size={16} />
            </button>

            <p style={{ font: `500 0.68rem/1 ${fb}`, color: t3, textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: 4 }}>
              Checkout · {billing}
            </p>
            <h2 style={{ font: `800 1.2rem/1 ${fd}`, color: t1, marginBottom: 4 }}>FitGrowX Crecimiento</h2>
            <p style={{ font: `400 0.8rem/1.45 ${fb}`, color: t2, marginBottom: 22 }}>
              {billing === "anual"
                ? <>Pago único de <strong>${formatArs(annualTotal)} ARS</strong>. Descuento del 20% ya aplicado.</>
                : <>Primer cobro de <strong>${formatArs(PLAN.priceMonthly)} ARS</strong>. Cancelás cuando quieras.</>}
            </p>

            <div style={{ border: "1px solid #E5E7EB", borderRadius: 14, padding: "16px 18px" }}>
              <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 14 }}>
                <div style={{ width: 32, height: 32, borderRadius: 9, background: "rgba(249,115,22,0.08)", display: "flex", alignItems: "center", justifyContent: "center" }}>
                  <CreditCard size={15} color={ORANGE} />
                </div>
                <div style={{ flex: 1 }}>
                  <p style={{ font: `600 0.84rem/1 ${fd}`, color: t1 }}>Mercado Pago</p>
                  <p style={{ font: `400 0.7rem/1 ${fb}`, color: t3 }}>Tarjeta, transferencia o efectivo</p>
                </div>
                <p style={{ font: `700 1rem/1 ${fd}`, color: t1 }}>
                  ${formatArs(billing === "anual" ? annualTotal : PLAN.priceMonthly)}
                </p>
              </div>
              {mpError && <p style={{ font: `400 0.74rem/1 ${fb}`, color: "#DC2626", marginBottom: 10 }}>{mpError}</p>}
              <button
                onClick={handlePay}
                disabled={mpLoading}
                style={{ width: "100%", padding: "12px 0", borderRadius: 10, border: "none", background: mpLoading ? "#D1D5DB" : ORANGE, color: "white", font: `700 0.875rem/1 ${fd}`, cursor: mpLoading ? "not-allowed" : "pointer" }}
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
