"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { supabase } from "@/lib/supabase";
import { getCachedProfile } from "@/lib/gym-cache";
import {
  ExternalLink, Copy, Check, Save, Loader2, Globe, Zap, Users,
  Calendar, Heart, Star, Target, Shield, Clock, Trophy, Plus,
  Trash2, Dumbbell, ChevronRight, AlertTriangle, X, Link2, Sparkles,
} from "lucide-react";

// ── Types ─────────────────────────────────────────────────────────────────────
type Template   = "energia" | "pro" | "impact";
type BenefitKey = "Dumbbell"|"Zap"|"Users"|"Calendar"|"Heart"|"Star"|"Target"|"Shield"|"Clock"|"Trophy";
type Benefit    = { icon: BenefitKey; title: string; desc: string };

// ── Theme ─────────────────────────────────────────────────────────────────────
const fd = "var(--font-inter,'Inter',sans-serif)";
const t1 = "#1A1D23"; const t2 = "#6B7280"; const t3 = "#9CA3AF";
const card: React.CSSProperties = {
  background: "#FFFFFF",
  border: "1px solid rgba(15,23,42,0.06)",
  borderRadius: 22,
  boxShadow: "0 10px 30px rgba(15,23,42,0.06)",
};
const inputSt: React.CSSProperties = {
  width: "100%", padding: "11px 14px",
  background: "#F8FAFC", border: "1px solid rgba(15,23,42,0.08)",
  borderRadius: 12, font: `400 0.875rem/1.4 ${fd}`, color: t1,
  outline: "none", boxSizing: "border-box",
};
const textareaSt: React.CSSProperties = {
  ...inputSt, resize: "vertical" as const, minHeight: 80,
};

// ── Templates config ──────────────────────────────────────────────────────────
const TEMPLATES = [
  {
    id:      "energia"  as Template,
    name:    "Energía",
    tagline: "Oscuro · Potente · Gym clásico",
    bg:      "#0D1117",
    accent:  "#F97316",
    dark:    true,
  },
  {
    id:      "pro"      as Template,
    name:    "Pro Clean",
    tagline: "Claro · Sofisticado · Boutique fitness",
    bg:      "#FAFAF8",
    accent:  "#2563EB",
    dark:    false,
  },
  {
    id:      "impact"   as Template,
    name:    "Impact",
    tagline: "Minimalista · Audaz · Gym premium",
    bg:      "#060609",
    accent:  "#E2E8F0",
    dark:    true,
  },
] as const;

// ── Icons ─────────────────────────────────────────────────────────────────────
const ICON_MAP: Record<BenefitKey, React.ComponentType<{ size?: number; color?: string }>> = {
  Dumbbell: Dumbbell, Zap: Zap, Users: Users, Calendar: Calendar,
  Heart: Heart, Star: Star, Target: Target, Shield: Shield,
  Clock: Clock, Trophy: Trophy,
};

const ICON_KEYS: BenefitKey[] = ["Dumbbell","Zap","Users","Calendar","Heart","Star","Target","Shield","Clock","Trophy"];

const DEFAULT_BENEFITS: Benefit[] = [
  { icon: "Dumbbell", title: "Equipamiento moderno",      desc: "Máquinas de última generación y zona de pesos libres." },
  { icon: "Users",    title: "Entrenadores certificados", desc: "Guía personalizada para alcanzar tus metas." },
  { icon: "Calendar", title: "Horarios flexibles",        desc: "Clases de mañana, tarde y noche. Elegí el tuyo." },
];

const PRESET_COLORS = [
  "#F97316","#EF4444","#E11D48","#7C3AED","#2563EB","#0EA5E9","#16A34A","#CA8A04","#111827","#FFFFFF",
];

// ── Tabs ──────────────────────────────────────────────────────────────────────
const TABS = [
  { key: "plantilla",  label: "Plantilla" },
  { key: "contenido",  label: "Contenido" },
  { key: "diseno",     label: "Diseño"    },
  { key: "publicar",   label: "Publicar"  },
  { key: "midominio",  label: "Mi dominio" },
] as const;
type Tab = typeof TABS[number]["key"];

