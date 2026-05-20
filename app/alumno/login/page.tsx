"use client";

import { Suspense, useState, useEffect } from "react";
import { useSearchParams } from "next/navigation";
import { createClient } from "@supabase/supabase-js";
import Link from "next/link";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
);

const HERO = "https://images.unsplash.com/photo-1583454110551-21f2fa2afe61?w=1200&q=80";
const FD   = '"Archivo Black","Helvetica Neue",sans-serif';
const FM   = '"JetBrains Mono",ui-monospace,"SF Mono",Menlo,monospace';
const FB   = 'Helvetica,"Helvetica Neue",Arial,sans-serif';

function rgb(hex: string, a: number) {
  const m = hex.replace("#", "").match(/.{2}/g);
  if (!m) return `rgba(255,106,26,${a})`;
  const [r, g, b] = m.map(x => parseInt(x, 16));
  return `rgba(${r},${g},${b},${a})`;
}

function fmt(raw: string) {
  const d = raw.replace(/\D/g, "").slice(0, 8);
  if (d.length <= 2) return d;
  if (d.length <= 5) return `${d.slice(0,2)}.${d.slice(2)}`;
  return `${d.slice(0,2)}.${d.slice(2,5)}.${d.slice(5)}`;
}

function IcoWA({ size = 22, color = "#25D366" }: { size?: number; color?: string }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <circle cx="12" cy="11.2" r="8.5" stroke={color} strokeWidth={1.8}/>
      <path d="M6.5 17.3 L4.2 20.8 L8.4 19.5" stroke={color} strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" fill={color}/>
      <path d="M8.6 8.7c0-.5.4-.9.9-.9h.6c.4 0 .75.25.88.6l.5 1.4c.12.33.04.7-.22.95l-.45.45a5.5 5.5 0 0 0 2.64 2.64l.45-.45c.25-.26.62-.34.95-.22l1.4.5c.35.13.6.48.6.88v.6c0 .5-.4.9-.9.9-3.86 0-7.85-3.59-7.85-7.35z" stroke={color} strokeWidth={1.8} strokeLinejoin="round"/>
    </svg>
  );
}

function IcoArrow({ size = 18 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <path d="M7 17L17 7M17 7H9M17 7V15" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"/>
    </svg>
  );
}

function IcoCheck({ size = 28 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <path d="M5 12.5l4.5 4.5L19 7" stroke="currentColor" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round"/>
    </svg>
  );
}

function Grain() {
  return (
    <svg style={{ position:"absolute", inset:0, width:"100%", height:"100%", pointerEvents:"none", mixBlendMode:"overlay", opacity:0.35 }} aria-hidden>
      <filter id="gn">
        <feTurbulence type="fractalNoise" baseFrequency="0.9" numOctaves="2" stitchTiles="stitch"/>
        <feColorMatrix values="0 0 0 0 0  0 0 0 0 0  0 0 0 0 0  0 0 0 0.9 0"/>
      </filter>
      <rect width="100%" height="100%" filter="url(#gn)"/>
    </svg>
  );
}

interface GymData { gym_name: string | null; accent_color: string | null; slug: string; }

