"use client";

import { useState, useRef, useEffect } from "react";

const fd = "var(--font-inter,'Inter',sans-serif)";

interface Props {
  title?: string;
  description?: string;
  onConfirmed: () => void;
  onCancel: () => void;
}

export default function SensitiveConfirm({
  title = "Confirmación requerida",
  description = "Esta acción es sensible. Te mandamos un código por WhatsApp para verificar tu identidad.",
  onConfirmed,
  onCancel,
}: Props) {
  const [step,     setStep]     = useState<"idle" | "sent" | "verifying">("idle");
  const [sending,  setSending]  = useState(false);
  const [digits,   setDigits]   = useState(["", "", "", ""]);
  const [masked,   setMasked]   = useState("");
  const [error,    setError]    = useState<string | null>(null);
  const inputRefs  = useRef<(HTMLInputElement | null)[]>([]);

  useEffect(() => {
    if (step === "sent") inputRefs.current[0]?.focus();
  }, [step]);

  const sendCode = async () => {
    setSending(true); setError(null);
    const res = await fetch("/api/auth/sensitive-otp", { method: "POST" });
    const data = await res.json();
    setSending(false);
    if (!res.ok) { setError(data.error); return; }
    setMasked(data.masked);
    setStep("sent");
  };

  const handleDigit = (i: number, val: string) => {
    const clean = val.replace(/\D/g, "").slice(-1);
    const next = [...digits];
    next[i] = clean;
    setDigits(next);
    if (clean && i < 3) inputRefs.current[i + 1]?.focus();
  };

  const handleKeyDown = (i: number, e: React.KeyboardEvent) => {
    if (e.key === "Backspace" && !digits[i] && i > 0) {
      inputRefs.current[i - 1]?.focus();
    }
  };

  const verify = async () => {
    const code = digits.join("");
    if (code.length < 4) { setError("Ingresá los 4 dígitos."); return; }
    setStep("verifying"); setError(null);
    const res = await fetch("/api/auth/sensitive-otp/verify", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ code }),
    });
    const data = await res.json();
    if (!res.ok) { setStep("sent"); setError(data.error); setDigits(["", "", "", ""]); inputRefs.current[0]?.focus(); return; }
    onConfirmed();
  };

  return (
    <div style={{ position: "fixed", inset: 0, zIndex: 9999, background: "rgba(0,0,0,0.58)", backdropFilter: "blur(12px)", WebkitBackdropFilter: "blur(12px)", display: "flex", alignItems: "center", justifyContent: "center", padding: 20 }}>
      <div style={{ background: "#fff", borderRadius: 22, padding: "28px 24px", maxWidth: 380, width: "100%", boxShadow: "0 32px 80px rgba(0,0,0,0.24)", animation: "scIn 0.22s cubic-bezier(0.16,1,0.3,1) both" }}>
        <style>{`@keyframes scIn { from { opacity:0; transform:scale(0.93) translateY(8px); } to { opacity:1; transform:scale(1) translateY(0); } }`}</style>

        {/* Icon */}
        <div style={{ width: 48, height: 48, borderRadius: 14, background: "rgba(220,38,38,0.08)", border: "1px solid rgba(220,38,38,0.18)", display: "flex", alignItems: "center", justifyContent: "center", margin: "0 0 16px" }}>
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#DC2626" strokeWidth="2" strokeLinecap="round"><rect x="3" y="11" width="18" height="11" rx="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/></svg>
        </div>

        <p style={{ font: `700 1rem/1.2 ${fd}`, color: "#0F172A", marginBottom: 6 }}>{title}</p>
        <p style={{ font: `400 0.82rem/1.5 ${fd}`, color: "#64748B", marginBottom: 20 }}>{description}</p>

        {error && (
          <div style={{ background: "rgba(220,38,38,0.07)", border: "1px solid rgba(220,38,38,0.18)", borderRadius: 9, padding: "9px 13px", font: `400 0.78rem/1.4 ${fd}`, color: "#DC2626", marginBottom: 16 }}>
            {error}
          </div>
        )}

        {step === "idle" && (
          <button
            onClick={sendCode}
            disabled={sending}
            style={{ width: "100%", padding: "12px", borderRadius: 12, border: "none", background: sending ? "#E5E7EB" : "#1A1D23", color: sending ? "#9CA3AF" : "white", font: `700 0.875rem/1 ${fd}`, cursor: sending ? "not-allowed" : "pointer" }}
          >
            {sending ? "Enviando…" : "Enviar código por WhatsApp"}
          </button>
        )}

        {(step === "sent" || step === "verifying") && (
          <>
            <p style={{ font: `400 0.75rem/1 ${fd}`, color: "#94A3B8", marginBottom: 14 }}>
              Código enviado a <strong style={{ color: "#475569" }}>{masked}</strong>
            </p>
            <div style={{ display: "flex", gap: 10, justifyContent: "center", marginBottom: 16 }}>
              {digits.map((d, i) => (
                <input
                  key={i}
                  ref={el => { inputRefs.current[i] = el; }}
                  value={d}
                  onChange={e => handleDigit(i, e.target.value)}
                  onKeyDown={e => handleKeyDown(i, e)}
                  maxLength={1}
                  inputMode="numeric"
                  style={{ width: 52, height: 56, textAlign: "center", font: `800 1.5rem/1 ${fd}`, color: "#0F172A", background: "#F8FAFC", border: `2px solid ${d ? "#1A1D23" : "rgba(0,0,0,0.10)"}`, borderRadius: 12, outline: "none", transition: "border-color 0.14s" }}
                />
              ))}
            </div>
            <button
              onClick={verify}
              disabled={step === "verifying" || digits.join("").length < 4}
              style={{ width: "100%", padding: "12px", borderRadius: 12, border: "none", background: (step === "verifying" || digits.join("").length < 4) ? "#E5E7EB" : "#16A34A", color: (step === "verifying" || digits.join("").length < 4) ? "#9CA3AF" : "white", font: `700 0.875rem/1 ${fd}`, cursor: (step === "verifying" || digits.join("").length < 4) ? "not-allowed" : "pointer", marginBottom: 8 }}
            >
              {step === "verifying" ? "Verificando…" : "Confirmar"}
            </button>
            <button
              onClick={sendCode}
              disabled={sending}
              style={{ width: "100%", padding: "9px", borderRadius: 10, border: "none", background: "none", color: "#94A3B8", font: `500 0.78rem/1 ${fd}`, cursor: "pointer" }}
            >
              Reenviar código
            </button>
          </>
        )}

        <button
          onClick={onCancel}
          style={{ width: "100%", padding: "10px", borderRadius: 10, border: "1px solid rgba(0,0,0,0.08)", background: "none", color: "#94A3B8", font: `500 0.82rem/1 ${fd}`, cursor: "pointer", marginTop: 8 }}
        >
          Cancelar
        </button>
      </div>
    </div>
  );
}
