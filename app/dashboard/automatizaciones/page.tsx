"use client";

import { useState, useEffect, useRef } from "react";
import {
  Zap, Bell, MessageSquare, Smartphone, X, CheckCircle, Loader2,
  Lock, Gift, UserX, Globe, ExternalLink, Copy,
  Upload, Save, Palette, BatteryLow, BatteryMedium, BatteryFull,
  BatteryCharging, Signal, WifiOff, Send,
} from "lucide-react";
import { supabase } from "@/lib/supabase";

const fd = "var(--font-inter, 'Inter', sans-serif)";
const fb = "var(--font-inter, 'Inter', sans-serif)";
const t1 = "#1A1D23";
const t2 = "#6B7280";
const t3 = "#9CA3AF";
const ORANGE = "#F97316";

const card = {
  background: "#FFFFFF",
  border: "1px solid rgba(0,0,0,0.05)",
  borderRadius: 14,
  boxShadow: "0 2px 8px rgba(0,0,0,0.06), 0 0 1px rgba(0,0,0,0.04)",
};

// --- Componentes Auxiliares ---
function Toggle({ checked, onChange }: { checked: boolean; onChange: () => void }) {
  return (
    <button
      type="button" onClick={onChange}
      style={{ width: 44, height: 24, borderRadius: 9999, border: "none", background: checked ? ORANGE : "rgba(0,0,0,0.12)", position: "relative", cursor: "pointer", transition: "background 0.2s", flexShrink: 0 }}
    >
      <span style={{ position: "absolute", top: 3, left: checked ? 23 : 3, width: 18, height: 18, borderRadius: "50%", background: "white", boxShadow: "0 1px 4px rgba(0,0,0,0.20)", transition: "left 0.2s", display: "block" }} />
    </button>
  );
}

function LockedCard({ icon, color, bg, title, desc, badge }: { icon: React.ReactNode; color: string; bg: string; title: string; desc: string; badge: string }) {
  return (
    <div style={{ position: "relative", padding: "18px 20px", background: "#F9FAFB", borderRadius: 12, border: "1px solid rgba(0,0,0,0.06)", overflow: "hidden" }}>
      <div style={{ position: "absolute", inset: 0, backdropFilter: "blur(2px)", WebkitBackdropFilter: "blur(2px)", background: "rgba(249,250,251,0.55)", zIndex: 2, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 8 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 7, background: "#1A1D23", borderRadius: 9999, padding: "7px 14px" }}>
          <Lock size={12} color="white" />
          <span style={{ font: `700 0.72rem/1 ${fd}`, color: "white" }}>{badge}</span>
        </div>
        <p style={{ font: `400 0.72rem/1 ${fb}`, color: t3 }}>Actualizá tu plan para desbloquear</p>
      </div>
      <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 16, opacity: 0.4 }}>
        <div style={{ display: "flex", gap: 12 }}>
          <div style={{ width: 36, height: 36, borderRadius: 9, background: bg, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
            {icon}
          </div>
          <div>
            <p style={{ font: `600 0.875rem/1 ${fd}`, color: t1, marginBottom: 4 }}>{title}</p>
            <p style={{ font: `400 0.78rem/1.4 ${fb}`, color: t2 }}>{desc}</p>
          </div>
        </div>
        <div style={{ width: 44, height: 24, borderRadius: 9999, background: "rgba(0,0,0,0.12)", flexShrink: 0 }} />
      </div>
    </div>
  );
}

type WaStatus = "unknown" | "connected" | "disconnected";

function BatteryIcon({ value, plugged }: { value: number; plugged?: boolean }) {
  if (plugged) return <BatteryCharging size={13} color="#16A34A" />;
  if (value <= 20) return <BatteryLow size={13} color="#DC2626" />;
  if (value <= 60) return <BatteryMedium size={13} color="#F97316" />;
  return <BatteryFull size={13} color="#16A34A" />;
}

function SignalIcon({ bars }: { bars: number }) {
  if (bars === 0) return <WifiOff size={13} color="#DC2626" />;
  return <Signal size={13} color={bars >= 3 ? "#16A34A" : "#F97316"} />;
}

