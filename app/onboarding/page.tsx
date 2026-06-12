"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { ArrowLeft, ArrowRight, Building2, CheckCircle, ChevronDown, Loader2, Phone, User } from "lucide-react";
import { supabase } from "@/lib/supabase";

const COUNTRIES = [
  { code: "+54",  flag: "🇦🇷", name: "Argentina" },
  { code: "+52",  flag: "🇲🇽", name: "México" },
  { code: "+57",  flag: "🇨🇴", name: "Colombia" },
  { code: "+56",  flag: "🇨🇱", name: "Chile" },
  { code: "+51",  flag: "🇵🇪", name: "Perú" },
  { code: "+598", flag: "🇺🇾", name: "Uruguay" },
  { code: "+595", flag: "🇵🇾", name: "Paraguay" },
  { code: "+591", flag: "🇧🇴", name: "Bolivia" },
  { code: "+593", flag: "🇪🇨", name: "Ecuador" },
  { code: "+58",  flag: "🇻🇪", name: "Venezuela" },
  { code: "+55",  flag: "🇧🇷", name: "Brasil" },
  { code: "+34",  flag: "🇪🇸", name: "España" },
  { code: "+1",   flag: "🇺🇸", name: "USA" },
  { code: "+1809",flag: "🇩🇴", name: "Rep. Dom." },
];

const STEPS = [
  {
    key: "name" as const,
    icon: User,
    title: "¿Cuál es tu nombre completo?",
    hint: "Así te vamos a identificar dentro de la plataforma.",
    placeholder: "Ej: Martina López",
    optional: false,
  },
  {
    key: "gymName" as const,
    icon: Building2,
    title: "¿Cómo se llama tu gym?",
    hint: "Aparece en tu dashboard, reportes y mensajes automáticos.",
    placeholder: "Ej: Box Norte, Studio Fit, CrossFit Arena...",
    optional: false,
  },
  {
    key: "phone" as const,
    icon: Phone,
    title: "¿A qué número te contactamos?",
    hint: "Lo usamos para enviarte avisos importantes por WhatsApp.",
    placeholder: "Ej: 1165908374",
    optional: false,
  },
];

