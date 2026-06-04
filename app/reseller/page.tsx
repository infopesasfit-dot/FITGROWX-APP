"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import Image from "next/image";
import Link from "next/link";
import { FITGROWX_PLANS } from "@/lib/fitgrowx-plans";
import { TurnstileWidget } from "@/components/turnstile-widget";

const ORANGE = "#F97316";
const FM = "'JetBrains Mono', 'Fira Mono', monospace";
const FS = "'Inter', system-ui, sans-serif";

const TIERS = [
  { label: "Standard",  minGyms: 1,  maxGyms: 9,  pct: 20, color: "#9CA3AF" },
  { label: "Premium",   minGyms: 10, maxGyms: 24, pct: 25, color: "#818CF8" },
  { label: "Franchise", minGyms: 25, maxGyms: 99, pct: 30, color: "#F59E0B" },
];

function calcTier(gyms: number) {
  return [...TIERS].reverse().find(t => gyms >= t.minGyms) ?? TIERS[0];
}

function fmtARS(n: number) { return n.toLocaleString("es-AR", { maximumFractionDigits: 0 }); }

const COUNTRIES = [
  { code: "AR", name: "Argentina", flag: "🇦🇷", countryCode: "+54", digits: 11, pattern: /^9\d{10}$/, placeholder: "+54 9 11 12345678" },
  { code: "UY", name: "Uruguay", flag: "🇺🇾", countryCode: "+598", digits: 9, pattern: /^(9\d{7}|[1-9]\d{7})$/, placeholder: "+598 9 1234567" },
  { code: "CL", name: "Chile", flag: "🇨🇱", countryCode: "+56", digits: 9, pattern: /^9\d{8}$/, placeholder: "+56 9 12345678" },
  { code: "CO", name: "Colombia", flag: "🇨🇴", countryCode: "+57", digits: 10, pattern: /^(3\d{9})$/, placeholder: "+57 3001234567" },
  { code: "MX", name: "México", flag: "🇲🇽", countryCode: "+52", digits: 10, pattern: /^[1-9]\d{9}$/, placeholder: "+52 5512345678" },
  { code: "PE", name: "Perú", flag: "🇵🇪", countryCode: "+51", digits: 9, pattern: /^9\d{8}$/, placeholder: "+51 912345678" },
  { code: "EC", name: "Ecuador", flag: "🇪🇨", countryCode: "+593", digits: 9, pattern: /^[0-9]\d{8}$/, placeholder: "+593 912345678" },
  { code: "BO", name: "Bolivia", flag: "🇧🇴", countryCode: "+591", digits: 8, pattern: /^[67]\d{7}$/, placeholder: "+591 70123456" },
  { code: "PY", name: "Paraguay", flag: "🇵🇾", countryCode: "+595", digits: 9, pattern: /^9\d{8}$/, placeholder: "+595 961234567" },
  { code: "BR", name: "Brasil", flag: "🇧🇷", countryCode: "+55", digits: 10, pattern: /^[1-9]\d{8,9}$/, placeholder: "+55 11987654321" },
  { code: "VE", name: "Venezuela", flag: "🇻🇪", countryCode: "+58", digits: 10, pattern: /^[2-4]\d{9}$/, placeholder: "+58 4121234567" },
  { code: "CU", name: "Cuba", flag: "🇨🇺", countryCode: "+53", digits: 8, pattern: /^[5]\d{7}$/, placeholder: "+53 51234567" },
  { code: "DO", name: "Rep. Dominicana", flag: "🇩🇴", countryCode: "+1-809", digits: 10, pattern: /^(809|829|849)\d{7}$/, placeholder: "+1-809 1234567" },
  { code: "CR", name: "Costa Rica", flag: "🇨🇷", countryCode: "+506", digits: 8, pattern: /^[2-9]\d{7}$/, placeholder: "+506 87654321" },
  { code: "PA", name: "Panamá", flag: "🇵🇦", countryCode: "+507", digits: 8, pattern: /^[0-9]\d{7}$/, placeholder: "+507 61234567" },
  { code: "ES", name: "España", flag: "🇪🇸", countryCode: "+34", digits: 9, pattern: /^[6-9]\d{8}$/, placeholder: "+34 612345678" },
];

