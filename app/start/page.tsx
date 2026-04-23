"use client";

import Link from "next/link";
import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { ArrowRight, CheckCircle2, Lock, Mail, MessageCircleMore, User } from "lucide-react";
import { supabase } from "@/lib/supabase";
import { LandingHeader } from "@/components/landing-header";

type Screen = "form" | "setup" | "dashboard";

function GrainOverlay() {
  return (
    <svg
      aria-hidden="true"
      className="pointer-events-none absolute inset-0 h-full w-full"
      style={{ opacity: 0.45, mixBlendMode: "soft-light" }}
      xmlns="http://www.w3.org/2000/svg"
    >
      <filter id="start-grain" x="0%" y="0%" width="100%" height="100%">
        <feTurbulence type="fractalNoise" baseFrequency="0.68 0.68" numOctaves="4" stitchTiles="stitch" result="noise" />
        <feColorMatrix type="saturate" values="0" in="noise" result="grayNoise" />
        <feBlend in="SourceGraphic" in2="grayNoise" mode="overlay" />
      </filter>
      <rect width="100%" height="100%" filter="url(#start-grain)" />
    </svg>
  );
}

function DotField({ className }: { className: string }) {
  return (
    <div
      className={`pointer-events-none absolute rounded-[2rem] ${className}`}
      style={{
        backgroundImage: "radial-gradient(rgba(255,122,26,0.82) 1.15px, transparent 1.15px)",
        backgroundSize: "13px 13px",
        filter: "drop-shadow(0 0 12px rgba(255,106,0,0.22))",
      }}
    />
  );
}

