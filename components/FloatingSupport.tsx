"use client";

import { useState, useRef, useEffect } from "react";
import { useRouter } from "next/navigation";
import { MessageCircle, X, BookOpen, Headphones, Send, ArrowLeft } from "lucide-react";

const fd = "'Inter', sans-serif";

type ChatMessage = { role: "user" | "assistant"; content: string };

export default function FloatingSupport() {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [chatOpen, setChatOpen] = useState(false);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState("");
  const [sending, setSending] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false);
        setChatOpen(false);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  async function sendMessage() {
    const text = input.trim();
    if (!text || sending) return;
    const next: ChatMessage[] = [...messages, { role: "user", content: text }];
    setMessages(next);
    setInput("");
    setSending(true);
    try {
      const res = await fetch("/api/support-chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ messages: next }),
      });
      const data = await res.json();
      setMessages(prev => [...prev, { role: "assistant", content: data.reply ?? "Error al responder." }]);
    } catch {
      setMessages(prev => [...prev, { role: "assistant", content: "Hubo un error. Probá de nuevo." }]);
    } finally {
      setSending(false);
    }
  }

  function openChat() {
    setChatOpen(true);
    if (messages.length === 0) {
      setMessages([{ role: "assistant", content: "¡Hola! ¿En qué te puedo ayudar con FitGrowX?" }]);
    }
  }

  return (
    <div ref={ref} style={{ position: "fixed", bottom: 24, right: 24, zIndex: 9990, display: "flex", flexDirection: "column", alignItems: "flex-end", gap: 10 }}
      className="floating-support-wrap"
    >
      <style>{`
        @media (max-width: 767px) {
          .floating-support-wrap { bottom: 80px !important; right: 16px !important; }
        }
      `}</style>

      {/* Chat panel */}
      {open && chatOpen && (
        <div style={{
          background: "#fff", borderRadius: 18,
          boxShadow: "0 8px 40px rgba(0,0,0,0.16), 0 2px 8px rgba(0,0,0,0.08)",
          border: "1px solid rgba(0,0,0,0.07)",
          width: 320, height: 420,
          display: "flex", flexDirection: "column",
          overflow: "hidden",
          animation: "floatIn 0.18s cubic-bezier(0.34,1.56,0.64,1) both",
        }}>
          <style>{`
            @keyframes floatIn {
              from { opacity: 0; transform: translateY(8px) scale(0.96); }
              to   { opacity: 1; transform: translateY(0)  scale(1); }
            }
          `}</style>
          {/* Chat header */}
          <div style={{ background: "#111827", padding: "12px 14px", display: "flex", alignItems: "center", gap: 8 }}>
            <button
              onClick={() => setChatOpen(false)}
              style={{ background: "none", border: "none", cursor: "pointer", padding: 2, display: "flex", color: "rgba(255,255,255,0.6)" }}
            >
              <ArrowLeft size={15} />
            </button>
            <div style={{ width: 28, height: 28, borderRadius: 8, background: "rgba(249,115,22,0.2)", display: "flex", alignItems: "center", justifyContent: "center" }}>
              <Headphones size={14} color="#F97316" />
            </div>
            <div>
              <p style={{ margin: 0, font: `700 0.82rem/1 ${fd}`, color: "#fff" }}>Soporte FitGrowX</p>
              <p style={{ margin: "2px 0 0", font: `400 0.68rem/1 ${fd}`, color: "rgba(255,255,255,0.45)" }}>Respondemos al instante</p>
            </div>
          </div>

          {/* Messages */}
          <div style={{ flex: 1, overflowY: "auto", padding: "12px 12px 4px", display: "flex", flexDirection: "column", gap: 8 }}>
            {messages.map((m, i) => (
              <div key={i} style={{
                display: "flex",
                justifyContent: m.role === "user" ? "flex-end" : "flex-start",
              }}>
                <div style={{
                  maxWidth: "82%",
                  padding: "8px 12px",
                  borderRadius: m.role === "user" ? "14px 14px 4px 14px" : "14px 14px 14px 4px",
                  background: m.role === "user" ? "#111827" : "#F4F5F9",
                  color: m.role === "user" ? "#fff" : "#1A1D23",
                  font: `400 0.8rem/1.5 ${fd}`,
                }}>
                  {m.content}
                </div>
              </div>
            ))}
            {sending && (
              <div style={{ display: "flex", justifyContent: "flex-start" }}>
                <div style={{ padding: "8px 12px", borderRadius: "14px 14px 14px 4px", background: "#F4F5F9", font: `400 0.8rem/1.5 ${fd}`, color: "#9CA3AF" }}>
                  Escribiendo...
                </div>
              </div>
            )}
            <div ref={messagesEndRef} />
          </div>

          {/* Input */}
          <div style={{ padding: "8px 10px 10px", borderTop: "1px solid rgba(0,0,0,0.07)", display: "flex", gap: 6 }}>
            <input
              value={input}
              onChange={e => setInput(e.target.value)}
              onKeyDown={e => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); sendMessage(); } }}
              placeholder="Escribí tu consulta..."
              style={{
                flex: 1, border: "1.5px solid rgba(0,0,0,0.10)", borderRadius: 10,
                padding: "8px 10px", font: `400 0.8rem/1 ${fd}`, outline: "none",
                background: "#F8FAFC", color: "#1A1D23",
              }}
            />
            <button
              onClick={sendMessage}
              disabled={sending || !input.trim()}
              style={{
                width: 34, height: 34, borderRadius: 10, flexShrink: 0,
                background: input.trim() && !sending ? "#F97316" : "#E5E7EB",
                border: "none", cursor: input.trim() && !sending ? "pointer" : "not-allowed",
                display: "flex", alignItems: "center", justifyContent: "center",
              }}
            >
              <Send size={14} color={input.trim() && !sending ? "#fff" : "#9CA3AF"} />
            </button>
          </div>
        </div>
      )}

      {/* Menu */}
      {open && !chatOpen && (
        <div style={{
          background: "#FFFFFF", borderRadius: 16,
          boxShadow: "0 8px 40px rgba(0,0,0,0.16), 0 2px 8px rgba(0,0,0,0.08)",
          border: "1px solid rgba(0,0,0,0.07)",
          overflow: "hidden",
          animation: "floatIn 0.18s cubic-bezier(0.34,1.56,0.64,1) both",
          minWidth: 220,
        }}>
          <style>{`
            @keyframes floatIn {
              from { opacity: 0; transform: translateY(8px) scale(0.96); }
              to   { opacity: 1; transform: translateY(0)  scale(1); }
            }
          `}</style>

          <div style={{ padding: "12px 16px 8px", borderBottom: "1px solid rgba(0,0,0,0.06)" }}>
            <p style={{ font: `700 0.8rem/1 ${fd}`, color: "#1A1D23" }}>¿En qué te ayudamos?</p>
          </div>

          <div style={{ padding: 6 }}>
            <button
              onClick={openChat}
              style={{
                display: "flex", alignItems: "center", gap: 10, width: "100%",
                padding: "9px 10px", borderRadius: 10,
                background: "transparent", border: "none", textAlign: "left",
                color: "#1A1D23", font: `500 0.845rem/1 ${fd}`,
                cursor: "pointer", transition: "background 0.12s",
              }}
              onMouseEnter={e => (e.currentTarget.style.background = "#F4F5F9")}
              onMouseLeave={e => (e.currentTarget.style.background = "transparent")}
            >
              <div style={{ width: 32, height: 32, borderRadius: 9, background: "rgba(249,115,22,0.08)", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                <Headphones size={15} color="#F97316" />
              </div>
              <div>
                <p style={{ margin: 0, font: `600 0.845rem/1 ${fd}`, color: "#1A1D23" }}>Chat de Soporte</p>
                <p style={{ margin: "2px 0 0", font: `400 0.72rem/1 ${fd}`, color: "#9CA3AF" }}>Respondemos al instante</p>
              </div>
            </button>

            <button
              onClick={() => { router.push("/dashboard/boveda?categoria=tutoriales-fitgrowx"); setOpen(false); }}
              style={{
                display: "flex", alignItems: "center", gap: 10, width: "100%",
                padding: "9px 10px", borderRadius: 10,
                background: "transparent", border: "none", textAlign: "left",
                color: "#1A1D23", font: `500 0.845rem/1 ${fd}`,
                cursor: "pointer", transition: "background 0.12s",
              }}
              onMouseEnter={e => (e.currentTarget.style.background = "#F4F5F9")}
              onMouseLeave={e => (e.currentTarget.style.background = "transparent")}
            >
              <div style={{ width: 32, height: 32, borderRadius: 9, background: "rgba(99,102,241,0.08)", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                <BookOpen size={15} color="#6366f1" />
              </div>
              <div>
                <p style={{ margin: 0, font: `600 0.845rem/1 ${fd}`, color: "#1A1D23" }}>Tutoriales</p>
                <p style={{ margin: "2px 0 0", font: `400 0.72rem/1 ${fd}`, color: "#9CA3AF" }}>Guías en la bóveda</p>
              </div>
            </button>
          </div>
        </div>
      )}

      {/* FAB button */}
      <button
        onClick={() => { setOpen(o => !o); if (open) setChatOpen(false); }}
        style={{
          width: 52, height: 52, borderRadius: "50%",
          background: open ? "#1A1D23" : "#F97316",
          border: "none", cursor: "pointer",
          display: "flex", alignItems: "center", justifyContent: "center",
          boxShadow: open ? "0 4px 20px rgba(26,29,35,0.35)" : "0 4px 20px rgba(249,115,22,0.45)",
          transition: "all 0.2s cubic-bezier(0.34,1.56,0.64,1)",
          color: "white",
        }}
        title={open ? "Cerrar" : "Soporte"}
        onMouseEnter={e => { e.currentTarget.style.transform = "scale(1.08)"; }}
        onMouseLeave={e => { e.currentTarget.style.transform = "scale(1)"; }}
      >
        {open ? <X size={20} /> : <MessageCircle size={20} />}
      </button>
    </div>
  );
}
