"use client";

import { useState, useEffect } from "react";
import { Zap, CheckCircle, Clock, Copy, Bitcoin, TrendingUp, Star, X, CreditCard } from "lucide-react";
import { supabase } from "@/lib/supabase";

const fd = "var(--font-inter, 'Inter', sans-serif)";
const fb = "var(--font-inter, 'Inter', sans-serif)";
const t1 = "#1A1D23";
const t2 = "#6B7280";
const t3 = "#9CA3AF";
const ORANGE = "#F97316";

// Moneda base de la plataforma — cambiar a "USD" en el futuro si se internacionaliza
const CURRENCY: "ARS" | "USD" = "ARS";

const USDT_ADDR = process.env.NEXT_PUBLIC_FITGROWX_USDT_ADDR ?? "";
const BTC_ADDR  = process.env.NEXT_PUBLIC_FITGROWX_BTC_ADDR  ?? "";

function fmt(n: number) {
  return n.toLocaleString("es-AR", { maximumFractionDigits: 0 });
}

function daysLeft(expiresAt: string | null): number {
  if (!expiresAt) return 15;
  const diff = new Date(expiresAt).getTime() - Date.now();
  return Math.max(0, Math.ceil(diff / 86_400_000));
}

const PLANS = [
  {
    key: "gestion",
    label: "Plan Gestión",
    Icon: Zap,
    priceMonthly: 49000,
    priceAnnual:  39200,
    tagline: "Dejá atrás las planillas. Para siempre.",
    description: "¿Todavía manejás alumnos con Excel y pagos por WhatsApp? Todo centralizado en un solo tablero.",
    highlight: false,
    studentLimit: "Hasta 50 alumnos",
    features: [
      "Hasta 50 alumnos",
      "Membresías con vencimiento automático",
      "Registro y validación de pagos",
      "Egresos y métricas financieras",
      "Escáner QR de asistencia",
      "Integración WhatsApp",
      "Automatizaciones y seguimiento",
    ],
    ctaLabel: "Contratar Gestión",
  },
  {
    key: "crecimiento",
    label: "Plan Crecimiento",
    Icon: TrendingUp,
    priceMonthly: 65000,
    priceAnnual:  52000,
    tagline: "Tu gym capta alumnos solo, mientras vos entrenás.",
    description: "Captación activa 24/7, prospectos gestionados automáticamente y WhatsApp que convierte curiosos en pagantes.",
    highlight: true,
    studentLimit: "Hasta 200 alumnos",
    features: [
      "Hasta 200 alumnos",
      "Todo lo del Plan Gestión",
      "Landing de captación propia",
      "Gestión de prospectos e interesados",
      "Campañas de WhatsApp automáticas",
      "Publicidad integrada",
      "Métricas de conversión",
    ],
    ctaLabel: "Contratar Crecimiento",
  },
  {
    key: "full_marca",
    label: "Plan Full Marca",
    Icon: Star,
    priceMonthly: 85000,
    priceAnnual:  68000,
    tagline: "Tu gym, tu identidad. Ni rastro de FitGrowX.",
    description: "White-label total. Tu logo, tu nombre y tus colores en toda la plataforma. Tus alumnos ven TU marca desde el primer segundo.",
    highlight: false,
    studentLimit: "Alumnos ilimitados",
    features: [
      "Alumnos ilimitados",
      "Todo lo del Plan Crecimiento",
      "Logo y nombre propio en toda la UI",
      "Panel del alumno 100% con tu marca",
      "Sin ninguna mención a FitGrowX",
      "Dominio personalizado propio",
    ],
    ctaLabel: "Contratar Full Marca",
  },
];

type PlanDef = typeof PLANS[number];

interface PayModal {
  plan: PlanDef;
  priceArs: number;
}