export default function StartPage() {
  const router = useRouter();
  const nameRef = useRef<HTMLInputElement>(null);
  const [screen, setScreen] = useState<Screen>("form");
  const [isLogin, setIsLogin] = useState(false);
  const [fullName, setFullName] = useState("");
  const [whatsApp, setWhatsApp] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [progress, setProgress] = useState(0);
const [authError, setAuthError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    if (screen === "form") nameRef.current?.focus();
  }, [screen]);

  useEffect(() => {
    if (screen !== "setup") return;
    const progressStops = [22, 54, 82, 100];
    const timers = progressStops.map((value, index) =>
      window.setTimeout(() => setProgress(value), (index + 1) * 650)
    );
    const finishTimer = window.setTimeout(() => setScreen("dashboard"), 2800);
    return () => {
      timers.forEach((timer) => window.clearTimeout(timer));
      window.clearTimeout(finishTimer);
    };
  }, [screen]);

  const validity = useMemo(() => ({
    fullName: fullName.trim().length >= 3,
    whatsApp: whatsApp.trim().length === 0 || whatsApp.trim().length >= 8,
    email: /\S+@\S+\.\S+/.test(email),
    password: password.length >= 6,
  }), [fullName, whatsApp, email, password]);

  const canSubmit = isLogin
    ? validity.email && validity.password && !isSubmitting
    : validity.fullName && validity.email && validity.password && !isSubmitting;

  const resolveDestinationForUser = async (userId: string) => {
    const { data: profile } = await supabase
      .from("profiles")
      .select("role")
      .eq("id", userId)
      .limit(1)
      .maybeSingle();

    return profile?.role === "platform_owner" ? "/platform" : "/dashboard";
  };

  const syncPlatformSignup = async (
    accessToken: string,
    payload: Record<string, string>,
  ) => {
    const response = await fetch("/api/platform/sync-signup", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${accessToken}`,
      },
      body: JSON.stringify(payload),
    });

    if (!response.ok) {
      const data = (await response.json().catch(() => null)) as { error?: string } | null;
      throw new Error(data?.error ?? "No se pudo completar la configuración inicial.");
    }
  };

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!canSubmit) return;
    setIsSubmitting(true);
    setAuthError(null);

    try {
      if (isLogin) {
        const { data, error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) throw error;
        if (!data.user) throw new Error("No se pudo obtener el usuario autenticado.");

        if (data.session?.access_token) {
          await syncPlatformSignup(data.session.access_token, {
            email,
          });
        }

        const destination = await resolveDestinationForUser(data.user.id);
        window.location.href = destination;
      } else {
        const { data: signUpData, error: signUpError } = await supabase.auth.signUp({ email, password });
        if (signUpError) throw signUpError;
        if (!signUpData.user) throw new Error("No se pudo crear el usuario.");

        const { error: gymSettingsError } = await supabase
          .from("gym_settings")
          .upsert({
            gym_id: signUpData.user.id,
            owner_name: fullName,
            whatsapp: whatsApp,
            email,
            onboarding_completed: false,
          }, { onConflict: "gym_id" });
        if (gymSettingsError) throw gymSettingsError;

        if (signUpData.session?.access_token) {
          await syncPlatformSignup(signUpData.session.access_token, {
            fullName,
            whatsApp,
            email,
          });
        }

        const destination = await resolveDestinationForUser(signUpData.user.id);
        router.push(destination);
      }
    } catch (err: unknown) {
      setAuthError(err instanceof Error ? err.message : "Ocurrió un error inesperado");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <main className="min-h-screen overflow-hidden bg-[#040508] text-white">
      <div className="relative min-h-screen">

        <div className="pointer-events-none absolute inset-0 overflow-hidden">

          {/* ── 1. BASE: negro absoluto con gradiente tonal sutil ── */}
          <div className="absolute inset-0" style={{ background: "linear-gradient(160deg, #05070c 0%, #030508 45%, #020304 100%)" }} />

          {/* ── 2. AZUL AMBIENTE: frío, profundo, esquina top-left ── */}
          <div className="absolute inset-0" style={{ background: "radial-gradient(ellipse 60% 50% at -4% 8%, rgba(18,60,180,0.28) 0%, rgba(14,48,140,0.12) 38%, transparent 62%)", filter: "blur(90px)", opacity: 0.75 }} />

          {/* ── 3. NÚCLEO CALIENTE: la fuente de luz — bottom-left ── */}
          {/* Punto de emisión: casi blanco-amarillo, muy concentrado */}
          <div className="absolute" style={{ left: "14%", bottom: "-4%", width: "320px", height: "320px", background: "radial-gradient(circle at 50% 50%, rgba(255,230,180,0.28) 0%, rgba(255,160,60,0.42) 14%, rgba(255,100,18,0.38) 28%, rgba(220,68,8,0.18) 50%, transparent 72%)", filter: "blur(18px)", mixBlendMode: "screen" }} />

          {/* ── 4. CUERPO PRINCIPAL: expansión naranja con falloff real ── */}
          <div className="absolute" style={{ left: "-8%", bottom: "-12%", width: "65%", height: "75%", background: "radial-gradient(ellipse 55% 52% at 30% 72%, rgba(255,95,14,0.52) 0%, rgba(255,80,10,0.30) 22%, rgba(220,60,6,0.14) 46%, rgba(180,40,4,0.05) 68%, transparent 82%)", filter: "blur(64px) saturate(120%)", mixBlendMode: "screen" }} />

          {/* ── 5. HALO ATMOSFÉRICO: dispersión amplia y suave ── */}
          <div className="absolute inset-[-10%]" style={{ background: "radial-gradient(ellipse 72% 44% at 24% 92%, rgba(255,88,8,0.22) 0%, rgba(255,72,4,0.10) 32%, rgba(200,50,0,0.04) 58%, transparent 76%)", filter: "blur(110px)", opacity: 0.9 }} />

          {/* ── 6. REBOTE SECUNDARIO: derecha, muy tenue — da dimensión ── */}
          <div className="absolute" style={{ right: "-6%", bottom: "8%", width: "40%", height: "40%", background: "radial-gradient(ellipse 60% 55% at 70% 60%, rgba(200,60,6,0.10) 0%, rgba(180,50,4,0.04) 44%, transparent 72%)", filter: "blur(80px)", opacity: 0.6 }} />

          {/* ── 7. CAÍDA CENTRAL: oscurece el medio para que el texto respire ── */}
          <div className="absolute inset-0" style={{ background: "radial-gradient(ellipse 80% 60% at 50% 38%, transparent 0%, rgba(0,0,0,0.22) 52%, rgba(0,0,0,0.48) 100%)" }} />

          {/* ── 8. VIÑETA PERIMETRAL: bordes negros que dan profundidad ── */}
          <div className="absolute inset-0" style={{ background: "radial-gradient(ellipse 110% 100% at 50% 50%, transparent 38%, rgba(0,0,0,0.20) 64%, rgba(0,0,0,0.52) 100%)" }} />

        </div>

        <GrainOverlay />

        <LandingHeader
          actionType="button"
          actionLabel={isLogin ? "Crear cuenta" : "Iniciar sesión"}
          onAction={() => { setIsLogin((v) => !v); setAuthError(null); }}
        />

        {screen === "form" && (
          <section className="relative z-10 flex min-h-[calc(100vh-3.5rem)] items-center">
            <div className="mx-auto w-full max-w-7xl px-6 py-12 lg:px-10">
              <div
                className="relative mx-auto max-w-6xl overflow-hidden rounded-[2.8rem] px-5 py-10 sm:px-8 lg:px-12 lg:py-14"
                style={{
                  background: "linear-gradient(160deg, rgba(22,22,26,0.96) 0%, rgba(10,10,13,0.98) 60%, rgba(6,6,8,1) 100%)",
                  boxShadow:
                    "0 0 0 1px rgba(255,255,255,0.045), " +
                    "0 2px 0 0 rgba(255,255,255,0.06), " +
                    "0 50px 120px rgba(0,0,0,0.72), " +
                    "0 20px 48px rgba(0,0,0,0.52), " +
                    "inset 0 1px 0 rgba(255,255,255,0.07), " +
                    "inset 0 -1px 0 rgba(0,0,0,0.40)",
                }}
              >
                {/* Viñeta interna — profundidad en bordes */}
                <div className="pointer-events-none absolute inset-0 rounded-[2.8rem]" style={{ background: "radial-gradient(ellipse 100% 100% at 50% 50%, transparent 55%, rgba(0,0,0,0.45) 100%)" }} />

                {/* Highlight top edge */}
                <div className="pointer-events-none absolute inset-x-0 top-0 h-px rounded-t-[2.8rem]" style={{ background: "linear-gradient(90deg, transparent 5%, rgba(255,255,255,0.10) 30%, rgba(255,255,255,0.14) 50%, rgba(255,255,255,0.10) 70%, transparent 95%)" }} />

                {/* Grain SVG sobre el div */}
                <svg aria-hidden="true" className="pointer-events-none absolute inset-0 h-full w-full rounded-[2.8rem]" style={{ opacity: 0.18, mixBlendMode: "soft-light" }}>
                  <filter id="card-grain">
                    <feTurbulence type="fractalNoise" baseFrequency="0.72 0.72" numOctaves="4" stitchTiles="stitch" result="noise" />
                    <feColorMatrix type="saturate" values="0" in="noise" result="gray" />
                    <feBlend in="SourceGraphic" in2="gray" mode="overlay" />
                  </filter>
                  <rect width="100%" height="100%" filter="url(#card-grain)" />
                </svg>

                <DotField className="left-[8%] top-24 hidden h-32 w-28 lg:block opacity-12" />
                <DotField className="right-[8%] top-24 hidden h-32 w-28 lg:block opacity-12" />

                <div className="relative grid gap-10 lg:grid-cols-[0.86fr_1fr] lg:items-center lg:gap-16">
                  <div className="max-w-md px-2 lg:px-4">
                    <h1 className="text-4xl font-semibold leading-[1.05] tracking-[-0.05em] sm:text-5xl lg:text-[3.6rem]">
                      <span
                        style={{
                          backgroundImage: "linear-gradient(180deg, #f0f0f0 15%, #7a7a8a 100%)",
                          WebkitBackgroundClip: "text",
                          WebkitTextFillColor: "transparent",
                          backgroundClip: "text",
                        }}
                      >
                        {isLogin ? "Bienvenido de" : "Empezá hoy,"}
                      </span>
                      <span
                        className="mt-2 block"
                        style={{
                          backgroundImage: "linear-gradient(95deg, #ff9a4a 0%, #fb5c0a 60%, #d94000 100%)",
                          WebkitBackgroundClip: "text",
                          WebkitTextFillColor: "transparent",
                          backgroundClip: "text",
                        }}
                      >
                        {isLogin ? "vuelta." : "sin excusas."}
                      </span>
                    </h1>
                    <p className="mt-6 text-base font-light leading-relaxed text-white/40 tracking-tight">
                      {isLogin
                        ? "Accedé a tu panel y retomá el control de tu gimnasio."
                        : "Obtené acceso total al sistema, activá tu prueba gratis y configurá tu gimnasio en minutos."}
                    </p>
                    {!isLogin && (
                      <div className="mt-6 flex flex-wrap gap-2">
                        {["15 días gratis", "Sin tarjeta", "Setup guiado"].map((item) => (
                          <span
                            key={item}
                            className="rounded-full border border-white/10 bg-white/[0.03] px-3 py-1.5 text-[11px] font-medium tracking-[0.05em] text-white/45"
                          >
                            {item}
                          </span>
                        ))}
                      </div>
                    )}
                  </div>

                  <div className="relative mx-auto w-full max-w-[31rem]">
                    <div className="relative rounded-[2.2rem] border border-white/[0.08] bg-[linear-gradient(180deg,rgba(21,21,24,0.99),rgba(14,14,17,0.998))] p-7 shadow-2xl sm:p-10">
                      <div className="mb-8">
                        <h2 className="text-2xl font-semibold tracking-[-0.04em]">
                          {isLogin ? "Iniciá sesión" : "Creá tu acceso"}
                        </h2>
                        <p className="mt-1 text-[13px] text-white/35">
                          {isLogin ? (
                            <>¿No tenés cuenta?{" "}
                              <button onClick={() => { setIsLogin(false); setAuthError(null); }} className="text-[#FF6A00] hover:underline">Registrate gratis</button>
                            </>
                          ) : (
                            <>¿Ya tenés cuenta?{" "}
                              <button onClick={() => { setIsLogin(true); setAuthError(null); }} className="text-[#FF6A00] hover:underline">Iniciá sesión</button>
                            </>
                          )}
                        </p>
                        {!isLogin && (
                          <p className="mt-3 text-[12px] leading-relaxed text-white/38">
                            Empezás con 15 días gratis, sin tarjeta. Después elegís el plan que mejor se adapte a tu gimnasio.
                          </p>
                        )}
                      </div>

                      <form onSubmit={handleSubmit} className="grid gap-3.5">
                        {!isLogin && (
                          <>
                            <div className="relative">
                              <User className="absolute left-5 top-1/2 h-4 w-4 -translate-y-1/2 text-white/34" />
                              <input
                                ref={nameRef}
                                type="text"
                                value={fullName}
                                onChange={(e) => setFullName(e.target.value)}
                                placeholder="Nombre completo"
                                className="h-14 w-full rounded-2xl border border-white/10 bg-[#131417] pl-14 pr-5 text-white outline-none focus:border-[#FF6A00]"
                                required
                              />
                            </div>
                            <div className="relative">
                              <MessageCircleMore className="absolute left-5 top-1/2 h-4 w-4 -translate-y-1/2 text-white/34" />
                              <input
                                type="tel"
                                value={whatsApp}
                                onChange={(e) => setWhatsApp(e.target.value)}
                                placeholder="WhatsApp (opcional)"
                                className="h-14 w-full rounded-2xl border border-white/10 bg-[#131417] pl-14 pr-5 text-white outline-none focus:border-[#FF6A00]"
                              />
                            </div>
                            <p className="-mt-1 px-1 text-[11px] leading-relaxed text-white/28">
                              Si lo dejás, nos sirve para ayudarte más rápido con el setup inicial.
                            </p>
                          </>
                        )}

                        <div className="relative">
                          <Mail className="absolute left-5 top-1/2 h-4 w-4 -translate-y-1/2 text-white/34" />
                          <input
                            type="email"
                            value={email}
                            onChange={(e) => setEmail(e.target.value)}
                            placeholder="Email"
                            className="h-14 w-full rounded-2xl border border-white/10 bg-[#131417] pl-14 pr-5 text-white outline-none focus:border-[#FF6A00]"
                            required
                          />
                        </div>

                        <div className="relative">
                          <Lock className="absolute left-5 top-1/2 h-4 w-4 -translate-y-1/2 text-white/34" />
                          <input
                            type="password"
                            value={password}
                            onChange={(e) => setPassword(e.target.value)}
                            placeholder="Contraseña"
                            className="h-14 w-full rounded-2xl border border-white/10 bg-[#131417] pl-14 pr-5 text-white outline-none focus:border-[#FF6A00]"
                            required
                          />
                        </div>

                        {isLogin && (
                          <div className="text-right -mt-1">
                            <button type="button" className="text-[12px] text-white/30 hover:text-white/60 transition-colors duration-200">
                              ¿Olvidaste tu contraseña?
                            </button>
                          </div>
                        )}

                        {authError && (
                          <div className="rounded-xl border border-red-500/20 bg-red-500/10 p-4 text-xs text-red-400 text-center font-medium">
                            {authError}
                          </div>
                        )}

                        <button
                          type="submit"
                          disabled={!canSubmit}
                          className="group relative mt-2 flex h-14 items-center justify-center gap-2 overflow-hidden rounded-full text-base font-semibold text-white transition-all hover:scale-[1.02] active:scale-[0.98] disabled:opacity-40"
                          style={{
                            background: "linear-gradient(180deg, #ff7a1a 0%, #ff6000 55%, #e05000 100%)",
                            boxShadow: "inset 0 1px 0 rgba(255,255,255,0.28), inset 0 -1px 0 rgba(0,0,0,0.18), 0 8px 32px rgba(255,96,0,0.30)",
                          }}
                        >
                          <span className="pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-white/30 to-transparent" />
                          <span className="relative z-10">
                            {isSubmitting ? "Un momento..." : isLogin ? "Entrar al panel" : "Activar prueba gratis"}
                          </span>
                          <ArrowRight className="relative z-10 h-4 w-4 transition-transform group-hover:translate-x-0.5" />
                          <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/10 to-transparent -translate-x-full group-hover:translate-x-full transition-transform duration-700" />
                        </button>

                        {!isLogin && (
                          <p className="text-center text-[11px] leading-relaxed text-white/28">
                            Vas a entrar directo a tu prueba gratis y después podés elegir Gestión, Crecimiento o Full Marca.
                          </p>
                        )}
                      </form>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </section>
        )}

        {screen === "setup" && (
          <section className="relative z-10 flex min-h-[80vh] items-center justify-center px-6">
            <div className="w-full max-w-2xl text-center">
              <h2 className="text-4xl font-semibold mb-8 italic uppercase tracking-tighter">Preparando tu entorno...</h2>
              <div className="h-2 w-full bg-white/5 rounded-full overflow-hidden">
                <div className="h-full bg-[#FF6A00] transition-all duration-500" style={{ width: `${progress}%` }} />
              </div>
              <p className="mt-6 text-white/40 italic">Vinculando perfil de socio con base de datos...</p>
            </div>
          </section>
        )}

        {screen === "dashboard" && (
          <section className="relative z-10 mx-auto max-w-7xl px-6 py-12">
            <div className="rounded-[2.8rem] border border-white/10 bg-[#111111] p-12 text-center shadow-2xl">
              <CheckCircle2 className="mx-auto h-16 w-16 text-[#FF6A00]" />
              <h1 className="mt-8 text-5xl font-bold tracking-tighter italic uppercase">¡HOLA, {fullName.split(' ')[0]}!</h1>
              <p className="mt-4 text-xl text-white/50">
                Tu perfil de dueño ha sido creado con éxito. Ya podés acceder a tu panel.
              </p>
              <div className="mt-12 flex flex-col gap-4 sm:flex-row justify-center">
                <Link href="/dashboard" className="h-14 px-10 flex items-center justify-center rounded-full bg-white text-black font-bold hover:bg-white/90 transition shadow-xl">
                  Entrar al Panel Pro
                </Link>
              </div>
              
              <div className="mt-16 grid gap-6 sm:grid-cols-2 lg:grid-cols-3 border-t border-white/5 pt-12">
                {[
                  { label: "Cuenta", value: "Activa" },
                  { label: "WhatsApp", value: "Vinculado" },
                  { label: "Acceso", value: "Total" },
                ].map((stat) => (
                  <div key={stat.label} className="rounded-2xl border border-white/[0.06] bg-white/[0.02] p-6">
                    <p className="text-[10px] font-bold uppercase tracking-widest text-white/30">{stat.label}</p>
                    <p className="mt-2 text-xl font-semibold">{stat.value}</p>
                  </div>
                ))}
              </div>
            </div>
          </section>
        )}
      </div>
    </main>
  );
}