function formatPhoneByCountry(phone: string, country: string): { formatted: string; valid: boolean; error?: string } {
  if (!phone?.trim()) return { formatted: "", valid: false, error: "Teléfono requerido" };

  const countryInfo = COUNTRIES.find(c => c.code === country);
  if (!countryInfo) return { formatted: "", valid: false, error: "País inválido" };

  const digits = phone.replace(/\D/g, "");
  let normalized = digits;

  // Si empieza con el código del país, remover
  if (normalized.startsWith(countryInfo.countryCode.replace("+", ""))) {
    normalized = normalized.slice(countryInfo.countryCode.replace("+", "").length);
  }

  // Validar cantidad de dígitos
  if (normalized.length !== countryInfo.digits) {
    return { formatted: "", valid: false, error: `${countryInfo.name}: debe tener ${countryInfo.digits} dígitos (tenés ${normalized.length})` };
  }

  // Validar patrón
  if (!countryInfo.pattern.test(normalized)) {
    return { formatted: "", valid: false, error: `${countryInfo.name}: formato inválido` };
  }

  // Formatear según país
  let formatted = "";
  if (country === "AR") {
    const area = normalized.slice(1, 3);
    formatted = `${countryInfo.countryCode} 9 ${area} ${normalized.slice(3)}`;
  } else if (country === "UY") {
    if (normalized.startsWith("9")) {
      formatted = `${countryInfo.countryCode} 9 ${normalized.slice(1)}`;
    } else {
      formatted = `${countryInfo.countryCode} ${normalized}`;
    }
  } else if (country === "CL") {
    formatted = `${countryInfo.countryCode} 9 ${normalized.slice(1)}`;
  }

  return { formatted, valid: true };
}

const PRO_PRICE = FITGROWX_PLANS.find(p => p.key === "crecimiento")?.priceMonthly ?? 65_000;

/* ── Count-up hook ── */
function useCountUp(target: number, duration = 1400) {
  const [val, setVal] = useState(0);
  const fired = useRef(false);
  const elRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const el = elRef.current;
    if (!el) return;
    const obs = new IntersectionObserver(([entry]) => {
      if (!entry.isIntersecting || fired.current) return;
      fired.current = true;
      const t0 = performance.now();
      const tick = (now: number) => {
        const p = Math.min((now - t0) / duration, 1);
        const eased = 1 - Math.pow(1 - p, 4);
        setVal(Math.round(eased * target));
        if (p < 1) requestAnimationFrame(tick);
      };
      requestAnimationFrame(tick);
    }, { threshold: 0.4 });
    obs.observe(el);
    return () => obs.disconnect();
  }, [target, duration]);
  return { val, elRef };
}

function CountNum({ value, prefix = "", suffix = "", size = "4rem" }: {
  value: number; prefix?: string; suffix?: string; size?: string;
}) {
  const { val, elRef } = useCountUp(value);
  return (
    <div ref={elRef} style={{ font: `100 ${size}/1 ${FM}`, letterSpacing: "-0.06em", color: "#FFFFFF", lineHeight: 1 }}>
      {prefix}{val}{suffix}
    </div>
  );
}

const STEPS = [
  { num: "01", icon: "🔗", title: "Compartís tu link", desc: "Te damos un link único. Cada colega que se registre por ahí queda vinculado a tu cuenta para siempre." },
  { num: "02", icon: "🚀", title: "Tu colega deja el cuaderno", desc: "Se registra, conecta su WhatsApp y empieza a cobrar y gestionar su gym en minutos. Vos no hacés nada más." },
  { num: "03", icon: "💸", title: "Cobrás todos los meses", desc: "Cada vez que tu colega paga su suscripción, vos recibís tu comisión. Recurrente. De por vida." },
];

const PROOF = [
  { value: 20,  suffix: "%", label: "Comisión mensual base" },
  { value: 30,  suffix: "%", label: "Comisión tier Franquicia" },
  { value: 0,   suffix: "$", label: "Para empezar", prefix: "$" },
  { value: 100, suffix: "%", label: "Recurrente de por vida" },
];

const EMPTY = { name: "", email: "", whatsapp: "", colleague_count: "", social_links: "", motivation: "" };