function LoginContent() {
  const searchParams = useSearchParams();
  const gymSlug = searchParams.get("gym");

  const [gym,         setGym]         = useState<GymData | null>(null);
  const [dni,         setDni]         = useState("");
  const [focused,     setFocused]     = useState(false);
  const [status,      setStatus]      = useState<"idle"|"loading"|"sent">("idle");
  const [touched,     setTouched]     = useState(false);
  const [errMsg,      setErrMsg]      = useState<string|null>(null);
  // PWA install
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const [deferredPrompt, setDeferredPrompt] = useState<any>(null);
  const [showIosHint,    setShowIosHint]    = useState(false);
  const [installDone,    setInstallDone]    = useState(false);

  useEffect(() => {
    const r = searchParams.get("redirect");
    if (r) localStorage.setItem("fitgrowx_post_login_redirect", r);
  }, [searchParams]);

  useEffect(() => {
    if (typeof window === "undefined") return;
    // Already installed as standalone
    if (window.matchMedia("(display-mode: standalone)").matches) return;
    // iOS Safari
    const ua = navigator.userAgent;
    const isIos = /iphone|ipad|ipod/i.test(ua) && !("MSStream" in window);
    const isSafari = /safari/i.test(ua) && !/chrome|fxios|crios/i.test(ua);
    if (isIos && isSafari) { setShowIosHint(true); return; }
    // Android / Chrome
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const handler = (e: any) => { e.preventDefault(); setDeferredPrompt(e); };
    window.addEventListener("beforeinstallprompt", handler);
    return () => window.removeEventListener("beforeinstallprompt", handler);
  }, []);

  const triggerInstall = async () => {
    if (!deferredPrompt) return;
    deferredPrompt.prompt();
    const { outcome } = await deferredPrompt.userChoice;
    if (outcome === "accepted") setInstallDone(true);
    setDeferredPrompt(null);
  };

  useEffect(() => {
    if (!gymSlug) return;
    supabase.from("gym_settings")
      .select("gym_name, accent_color, slug")
      .eq("slug", gymSlug)
      .maybeSingle()
      .then(({ data }) => { if (data) setGym(data as GymData); });
  }, [gymSlug]);

  const digits   = dni.replace(/\D/g, "");
  const isValid  = digits.length === 7 || digits.length === 8;
  const showErr  = touched && dni.length > 0 && !isValid && status === "idle";

  const accent   = gym?.accent_color ?? "#FF6A1A";
  const gymName  = (gym?.gym_name ?? "GYM").toUpperCase();
  const slug     = gym?.slug ?? gymSlug;

  // Adaptive font size based on gym name length
  const getGymNameFontSize = () => {
    const len = gymName.length;
    if (len <= 10) return "clamp(48px, 22vw, 108px)";  // Short names: full size
    if (len <= 20) return "clamp(36px, 18vw, 85px)";   // Medium names: medium size
    if (len <= 30) return "clamp(28px, 14vw, 65px)";   // Long names: smaller
    return "clamp(20px, 10vw, 48px)";                  // Very long names: minimal
  };

  const submit = async () => {
    if (!isValid || status !== "idle") return;
    setStatus("loading"); setErrMsg(null);
    const res  = await fetch("/api/alumno/request-access", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ dni: digits }),
    }).catch(() => null);
    const data = await res?.json().catch(() => null) as { error?: string }|null;
    if (!res?.ok) { setErrMsg(data?.error ?? "Error al enviar."); setStatus("idle"); return; }
    setStatus("sent");
  };

  const reset = () => { setStatus("idle"); setDni(""); setTouched(false); setErrMsg(null); };

  // ── Sent state ────────────────────────────────────────────────────
  if (status === "sent") {
    return (
      <div style={{ minHeight:"100svh", background:"#0a0a0a", display:"flex", flexDirection:"column", color:"#fff", fontFamily:FB }}>
        <style>{`@import url('https://fonts.googleapis.com/css2?family=Archivo+Black&family=JetBrains+Mono:wght@500;600;700&display=swap');`}</style>
        <div style={{ flex:1, display:"flex", flexDirection:"column", alignItems:"center", justifyContent:"center", padding:"0 32px", textAlign:"center", gap:24 }}>
          <div style={{ width:96, height:96, borderRadius:"50%", background:rgb(accent,0.18), color:accent, display:"flex", alignItems:"center", justifyContent:"center", boxShadow:`0 0 0 1px ${rgb(accent,0.18)}, 0 20px 60px ${rgb(accent,0.18)}` }}>
            <IcoCheck size={44}/>
          </div>
          <div>
            <div style={{ fontFamily:FD, fontSize:34, lineHeight:1, letterSpacing:"-0.01em", textTransform:"uppercase", marginBottom:14 }}>
              Revisá tu WhatsApp
            </div>
            <div style={{ fontSize:16, lineHeight:1.5, color:"rgba(255,255,255,0.65)", maxWidth:280, margin:"0 auto" }}>
              Si tu DNI está registrado en el gym, recibís el enlace de acceso en segundos.
              <br/><br/>
              <span style={{ fontSize:13, color:"rgba(255,255,255,0.3)" }}>¿No llegó? Verificá que el gym tenga tu número correcto.</span>
            </div>
          </div>
          <div style={{ padding:"12px 18px", background:"rgba(255,255,255,0.04)", border:"1px solid rgba(255,255,255,0.08)", borderRadius:12, fontSize:13, color:"rgba(255,255,255,0.7)", display:"flex", alignItems:"center", gap:10 }}>
            <IcoWA size={18}/>
            <span>DNI terminado en <b style={{ color:"#fff", fontFamily:FM }}>•••• {digits.slice(-4)}</b></span>
          </div>
        </div>
        <div style={{ padding:"0 24px 56px" }}>
          <button onClick={reset} style={{ width:"100%", height:56, borderRadius:16, border:"none", background:"transparent", color:"rgba(255,255,255,0.4)", fontSize:14, letterSpacing:"0.04em", cursor:"pointer", fontFamily:FB }}>
            Usar otro DNI
          </button>
        </div>
      </div>
    );
  }

  // ── Main state ────────────────────────────────────────────────────
  return (
    <div style={{ minHeight:"100svh", background:"#0a0a0a", display:"flex", flexDirection:"column", color:"#fff", fontFamily:FB, overflowX:"hidden" }}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Archivo+Black&family=JetBrains+Mono:wght@500;600;700&display=swap');
        @keyframes spin { to { transform: rotate(360deg); } }
        .dni-inp::placeholder { color: rgba(255,255,255,0.25); }
      `}</style>

      {/* ── Hero ────────────────────────────────────────────────── */}
      <div style={{ position:"relative", height:"min(480px, 57svh)", width:"100%", flexShrink:0 }}>

        {/* Image clip — full bleed, only bottom corners rounded */}
        <div style={{ position:"absolute", inset:0, borderBottomLeftRadius:36, borderBottomRightRadius:36, overflow:"hidden" }}>
          <img src={HERO} alt="" style={{ position:"absolute", inset:0, width:"100%", height:"100%", objectFit:"cover", filter:"blur(2px) saturate(0.85) brightness(0.78)", transform:"scale(1.06)" }}/>
          {/* dark vignette */}
          <div style={{ position:"absolute", inset:0, background:"linear-gradient(180deg, rgba(10,10,10,0.55) 0%, rgba(10,10,10,0) 30%, rgba(10,10,10,0) 50%, rgba(10,10,10,0.97) 100%)" }}/>
          {/* warm tint */}
          <div style={{ position:"absolute", inset:0, background:`radial-gradient(ellipse at 30% 30%, ${rgb(accent,0.18)} 0%, transparent 55%)`, mixBlendMode:"screen" }}/>
          <Grain/>
        </div>

        {/* "Acceso · alumno" label — top left */}
        <div style={{ position:"absolute", top:56, left:28, zIndex:5, display:"flex", alignItems:"center", gap:8, fontFamily:FM, fontSize:10.5, letterSpacing:"0.22em", textTransform:"uppercase", fontWeight:600, color:"rgba(255,255,255,0.78)" }}>
          <span style={{ width:6, height:6, borderRadius:"50%", background:accent, boxShadow:`0 0 12px ${accent}` }}/>
          Acceso · alumno
        </div>

        {/* "Soy nuevo" pill — top right (only if gym slug known) */}
        {slug && (
          <div style={{ position:"absolute", top:50, right:24, zIndex:5 }}>
            <Link href={`/gym/${slug}/reservar`} style={{ textDecoration:"none" }}>
              <div style={{ height:32, padding:"0 12px", background:"rgba(20,20,20,0.55)", backdropFilter:"blur(14px) saturate(140%)", WebkitBackdropFilter:"blur(14px) saturate(140%)", border:"1px solid rgba(255,255,255,0.08)", borderRadius:99, display:"flex", alignItems:"center", gap:6, fontSize:12, fontWeight:500, color:"rgba(255,255,255,0.92)" }}>
                Soy nuevo
                <span style={{ color:accent, display:"flex" }}><IcoArrow size={13}/></span>
              </div>
            </Link>
          </div>
        )}

        {/* Gym name + tagline — overlaps below hero */}
        <div style={{ position:"absolute", left:24, right:24, bottom:-20, zIndex:6 }}>
          <div style={{ display:"flex", alignItems:"center", gap:10, marginBottom:10, marginLeft:2 }}>
            <span style={{ width:22, height:1.5, background:accent, boxShadow:`0 0 8px ${accent}`, flexShrink:0 }}/>
            <span style={{ fontFamily:FM, fontSize:10, letterSpacing:"0.28em", textTransform:"uppercase", fontWeight:600, color:"rgba(255,255,255,0.55)" }}>EST · 2018</span>
          </div>
          <div style={{
            fontFamily:FD,
            fontSize:getGymNameFontSize(),
            lineHeight:0.86,
            letterSpacing:"-0.045em",
            textTransform:"uppercase",
            color:"#fff",
            textShadow:"0 6px 30px rgba(0,0,0,0.7)",
            marginLeft:-4,
            overflow:"hidden",
            wordBreak:"break-word",
            maxWidth:"100%"
          }}>
            {gymName}
          </div>
          <div style={{ fontSize:14, color:"rgba(255,255,255,0.62)", lineHeight:1.5, marginTop:20, marginLeft:2, fontFamily:FM, letterSpacing:"0.01em" }}>
            Tu acceso, en un mensaje.
          </div>
        </div>
      </div>

      {/* ── Bottom panel ────────────────────────────────────────── */}
      <div style={{ flex:1, padding:"64px 24px 36px", display:"flex", flexDirection:"column", gap:18 }}>

        <div>
          <div style={{ display:"flex", alignItems:"center", gap:8, marginBottom:10 }}>
            <span style={{ width:14, height:1.5, background:accent, boxShadow:`0 0 6px ${accent}`, flexShrink:0 }}/>
            <div style={{ fontFamily:FM, fontSize:10.5, letterSpacing:"0.24em", textTransform:"uppercase", color:accent, fontWeight:600 }}>Bienvenido / 01</div>
          </div>
          <div style={{ fontSize:21, fontWeight:500, lineHeight:1.25, color:"#fff", letterSpacing:"-0.01em" }}>
            Ingresá tu DNI y te mandamos el acceso por WhatsApp.
          </div>
        </div>

        {/* DNI input */}
        <div style={{ display:"flex", flexDirection:"column", gap:8 }}>
          <div style={{
            background: focused ? `linear-gradient(180deg,${rgb(accent,0.06)},${rgb(accent,0.02)})` : "rgba(255,255,255,0.025)",
            border: `1px solid ${showErr ? "#ff5252" : rgb(accent, focused ? 0.85 : 0.45)}`,
            borderRadius:14, padding:"14px 16px",
            display:"flex", alignItems:"center", gap:12,
            boxShadow: focused ? `0 0 0 4px ${rgb(accent,0.12)}, inset 0 0 22px ${rgb(accent,0.08)}` : "none",
            transition:"all 0.18s",
          }}>
            <span style={{ fontFamily:FM, fontSize:11, fontWeight:700, letterSpacing:"0.1em", color:accent, padding:"4px 8px", borderRadius:6, background:rgb(accent,0.12), border:`1px solid ${rgb(accent,0.3)}`, flexShrink:0 }}>
              DNI
            </span>
            <input
              className="dni-inp"
              type="tel" inputMode="numeric" placeholder="00.000.000"
              value={dni}
              onChange={e => { setDni(fmt(e.target.value)); setTouched(true); }}
              onFocus={() => setFocused(true)}
              onBlur={() => setFocused(false)}
              style={{ flex:1, background:"transparent", border:"none", outline:"none", color:"#fff", fontSize:20, fontFamily:FM, letterSpacing:"0.06em", fontWeight:600, minWidth:0 }}
            />
            {isValid && <span style={{ color:accent, display:"flex" }}><IcoCheck size={20}/></span>}
          </div>
          {showErr && (
            <div style={{ fontSize:11.5, color:"#ff7777", fontFamily:FM, letterSpacing:"0.02em" }}>↳ Documento inválido — 7 u 8 dígitos.</div>
          )}
          {errMsg && (
            <div style={{ fontSize:11.5, color:"#ff7777", fontFamily:FM, letterSpacing:"0.02em" }}>↳ {errMsg}</div>
          )}
        </div>

        {/* CTA */}
        <button
          onClick={submit}
          disabled={!isValid || status === "loading"}
          style={{
            marginTop:4, width:"100%", height:60, borderRadius:18,
            border: isValid ? "none" : `1px solid ${rgb(accent,0.35)}`,
            background: isValid ? accent : "rgba(255,255,255,0.025)",
            color: isValid ? "#1a0d00" : rgb(accent,0.7),
            fontSize:15.5, fontWeight:700, letterSpacing:"0.005em", fontFamily:FB,
            display:"flex", alignItems:"center", justifyContent:"space-between",
            padding:"0 22px", cursor: isValid ? "pointer" : "not-allowed",
            transition:"all 0.2s",
            boxShadow: isValid ? `0 12px 40px ${rgb(accent,0.35)}, inset 0 1px 0 rgba(255,255,255,0.22)` : "none",
          }}
        >
          {status === "loading" ? (
            <>
              <span>Enviando…</span>
              <span style={{ width:22, height:22, border:"2.5px solid currentColor", borderTopColor:"transparent", borderRadius:"50%", animation:"spin 0.8s linear infinite", display:"inline-block" }}/>
            </>
          ) : (
            <>
              <span style={{ display:"flex", alignItems:"center", gap:10 }}>
                <IcoWA size={20}/>
                Recibir acceso por WhatsApp
              </span>
              <IcoArrow size={18}/>
            </>
          )}
        </button>

        {/* PWA install — Android */}
        {!installDone && deferredPrompt && (
          <button onClick={triggerInstall} style={{
            display:"flex", alignItems:"center", justifyContent:"space-between",
            width:"100%", padding:"12px 16px", borderRadius:14,
            background:"rgba(255,255,255,0.04)", border:`1px solid ${rgb(accent,0.25)}`,
            cursor:"pointer", gap:12,
          }}>
            <div style={{ display:"flex", alignItems:"center", gap:10 }}>
              <span style={{ fontSize:22 }}>📲</span>
              <div style={{ textAlign:"left" }}>
                <div style={{ fontSize:13, fontWeight:600, color:"#fff", fontFamily:FB }}>Agregar al inicio</div>
                <div style={{ fontSize:11, color:"rgba(255,255,255,0.4)", fontFamily:FB }}>Accedé más rápido desde tu celular</div>
              </div>
            </div>
            <span style={{ fontSize:11, fontWeight:700, color:accent, fontFamily:FB, whiteSpace:"nowrap" }}>Instalar</span>
          </button>
        )}

        {/* PWA install — iOS hint */}
        {showIosHint && (
          <div style={{
            padding:"12px 16px", borderRadius:14,
            background:"rgba(255,255,255,0.04)", border:`1px solid ${rgb(accent,0.2)}`,
            display:"flex", alignItems:"flex-start", gap:10,
          }}>
            <span style={{ fontSize:20, flexShrink:0 }}>📲</span>
            <div style={{ fontSize:12, color:"rgba(255,255,255,0.55)", lineHeight:1.5, fontFamily:FB }}>
              Agregá esta app al inicio: tocá{" "}
              <span style={{ color:"rgba(255,255,255,0.85)" }}>Compartir</span>
              {" "}→{" "}
              <span style={{ color:"rgba(255,255,255,0.85)" }}>Agregar a inicio</span>
            </div>
          </div>
        )}

        {/* Footnote */}
        <div style={{ marginTop:"auto", paddingTop:12, fontSize:11.5, color:"rgba(255,255,255,0.3)", textAlign:"center", lineHeight:1.5 }}>
          Te mandamos un link de un solo uso.<br/>
          No necesitás recordar contraseñas.
        </div>
      </div>
    </div>
  );
}

export default function AlumnoLoginPage() {
  return (
    <Suspense fallback={null}>
      <LoginContent/>
    </Suspense>
  );
}
