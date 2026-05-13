"use client";

import { useState, useRef } from "react";

const fd = "'Inter', system-ui, sans-serif";
const ORANGE = "#F97316";

const TIERS = [
  { label: "Standard", minGyms: 1,  maxGyms: 9,  pct: 20, color: "#9CA3AF" },
  { label: "Premium",  minGyms: 10, maxGyms: 24, pct: 25, color: "#818CF8" },
  { label: "Franchise",minGyms: 25, maxGyms: 99, pct: 30, color: "#F59E0B" },
];

function calcTier(gyms: number) {
  return [...TIERS].reverse().find(t => gyms >= t.minGyms) ?? TIERS[0];
}

function fmt(n: number) { return n.toLocaleString("es-AR", { maximumFractionDigits: 0 }); }

const STEPS = [
  {
    num: "01",
    icon: "🔗",
    title: "Compartís tu link",
    desc: "Te damos un link único. Cada colega que se registre por ahí queda vinculado a tu cuenta para siempre.",
  },
  {
    num: "02",
    icon: "🚀",
    title: "Tu colega deja el cuaderno",
    desc: "Se registra, conecta su WhatsApp y empieza a cobrar y gestionar su gym en minutos. Vos no hacés nada más.",
  },
  {
    num: "03",
    icon: "💸",
    title: "Cobrás todos los meses",
    desc: "Cada vez que tu colega paga su suscripción, vos recibís tu comisión. Recurrente. De por vida.",
  },
];

const PROOF = [
  { stat: "20%", label: "Comisión mensual base" },
  { stat: "30%", label: "Comisión tier Franquicia" },
  { stat: "De por vida", label: "Mientras el gym use FitGrowX" },
  { stat: "$0", label: "Para empezar" },
];

const EMPTY = { name: "", email: "", whatsapp: "", colleague_count: "", social_links: "", motivation: "" };