// --- Componente de la Página ---
export default function AutomatizacionesPage() {
  const [gymId,     setGymId]     = useState<string | null>(null);
  const [waStatus,  setWaStatus]  = useState<WaStatus>("unknown");
  const [waBattery, setWaBattery] = useState<number | null>(null);
  const [waPlugged, setWaPlugged] = useState<boolean | null>(null);
  const [waSignal,  setWaSignal]  = useState<number | null>(null);
  const [waPhone,   setWaPhone]   = useState<string | null>(null);
  const [qrModal,   setQrModal]   = useState(false);
  const [qrImage,   setQrImage]   = useState<string | null>(null);
  const [qrLoading, setQrLoading] = useState(false);
  const [qrError,   setQrError]   = useState<"max" | null>(null);
  const [qrAttempt, setQrAttempt] = useState(0);
  const pollRef    = useRef<ReturnType<typeof setInterval> | null>(null);
  const retryRef   = useRef<ReturnType<typeof setTimeout> | null>(null);

  const DEFAULT_MAGICLINK_MSG = "¡Hola [Nombre]! 👋\nIngresá a tu panel de *[Gym]* desde acá:\n[Link]";

  const [recordatorio,        setRecordatorio]        = useState(true);
  const [churn,               setChurn]               = useState(false);
  const [inactividad,         setInactividad]         = useState(false);
  const [inactividadDias,     setInactividadDias]     = useState(7);
  const [inactividadMsg,      setInactividadMsg]      = useState("");
  const [enviandoReactivacion, setEnviandoReactivacion] = useState(false);
  const [reactivacionResult,  setReactivacionResult]  = useState<{ ok: boolean; msg: string } | null>(null);
  const [gymName,             setGymName]             = useState("");
  const [cobro,          setCobro]          = useState("[tu método de cobro]");
  const [aliasGym,       setAliasGym]       = useState("");
  const [magiclinkMsg,   setMagiclinkMsg]   = useState(DEFAULT_MAGICLINK_MSG);
  const [msgChurn,       setMsgChurn]       = useState("¡Hola! Te extrañamos en el gym. ¿Todo bien? Cuando quieras volvés, te esperamos 💪");
  const [welcomeMsg,     setWelcomeMsg]     = useState("¡Hola [Nombre]! Recibimos tu pedido de clase gratis en [Gym]. ¿En qué horario te queda mejor? 💪");

  const [landingActive] = useState(false);
  const [copiedSlug, setCopiedSlug] = useState(false);
  const [gymSlug,    setGymSlug]    = useState("tu-gym");
  const slugUrl = `fitgrowx.app/${gymSlug}`;

  const [landingTitle,    setLandingTitle]    = useState("Probá una clase gratis.");
  const [landingDesc,     setLandingDesc]     = useState("Vení a conocernos. Te esperamos con una clase de bienvenida totalmente gratis.");
  const [leadAutoWelcome, setLeadAutoWelcome] = useState(true);
  const [accentColor,     setAccentColor]     = useState("#F97316");
  const [logoUrl,         setLogoUrl]         = useState<string | null>(null);
  const [saving,          setSaving]          = useState(false);
  const [logoUploading,   setLogoUploading]   = useState(false);
  const [savedOk,         setSavedOk]         = useState(false);

  const MOTOR = process.env.NEXT_PUBLIC_WA_MOTOR_URL ?? "https://motor-wsp-fitgrowx-production.up.railway.app";

  // Obtener gymId del usuario logueado
  useEffect(() => {
    (async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (user) setGymId(user.id);
    })();
  }, []);

  // Carga inicial de estado de WhatsApp
  useEffect(() => {
    if (!gymId) return;
    (async () => {
      try {
        const res  = await fetch(`${MOTOR}/session-status/${gymId}`);
        const data = await res.json();
        setWaStatus(data.status === "active" ? "connected" : "disconnected");
        if (data.phone)          setWaPhone(data.phone);
        if (data.battery != null) setWaBattery(data.battery);
        if (data.plugged != null) setWaPlugged(data.plugged);
        if (data.signal  != null) setWaSignal(data.signal);
      } catch {
        setWaStatus("disconnected");
      }
    })();
  }, [gymId]);

  // Carga inicial de settings desde Supabase
  useEffect(() => {
    if (!gymId) return;
    (async () => {
      const { data: s } = await supabase.from("gym_settings").select("*").eq("gym_id", gymId).maybeSingle();
      if (s) {
        if (s.accent_color)          setAccentColor(s.accent_color);
        if (s.logo_url)              setLogoUrl(s.logo_url);
        if (s.landing_title)         setLandingTitle(s.landing_title);
        if (s.landing_desc)          setLandingDesc(s.landing_desc);
        if (s.slug)                  setGymSlug(s.slug);
        if (s.cobro_alias)         { setAliasGym(s.cobro_alias); setCobro(s.cobro_alias); }
        if (s.welcome_msg)           setWelcomeMsg(s.welcome_msg);
        if (s.gym_name)              setGymName(s.gym_name);
        if (s.magiclink_msg)         setMagiclinkMsg(s.magiclink_msg);
        if (s.inactividad_activo != null) setInactividad(s.inactividad_activo);
        if (s.inactividad_dias)      setInactividadDias(s.inactividad_dias);
        if (s.inactividad_msg)       setInactividadMsg(s.inactividad_msg);
      }
    })();
  }, [gymId]);

  const saveSettings = async () => {
    setSaving(true);
    await supabase.from("gym_settings").upsert({
      gym_id: gymId,
      accent_color: accentColor,
      logo_url: logoUrl,
      landing_title: landingTitle,
      landing_desc: landingDesc,
      cobro_alias: aliasGym.trim() || null,
      welcome_msg: welcomeMsg.trim() || null,
      gym_name: gymName.trim() || null,
      magiclink_msg: magiclinkMsg.trim() || null,
      inactividad_activo: inactividad,
      inactividad_dias: inactividadDias,
      inactividad_msg: inactividadMsg.trim() || null,
    }, { onConflict: "gym_id" });
    setSaving(false);
    setSavedOk(true);
    setTimeout(() => setSavedOk(false), 2400);
  };

  const uploadLogo = async (file: File) => {
    setLogoUploading(true);
    const ext = file.name.split(".").pop() ?? "png";
    const path = `logos/${gymId}.${ext}`;
    await supabase.storage.from("gym-assets").upload(path, file, { upsert: true });
    const { data: { publicUrl } } = supabase.storage.from("gym-assets").getPublicUrl(path);
    setLogoUrl(publicUrl);
    setLogoUploading(false);
  };

  const stopPolling = () => {
    if (pollRef.current)  { clearInterval(pollRef.current);  pollRef.current  = null; }
    if (retryRef.current) { clearTimeout(retryRef.current);  retryRef.current = null; }
  };

  const startStatusPoll = () => {
    stopPolling();
    pollRef.current = setInterval(async () => {
      try {
        const res  = await fetch(`${MOTOR}/session-status/${gymId}`);
        const data = await res.json();
        if (data.status === "active") {
          stopPolling();
          setWaStatus("connected");
          if (data.phone) setWaPhone(data.phone);
          setQrModal(false);
        }
      } catch { /* ignore */ }
    }, 3000);
  };

  const attemptQrConnect = async (attempt: number) => {
    setQrAttempt(Math.min(attempt, 2));
    setQrLoading(true);
    setQrImage(null);

    try {
      // Solo limpiar ghost session en el primer intento
      if (attempt === 0) {
        await fetch(`${MOTOR}/session/${gymId}`, { method: "DELETE" }).catch(() => {});
      }

      const res  = await fetch(`${MOTOR}/qr/${gymId}/data`, { cache: "no-store" });
      const data = await res.json();

      if (data.status === "active") {
        setWaStatus("connected"); setQrModal(false); setQrLoading(false); return;
      }
      if (data.qr) {
        setQrImage(data.qr); setQrLoading(false);
        startStatusPoll();
        return;
      }
      // Motor aún conectando — reintentar sin contar como error
      retryRef.current = setTimeout(() => attemptQrConnect(attempt + 1), 2000);
    } catch {
      setQrLoading(false);
      if (attempt < 4) {
        retryRef.current = setTimeout(() => attemptQrConnect(attempt + 1), 3000);
      } else {
        setQrError("max");
      }
    }
  };

  const openQrModal = () => {
    stopPolling();
    setQrModal(true);
    setQrImage(null);
    setQrError(null);
    setQrAttempt(0);
    attemptQrConnect(0);
  };

  const closeQrModal = () => {
    stopPolling();
    setQrModal(false);
  };

  const disconnectWA = async () => {
    if(!confirm("¿Desvincular WhatsApp? Se detendrán los mensajes automáticos.")) return;
    stopPolling();
    await fetch(`${MOTOR}/session/${gymId}`, { method: "DELETE" });
    setWaStatus("disconnected");
    setWaPhone(null); setWaBattery(null); setWaPlugged(null); setWaSignal(null);
    openQrModal();
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 18 }}>
      <style>{`@keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }`}</style>

      {/* Header */}
      <div>
        <p style={{ font: `500 0.72rem/1 ${fb}`, color: t3, textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: 6 }}>Mensajería & Captación</p>
        <h1 style={{ font: `800 2rem/1 ${fd}`, color: t1, letterSpacing: "-0.02em" }}>Automatizaciones</h1>
        <p style={{ font: `400 0.875rem/1.4 ${fb}`, color: t2, marginTop: 4 }}>Vinculá tu WhatsApp, activá mensajes automáticos y generá leads desde tu landing.</p>
      </div>

      {/* ── WhatsApp del Gimnasio ── */}
      <div style={{ ...card, padding: "28px 28px 24px" }}>
        <div style={{ display: "flex", alignItems: "flex-start", gap: 14, marginBottom: 24 }}>
          <div style={{ width: 40, height: 40, borderRadius: 10, background: "#2C2C2E", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
            <MessageSquare size={18} color="white" />
          </div>
          <div>
            <h2 style={{ font: `700 1rem/1 ${fd}`, color: t1, marginBottom: 4 }}>WhatsApp del Gimnasio</h2>
            <p style={{ font: `400 0.82rem/1.4 ${fb}`, color: t2 }}>Vinculá tu número para enviar confirmaciones de pago y recordatorios automáticos.</p>
          </div>
        </div>

        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "16px 20px", background: "#F9FAFB", borderRadius: 12, border: "1px solid rgba(0,0,0,0.06)" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
            <div style={{ width: 38, height: 38, borderRadius: 10, background: waStatus === "connected" ? "rgba(22,163,74,0.10)" : "#F0F2F8", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
              <Smartphone size={17} color={waStatus === "connected" ? "#16A34A" : t3} />
            </div>
            <div>
              <p style={{ font: `600 0.875rem/1 ${fd}`, color: t1, marginBottom: 3 }}>
                {waStatus === "connected" ? "WhatsApp Conectado" : "Sin dispositivo vinculado"}
              </p>
              <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                <p style={{ font: `400 0.75rem/1 ${fb}`, color: t3 }}>
                  {waStatus === "connected" ? (waPhone ? `+${waPhone}` : "Activo") : "Vinculá tu WhatsApp para activar los mensajes automáticos."}
                </p>
                {waStatus === "connected" && waBattery !== null && (
                  <div style={{ display: "flex", alignItems: "center", gap: 4, marginLeft: 4 }}>
                     <BatteryIcon value={waBattery} plugged={waPlugged || false} />
                     <span style={{ font: `500 0.65rem/1 ${fb}`, color: t3 }}>{waBattery}%</span>
                     {waSignal !== null && <SignalIcon bars={waSignal} />}
                  </div>
                )}
              </div>
            </div>
          </div>
          {waStatus === "connected" ? (
            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 6, background: "rgba(22,163,74,0.09)", border: "1px solid rgba(22,163,74,0.22)", borderRadius: 9999, padding: "7px 14px" }}>
                <CheckCircle size={14} color="#16A34A" />
                <span style={{ font: `700 0.78rem/1 ${fb}`, color: "#16A34A" }}>Conectado</span>
              </div>
              <button
                onClick={disconnectWA}
                title="Desconectar"
                style={{ display: "flex", alignItems: "center", gap: 6, background: "transparent", border: "1px solid rgba(220,38,38,0.25)", borderRadius: 9999, padding: "7px 14px", cursor: "pointer", font: `600 0.75rem/1 ${fb}`, color: "#DC2626", transition: "background 0.15s" }}
              >
                <X size={13} /> Desvincular
              </button>
            </div>
          ) : (
            <button
              onClick={openQrModal}
              style={{ display: "flex", alignItems: "center", gap: 7, background: "#25D366", color: "white", border: "none", padding: "11px 22px", borderRadius: 10, font: `700 0.875rem/1 ${fd}`, cursor: "pointer", boxShadow: "0 4px 16px rgba(37,211,102,0.35)" }}
            >
              <Smartphone size={15} /> Vincular WhatsApp
            </button>
          )}
        </div>
      </div>

      {/* Modal QR */}
      {qrModal && (
        <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.6)", backdropFilter: "blur(4px)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 9999 }}>
          <div style={{ background: "white", width: "90%", maxWidth: 400, borderRadius: 24, padding: 32, position: "relative", textAlign: "center", boxShadow: "0 20px 40px rgba(0,0,0,0.2)" }}>
            <button onClick={closeQrModal} style={{ position: "absolute", top: 20, right: 20, background: "none", border: "none", cursor: "pointer", color: t3 }}><X size={24} /></button>
            <h3 style={{ font: `700 1.25rem/1.2 ${fd}`, color: t1, marginBottom: 8 }}>Vincular WhatsApp</h3>
            <p style={{ font: `400 0.875rem/1.4 ${fb}`, color: t2, marginBottom: 24 }}>Escaneá el código desde WhatsApp › Dispositivos vinculados.</p>

            <div style={{ width: 240, height: 240, margin: "0 auto", background: "#F9FAFB", borderRadius: 16, border: "1px solid rgba(0,0,0,0.05)", display: "flex", alignItems: "center", justifyContent: "center", overflow: "hidden" }}>
              {qrLoading ? (
                <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 14 }}>
                  <Loader2 size={32} color={ORANGE} style={{ animation: "spin 1s linear infinite" }} />
                  <div>
                    <p style={{ font: `600 0.78rem/1 ${fd}`, color: t1, marginBottom: 4 }}>
                      {qrAttempt === 0 ? "Conectando con el motor…" : `Reintentando (${qrAttempt + 1}/3)…`}
                    </p>
                  </div>
                  <div style={{ display: "flex", gap: 6 }}>
                    {[0, 1, 2].map(i => (
                      <div key={i} style={{ width: 7, height: 7, borderRadius: "50%", background: i <= qrAttempt ? ORANGE : "#E5E7EB", transition: "background 0.3s" }} />
                    ))}
                  </div>
                </div>
              ) : qrError === "max" ? (
                <div style={{ padding: "20px 16px", display: "flex", flexDirection: "column", alignItems: "center", gap: 10 }}>
                  <WifiOff size={20} color="#DC2626" />
                  <p style={{ font: `700 0.82rem/1.3 ${fd}`, color: "#DC2626" }}>No se pudo conectar</p>
                  <button onClick={openQrModal} style={{ marginTop: 4, background: ORANGE, color: "white", border: "none", borderRadius: 9, padding: "8px 20px", font: `700 0.78rem/1 ${fd}`, cursor: "pointer" }}>Volver a intentar</button>
                </div>
              ) : qrImage ? (
                <img src={qrImage} alt="WhatsApp QR" style={{ width: "100%", height: "100%", display: "block" }} />
              ) : null}
            </div>
            {qrImage && <p style={{ font: `500 0.72rem/1 ${fb}`, color: t3, marginTop: 20 }}>Esperando escaneo…</p>}
          </div>
        </div>
      )}

      {/* ── Mensaje de Acceso de Alumnos ── */}
      <div style={{ ...card, padding: "28px 28px 24px" }}>
        <div style={{ display: "flex", alignItems: "flex-start", gap: 14, marginBottom: 20 }}>
          <div style={{ width: 40, height: 40, borderRadius: 10, background: "#2C2C2E", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
            <MessageSquare size={18} color={ORANGE} />
          </div>
          <div>
            <h2 style={{ font: `700 1rem/1 ${fd}`, color: t1, marginBottom: 4 }}>Mensaje de Acceso al Panel</h2>
            <p style={{ font: `400 0.82rem/1.4 ${fb}`, color: t2 }}>Texto que recibe el alumno cuando solicita su link de ingreso por WhatsApp.</p>
          </div>
        </div>

        <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
          {/* Nombre del gym */}
          <div>
            <label style={{ display: "block", font: `500 0.72rem/1 ${fb}`, color: t3, marginBottom: 7 }}>
              Nombre de tu Gym / Box
            </label>
            <input
              value={gymName}
              onChange={e => setGymName(e.target.value)}
              placeholder="Ej: CrossFit La Boca, Gym Power, Box Norte…"
              style={{ width: "100%", padding: "10px 12px", borderRadius: 8, border: "1px solid #E5E7EB", font: `400 0.875rem/1 ${fb}`, color: t1, outline: "none", boxSizing: "border-box" }}
            />
          </div>

          {/* Plantilla del mensaje */}
          <div>
            <label style={{ display: "block", font: `500 0.72rem/1 ${fb}`, color: t3, marginBottom: 4 }}>
              Mensaje personalizado
            </label>
            <p style={{ font: `400 0.72rem/1.4 ${fb}`, color: t3, marginBottom: 7 }}>
              Variables disponibles: <code style={{ background: "rgba(249,115,22,0.08)", color: ORANGE, padding: "1px 5px", borderRadius: 4 }}>[Nombre]</code>{" "}
              <code style={{ background: "rgba(249,115,22,0.08)", color: ORANGE, padding: "1px 5px", borderRadius: 4 }}>[Gym]</code>{" "}
              <code style={{ background: "rgba(249,115,22,0.08)", color: ORANGE, padding: "1px 5px", borderRadius: 4 }}>[Link]</code>
            </p>
            <textarea
              value={magiclinkMsg}
              onChange={e => setMagiclinkMsg(e.target.value)}
              rows={4}
              style={{ width: "100%", padding: "10px 12px", borderRadius: 8, border: "1px solid #E5E7EB", font: `400 0.875rem/1.5 ${fb}`, color: t1, outline: "none", resize: "vertical", boxSizing: "border-box" }}
            />
            <div style={{ marginTop: 8, padding: "10px 14px", background: "#F9FAFB", borderRadius: 8, border: "1px solid rgba(0,0,0,0.06)" }}>
              <p style={{ font: `500 0.7rem/1 ${fb}`, color: t3, marginBottom: 6, textTransform: "uppercase", letterSpacing: "0.06em" }}>Preview</p>
              <p style={{ font: `400 0.82rem/1.5 ${fb}`, color: t1, whiteSpace: "pre-line" }}>
                {magiclinkMsg
                  .replace(/\[Nombre\]/g, "Julián Álvarez")
                  .replace(/\[Gym\]/g,    gymName || "tu gimnasio")
                  .replace(/\[Link\]/g,   "https://fitgrowx.app/alumno/auth?token=…")}
              </p>
            </div>
          </div>

          <div style={{ display: "flex", justifyContent: "flex-end" }}>
            <button
              onClick={saveSettings}
              disabled={saving}
              style={{ display: "flex", alignItems: "center", gap: 6, padding: "9px 18px", borderRadius: 9, border: "none", background: savedOk ? "#16A34A" : ORANGE, color: "white", font: `700 0.82rem/1 ${fd}`, cursor: "pointer" }}
            >
              <Save size={13} /> {savedOk ? "Guardado ✓" : saving ? "Guardando..." : "Guardar mensaje"}
            </button>
          </div>
        </div>
      </div>

      {/* ── Mensajes Automáticos (Plan PRO) ── */}
      <div style={{ ...card, padding: "28px 28px 24px" }}>
        <div style={{ display: "flex", alignItems: "flex-start", gap: 14, marginBottom: 24 }}>
          <div style={{ width: 40, height: 40, borderRadius: 10, background: "#2C2C2E", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
            <Zap size={18} color="white" />
          </div>
          <div>
            <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 4 }}>
              <h2 style={{ font: `700 1rem/1 ${fd}`, color: t1 }}>Mensajes Automáticos</h2>
              <span style={{ font: `700 0.62rem/1 ${fd}`, color: ORANGE, background: "rgba(249,115,22,0.10)", border: "1px solid rgba(249,115,22,0.20)", borderRadius: 9999, padding: "3px 8px" }}>Plan PRO</span>
            </div>
            <p style={{ font: `400 0.82rem/1.4 ${fb}`, color: t2 }}>Activá recordatorios y alertas para retener alumnos sin esfuerzo.</p>
          </div>
        </div>

        {/* Alias / Cobro */}
        <div style={{ padding: "16px 20px", background: "rgba(249,115,22,0.04)", borderRadius: 12, border: "1px solid rgba(249,115,22,0.18)", marginBottom: 14 }}>
          <label style={{ display: "block", font: `600 0.78rem/1 ${fb}`, color: ORANGE, marginBottom: 6, textTransform: "uppercase", letterSpacing: "0.06em" }}>Mi Alias / CBU de Cobro</label>
          <input
            value={aliasGym}
            onChange={e => setAliasGym(e.target.value)}
            placeholder="Ej: Alias: GYM.POWER.MP"
            style={{ width: "100%", padding: "9px 12px", background: "white", border: "1px solid rgba(249,115,22,0.25)", borderRadius: 8, font: `400 0.875rem/1 ${fb}`, color: "#1A1D23", outline: "none", boxSizing: "border-box" }}
          />
        </div>

        {/* Recordatorio */}
        <div style={{ padding: "18px 20px", background: "#F9FAFB", borderRadius: 12, border: "1px solid rgba(0,0,0,0.06)", marginBottom: 14 }}>
          <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 16 }}>
            <div style={{ display: "flex", gap: 12 }}>
              <div style={{ width: 36, height: 36, borderRadius: 9, background: recordatorio ? "rgba(249,115,22,0.10)" : "#F0F2F8", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                <Bell size={16} color={recordatorio ? ORANGE : t3} />
              </div>
              <div>
                <p style={{ font: `600 0.875rem/1 ${fd}`, color: t1, marginBottom: 4 }}>Recordatorio de Vencimiento</p>
                <p style={{ font: `400 0.78rem/1.4 ${fb}`, color: t2 }}>Envía un mensaje 3 días antes de que venza la cuota.</p>
              </div>
            </div>
            <Toggle checked={recordatorio} onChange={() => setRecordatorio(!recordatorio)} />
          </div>
        </div>

        {/* Bienvenida Leads */}
        <div style={{ padding: "18px 20px", background: "#F9FAFB", borderRadius: 12, border: "1px solid rgba(0,0,0,0.06)", marginBottom: 14 }}>
          <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 16 }}>
            <div style={{ display: "flex", gap: 12 }}>
              <div style={{ width: 36, height: 36, borderRadius: 9, background: leadAutoWelcome ? "rgba(16,185,129,0.10)" : "#F0F2F8", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                <Zap size={16} color={leadAutoWelcome ? "#10B981" : t3} />
              </div>
              <div>
                <p style={{ font: `600 0.875rem/1 ${fd}`, color: t1, marginBottom: 4 }}>Bienvenida Automática a Leads</p>
                <p style={{ font: `400 0.78rem/1.4 ${fb}`, color: t2 }}>Mensaje instantáneo cuando agendan desde tu landing.</p>
              </div>
            </div>
            <Toggle checked={leadAutoWelcome} onChange={() => setLeadAutoWelcome(!leadAutoWelcome)} />
          </div>
        </div>

        {/* Recuperación por inactividad */}
        <div style={{ padding: "18px 20px", background: inactividad ? "rgba(220,38,38,0.03)" : "#F9FAFB", borderRadius: 12, border: `1px solid ${inactividad ? "rgba(220,38,38,0.15)" : "rgba(0,0,0,0.06)"}` }}>
          <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 16, marginBottom: inactividad ? 16 : 0 }}>
            <div style={{ display: "flex", gap: 12 }}>
              <div style={{ width: 36, height: 36, borderRadius: 9, background: inactividad ? "rgba(220,38,38,0.10)" : "#F0F2F8", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                <UserX size={16} color={inactividad ? "#DC2626" : t3} />
              </div>
              <div>
                <p style={{ font: `600 0.875rem/1 ${fd}`, color: t1, marginBottom: 4 }}>Recuperación por Inactividad</p>
                <p style={{ font: `400 0.78rem/1.4 ${fb}`, color: t2 }}>Mensaje automático a alumnos que no van hace X días.</p>
              </div>
            </div>
            <Toggle checked={inactividad} onChange={() => { setInactividad(v => !v); }} />
          </div>

          {inactividad && (
            <div style={{ display: "flex", flexDirection: "column", gap: 12, paddingTop: 4 }}>
              {/* Días */}
              <div>
                <label style={{ display: "block", font: `500 0.72rem/1 ${fb}`, color: t3, marginBottom: 6 }}>
                  Días sin asistencia para activar mensaje
                </label>
                <div style={{ display: "flex", gap: 6 }}>
                  {[3, 5, 7, 10, 14].map(d => (
                    <button
                      key={d}
                      onClick={() => setInactividadDias(d)}
                      style={{ padding: "7px 14px", borderRadius: 8, border: `1px solid ${inactividadDias === d ? "#DC2626" : "rgba(0,0,0,0.1)"}`, background: inactividadDias === d ? "rgba(220,38,38,0.07)" : "white", color: inactividadDias === d ? "#DC2626" : t2, font: `600 0.78rem/1 ${fd}`, cursor: "pointer" }}
                    >
                      {d}d
                    </button>
                  ))}
                </div>
              </div>

              {/* Mensaje personalizable */}
              <div>
                <label style={{ display: "block", font: `500 0.72rem/1 ${fb}`, color: t3, marginBottom: 4 }}>
                  Mensaje de reactivación
                </label>
                <p style={{ font: `400 0.72rem/1.4 ${fb}`, color: t3, marginBottom: 7 }}>
                  Variables: <code style={{ background: "rgba(249,115,22,0.08)", color: ORANGE, padding: "1px 5px", borderRadius: 4 }}>[Nombre]</code>{" "}
                  <code style={{ background: "rgba(249,115,22,0.08)", color: ORANGE, padding: "1px 5px", borderRadius: 4 }}>[Gym]</code>{" "}
                  <code style={{ background: "rgba(249,115,22,0.08)", color: ORANGE, padding: "1px 5px", borderRadius: 4 }}>[Dias]</code>
                </p>
                <textarea
                  value={inactividadMsg}
                  onChange={e => setInactividadMsg(e.target.value)}
                  placeholder={`¡Hola [Nombre]! 💪 Te extrañamos en *[Gym]*. Hace más de [Dias] días que no te vemos. ¡Volvé cuando quieras!`}
                  rows={3}
                  style={{ width: "100%", padding: "10px 12px", borderRadius: 8, border: "1px solid #E5E7EB", font: `400 0.875rem/1.5 ${fb}`, color: t1, outline: "none", resize: "vertical", boxSizing: "border-box" }}
                />
              </div>

              {/* Enviar ahora + guardar */}
              <div style={{ display: "flex", gap: 8, justifyContent: "flex-end" }}>
                <button
                  onClick={async () => {
                    setEnviandoReactivacion(true);
                    setReactivacionResult(null);
                    await saveSettings();
                    const d = await fetch("/api/cron/ausentes-trigger", {
                      method: "POST",
                      headers: { "Content-Type": "application/json" },
                      body: JSON.stringify({ gym_id: gymId }),
                    }).then(r => r.json()).catch(() => ({ ok: false, error: "Error de red" }));
                    setEnviandoReactivacion(false);
                    setReactivacionResult({ ok: d.ok, msg: d.ok ? `✓ ${d.enviados ?? 0} mensajes enviados` : (d.error ?? "Error") });
                    setTimeout(() => setReactivacionResult(null), 6000);
                  }}
                  disabled={enviandoReactivacion}
                  style={{ display: "flex", alignItems: "center", gap: 6, padding: "9px 16px", borderRadius: 9, border: "1px solid rgba(220,38,38,0.2)", background: "rgba(220,38,38,0.06)", color: "#DC2626", font: `600 0.78rem/1 ${fd}`, cursor: enviandoReactivacion ? "not-allowed" : "pointer", opacity: enviandoReactivacion ? 0.6 : 1 }}
                >
                  <Send size={13} /> {enviandoReactivacion ? "Enviando..." : "Enviar ahora"}
                </button>
                <button
                  onClick={saveSettings}
                  disabled={saving}
                  style={{ display: "flex", alignItems: "center", gap: 6, padding: "9px 18px", borderRadius: 9, border: "none", background: savedOk ? "#16A34A" : ORANGE, color: "white", font: `700 0.78rem/1 ${fd}`, cursor: "pointer" }}
                >
                  <Save size={13} /> {savedOk ? "Guardado ✓" : "Guardar"}
                </button>
              </div>

              {reactivacionResult && (
                <p style={{ font: `500 0.75rem/1 ${fb}`, color: reactivacionResult.ok ? "#16A34A" : "#DC2626", textAlign: "right" }}>
                  {reactivacionResult.msg}
                </p>
              )}
            </div>
          )}
        </div>
      </div>

      {/* ── Generador de Leads (Plan Elite) ── */}
      <div style={{ ...card, padding: "28px 28px 24px" }}>
        <div style={{ display: "flex", alignItems: "flex-start", gap: 14, marginBottom: 24 }}>
          <div style={{ width: 40, height: 40, borderRadius: 10, background: "linear-gradient(135deg,#1A1D23,#2C2C2E)", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
            <Globe size={18} color={ORANGE} />
          </div>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 4 }}>
              <h2 style={{ font: `700 1rem/1 ${fd}`, color: t1 }}>Generador de Leads</h2>
              <span style={{ font: `700 0.62rem/1 ${fd}`, color: "#8B5CF6", background: "rgba(139,92,246,0.10)", border: "1px solid rgba(139,92,246,0.22)", borderRadius: 9999, padding: "3px 8px" }}>Plan Elite</span>
            </div>
            <p style={{ font: `400 0.82rem/1.4 ${fb}`, color: t2 }}>Tu landing page pública para captar alumnos.</p>
          </div>
        </div>

        {/* Landing status */}
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "14px 18px", background: "#F9FAFB", borderRadius: 12, border: "1px solid rgba(0,0,0,0.06)", marginBottom: 20 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <div style={{ width: 8, height: 8, borderRadius: "50%", background: landingActive ? "#16A34A" : "#D1D5DB" }} />
            <div>
              <p style={{ font: `600 0.83rem/1 ${fd}`, color: t1, marginBottom: 2 }}>Landing Page — {landingActive ? "Activa" : "Inactiva"}</p>
              <p style={{ font: `400 0.72rem/1 ${fb}`, color: t3 }}>{slugUrl}</p>
            </div>
          </div>
          <div style={{ display: "flex", gap: 8 }}>
            <button
              onClick={() => { navigator.clipboard.writeText(slugUrl); setCopiedSlug(true); setTimeout(() => setCopiedSlug(false), 2000); }}
              style={{ padding: "7px 12px", borderRadius: 8, border: "1px solid rgba(0,0,0,0.10)", background: "white", color: t2, font: `600 0.72rem/1 ${fb}`, cursor: "pointer", display: "flex", alignItems: "center", gap: 5 }}
            >
              <Copy size={11} /> {copiedSlug ? "Copiado" : "Copiar link"}
            </button>
          </div>
        </div>

        {/* Configuración de Landing */}
        <div style={{ padding: "20px 22px", background: "#F9FAFB", borderRadius: 12, border: "1px solid rgba(0,0,0,0.06)", marginBottom: 20 }}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 18 }}>
            <p style={{ font: `700 0.875rem/1 ${fd}`, color: t1 }}>Configurar mi Landing</p>
            <button
              onClick={saveSettings}
              disabled={saving}
              style={{ display: "flex", alignItems: "center", gap: 6, padding: "8px 16px", borderRadius: 9, border: "none", background: savedOk ? "#16A34A" : accentColor, color: "white", font: `700 0.78rem/1 ${fd}`, cursor: "pointer" }}
            >
              <Save size={13} /> {savedOk ? "Guardado" : saving ? "Guardando..." : "Guardar"}
            </button>
          </div>

          <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
            {/* Logo */}
            <div>
              <label style={{ display: "block", font: `500 0.72rem/1 ${fb}`, color: t3, marginBottom: 7 }}>Logo del Gimnasio</label>
              <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                <div style={{ width: 56, height: 56, borderRadius: 12, border: "1px solid rgba(0,0,0,0.08)", background: "white", display: "flex", alignItems: "center", justifyContent: "center", overflow: "hidden" }}>
                  {logoUrl ? <img src={logoUrl} alt="Logo" style={{ width: "100%", height: "100%", objectFit: "contain" }} /> : <Globe size={20} color={t3} />}
                </div>
                <label style={{ cursor: "pointer", font: `500 0.78rem/1 ${fb}`, color: t2 }}>
                   {logoUploading ? "Subiendo..." : "Cambiar logo"}
                   <input type="file" style={{ display: "none" }} onChange={e => e.target.files?.[0] && uploadLogo(e.target.files[0])} />
                </label>
              </div>
            </div>

            {/* Accent color */}
            <div>
              <label style={{ display: "block", font: `500 0.72rem/1 ${fb}`, color: t3, marginBottom: 7 }}>Color de Acento</label>
              <div style={{ display: "flex", gap: 8 }}>
                {["#F97316","#4B6BFB","#16A34A","#8B5CF6","#EC4899","#EF4444"].map(c => (
                  <button 
                    key={c} 
                    onClick={() => setAccentColor(c)} 
                    style={{ width: 32, height: 32, borderRadius: 6, border: accentColor === c ? "2px solid #1A1D23" : "none", background: c, cursor: "pointer" }} 
                  />
                ))}
                <input type="color" value={accentColor} onChange={e => setAccentColor(e.target.value)} style={{ width: 32, height: 32, border: "none", background: "none", cursor: "pointer" }} />
              </div>
            </div>

            {/* Titulo */}
            <div>
              <label style={{ display: "block", font: `500 0.72rem/1 ${fb}`, color: t3, marginBottom: 7 }}>Título Principal</label>
              <input value={landingTitle} onChange={e => setLandingTitle(e.target.value)} style={{ width: "100%", padding: "10px", borderRadius: 8, border: "1px solid #E5E7EB", font: `400 0.875rem/1 ${fb}` }} />
            </div>

            {/* Descripcion */}
            <div>
              <label style={{ display: "block", font: `500 0.72rem/1 ${fb}`, color: t3, marginBottom: 7 }}>Descripción</label>
              <textarea value={landingDesc} onChange={e => setLandingDesc(e.target.value)} style={{ width: "100%", padding: "10px", borderRadius: 8, border: "1px solid #E5E7EB", font: `400 0.875rem/1.4 ${fb}`, height: 80, resize: "none" }} />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}