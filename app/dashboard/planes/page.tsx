"use client";

import { useEffect, useState } from "react";
import { CheckCircle2, Clock, CreditCard, X, Zap } from "lucide-react";
import { supabase } from "@/lib/supabase";
import { getGymSummary } from "@/lib/supabase-relations";
import { FITGROWX_PLANS, formatArs, type FitgrowxPlanDefinition } from "@/lib/fitgrowx-plans";

const fd = "var(--font-inter, 'Inter', sans-serif)";
const fb = "var(--font-inter, 'Inter', sans-serif)";
const t1 = "#1A1D23";
const t2 = "#6B7280";
const t3 = "#9CA3AF";
const ORANGE = "#F97316";

function daysLeft(expiresAt: string | null): number {
  if (!expiresAt) return 15;
  return Math.max(0, Math.ceil((new Date(expiresAt).getTime() - Date.now()) / 86_400_000));
}

function fmtDate(iso: string | null) {
  if (!iso) return "—";
  return new Date(iso).toLocaleDateString("es-AR", { day: "numeric", month: "long", year: "numeric" });
}

function PlanCard({
  plan,
  billing,
  selected,
  current,
  onSelect,
}: {
  plan: FitgrowxPlanDefinition;
  billing: "mensual" | "anual";
  selected: boolean;
  current: boolean;
  onSelect: () => void;
}) {
  const price = billing === "mensual" ? plan.priceMonthly : plan.priceAnnual;

  return (
    <div
      onClick={onSelect}
      style={{
        borderRadius: 16,
        border: selected
          ? "2px solid rgba(249,115,22,0.70)"
          : "1px solid #E5E7EB",
        background: selected ? "rgba(249,115,22,0.03)" : "white",
        padding: "20px 22px",
        cursor: "pointer",
        position: "relative",
        transition: "border-color 0.15s, background 0.15s",
        flex: 1,
        minWidth: 0,
      }}
    >
      {/* Selected indicator */}
      <div style={{
        position: "absolute", top: 14, right: 14,
        width: 20, height: 20, borderRadius: "50%",
        border: selected ? "none" : "2px solid #D1D5DB",
        background: selected ? ORANGE : "transparent",
        display: "flex", alignItems: "center", justifyContent: "center",
        flexShrink: 0,
      }}>
        {selected && <CheckCircle2 size={14} color="white" />}
      </div>

      {/* Badge */}
      {plan.badge && (
        <div style={{ marginBottom: 10 }}>
          <span style={{
            display: "inline-flex", alignItems: "center", gap: 5,
            padding: "3px 10px", borderRadius: 9999,
            background: "rgba(249,115,22,0.08)", border: "1px solid rgba(249,115,22,0.16)",
          }}>
            <Zap size={10} color={ORANGE} />
            <span style={{ font: `700 0.62rem/1 ${fd}`, color: ORANGE, textTransform: "uppercase", letterSpacing: "0.08em" }}>
              {plan.badge}
            </span>
          </span>
        </div>
      )}

      <p style={{ font: `700 1rem/1 ${fd}`, color: t1, marginBottom: 4 }}>{plan.name}</p>
      <p style={{ font: `400 0.75rem/1.4 ${fb}`, color: t2, marginBottom: 14, maxWidth: 260 }}>{plan.description}</p>

      <div style={{ display: "flex", alignItems: "baseline", gap: 4, marginBottom: 4 }}>
        <span style={{ font: `800 1.6rem/1 ${fd}`, color: t1, letterSpacing: "-0.04em" }}>${formatArs(price)}</span>
        <span style={{ font: `400 0.72rem/1 ${fb}`, color: t3 }}>/mes</span>
        {billing === "anual" && (
          <span style={{ marginLeft: 6, padding: "2px 7px", borderRadius: 6, background: "rgba(249,115,22,0.10)", color: ORANGE, font: `700 0.62rem/1 ${fd}` }}>−20%</span>
        )}
      </div>
      {billing === "anual" && (
        <p style={{ font: `400 0.68rem/1 ${fb}`, color: "#16A34A", marginBottom: 12 }}>
          Ahorrás ${formatArs(plan.savings)}/año
        </p>
      )}

      <p style={{ font: `500 0.68rem/1 ${fb}`, color: plan.highlight ? ORANGE : t3, marginBottom: 12 }}>
        {plan.studentLimit}
      </p>

      {current && (
        <p style={{ font: `600 0.7rem/1 ${fd}`, color: "#16A34A" }}>✓ Plan actual</p>
      )}
    </div>
  );
}

