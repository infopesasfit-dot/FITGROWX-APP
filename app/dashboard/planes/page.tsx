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
          plan_label: `${PLAN.name} anual`,
          price_ars: annualPrice,
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
        <h1 style={{ font: `800 2rem/1 ${fd}`, color: t1, letterSpacing: "-0.02em" }}>Plan anual FitGrowX</h1>
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

      <section
        style={{
          position: "relative",
          overflow: "hidden",
          borderRadius: 24,
          border: "1px solid rgba(249,115,22,0.14)",
          background: "linear-gradient(145deg, #0D0D12 0%, #13131A 55%, #0A0A0F 100%)",
          padding: "32px 30px",
          boxShadow: "0 20px 48px rgba(0,0,0,0.16)",
        }}
      >
        <div style={{ position: "absolute", top: -40, left: -40, width: 200, height: 200, borderRadius: "50%", background: "radial-gradient(circle, rgba(249,115,22,0.20) 0%, transparent 70%)", pointerEvents: "none" }} />
        <div style={{ position: "absolute", inset: 0, opacity: 0.06, pointerEvents: "none", backgroundImage: "radial-gradient(rgba(255,255,255,0.9) 0.7px, transparent 0.7px)", backgroundSize: "8px 8px" }} />

        <div style={{ position: "relative", zIndex: 1, display: "grid", gap: 24, gridTemplateColumns: "minmax(0, 1.1fr) minmax(280px, 360px)" }}>
          <div>
            <div style={{ display: "inline-flex", alignItems: "center", gap: 7, padding: "6px 12px", borderRadius: 9999, background: "rgba(249,115,22,0.12)", border: "1px solid rgba(249,115,22,0.22)", marginBottom: 18 }}>
              <Sparkles size={12} color="#FDBA74" />
              <span style={{ font: `700 0.68rem/1 ${fd}`, color: "#FDBA74", textTransform: "uppercase", letterSpacing: "0.09em" }}>20% OFF anual</span>
            </div>

            <h2 style={{ font: `800 2rem/1.05 ${fd}`, color: "white", letterSpacing: "-0.03em", marginBottom: 10 }}>{PLAN.name}</h2>
            <p style={{ font: `500 0.92rem/1.5 ${fb}`, color: "rgba(255,255,255,0.7)", maxWidth: 680, marginBottom: 22 }}>
              {PLAN.tagline}
            </p>
            <p style={{ font: `400 0.84rem/1.65 ${fb}`, color: "rgba(255,255,255,0.5)", maxWidth: 720, marginBottom: 24 }}>
              {PLAN.description}
            </p>

            <div style={{ display: "grid", gridTemplateColumns: "repeat(2, minmax(0, 1fr))", gap: 12 }}>
              {PLAN.features.map((feature) => (
                <div key={feature} style={{ display: "flex", alignItems: "flex-start", gap: 9, padding: "12px 14px", borderRadius: 14, background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.06)" }}>
                  <div style={{ width: 7, height: 7, borderRadius: "50%", background: ORANGE, marginTop: 6, flexShrink: 0 }} />
                  <span style={{ font: `400 0.8rem/1.45 ${fb}`, color: "rgba(255,255,255,0.62)" }}>{feature}</span>
                </div>
              ))}
            </div>
          </div>

          <div style={{ borderRadius: 22, background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.08)", padding: "24px 22px", display: "flex", flexDirection: "column", gap: 16 }}>
            <p style={{ font: `600 0.68rem/1 ${fd}`, color: "rgba(255,255,255,0.32)", textTransform: "uppercase", letterSpacing: "0.08em" }}>Precio final</p>
            <div>
              <p style={{ font: `800 2.45rem/1 ${fd}`, color: "white", letterSpacing: "-0.04em", marginBottom: 6 }}>${fmt(annualPrice)}</p>
              <p style={{ font: `500 0.82rem/1 ${fb}`, color: "rgba(255,255,255,0.5)" }}>Pago único anual · equivalente a ${fmt(PLAN.priceAnnual)}/mes</p>
            </div>
            <div style={{ padding: "14px 16px", borderRadius: 16, background: "rgba(249,115,22,0.10)", border: "1px solid rgba(249,115,22,0.18)" }}>
              <p style={{ font: `700 0.8rem/1 ${fd}`, color: "#FDBA74", marginBottom: 5 }}>Ahorro anual</p>
              <p style={{ font: `400 0.78rem/1.45 ${fb}`, color: "rgba(255,255,255,0.7)" }}>
                Antes ${fmt(PLAN.priceMonthly)}/mes. Pagando anual ahorrás ${fmt(annualSavings)} por año.
              </p>
            </div>
            <button
              onClick={() => { setPayModalOpen(true); setMpError(null); }}
              style={{
                width: "100%",
                padding: "14px 16px",
                borderRadius: 14,
                border: "none",
                background: "linear-gradient(180deg,#ff7a1a 0%,#ff6000 58%,#de4f00 100%)",
                color: "white",
                font: `800 0.92rem/1 ${fd}`,
                cursor: "pointer",
                boxShadow: "0 10px 28px rgba(255,96,0,0.28)",
              }}
            >
              Ver pago anual
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

            <p style={{ font: `400 0.65rem/1 ${fb}`, color: t3, textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: 4 }}>Checkout anual</p>
            <h2 style={{ font: `800 1.35rem/1 ${fd}`, color: t1, marginBottom: 2 }}>{PLAN.name}</h2>
            <p style={{ font: `400 0.8rem/1.45 ${fb}`, color: t2, marginBottom: 24 }}>
              Vas a pagar <strong>${fmt(annualPrice)} ARS</strong> en un único pago anual. El descuento del 20% ya está aplicado.
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
                <p style={{ font: `800 1.1rem/1 ${fd}`, color: t1 }}>${fmt(annualPrice)} ARS</p>
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