export default function ResellerLanding() {
  const [gyms,     setGyms]     = useState(10);
  const [form,     setForm]     = useState(EMPTY);
  const [sending,  setSending]  = useState(false);
  const [sent,     setSent]     = useState(false);
  const [error,    setError]    = useState<string | null>(null);
  const formRef = useRef<HTMLDivElement>(null);

  const tier          = calcTier(gyms);
  const monthly       = Math.round(gyms * 65000 * tier.pct / 100);
  const annual        = monthly * 12;
  const nextTier      = TIERS.find(t => t.minGyms > gyms);
  const gymsToNextTier= nextTier ? nextTier.minGyms - gyms : 0;

  const scrollToForm = () => formRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });

  const handleSubmit = async () => {
    if (!form.name.trim() || !form.email.trim() || !form.whatsapp.trim()) {
      setError("Nombre, email y WhatsApp son obligatorios."); return;
    }
    setSending(true); setError(null);
    const r = await fetch("/api/reseller/apply", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(form),
    });
    const d = await r.json();
    setSending(false);
    if (!r.ok) { setError(d.error ?? "Error al enviar"); return; }
    setSent(true);
  };

  return (
    <div style={{ minHeight: "100svh", background: "#080810", color: "#FFFFFF", fontFamily: fd, overflowX: "hidden" }}>

      <style>{`
        @keyframes fadeUp { from { opacity:0; transform:translateY(18px); } to { opacity:1; transform:translateY(0); } }
        @keyframes pulse  { 0%,100%{opacity:1} 50%{opacity:0.4} }
        * { box-sizing: border-box; }
        input, textarea, select { outline: none; }
        input::placeholder, textarea::placeholder { color: rgba(255,255,255,0.2); }
      `}</style>

      {/* ── NAV ── */}
      <nav style={{ position: "sticky", top: 0, zIndex: 50, background: "rgba(8,8,16,0.85)", backdropFilter: "blur(16px)", borderBottom: "1px solid rgba(255,255,255,0.05)", padding: "0 24px", height: 52, display: "flex", alignItems: "center", justifyContent: "space-between" }}>
        <span style={{ font: `700 0.9rem/1 ${fd}`, color: "#FFFFFF", letterSpacing: "-0.02em" }}>
          FitGrowX <span style={{ color: ORANGE }}>Partners</span>
        </span>
        <button onClick={scrollToForm} style={{ padding: "7px 18px", background: ORANGE, color: "white", border: "none", borderRadius: 9999, font: `700 0.75rem/1 ${fd}`, cursor: "pointer" }}>
          Postularme
        </button>
      </nav>

      {/* ── HERO ── */}
      <section style={{ maxWidth: 780, margin: "0 auto", padding: "80px 24px 64px", textAlign: "center", animation: "fadeUp 0.5s ease" }}>
        {/* Ambient */}
        <div style={{ position: "absolute", top: 0, left: "50%", transform: "translateX(-50%)", width: 600, height: 400, borderRadius: "50%", background: `radial-gradient(circle, ${ORANGE}18 0%, transparent 70%)`, pointerEvents: "none" }} />

        <div style={{ display: "inline-flex", alignItems: "center", gap: 7, padding: "5px 14px", background: "rgba(249,115,22,0.1)", border: "1px solid rgba(249,115,22,0.25)", borderRadius: 9999, marginBottom: 28 }}>
          <span style={{ width: 6, height: 6, borderRadius: "50%", background: ORANGE, animation: "pulse 2s ease-in-out infinite", display: "inline-block" }} />
          <span style={{ font: `600 0.72rem/1 ${fd}`, color: ORANGE, letterSpacing: "0.08em", textTransform: "uppercase" }}>Red de Partners</span>
        </div>

        <h1 style={{ font: `900 clamp(2rem, 5vw, 3.4rem)/1.05 ${fd}`, color: "#FFFFFF", letterSpacing: "-0.04em", marginBottom: 22, maxWidth: 640, margin: "0 auto 22px" }}>
          Ayudá a tus colegas a dejar el cuaderno y{" "}
          <span style={{ color: ORANGE }}>ganá una comisión de por vida</span>
        </h1>

        <p style={{ font: `400 1.05rem/1.65 ${fd}`, color: "rgba(255,255,255,0.45)", maxWidth: 520, margin: "0 auto 36px" }}>
          Recomendás FitGrowX a otros trainers y dueños de gym.
          Ellos digitalizan su negocio. Vos cobrás cada mes que sigan usando el sistema.
        </p>

        <div style={{ display: "flex", gap: 12, justifyContent: "center", flexWrap: "wrap" }}>
          <button onClick={scrollToForm} style={{ padding: "14px 32px", background: `linear-gradient(135deg, ${ORANGE} 0%, #EA580C 100%)`, color: "white", border: "none", borderRadius: 14, font: `700 1rem/1 ${fd}`, cursor: "pointer", boxShadow: `0 8px 28px ${ORANGE}44` }}>
            Quiero postularme →
          </button>
          <a href="#como-funciona" style={{ padding: "14px 24px", background: "rgba(255,255,255,0.06)", color: "rgba(255,255,255,0.7)", border: "1px solid rgba(255,255,255,0.1)", borderRadius: 14, font: `500 1rem/1 ${fd}`, textDecoration: "none" }}>
            Ver cómo funciona
          </a>
        </div>
      </section>

      {/* ── PROOF BAR ── */}
      <section style={{ borderTop: "1px solid rgba(255,255,255,0.05)", borderBottom: "1px solid rgba(255,255,255,0.05)", padding: "20px 24px" }}>
        <div style={{ maxWidth: 780, margin: "0 auto", display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 8 }}>
          {PROOF.map(p => (
            <div key={p.label} style={{ textAlign: "center" }}>
              <p style={{ font: `800 1.4rem/1 ${fd}`, color: ORANGE, letterSpacing: "-0.03em", marginBottom: 4 }}>{p.stat}</p>
              <p style={{ font: `400 0.7rem/1.3 ${fd}`, color: "rgba(255,255,255,0.3)" }}>{p.label}</p>
            </div>
          ))}
        </div>
      </section>

      {/* ── 3 PASOS ── */}
      <section id="como-funciona" style={{ maxWidth: 780, margin: "0 auto", padding: "72px 24px 64px" }}>
        <p style={{ font: `500 0.7rem/1 ${fd}`, color: "rgba(255,255,255,0.3)", letterSpacing: "0.2em", textTransform: "uppercase", textAlign: "center", marginBottom: 12 }}>Cómo funciona</p>
        <h2 style={{ font: `800 2rem/1.1 ${fd}`, color: "#FFFFFF", letterSpacing: "-0.03em", textAlign: "center", marginBottom: 48 }}>
          Tres pasos, cero fricción
        </h2>

        <div style={{ display: "flex", flexDirection: "column", gap: 2 }}>
          {STEPS.map((step, i) => (
            <div key={step.num} style={{ display: "flex", gap: 24, alignItems: "flex-start", padding: "28px 28px", background: "rgba(255,255,255,0.02)", border: "1px solid rgba(255,255,255,0.05)", borderRadius: 20, position: "relative" }}>
              {/* Connector line */}
              {i < STEPS.length - 1 && (
                <div style={{ position: "absolute", left: 52, bottom: -18, width: 1, height: 18, background: "rgba(255,255,255,0.08)" }} />
              )}
              <div style={{ flexShrink: 0, width: 48, height: 48, borderRadius: 14, background: "rgba(249,115,22,0.1)", border: "1px solid rgba(249,115,22,0.2)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 22 }}>
                {step.icon}
              </div>
              <div style={{ flex: 1 }}>
                <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 8 }}>
                  <span style={{ font: `700 0.62rem/1 ${fd}`, color: ORANGE, letterSpacing: "0.15em" }}>{step.num}</span>
                  <h3 style={{ font: `700 1.05rem/1 ${fd}`, color: "#FFFFFF" }}>{step.title}</h3>
                </div>
                <p style={{ font: `400 0.88rem/1.6 ${fd}`, color: "rgba(255,255,255,0.4)" }}>{step.desc}</p>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* ── CALCULADORA ── */}
      <section style={{ background: "rgba(255,255,255,0.02)", borderTop: "1px solid rgba(255,255,255,0.05)", borderBottom: "1px solid rgba(255,255,255,0.05)", padding: "72px 24px 64px" }}>
        <div style={{ maxWidth: 640, margin: "0 auto" }}>
          <p style={{ font: `500 0.7rem/1 ${fd}`, color: "rgba(255,255,255,0.3)", letterSpacing: "0.2em", textTransform: "uppercase", textAlign: "center", marginBottom: 12 }}>Calculá tu ingreso</p>
          <h2 style={{ font: `800 2rem/1.1 ${fd}`, color: "#FFFFFF", letterSpacing: "-0.03em", textAlign: "center", marginBottom: 48 }}>
            ¿Cuántos colegas tenés?
          </h2>

          {/* Slider */}
          <div style={{ marginBottom: 36 }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-end", marginBottom: 10 }}>
              <span style={{ font: `400 0.72rem/1 ${fd}`, color: "rgba(255,255,255,0.3)" }}>1 gym</span>
              <span style={{ font: `800 2rem/1 ${fd}`, color: ORANGE, letterSpacing: "-0.03em" }}>{gyms} gyms</span>
              <span style={{ font: `400 0.72rem/1 ${fd}`, color: "rgba(255,255,255,0.3)" }}>30 gyms</span>
            </div>
            <input
              type="range" min={1} max={30} value={gyms}
              onChange={e => setGyms(Number(e.target.value))}
              style={{ width: "100%", accentColor: ORANGE, height: 4, cursor: "pointer" }}
            />
            <div style={{ display: "flex", gap: 8, marginTop: 16, justifyContent: "center" }}>
              {[5, 10, 20, 30].map(n => (
                <button key={n} onClick={() => setGyms(n)} style={{ padding: "6px 16px", background: gyms === n ? ORANGE : "rgba(255,255,255,0.06)", border: `1px solid ${gyms === n ? ORANGE : "rgba(255,255,255,0.1)"}`, borderRadius: 9999, font: `600 0.75rem/1 ${fd}`, color: gyms === n ? "white" : "rgba(255,255,255,0.4)", cursor: "pointer", transition: "all 0.15s" }}>
                  {n}
                </button>
              ))}
            </div>
          </div>

          {/* Result */}
          <div style={{ background: "rgba(249,115,22,0.06)", border: "1px solid rgba(249,115,22,0.2)", borderRadius: 22, padding: "28px 28px 24px" }}>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 20, marginBottom: 20 }}>
              <div>
                <p style={{ font: `500 0.65rem/1 ${fd}`, color: "rgba(255,255,255,0.3)", letterSpacing: "0.12em", textTransform: "uppercase", marginBottom: 8 }}>Por mes</p>
                <p style={{ font: `900 2.2rem/1 ${fd}`, color: "#FFFFFF", letterSpacing: "-0.04em" }}>${fmt(monthly)}</p>
                <p style={{ font: `400 0.68rem/1 ${fd}`, color: "rgba(255,255,255,0.25)", marginTop: 4 }}>ARS / mes</p>
              </div>
              <div>
                <p style={{ font: `500 0.65rem/1 ${fd}`, color: "rgba(255,255,255,0.3)", letterSpacing: "0.12em", textTransform: "uppercase", marginBottom: 8 }}>Por año</p>
                <p style={{ font: `900 2.2rem/1 ${fd}`, color: ORANGE, letterSpacing: "-0.04em" }}>${fmt(annual)}</p>
                <p style={{ font: `400 0.68rem/1 ${fd}`, color: "rgba(255,255,255,0.25)", marginTop: 4 }}>ARS / año</p>
              </div>
            </div>

            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "12px 14px", background: "rgba(255,255,255,0.03)", borderRadius: 12, border: "1px solid rgba(255,255,255,0.06)" }}>
              <div>
                <p style={{ font: `600 0.78rem/1 ${fd}`, color: "rgba(255,255,255,0.7)" }}>
                  Tier actual: <span style={{ color: tier.color }}>{tier.label}</span> · {tier.pct}% comisión
                </p>
                {nextTier && (
                  <p style={{ font: `400 0.65rem/1 ${fd}`, color: "rgba(255,255,255,0.25)", marginTop: 3 }}>
                    {gymsToNextTier} gym{gymsToNextTier !== 1 ? "s" : ""} más para pasar a {nextTier.label} ({nextTier.pct}%)
                  </p>
                )}
              </div>
              {nextTier && (
                <span style={{ font: `700 0.7rem/1 ${fd}`, color: "#34D399", background: "rgba(52,211,153,0.08)", padding: "4px 10px", borderRadius: 9999 }}>
                  +${fmt(Math.round(gyms * 65000 * (nextTier.pct - tier.pct) / 100))}/mes en {nextTier.label}
                </span>
              )}
            </div>
          </div>

          <p style={{ font: `400 0.68rem/1.5 ${fd}`, color: "rgba(255,255,255,0.2)", textAlign: "center", marginTop: 14 }}>
            Calculado sobre $65.000 ARS/mes por gym. La comisión es recurrente mientras el gym esté activo.
          </p>
        </div>
      </section>

      {/* ── TIERS ── */}
      <section style={{ maxWidth: 780, margin: "0 auto", padding: "72px 24px 64px" }}>
        <h2 style={{ font: `800 1.8rem/1.1 ${fd}`, color: "#FFFFFF", letterSpacing: "-0.03em", textAlign: "center", marginBottom: 12 }}>
          Más gyms, más comisión
        </h2>
        <p style={{ font: `400 0.88rem/1.5 ${fd}`, color: "rgba(255,255,255,0.35)", textAlign: "center", maxWidth: 420, margin: "0 auto 40px" }}>
          Tu comisión sube automáticamente cuando crece tu red. Sin trámites, sin pedidos.
        </p>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 12 }}>
          {TIERS.map(t => (
            <div key={t.label} style={{ background: "rgba(255,255,255,0.03)", border: `1px solid ${t.color}30`, borderRadius: 20, padding: "24px 20px", textAlign: "center" }}>
              <p style={{ font: `800 2.4rem/1 ${fd}`, color: t.color, letterSpacing: "-0.04em", marginBottom: 6 }}>{t.pct}%</p>
              <p style={{ font: `700 0.9rem/1 ${fd}`, color: "#FFFFFF", marginBottom: 6 }}>{t.label}</p>
              <p style={{ font: `400 0.7rem/1.4 ${fd}`, color: "rgba(255,255,255,0.3)" }}>
                {t.minGyms === 1 ? `1 a ${t.maxGyms} gyms` : t.maxGyms === 99 ? `${t.minGyms}+ gyms` : `${t.minGyms} a ${t.maxGyms} gyms`}
              </p>
              <div style={{ marginTop: 14, padding: "8px 0", background: `${t.color}10`, borderRadius: 10 }}>
                <p style={{ font: `600 0.72rem/1 ${fd}`, color: t.color }}>
                  ${fmt(Math.round(t.minGyms * 65000 * t.pct / 100))}/mes con {t.minGyms} gym{t.minGyms !== 1 ? "s" : ""}
                </p>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* ── FORMULARIO ── */}
      <section ref={formRef} style={{ background: "rgba(255,255,255,0.02)", borderTop: "1px solid rgba(255,255,255,0.05)", padding: "72px 24px 80px" }}>
        <div style={{ maxWidth: 520, margin: "0 auto" }}>
          <p style={{ font: `500 0.7rem/1 ${fd}`, color: ORANGE, letterSpacing: "0.2em", textTransform: "uppercase", textAlign: "center", marginBottom: 12 }}>Postulaciones abiertas</p>
          <h2 style={{ font: `800 2rem/1.1 ${fd}`, color: "#FFFFFF", letterSpacing: "-0.03em", textAlign: "center", marginBottom: 10 }}>
            Quiero ser partner
          </h2>
          <p style={{ font: `400 0.88rem/1.5 ${fd}`, color: "rgba(255,255,255,0.35)", textAlign: "center", maxWidth: 380, margin: "0 auto 36px" }}>
            No aceptamos a cualquiera — queremos resellers que realmente conozcan el mundo fitness. Contanos quién sos.
          </p>

          {sent ? (
            <div style={{ textAlign: "center", padding: "40px 24px", background: "rgba(52,211,153,0.06)", border: "1px solid rgba(52,211,153,0.2)", borderRadius: 20 }}>
              <p style={{ fontSize: 48, marginBottom: 16 }}>🙌</p>
              <p style={{ font: `700 1.2rem/1.3 ${fd}`, color: "#FFFFFF", marginBottom: 8 }}>¡Postulación recibida!</p>
              <p style={{ font: `400 0.85rem/1.6 ${fd}`, color: "rgba(255,255,255,0.4)" }}>
                Revisamos tu perfil y te contactamos por WhatsApp en las próximas 48 hs.
              </p>
            </div>
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
              {[
                { label: "Nombre completo *", key: "name", placeholder: "Ej: Martín Rodríguez", type: "text" },
                { label: "Email *",            key: "email", placeholder: "Ej: martin@gmail.com", type: "email" },
                { label: "WhatsApp *",         key: "whatsapp", placeholder: "Ej: 5491112345678", type: "tel" },
                { label: "Instagram / TikTok / comunidad", key: "social_links", placeholder: "@tuusuario o nombre de tu comunidad", type: "text" },
              ].map(f => (
                <div key={f.key}>
                  <label style={{ font: `500 0.68rem/1 ${fd}`, color: "rgba(255,255,255,0.35)", textTransform: "uppercase", letterSpacing: "0.08em", display: "block", marginBottom: 6 }}>{f.label}</label>
                  <input
                    type={f.type}
                    value={form[f.key as keyof typeof form]}
                    onChange={e => setForm(p => ({ ...p, [f.key]: e.target.value }))}
                    placeholder={f.placeholder}
                    style={{ width: "100%", padding: "13px 16px", background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.1)", borderRadius: 12, font: `400 0.9rem/1 ${fd}`, color: "#FFFFFF" }}
                  />
                </div>
              ))}

              <div>
                <label style={{ font: `500 0.68rem/1 ${fd}`, color: "rgba(255,255,255,0.35)", textTransform: "uppercase", letterSpacing: "0.08em", display: "block", marginBottom: 6 }}>¿A cuántos colegas podrías recomendar?</label>
                <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                  {["1-5", "5-10", "10-20", "20+"].map(opt => (
                    <button
                      key={opt}
                      type="button"
                      onClick={() => setForm(p => ({ ...p, colleague_count: opt }))}
                      style={{ padding: "9px 18px", background: form.colleague_count === opt ? ORANGE : "rgba(255,255,255,0.05)", border: `1px solid ${form.colleague_count === opt ? ORANGE : "rgba(255,255,255,0.1)"}`, borderRadius: 9999, font: `600 0.78rem/1 ${fd}`, color: form.colleague_count === opt ? "white" : "rgba(255,255,255,0.4)", cursor: "pointer", transition: "all 0.15s" }}
                    >
                      {opt}
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <label style={{ font: `500 0.68rem/1 ${fd}`, color: "rgba(255,255,255,0.35)", textTransform: "uppercase", letterSpacing: "0.08em", display: "block", marginBottom: 6 }}>¿Por qué querés ser partner? (opcional)</label>
                <textarea
                  value={form.motivation}
                  onChange={e => setForm(p => ({ ...p, motivation: e.target.value }))}
                  placeholder="Contanos brevemente quién sos y por qué encajás en la red..."
                  rows={3}
                  style={{ width: "100%", padding: "13px 16px", background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.1)", borderRadius: 12, font: `400 0.88rem/1.6 ${fd}`, color: "#FFFFFF", resize: "none" }}
                />
              </div>

              {error && (
                <p style={{ font: `500 0.78rem/1 ${fd}`, color: "#F87171", background: "rgba(248,113,113,0.08)", padding: "10px 14px", borderRadius: 10 }}>{error}</p>
              )}

              <button
                onClick={handleSubmit}
                disabled={sending}
                style={{ width: "100%", padding: "16px 0", background: sending ? "rgba(249,115,22,0.5)" : `linear-gradient(135deg, ${ORANGE} 0%, #EA580C 100%)`, border: "none", borderRadius: 14, font: `700 1rem/1 ${fd}`, color: "#FFFFFF", cursor: sending ? "not-allowed" : "pointer", boxShadow: `0 8px 28px ${ORANGE}33`, marginTop: 4 }}
              >
                {sending ? "Enviando..." : "Enviar postulación →"}
              </button>

              <p style={{ font: `400 0.68rem/1.5 ${fd}`, color: "rgba(255,255,255,0.18)", textAlign: "center" }}>
                Revisamos cada postulación manualmente. Solo aceptamos partners que genuinamente pueden ayudar a crecer la red.
              </p>
            </div>
          )}
        </div>
      </section>

      {/* ── FOOTER ── */}
      <div style={{ borderTop: "1px solid rgba(255,255,255,0.05)", padding: "24px", textAlign: "center" }}>
        <p style={{ font: `400 0.68rem/1.5 ${fd}`, color: "rgba(255,255,255,0.15)" }}>
          © FitGrowX · <a href="https://fitgrowx.com" style={{ color: "rgba(255,255,255,0.2)", textDecoration: "none" }}>fitgrowx.com</a>
        </p>
      </div>

    </div>
  );
}