export default function PlanesPage() {
  const [trialExpiresAt, setTrialExpiresAt] = useState<string | null>(null);
  const [isSubscribed,   setIsSubscribed]   = useState(false);
  const [currentPlan,    setCurrentPlan]    = useState<string | null>(null);
  const [copiedKey,      setCopiedKey]      = useState<string | null>(null);
  const [annual,         setAnnual]         = useState(false);
  const [payModal,       setPayModal]       = useState<PayModal | null>(null);
  const [mpLoading,      setMpLoading]      = useState(false);
  const [mpError,        setMpError]        = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;
      const { data: profile } = await supabase
        .from("profiles")
        .select("gyms(trial_expires_at, is_subscription_active, plan_type)")
        .eq("id", user.id)
        .maybeSingle();
      const gym = (profile as { gyms?: { trial_expires_at: string | null; is_subscription_active: boolean; plan_type: string | null } | null } | null)?.gyms;
      setTrialExpiresAt(gym?.trial_expires_at ?? null);
      setIsSubscribed(gym?.is_subscription_active ?? false);
      setCurrentPlan(gym?.plan_type ?? null);
    })();
  }, []);

  const days         = daysLeft(trialExpiresAt);
  const trialExpired = trialExpiresAt ? new Date(trialExpiresAt) < new Date() : false;

  const bannerColor = trialExpired ? "#DC2626" : days <= 3 ? "#EA580C" : ORANGE;
  const bannerBg    = trialExpired ? "rgba(220,38,38,0.07)" : "rgba(249,115,22,0.07)";
  const bannerLabel = isSubscribed
    ? `${PLANS.find(p => p.key === currentPlan)?.label ?? "Plan"} activo`
    : trialExpired
      ? "Prueba vencida"
      : days === 1 ? "1 día de prueba restante" : `${days} días de prueba restantes`;

  const copy = (text: string, key: string) => {
    navigator.clipboard.writeText(text);
    setCopiedKey(key);
    setTimeout(() => setCopiedKey(null), 2000);
  };

  const handleMpPay = async () => {
    if (!payModal) return;
    setMpLoading(true);
    setMpError(null);
    try {
      const res = await fetch("/api/mp/create-preference", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ plan_key: payModal.plan.key, plan_label: payModal.plan.label, price_ars: payModal.priceArs }),
      });
      const data = await res.json();
      if (data.init_point) {
        window.open(data.init_point, "_blank");
        setPayModal(null);
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

      {/* Header */}
      <div>
        <p style={{ font: `500 0.72rem/1 ${fb}`, color: t3, textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: 6 }}>Cuenta</p>
        <h1 style={{ font: `800 2rem/1 ${fd}`, color: t1, letterSpacing: "-0.02em" }}>Planes y Suscripción</h1>
        <p style={{ font: `400 0.875rem/1.4 ${fb}`, color: t2, marginTop: 4 }}>
          Elegí el plan que mejor se adapta a tu gimnasio.
        </p>
      </div>

      {/* Trial / status banner */}
      <div style={{ display: "flex", alignItems: "center", gap: 12, padding: "14px 20px", background: bannerBg, border: `1px solid ${bannerColor}25`, borderRadius: 14 }}>
        <div style={{ width: 36, height: 36, borderRadius: 10, background: `${bannerColor}15`, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
          {isSubscribed ? <CheckCircle size={17} color={bannerColor} /> : trialExpired ? <Zap size={17} color={bannerColor} /> : <Clock size={17} color={bannerColor} />}
        </div>
        <div>
          <p style={{ font: `700 0.9rem/1 ${fd}`, color: bannerColor }}>{bannerLabel}</p>
          {!isSubscribed && !trialExpired && trialExpiresAt && (
            <p style={{ font: `400 0.78rem/1 ${fb}`, color: t2, marginTop: 3 }}>
              Prueba gratuita del <strong>Plan Full Marca</strong> · vence el{" "}
              <strong>{new Date(trialExpiresAt).toLocaleDateString("es-AR", { day: "numeric", month: "long" })}</strong>.
            </p>
          )}
          {isSubscribed && (
            <p style={{ font: `400 0.78rem/1 ${fb}`, color: t2, marginTop: 3 }}>Tu suscripción está activa y al día.</p>
          )}
          {trialExpired && (
            <p style={{ font: `400 0.78rem/1 ${fb}`, color: t2, marginTop: 3 }}>Contratá un plan para seguir usando FitGrowX.</p>
          )}
        </div>
      </div>

      {/* Billing toggle */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 14 }}>
        <span style={{ font: `${!annual ? "600" : "400"} 0.85rem/1 ${fd}`, color: !annual ? t1 : t3, transition: "color 0.15s" }}>Mensual</span>
        <button
          onClick={() => setAnnual(a => !a)}
          style={{ position: "relative", width: 48, height: 26, borderRadius: 9999, border: "none", background: annual ? ORANGE : "rgba(0,0,0,0.12)", cursor: "pointer", transition: "background 0.2s", flexShrink: 0, padding: 0 }}
        >
          <div style={{ position: "absolute", top: 3, left: annual ? 25 : 3, width: 20, height: 20, borderRadius: "50%", background: "white", boxShadow: "0 1px 4px rgba(0,0,0,0.25)", transition: "left 0.2s" }} />
        </button>
        <div style={{ display: "flex", alignItems: "center", gap: 7 }}>
          <span style={{ font: `${annual ? "600" : "400"} 0.85rem/1 ${fd}`, color: annual ? t1 : t3, transition: "color 0.15s" }}>Anual</span>
          <span style={{ font: `700 0.65rem/1 ${fd}`, color: annual ? "white" : ORANGE, background: annual ? ORANGE : "rgba(249,115,22,0.1)", border: `1px solid ${annual ? ORANGE : "rgba(249,115,22,0.25)"}`, padding: "3px 8px", borderRadius: 9999, letterSpacing: "0.04em", transition: "all 0.2s" }}>
            AHORRÁ 20%
          </span>
        </div>
      </div>

      {/* Plan cards */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 16 }}>
        {PLANS.map(plan => {
          const isActive = isSubscribed && currentPlan === plan.key;
          const price = annual ? plan.priceAnnual : plan.priceMonthly;
          return (
            <div
              key={plan.key}
              style={{
                background: plan.highlight ? "#1A1D23" : "white",
                border: `2px solid ${plan.highlight ? "#1A1D23" : isActive ? ORANGE : "rgba(0,0,0,0.08)"}`,
                borderRadius: 18,
                padding: "28px 24px 24px",
                display: "flex",
                flexDirection: "column",
                position: "relative",
                boxShadow: plan.highlight ? "0 12px 40px rgba(0,0,0,0.18)" : "0 2px 8px rgba(0,0,0,0.05)",
              }}
            >
              {plan.highlight && (
                <div style={{ position: "absolute", top: -12, left: "50%", transform: "translateX(-50%)", background: ORANGE, color: "white", font: `700 0.62rem/1 ${fd}`, borderRadius: 9999, padding: "4px 12px", whiteSpace: "nowrap", letterSpacing: "0.05em" }}>
                  MÁS ELEGIDO
                </div>
              )}
              {isActive && !plan.highlight && (
                <div style={{ position: "absolute", top: -12, left: "50%", transform: "translateX(-50%)", background: ORANGE, color: "white", font: `700 0.62rem/1 ${fd}`, borderRadius: 9999, padding: "4px 12px", whiteSpace: "nowrap" }}>
                  ACTIVO
                </div>
              )}

              <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 14 }}>
                <div style={{ width: 34, height: 34, borderRadius: 10, background: plan.highlight ? "rgba(255,255,255,0.10)" : "rgba(249,115,22,0.08)", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                  <plan.Icon size={15} color={plan.highlight ? "white" : ORANGE} />
                </div>
                <p style={{ font: `700 0.95rem/1 ${fd}`, color: plan.highlight ? "#FFFFFF" : t1 }}>{plan.label}</p>
              </div>

              <div style={{ display: "flex", alignItems: "baseline", gap: 3, marginBottom: 6 }}>
                <span style={{ font: `800 2.2rem/1 ${fd}`, color: plan.highlight ? "#FFFFFF" : t1, transition: "all 0.2s" }}>${fmt(price)}</span>
                <span style={{ font: `400 0.78rem/1 ${fb}`, color: plan.highlight ? "rgba(255,255,255,0.4)" : t3 }}>{CURRENCY} / {annual ? "mes*" : "mes"}</span>
              </div>
              {annual && (
                <>
                  <p style={{ font: `500 0.78rem/1 ${fb}`, color: plan.highlight ? "rgba(255,255,255,0.55)" : t2, marginBottom: 1, marginTop: -2 }}>
                    Total anual: <strong style={{ color: plan.highlight ? "#FFFFFF" : t1 }}>${fmt(plan.priceAnnual * 12)}</strong> {CURRENCY}
                  </p>
                  <p style={{ font: `400 0.68rem/1 ${fb}`, color: plan.highlight ? "rgba(249,115,22,0.8)" : ORANGE, marginBottom: 2 }}>
                    antes ${fmt(plan.priceMonthly)}/mes · ahorrás ${fmt((plan.priceMonthly - plan.priceAnnual) * 12)}/año
                  </p>
                </>
              )}

              <p style={{ font: `600 0.78rem/1.3 ${fb}`, color: ORANGE, marginBottom: 8 }}>{plan.tagline}</p>
              <p style={{ font: `400 0.76rem/1.55 ${fb}`, color: plan.highlight ? "rgba(255,255,255,0.45)" : t2, marginBottom: 20 }}>{plan.description}</p>

              <div style={{ display: "flex", flexDirection: "column", gap: 9, marginBottom: 24, flex: 1 }}>
                {plan.features.map(f => (
                  <div key={f} style={{ display: "flex", alignItems: "flex-start", gap: 8 }}>
                    <div style={{ width: 5, height: 5, borderRadius: "50%", background: plan.highlight ? "rgba(249,115,22,0.8)" : "rgba(249,115,22,0.5)", flexShrink: 0, marginTop: 6 }} />
                    <span style={{ font: `400 0.80rem/1.4 ${fb}`, color: plan.highlight ? "rgba(255,255,255,0.6)" : t2 }}>{f}</span>
                  </div>
                ))}
              </div>

              <button
                onClick={() => { setPayModal({ plan, priceArs: annual ? plan.priceAnnual * 12 : price }); setMpError(null); }}
                style={{
                  display: "block", width: "100%", textAlign: "center",
                  padding: "12px 0", borderRadius: 10,
                  background: plan.highlight ? ORANGE : "white",
                  color: plan.highlight ? "white" : t1,
                  border: `1.5px solid ${plan.highlight ? ORANGE : "rgba(0,0,0,0.12)"}`,
                  font: `700 0.875rem/1 ${fd}`,
                  cursor: "pointer",
                  boxShadow: plan.highlight ? `0 4px 16px ${ORANGE}40` : "none",
                  transition: "opacity 0.14s",
                }}
                onMouseEnter={e => { e.currentTarget.style.opacity = "0.85"; }}
                onMouseLeave={e => { e.currentTarget.style.opacity = "1"; }}
              >
                {plan.ctaLabel}
              </button>
            </div>
          );
        })}
      </div>

      {annual && (
        <p style={{ font: `400 0.72rem/1 ${fb}`, color: t3, textAlign: "center", marginTop: -8 }}>
          * Precio por mes, facturado anualmente.
        </p>
      )}

      {/* Payment modal */}
      {payModal && (
        <div
          onClick={() => { setPayModal(null); setMpError(null); }}
          style={{ position: "fixed", inset: 0, zIndex: 500, background: "rgba(0,0,0,0.5)", backdropFilter: "blur(6px)", display: "flex", alignItems: "center", justifyContent: "center", padding: 24 }}
        >
          <div
            onClick={e => e.stopPropagation()}
            style={{ background: "white", borderRadius: 20, padding: "28px 28px 24px", width: "100%", maxWidth: 420, boxShadow: "0 24px 64px rgba(0,0,0,0.2)", position: "relative" }}
          >
            <button
              onClick={() => { setPayModal(null); setMpError(null); }}
              style={{ position: "absolute", top: 16, right: 16, background: "none", border: "none", cursor: "pointer", color: t3, display: "flex", alignItems: "center" }}
            >
              <X size={18} />
            </button>

            <p style={{ font: `400 0.65rem/1 ${fb}`, color: t3, textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: 4 }}>Contratar</p>
            <h2 style={{ font: `800 1.35rem/1 ${fd}`, color: t1, marginBottom: 2 }}>{payModal.plan.label}</h2>
            <p style={{ font: `400 0.8rem/1 ${fb}`, color: t2, marginBottom: 24 }}>
              ${fmt(payModal.priceArs)} {CURRENCY} · {annual ? "pago anual único" : "pago mensual"}
            </p>

            {/* Mercado Pago */}
            <div style={{ border: "1.5px solid rgba(0,0,0,0.09)", borderRadius: 14, padding: "18px 20px", marginBottom: (USDT_ADDR || BTC_ADDR) ? 12 : 0 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 16 }}>
                <div style={{ width: 32, height: 32, borderRadius: 9, background: "rgba(249,115,22,0.08)", display: "flex", alignItems: "center", justifyContent: "center" }}>
                  <CreditCard size={15} color={ORANGE} />
                </div>
                <div style={{ flex: 1 }}>
                  <p style={{ font: `700 0.875rem/1 ${fd}`, color: t1 }}>Mercado Pago</p>
                  <p style={{ font: `400 0.72rem/1 ${fb}`, color: t2 }}>Tarjeta, transferencia, efectivo</p>
                </div>
                <p style={{ font: `800 1.1rem/1 ${fd}`, color: t1 }}>${fmt(payModal.priceArs)} ARS</p>
              </div>
              {mpError && (
                <p style={{ font: `400 0.75rem/1 ${fb}`, color: "#DC2626", marginBottom: 10 }}>{mpError}</p>
              )}
              <button
                onClick={handleMpPay}
                disabled={mpLoading}
                style={{ width: "100%", padding: "12px 0", borderRadius: 10, border: "none", background: mpLoading ? "rgba(249,115,22,0.5)" : ORANGE, color: "white", font: `700 0.875rem/1 ${fd}`, cursor: mpLoading ? "not-allowed" : "pointer", boxShadow: `0 4px 16px ${ORANGE}40` }}
              >
                {mpLoading ? "Generando link..." : "Pagar con Mercado Pago"}
              </button>
            </div>

            {/* Crypto */}
            {(USDT_ADDR || BTC_ADDR) && (
              <div style={{ border: "1.5px solid rgba(0,0,0,0.09)", borderRadius: 14, padding: "18px 20px" }}>
                <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 14 }}>
                  <div style={{ width: 32, height: 32, borderRadius: 9, background: "rgba(217,119,6,0.08)", display: "flex", alignItems: "center", justifyContent: "center" }}>
                    <Bitcoin size={15} color="#D97706" />
                  </div>
                  <div style={{ flex: 1 }}>
                    <p style={{ font: `700 0.875rem/1 ${fd}`, color: t1 }}>Crypto</p>
                    <p style={{ font: `400 0.72rem/1 ${fb}`, color: t2 }}>USDT / BTC — precio en USD</p>
                  </div>
                </div>
                {USDT_ADDR && (
                  <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10, padding: "10px 14px", background: "#F9FAFB", borderRadius: 10, border: "1px solid rgba(0,0,0,0.06)", marginBottom: BTC_ADDR ? 8 : 0 }}>
                    <div style={{ minWidth: 0 }}>
                      <p style={{ font: `700 0.68rem/1 ${fb}`, color: ORANGE, marginBottom: 3 }}>USDT TRC-20</p>
                      <p style={{ font: `400 0.68rem/1 ${fb}`, color: t2, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{USDT_ADDR}</p>
                    </div>
                    <button onClick={() => copy(USDT_ADDR, "usdt")} style={{ flexShrink: 0, display: "flex", alignItems: "center", gap: 5, padding: "7px 12px", borderRadius: 8, border: "1px solid rgba(0,0,0,0.10)", background: copiedKey === "usdt" ? "rgba(249,115,22,0.08)" : "white", color: copiedKey === "usdt" ? ORANGE : t2, font: `600 0.68rem/1 ${fb}`, cursor: "pointer" }}>
                      <Copy size={11} />{copiedKey === "usdt" ? "Copiado" : "Copiar"}
                    </button>
                  </div>
                )}
                {BTC_ADDR && (
                  <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10, padding: "10px 14px", background: "#F9FAFB", borderRadius: 10, border: "1px solid rgba(0,0,0,0.06)" }}>
                    <div style={{ minWidth: 0 }}>
                      <p style={{ font: `700 0.68rem/1 ${fb}`, color: "#D97706", marginBottom: 3 }}>Bitcoin</p>
                      <p style={{ font: `400 0.68rem/1 ${fb}`, color: t2, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{BTC_ADDR}</p>
                    </div>
                    <button onClick={() => copy(BTC_ADDR, "btc")} style={{ flexShrink: 0, display: "flex", alignItems: "center", gap: 5, padding: "7px 12px", borderRadius: 8, border: "1px solid rgba(0,0,0,0.10)", background: copiedKey === "btc" ? "rgba(217,119,6,0.08)" : "white", color: copiedKey === "btc" ? "#D97706" : t2, font: `600 0.68rem/1 ${fb}`, cursor: "pointer" }}>
                      <Bitcoin size={11} />{copiedKey === "btc" ? "Copiado" : "Copiar"}
                    </button>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
