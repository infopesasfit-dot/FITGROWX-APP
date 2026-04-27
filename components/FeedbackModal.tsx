"use client";

import { useState } from "react";
import { X, MessageSquare, Send, CheckCircle } from "lucide-react";

const fd = "var(--font-inter, 'Inter', sans-serif)";

interface Props {
  open: boolean;
  onClose: () => void;
  gymId: string | null;
  gymDisplayName?: string | null;
}

export default function FeedbackModal({ open, onClose, gymDisplayName }: Props) {
  const [message, setMessage] = useState("");
  const [sending, setSending] = useState(false);
  const [sent, setSent] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!open) return null;

  async function handleSubmit() {
    if (!message.trim()) return;
    setSending(true);
    setError(null);
    try {
      const res = await fetch("/api/feedback", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message, gym_name: gymDisplayName ?? null }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Error");
      setSent(true);
      setMessage("");
      setTimeout(() => {
        setSent(false);
        onClose();
      }, 2200);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Error al enviar");
    } finally {
      setSending(false);
    }
  }

  return (
    <>
      {/* Backdrop */}
      <div
        onClick={onClose}
        style={{
          position: "fixed", inset: 0, zIndex: 9998,
          background: "rgba(0,0,0,0.45)",
          backdropFilter: "blur(4px)",
        }}
      />

      {/* Modal */}
      <div style={{
        position: "fixed", inset: 0, zIndex: 9999,
        display: "flex", alignItems: "center", justifyContent: "center",
        padding: 20,
      }}>
        <div style={{
          background: "#fff",
          borderRadius: 24,
          boxShadow: "0 32px 80px rgba(0,0,0,0.22), 0 4px 16px rgba(0,0,0,0.08)",
          width: "100%",
          maxWidth: 460,
          overflow: "hidden",
          animation: "modalIn 0.2s cubic-bezier(0.34,1.56,0.64,1) both",
        }}>
          <style>{`
            @keyframes modalIn {
              from { opacity: 0; transform: translateY(12px) scale(0.97); }
              to   { opacity: 1; transform: translateY(0)   scale(1); }
            }
          `}</style>

          {/* Header */}
          <div style={{
            background: "linear-gradient(135deg, #0a1628 0%, #1e3fa0 100%)",
            padding: "20px 22px 18px",
            display: "flex", alignItems: "center", justifyContent: "space-between",
          }}>
            <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
              <div style={{
                width: 34, height: 34, borderRadius: 10,
                background: "rgba(110,168,254,0.18)", border: "1px solid rgba(110,168,254,0.3)",
                display: "flex", alignItems: "center", justifyContent: "center",
              }}>
                <MessageSquare size={16} color="#6ea8fe" />
              </div>
              <div>
                <p style={{ margin: 0, font: `700 0.92rem/1 ${fd}`, color: "#fff" }}>Mandanos tu feedback</p>
                <p style={{ margin: "3px 0 0", font: `400 0.72rem/1 ${fd}`, color: "rgba(255,255,255,0.55)" }}>
                  Lo leemos y lo usamos para mejorar
                </p>
              </div>
            </div>
            <button
              onClick={onClose}
              style={{
                width: 32, height: 32, borderRadius: 8,
                background: "rgba(255,255,255,0.10)", border: "none",
                cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center",
              }}
            >
              <X size={16} color="rgba(255,255,255,0.7)" />
            </button>
          </div>

          {/* Body */}
          <div style={{ padding: "22px 22px 20px" }}>
            {sent ? (
              <div style={{
                display: "flex", flexDirection: "column", alignItems: "center",
                gap: 10, padding: "28px 0",
              }}>
                <CheckCircle size={40} color="#22c55e" />
                <p style={{ margin: 0, font: `700 1rem/1 ${fd}`, color: "#111827" }}>¡Gracias! Ya lo recibimos.</p>
                <p style={{ margin: 0, font: `400 0.82rem/1.5 ${fd}`, color: "#6B7280", textAlign: "center" }}>
                  Tu opinión nos ayuda a seguir mejorando FitGrowX.
                </p>
              </div>
            ) : (
              <>
                <textarea
                  value={message}
                  onChange={e => setMessage(e.target.value)}
                  placeholder="¿Qué mejorarías? ¿Algo que te faltó? ¿Qué está funcionando bien?"
                  rows={5}
                  style={{
                    width: "100%", boxSizing: "border-box",
                    border: "1.5px solid rgba(0,0,0,0.10)",
                    borderRadius: 14, padding: "12px 14px",
                    font: `400 0.875rem/1.6 ${fd}`, color: "#1A1D23",
                    resize: "vertical", outline: "none",
                    background: "#F8FAFC",
                    transition: "border-color 0.15s",
                  }}
                  onFocus={e => (e.currentTarget.style.borderColor = "#1e3fa0")}
                  onBlur={e => (e.currentTarget.style.borderColor = "rgba(0,0,0,0.10)")}
                />
                {error && (
                  <p style={{ margin: "6px 0 0", font: `400 0.78rem/1 ${fd}`, color: "#DC2626" }}>{error}</p>
                )}
                <button
                  onClick={handleSubmit}
                  disabled={sending || !message.trim()}
                  style={{
                    marginTop: 14, width: "100%",
                    padding: "12px 16px", borderRadius: 12,
                    background: message.trim() && !sending ? "#1e3fa0" : "rgba(0,0,0,0.08)",
                    color: message.trim() && !sending ? "#fff" : "#9CA3AF",
                    border: "none", cursor: message.trim() && !sending ? "pointer" : "not-allowed",
                    font: `700 0.875rem/1 ${fd}`,
                    display: "flex", alignItems: "center", justifyContent: "center", gap: 8,
                    transition: "all 0.15s",
                  }}
                >
                  <Send size={14} />
                  {sending ? "Enviando..." : "Enviar feedback"}
                </button>
              </>
            )}
          </div>
        </div>
      </div>
    </>
  );
}
