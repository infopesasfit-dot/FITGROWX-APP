"use client";

import { useState, useEffect } from "react";
import { CheckCircle, CreditCard, Bitcoin, Clock, Zap, Shield, Copy, ExternalLink, Star, TrendingUp } from "lucide-react";
import { supabase } from "@/lib/supabase";
import { getGymSummary } from "@/lib/supabase-relations";

const fd = "var(--font-inter, 'Inter', sans-serif)";
const fb = "var(--font-inter, 'Inter', sans-serif)";
const t1 = "#1A1D23";
const t2 = "#6B7280";
const t3 = "#9CA3AF";
const ORANGE = "#F97316";

const card: React.CSSProperties = {
  background: "#FFFFFF",
  borderRadius: 14,
  boxShadow: "0 20px 25px -5px rgba(0,0,0,0.05), 0 10px 10px -5px rgba(0,0,0,0.02)",
};

const MP_LINK    = process.env.NEXT_PUBLIC_FITGROWX_MP_LINK    ?? "#";
const USDT_ADDR  = process.env.NEXT_PUBLIC_FITGROWX_USDT_ADDR  ?? "—";
const BTC_ADDR   = process.env.NEXT_PUBLIC_FITGROWX_BTC_ADDR   ?? "—";
const SUPPORT_WA = process.env.NEXT_PUBLIC_FITGROWX_SUPPORT_WA ?? "5491100000000";

function daysLeft(expiresAt: string | null): number {
  if (!expiresAt) return 0;
  const diff = new Date(expiresAt).getTime() - Date.now();
  return Math.max(0, Math.ceil(diff / 86_400_000));
}

const PLANS = [
  {
    key: "gestion" as const,
    name: "Plan Gestión",
    price: "$49",
    period: "USD / mes",
    tagline: "Dejá atrás las planillas. Para siempre.",
    description: "¿Todavía manejás alumnos con Excel y pagos por WhatsApp? Esto termina hoy. Todo centralizado: membresías, cobros, asistencia y automatizaciones en un solo tablero.",
    badge: null,
    Icon: Zap,
    features: [
      "Alumnos ilimitados",
      "Membresías con vencimiento automático",
      "Registro y validación de pagos",
      "Egresos y métricas financieras",
      "Escáner QR de asistencia",
      "Integración WhatsApp",
      "Automatizaciones y seguimiento",
      "Soporte prioritario",
    ],
  },
  {
    key: "crecimiento" as const,
    name: "Plan Crecimiento",
    price: "$65",
    period: "USD / mes",
    tagline: "Tu gym capta alumnos solo, mientras vos entrenás.",
    description: "Captación activa 24/7 con tu landing propia, prospectos gestionados automáticamente y campañas de WhatsApp que convierten curiosos en alumnos pagantes. Sin esfuerzo extra de tu parte.",
    badge: "Más elegido",
    Icon: TrendingUp,
    features: [
      "Todo lo del Plan Gestión",
      "Landing de captación propia",
      "Gestión de prospectos e interesados",
      "Campañas de WhatsApp automáticas",
      "Publicidad integrada",
      "Métricas de conversión",
    ],
  },
  {
    key: "full_marca" as const,
    name: "Plan Full Marca",
    price: "$79",
    period: "USD / mes",
    tagline: "Tu gym, tu identidad. Ni rastro de FitGrowX.",
    description: "White-label total. Tu logo, tu nombre y tus colores en toda la plataforma. Tus alumnos abren la app y ven TU marca desde el primer segundo. La herramienta que proyecta seriedad y profesionalismo antes de que digan una palabra.",
    badge: "15 días gratis",
    Icon: Star,
    features: [
      "Todo lo del Plan Crecimiento",
      "Logo y nombre propio en toda la UI",
      "Panel del alumno 100% con tu marca",
      "Sin ninguna mención a FitGrowX",
      "Dominio personalizado (próximamente)",
    ],
  },
];

type PlanKey = "gestion" | "crecimiento" | "full_marca";

