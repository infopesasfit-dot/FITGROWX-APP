"use client";

import Image from "next/image";
import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { createClient } from "@supabase/supabase-js";
import { TurnstileWidget } from "@/components/turnstile-widget";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
);

type Benefit  = { icon: string; title: string; desc: string };
type Template = "energia" | "pro" | "impact";

type GymData = {
  gym_id:           string;
  gym_name:         string | null;
  logo_url:         string | null;
  accent_color:     string | null;
  landing_title:    string | null;
  landing_subtitle: string | null;
  landing_desc:     string | null;
  landing_cta_text: string | null;
  landing_template: Template | null;
  landing_benefits: Benefit[] | null;
};

const fd = "'Inter', system-ui, sans-serif";

// ── Inputs shared style factory ───────────────────────────────────────────────
function makeInput(isDark: boolean): React.CSSProperties {
  return {
    width: "100%", padding: "13px 16px", borderRadius: 12, fontSize: "0.9rem",
    outline: "none", boxSizing: "border-box",
    background: isDark ? "rgba(255,255,255,.07)" : "rgba(0,0,0,.05)",
    border: `1px solid ${isDark ? "rgba(255,255,255,.12)" : "rgba(0,0,0,.10)"}`,
    color: isDark ? "#FFFFFF" : "#111827",
    fontFamily: fd,
  };
}

