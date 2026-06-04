"use client";

import { useState, useEffect, useCallback } from "react";
import { useParams } from "next/navigation";
import { TurnstileWidget } from "@/components/turnstile-widget";

const fd = "'Inter', system-ui, sans-serif";

type PassState =
  | { phase: "loading" }
  | { phase: "claim"; gymName: string; alumnoName: string; accentColor: string; expiresAt: string; gymWhatsapp: string | null }
  | { phase: "success"; code: string; gymName: string; expiresAt: string; accentColor: string; gymWhatsapp: string | null }
  | { phase: "error"; message: string; gymWhatsapp?: string | null };

export default function GuestPassPage() {
  const { token } = useParams<{ token: string }>();
  const [state,          setState]          = useState<PassState>({ phase: "loading" });
  const [name,           setName]           = useState("");
  const [phone,          setPhone]          = useState("");
  const [submitting,     setSubmitting]     = useState(false);
  const [turnstileToken, setTurnstileToken] = useState<string | null>(null);

  const handleTurnstileChange = useCallback((t: string | null) => setTurnstileToken(t), []);

  useEffect(() => {
    fetch(`/api/guest-pass/${token}`)
      .then(r => r.json())
      .then(d => {
        history.replaceState(null, "", "/pase");
        if (d.error) { setState({ phase: "error", message: d.error }); return; }
        if (d.status === "claimed") {
          setState({ phase: "success", code: d.code, gymName: d.gymName, expiresAt: d.expiresAt, accentColor: d.accentColor ?? "#F97316", gymWhatsapp: d.gymWhatsapp ?? null });
          return;
        }
        setState({
          phase:        "claim",
          gymName:      d.gymName,
          alumnoName:   d.alumnoName,
          accentColor:  d.accentColor ?? "#F97316",
          expiresAt:    d.expiresAt,
          gymWhatsapp:  d.gymWhatsapp ?? null,
        });
      })
      .catch(() => setState({ phase: "error", message: "No se pudo cargar el pase" }));
  }, [token]);

  const handleClaim = async () => {
    if (!name.trim() || phone.replace(/\D/g, "").length < 8) return;
    setSubmitting(true);
    const r = await fetch(`/api/guest-pass/${token}/claim`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: name.trim(), phone: phone.trim(), turnstileToken }),
    });
    const d = await r.json();
    setSubmitting(false);
    if (!r.ok) { setState({ phase: "error", message: d.error ?? "Error al reclamar el pase" }); return; }
    setState({
      phase:        "success",
      code:         d.code,
      gymName:      d.gymName,
      expiresAt:    d.expiresAt,
      accentColor:  (state as { accentColor?: string }).accentColor ?? "#F97316",
      gymWhatsapp:  (state as { gymWhatsapp?: string | null }).gymWhatsapp ?? null,
    });
  };

  const accent = state.phase === "loading" || state.phase === "error"
    ? "#F97316"
    : (state as { accentColor: string }).accentColor;

  const expLabel = (iso: string) =>
    new Date(iso).toLocaleDateString("es-AR", { day: "numeric", month: "long" });

  return (
    <div style={{ minHeight: "100svh", background: "#080810", fontFamily: fd, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", padding: "24px 20px", position: "relative", overflow: "hidden" }}>

      {/* Ambient glow */}
      <div style={{ position: "fixed", top: -200, left: "50%", transform: "translateX(-50%)", width: 600, height: 600, borderRadius: "50%", background: `radial-gradient(circle, ${accent}22 0%, transparent 70%)`, pointerEvents: "none" }} />

      <div style={{ width: "100%", maxWidth: 400, position: "relative", zIndex: 1 }}>

        {state.phase === "loading" && (
          <div style={{ textAlign: "center" }}>
            <div style={{ width: 32, height: 32, borderRadius: "50%", border: `3px solid rgba(255,255,255,0.1)`, borderTopColor: accent, animation: "spin 0.7s linear infinite", margin: "0 auto" }} />
          </div>
        )}

        {state.phase === "error" && (
          <div style={{ textAlign: "center", display: "flex", flexDirection: "column", alignItems: "center", gap: 16 }}>
            <p style={{ fontSize: 48, marginBottom: 0 }}>😕</p>
            <div>
              <p style={{ font: `700 1.2rem/1.3 ${fd}`, color: "#FFFFFF", marginBottom: 8 }}>Pase no disponible</p>
              <p style={{ font: `400 0.85rem/1.5 ${fd}`, color: "rgba(255,255,255,0.4)" }}>{state.message}</p>
            </div>
            {state.gymWhatsapp && (
              <a
                href={`https://wa.me/${state.gymWhatsapp.replace(/\D/g, "")}`}
                target="_blank" rel="noopener noreferrer"
                style={{ display: "inline-flex", alignItems: "center", gap: 8, padding: "10px 18px", borderRadius: 12, background: "rgba(37,211,102,0.12)", border: "1px solid rgba(37,211,102,0.25)", font: `600 0.82rem/1 ${fd}`, color: "#25D366", textDecoration: "none" }}
              >
                <span style={{ fontSize: 15 }}>💬</span> Contactar al gym
              </a>
            )}
          </div>
        )}

        {state.phase === "claim" && (
          <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
            {/* Header */}
            <div style={{ textAlign: "center" }}>
              <div style={{ fontSize: 56, marginBottom: 12, lineHeight: 1 }}>🎟️</div>
              <p style={{ font: `400 0.7rem/1 ${fd}`, color: "rgba(255,255,255,0.35)", letterSpacing: "0.2em", textTransform: "uppercase", marginBottom: 8 }}>
                {state.gymName}
              </p>
              <p style={{ font: `800 1.6rem/1.15 ${fd}`, color: "#FFFFFF", letterSpacing: "-0.03em", marginBottom: 6 }}>
                Pase Libre
              </p>
              <p style={{ font: `400 0.85rem/1.5 ${fd}`, color: "rgba(255,255,255,0.4)" }}>
                <strong style={{ color: "rgba(255,255,255,0.7)" }}>{state.alumnoName}</strong> te invita a entrenar gratis.<br />
                Ingresá tus datos para reclamar el pase.
              </p>
              <p style={{ font: `500 0.72rem/1 ${fd}`, color: "rgba(255,255,255,0.25)", marginTop: 10 }}>
                Válido hasta el {expLabel(state.expiresAt)}
              </p>
            </div>

            {/* Form */}
            <div style={{ background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.08)", borderRadius: 20, padding: "20px 18px", display: "flex", flexDirection: "column", gap: 12 }}>
              <input
                type="text"
                placeholder="Tu nombre completo"
                value={name}
                onChange={e => setName(e.target.value)}
                style={{ background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.1)", borderRadius: 12, padding: "13px 16px", font: `400 0.9rem/1 ${fd}`, color: "#FFFFFF", outline: "none", width: "100%", boxSizing: "border-box" }}
              />
              <input
                type="tel"
                placeholder="Tu número de WhatsApp"
                value={phone}
                onChange={e => setPhone(e.target.value)}
                style={{ background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.1)", borderRadius: 12, padding: "13px 16px", font: `400 0.9rem/1 ${fd}`, color: "#FFFFFF", outline: "none", width: "100%", boxSizing: "border-box" }}
              />
              <p style={{ font: `400 0.65rem/1.4 ${fd}`, color: "rgba(255,255,255,0.2)", textAlign: "center", margin: 0 }}>
                El código aparece en pantalla al confirmar. También intentamos enviártelo por WhatsApp.
              </p>
              <TurnstileWidget onTokenChange={handleTurnstileChange} theme="dark" />
            </div>

            <button
              onClick={handleClaim}
              disabled={submitting || !name.trim() || phone.replace(/\D/g, "").length < 8 || !turnstileToken}
              style={{ width: "100%", padding: "15px 0", background: submitting ? "rgba(249,115,22,0.5)" : `linear-gradient(135deg, ${accent} 0%, #EA580C 100%)`, border: "none", borderRadius: 16, font: `700 0.95rem/1 ${fd}`, color: "#FFFFFF", cursor: submitting ? "not-allowed" : "pointer", opacity: (!name.trim() || phone.replace(/\D/g, "").length < 8) ? 0.5 : 1 }}
            >
              {submitting ? "Reclamando..." : "Reclamar mi pase 🎟️"}
            </button>

            {/* Subtle branding */}
            <p style={{ textAlign: "center", font: `400 0.6rem/1 ${fd}`, color: "rgba(255,255,255,0.12)", letterSpacing: "0.08em" }}>
              POWERED BY FITGROWX
            </p>
          </div>
        )}

        {state.phase === "success" && (
          <div style={{ display: "flex", flexDirection: "column", gap: 20, alignItems: "center", textAlign: "center" }}>
            <div style={{ fontSize: 56, lineHeight: 1 }}>✅</div>
            <div>
              <p style={{ font: `800 1.5rem/1.2 ${fd}`, color: "#FFFFFF", letterSpacing: "-0.03em", marginBottom: 6 }}>¡Pase listo!</p>
              <p style={{ font: `400 0.85rem/1.5 ${fd}`, color: "rgba(255,255,255,0.4)" }}>
                Mostrá este código al staff cuando llegues a {state.gymName}.
              </p>
            </div>

            {/* Big code */}
            <div style={{ background: "rgba(255,255,255,0.04)", border: `1px solid ${state.accentColor}44`, borderRadius: 24, padding: "28px 40px", width: "100%" }}>
              <p style={{ font: `400 0.55rem/1 ${fd}`, color: "rgba(255,255,255,0.3)", letterSpacing: "0.2em", textTransform: "uppercase", marginBottom: 10 }}>
                Código de pase
              </p>
              <p style={{ font: `900 3rem/1 ${fd}`, color: state.accentColor, letterSpacing: "0.18em", fontVariantNumeric: "tabular-nums", margin: 0 }}>
                {state.code}
              </p>
              <p style={{ font: `400 0.65rem/1 ${fd}`, color: "rgba(255,255,255,0.2)", marginTop: 12 }}>
                Válido hasta el {expLabel(state.expiresAt)}
              </p>
            </div>

            <p style={{ font: `400 0.75rem/1.5 ${fd}`, color: "rgba(255,255,255,0.4)", textAlign: "center" }}>
              Guardá este código o tomá captura de pantalla.<br/>
              <span style={{ color: "rgba(255,255,255,0.25)", fontSize: "0.7rem" }}>También intentamos enviártelo por WhatsApp.</span>
            </p>

            {state.gymWhatsapp && (
              <a
                href={`https://wa.me/${state.gymWhatsapp.replace(/\D/g, "")}?text=${encodeURIComponent(`Hola! Tengo el pase libre con código ${state.code}`)}`}
                target="_blank" rel="noopener noreferrer"
                style={{ display: "inline-flex", alignItems: "center", gap: 8, padding: "10px 18px", borderRadius: 12, background: "rgba(37,211,102,0.10)", border: "1px solid rgba(37,211,102,0.22)", font: `600 0.82rem/1 ${fd}`, color: "#25D366", textDecoration: "none" }}
              >
                <span style={{ fontSize: 15 }}>💬</span> Avisar al gym que voy
              </a>
            )}

            <p style={{ font: `400 0.6rem/1 ${fd}`, color: "rgba(255,255,255,0.12)", letterSpacing: "0.08em" }}>
              POWERED BY FITGROWX
            </p>
          </div>
        )}
      </div>

      <style>{`
        @keyframes spin { to { transform: rotate(360deg); } }
        input::placeholder { color: rgba(255,255,255,0.3); }
      `}</style>
    </div>
  );
}
