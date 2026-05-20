"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { ArrowLeft, ArrowRight, Building2, CheckCircle, Loader2, Phone, Send, User } from "lucide-react";
import { supabase } from "@/lib/supabase";

const STEPS = [
  {
    key: "name" as const,
    icon: User,
    color: "#FF6A00",
    bg: "rgba(255,106,0,0.14)",
    title: "¿Cuál es tu nombre completo?",
    hint: "Así te vamos a identificar dentro de la plataforma.",
    placeholder: "Ej: Martina López",
    optional: false,
  },
  {
    key: "gymName" as const,
    icon: Building2,
    color: "#2563EB",
    bg: "rgba(37,99,235,0.14)",
    title: "¿Cómo se llama tu gym?",
    hint: "Aparece en tu dashboard, reportes y mensajes automáticos.",
    placeholder: "Ej: Box Norte, Studio Fit, CrossFit Arena...",
    optional: false,
  },
  {
    key: "phone" as const,
    icon: Phone,
    color: "#16A34A",
    bg: "rgba(22,163,74,0.14)",
    title: "¿A qué número te contactamos?",
    hint: "Lo usamos para enviarte avisos importantes por WhatsApp.",
    placeholder: "Ej: 1165908374",
    optional: false,
  },
];

export default function OnboardingPage() {
  const router = useRouter();
  const inputRef = useRef<HTMLInputElement>(null);
  const [step, setStep] = useState(0);
  const [done, setDone] = useState(false);
  const [values, setValues] = useState({ name: "", gymName: "", phone: "" });
  const [countryCode, setCountryCode] = useState("+54");
  const [gymId, setGymId] = useState<string | null>(null);
  const [userId, setUserId] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [visible, setVisible] = useState(true);
  const [testWaSending, setTestWaSending] = useState(false);
  const [testWaSent, setTestWaSent]       = useState(false);
  const [testWaError, setTestWaError]     = useState<string | null>(null);

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

  const current = STEPS[step];
  const progress = step / STEPS.length;

  const transition = (dir: 1 | -1, cb: () => void) => {
    setVisible(false);
    setTimeout(() => { cb(); setVisible(true); }, 180);
  };

  const canContinue = current.optional || values[current.key].trim().length >= 2;

  const handleContinue = async () => {
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
      if (userId && values.name.trim()) {
        const { error: e } = await supabase.from("profiles").update({ full_name: values.name.trim() }).eq("id", userId);
        if (e) throw new Error(e.message);
      }

      if (gymId && values.gymName.trim()) {
        const { error: e } = await supabase.from("gyms").update({ name: values.gymName.trim() }).eq("id", gymId);
        if (e) throw new Error(e.message);
      }

      if (gymId) {
        const rawPhone = values.phone.trim().replace(/\D/g, "");
        const fullPhone = rawPhone ? `${countryCode.replace("+", "")}${rawPhone}` : null;
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

  const handleTestWa = async () => {
    if (testWaSending || testWaSent) return;
    setTestWaSending(true);
    setTestWaError(null);
    const rawPhone = values.phone.trim().replace(/\D/g, "");
    const fullPhone = rawPhone ? `${countryCode.replace("+", "")}${rawPhone}` : "";
    try {
      const res = await fetch("/api/onboarding/test-wa", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ phone: fullPhone, nombre: values.name, gymName: values.gymName }),
      });
      const data = await res.json();
      if (!res.ok || !data.ok) setTestWaError(data.error ?? "No se pudo enviar.");
      else setTestWaSent(true);
    } catch {
      setTestWaError("Sin conexión. Intentá de nuevo.");
    } finally {
      setTestWaSending(false);
    }
  };

  return (
    <main
      className="min-h-screen flex items-center justify-center px-4 py-8"
      style={{ background: "linear-gradient(160deg, #05070c 0%, #030508 45%, #020304 100%)" }}
    >
      {/* Ambient glow */}
      <div className="pointer-events-none fixed inset-0 overflow-hidden">
        <div className="absolute" style={{ left: "10%", bottom: "-8%", width: "380px", height: "380px", background: "radial-gradient(circle at 50% 50%, rgba(255,160,60,0.22) 0%, rgba(255,100,18,0.28) 22%, rgba(220,68,8,0.12) 50%, transparent 72%)", filter: "blur(60px)", mixBlendMode: "screen" }} />
        <div className="absolute inset-0" style={{ background: "radial-gradient(ellipse 55% 40% at 15% 85%, rgba(255,88,8,0.14) 0%, transparent 60%)", filter: "blur(80px)" }} />
      </div>

      <div className="relative z-10 w-full max-w-[460px]">
        {/* Logo */}
        <p className="text-center mb-8 text-[13px] font-semibold tracking-[0.14em] uppercase text-white/25">
          FitGrowX
        </p>

        {/* Card */}
        <div
          className="rounded-3xl p-8"
          style={{
            background: "linear-gradient(160deg, rgba(22,22,28,0.98) 0%, rgba(12,12,16,0.99) 100%)",
            boxShadow: "0 0 0 1px rgba(255,255,255,0.07), 0 40px 100px rgba(0,0,0,0.7), inset 0 1px 0 rgba(255,255,255,0.07)",
          }}
        >
          {done ? (
            /* ── Success ── */
            <div className="flex flex-col items-center text-center py-4" style={{ opacity: visible ? 1 : 0, transition: "opacity 0.3s" }}>
              <div className="w-16 h-16 rounded-2xl flex items-center justify-center mb-5" style={{ background: "rgba(22,163,74,0.15)" }}>
                <CheckCircle size={32} color="#16A34A" />
              </div>
              <h1 className="text-2xl font-bold tracking-tight text-white mb-3">¡Todo listo!</h1>
              <p className="text-[14px] text-white/45 leading-relaxed max-w-[300px]">
                Tu cuenta está configurada. En un momento te llevamos al dashboard.
              </p>
              <div className="mt-6 flex gap-1.5">
                {[0, 1, 2].map(i => (
                  <div key={i} className="w-2 h-2 rounded-full bg-[#16A34A]" style={{ opacity: 0.3 + i * 0.35, animation: `pulse 1.2s ease-in-out ${i * 0.2}s infinite` }} />
                ))}
              </div>
            </div>
          ) : (
            <>
              {/* ── Progress bar ── */}
              <div className="mb-8">
                <div className="flex gap-1.5 mb-3">
                  {STEPS.map((_, i) => (
                    <div
                      key={i}
                      className="h-1 flex-1 rounded-full transition-all duration-500"
                      style={{ background: i <= step ? "#FF6A00" : "rgba(255,255,255,0.08)" }}
                    />
                  ))}
                </div>
                <p className="text-[11px] font-semibold tracking-[0.12em] uppercase text-white/25">
                  Paso {step + 1} de {STEPS.length}
                </p>
              </div>

              {/* ── Step content ── */}
              <div
                style={{
                  opacity: visible ? 1 : 0,
                  transform: visible ? "translateY(0)" : "translateY(6px)",
                  transition: "opacity 0.22s ease, transform 0.22s ease",
                }}
              >
                {/* Icon */}
                <div
                  className="w-14 h-14 rounded-2xl flex items-center justify-center mb-5"
                  style={{ background: current.bg }}
                >
                  <current.icon size={24} color={current.color} />
                </div>

                {/* Heading */}
                <h1 className="text-[1.45rem] font-bold tracking-tight text-white mb-2 leading-snug">
                  {current.title}
                </h1>
                <p className="text-[13px] text-white/40 mb-6 leading-relaxed">{current.hint}</p>

                {/* Input */}
                {current.key === "phone" ? (
                  <div
                    className="w-full flex rounded-2xl border overflow-hidden transition-all"
                    style={{
                      borderColor: values.phone.trim().length >= 2 ? `${current.color}55` : "rgba(255,255,255,0.08)",
                      boxShadow: values.phone.trim().length >= 2 ? `0 0 0 3px ${current.color}18` : "none",
                      background: "rgba(255,255,255,0.05)",
                    }}
                  >
                    <select
                      value={countryCode}
                      onChange={e => setCountryCode(e.target.value)}
                      className="outline-none text-white text-[14px] font-medium bg-transparent border-r pl-4 pr-2 py-0 cursor-pointer flex-shrink-0"
                      style={{ borderColor: "rgba(255,255,255,0.10)", background: "rgba(255,255,255,0.04)", minWidth: 96 }}
                    >
                      {[
                        { code: "+54", label: "🇦🇷 +54" },
                        { code: "+52", label: "🇲🇽 +52" },
                        { code: "+57", label: "🇨🇴 +57" },
                        { code: "+56", label: "🇨🇱 +56" },
                        { code: "+51", label: "🇵🇪 +51" },
                        { code: "+598", label: "🇺🇾 +598" },
                        { code: "+595", label: "🇵🇾 +595" },
                        { code: "+591", label: "🇧🇴 +591" },
                        { code: "+593", label: "🇪🇨 +593" },
                        { code: "+58", label: "🇻🇪 +58" },
                        { code: "+55", label: "🇧🇷 +55" },
                        { code: "+34", label: "🇪🇸 +34" },
                        { code: "+1", label: "🇺🇸 +1" },
                        { code: "+1809", label: "🇩🇴 +1809" },
                      ].map(c => (
                        <option key={c.code} value={c.code} style={{ background: "#1a1a22", color: "#fff" }}>{c.label}</option>
                      ))}
                    </select>
                    <input
                      ref={inputRef}
                      type="tel"
                      value={values.phone}
                      onChange={e => setValues(v => ({ ...v, phone: e.target.value }))}
                      onKeyDown={handleKey}
                      placeholder={current.placeholder}
                      className="flex-1 h-14 bg-transparent text-white placeholder:text-white/25 px-4 text-[15px] font-medium outline-none"
                    />
                  </div>
                ) : (
                  <input
                    ref={inputRef}
                    type="text"
                    value={values[current.key]}
                    onChange={e => setValues(v => ({ ...v, [current.key]: e.target.value }))}
                    onKeyDown={handleKey}
                    placeholder={current.placeholder}
                    className="w-full h-14 rounded-2xl border text-white placeholder:text-white/25 bg-white/[0.05] px-5 text-[15px] font-medium outline-none transition-all"
                    style={{
                      borderColor: values[current.key].trim().length >= 2
                        ? `${current.color}55`
                        : "rgba(255,255,255,0.08)",
                      boxShadow: values[current.key].trim().length >= 2
                        ? `0 0 0 3px ${current.color}18`
                        : "none",
                    }}
                  />
                )}

                {/* Aha Moment — solo en el paso de teléfono con número válido */}
                {current.key === "phone" && values.phone.trim().replace(/\D/g, "").length >= 8 && (
                  <div className="mt-4 rounded-2xl p-4" style={{ background: "rgba(22,163,74,0.09)", border: "1px solid rgba(22,163,74,0.22)" }}>
                    <p className="text-[12px] font-semibold text-white/60 mb-3 leading-relaxed">
                      ✨ <span style={{ color: "#4ADE80" }}>Aha Moment</span> — Probá el sistema ahora mismo
                    </p>
                    {testWaSent ? (
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-8 rounded-full flex items-center justify-center" style={{ background: "rgba(22,163,74,0.2)" }}>
                          <CheckCircle size={16} color="#4ADE80" />
                        </div>
                        <div>
                          <p className="text-[13px] font-bold" style={{ color: "#4ADE80" }}>¡Revisá tu WhatsApp!</p>
                          <p className="text-[11px] text-white/40">El mensaje llegó desde FitGrowX</p>
                        </div>
                      </div>
                    ) : (
                      <button
                        type="button"
                        onClick={() => void handleTestWa()}
                        disabled={testWaSending}
                        className="w-full flex items-center justify-center gap-2 rounded-xl py-3 text-[13px] font-bold transition-all"
                        style={{ background: testWaSending ? "rgba(22,163,74,0.12)" : "rgba(22,163,74,0.18)", border: "1px solid rgba(22,163,74,0.35)", color: "#4ADE80", opacity: testWaSending ? 0.7 : 1 }}
                      >
                        {testWaSending ? <Loader2 size={14} style={{ animation: "spin 1s linear infinite" }} /> : <Send size={14} />}
                        {testWaSending ? "Enviando..." : "Mandarme un mensaje de prueba →"}
                      </button>
                    )}
                    {testWaError && <p className="mt-2 text-[11px] text-red-400">{testWaError}</p>}
                  </div>
                )}

                {error && (
                  <p className="mt-3 text-[12px] text-red-400 text-center">{error}</p>
                )}

                {/* CTA */}
                <button
                  type="button"
                  onClick={() => void handleContinue()}
                  disabled={(!canContinue && !current.optional) || saving}
                  className="mt-4 w-full h-13 rounded-full flex items-center justify-center gap-2 text-[15px] font-semibold text-white transition-all hover:scale-[1.02] active:scale-[0.98] disabled:opacity-35"
                  style={{
                    background: "linear-gradient(180deg, #ff7a1a 0%, #ff6000 55%, #e05000 100%)",
                    boxShadow: canContinue ? "0 10px 36px rgba(255,96,0,0.32)" : "none",
                    height: 52,
                  }}
                >
                  {saving ? "Guardando..." : step < STEPS.length - 1 ? "Continuar" : "Terminar"}
                  {!saving && <ArrowRight size={16} />}
                </button>

                {/* Bottom nav */}
                {step > 0 && (
                  <div className="mt-4 flex items-center">
                    <button
                      type="button"
                      onClick={handleBack}
                      className="flex items-center gap-1.5 text-[12px] text-white/30 hover:text-white/60 transition-colors"
                    >
                      <ArrowLeft size={13} /> Volver
                    </button>
                  </div>
                )}
              </div>
            </>
          )}
        </div>

        {/* Bottom hint */}
        {!done && (
          <p className="text-center mt-5 text-[11px] text-white/18 leading-relaxed">
            Podés actualizar estos datos en cualquier momento desde Ajustes.
          </p>
        )}
      </div>
    </main>
  );
}