// ── Small icon by name ────────────────────────────────────────────────────────
function BenefitIcon({ name, accent }: { name: string; accent: string }) {
  const icons: Record<string, string> = {
    Dumbbell: "M6 4h2v16H6zM16 4h2v16h-2zM4 10h4v4H4zM16 10h4v4h-4zM10 7h4v10h-4z",
    Zap:      "M13 2L3 14h9l-1 8 10-12h-9l1-8z",
    Users:    "M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2M23 21v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75M9 7a4 4 0 1 0 0 8 4 4 0 0 0 0-8z",
    Calendar: "M8 2v4M16 2v4M3 10h18M5 4h14a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2z",
    Heart:    "M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z",
    Star:     "M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z",
    Target:   "M12 22a10 10 0 1 0 0-20 10 10 0 0 0 0 20zM12 18a6 6 0 1 0 0-12 6 6 0 0 0 0 12zM12 14a2 2 0 1 0 0-4 2 2 0 0 0 0 4z",
    Shield:   "M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z",
    Clock:    "M12 22a10 10 0 1 0 0-20 10 10 0 0 0 0 20zM12 6v6l4 2",
    Trophy:   "M6 9H2V3h4v6zM22 3h-4v6h4V3zM6 9a6 6 0 0 0 12 0M12 15v7M8 22h8",
  };
  const d = icons[name] ?? icons.Zap;
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke={accent} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d={d} />
    </svg>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Template: Energía (dark, bold, high energy)
// ─────────────────────────────────────────────────────────────────────────────
function EnergiaTemplate({ gym, ACCENT, onSubmit, fields }: TemplateProps) {
  const { name, setName, phone, setPhone, email, setEmail, sending, done, error, turnstileToken, setTurnstileToken, turnstileResetKey } = fields;
  return (
    <div style={{ minHeight: "100dvh", background: "#0D1117", fontFamily: fd, display: "flex", flexDirection: "column" }}>
      {/* Hero */}
      <div style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", padding: "60px 24px 0", textAlign: "center", maxWidth: 520, margin: "0 auto", width: "100%" }}>
        {gym.logo_url ? (
          <Image src={gym.logo_url} alt={gym.gym_name ?? ""} width={200} height={64} unoptimized style={{ height: 52, width: "auto", objectFit: "contain", marginBottom: 32 }} />
        ) : gym.gym_name ? (
          <p style={{ font: `800 0.75rem/1 ${fd}`, color: ACCENT, letterSpacing: ".14em", textTransform: "uppercase", marginBottom: 28 }}>{gym.gym_name}</p>
        ) : null}

        <h1 style={{ font: `800 clamp(1.9rem,5vw,2.6rem)/1.08 ${fd}`, color: "#FFFFFF", letterSpacing: "-0.03em", margin: "0 0 14px" }}>
          {gym.landing_title ?? "Probá una clase gratis."}
        </h1>
        {gym.landing_subtitle && (
          <p style={{ font: `700 1.05rem/1.3 ${fd}`, color: ACCENT, margin: "0 0 12px" }}>
            {gym.landing_subtitle}
          </p>
        )}
        <p style={{ font: `400 1rem/1.65 ${fd}`, color: "rgba(255,255,255,.5)", margin: "0 0 44px" }}>
          {gym.landing_desc ?? "Vení a conocernos. Te esperamos con una clase de bienvenida totalmente gratis."}
        </p>
      </div>

      {/* Benefits */}
      {(gym.landing_benefits ?? []).length > 0 && (
        <div style={{ padding: "0 20px 32px", maxWidth: 520, margin: "0 auto", width: "100%", display: "flex", flexDirection: "column", gap: 10 }}>
          {(gym.landing_benefits ?? []).map((b, i) => (
            <div key={i} style={{ display: "flex", alignItems: "flex-start", gap: 14, background: "rgba(255,255,255,.04)", border: "1px solid rgba(255,255,255,.07)", borderRadius: 16, padding: "16px 18px" }}>
              <div style={{ width: 38, height: 38, borderRadius: 11, background: `${ACCENT}22`, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                <BenefitIcon name={b.icon} accent={ACCENT} />
              </div>
              <div>
                <p style={{ font: `700 0.88rem/1.2 ${fd}`, color: "#FFFFFF", margin: "0 0 3px" }}>{b.title}</p>
                {b.desc && <p style={{ font: `400 0.78rem/1.5 ${fd}`, color: "rgba(255,255,255,.45)", margin: 0 }}>{b.desc}</p>}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Form */}
      <div style={{ padding: "0 20px 48px", maxWidth: 480, margin: "0 auto", width: "100%" }}>
        <div style={{ background: "#161B22", border: "1px solid rgba(255,255,255,.08)", borderRadius: 22, padding: "28px 24px", boxShadow: "0 24px 60px rgba(0,0,0,.45)" }}>
          {done ? (
            <div style={{ textAlign: "center", padding: "12px 0" }}>
              <div style={{ font: "2.5rem/1 serif", marginBottom: 16 }}>🎉</div>
              <h2 style={{ font: `700 1.15rem/1.2 ${fd}`, color: "#FFFFFF", margin: "0 0 10px" }}>¡Listo, {name.split(" ")[0]}!</h2>
              <p style={{ font: `400 0.875rem/1.6 ${fd}`, color: "rgba(255,255,255,.45)", margin: 0 }}>Te vamos a contactar por WhatsApp para coordinar tu clase. ¡Nos vemos pronto! 💪</p>
            </div>
          ) : (
            <form onSubmit={onSubmit} style={{ display: "flex", flexDirection: "column", gap: 13 }}>
              <h2 style={{ font: `700 1rem/1 ${fd}`, color: "#FFFFFF", margin: "0 0 4px", textAlign: "center" }}>
                {gym.landing_cta_text ? `Agendá tu clase` : "Agendá tu clase gratis"}
              </h2>
              <LabelInput dark label="Nombre completo" value={name} onChange={setName} placeholder="Carlos Mendez" />
              <LabelInput dark label="WhatsApp" value={phone} onChange={setPhone} placeholder="5491112345678" type="tel" />
              <LabelInput dark label="Email" value={email} onChange={setEmail} placeholder="carlos@email.com" type="email" />
              <TurnstileWidget onTokenChange={setTurnstileToken} theme="dark" resetKey={turnstileResetKey} />
              {error && <p style={{ font: `400 0.8rem/1 ${fd}`, color: "#F87171", margin: 0 }}>{error}</p>}
              <button type="submit" disabled={sending || !turnstileToken} style={{ marginTop: 4, padding: "15px", borderRadius: 13, border: "none", background: ACCENT, color: (ACCENT === "#E2E8F0" || ACCENT === "#FFFFFF") ? "#111827" : "#FFFFFF", font: `700 0.95rem/1 ${fd}`, cursor: sending || !turnstileToken ? "default" : "pointer", opacity: sending || !turnstileToken ? .7 : 1, boxShadow: `0 4px 22px ${ACCENT}44`, transition: "opacity .15s" }}>
                {sending ? "Enviando…" : (gym.landing_cta_text ?? "Quiero mi clase gratis →")}
              </button>
              <p style={{ font: `400 0.7rem/1 ${fd}`, color: "rgba(255,255,255,.2)", textAlign: "center", margin: 0 }}>Sin compromisos. Te contactamos por WhatsApp.</p>
            </form>
          )}
        </div>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Template: Pro Clean (light, minimal, boutique)
// ─────────────────────────────────────────────────────────────────────────────
function ProTemplate({ gym, ACCENT, onSubmit, fields }: TemplateProps) {
  const { name, setName, phone, setPhone, email, setEmail, sending, done, error, turnstileToken, setTurnstileToken, turnstileResetKey } = fields;
  return (
    <div style={{ minHeight: "100dvh", background: "#FAFAF8", fontFamily: fd, display: "flex", flexDirection: "column" }}>
      {/* Top bar */}
      <div style={{ padding: "24px 28px", maxWidth: 560, margin: "0 auto", width: "100%" }}>
        {gym.logo_url ? (
          <Image src={gym.logo_url} alt={gym.gym_name ?? ""} width={160} height={48} unoptimized style={{ height: 40, width: "auto", objectFit: "contain" }} />
        ) : gym.gym_name ? (
          <p style={{ font: `800 1rem/1 ${fd}`, color: "#111827", margin: 0 }}>{gym.gym_name}</p>
        ) : null}
      </div>

      <div style={{ flex: 1, padding: "8px 28px 0", maxWidth: 560, margin: "0 auto", width: "100%" }}>
        {/* Accent line */}
        <div style={{ width: 48, height: 4, borderRadius: 2, background: ACCENT, marginBottom: 24 }} />
        <h1 style={{ font: `800 clamp(2rem,6vw,3rem)/1.05 ${fd}`, color: "#111827", letterSpacing: "-0.035em", margin: "0 0 16px" }}>
          {gym.landing_title ?? "Probá una clase gratis."}
        </h1>
        {gym.landing_subtitle && (
          <p style={{ font: `600 1.05rem/1.4 ${fd}`, color: ACCENT, margin: "0 0 12px" }}>
            {gym.landing_subtitle}
          </p>
        )}
        <p style={{ font: `400 1rem/1.7 ${fd}`, color: "#6B7280", margin: "0 0 36px" }}>
          {gym.landing_desc ?? "Vení a conocernos. Te esperamos con una clase de bienvenida totalmente gratis."}
        </p>

        {/* Benefits */}
        {(gym.landing_benefits ?? []).length > 0 && (
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, marginBottom: 36 }}>
            {(gym.landing_benefits ?? []).map((b, i) => (
              <div key={i} style={{ background: "#FFFFFF", border: "1px solid rgba(0,0,0,.07)", borderRadius: 16, padding: "16px" }}>
                <div style={{ width: 34, height: 34, borderRadius: 10, background: `${ACCENT}15`, display: "flex", alignItems: "center", justifyContent: "center", marginBottom: 10 }}>
                  <BenefitIcon name={b.icon} accent={ACCENT} />
                </div>
                <p style={{ font: `700 0.82rem/1.2 ${fd}`, color: "#111827", margin: "0 0 3px" }}>{b.title}</p>
                {b.desc && <p style={{ font: `400 0.73rem/1.5 ${fd}`, color: "#9CA3AF", margin: 0 }}>{b.desc}</p>}
              </div>
            ))}
          </div>
        )}

        {/* Form */}
        <div style={{ background: "#FFFFFF", border: "1px solid rgba(0,0,0,.08)", borderRadius: 22, padding: "28px 24px", boxShadow: "0 8px 32px rgba(0,0,0,.06)", marginBottom: 48 }}>
          {done ? (
            <div style={{ textAlign: "center", padding: "12px 0" }}>
              <div style={{ font: "2.5rem/1 serif", marginBottom: 16 }}>🎉</div>
              <h2 style={{ font: `700 1.1rem/1.2 ${fd}`, color: "#111827", margin: "0 0 10px" }}>¡Listo, {name.split(" ")[0]}!</h2>
              <p style={{ font: `400 0.875rem/1.6 ${fd}`, color: "#6B7280", margin: 0 }}>Te contactamos por WhatsApp para coordinar. ¡Nos vemos pronto! 💪</p>
            </div>
          ) : (
            <form onSubmit={onSubmit} style={{ display: "flex", flexDirection: "column", gap: 13 }}>
              <h2 style={{ font: `700 1rem/1 ${fd}`, color: "#111827", margin: "0 0 4px" }}>
                Reservá tu clase gratuita
              </h2>
              <LabelInput dark={false} label="Nombre completo" value={name} onChange={setName} placeholder="Carlos Mendez" />
              <LabelInput dark={false} label="WhatsApp" value={phone} onChange={setPhone} placeholder="5491112345678" type="tel" />
              <LabelInput dark={false} label="Email" value={email} onChange={setEmail} placeholder="carlos@email.com" type="email" />
              <TurnstileWidget onTokenChange={setTurnstileToken} theme="light" resetKey={turnstileResetKey} />
              {error && <p style={{ font: `400 0.8rem/1 ${fd}`, color: "#EF4444", margin: 0 }}>{error}</p>}
              <button type="submit" disabled={sending || !turnstileToken} style={{ marginTop: 4, padding: "15px", borderRadius: 13, border: "none", background: ACCENT, color: "#FFFFFF", font: `700 0.95rem/1 ${fd}`, cursor: sending || !turnstileToken ? "default" : "pointer", opacity: sending || !turnstileToken ? .7 : 1, transition: "opacity .15s" }}>
                {sending ? "Enviando…" : (gym.landing_cta_text ?? "Quiero mi clase gratis →")}
              </button>
              <p style={{ font: `400 0.7rem/1 ${fd}`, color: "#D1D5DB", textAlign: "center", margin: 0 }}>Sin compromisos. Te contactamos por WhatsApp.</p>
            </form>
          )}
        </div>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Template: Impact (ultra dark, big type, minimal)
// ─────────────────────────────────────────────────────────────────────────────
function ImpactTemplate({ gym, ACCENT, onSubmit, fields }: TemplateProps) {
  const { name, setName, phone, setPhone, email, setEmail, sending, done, error, turnstileToken, setTurnstileToken, turnstileResetKey } = fields;
  const isLightAccent = ACCENT === "#FFFFFF" || ACCENT === "#E2E8F0" || ACCENT === "#F1F5F9";
  return (
    <div style={{ minHeight: "100dvh", background: "#060609", fontFamily: fd, display: "flex", flexDirection: "column" }}>
      {/* Logo */}
      <div style={{ padding: "28px 28px 0" }}>
        {gym.logo_url ? (
          <Image src={gym.logo_url} alt={gym.gym_name ?? ""} width={160} height={48} unoptimized style={{ height: 36, width: "auto", objectFit: "contain" }} />
        ) : gym.gym_name ? (
          <p style={{ font: `800 0.7rem/1 ${fd}`, color: "rgba(255,255,255,.35)", letterSpacing: ".16em", textTransform: "uppercase", margin: 0 }}>{gym.gym_name}</p>
        ) : null}
      </div>

      {/* Hero */}
      <div style={{ flex: 1, padding: "40px 28px 0" }}>
        <h1 style={{ font: `900 clamp(2.4rem,8vw,4rem)/1.0 ${fd}`, color: ACCENT, letterSpacing: "-0.04em", margin: "0 0 20px", maxWidth: 520 }}>
          {gym.landing_title ?? "Probá una clase gratis."}
        </h1>
        {gym.landing_subtitle && (
          <p style={{ font: `500 1rem/1.4 ${fd}`, color: "rgba(255,255,255,.55)", margin: "0 0 12px" }}>
            {gym.landing_subtitle}
          </p>
        )}
        <p style={{ font: `400 0.95rem/1.7 ${fd}`, color: "rgba(255,255,255,.35)", margin: "0 0 40px", maxWidth: 420 }}>
          {gym.landing_desc ?? "Vení a conocernos. Te esperamos con una clase de bienvenida totalmente gratis."}
        </p>

        {/* Benefits as a horizontal strip */}
        {(gym.landing_benefits ?? []).length > 0 && (
          <div style={{ display: "flex", flexDirection: "column", gap: 8, marginBottom: 40 }}>
            {(gym.landing_benefits ?? []).map((b, i) => (
              <div key={i} style={{ display: "flex", alignItems: "center", gap: 12 }}>
                <div style={{ width: 1, height: 32, background: ACCENT, flexShrink: 0 }} />
                <p style={{ font: `600 0.85rem/1.2 ${fd}`, color: "rgba(255,255,255,.7)", margin: 0 }}>{b.title}</p>
              </div>
            ))}
          </div>
        )}

        {/* Form */}
        <div style={{ background: "rgba(255,255,255,.03)", border: "1px solid rgba(255,255,255,.06)", borderRadius: 20, padding: "24px 22px", marginBottom: 48, maxWidth: 440 }}>
          {done ? (
            <div style={{ textAlign: "center", padding: "12px 0" }}>
              <div style={{ font: "2.5rem/1 serif", marginBottom: 16 }}>🎉</div>
              <h2 style={{ font: `700 1.1rem/1.2 ${fd}`, color: ACCENT, margin: "0 0 10px" }}>¡Listo, {name.split(" ")[0]}!</h2>
              <p style={{ font: `400 0.875rem/1.6 ${fd}`, color: "rgba(255,255,255,.35)", margin: 0 }}>Te vamos a contactar por WhatsApp. ¡Nos vemos pronto! 💪</p>
            </div>
          ) : (
            <form onSubmit={onSubmit} style={{ display: "flex", flexDirection: "column", gap: 12 }}>
              <LabelInput dark label="Nombre completo" value={name} onChange={setName} placeholder="Carlos Mendez" />
              <LabelInput dark label="WhatsApp" value={phone} onChange={setPhone} placeholder="5491112345678" type="tel" />
              <LabelInput dark label="Email" value={email} onChange={setEmail} placeholder="carlos@email.com" type="email" />
              <TurnstileWidget onTokenChange={setTurnstileToken} theme="dark" resetKey={turnstileResetKey} />
              {error && <p style={{ font: `400 0.8rem/1 ${fd}`, color: "#F87171", margin: 0 }}>{error}</p>}
              <button type="submit" disabled={sending || !turnstileToken} style={{ marginTop: 6, padding: "15px", borderRadius: 12, border: `1px solid ${ACCENT}`, background: isLightAccent ? ACCENT : "transparent", color: isLightAccent ? "#060609" : ACCENT, font: `700 0.95rem/1 ${fd}`, cursor: sending || !turnstileToken ? "default" : "pointer", opacity: sending || !turnstileToken ? .7 : 1, transition: "all .15s" }}>
                {sending ? "Enviando…" : (gym.landing_cta_text ?? "Quiero mi clase gratis →")}
              </button>
            </form>
          )}
        </div>
      </div>
    </div>
  );
}

// ── Shared label+input ────────────────────────────────────────────────────────
function LabelInput({ dark, label, value, onChange, placeholder, type = "text" }: {
  dark: boolean; label: string; value: string;
  onChange: (v: string) => void; placeholder: string; type?: string;
}) {
  const inputStyle = makeInput(dark);
  return (
    <div>
      <label style={{ display: "block", font: `600 0.72rem/1 ${fd}`, color: dark ? "rgba(255,255,255,.45)" : "#9CA3AF", marginBottom: 6, textTransform: "uppercase", letterSpacing: ".07em" }}>
        {label} *
      </label>
      <input required type={type} value={value} onChange={e => onChange(e.target.value)} placeholder={placeholder} style={inputStyle} />
    </div>
  );
}

// ── Template props type ───────────────────────────────────────────────────────
type TemplateProps = {
  gym:       GymData;
  ACCENT:    string;
  onSubmit:  (e: React.FormEvent) => void;
  fields: {
    name: string; setName: (v: string) => void;
    phone: string; setPhone: (v: string) => void;
    email: string; setEmail: (v: string) => void;
    sending: boolean; done: boolean; error: string | null;
    turnstileToken: string | null;
    setTurnstileToken: (token: string | null) => void;
    turnstileResetKey: number;
  };
};

// ─────────────────────────────────────────────────────────────────────────────
// Page
// ─────────────────────────────────────────────────────────────────────────────
export default function GymLandingPage() {
  const params   = useParams<{ slug: string }>();
  const slug     = typeof params?.slug === "string" ? params.slug : "";
  const [gym,      setGym]      = useState<GymData | null>(null);
  const [loading,  setLoading]  = useState(true);
  const [notFound, setNotFound] = useState(false);

  const [name,    setName]    = useState("");
  const [phone,   setPhone]   = useState("");
  const [email,   setEmail]   = useState("");
  const [sending, setSending] = useState(false);
  const [done,    setDone]    = useState(false);
  const [error,   setError]   = useState<string | null>(null);
  const [turnstileToken, setTurnstileToken] = useState<string | null>(null);
  const [turnstileResetKey, setTurnstileResetKey] = useState(0);

  useEffect(() => {
    if (!slug) return;
    (async () => {
      const { data } = await supabase
        .from("gym_settings")
        .select("gym_id, gym_name, logo_url, accent_color, landing_title, landing_subtitle, landing_desc, landing_cta_text, landing_template, landing_benefits")
        .eq("slug", slug)
        .maybeSingle();
      if (!data) { setNotFound(true); setLoading(false); return; }
      setGym(data);
      setLoading(false);
    })();
  }, [slug]);

  const ACCENT = gym?.accent_color ?? "#F97316";

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!gym) return;
    if (!turnstileToken && process.env.NODE_ENV === "production") {
      setError("Completá la validación de seguridad.");
      return;
    }
    setSending(true); setError(null);
    const res  = await fetch("/api/gym/lead", {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ gymId: gym.gym_id, name: name.trim(), phone: phone.trim(), email: email.trim(), turnstileToken }),
    });
    const data = await res.json();
    if (!res.ok) {
      setError(data.error ?? "Error al enviar. Intentá de nuevo.");
      setSending(false);
      setTurnstileToken(null);
      setTurnstileResetKey((value) => value + 1);
      return;
    }
    setDone(true); setSending(false);
  };

  const fields = { name, setName, phone, setPhone, email, setEmail, sending, done, error, turnstileToken, setTurnstileToken, turnstileResetKey };

  if (loading) return (
    <div style={{ minHeight: "100dvh", background: "#0D1117", display: "flex", alignItems: "center", justifyContent: "center" }}>
      <p style={{ color: "rgba(255,255,255,.35)", fontFamily: fd }}>Cargando…</p>
    </div>
  );

  if (notFound || !gym) return (
    <div style={{ minHeight: "100dvh", background: "#0D1117", display: "flex", alignItems: "center", justifyContent: "center" }}>
      <p style={{ color: "rgba(255,255,255,.35)", fontFamily: fd }}>Página no encontrada.</p>
    </div>
  );

  const tmpl = gym.landing_template ?? "energia";

  if (tmpl === "pro")    return <ProTemplate    gym={gym} ACCENT={ACCENT} onSubmit={submit} fields={fields} />;
  if (tmpl === "impact") return <ImpactTemplate gym={gym} ACCENT={ACCENT} onSubmit={submit} fields={fields} />;
  return                        <EnergiaTemplate gym={gym} ACCENT={ACCENT} onSubmit={submit} fields={fields} />;
}