export default function PlanesPage() {
  const [trialExpiresAt, setTrialExpiresAt] = useState<string | null>(null);
  const [subscriptionExpiresAt, setSubExpAt] = useState<string | null>(null);
  const [isSubscribed, setIsSubscribed] = useState(false);
  const [currentPlanType, setCurrentPlanType] = useState<string>("crecimiento");
  const [gymId, setGymId] = useState<string | null>(null);
  const [mpLoading, setMpLoading] = useState(false);
  const [mpError, setMpError] = useState<string | null>(null);
  const [checkoutOpen, setCheckoutOpen] = useState(false);
  const [billing, setBilling] = useState<"mensual" | "anual">("anual");
  const [selectedPlanKey, setSelectedPlanKey] = useState<string>("crecimiento");

  useEffect(() => {
    void (async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;
      const { data: profile } = await supabase
        .from("profiles")
        .select("gym_id, gyms(trial_expires_at, is_subscription_active, plan_type, subscription_expires_at)")
        .eq("id", user.id)
        .maybeSingle();
      const gym = getGymSummary(profile?.gyms);
      setTrialExpiresAt(gym?.trial_expires_at ?? null);
      setIsSubscribed(gym?.is_subscription_active ?? false);
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      setSubExpAt((gym as any)?.subscription_expires_at ?? null);
      const pt = gym?.plan_type ?? "crecimiento";
      setCurrentPlanType(pt);
      setSelectedPlanKey(pt);
      setGymId(profile?.gym_id ?? null);
    })();
  }, []);

  const days = daysLeft(trialExpiresAt);
  const trialExpired = trialExpiresAt ? new Date(trialExpiresAt) < new Date() : false;

  const selectedPlan = FITGROWX_PLANS.find((p) => p.key === selectedPlanKey) ?? FITGROWX_PLANS[FITGROWX_PLANS.length - 1];
  const priceDisplay = billing === "mensual" ? selectedPlan.priceMonthly : selectedPlan.priceAnnual;
  const checkoutAmount = billing === "anual" ? selectedPlan.annualTotal : selectedPlan.priceMonthly;

  const handlePay = async () => {
    setMpLoading(true);
    setMpError(null);
    try {
      const res = await fetch("/api/mp/create-preference", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          plan_key: selectedPlan.key,
          plan_label: `FitGrowX ${selectedPlan.name} ${billing}`,
          price_ars: checkoutAmount,
        }),
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

  const openCheckout = (planKey: string) => {
    setSelectedPlanKey(planKey);
    setMpError(null);
    setCheckoutOpen(true);
  };

  return (
    <div style={{ maxWidth: 720, display: "flex", flexDirection: "column", gap: 20 }}>

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
              ? `Plan ${selectedPlan.name} activo`
              : trialExpired ? "Período de prueba vencido"
              : `${days} día${days !== 1 ? "s" : ""} de prueba restante${days !== 1 ? "s" : ""}`}
          </p>
          <p style={{ font: `400 0.78rem/1.4 ${fb}`, color: t2 }}>
            {isSubscribed
              ? subscriptionExpiresAt ? `Válido hasta el ${fmtDate(subscriptionExpiresAt)}` : "Acceso completo activo"
              : trialExpired ? "Elegí un plan para seguir usando el sistema."
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

      {/* Plan selector */}
      <div style={{ background: "white", borderRadius: 20, border: "1px solid #E5E7EB", overflow: "hidden" }}>
        <div style={{ padding: "20px 24px 16px", borderBottom: "1px solid #F3F4F6", display: "flex", alignItems: "center", justifyContent: "space-between", gap: 16, flexWrap: "wrap" }}>
          <div>
            <p style={{ font: `700 0.88rem/1 ${fd}`, color: t1 }}>
              {isSubscribed ? "Tu plan" : "Elegí tu plan"}
            </p>
            {!isSubscribed && (
              <p style={{ font: `400 0.74rem/1 ${fb}`, color: t3, marginTop: 3 }}>
                Podés cambiar después.
              </p>
            )}
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

        <div style={{ padding: "16px 24px 20px", display: "flex", gap: 12, flexWrap: "wrap" }}>
          {FITGROWX_PLANS.map((plan) => (
            <PlanCard
              key={plan.key}
              plan={plan}
              billing={billing}
              selected={selectedPlanKey === plan.key}
              current={isSubscribed && currentPlanType === plan.key}
              onSelect={() => setSelectedPlanKey(plan.key)}
            />
          ))}
        </div>

        {/* CTA footer */}
        {!isSubscribed && (
          <div style={{ padding: "16px 24px", borderTop: "1px solid #F3F4F6", display: "flex", alignItems: "center", justifyContent: "flex-end", gap: 12 }}>
            <p style={{ font: `400 0.75rem/1.4 ${fb}`, color: t3, flex: 1 }}>
              {billing === "anual"
                ? `Pago de $${formatArs(checkoutAmount)} ARS · 20% off ya aplicado.`
                : "Se renueva mensualmente. Cancelás cuando querés."}
            </p>
            <button
              onClick={() => openCheckout(selectedPlanKey)}
              style={{
                padding: "11px 22px", borderRadius: 11, border: "none", cursor: "pointer",
                background: "linear-gradient(180deg,#ff7a1a 0%,#ff6000 58%,#de4f00 100%)",
                color: "white", font: `700 0.85rem/1 ${fd}`,
                boxShadow: "0 6px 20px rgba(255,96,0,0.24)", whiteSpace: "nowrap",
              }}
            >
              {billing === "mensual" ? `Activar ${selectedPlan.name} mensual` : `Activar ${selectedPlan.name} · −20%`}
            </button>
          </div>
        )}

        {/* Upgrade/downgrade if already subscribed */}
        {isSubscribed && selectedPlanKey !== currentPlanType && (
          <div style={{ padding: "16px 24px", borderTop: "1px solid #F3F4F6", display: "flex", alignItems: "center", justifyContent: "flex-end", gap: 12 }}>
            <p style={{ font: `400 0.75rem/1.4 ${fb}`, color: t3, flex: 1 }}>
              Cambio de plan — te generamos un nuevo link de pago.
            </p>
            <button
              onClick={() => openCheckout(selectedPlanKey)}
              style={{
                padding: "11px 22px", borderRadius: 11, border: "none", cursor: "pointer",
                background: ORANGE, color: "white", font: `700 0.85rem/1 ${fd}`,
                boxShadow: "0 6px 20px rgba(255,96,0,0.24)", whiteSpace: "nowrap",
              }}
            >
              Cambiar a {selectedPlan.name}
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
            <h2 style={{ font: `800 1.2rem/1 ${fd}`, color: t1, marginBottom: 4 }}>FitGrowX {selectedPlan.name}</h2>
            <p style={{ font: `400 0.8rem/1.45 ${fb}`, color: t2, marginBottom: 22 }}>
              {billing === "anual"
                ? <>Pago único de <strong>${formatArs(selectedPlan.annualTotal)} ARS</strong>. Descuento del 20% ya aplicado.</>
                : <>Primer cobro de <strong>${formatArs(selectedPlan.priceMonthly)} ARS</strong>. Cancelás cuando querés.</>}
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
                  ${formatArs(checkoutAmount)}
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