// ─────────────────────────────────────────────────────────────────────────────
// Live Preview component
// ─────────────────────────────────────────────────────────────────────────────
function LivePreview({
  template, title, subtitle, desc, ctaText, accent,
  benefits, logoUrl, gymName,
}: {
  template: Template; title: string; subtitle: string; desc: string;
  ctaText: string; accent: string; benefits: Benefit[];
  logoUrl: string | null; gymName: string;
}) {
  const bg        = TEMPLATES.find(t => t.id === template)?.bg ?? "#0D1117";
  const isDark    = TEMPLATES.find(t => t.id === template)?.dark ?? true;
  const txt       = isDark ? "#FFFFFF"         : "#111827";
  const txtMuted  = isDark ? "rgba(255,255,255,.5)" : "#6B7280";
  const cardBg    = isDark ? "rgba(255,255,255,.05)" : "#FFFFFF";
  const cardBorder= isDark ? "rgba(255,255,255,.08)" : "rgba(0,0,0,.07)";

  return (
    <div style={{
      width: 375, background: bg, fontFamily: fd,
      minHeight: 700, padding: template === "impact" ? 0 : 0,
    }}>
      {/* Hero */}
      <div style={{ padding: "48px 28px 32px", textAlign: "center" }}>
        {logoUrl && (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={logoUrl} alt={gymName} style={{ height: 44, width: "auto", objectFit: "contain", margin: "0 auto 24px", display: "block" }} />
        )}
        {!logoUrl && gymName && (
          <p style={{ font: `800 0.75rem/1 ${fd}`, color: accent, letterSpacing: ".14em", textTransform: "uppercase", marginBottom: 24 }}>
            {gymName}
          </p>
        )}
        <h1 style={{
          font: `800 ${template === "impact" ? "2rem" : "1.65rem"}/1.1 ${fd}`,
          color: template === "impact" ? accent : txt,
          letterSpacing: "-0.025em", margin: "0 0 12px",
        }}>
          {title || "Tu titular aquí"}
        </h1>
        {subtitle && (
          <p style={{ font: `600 1rem/1.4 ${fd}`, color: template === "impact" ? txtMuted : accent, margin: "0 0 10px" }}>
            {subtitle}
          </p>
        )}
        <p style={{ font: `400 0.875rem/1.6 ${fd}`, color: txtMuted, margin: 0 }}>
          {desc || "Tu descripción aquí."}
        </p>
      </div>

      {/* Benefits */}
      {benefits.length > 0 && (
        <div style={{ padding: "0 20px 32px", display: "flex", flexDirection: "column", gap: 10 }}>
          {benefits.map((b, i) => {
            const Icon = ICON_MAP[b.icon] ?? Dumbbell;
            return (
              <div key={i} style={{
                display: "flex", alignItems: "flex-start", gap: 12,
                background: cardBg, border: `1px solid ${cardBorder}`,
                borderRadius: 14, padding: "14px 16px",
              }}>
                <div style={{ width: 36, height: 36, borderRadius: 10, background: `${accent}22`, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                  <Icon size={16} color={accent} />
                </div>
                <div>
                  <p style={{ font: `700 0.82rem/1.2 ${fd}`, color: txt, margin: "0 0 3px" }}>{b.title || "Beneficio"}</p>
                  <p style={{ font: `400 0.75rem/1.5 ${fd}`, color: txtMuted, margin: 0 }}>{b.desc || ""}</p>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Form mock */}
      <div style={{ margin: "0 20px 40px", background: cardBg, border: `1px solid ${cardBorder}`, borderRadius: 18, padding: "20px 18px" }}>
        <p style={{ font: `700 0.9rem/1 ${fd}`, color: txt, textAlign: "center", margin: "0 0 16px" }}>
          Agendá tu clase gratis
        </p>
        {["Nombre completo", "WhatsApp", "Email"].map(ph => (
          <div key={ph} style={{ height: 40, background: isDark ? "rgba(255,255,255,.07)" : "rgba(0,0,0,.05)", borderRadius: 10, marginBottom: 10 }} />
        ))}
        <div style={{ height: 44, borderRadius: 12, background: accent, display: "flex", alignItems: "center", justifyContent: "center" }}>
          <p style={{ font: `700 0.82rem/1 ${fd}`, color: (accent === "#E2E8F0" || accent === "#FFFFFF") ? "#111827" : "#FFFFFF", margin: 0 }}>
            {ctaText || "Quiero mi clase gratis →"}
          </p>
        </div>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Main Page
// ─────────────────────────────────────────────────────────────────────────────
export default function LandingBuilderPage() {
  const [tab,        setTab]        = useState<Tab>("plantilla");
  const [template,   setTemplate]   = useState<Template>("energia");
  const [title,      setTitle]      = useState("Probá una clase gratis.");
  const [subtitle,   setSubtitle]   = useState("El primer paso empieza hoy.");
  const [desc,       setDesc]       = useState("Vení a conocernos. Te esperamos con una clase de bienvenida totalmente gratis, sin compromiso.");
  const [ctaText,    setCtaText]    = useState("Quiero mi clase gratis →");
  const [accent,     setAccent]     = useState("#F97316");
  const [benefits,   setBenefits]   = useState<Benefit[]>(DEFAULT_BENEFITS);
  const [slug,       setSlug]       = useState("");
  const [gymName,    setGymName]    = useState("");
  const [logoUrl,    setLogoUrl]    = useState<string | null>(null);
  const [gymId,      setGymId]      = useState<string | null>(null);
  const [loading,    setLoading]    = useState(true);
  const [saving,     setSaving]     = useState(false);
  const [saved,      setSaved]      = useState(false);
  const [copied,     setCopied]     = useState(false);
  const [isMobile,   setIsMobile]   = useState(false);
  const [iconPickerIdx, setIconPickerIdx] = useState<number | null>(null);
  const [customWebsite, setCustomWebsite] = useState("");
  const [customDomain,  setCustomDomain]  = useState("");
  const [domainSaving,  setDomainSaving]  = useState(false);
  const [domainSaved,   setDomainSaved]   = useState(false);
  const [showLandingUpsell, setShowLandingUpsell] = useState(false);
  const [upsellName,    setUpsellName]    = useState("");
  const [upsellEmail,   setUpsellEmail]   = useState("");
  const [upsellPhone,   setUpsellPhone]   = useState("");
  const [upsellLoading, setUpsellLoading] = useState(false);
  const [upsellDone,    setUpsellDone]    = useState(false);

  useEffect(() => {
    const check = () => setIsMobile(window.innerWidth < 1024);
    check();
    window.addEventListener("resize", check);
    return () => window.removeEventListener("resize", check);
  }, []);

  useEffect(() => {
    (async () => {
      const profile = await getCachedProfile();
      if (!profile) return;
      setGymId(profile.gymId);

      const { data } = await supabase
        .from("gym_settings")
        .select("gym_name, logo_url, accent_color, landing_title, landing_desc, landing_template, landing_subtitle, landing_cta_text, landing_benefits, slug, custom_website, custom_domain")
        .eq("gym_id", profile.gymId)
        .maybeSingle();

      if (data) {
        setGymName(data.gym_name ?? "");
        setLogoUrl(data.logo_url ?? null);
        setSlug(data.slug ?? "");
        if (data.landing_template) setTemplate(data.landing_template as Template);
        if (data.accent_color)     setAccent(data.accent_color);
        if (data.landing_title)    setTitle(data.landing_title);
        if (data.landing_desc)     setDesc(data.landing_desc);
        if (data.landing_subtitle) setSubtitle(data.landing_subtitle);
        if (data.landing_cta_text) setCtaText(data.landing_cta_text);
        if (Array.isArray(data.landing_benefits) && data.landing_benefits.length > 0) {
          setBenefits(data.landing_benefits as Benefit[]);
        }
        if (data.custom_website) setCustomWebsite(data.custom_website);
        if (data.custom_domain)  setCustomDomain(data.custom_domain);
      }
      setLoading(false);
    })();
  }, []);

  const handleSave = async () => {
    if (!gymId || saving) return;
    setSaving(true);
    await supabase.from("gym_settings").update({
      landing_template: template,
      accent_color:     accent,
      landing_title:    title.trim()    || null,
      landing_desc:     desc.trim()     || null,
      landing_subtitle: subtitle.trim() || null,
      landing_cta_text: ctaText.trim()  || null,
      landing_benefits: benefits,
    }).eq("gym_id", gymId);
    setSaving(false);
    setSaved(true);
    setTimeout(() => setSaved(false), 2500);
  };

  const handleDomainSave = async () => {
    if (!gymId || domainSaving) return;
    setDomainSaving(true);
    await supabase.from("gym_settings").update({
      custom_website: customWebsite.trim() || null,
      custom_domain:  customDomain.trim()  || null,
    }).eq("gym_id", gymId);
    setDomainSaving(false);
    setDomainSaved(true);
    setTimeout(() => setDomainSaved(false), 2500);
  };

  const copyLink = () => {
    if (!slug) return;
    navigator.clipboard.writeText(`${process.env.NEXT_PUBLIC_APP_URL ?? "https://fitgrowx.com"}/gym/${slug}`);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const addBenefit = () => {
    if (benefits.length >= 4) return;
    setBenefits(prev => [...prev, { icon: "Zap", title: "", desc: "" }]);
  };

  const removeBenefit = (i: number) => setBenefits(prev => prev.filter((_, idx) => idx !== i));

  const updateBenefit = (i: number, field: keyof Benefit, val: string) => {
    setBenefits(prev => prev.map((b, idx) => idx === i ? { ...b, [field]: val } : b));
  };

  async function submitUpsell(type: "landing_pro" | "whitelabel") {
    setUpsellLoading(true);
    try {
      await fetch("/api/upsell/lead", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: upsellName, email: upsellEmail, phone: upsellPhone, gym_name: gymName, type }),
      });
      setUpsellDone(true);
    } finally {
      setUpsellLoading(false);
    }
  }

  const landingUrl = slug
    ? `${process.env.NEXT_PUBLIC_APP_URL ?? "https://fitgrowx.com"}/gym/${slug}`
    : null;

  if (loading) return (
    <div style={{ display: "flex", alignItems: "center", justifyContent: "center", minHeight: "60vh" }}>
      <Loader2 size={22} color={t3} style={{ animation: "spin 1s linear infinite" }} />
      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </div>
  );

  // ── Layout ─────────────────────────────────────────────────────────────────
  return (
    <>
    <div style={{ fontFamily: fd, display: "flex", flexDirection: "column", gap: 0, minHeight: "100%" }}>

      {/* ── Header ── */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 20, gap: 12, flexWrap: "wrap" }}>
        <div>
          <h1 style={{ font: `800 1.5rem/1.1 ${fd}`, color: t1, margin: "0 0 4px", letterSpacing: "-0.02em" }}>
            Mi Web / Landing
          </h1>
          <p style={{ font: `400 0.85rem/1 ${fd}`, color: t2, margin: 0 }}>
            Personalizá la página pública de tu gimnasio para captar nuevos alumnos.
          </p>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          {landingUrl && (
            <Link
              href={landingUrl}
              target="_blank"
              style={{ display: "flex", alignItems: "center", gap: 6, padding: "9px 14px", borderRadius: 10, border: "1px solid rgba(15,23,42,0.10)", background: "#FFFFFF", color: t1, textDecoration: "none", font: `500 0.82rem/1 ${fd}` }}
            >
              <ExternalLink size={13} />
              Ver página
            </Link>
          )}
          <button
            onClick={handleSave}
            disabled={saving}
            style={{
              display: "flex", alignItems: "center", gap: 7,
              padding: "9px 20px", borderRadius: 10, border: "none",
              background: saved ? "#16A34A" : "#1A1D23", color: "#FFFFFF",
              font: `600 0.875rem/1 ${fd}`, cursor: saving ? "wait" : "pointer",
              transition: "background .2s", opacity: saving ? .7 : 1,
            }}
          >
            {saving ? <Loader2 size={14} style={{ animation: "spin 1s linear infinite" }} />
              : saved ? <Check size={14} />
              : <Save size={14} />}
            {saving ? "Guardando…" : saved ? "Guardado" : "Guardar"}
          </button>
        </div>
      </div>

      {/* ── Body ── */}
      <div style={{ display: "flex", gap: 16, alignItems: "flex-start", flex: 1 }}>

        {/* ── Settings panel ── */}
        <div style={{ ...card, padding: 0, width: isMobile ? "100%" : 400, flexShrink: 0, overflow: "hidden" }}>

          {/* Tabs */}
          <div style={{ display: "flex", borderBottom: "1px solid rgba(15,23,42,0.06)" }}>
            {TABS.map(t => (
              <button
                key={t.key}
                onClick={() => setTab(t.key)}
                style={{
                  flex: 1, padding: "14px 4px", border: "none", background: "none",
                  font: `${tab === t.key ? 700 : 500} 0.78rem/1 ${fd}`,
                  color: tab === t.key ? t1 : t3,
                  borderBottom: tab === t.key ? `2px solid ${t1}` : "2px solid transparent",
                  cursor: "pointer", transition: "all .15s", marginBottom: -1,
                }}
              >
                {t.label}
              </button>
            ))}
          </div>

          <div style={{ padding: "22px 20px", display: "flex", flexDirection: "column", gap: 20 }}>

            {/* ── TAB: Plantilla ── */}
            {tab === "plantilla" && (
              <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                <p style={{ font: `600 0.75rem/1 ${fd}`, color: t3, letterSpacing: ".08em", textTransform: "uppercase", margin: 0 }}>
                  Elegí el estilo de tu landing
                </p>
                {TEMPLATES.map(tmpl => (
                  <button
                    key={tmpl.id}
                    onClick={() => {
                      setTemplate(tmpl.id);
                      setAccent(tmpl.accent);
                    }}
                    style={{
                      display: "flex", gap: 0, borderRadius: 14, overflow: "hidden",
                      border: template === tmpl.id ? `2px solid ${t1}` : "2px solid rgba(15,23,42,0.07)",
                      background: "none", cursor: "pointer", textAlign: "left",
                      transition: "border-color .15s",
                    }}
                  >
                    {/* Color swatch */}
                    <div style={{
                      width: 72, flexShrink: 0, background: tmpl.bg,
                      display: "flex", flexDirection: "column", alignItems: "center",
                      justifyContent: "center", gap: 6, padding: "18px 12px",
                    }}>
                      <div style={{ width: 32, height: 5, borderRadius: 3, background: tmpl.dark ? "rgba(255,255,255,.25)" : "rgba(0,0,0,.15)" }} />
                      <div style={{ width: 24, height: 5, borderRadius: 3, background: tmpl.dark ? "rgba(255,255,255,.15)" : "rgba(0,0,0,.1)" }} />
                      <div style={{ width: 40, height: 18, borderRadius: 6, background: tmpl.accent, marginTop: 4 }} />
                    </div>
                    {/* Info */}
                    <div style={{ padding: "14px 16px", flex: 1 }}>
                      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 4 }}>
                        <p style={{ font: `700 0.875rem/1 ${fd}`, color: t1, margin: 0 }}>{tmpl.name}</p>
                        {template === tmpl.id && (
                          <div style={{ width: 18, height: 18, borderRadius: "50%", background: t1, display: "flex", alignItems: "center", justifyContent: "center" }}>
                            <Check size={11} color="white" />
                          </div>
                        )}
                      </div>
                      <p style={{ font: `400 0.78rem/1.4 ${fd}`, color: t2, margin: 0 }}>{tmpl.tagline}</p>
                    </div>
                  </button>
                ))}
              </div>
            )}

            {/* ── TAB: Contenido ── */}
            {tab === "contenido" && (
              <div style={{ display: "flex", flexDirection: "column", gap: 18 }}>

                {/* Titular */}
                <FieldGroup label="Titular principal" hint={`${title.length}/70 chars`}>
                  <input
                    value={title}
                    onChange={e => setTitle(e.target.value)}
                    maxLength={70}
                    placeholder="Probá una clase gratis."
                    style={inputSt}
                  />
                </FieldGroup>

                {/* Subtítulo */}
                <FieldGroup label="Subtítulo" hint="Frase de impacto breve">
                  <input
                    value={subtitle}
                    onChange={e => setSubtitle(e.target.value)}
                    maxLength={80}
                    placeholder="El primer paso empieza hoy."
                    style={inputSt}
                  />
                </FieldGroup>

                {/* Descripción */}
                <FieldGroup label="Descripción" hint={`${desc.length}/220 chars`}>
                  <textarea
                    value={desc}
                    onChange={e => setDesc(e.target.value)}
                    maxLength={220}
                    placeholder="Vení a conocernos. Te esperamos con una clase de bienvenida totalmente gratis."
                    style={textareaSt}
                  />
                </FieldGroup>

                {/* CTA */}
                <FieldGroup label="Texto del botón" hint="Llamado a la acción">
                  <input
                    value={ctaText}
                    onChange={e => setCtaText(e.target.value)}
                    maxLength={50}
                    placeholder="Quiero mi clase gratis →"
                    style={inputSt}
                  />
                </FieldGroup>

                {/* Benefits */}
                <div>
                  <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 10 }}>
                    <p style={{ font: `600 0.82rem/1 ${fd}`, color: t1, margin: 0 }}>
                      Beneficios <span style={{ color: t3, fontWeight: 400 }}>({benefits.length}/4)</span>
                    </p>
                    {benefits.length < 4 && (
                      <button
                        onClick={addBenefit}
                        style={{ display: "flex", alignItems: "center", gap: 5, padding: "5px 10px", borderRadius: 8, border: "1px solid rgba(15,23,42,0.10)", background: "none", font: `500 0.75rem/1 ${fd}`, color: t2, cursor: "pointer" }}
                      >
                        <Plus size={12} />
                        Agregar
                      </button>
                    )}
                  </div>
                  <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
                    {benefits.map((b, i) => {
                      const BIcon = ICON_MAP[b.icon] ?? Dumbbell;
                      return (
                        <div key={i} style={{ background: "#F8FAFC", borderRadius: 14, padding: "14px", border: "1px solid rgba(15,23,42,0.06)" }}>
                          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 10 }}>
                            {/* Icon picker button */}
                            <button
                              onClick={() => setIconPickerIdx(iconPickerIdx === i ? null : i)}
                              style={{ display: "flex", alignItems: "center", gap: 6, padding: "6px 10px", borderRadius: 8, border: "1px solid rgba(15,23,42,0.10)", background: "#FFFFFF", cursor: "pointer" }}
                            >
                              <BIcon size={14} color={t2} />
                              <span style={{ font: `500 0.72rem/1 ${fd}`, color: t2 }}>Ícono</span>
                            </button>
                            <button
                              onClick={() => removeBenefit(i)}
                              style={{ background: "none", border: "none", cursor: "pointer", color: "#EF4444", padding: 4, display: "flex" }}
                            >
                              <Trash2 size={13} />
                            </button>
                          </div>

                          {/* Icon picker dropdown */}
                          {iconPickerIdx === i && (
                            <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginBottom: 10, background: "#FFFFFF", borderRadius: 10, padding: 10, border: "1px solid rgba(15,23,42,0.08)" }}>
                              {ICON_KEYS.map(k => {
                                const Ic = ICON_MAP[k];
                                return (
                                  <button
                                    key={k}
                                    onClick={() => { updateBenefit(i, "icon", k); setIconPickerIdx(null); }}
                                    style={{
                                      width: 34, height: 34, borderRadius: 8,
                                      border: b.icon === k ? `2px solid ${t1}` : "1px solid rgba(15,23,42,0.09)",
                                      background: b.icon === k ? "#1A1D23" : "none",
                                      display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer",
                                    }}
                                  >
                                    <Ic size={14} color={b.icon === k ? "white" : t2} />
                                  </button>
                                );
                              })}
                            </div>
                          )}

                          <input
                            value={b.title}
                            onChange={e => updateBenefit(i, "title", e.target.value)}
                            placeholder="Ej: Equipamiento moderno"
                            maxLength={40}
                            style={{ ...inputSt, marginBottom: 8, background: "#FFFFFF" }}
                          />
                          <input
                            value={b.desc}
                            onChange={e => updateBenefit(i, "desc", e.target.value)}
                            placeholder="Descripción breve (opcional)"
                            maxLength={80}
                            style={{ ...inputSt, background: "#FFFFFF" }}
                          />
                        </div>
                      );
                    })}
                    {benefits.length === 0 && (
                      <p style={{ font: `400 0.8rem/1 ${fd}`, color: t3, textAlign: "center", padding: "16px 0" }}>
                        Sin beneficios. Agregá hasta 4 para destacar tu gym.
                      </p>
                    )}
                  </div>
                </div>
              </div>
            )}

            {/* ── TAB: Diseño ── */}
            {tab === "diseno" && (
              <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
                <FieldGroup label="Color principal" hint="Color del botón CTA y acentos">
                  {/* Presets */}
                  <div style={{ display: "flex", flexWrap: "wrap", gap: 8, marginBottom: 12 }}>
                    {PRESET_COLORS.map(c => (
                      <button
                        key={c}
                        onClick={() => setAccent(c)}
                        style={{
                          width: 32, height: 32, borderRadius: "50%",
                          background: c, border: accent === c ? "3px solid #1A1D23" : "3px solid transparent",
                          outline: accent === c ? "2px solid rgba(255,255,255,0.9)" : "none",
                          outlineOffset: 1, cursor: "pointer",
                          boxShadow: c === "#FFFFFF" ? "inset 0 0 0 1px rgba(0,0,0,.15)" : "none",
                        }}
                      />
                    ))}
                  </div>
                  {/* Custom */}
                  <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                    <input type="color" value={accent} onChange={e => setAccent(e.target.value)}
                      style={{ width: 48, height: 40, borderRadius: 10, border: "1px solid rgba(15,23,42,0.10)", background: "none", cursor: "pointer", padding: 3 }} />
                    <input value={accent} onChange={e => setAccent(e.target.value)}
                      placeholder="#F97316" style={{ ...inputSt, flex: 1, fontFamily: "monospace", fontSize: "0.85rem" }} />
                  </div>
                </FieldGroup>

                <div style={{ background: "rgba(37,99,235,0.06)", border: "1px solid rgba(37,99,235,0.12)", borderRadius: 12, padding: "12px 14px", display: "flex", gap: 10 }}>
                  <AlertTriangle size={14} color="#2563EB" style={{ flexShrink: 0, marginTop: 1 }} />
                  <p style={{ font: `400 0.78rem/1.5 ${fd}`, color: "#1D4ED8", margin: 0 }}>
                    El color que elijas se aplica al botón CTA y a los íconos de beneficios. Probá combinaciones en el preview de la derecha.
                  </p>
                </div>
              </div>
            )}

            {/* ── TAB: Publicar ── */}
            {tab === "publicar" && (
              <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
                {!slug ? (
                  <div style={{ background: "rgba(245,158,11,0.07)", border: "1px solid rgba(245,158,11,0.2)", borderRadius: 12, padding: "14px 16px" }}>
                    <p style={{ font: `600 0.82rem/1.5 ${fd}`, color: "#92400E", margin: 0 }}>
                      Configurá el slug de tu gym en Ajustes → General para obtener tu link único.
                    </p>
                    <Link href="/dashboard/ajustes?tab=general" style={{ font: `600 0.78rem/1 ${fd}`, color: "#B45309", marginTop: 8, display: "flex", alignItems: "center", gap: 4 }}>
                      Ir a Ajustes <ChevronRight size={12} />
                    </Link>
                  </div>
                ) : (
                  <>
                    {customWebsite ? (
                      <div style={{ background: "rgba(22,163,74,0.06)", border: "1px solid rgba(22,163,74,0.2)", borderRadius: 14, padding: "16px 18px" }}>
                        <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 6 }}>
                          <div style={{ width: 8, height: 8, borderRadius: "50%", background: "#16A34A" }} />
                          <p style={{ font: `700 0.78rem/1 ${fd}`, color: "#15803D" }}>Sitio web propio conectado</p>
                        </div>
                        <p style={{ font: `400 0.75rem/1.4 ${fd}`, color: "#166534", marginBottom: 12 }}>
                          Este link reemplaza tu landing de FitGrowX en todos lados.
                        </p>
                        <a href={customWebsite} target="_blank" rel="noopener noreferrer" style={{ font: `600 0.8rem/1 ${fd}`, color: "#15803D", wordBreak: "break-all" }}>
                          {customWebsite}
                        </a>
                        <button onClick={() => setTab("midominio")} style={{ display: "block", marginTop: 10, font: `600 0.72rem/1 ${fd}`, color: t2, background: "none", border: "none", cursor: "pointer", padding: 0 }}>
                          Cambiar → Mi dominio
                        </button>
                      </div>
                    ) : (
                      <>
                        <FieldGroup label="Tu link de landing" hint="Compartilo en redes o usalo en tus anuncios">
                          <div style={{ display: "flex", gap: 8 }}>
                            <input
                              readOnly
                              value={`fitgrowx.com/gym/${slug}`}
                              style={{ ...inputSt, flex: 1, background: "#F1F5F9", color: t2 }}
                            />
                            <button
                              onClick={copyLink}
                              style={{ display: "flex", alignItems: "center", gap: 6, padding: "11px 16px", borderRadius: 12, border: "1px solid rgba(15,23,42,0.10)", background: copied ? "#16A34A" : "#FFFFFF", color: copied ? "#FFFFFF" : t1, font: `600 0.82rem/1 ${fd}`, cursor: "pointer", transition: "all .15s", whiteSpace: "nowrap" }}
                            >
                              {copied ? <Check size={13} /> : <Copy size={13} />}
                              {copied ? "Copiado" : "Copiar"}
                            </button>
                          </div>
                        </FieldGroup>
                        <Link
                          href={`/gym/${slug}`}
                          target="_blank"
                          style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 8, padding: "13px", borderRadius: 12, background: "#1A1D23", color: "#FFFFFF", textDecoration: "none", font: `600 0.875rem/1 ${fd}` }}
                        >
                          <Globe size={15} />
                          Ver mi landing en vivo
                        </Link>
                      </>
                    )}

                    <div style={{ background: "#F8FAFC", borderRadius: 14, padding: "16px", border: "1px solid rgba(15,23,42,0.06)" }}>
                      <p style={{ font: `600 0.78rem/1 ${fd}`, color: t2, marginBottom: 10, letterSpacing: ".06em", textTransform: "uppercase" }}>Dónde usar este link</p>
                      {[
                        "Bio de Instagram",
                        "Anuncios de Meta / Google",
                        "Historias con sticker de link",
                        "WhatsApp Business",
                      ].map(item => (
                        <div key={item} style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 7 }}>
                          <div style={{ width: 6, height: 6, borderRadius: "50%", background: "#16A34A", flexShrink: 0 }} />
                          <p style={{ font: `400 0.82rem/1 ${fd}`, color: t2, margin: 0 }}>{item}</p>
                        </div>
                      ))}
                    </div>

                    {/* ── Upsell: landing profesional ── */}
                    <div style={{ background: "linear-gradient(135deg,#0D1117 0%,#1A1D23 100%)", borderRadius: 16, padding: "18px 20px", border: "1px solid rgba(255,255,255,0.06)" }}>
                      <p style={{ font: `700 0.65rem/1 ${fd}`, color: "#F97316", textTransform: "uppercase", letterSpacing: ".08em", marginBottom: 6 }}>Servicio premium</p>
                      <p style={{ font: `800 0.95rem/1.3 ${fd}`, color: "#FFFFFF", marginBottom: 4 }}>¿Te parece básica tu landing?</p>
                      <p style={{ font: `400 0.78rem/1.4 ${fd}`, color: "rgba(255,255,255,0.50)", marginBottom: 14 }}>Te dejamos una web como la de <strong style={{ color: "rgba(255,255,255,0.75)" }}>estilogym.com.ar</strong> — con tu marca, dominio y hosting.</p>
                      <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                        <a href="https://estilogym.com.ar" target="_blank" rel="noopener noreferrer" style={{ display: "inline-flex", alignItems: "center", gap: 6, padding: "9px 14px", borderRadius: 10, border: "1px solid rgba(255,255,255,0.14)", background: "rgba(255,255,255,0.07)", color: "rgba(255,255,255,0.85)", font: `700 0.78rem/1 ${fd}`, textDecoration: "none", cursor: "pointer" }}>
                          <ExternalLink size={12} /> Ver ejemplo
                        </a>
                        <button onClick={() => { setShowLandingUpsell(true); setUpsellDone(false); }} style={{ display: "inline-flex", alignItems: "center", gap: 6, padding: "9px 14px", borderRadius: 10, border: "none", background: "#F97316", color: "#FFFFFF", font: `800 0.78rem/1 ${fd}`, cursor: "pointer" }}>
                          Quiero la mía →
                        </button>
                      </div>
                    </div>
                  </>
                )}
              </div>
            )}

            {/* ── TAB: Mi dominio ── */}
            {tab === "midominio" && (
              <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>

                {/* Ya tengo web */}
                <div style={{ ...card, padding: "18px 20px" }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 6 }}>
                    <div style={{ width: 34, height: 34, borderRadius: 10, background: "rgba(22,163,74,0.10)", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                      <Globe size={16} color="#16A34A" />
                    </div>
                    <div>
                      <p style={{ font: `700 0.88rem/1 ${fd}`, color: t1 }}>Ya tengo un sitio web</p>
                      <p style={{ font: `400 0.73rem/1 ${fd}`, color: t3 }}>Conectalo y reemplaza la landing de FitGrowX</p>
                    </div>
                  </div>
                  <p style={{ font: `400 0.78rem/1.5 ${fd}`, color: t2, marginBottom: 14 }}>
                    Si ya tenés tu propio sitio, ingresá la URL. Va a reemplazar el link de landing generado por FitGrowX en todos lados.
                  </p>
                  <FieldGroup label="URL de tu sitio web">
                    <input
                      value={customWebsite}
                      onChange={e => setCustomWebsite(e.target.value)}
                      placeholder="https://migimnasio.com"
                      style={{ ...inputSt }}
                    />
                  </FieldGroup>
                  {customWebsite && (
                    <div style={{ display: "flex", alignItems: "center", gap: 8, marginTop: 10 }}>
                      <div style={{ width: 6, height: 6, borderRadius: "50%", background: "#16A34A", flexShrink: 0 }} />
                      <p style={{ font: `600 0.75rem/1.4 ${fd}`, color: "#15803D" }}>Tu sitio va a aparecer en lugar de la landing de FitGrowX.</p>
                    </div>
                  )}
                </div>

                {/* Dominio propio para la landing */}
                <div style={{ ...card, padding: "18px 20px" }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 6 }}>
                    <div style={{ width: 34, height: 34, borderRadius: 10, background: "rgba(37,99,235,0.10)", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                      <Link2 size={16} color="#2563EB" />
                    </div>
                    <div>
                      <p style={{ font: `700 0.88rem/1 ${fd}`, color: t1 }}>Dominio propio para tu landing FitGrowX</p>
                      <p style={{ font: `400 0.73rem/1 ${fd}`, color: t3 }}>Tu landing, en tu dominio</p>
                    </div>
                  </div>
                  <p style={{ font: `400 0.78rem/1.5 ${fd}`, color: t2, marginBottom: 14 }}>
                    Si querés que tu landing FitGrowX se vea en tu propio dominio (ej: <em>reservas.migimnasio.com</em>), ingresalo acá y seguí los pasos.
                  </p>
                  <FieldGroup label="Tu dominio">
                    <input
                      value={customDomain}
                      onChange={e => setCustomDomain(e.target.value)}
                      placeholder="reservas.migimnasio.com"
                      style={{ ...inputSt }}
                    />
                  </FieldGroup>
                  {customDomain && (
                    <div style={{ background: "#F8FAFC", borderRadius: 12, padding: "14px 16px", marginTop: 12, border: "1px solid rgba(15,23,42,0.07)" }}>
                      <p style={{ font: `600 0.72rem/1 ${fd}`, color: t2, marginBottom: 12, textTransform: "uppercase", letterSpacing: ".06em" }}>Pasos para activar</p>
                      {[
                        `Ingresá al panel de tu proveedor de dominio (Nic.ar, GoDaddy, Namecheap…)`,
                        `Creá un registro CNAME: ${customDomain} → cname.vercel-dns.com`,
                        `Avisanos por WhatsApp o email para activarlo de nuestro lado (manual por ahora)`,
                      ].map((step, i) => (
                        <div key={i} style={{ display: "flex", alignItems: "flex-start", gap: 10, marginBottom: 10 }}>
                          <span style={{ width: 18, height: 18, borderRadius: "50%", background: "#2563EB", color: "white", font: `700 0.6rem/1 ${fd}`, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0, marginTop: 1 }}>{i + 1}</span>
                          <span style={{ font: `400 0.78rem/1.45 ${fd}`, color: t2 }}>{step}</span>
                        </div>
                      ))}
                      <div style={{ display: "flex", alignItems: "center", gap: 8, padding: "10px 12px", background: "rgba(37,99,235,0.06)", borderRadius: 10, border: "1px solid rgba(37,99,235,0.12)", marginTop: 4 }}>
                        <Sparkles size={13} color="#2563EB" />
                        <p style={{ font: `600 0.72rem/1.4 ${fd}`, color: "#1D4ED8", margin: 0 }}>
                          Activación gratuita incluida en tu plan.
                        </p>
                      </div>
                    </div>
                  )}
                </div>

                {/* Save button */}
                <button
                  onClick={handleDomainSave}
                  disabled={domainSaving}
                  style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 8, padding: "13px", borderRadius: 12, border: "none", background: domainSaved ? "#16A34A" : domainSaving ? "#D1D5DB" : "#1A1D23", color: "#FFFFFF", font: `700 0.875rem/1 ${fd}`, cursor: domainSaving ? "not-allowed" : "pointer", transition: "background .2s" }}
                >
                  {domainSaved ? <><Check size={15} /> Guardado</> : domainSaving ? <><Loader2 size={15} style={{ animation: "spin 1s linear infinite" }} /> Guardando...</> : <><Save size={15} /> Guardar dominio</>}
                </button>
              </div>
            )}
          </div>
        </div>

        {/* ── Preview panel ── */}
        {!isMobile && (
          <div style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", gap: 12, position: "sticky", top: 20, maxHeight: "calc(100vh - 120px)" }}>
            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <div style={{ width: 8, height: 8, borderRadius: "50%", background: "#EF4444" }} />
              <div style={{ width: 8, height: 8, borderRadius: "50%", background: "#F59E0B" }} />
              <div style={{ width: 8, height: 8, borderRadius: "50%", background: "#22C55E" }} />
              <span style={{ font: `500 0.72rem/1 ${fd}`, color: t3, marginLeft: 6 }}>
                Preview móvil · {TEMPLATES.find(t => t.id === template)?.name}
              </span>
            </div>

            {/* Phone frame */}
            <div style={{
              width: 375, maxHeight: "calc(100vh - 180px)",
              borderRadius: 28,
              overflow: "hidden",
              boxShadow: "0 0 0 8px #1A1D23, 0 0 0 10px rgba(0,0,0,.1), 0 40px 80px rgba(0,0,0,.25)",
              overflowY: "auto",
              background: TEMPLATES.find(t => t.id === template)?.bg ?? "#0D1117",
            }}>
              <style>{`
                @keyframes spin { to { transform: rotate(360deg); } }
                ::-webkit-scrollbar { width: 0; }
              `}</style>
              <LivePreview
                template={template}
                title={title}
                subtitle={subtitle}
                desc={desc}
                ctaText={ctaText}
                accent={accent}
                benefits={benefits}
                logoUrl={logoUrl}
                gymName={gymName}
              />
            </div>
          </div>
        )}
      </div>
    </div>

    {/* ── Modal: Landing profesional ── */}

    {showLandingUpsell && (
      <div
        onClick={() => setShowLandingUpsell(false)}
        style={{ position: "fixed", inset: 0, zIndex: 1000, background: "rgba(0,0,0,0.65)", backdropFilter: "blur(6px)", display: "flex", alignItems: "center", justifyContent: "center", padding: 20 }}
      >
        <div onClick={e => e.stopPropagation()} style={{ background: "#FFFFFF", borderRadius: 24, padding: 28, maxWidth: 420, width: "100%", boxShadow: "0 40px 80px rgba(0,0,0,0.30)", position: "relative" }}>
          <button onClick={() => setShowLandingUpsell(false)} style={{ position: "absolute", top: 16, right: 16, width: 32, height: 32, borderRadius: 10, border: "none", background: "#F1F5F9", color: t2, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center" }}>
            <X size={14} />
          </button>

          {!upsellDone ? (
            <>
              <p style={{ font: `700 0.65rem/1 ${fd}`, color: "#F97316", textTransform: "uppercase", letterSpacing: ".08em", marginBottom: 8 }}>Oferta de lanzamiento</p>
              <h2 style={{ font: `900 1.35rem/1.2 ${fd}`, color: t1, marginBottom: 4 }}>Tu web profesional</h2>
              <p style={{ font: `400 0.82rem/1.4 ${fd}`, color: t2, marginBottom: 18 }}>Diseñada a medida para tu gym, como <a href="https://estilogym.com.ar" target="_blank" rel="noopener noreferrer" style={{ color: "#F97316", fontWeight: 700 }}>estilogym.com.ar</a></p>

              <div style={{ background: "#F8FAFC", borderRadius: 14, padding: "14px 16px", marginBottom: 18, border: "1px solid rgba(15,23,42,0.06)" }}>
                <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 10 }}>
                  <span style={{ font: `400 0.9rem/1 ${fd}`, color: t3, textDecoration: "line-through" }}>$250</span>
                  <span style={{ font: `900 1.4rem/1 ${fd}`, color: t1 }}>$150</span>
                  <span style={{ font: `600 0.72rem/1 ${fd}`, color: "#16A34A", background: "rgba(22,163,74,0.08)", border: "1px solid rgba(22,163,74,0.2)", padding: "3px 8px", borderRadius: 9999 }}>40% off</span>
                </div>
                {["Dominio incluido", "Hosting sin pagos mensuales", "Diseño con tu marca y colores", "Entrega en 5 días hábiles"].map(f => (
                  <div key={f} style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 6 }}>
                    <div style={{ width: 6, height: 6, borderRadius: "50%", background: "#16A34A", flexShrink: 0 }} />
                    <span style={{ font: `400 0.8rem/1 ${fd}`, color: t2 }}>{f}</span>
                  </div>
                ))}
              </div>

              <div style={{ display: "grid", gap: 10, marginBottom: 14 }}>
                <input value={upsellName} onChange={e => setUpsellName(e.target.value)} placeholder="Tu nombre" style={{ ...inputSt, padding: "12px 14px" }} />
                <input type="email" value={upsellEmail} onChange={e => setUpsellEmail(e.target.value)} placeholder="Email" style={{ ...inputSt, padding: "12px 14px" }} />
                <input value={upsellPhone} onChange={e => setUpsellPhone(e.target.value)} placeholder="WhatsApp (ej: 1165432100)" style={{ ...inputSt, padding: "12px 14px" }} />
              </div>

              <button
                onClick={() => submitUpsell("landing_pro")}
                disabled={upsellLoading || (!upsellEmail && !upsellPhone)}
                style={{ width: "100%", padding: "13px", borderRadius: 12, border: "none", background: upsellLoading ? "#D1D5DB" : "linear-gradient(135deg,#EA6700,#F97316)", color: "#FFFFFF", font: `800 0.9rem/1 ${fd}`, cursor: upsellLoading ? "not-allowed" : "pointer" }}
              >
                {upsellLoading ? "Enviando..." : "Me interesa, contactame →"}
              </button>
            </>
          ) : (
            <div style={{ textAlign: "center", padding: "20px 0" }}>
              <div style={{ width: 52, height: 52, borderRadius: "50%", background: "rgba(22,163,74,0.10)", display: "flex", alignItems: "center", justifyContent: "center", margin: "0 auto 16px" }}>
                <Check size={22} color="#16A34A" />
              </div>
              <h3 style={{ font: `800 1.1rem/1.2 ${fd}`, color: t1, marginBottom: 8 }}>¡Listo!</h3>
              <p style={{ font: `400 0.84rem/1.5 ${fd}`, color: t2 }}>Nos ponemos en contacto en las próximas horas para arrancar.</p>
            </div>
          )}
        </div>
      </div>
    )}
    </>
  );
}

// ── Helper ─────────────────────────────────────────────────────────────────────
function FieldGroup({ label, hint, children }: { label: string; hint?: string; children: React.ReactNode }) {
  const fd = "var(--font-inter,'Inter',sans-serif)";
  return (
    <div>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 6 }}>
        <label style={{ font: `600 0.82rem/1 ${fd}`, color: "#1A1D23" }}>{label}</label>
        {hint && <span style={{ font: `400 0.72rem/1 ${fd}`, color: "#9CA3AF" }}>{hint}</span>}
      </div>
      {children}
    </div>
  );
}
