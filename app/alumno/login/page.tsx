"use client";

import { Suspense, useState, useEffect } from "react";
import { useSearchParams } from "next/navigation";

const fd = "'Inter', sans-serif";

function LoginContent() {
  const searchParams = useSearchParams();
  const redirect     = searchParams.get("redirect");

  const [dni,     setDni]     = useState("");
  const [loading, setLoading] = useState(false);
  const [sent,    setSent]    = useState(false);
  const [error,   setError]   = useState<string | null>(null);

  // Guardar redirect en localStorage para recuperarlo después del link de WA
  useEffect(() => {
    if (redirect) localStorage.setItem("fitgrowx_post_login_redirect", redirect);
  }, [redirect]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);
    const res  = await fetch("/api/alumno/request-access", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ dni: dni.replace(/\D/g, "") }),
    });
    const data = await res.json();
    setLoading(false);
    if (!res.ok) { setError(data.error ?? "Error desconocido."); return; }
    setSent(true);
  };

  return (
    <div style={{ minHeight: "100svh", background: "#020202", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", padding: "28px 20px", fontFamily: fd, position: "relative", overflow: "hidden" }}>

      <style>{`
        @keyframes fadeUp  { from { opacity: 0; transform: translateY(16px); } to { opacity: 1; transform: translateY(0); } }
        @keyframes spin    { to { transform: rotate(360deg); } }
        .input-line::placeholder { color: rgba(255,255,255,0.18); }
      `}</style>

      {/* Grid */}
      <div style={{
        position: "fixed", inset: 0, pointerEvents: "none", zIndex: 0,
        backgroundImage: `linear-gradient(rgba(255,255,255,0.022) 1px,transparent 1px),linear-gradient(90deg,rgba(255,255,255,0.022) 1px,transparent 1px)`,
        backgroundSize: "44px 44px",
      }} />

      {/* Ambient glow top-left */}
      <div style={{ position: "fixed", top: -300, left: -300, width: 800, height: 800, background: "radial-gradient(circle, rgba(255,106,0,0.09) 0%, transparent 60%)", filter: "blur(70px)", pointerEvents: "none", zIndex: 0 }} />
      {/* Ambient glow bottom-right */}
      <div style={{ position: "fixed", bottom: -300, right: -300, width: 700, height: 700, background: "radial-gradient(circle, rgba(27,58,107,0.15) 0%, transparent 60%)", filter: "blur(70px)", pointerEvents: "none", zIndex: 0 }} />

      {/* ── Content ── */}
      <div style={{ position: "relative", zIndex: 1, width: "100%", maxWidth: 380, animation: "fadeUp 0.4s cubic-bezier(0.16,1,0.3,1)" }}>

        {/* Logo block */}
        <div style={{ marginBottom: 52 }}>
          <p style={{ font: `300 0.56rem/1 ${fd}`, color: "rgba(255,255,255,0.25)", letterSpacing: "0.32em", textTransform: "uppercase", marginBottom: 12 }}>
            Área exclusiva
          </p>
          <h1 style={{ font: `900 3rem/1 ${fd}`, color: "#FFFFFF", letterSpacing: "-0.055em", lineHeight: 1 }}>
            FitGrow<span style={{ color: "#1B3A6B" }}>X</span>
          </h1>
        </div>

        {/* Glass card */}
        <div style={{
          background: "rgba(255,255,255,0.02)",
          backdropFilter: "blur(24px)",
          WebkitBackdropFilter: "blur(24px)",
          border: "1px solid rgba(255,255,255,0.05)",
          borderRadius: 24,
          padding: "32px 28px",
          boxShadow: "0 32px 80px rgba(0,0,0,0.6), inset 0 1px 0 rgba(255,255,255,0.04)",
        }}>

          {sent ? (
            /* ── Success state ── */
            <div style={{ textAlign: "center", animation: "fadeUp 0.3s cubic-bezier(0.16,1,0.3,1)" }}>
              {/* Checkmark */}
              <div style={{ width: 56, height: 56, borderRadius: 18, background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.07)", display: "flex", alignItems: "center", justifyContent: "center", margin: "0 auto 24px" }}>
                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#FFFFFF" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <polyline points="20 6 9 17 4 12" />
                </svg>
              </div>
              <h2 style={{ font: `800 1.4rem/1.2 ${fd}`, color: "#FFFFFF", marginBottom: 10, letterSpacing: "-0.025em" }}>
                Enlace enviado<span style={{ color: "#FF6A00" }}>.</span>
              </h2>
              <p style={{ font: `300 0.8rem/1.7 ${fd}`, color: "rgba(255,255,255,0.4)", marginBottom: 28 }}>
                Te enviamos el acceso por WhatsApp.<br />
                Válido por <span style={{ color: "rgba(255,255,255,0.7)", fontWeight: 500 }}>30 días</span>.
              </p>
              {/* Divider */}
              <div style={{ height: 1, background: "rgba(255,255,255,0.05)", marginBottom: 24 }} />
              <button
                onClick={() => { setSent(false); setDni(""); }}
                style={{ background: "none", border: "none", font: `400 0.72rem/1 ${fd}`, color: "rgba(255,255,255,0.3)", cursor: "pointer", letterSpacing: "0.08em", textTransform: "uppercase" }}
              >
                Enviar otro enlace
              </button>
            </div>

          ) : (
            /* ── Form state ── */
            <>
              <p style={{ font: `300 0.6rem/1 ${fd}`, color: "rgba(255,255,255,0.28)", letterSpacing: "0.22em", textTransform: "uppercase", marginBottom: 10 }}>
                Bienvenido/a
              </p>
              <h2 style={{ font: `800 1.5rem/1.1 ${fd}`, color: "#FFFFFF", letterSpacing: "-0.03em", marginBottom: 28, fontStyle: "italic" }}>
                Ingresá a tu panel<span style={{ color: "#FF6A00" }}>.</span>
              </h2>

              <form onSubmit={handleSubmit} style={{ display: "flex", flexDirection: "column", gap: 24 }}>

                {/* Email underline input */}
                <div>
                  <label style={{ display: "block", font: `400 0.6rem/1 ${fd}`, color: "rgba(255,255,255,0.3)", letterSpacing: "0.2em", textTransform: "uppercase", marginBottom: 12 }}>
                    DNI
                  </label>
                  <div style={{ position: "relative" }}>
                    <input
                      className="input-line"
                      type="text"
                      inputMode="numeric"
                      required
                      value={dni}
                      onChange={e => setDni(e.target.value.replace(/\D/g, ""))}
                      placeholder="Sin puntos ni espacios"
                      style={{
                        width: "100%", padding: "6px 0 10px",
                        background: "transparent", border: "none",
                        borderBottom: "1px solid rgba(255,255,255,0.15)",
                        font: `400 1rem/1 ${fd}`, color: "#FFFFFF",
                        outline: "none", boxSizing: "border-box",
                        transition: "border-color 0.2s",
                        letterSpacing: "0.08em",
                      }}
                      onFocus={e => (e.currentTarget.style.borderBottomColor = "rgba(255,255,255,0.6)")}
                      onBlur={e => (e.currentTarget.style.borderBottomColor = "rgba(255,255,255,0.15)")}
                    />
                  </div>
                </div>

                {/* Error */}
                {error && (
                  <div style={{ background: "rgba(220,38,38,0.06)", border: "1px solid rgba(220,38,38,0.18)", borderRadius: 12, padding: "10px 14px", font: `400 0.75rem/1.5 ${fd}`, color: "#F87171", letterSpacing: "0.02em" }}>
                    {error}
                  </div>
                )}

                {/* CTA button */}
                <button
                  type="submit"
                  disabled={loading}
                  style={{
                    width: "100%", padding: "15px",
                    background: loading ? "rgba(255,255,255,0.03)" : "rgba(255,255,255,0.05)",
                    border: `1px solid ${loading ? "rgba(255,255,255,0.05)" : "rgba(255,255,255,0.1)"}`,
                    borderRadius: 14,
                    font: `700 0.75rem/1 ${fd}`, color: loading ? "rgba(255,255,255,0.25)" : "#FFFFFF",
                    cursor: loading ? "not-allowed" : "pointer",
                    letterSpacing: "0.12em", textTransform: "uppercase",
                    transition: "background 0.2s, border-color 0.2s",
                    display: "flex", alignItems: "center", justifyContent: "center", gap: 10,
                    boxShadow: loading ? "none" : "inset 0 1px 0 rgba(255,255,255,0.06)",
                  }}
                  onMouseEnter={e => { if (!loading) { (e.currentTarget as HTMLButtonElement).style.background = "rgba(255,255,255,0.08)"; (e.currentTarget as HTMLButtonElement).style.borderColor = "rgba(255,255,255,0.16)"; } }}
                  onMouseLeave={e => { (e.currentTarget as HTMLButtonElement).style.background = "rgba(255,255,255,0.05)"; (e.currentTarget as HTMLButtonElement).style.borderColor = "rgba(255,255,255,0.1)"; }}
                >
                  {loading ? (
                    <>
                      <div style={{ width: 14, height: 14, borderRadius: "50%", border: "1.5px solid rgba(255,255,255,0.15)", borderTopColor: "rgba(255,255,255,0.5)", animation: "spin 0.7s linear infinite" }} />
                      Enviando
                    </>
                  ) : (
                    <>
                      <div style={{ width: 6, height: 6, borderRadius: "50%", background: "#FF6A00" }} />
                      Recibir acceso por WhatsApp
                    </>
                  )}
                </button>
              </form>
            </>
          )}
        </div>

        {/* Footer */}
        <p style={{ textAlign: "center", font: `300 0.68rem/1.6 ${fd}`, color: "rgba(255,255,255,0.15)", marginTop: 24, letterSpacing: "0.04em" }}>
          ¿Problemas? Contactá al gym directamente.
        </p>
      </div>
    </div>
  );
}