export default function SuscripcionPage() {
  const [trialExpiresAt, setTrialExpiresAt] = useState<string | null>(null);
  const [isSubscribed,   setIsSubscribed]   = useState(false);
  const [currentPlan,    setCurrentPlan]    = useState<string | null>(null);
  const [loading,        setLoading]        = useState(true);
  const [gymId,          setGymId]          = useState<string | null>(null);

  const [selectedPlan, setSelectedPlan] = useState<PlanKey | null>(null);
  const [paymentTab,   setPaymentTab]   = useState<"mp" | "crypto">("mp");
  const [copied,       setCopied]       = useState<string | null>(null);
  const [notified,     setNotified]     = useState(false);
  const [saving,       setSaving]       = useState(false);

  useEffect(() => {
    (async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) { setLoading(false); return; }
      setGymId(user.id);

      const { data: profile } = await supabase
        .from("profiles")
        .select("gym_id, gyms(trial_expires_at, is_subscription_active, plan_type)")
        .eq("id", user.id)
        .maybeSingle();

      const gym = getGymSummary(profile?.gyms);
      setTrialExpiresAt(gym?.trial_expires_at ?? null);
      setIsSubscribed(gym?.is_subscription_active ?? false);
      setCurrentPlan(gym?.plan_type ?? null);
      if (gym?.plan_type) setSelectedPlan(gym.plan_type as PlanKey);
      setLoading(false);
    })();
  }, []);

  const selectPlan = async (key: PlanKey) => {
    setSelectedPlan(key);
    if (!gymId || saving) return;
    setSaving(true);
    await fetch("/api/gym/select-plan", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ gym_id: gymId, plan_type: key }),
    });
    setSaving(false);
  };

  const copy = (text: string, k: string) => {
    navigator.clipboard.writeText(text);
    setCopied(k);
    setTimeout(() => setCopied(null), 2500);
  };

  const handleNotify = () => {
    const planName = PLANS.find(p => p.key === selectedPlan)?.name ?? "Plan";
    const msg = encodeURIComponent(
      `¡Hola! Acabo de realizar el pago de mi suscripción FitGrowX — ${planName}. Por favor, activá mi acceso. Gracias 🙏`
    );
    window.open(`https://wa.me/${SUPPORT_WA}?text=${msg}`, "_blank");
    setNotified(true);
  };

  const days = daysLeft(trialExpiresAt);
  const trialExpired = trialExpiresAt ? new Date(trialExpiresAt) < new Date() : false;

  const daysBadgeBg    = days > 5 ? "rgba(249,115,22,0.08)"  : days > 2 ? "rgba(249,115,22,0.12)"  : "rgba(220,38,38,0.08)";
  const daysBadgeColor = days > 5 ? ORANGE                    : days > 2 ? "#EA580C"                : "#DC2626";
  const daysLabel      = trialExpired ? "Prueba vencida" : days === 1 ? "1 día restante" : `${days} días restantes`;

  const currentPlanData = PLANS.find(p => p.key === currentPlan);

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>

      {/* Header */}
      <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", flexWrap: "wrap", gap: 12 }}>
        <div>
          <p style={{ font: `500 0.72rem/1 ${fb}`, color: t3, textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: 6 }}>Cuenta</p>
          <h1 style={{ font: `800 2rem/1 ${fd}`, color: t1, letterSpacing: "-0.02em" }}>Planes y Suscripción</h1>
          <p style={{ font: `400 0.875rem/1.4 ${fb}`, color: t2, marginTop: 4 }}>
            {loading ? "Cargando..." : isSubscribed ? `${currentPlanData?.name ?? "Plan"} activo.` : "Elegí el plan que mejor se adapte a tu gimnasio."}
          </p>
        </div>

        {!loading && !isSubscribed && (
          <div style={{ display: "flex", alignItems: "center", gap: 7, background: daysBadgeBg, border: `1px solid ${daysBadgeColor}30`, borderRadius: 10, padding: "10px 16px" }}>
            <Clock size={14} color={daysBadgeColor} />
            <div>
              <p style={{ font: `800 1.1rem/1 ${fd}`, color: daysBadgeColor }}>{daysLabel}</p>
              <p style={{ font: `400 0.68rem/1 ${fb}`, color: daysBadgeColor, opacity: 0.8, marginTop: 2 }}>de prueba gratuita — Plan Full Marca</p>
            </div>
          </div>
        )}
        {!loading && isSubscribed && (
          <div style={{ display: "flex", alignItems: "center", gap: 7, background: "rgba(249,115,22,0.08)", border: "1px solid rgba(249,115,22,0.2)", borderRadius: 10, padding: "10px 16px" }}>
            <CheckCircle size={14} color={ORANGE} />
            <p style={{ font: `700 0.85rem/1 ${fd}`, color: ORANGE }}>Suscripción activa</p>
          </div>
        )}
      </div>

      {/* Subscribed: current plan info */}
      {!loading && isSubscribed && (
        <div style={{ ...card, padding: "28px 24px" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 14, marginBottom: 16 }}>
            <div style={{ width: 48, height: 48, borderRadius: 14, background: "#1A1D23", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
              {currentPlanData?.Icon && <currentPlanData.Icon size={20} color={ORANGE} />}
            </div>
            <div>
              <p style={{ font: `700 1rem/1 ${fd}`, color: t1 }}>{currentPlanData?.name ?? "Plan"} — Activo</p>
              <p style={{ font: `400 0.75rem/1 ${fb}`, color: t2, marginTop: 4 }}>{currentPlanData?.tagline}</p>
            </div>
          </div>
          <p style={{ font: `400 0.82rem/1.6 ${fb}`, color: t2 }}>{currentPlanData?.description}</p>
          {currentPlan !== "full_marca" && (
            <div style={{ marginTop: 18, display: "inline-flex", alignItems: "center", gap: 8, padding: "10px 16px", background: "rgba(249,115,22,0.06)", border: "1px solid rgba(249,115,22,0.18)", borderRadius: 12 }}>
              <Star size={13} color={ORANGE} />
              <span style={{ font: `500 0.78rem/1 ${fb}`, color: ORANGE }}>
                Pasá a Full Marca para activar white-label total.{" "}
                <button onClick={() => setIsSubscribed(false)} style={{ background: "none", border: "none", color: ORANGE, fontWeight: 700, cursor: "pointer", padding: 0, font: `inherit` }}>Ver upgrade →</button>
              </span>
            </div>
          )}
        </div>
      )}

      {/* Not subscribed: plan cards + payment */}
      {!loading && !isSubscribed && (
        <>
          {/* Trial banner */}
          <div style={{ ...card, padding: "16px 20px", display: "flex", alignItems: "center", gap: 14, border: "1px solid rgba(0,0,0,0.06)", opacity: 0.7 }}>
            <div style={{ width: 36, height: 36, borderRadius: 10, background: "#F4F5F9", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
              <Clock size={16} color={t3} />
            </div>
            <div style={{ flex: 1 }}>
              <p style={{ font: `600 0.85rem/1 ${fd}`, color: t1 }}>Prueba gratuita — Plan Full Marca</p>
              <p style={{ font: `400 0.72rem/1.4 ${fb}`, color: t2, marginTop: 2 }}>15 días con acceso total y white-label · {trialExpired ? "Vencida" : `${days} días restantes`}</p>
            </div>
            <span style={{ font: `700 0.68rem/1 ${fd}`, color: t3, background: "#F4F5F9", padding: "4px 10px", borderRadius: 9999, flexShrink: 0 }}>Actual</span>
          </div>

          {/* Plan cards */}
          <div>
            <p style={{ font: `700 0.72rem/1 ${fd}`, color: t3, textTransform: "uppercase", letterSpacing: "0.1em", marginBottom: 14 }}>Elegí tu plan</p>
            <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
              {PLANS.map(plan => {
                const active = selectedPlan === plan.key;
                return (
                  <button
                    key={plan.key}
                    onClick={() => selectPlan(plan.key)}
                    style={{
                      background: active ? "#1A1D23" : "#FFFFFF",
                      borderRadius: 16,
                      border: `2px solid ${active ? "#1A1D23" : "rgba(0,0,0,0.08)"}`,
                      padding: "20px 22px",
                      cursor: "pointer",
                      textAlign: "left",
                      boxShadow: active ? "0 12px 32px rgba(0,0,0,0.18)" : "0 2px 8px rgba(0,0,0,0.04)",
                      transition: "all 0.18s",
                      position: "relative",
                      overflow: "hidden",
                      width: "100%",
                    }}
                  >
                    {plan.badge && (
                      <div style={{ position: "absolute", top: 14, right: 14, background: active ? ORANGE : "rgba(249,115,22,0.1)", borderRadius: 9999, padding: "3px 10px", display: "flex", alignItems: "center", gap: 4 }}>
                        <span style={{ font: `700 0.6rem/1 ${fd}`, color: active ? "white" : ORANGE, letterSpacing: "0.04em" }}>{plan.badge}</span>
                      </div>
                    )}
                    <div style={{ display: "flex", alignItems: "flex-start", gap: 14 }}>
                      <div style={{ width: 40, height: 40, borderRadius: 12, background: active ? "rgba(255,255,255,0.10)" : "rgba(249,115,22,0.08)", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                        <plan.Icon size={17} color={active ? "white" : ORANGE} />
                      </div>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ display: "flex", alignItems: "baseline", gap: 8, marginBottom: 2 }}>
                          <p style={{ font: `700 0.95rem/1 ${fd}`, color: active ? "#FFFFFF" : t1 }}>{plan.name}</p>
                          <span style={{ font: `800 1.3rem/1 ${fd}`, color: active ? "#FFFFFF" : t1 }}>{plan.price}</span>
                          <span style={{ font: `400 0.7rem/1 ${fb}`, color: active ? "rgba(255,255,255,0.4)" : t3 }}>{plan.period}</span>
                        </div>
                        <p style={{ font: `600 0.78rem/1.3 ${fb}`, color: active ? "rgba(255,255,255,0.65)" : ORANGE, marginBottom: 8 }}>{plan.tagline}</p>
                        <p style={{ font: `400 0.78rem/1.55 ${fb}`, color: active ? "rgba(255,255,255,0.45)" : t2 }}>{plan.description}</p>
                        <div style={{ display: "flex", flexWrap: "wrap", gap: "5px 12px", marginTop: 12 }}>
                          {plan.features.map(f => (
                            <div key={f} style={{ display: "flex", alignItems: "center", gap: 5 }}>
                              <div style={{ width: 5, height: 5, borderRadius: "50%", background: active ? "rgba(249,115,22,0.7)" : "rgba(249,115,22,0.4)", flexShrink: 0 }} />
                              <span style={{ font: `400 0.72rem/1 ${fb}`, color: active ? "rgba(255,255,255,0.55)" : t2 }}>{f}</span>
                            </div>
                          ))}
                        </div>
                      </div>
                    </div>
                    {active && (
                      <div style={{ marginTop: 14, display: "flex", alignItems: "center", gap: 6, padding: "7px 12px", background: "rgba(255,255,255,0.08)", borderRadius: 10 }}>
                        <CheckCircle size={12} color={ORANGE} />
                        <span style={{ font: `600 0.68rem/1 ${fd}`, color: "rgba(255,255,255,0.6)" }}>Plan seleccionado</span>
                      </div>
                    )}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Payment section */}
          {selectedPlan && (
            <div style={{ ...card, padding: "22px 24px" }}>
              <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 18 }}>
                <div style={{ width: 36, height: 36, borderRadius: 10, background: "#151515", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                  <Zap size={16} color={ORANGE} fill={ORANGE} />
                </div>
                <div>
                  <p style={{ font: `700 0.95rem/1 ${fd}`, color: t1 }}>
                    {PLANS.find(p => p.key === selectedPlan)?.name} — {PLANS.find(p => p.key === selectedPlan)?.price} USD/mes
                  </p>
                  <p style={{ font: `400 0.72rem/1 ${fb}`, color: t2, marginTop: 3 }}>Completá el pago y notificanos.</p>
                </div>
              </div>

              <div style={{ display: "flex", gap: 8, marginBottom: 18 }}>
                {([
                  { key: "mp",     label: "Mercado Pago", icon: <CreditCard size={13} /> },
                  { key: "crypto", label: "Crypto",       icon: <Bitcoin size={13} /> },
                ] as const).map(t => (
                  <button key={t.key} onClick={() => setPaymentTab(t.key)}
                    style={{ flex: 1, display: "flex", alignItems: "center", justifyContent: "center", gap: 6, padding: "10px 14px", borderRadius: 10, border: `1px solid ${paymentTab === t.key ? ORANGE : "rgba(0,0,0,0.10)"}`, background: paymentTab === t.key ? "rgba(249,115,22,0.06)" : "#FAFBFD", color: paymentTab === t.key ? ORANGE : t2, font: `600 0.82rem/1 ${fb}`, cursor: "pointer", transition: "all 0.14s" }}>
                    {t.icon} {t.label}
                  </button>
                ))}
              </div>

              {paymentTab === "mp" && (
                <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
                  <div style={{ padding: "13px 16px", background: "rgba(249,115,22,0.04)", border: "1px solid rgba(249,115,22,0.12)", borderRadius: 11 }}>
                    <p style={{ font: `500 0.8rem/1.5 ${fb}`, color: t2 }}>Hacé clic para ir al link de pago seguro. El proceso tarda menos de 2 minutos.</p>
                  </div>
                  <a href={MP_LINK} target="_blank" rel="noreferrer"
                    style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 8, padding: "13px", borderRadius: 12, background: ORANGE, color: "white", font: `700 0.9rem/1 ${fd}`, textDecoration: "none", boxShadow: "0 4px 14px rgba(249,115,22,0.28)" }}>
                    <ExternalLink size={15} /> Pagar — {PLANS.find(p => p.key === selectedPlan)?.price} USD/mes
                  </a>
                </div>
              )}

              {paymentTab === "crypto" && (
                <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                  <div style={{ padding: "13px 16px", background: "rgba(249,115,22,0.04)", border: "1px solid rgba(249,115,22,0.14)", borderRadius: 11 }}>
                    <p style={{ font: `500 0.8rem/1.5 ${fb}`, color: t2 }}>
                      Enviá exactamente <strong style={{ color: t1 }}>{PLANS.find(p => p.key === selectedPlan)?.price} USDT</strong> (red TRC-20) o su equivalente en BTC.
                    </p>
                  </div>
                  {[
                    { k: "usdt", label: "USDT — TRC-20", value: USDT_ADDR, color: ORANGE },
                    { k: "btc",  label: "BTC — Bitcoin",  value: BTC_ADDR,  color: "#D97706" },
                  ].map(w => (
                    <div key={w.k} style={{ padding: "13px 16px", background: "#FAFBFD", border: "1px solid rgba(0,0,0,0.07)", borderRadius: 11 }}>
                      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 6 }}>
                        <span style={{ font: `700 0.7rem/1 ${fb}`, color: w.color, textTransform: "uppercase", letterSpacing: "0.07em" }}>{w.label}</span>
                        <button onClick={() => copy(w.value, w.k)}
                          style={{ display: "flex", alignItems: "center", gap: 5, padding: "4px 10px", borderRadius: 7, border: "1px solid rgba(0,0,0,0.10)", background: copied === w.k ? `${w.color}15` : "#FFFFFF", color: copied === w.k ? w.color : t2, font: `600 0.68rem/1 ${fb}`, cursor: "pointer" }}>
                          <Copy size={10} /> {copied === w.k ? "¡Copiado!" : "Copiar"}
                        </button>
                      </div>
                      <p style={{ font: `500 0.73rem/1.4 ${fb}`, color: t1, wordBreak: "break-all" }}>{w.value}</p>
                    </div>
                  ))}
                </div>
              )}

              <div style={{ marginTop: 18, padding: "16px", background: "#F4F5F9", borderRadius: 12 }}>
                <div style={{ display: "flex", alignItems: "flex-start", gap: 8, marginBottom: 12 }}>
                  <Shield size={14} color={t3} style={{ flexShrink: 0, marginTop: 1 }} />
                  <p style={{ font: `400 0.78rem/1.5 ${fb}`, color: t2 }}>Una vez confirmado el pago activamos tu cuenta en menos de 24 hs hábiles.</p>
                </div>
                <button onClick={handleNotify} disabled={notified}
                  style={{ width: "100%", display: "flex", alignItems: "center", justifyContent: "center", gap: 7, padding: "11px", borderRadius: 10, border: `1px solid ${ORANGE}30`, background: notified ? "rgba(249,115,22,0.08)" : "#FFFFFF", color: ORANGE, font: `700 0.82rem/1 ${fd}`, cursor: notified ? "default" : "pointer" }}>
                  <CheckCircle size={14} />
                  {notified ? "¡Mensaje enviado! Te contactamos pronto." : "Ya pagué — Notificar al equipo"}
                </button>
              </div>
            </div>
          )}

          {/* Feature comparison */}
          <div style={{ ...card, padding: "22px 24px" }}>
            <p style={{ font: `700 0.72rem/1 ${fd}`, color: t3, textTransform: "uppercase", letterSpacing: "0.1em", marginBottom: 16 }}>Comparativa de planes</p>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 70px 80px 80px", gap: "10px 0", alignItems: "center" }}>
              <div />
              <p style={{ font: `700 0.65rem/1 ${fd}`, color: t2, textAlign: "center" }}>Gestión</p>
              <p style={{ font: `700 0.65rem/1 ${fd}`, color: t2, textAlign: "center" }}>Creci.</p>
              <p style={{ font: `700 0.65rem/1 ${fd}`, color: t2, textAlign: "center" }}>Full Marca</p>
              {[
                ["Alumnos ilimitados",            true,  true,  true ],
                ["Membresías y pagos",             true,  true,  true ],
                ["WhatsApp + Automatizaciones",    true,  true,  true ],
                ["Escáner QR asistencia",          true,  true,  true ],
                ["Landing de captación propia",    false, true,  true ],
                ["Prospectos y campañas",          false, true,  true ],
                ["Logo propio en el panel",        false, false, true ],
                ["App alumno con tu marca",        false, false, true ],
                ["Sin menciones a FitGrowX",       false, false, true ],
              ].map(([label, g, c, f]) => (
                <>
                  <span key={`${label}-label`} style={{ font: `400 0.78rem/1.3 ${fb}`, color: t2, paddingRight: 8 }}>{label as string}</span>
                  {[g, c, f].map((val, i) => (
                    <div key={i} style={{ display: "flex", justifyContent: "center" }}>
                      {val
                        ? <div style={{ width: 18, height: 18, borderRadius: "50%", background: "rgba(249,115,22,0.12)", display: "flex", alignItems: "center", justifyContent: "center" }}><div style={{ width: 7, height: 7, borderRadius: "50%", background: ORANGE }} /></div>
                        : <div style={{ width: 18, height: 18, borderRadius: "50%", background: "#F4F5F9", display: "flex", alignItems: "center", justifyContent: "center" }}><div style={{ width: 7, height: 2, background: "#D1D5DB", borderRadius: 99 }} /></div>
                      }
                    </div>
                  ))}
                </>
              ))}
            </div>
          </div>
        </>
      )}
    </div>
  );
}