export default function OnboardingPage() {
  const router = useRouter();
  const inputRef = useRef<HTMLInputElement>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);

  const [step, setStep] = useState(0);
  const [done, setDone] = useState(false);
  const [values, setValues] = useState({ name: "", gymName: "", phone: "" });
  const [countryCode, setCountryCode] = useState("+54");
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const [gymId, setGymId] = useState<string | null>(null);
  const [userId, setUserId] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [visible, setVisible] = useState(true);

  useEffect(() => {
    supabase.auth.getUser().then(async ({ data: { user } }) => {
      if (!user) { router.push("/start"); return; }
      setUserId(user.id);
      const { data: profile } = await supabase
        .from("profiles")
        .select("gym_id, full_name")
        .eq("id", user.id)
        .maybeSingle();
      const resolvedGymId = profile?.gym_id ?? null;
      if (resolvedGymId) {
        setGymId(resolvedGymId);
        // Skip onboarding only if the user explicitly completed it (flag in gym_settings).
        // Checking full_name would bypass onboarding for Google sign-ins that pre-populate the name.
        const { data: settings } = await supabase
          .from("gym_settings")
          .select("onboarding_completed")
          .eq("gym_id", resolvedGymId)
          .maybeSingle();
        if (settings?.onboarding_completed) { router.push("/dashboard"); return; }
      }
      if (profile?.full_name) setValues(v => ({ ...v, name: profile.full_name! }));
    });
  }, [router]);

  useEffect(() => {
    setTimeout(() => inputRef.current?.focus(), 220);
  }, [step]);

  useEffect(() => {
    const handleOutside = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setDropdownOpen(false);
      }
    };
    if (dropdownOpen) document.addEventListener("mousedown", handleOutside);
    return () => document.removeEventListener("mousedown", handleOutside);
  }, [dropdownOpen]);

  const current = STEPS[step];
  const rawPhone = values.phone.trim().replace(/\D/g, "");
  const fullPhoneDigits = `${countryCode.replace(/\D/g, "")}${rawPhone}`;
  const selectedCountry = COUNTRIES.find(c => c.code === countryCode) ?? COUNTRIES[0];

  const validateStep = (key: keyof typeof values): string | null => {
    const value = values[key].trim();
    if (key === "name" && (value.length < 2 || value.length > 100)) return "Ingresá un nombre válido.";
    if (key === "gymName" && (value.length < 2 || value.length > 80)) return "Ingresá el nombre de tu gym.";
    if (key === "phone" && (!/^\d{8,15}$/.test(fullPhoneDigits) || rawPhone.length < 8)) return "Ingresá un WhatsApp válido con código de país.";
    return null;
  };

  const transition = (dir: 1 | -1, cb: () => void) => {
    setVisible(false);
    setTimeout(() => { cb(); setVisible(true); }, 180);
  };

  const canContinue = current.optional || !validateStep(current.key);

  const handleContinue = async () => {
    const stepError = validateStep(current.key);
    if (stepError) { setError(stepError); return; }
    setError(null);
    if (step < STEPS.length - 1) {
      transition(1, () => setStep(s => s + 1));
      return;
    }
    await saveAll();
  };

  const handleBack = () => {
    if (step === 0) return;
    transition(-1, () => setStep(s => s - 1));
  };

  const saveAll = async () => {
    setSaving(true);
    setError(null);
    try {
      const validationError = STEPS.map(s => validateStep(s.key)).find(Boolean);
      if (validationError) throw new Error(validationError);

      if (userId && values.name.trim()) {
        const { error: e } = await supabase.from("profiles").update({ full_name: values.name.trim() }).eq("id", userId);
        if (e) throw new Error(e.message);
      }

      if (gymId && values.gymName.trim()) {
        const { error: e } = await supabase.from("gyms").update({ name: values.gymName.trim() }).eq("id", gymId);
        if (e) throw new Error(e.message);
        fetch("/api/gym/sync-company-name", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ gymName: values.gymName.trim() }),
        }).catch(() => {});
      }

      if (gymId) {
        const fullPhone = rawPhone ? fullPhoneDigits : null;
        const slug = values.gymName.trim().toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "") || null;
        const { error: e } = await supabase.from("gym_settings").upsert(
          {
            gym_id: gymId,
            owner_name: values.name.trim() || null,
            gym_name: values.gymName.trim() || null,
            whatsapp: fullPhone,
            slug,
            onboarding_completed: true,
          },
          { onConflict: "gym_id" }
        );
        if (e) throw new Error(e.message);
      }

      setDone(true);
      setTimeout(() => router.push("/dashboard"), 2400);
    } catch (err) {
      setError(err instanceof Error ? err.message : "No se pudo guardar. Intentá de nuevo.");
      setSaving(false);
    }
  };

  const handleKey = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && canContinue && !saving) void handleContinue();
  };

  return (
    <main
      className="min-h-screen flex items-center justify-center px-4 py-8"
      style={{ background: "#0D1117" }}
    >
      {/* Ambient glow */}
      <div className="pointer-events-none fixed inset-0 overflow-hidden">
        <div
          className="absolute"
          style={{
            left: "5%", bottom: "-10%",
            width: "420px", height: "420px",
            background: "radial-gradient(circle, rgba(249,115,22,0.16) 0%, rgba(249,115,22,0.06) 45%, transparent 70%)",
            filter: "blur(90px)",
          }}
        />
        <div
          className="absolute"
          style={{
            right: "0%", top: "5%",
            width: "280px", height: "280px",
            background: "radial-gradient(circle, rgba(249,115,22,0.05) 0%, transparent 70%)",
            filter: "blur(60px)",
          }}
        />
      </div>

      <div className="relative z-10 w-full max-w-[480px]">
        {/* Logo */}
        <p
          className="text-center mb-6"
          style={{ fontSize: 11, fontWeight: 600, letterSpacing: "0.14em", textTransform: "uppercase", color: "rgba(255,255,255,0.2)" }}
        >
          FitGrowX
        </p>

        {/* Card */}
        <div
          style={{
            background: "rgba(255,255,255,0.04)",
            border: "1px solid rgba(255,255,255,0.10)",
            backdropFilter: "blur(16px)",
            WebkitBackdropFilter: "blur(16px)",
            borderRadius: 20,
            padding: "26px 26px 22px",
          }}
        >
          {done ? (
            <div
              className="flex flex-col items-center text-center py-6"
              style={{ opacity: visible ? 1 : 0, transition: "opacity 0.3s" }}
            >
              <div
                className="flex items-center justify-center mb-5"
                style={{ width: 56, height: 56, borderRadius: 16, background: "rgba(249,115,22,0.12)" }}
              >
                <CheckCircle size={28} color="#F97316" />
              </div>
              <h1 style={{ fontSize: 22, fontWeight: 700, color: "#fff", marginBottom: 10, letterSpacing: "-0.02em" }}>
                ¡Todo listo!
              </h1>
              <p style={{ fontSize: 13, color: "rgba(255,255,255,0.4)", lineHeight: 1.6, maxWidth: 280 }}>
                Tu cuenta está configurada. En un momento te llevamos al dashboard.
              </p>
              <div className="mt-6 flex gap-1.5">
                {[0, 1, 2].map(i => (
                  <div
                    key={i}
                    style={{
                      width: 6, height: 6, borderRadius: "50%",
                      background: "#F97316",
                      opacity: 0.3 + i * 0.35,
                      animation: `pulse 1.2s ease-in-out ${i * 0.2}s infinite`,
                    }}
                  />
                ))}
              </div>
            </div>
          ) : (
            <>
              {/* Step progress line */}
              <div className="flex gap-1.5 mb-6">
                {STEPS.map((_, i) => (
                  <div
                    key={i}
                    style={{
                      height: 3,
                      flex: 1,
                      borderRadius: 99,
                      background: i <= step ? "#F97316" : "rgba(255,255,255,0.08)",
                      transition: "background 0.4s",
                    }}
                  />
                ))}
              </div>

              {/* Step content */}
              <div
                style={{
                  opacity: visible ? 1 : 0,
                  transform: visible ? "translateY(0)" : "translateY(6px)",
                  transition: "opacity 0.22s ease, transform 0.22s ease",
                }}
              >
                <h1
                  style={{
                    fontSize: 20,
                    fontWeight: 700,
                    color: "#fff",
                    marginBottom: 6,
                    letterSpacing: "-0.02em",
                    lineHeight: 1.3,
                  }}
                >
                  {current.title}
                </h1>
                <p style={{ fontSize: 13, color: "rgba(255,255,255,0.4)", marginBottom: 18, lineHeight: 1.55 }}>
                  {current.hint}
                </p>

                {/* Field label */}
                <p
                  style={{
                    fontSize: 11,
                    fontWeight: 600,
                    textTransform: "uppercase",
                    letterSpacing: "0.08em",
                    color: "rgba(255,255,255,0.55)",
                    marginBottom: 8,
                  }}
                >
                  {current.key === "name" ? "Nombre" : current.key === "gymName" ? "Nombre del gym" : "WhatsApp"}
                </p>

                {/* Input */}
                {current.key === "phone" ? (
                  <div className="flex gap-2">
                    {/* Custom country dropdown */}
                    <div ref={dropdownRef} style={{ position: "relative", flexShrink: 0 }}>
                      <button
                        type="button"
                        onClick={() => setDropdownOpen(o => !o)}
                        style={{
                          display: "flex",
                          alignItems: "center",
                          gap: 6,
                          height: 46,
                          paddingLeft: 12,
                          paddingRight: 10,
                          background: "rgba(0,0,0,0.3)",
                          border: `1px solid ${dropdownOpen ? "#F97316" : "rgba(255,255,255,0.12)"}`,
                          borderRadius: 12,
                          color: "#fff",
                          fontSize: 14,
                          fontWeight: 500,
                          cursor: "pointer",
                          whiteSpace: "nowrap",
                          transition: "border-color 0.15s",
                          outline: "none",
                        }}
                      >
                        <span style={{ fontSize: 16, lineHeight: 1 }}>{selectedCountry.flag}</span>
                        <span style={{ color: "rgba(255,255,255,0.7)", fontSize: 13 }}>{selectedCountry.code}</span>
                        <ChevronDown
                          size={13}
                          color="rgba(255,255,255,0.4)"
                          style={{ transform: dropdownOpen ? "rotate(180deg)" : "rotate(0deg)", transition: "transform 0.2s" }}
                        />
                      </button>

                      {dropdownOpen && (
                        <div
                          style={{
                            position: "absolute",
                            top: "calc(100% + 6px)",
                            left: 0,
                            zIndex: 50,
                            background: "#161B22",
                            border: "1px solid rgba(255,255,255,0.10)",
                            borderRadius: 12,
                            overflow: "hidden",
                            width: 210,
                            maxHeight: 290,
                            overflowY: "auto",
                            boxShadow: "0 20px 60px rgba(0,0,0,0.7)",
                          }}
                        >
                          {COUNTRIES.map(c => (
                            <CountryOption
                              key={c.code}
                              country={c}
                              selected={c.code === countryCode}
                              onSelect={() => { setCountryCode(c.code); setDropdownOpen(false); }}
                            />
                          ))}
                        </div>
                      )}
                    </div>

                    {/* Phone number input */}
                    <input
                      ref={inputRef}
                      type="tel"
                      value={values.phone}
                      onChange={e => setValues(v => ({ ...v, phone: e.target.value }))}
                      onKeyDown={handleKey}
                      placeholder={current.placeholder}
                      style={{
                        flex: 1,
                        height: 46,
                        background: "rgba(0,0,0,0.3)",
                        border: `1px solid ${values.phone.trim().length >= 2 ? "#F97316" : "rgba(255,255,255,0.12)"}`,
                        borderRadius: 12,
                        color: "#fff",
                        fontSize: 15,
                        fontWeight: 500,
                        padding: "12px 16px",
                        outline: "none",
                        transition: "border-color 0.15s",
                        boxSizing: "border-box",
                      }}
                      className="placeholder:text-white/25 focus:border-[#F97316]"
                    />
                  </div>
                ) : (
                  <input
                    ref={inputRef}
                    type="text"
                    autoComplete="off"
                    inputMode="text"
                    value={values[current.key]}
                    onChange={e => setValues(v => ({ ...v, [current.key]: e.target.value }))}
                    onInput={e => setValues(v => ({ ...v, [current.key]: (e.target as HTMLInputElement).value }))}
                    onKeyDown={handleKey}
                    placeholder={current.placeholder}
                    style={{
                      width: "100%",
                      height: 46,
                      background: "rgba(0,0,0,0.3)",
                      border: `1px solid ${values[current.key].trim().length >= 2 ? "#F97316" : "rgba(255,255,255,0.12)"}`,
                      borderRadius: 12,
                      color: "#fff",
                      fontSize: 15,
                      fontWeight: 500,
                      padding: "12px 16px",
                      outline: "none",
                      boxSizing: "border-box",
                      transition: "border-color 0.15s",
                    }}
                    className="placeholder:text-white/25 focus:border-[#F97316]"
                  />
                )}

                {error && (
                  <p style={{ marginTop: 10, fontSize: 12, color: "#f87171", textAlign: "center" }}>{error}</p>
                )}

                {/* CTA */}
                <button
                  type="button"
                  onClick={() => void handleContinue()}
                  disabled={(!canContinue && !current.optional) || saving}
                  className="hover:opacity-90 active:scale-[0.98] transition-all"
                  style={{
                    marginTop: 18,
                    width: "100%",
                    height: 46,
                    borderRadius: 12,
                    background: "#F97316",
                    color: "#fff",
                    fontSize: 14,
                    fontWeight: 700,
                    border: "none",
                    cursor: canContinue && !saving ? "pointer" : "not-allowed",
                    opacity: (!canContinue && !current.optional) || saving ? 0.35 : 1,
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    gap: 8,
                    letterSpacing: "0.01em",
                  }}
                >
                  {saving ? (
                    <><Loader2 size={15} style={{ animation: "spin 1s linear infinite" }} /> Guardando...</>
                  ) : (
                    <>{step < STEPS.length - 1 ? "Continuar" : "Terminar"} <ArrowRight size={15} /></>
                  )}
                </button>

                {/* Back */}
                {step > 0 && (
                  <div className="mt-3">
                    <button
                      type="button"
                      onClick={handleBack}
                      className="flex items-center gap-1.5 text-white/30 hover:text-white/60 transition-colors"
                      style={{ fontSize: 12, background: "none", border: "none", cursor: "pointer" }}
                    >
                      <ArrowLeft size={12} /> Volver
                    </button>
                  </div>
                )}
              </div>
            </>
          )}
        </div>

        {/* Bottom hint */}
        {!done && (
          <p style={{ textAlign: "center", marginTop: 14, fontSize: 11, color: "rgba(255,255,255,0.18)", lineHeight: 1.5 }}>
            Podés actualizar estos datos en cualquier momento desde Ajustes.
          </p>
        )}
      </div>
    </main>
  );
}

function CountryOption({
  country,
  selected,
  onSelect,
}: {
  country: { code: string; flag: string; name: string };
  selected: boolean;
  onSelect: () => void;
}) {
  const [hovered, setHovered] = useState(false);

  return (
    <button
      type="button"
      onClick={onSelect}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{
        display: "flex",
        alignItems: "center",
        gap: 10,
        width: "100%",
        padding: "9px 14px",
        background: selected ? "rgba(249,115,22,0.12)" : hovered ? "rgba(249,115,22,0.07)" : "transparent",
        color: selected || hovered ? "#F97316" : "rgba(255,255,255,0.75)",
        fontSize: 13,
        fontWeight: selected ? 600 : 400,
        cursor: "pointer",
        textAlign: "left",
        border: "none",
        transition: "background 0.1s, color 0.1s",
      }}
    >
      <span style={{ fontSize: 15, lineHeight: 1 }}>{country.flag}</span>
      <span style={{ flex: 1 }}>{country.name}</span>
      <span style={{ color: "rgba(255,255,255,0.35)", fontSize: 12 }}>{country.code}</span>
    </button>
  );
}