export default function ResellerLanding() {
  const [gyms,           setGyms]           = useState(10);
  const [form,           setForm]           = useState(EMPTY);
  const [country,        setCountry]        = useState("AR");
  const [sending,        setSending]        = useState(false);
  const [sent,           setSent]           = useState(false);
  const [error,          setError]          = useState<string | null>(null);
  const [turnstileToken, setTurnstileToken] = useState<string | null>(null);
  const formRef = useRef<HTMLDivElement>(null);

  const handleTurnstileChange = useCallback((t: string | null) => setTurnstileToken(t), []);

  const tier           = calcTier(gyms);
  const monthly        = Math.round(gyms * PRO_PRICE * tier.pct / 100);
  const annual         = monthly * 12;
  const nextTier       = TIERS.find(t => t.minGyms > gyms);
  const gymsToNextTier = nextTier ? nextTier.minGyms - gyms : 0;

  const scrollToForm = () => formRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });

  const handleSubmit = async () => {
    if (!form.name.trim() || !form.email.trim() || !form.whatsapp.trim()) {
      setError("Nombre, email y WhatsApp son obligatorios."); return;
    }

    const phoneValidation = formatPhoneByCountry(form.whatsapp, country);
    if (!phoneValidation.valid) {
      setError(phoneValidation.error ?? "Teléfono inválido"); return;
    }

    setSending(true); setError(null);
    const r = await fetch("/api/reseller/apply", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ...form, whatsapp: phoneValidation.formatted, country, turnstileToken }),
    });
    const d = await r.json();
    setSending(false);
    if (!r.ok) { setError(d.error ?? "Error al enviar"); return; }
    setSent(true);
  };

  return (
    <div style={{ minHeight: "100svh", background: "#080810", color: "#FFFFFF", fontFamily: FS, overflowX: "hidden" }}>
      <style>{`
        @keyframes fadeUp { from{opacity:0;transform:translateY(20px)} to{opacity:1;transform:translateY(0)} }
        @keyframes pulse  { 0%,100%{opacity:1} 50%{opacity:0.4} }
        * { box-sizing: border-box; }
        input,textarea,select { outline:none; }
        input::placeholder,textarea::placeholder { color:rgba(255,255,255,0.2); }
        .res-grid-4 { display:grid; grid-template-columns:repeat(4,1fr); gap:0; }
        .res-grid-3 { display:grid; grid-template-columns:repeat(3,1fr); gap:12px; }
        .res-grid-2 { display:grid; grid-template-columns:1fr 1fr; gap:20px; }
        @media(max-width:640px){
          .res-grid-4 { grid-template-columns:1fr 1fr; }
          .res-grid-3 { grid-template-columns:1fr; }
          .res-grid-2 { grid-template-columns:1fr; gap:14px; }
          .hero-h1    { font-size:clamp(2rem,8vw,3.4rem) !important; }
          .hero-btns  { flex-direction:column; }
          .hero-btns a, .hero-btns button { width:100%; text-align:center; }
        }
      `}</style>

      {/* ── NAV ── */}
      <nav style={{ position: "sticky", top: 0, zIndex: 50, background: "rgba(8,8,16,0.88)", backdropFilter: "blur(20px)", borderBottom: "1px solid rgba(255,255,255,0.05)", padding: "0 20px", height: 54, display: "flex", alignItems: "center", justifyContent: "space-between" }}>
        <Link href="/" style={{ display: "flex", alignItems: "center", textDecoration: "none" }}>
          <Image src="/images/logo-fondo-oscuro.png" alt="FitGrowX" width={120} height={36} style={{ height: 28, width: "auto", objectFit: "contain", opacity: 0.85 }} />
        </Link>
        <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
          <Link href="/start?login=1" style={{ font: `500 0.78rem/1 ${FS}`, color: "rgba(255,255,255,0.45)", textDecoration: "none" }}>Entrar</Link>
          <button onClick={scrollToForm} style={{ padding: "8px 20px", background: ORANGE, color: "white", border: "none", borderRadius: 9999, font: `700 0.78rem/1 ${FS}`, cursor: "pointer", letterSpacing: "-0.01em" }}>
            Postularme
          </button>
        </div>
      </nav>

      {/* ── HERO ── */}
      <section style={{ maxWidth: 820, margin: "0 auto", padding: "80px 24px 60px", textAlign: "center", animation: "fadeUp 0.5s ease", position: "relative" }}>
        <div style={{ position: "absolute", top: 0, left: "50%", transform: "translateX(-50%)", width: 700, height: 450, borderRadius: "50%", background: `radial-gradient(circle, ${ORANGE}14 0%, transparent 65%)`, pointerEvents: "none", zIndex: 0 }} />

        <div style={{ position: "relative", zIndex: 1 }}>
          <div style={{ display: "inline-flex", alignItems: "center", gap: 7, padding: "5px 14px 5px 10px", background: "rgba(249,115,22,0.08)", border: "1px solid rgba(249,115,22,0.22)", borderRadius: 9999, marginBottom: 28 }}>
            <span style={{ width: 6, height: 6, borderRadius: "50%", background: ORANGE, animation: "pulse 2s ease-in-out infinite", display: "inline-block" }} />
            <span style={{ font: `600 0.68rem/1 ${FS}`, color: ORANGE, letterSpacing: "0.14em", textTransform: "uppercase" }}>Red de Partners · Postulaciones abiertas</span>
          </div>

          <h1 className="hero-h1" style={{ font: `300 clamp(2.2rem,5.5vw,4rem)/1.06 ${FS}`, color: "#FFFFFF", letterSpacing: "-0.055em", marginBottom: 22, maxWidth: 680, margin: "0 auto 22px" }}>
            Ayudá a tus colegas a dejar el cuaderno{" "}
            <span style={{ color: ORANGE, fontWeight: 300 }}>y ganá una comisión de por vida</span>
          </h1>

          <p style={{ font: `300 1.05rem/1.65 ${FS}`, color: "rgba(255,255,255,0.42)", maxWidth: 500, margin: "0 auto 36px", letterSpacing: "-0.01em" }}>
            Recomendás FitGrowX a otros trainers y dueños de gym.
            Ellos digitalizan su negocio. Vos cobrás cada mes que sigan.
          </p>

          <div className="hero-btns" style={{ display: "flex", gap: 12, justifyContent: "center", flexWrap: "wrap" }}>
            <button onClick={scrollToForm} style={{ padding: "15px 34px", background: `linear-gradient(135deg, ${ORANGE} 0%, #EA580C 100%)`, color: "white", border: "none", borderRadius: 14, font: `600 0.95rem/1 ${FS}`, cursor: "pointer", boxShadow: `0 8px 32px ${ORANGE}40`, letterSpacing: "-0.01em" }}>
              Quiero postularme →
            </button>
            <a href="#como-funciona" style={{ padding: "15px 26px", background: "rgba(255,255,255,0.05)", color: "rgba(255,255,255,0.62)", border: "1px solid rgba(255,255,255,0.1)", borderRadius: 14, font: `400 0.95rem/1 ${FS}`, textDecoration: "none", letterSpacing: "-0.01em" }}>
              Ver cómo funciona
            </a>
          </div>
        </div>
      </section>

      {/* ── PROOF BAR ── */}
      <section style={{ borderTop: "1px solid rgba(255,255,255,0.05)", borderBottom: "1px solid rgba(255,255,255,0.05)" }}>
        <div className="res-grid-4" style={{ maxWidth: 820, margin: "0 auto" }}>
          {PROOF.map((p, i) => (
            <div key={p.label} style={{ padding: "28px 20px", textAlign: "center", borderRight: i < 3 ? "1px solid rgba(255,255,255,0.05)" : undefined }}>
              <div style={{ display: "flex", justifyContent: "center", marginBottom: 8 }}>
                {p.label === "Para empezar" ? (
                  <div style={{ font: `100 clamp(2.4rem,6vw,3.4rem)/1 ${FM}`, letterSpacing: "-0.06em", color: ORANGE }}>$0</div>
                ) : (
                  <CountNum value={p.value} suffix={p.suffix} size="clamp(2.4rem,6vw,3.4rem)" />
                )}
              </div>
              <p style={{ font: `400 0.68rem/1.35 ${FS}`, color: "rgba(255,255,255,0.3)", letterSpacing: "0.02em" }}>{p.label}</p>
            </div>
          ))}
        </div>
      </section>

      {/* ── 3 PASOS ── */}
      <section id="como-funciona" style={{ maxWidth: 720, margin: "0 auto", padding: "72px 20px 64px" }}>
        <p style={{ font: `500 0.66rem/1 ${FS}`, color: "rgba(255,255,255,0.3)", letterSpacing: "0.22em", textTransform: "uppercase", textAlign: "center", marginBottom: 12 }}>Cómo funciona</p>
        <h2 style={{ font: `300 clamp(1.8rem,4vw,2.8rem)/1.1 ${FS}`, color: "#FFFFFF", letterSpacing: "-0.05em", textAlign: "center", marginBottom: 48 }}>
          Tres pasos, cero fricción
        </h2>

        <div style={{ display: "flex", flexDirection: "column", gap: 2 }}>
          {STEPS.map((step, i) => (
            <div key={step.num} style={{ display: "flex", gap: 20, alignItems: "flex-start", padding: "24px", background: "rgba(255,255,255,0.02)", border: "1px solid rgba(255,255,255,0.05)", borderRadius: 20, position: "relative" }}>
              {i < STEPS.length - 1 && (
                <div style={{ position: "absolute", left: 44, bottom: -16, width: 1, height: 16, background: "rgba(255,255,255,0.07)" }} />
              )}
              <div style={{ flexShrink: 0, width: 44, height: 44, borderRadius: 13, background: "rgba(249,115,22,0.08)", border: "1px solid rgba(249,115,22,0.18)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 20 }}>
                {step.icon}
              </div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ display: "flex", alignItems: "center", gap: 9, marginBottom: 7 }}>
                  <span style={{ font: `600 0.58rem/1 ${FS}`, color: ORANGE, letterSpacing: "0.15em" }}>{step.num}</span>
                  <h3 style={{ font: `500 0.95rem/1 ${FS}`, color: "#FFFFFF", letterSpacing: "-0.02em" }}>{step.title}</h3>
                </div>
                <p style={{ font: `300 0.85rem/1.6 ${FS}`, color: "rgba(255,255,255,0.38)", letterSpacing: "-0.01em" }}>{step.desc}</p>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* ── CALCULADORA ── */}
      <section style={{ background: "rgba(255,255,255,0.015)", borderTop: "1px solid rgba(255,255,255,0.05)", borderBottom: "1px solid rgba(255,255,255,0.05)", padding: "72px 20px 64px" }}>
        <div style={{ maxWidth: 600, margin: "0 auto" }}>
          <p style={{ font: `500 0.66rem/1 ${FS}`, color: "rgba(255,255,255,0.3)", letterSpacing: "0.22em", textTransform: "uppercase", textAlign: "center", marginBottom: 12 }}>Calculá tu ingreso</p>
          <h2 style={{ font: `300 clamp(1.8rem,4vw,2.8rem)/1.1 ${FS}`, color: "#FFFFFF", letterSpacing: "-0.05em", textAlign: "center", marginBottom: 44 }}>
            ¿Cuántos colegas tenés?
          </h2>

          {/* Slider */}
          <div style={{ marginBottom: 36 }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-end", marginBottom: 12 }}>
              <span style={{ font: `300 0.72rem/1 ${FS}`, color: "rgba(255,255,255,0.25)" }}>1 gym</span>
              <span style={{ font: `100 2.6rem/1 ${FM}`, color: ORANGE, letterSpacing: "-0.06em" }}>{gyms} gyms</span>
              <span style={{ font: `300 0.72rem/1 ${FS}`, color: "rgba(255,255,255,0.25)" }}>30 gyms</span>
            </div>
            <input
              type="range" min={1} max={30} value={gyms}
              onChange={e => setGyms(Number(e.target.value))}
              style={{ width: "100%", accentColor: ORANGE, height: 4, cursor: "pointer" }}
            />
            <div style={{ display: "flex", gap: 8, marginTop: 16, justifyContent: "center", flexWrap: "wrap" }}>
              {[5, 10, 20, 30].map(n => (
                <button key={n} onClick={() => setGyms(n)} style={{ padding: "7px 18px", background: gyms === n ? ORANGE : "rgba(255,255,255,0.05)", border: `1px solid ${gyms === n ? ORANGE : "rgba(255,255,255,0.08)"}`, borderRadius: 9999, font: `500 0.75rem/1 ${FS}`, color: gyms === n ? "white" : "rgba(255,255,255,0.38)", cursor: "pointer", transition: "all 0.15s" }}>
                  {n}
                </button>
              ))}
            </div>
          </div>

          {/* Result card */}
          <div style={{ background: "rgba(249,115,22,0.05)", border: "1px solid rgba(249,115,22,0.18)", borderRadius: 22, padding: "28px 24px 22px", overflow: "hidden" }}>
            <div className="res-grid-2" style={{ marginBottom: 20 }}>
              <div>
                <p style={{ font: `500 0.62rem/1 ${FS}`, color: "rgba(255,255,255,0.28)", letterSpacing: "0.14em", textTransform: "uppercase", marginBottom: 10 }}>Por mes</p>
                <div style={{ font: `100 clamp(2.2rem,8vw,3.2rem)/1 ${FM}`, letterSpacing: "-0.06em", color: "#FFFFFF" }}>${fmtARS(monthly)}</div>
                <p style={{ font: `300 0.65rem/1 ${FS}`, color: "rgba(255,255,255,0.22)", marginTop: 6 }}>ARS / mes</p>
              </div>
              <div>
                <p style={{ font: `500 0.62rem/1 ${FS}`, color: "rgba(255,255,255,0.28)", letterSpacing: "0.14em", textTransform: "uppercase", marginBottom: 10 }}>Por año</p>
                <div style={{ font: `100 clamp(2.2rem,8vw,3.2rem)/1 ${FM}`, letterSpacing: "-0.06em", color: ORANGE }}>${fmtARS(annual)}</div>
                <p style={{ font: `300 0.65rem/1 ${FS}`, color: "rgba(255,255,255,0.22)", marginTop: 6 }}>ARS / año</p>
              </div>
            </div>

            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12, flexWrap: "wrap", padding: "12px 14px", background: "rgba(255,255,255,0.03)", borderRadius: 12, border: "1px solid rgba(255,255,255,0.05)" }}>
              <div>
                <p style={{ font: `500 0.75rem/1 ${FS}`, color: "rgba(255,255,255,0.65)", letterSpacing: "-0.01em" }}>
                  Tier: <span style={{ color: tier.color }}>{tier.label}</span> · {tier.pct}% comisión
                </p>
                {nextTier && (
                  <p style={{ font: `300 0.62rem/1 ${FS}`, color: "rgba(255,255,255,0.22)", marginTop: 4 }}>
                    {gymsToNextTier} gym{gymsToNextTier !== 1 ? "s" : ""} más para pasar a {nextTier.label} ({nextTier.pct}%)
                  </p>
                )}
              </div>
              {nextTier && (
                <span style={{ font: `600 0.68rem/1 ${FS}`, color: "#34D399", background: "rgba(52,211,153,0.08)", padding: "5px 11px", borderRadius: 9999, whiteSpace: "nowrap" }}>
                  +${fmtARS(Math.round(gyms * PRO_PRICE * (nextTier.pct - tier.pct) / 100))}/mes en {nextTier.label}
                </span>
              )}
            </div>
          </div>

          <p style={{ font: `300 0.65rem/1.5 ${FS}`, color: "rgba(255,255,255,0.18)", textAlign: "center", marginTop: 14, letterSpacing: "-0.01em" }}>
            Calculado sobre $65.000 ARS/mes por gym. La comisión es recurrente mientras el gym esté activo.
          </p>
        </div>
      </section>

      {/* ── TIERS ── */}
      <section style={{ maxWidth: 760, margin: "0 auto", padding: "72px 20px 64px" }}>
        <h2 style={{ font: `300 clamp(1.8rem,4vw,2.6rem)/1.1 ${FS}`, color: "#FFFFFF", letterSpacing: "-0.05em", textAlign: "center", marginBottom: 10 }}>
          Más gyms, más comisión
        </h2>
        <p style={{ font: `300 0.88rem/1.55 ${FS}`, color: "rgba(255,255,255,0.32)", textAlign: "center", maxWidth: 400, margin: "0 auto 40px", letterSpacing: "-0.01em" }}>
          Tu comisión sube automáticamente cuando crece tu red.
        </p>
        <div className="res-grid-3">
          {TIERS.map(t => (
            <div key={t.label} style={{ background: "rgba(255,255,255,0.025)", border: `1px solid ${t.color}28`, borderRadius: 20, padding: "28px 20px", textAlign: "center" }}>
              <CountNum value={t.pct} suffix="%" size="clamp(3rem,8vw,4rem)" />
              <div style={{ marginTop: 8, marginBottom: 4 }}>
                <span style={{ font: `500 0.8rem/1 ${FS}`, color: t.color, letterSpacing: "-0.01em" }}>{t.label}</span>
              </div>
              <p style={{ font: `300 0.68rem/1.4 ${FS}`, color: "rgba(255,255,255,0.28)", marginBottom: 14 }}>
                {t.minGyms === 1 ? `1 a ${t.maxGyms} gyms` : t.maxGyms === 99 ? `${t.minGyms}+ gyms` : `${t.minGyms} a ${t.maxGyms} gyms`}
              </p>
              <div style={{ padding: "9px 0", background: `${t.color}0d`, borderRadius: 10 }}>
                <p style={{ font: `500 0.7rem/1 ${FS}`, color: t.color, letterSpacing: "-0.01em" }}>
                  ${fmtARS(Math.round(t.minGyms * PRO_PRICE * t.pct / 100))}/mes con {t.minGyms} gym{t.minGyms !== 1 ? "s" : ""}
                </p>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* ── FORMULARIO ── */}
      <section ref={formRef} style={{ background: "rgba(255,255,255,0.015)", borderTop: "1px solid rgba(255,255,255,0.05)", padding: "72px 20px 80px" }}>
        <div style={{ maxWidth: 500, margin: "0 auto" }}>
          <p style={{ font: `500 0.66rem/1 ${FS}`, color: ORANGE, letterSpacing: "0.22em", textTransform: "uppercase", textAlign: "center", marginBottom: 12 }}>Postulaciones abiertas</p>
          <h2 style={{ font: `300 clamp(1.8rem,4vw,2.6rem)/1.1 ${FS}`, color: "#FFFFFF", letterSpacing: "-0.05em", textAlign: "center", marginBottom: 10 }}>
            Quiero ser partner
          </h2>
          <p style={{ font: `300 0.88rem/1.55 ${FS}`, color: "rgba(255,255,255,0.32)", textAlign: "center", maxWidth: 380, margin: "0 auto 36px", letterSpacing: "-0.01em" }}>
            No aceptamos a cualquiera — queremos resellers que realmente conozcan el mundo fitness. Contanos quién sos.
          </p>

          {sent ? (
            <div style={{ textAlign: "center", padding: "40px 24px", background: "rgba(52,211,153,0.05)", border: "1px solid rgba(52,211,153,0.18)", borderRadius: 20 }}>
              <p style={{ fontSize: 44, marginBottom: 16 }}>🙌</p>
              <p style={{ font: `500 1.15rem/1.3 ${FS}`, color: "#FFFFFF", marginBottom: 8, letterSpacing: "-0.03em" }}>¡Postulación recibida!</p>
              <p style={{ font: `300 0.85rem/1.6 ${FS}`, color: "rgba(255,255,255,0.38)", letterSpacing: "-0.01em" }}>
                Revisamos tu perfil y te contactamos por WhatsApp en las próximas 48 hs.
              </p>
            </div>
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
              {[
                { label: "Nombre completo *",                     key: "name",         placeholder: "Ej: Martín Rodríguez",           type: "text" },
                { label: "Email *",                               key: "email",        placeholder: "Ej: martin@gmail.com",           type: "email" },
              ].map(f => (
                <div key={f.key}>
                  <label style={{ font: `500 0.62rem/1 ${FS}`, color: "rgba(255,255,255,0.3)", textTransform: "uppercase", letterSpacing: "0.1em", display: "block", marginBottom: 7 }}>{f.label}</label>
                  <input
                    type={f.type}
                    value={form[f.key as keyof typeof form]}
                    onChange={e => setForm(p => ({ ...p, [f.key]: e.target.value }))}
                    placeholder={f.placeholder}
                    style={{ width: "100%", padding: "13px 16px", background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.09)", borderRadius: 12, font: `300 0.92rem/1 ${FS}`, color: "#FFFFFF", letterSpacing: "-0.01em" }}
                  />
                </div>
              ))}

              {/* País */}
              <div>
                <label style={{ font: `500 0.62rem/1 ${FS}`, color: "rgba(255,255,255,0.3)", textTransform: "uppercase", letterSpacing: "0.1em", display: "block", marginBottom: 7 }}>País *</label>
                <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 8 }}>
                  {COUNTRIES.map(c => (
                    <button key={c.code} type="button" onClick={() => setCountry(c.code)}
                      style={{ padding: "10px 8px", background: country === c.code ? "rgba(249,115,22,0.2)" : "rgba(255,255,255,0.04)", border: `1px solid ${country === c.code ? ORANGE : "rgba(255,255,255,0.09)"}`, borderRadius: 10, font: `500 0.75rem/1.2 ${FS}`, color: "#FFFFFF", cursor: "pointer", transition: "all 0.15s", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 4 }}>
                      <span style={{ fontSize: "1.6rem" }}>{c.flag}</span>
                      <span>{c.code}</span>
                    </button>
                  ))}
                </div>
              </div>

              {/* WhatsApp */}
              <div>
                <label style={{ font: `500 0.62rem/1 ${FS}`, color: "rgba(255,255,255,0.3)", textTransform: "uppercase", letterSpacing: "0.1em", display: "block", marginBottom: 7 }}>WhatsApp *</label>
                <input
                  type="tel"
                  value={form.whatsapp}
                  onChange={e => setForm(p => ({ ...p, whatsapp: e.target.value }))}
                  placeholder={COUNTRIES.find(c => c.code === country)?.placeholder}
                  style={{ width: "100%", padding: "13px 16px", background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.09)", borderRadius: 12, font: `300 0.92rem/1 ${FS}`, color: "#FFFFFF", letterSpacing: "-0.01em" }}
                />
              </div>

              {[
                { label: "Instagram / TikTok / comunidad",        key: "social_links", placeholder: "@tuusuario o nombre de tu comunidad", type: "text" },
              ].map(f => (
                <div key={f.key}>
                  <label style={{ font: `500 0.62rem/1 ${FS}`, color: "rgba(255,255,255,0.3)", textTransform: "uppercase", letterSpacing: "0.1em", display: "block", marginBottom: 7 }}>{f.label}</label>
                  <input
                    type={f.type}
                    value={form[f.key as keyof typeof form]}
                    onChange={e => setForm(p => ({ ...p, [f.key]: e.target.value }))}
                    placeholder={f.placeholder}
                    style={{ width: "100%", padding: "13px 16px", background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.09)", borderRadius: 12, font: `300 0.92rem/1 ${FS}`, color: "#FFFFFF", letterSpacing: "-0.01em" }}
                  />
                </div>
              ))}

              <div>
                <label style={{ font: `500 0.62rem/1 ${FS}`, color: "rgba(255,255,255,0.3)", textTransform: "uppercase", letterSpacing: "0.1em", display: "block", marginBottom: 9 }}>¿A cuántos colegas podrías recomendar?</label>
                <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                  {["1-5", "5-10", "10-20", "20+"].map(opt => (
                    <button key={opt} type="button" onClick={() => setForm(p => ({ ...p, colleague_count: opt }))}
                      style={{ padding: "9px 20px", background: form.colleague_count === opt ? ORANGE : "rgba(255,255,255,0.04)", border: `1px solid ${form.colleague_count === opt ? ORANGE : "rgba(255,255,255,0.08)"}`, borderRadius: 9999, font: `500 0.78rem/1 ${FS}`, color: form.colleague_count === opt ? "white" : "rgba(255,255,255,0.38)", cursor: "pointer", transition: "all 0.15s" }}>
                      {opt}
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <label style={{ font: `500 0.62rem/1 ${FS}`, color: "rgba(255,255,255,0.3)", textTransform: "uppercase", letterSpacing: "0.1em", display: "block", marginBottom: 7 }}>¿Por qué querés ser partner? (opcional)</label>
                <textarea
                  value={form.motivation}
                  onChange={e => setForm(p => ({ ...p, motivation: e.target.value }))}
                  placeholder="Contanos brevemente quién sos y por qué encajás en la red..."
                  rows={3}
                  style={{ width: "100%", padding: "13px 16px", background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.09)", borderRadius: 12, font: `300 0.88rem/1.6 ${FS}`, color: "#FFFFFF", resize: "none", letterSpacing: "-0.01em" }}
                />
              </div>

              {error && (
                <p style={{ font: `500 0.78rem/1 ${FS}`, color: "#F87171", background: "rgba(248,113,113,0.07)", padding: "10px 14px", borderRadius: 10 }}>{error}</p>
              )}

              <TurnstileWidget onTokenChange={handleTurnstileChange} theme="dark" />

              <button onClick={handleSubmit} disabled={sending || !turnstileToken}
                style={{ width: "100%", padding: "17px 0", background: sending ? "rgba(249,115,22,0.45)" : `linear-gradient(135deg, ${ORANGE} 0%, #EA580C 100%)`, border: "none", borderRadius: 14, font: `600 0.95rem/1 ${FS}`, color: "#FFFFFF", cursor: sending ? "not-allowed" : "pointer", boxShadow: sending ? "none" : `0 8px 28px ${ORANGE}30`, marginTop: 4, letterSpacing: "-0.01em" }}>
                {sending ? "Enviando..." : "Enviar postulación →"}
              </button>

              <p style={{ font: `300 0.65rem/1.5 ${FS}`, color: "rgba(255,255,255,0.16)", textAlign: "center", letterSpacing: "-0.01em" }}>
                Revisamos cada postulación manualmente. Solo aceptamos partners que genuinamente pueden ayudar a crecer la red.
              </p>
            </div>
          )}
        </div>
      </section>

      {/* ── FOOTER ── */}
      <div style={{ borderTop: "1px solid rgba(255,255,255,0.05)", padding: "24px 20px", textAlign: "center", display: "flex", gap: 16, alignItems: "center", justifyContent: "center", flexWrap: "wrap" }}>
        <Image src="/images/logo-fondo-oscuro.png" alt="FitGrowX" width={100} height={30} style={{ height: 22, width: "auto", opacity: 0.25 }} />
        <p style={{ font: `300 0.65rem/1.5 ${FS}`, color: "rgba(255,255,255,0.15)" }}>
          © {new Date().getFullYear()} FitGrowX · <a href="/terminos" style={{ color: "rgba(255,255,255,0.2)", textDecoration: "none" }}>Términos</a> · <a href="/privacidad" style={{ color: "rgba(255,255,255,0.2)", textDecoration: "none" }}>Privacidad</a>
        </p>
      </div>
    </div>
  );
}
