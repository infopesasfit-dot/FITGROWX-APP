"use client";

import { useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import { CheckCircle2, Clock, CreditCard, X, Zap } from "lucide-react";
import { supabase } from "@/lib/supabase";
import { getGymSummary } from "@/lib/supabase-relations";
import { FITGROWX_PLANS, formatArs, type FitgrowxPlanDefinition } from "@/lib/fitgrowx-plans";
import { useIsDesktop } from "@/hooks/useIsDesktop";

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
  isDesktop,
}: {
  plan: FitgrowxPlanDefinition;
  billing: "mensual" | "anual";
  selected: boolean;
  current: boolean;
  onSelect: () => void;
  isDesktop: boolean;
}) {
  const price = billing === "mensual" ? plan.priceMonthly : plan.priceAnnual;

  return (
    <div
      onClick={onSelect}
      style={{
        borderRadius: 18,
        border: selected
          ? "1.5px solid rgba(249,115,22,0.78)"
          : "1px solid #E4E7EC",
        background: selected ? "linear-gradient(180deg, rgba(249,115,22,0.055), #FFFFFF 45%)" : "white",
        padding: isDesktop ? "22px 24px" : "18px 18px",
        cursor: "pointer",
        position: "relative",
        transition: "border-color 0.15s, background 0.15s, box-shadow 0.15s, transform 0.15s",
        boxShadow: selected ? "0 18px 44px rgba(249,115,22,0.12)" : "0 10px 26px rgba(16,24,40,0.045)",
        flex: 1,
        minWidth: 0,
        minHeight: isDesktop ? 360 : "auto",
        display: "flex",
        flexDirection: "column",
      }}
    >
      {/* Selected indicator */}
      <div style={{
        position: "absolute", top: 14, right: 14,
        width: 24, height: 24, borderRadius: "50%",
        border: selected ? "none" : "2px solid #D0D5DD",
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

      <p style={{ font: `850 ${isDesktop ? "1.15rem" : "1rem"}/1 ${fd}`, color: t1, marginBottom: 7, letterSpacing: "-0.025em" }}>{plan.name}</p>
      <p style={{ font: `500 ${isDesktop ? "0.82rem" : "0.76rem"}/1.48 ${fb}`, color: t2, marginBottom: 18, maxWidth: 280 }}>{plan.description}</p>

      <div style={{ display: "flex", alignItems: "baseline", gap: 5, marginBottom: 5, flexWrap: "wrap" }}>
        <span style={{ font: `900 ${isDesktop ? "2rem" : "1.65rem"}/0.95 ${fd}`, color: t1, letterSpacing: "-0.055em" }}>${formatArs(price)}</span>
        <span style={{ font: `600 ${isDesktop ? "0.78rem" : "0.72rem"}/1 ${fb}`, color: t3 }}>/mes</span>
        {billing === "anual" && (
          <span style={{ marginLeft: 4, padding: "4px 8px", borderRadius: 8, background: "rgba(249,115,22,0.10)", color: ORANGE, font: `800 0.64rem/1 ${fd}` }}>2 meses gratis</span>
        )}
      </div>
      {billing === "anual" && (
        <p style={{ font: `400 0.68rem/1 ${fb}`, color: "#16A34A", marginBottom: 12 }}>
          Plan anual · 2 meses gratis · ahorrás ${formatArs(plan.savings)}
        </p>
      )}

      <p style={{ font: `800 0.72rem/1 ${fb}`, color: plan.highlight ? ORANGE : t3, marginBottom: 16 }}>
        {plan.studentLimit}
      </p>

      <div style={{ display: "flex", flexDirection: "column", gap: 8, marginTop: "auto", paddingTop: 6 }}>
        {plan.features.slice(0, 4).map((feature) => (
          <div key={feature} style={{ display: "flex", gap: 8, alignItems: "flex-start" }}>
            <CheckCircle2 size={14} color={plan.highlight ? ORANGE : "#16A34A"} style={{ flexShrink: 0, marginTop: 1 }} />
            <span style={{ font: `500 0.74rem/1.35 ${fb}`, color: "#667085" }}>{feature}</span>
          </div>
        ))}
      </div>

      {current && (
        <p style={{ font: `700 0.74rem/1 ${fd}`, color: "#16A34A", marginTop: 14 }}>Plan actual</p>
      )}
    </div>
  );
}

export default function PlanesPage() {
  const searchParams = useSearchParams();
  const isDesktop = useIsDesktop();
  const [trialExpiresAt, setTrialExpiresAt] = useState<string | null>(null);
  const [subscriptionExpiresAt, setSubExpAt] = useState<string | null>(null);
  const [isSubscribed, setIsSubscribed] = useState(false);
  const [currentPlanType, setCurrentPlanType] = useState<string>("crecimiento");
  const [gymId, setGymId] = useState<string | null>(null);
  const [mpLoading, setMpLoading] = useState(false);
  const [mpError, setMpError] = useState<string | null>(null);
  const [checkoutOpen, setCheckoutOpen] = useState(false);
  const [billing, setBilling] = useState<"mensual" | "anual">(searchParams.get("billing") === "mensual" ? "mensual" : "anual");
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
      const endpoint = billing === "mensual"
        ? "/api/mp/create-subscription"
        : "/api/mp/create-preference";

      const body: any = { plan_key: selectedPlan.key, billing };
      if (billing === "mensual" && gymId) {
        body.gym_id = gymId;
      }

      const res = await fetch(endpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
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
    <div style={{ maxWidth: 1080, display: "flex", flexDirection: "column", gap: isDesktop ? 22 : 16, width: "100%", padding: isDesktop ? "18px 28px 56px" : "16px 14px 44px", boxSizing: "border-box" }}>

      {/* Header */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: isDesktop ? "flex-end" : "flex-start", gap: 18, flexDirection: isDesktop ? "row" : "column" }}>
        <div>
        <p style={{ font: `800 ${isDesktop ? "0.72rem" : "0.68rem"}/1 ${fb}`, color: ORANGE, textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: 9 }}>
          Cuenta
        </p>
        <h1 style={{ font: `900 ${isDesktop ? "2.35rem" : "1.85rem"}/0.98 ${fd}`, color: t1, letterSpacing: "-0.045em" }}>
          Tu suscripción
        </h1>
        </div>
        <p style={{ font: `500 0.88rem/1.5 ${fb}`, color: t2, maxWidth: isDesktop ? 330 : "100%", textAlign: isDesktop ? "right" : "left", margin: 0 }}>
          Elegí el plan que acompaña el tamaño real de tu gimnasio. Podés cambiarlo cuando lo necesites.
        </p>
      </div>

      {/* Status card */}
      <div style={{
        display: "flex", alignItems: isDesktop ? "center" : "flex-start", gap: isDesktop ? 14 : 12, flexDirection: isDesktop ? "row" : "row",
        padding: isDesktop ? "18px 22px" : "14px 16px", borderRadius: 20,
        background: isSubscribed ? "rgba(22,163,74,0.06)" : trialExpired ? "rgba(220,38,38,0.06)" : "rgba(249,115,22,0.06)",
        border: `1px solid ${isSubscribed ? "rgba(22,163,74,0.20)" : trialExpired ? "rgba(220,38,38,0.20)" : "rgba(249,115,22,0.20)"}`,
        flexWrap: isDesktop ? "nowrap" : "wrap",
        boxShadow: "0 14px 34px rgba(16,24,40,0.055)",
      }}>
        <div style={{
          width: isDesktop ? 40 : 36, height: isDesktop ? 40 : 36, borderRadius: 12, flexShrink: 0,
          background: isSubscribed ? "rgba(22,163,74,0.12)" : trialExpired ? "rgba(220,38,38,0.12)" : "rgba(249,115,22,0.12)",
          display: "flex", alignItems: "center", justifyContent: "center",
        }}>
          {isSubscribed
            ? <CheckCircle2 size={isDesktop ? 18 : 16} color="#16A34A" />
            : <Clock size={isDesktop ? 18 : 16} color={trialExpired ? "#DC2626" : ORANGE} />}
        </div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <p style={{ font: `700 ${isDesktop ? "0.9rem" : "0.8rem"}/1 ${fd}`, color: isSubscribed ? "#15803D" : trialExpired ? "#DC2626" : "#C2410C", marginBottom: 3 }}>
            {isSubscribed
              ? `Plan ${selectedPlan.name} activo`
              : trialExpired ? "Período de prueba vencido"
              : `${days} día${days !== 1 ? "s" : ""} de prueba restante${days !== 1 ? "s" : ""}`}
          </p>
          <p style={{ font: `400 ${isDesktop ? "0.78rem" : "0.72rem"}/1.4 ${fb}`, color: t2 }}>
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
              padding: isDesktop ? "12px 20px" : "10px 14px", borderRadius: 13, border: "none", cursor: "pointer",
              background: ORANGE, color: "white", font: `800 ${isDesktop ? "0.84rem" : "0.75rem"}/1 ${fd}`, whiteSpace: "nowrap",
              flexShrink: 0, marginLeft: isDesktop ? 0 : "auto",
              boxShadow: "0 14px 30px rgba(249,115,22,0.22)",
            }}
          >
            Activar plan
          </button>
        )}
      </div>

      {/* Plan selector */}
      <div style={{ background: "white", borderRadius: 24, border: "1px solid #E4E7EC", overflow: "hidden", boxShadow: "0 18px 46px rgba(16,24,40,0.08)" }}>
        <div style={{ padding: isDesktop ? "24px 28px 18px" : "16px 18px 14px", borderBottom: "1px solid #EEF0F3", display: "flex", alignItems: isDesktop ? "center" : "flex-start", justifyContent: "space-between", gap: isDesktop ? 16 : 12, flexWrap: "wrap", flexDirection: isDesktop ? "row" : "column" }}>
          <div>
            <p style={{ font: `850 ${isDesktop ? "1.05rem" : "0.9rem"}/1 ${fd}`, color: t1, letterSpacing: "-0.02em" }}>
              {isSubscribed ? "Tu plan" : "Elegí tu plan"}
            </p>
            {!isSubscribed && (
              <p style={{ font: `500 ${isDesktop ? "0.82rem" : "0.74rem"}/1.4 ${fb}`, color: t3, marginTop: 5 }}>
                Podés cambiar después.
              </p>
            )}
          </div>
          {/* Billing toggle */}
          <div style={{ display: "inline-flex", alignItems: "center", gap: 0, padding: 4, borderRadius: 14, background: "#F2F4F7", border: "1px solid #E4E7EC", flexShrink: 0, alignSelf: isDesktop ? "auto" : "flex-start" }}>
            {(["mensual", "anual"] as const).map((b) => (
              <button key={b} onClick={() => setBilling(b)} style={{
                padding: isDesktop ? "9px 18px" : "7px 12px", borderRadius: 11, border: "none",
                background: billing === b ? "white" : "transparent",
                color: billing === b ? t1 : t3,
                font: `${billing === b ? 850 : 700} ${isDesktop ? "0.82rem" : "0.72rem"}/1 ${fd}`,
                cursor: "pointer",
                boxShadow: billing === b ? "0 8px 18px rgba(16,24,40,0.10)" : "none",
                display: "flex", alignItems: "center", gap: 5,
              }}>
                {b === "mensual" ? "Mensual" : (
                  <>Anual <span style={{ padding: "1px 5px", borderRadius: 4, background: "rgba(249,115,22,0.10)", color: ORANGE, font: `700 ${isDesktop ? "0.62rem" : "0.58rem"}/1 ${fd}` }}>+2 gratis</span></>
                )}
              </button>
            ))}
          </div>
        </div>

        <div style={{ padding: isDesktop ? "24px 28px 28px" : "16px", display: "grid", gridTemplateColumns: isDesktop ? "minmax(0, 1fr) 310px" : "1fr", gap: isDesktop ? 18 : 14, alignItems: "stretch" }}>
          <div style={{ display: "grid", gridTemplateColumns: isDesktop ? `repeat(${FITGROWX_PLANS.length}, minmax(0, 1fr))` : "1fr", gap: isDesktop ? 16 : 12 }}>
            {FITGROWX_PLANS.map((plan) => (
              <PlanCard
                key={plan.key}
                plan={plan}
                billing={billing}
                selected={selectedPlanKey === plan.key}
                current={isSubscribed && currentPlanType === plan.key}
                onSelect={() => setSelectedPlanKey(plan.key)}
                isDesktop={isDesktop}
              />
            ))}
          </div>

          <aside style={{ borderRadius: 20, background: "linear-gradient(180deg,#171A21 0%,#0E1117 100%)", border: "1px solid rgba(255,255,255,0.08)", padding: isDesktop ? "22px" : "18px", color: "white", minHeight: isDesktop ? 360 : "auto", display: "flex", flexDirection: "column", boxShadow: "0 18px 44px rgba(16,24,40,0.18)" }}>
            <p style={{ font: `800 0.7rem/1 ${fd}`, color: ORANGE, letterSpacing: "0.08em", textTransform: "uppercase", marginBottom: 12 }}>Resumen</p>
            <h3 style={{ font: `900 ${isDesktop ? "1.45rem" : "1.2rem"}/1.05 ${fd}`, letterSpacing: "-0.04em", margin: "0 0 10px" }}>
              FitGrowX {selectedPlan.name}
            </h3>
            <p style={{ font: `500 0.82rem/1.5 ${fb}`, color: "#AEB7C4", marginBottom: 20 }}>{selectedPlan.tagline}</p>

            <div style={{ padding: "16px 0", borderTop: "1px solid rgba(255,255,255,0.09)", borderBottom: "1px solid rgba(255,255,255,0.09)", marginBottom: 18 }}>
              <div style={{ display: "flex", alignItems: "baseline", gap: 6, marginBottom: 8 }}>
                <span style={{ font: `900 2rem/1 ${fd}`, letterSpacing: "-0.055em" }}>${formatArs(priceDisplay)}</span>
                <span style={{ font: `600 0.78rem/1 ${fb}`, color: "#8F9BAA" }}>/mes</span>
              </div>
              <p style={{ font: `600 0.78rem/1.45 ${fb}`, color: billing === "anual" ? "#86EFAC" : "#AEB7C4", margin: 0 }}>
                {billing === "anual"
                  ? `Pago anual de $${formatArs(checkoutAmount)} · ahorrás $${formatArs(selectedPlan.savings)}`
                  : "Pago mensual, sin permanencia."}
              </p>
            </div>

            <div style={{ display: "flex", flexDirection: "column", gap: 10, marginBottom: 22 }}>
              {selectedPlan.features.slice(0, 5).map((feature) => (
                <div key={feature} style={{ display: "flex", gap: 9, alignItems: "flex-start" }}>
                  <CheckCircle2 size={15} color={ORANGE} style={{ flexShrink: 0, marginTop: 2 }} />
                  <span style={{ font: `500 0.76rem/1.38 ${fb}`, color: "#D6DEE8" }}>{feature}</span>
                </div>
              ))}
            </div>

            {!isSubscribed && (
              <button
                onClick={() => openCheckout(selectedPlanKey)}
                style={{
                  marginTop: "auto",
                  minHeight: 52,
                  padding: "14px 16px",
                  borderRadius: 15,
                  border: "none",
                  cursor: "pointer",
                  background: "linear-gradient(180deg,#ff8a2a 0%,#f97316 55%,#de4f00 100%)",
                  color: "white",
                  font: `900 0.9rem/1 ${fd}`,
                  boxShadow: "0 16px 34px rgba(249,115,22,0.32)",
                  width: "100%",
                }}
              >
                {billing === "mensual" ? `Activar ${selectedPlan.name} mensual` : "Activar plan anual"}
              </button>
            )}
          </aside>
        </div>

        {/* CTA footer */}
        {!isSubscribed && (
          <div style={{ padding: isDesktop ? "16px 28px" : "14px 16px", borderTop: "1px solid #EEF0F3", background: "#FBFCFD" }}>
            <p style={{ font: `600 ${isDesktop ? "0.82rem" : "0.72rem"}/1.45 ${fb}`, color: t2, margin: 0 }}>
              {billing === "anual"
                ? `Pago único de $${formatArs(checkoutAmount)} ARS · 2 meses gratis.`
                : "Se renueva mensualmente. Cancelás cuando querés."}
            </p>
          </div>
        )}

        {/* Upgrade/downgrade if already subscribed */}
        {isSubscribed && selectedPlanKey !== currentPlanType && (
          <div style={{ padding: isDesktop ? "16px 24px" : "14px 16px", borderTop: "1px solid #F3F4F6", display: "flex", alignItems: isDesktop ? "center" : "flex-start", justifyContent: "flex-end", gap: isDesktop ? 12 : 10, flexDirection: isDesktop ? "row" : "column", flexWrap: isDesktop ? "nowrap" : "wrap" }}>
            <p style={{ font: `400 ${isDesktop ? "0.75rem" : "0.72rem"}/1.4 ${fb}`, color: t3, flex: isDesktop ? 1 : "none", order: isDesktop ? 1 : 2 }}>
              Cambio de plan — te generamos un nuevo link de pago.
            </p>
            <button
              onClick={() => openCheckout(selectedPlanKey)}
              style={{
                padding: isDesktop ? "11px 22px" : "10px 16px", borderRadius: 11, border: "none", cursor: "pointer",
                background: ORANGE, color: "white", font: `700 ${isDesktop ? "0.85rem" : "0.78rem"}/1 ${fd}`,
                boxShadow: "0 6px 20px rgba(255,96,0,0.24)", whiteSpace: isDesktop ? "nowrap" : "normal",
                width: isDesktop ? "auto" : "100%", order: isDesktop ? 2 : 1, flexShrink: 0,
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
          style={{ position: "fixed", inset: 0, zIndex: 500, background: "rgba(0,0,0,0.48)", backdropFilter: "blur(5px)", display: "flex", alignItems: "center", justifyContent: "center", padding: isDesktop ? 24 : 16 }}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            style={{ background: "white", borderRadius: isDesktop ? 20 : 16, padding: isDesktop ? "28px 28px 24px" : "20px 16px 18px", width: "100%", maxWidth: 400, boxShadow: "0 24px 64px rgba(0,0,0,0.18)", position: "relative" }}
          >
            <button onClick={() => { setCheckoutOpen(false); setMpError(null); }} style={{ position: "absolute", top: isDesktop ? 14 : 12, right: isDesktop ? 14 : 12, background: "#F3F4F6", border: "none", cursor: "pointer", width: 30, height: 30, borderRadius: 9, display: "flex", alignItems: "center", justifyContent: "center", color: t2 }}>
              <X size={16} />
            </button>

            <p style={{ font: `500 ${isDesktop ? "0.68rem" : "0.64rem"}/1 ${fb}`, color: t3, textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: 4 }}>
              Checkout · {billing === "mensual" ? "Suscripción Mensual" : "Pago Anual"}
            </p>
            <h2 style={{ font: `800 ${isDesktop ? "1.2rem" : "1.1rem"}/1 ${fd}`, color: t1, marginBottom: 4 }}>FitGrowX {selectedPlan.name}</h2>
            <p style={{ font: `400 ${isDesktop ? "0.8rem" : "0.75rem"}/1.45 ${fb}`, color: t2, marginBottom: isDesktop ? 22 : 16 }}>
              {billing === "anual"
                ? <>Pago único de <strong>${formatArs(selectedPlan.annualTotal)} ARS</strong>. 12 meses de acceso · los 2 últimos son nuestro regalo.</>
                : <>Primer cobro de <strong>${formatArs(selectedPlan.priceMonthly)} ARS</strong>. Cancelás cuando querés.</>}
            </p>

            <div style={{ border: "1px solid #E5E7EB", borderRadius: 14, padding: isDesktop ? "16px 18px" : "14px 14px" }}>
              <div style={{ display: "flex", alignItems: isDesktop ? "center" : "flex-start", gap: isDesktop ? 10 : 10, marginBottom: isDesktop ? 14 : 12 }}>
                <div style={{ width: 32, height: 32, borderRadius: 9, background: "rgba(249,115,22,0.08)", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                  <CreditCard size={15} color={ORANGE} />
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <p style={{ font: `600 ${isDesktop ? "0.84rem" : "0.78rem"}/1 ${fd}`, color: t1 }}>Mercado Pago</p>
                  <p style={{ font: `400 ${isDesktop ? "0.7rem" : "0.65rem"}/1 ${fb}`, color: t3 }}>Tarjeta, transferencia o efectivo</p>
                </div>
                <p style={{ font: `700 ${isDesktop ? "1rem" : "0.9rem"}/1 ${fd}`, color: t1, flexShrink: 0, whiteSpace: "nowrap" }}>
                  ${formatArs(checkoutAmount)}
                </p>
              </div>
              {mpError && <p style={{ font: `400 ${isDesktop ? "0.74rem" : "0.7rem"}/1 ${fb}`, color: "#DC2626", marginBottom: 10 }}>{mpError}</p>}
              <button
                onClick={handlePay}
                disabled={mpLoading}
                style={{ width: "100%", padding: isDesktop ? "12px 0" : "11px 0", borderRadius: 10, border: "none", background: mpLoading ? "#D1D5DB" : ORANGE, color: "white", font: `700 ${isDesktop ? "0.875rem" : "0.8rem"}/1 ${fd}`, cursor: mpLoading ? "not-allowed" : "pointer" }}
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
