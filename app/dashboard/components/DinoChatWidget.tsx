"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { X, Send, Loader2 } from "lucide-react";
import { DinoSVG } from "@/app/dashboard/components/DinoSVG";

const fd = "var(--font-inter, 'Inter', sans-serif)";

const QUICK_CHIPS = [
  "¿Cómo agrego un alumno?",
  "¿Cómo conecto WhatsApp?",
  "¿Dónde configuro los pagos?",
];

interface Msg { role: "user" | "assistant"; content: string }

const IDLE_MS = 90_000; // 90s

interface Props {
  collapsed: boolean;
  isMobile: boolean;
  sidebarWidth: number;
}

export function DinoChatWidget({ collapsed, isMobile, sidebarWidth }: Props) {
  const [open,         setOpen]         = useState(false);
  const [messages,     setMessages]     = useState<Msg[]>([]);
  const [input,        setInput]        = useState("");
  const [loading,      setLoading]      = useState(false);
  const [idleBubble,   setIdleBubble]   = useState(false);
  const [idleDismissed,setIdleDismissed]= useState(false);

  const bottomRef  = useRef<HTMLDivElement>(null);
  const idleTimer  = useRef<ReturnType<typeof setTimeout> | null>(null);
  const inputRef   = useRef<HTMLTextAreaElement>(null);

  // ── Idle detection ────────────────────────────────────────────────
  const resetIdle = useCallback(() => {
    if (idleTimer.current) clearTimeout(idleTimer.current);
    idleTimer.current = setTimeout(() => {
      if (!open && !idleDismissed) setIdleBubble(true);
    }, IDLE_MS);
  }, [open, idleDismissed]);

  useEffect(() => {
    const events = ["mousemove", "keydown", "click", "scroll", "touchstart"];
    events.forEach(e => window.addEventListener(e, resetIdle, { passive: true }));
    resetIdle();
    return () => {
      events.forEach(e => window.removeEventListener(e, resetIdle));
      if (idleTimer.current) clearTimeout(idleTimer.current);
    };
  }, [resetIdle]);

  // Hide idle bubble when chat opens
  useEffect(() => {
    if (open) setIdleBubble(false);
  }, [open]);

  // Auto-scroll on new messages
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, loading]);

  // Focus input when opened
  useEffect(() => {
    if (open) setTimeout(() => inputRef.current?.focus(), 120);
  }, [open]);

  const sendMessage = async (text: string) => {
    const trimmed = text.trim();
    if (!trimmed || loading) return;
    const newMessages: Msg[] = [...messages, { role: "user", content: trimmed }];
    setMessages(newMessages);
    setInput("");
    setLoading(true);
    try {
      const res = await fetch("/api/support-chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ messages: newMessages }),
      });
      const data = await res.json();
      setMessages(prev => [...prev, { role: "assistant", content: data.reply ?? "No pude responder, intentá de nuevo." }]);
    } catch {
      setMessages(prev => [...prev, { role: "assistant", content: "Error de conexión. Intentá de nuevo." }]);
    } finally {
      setLoading(false);
    }
  };

  const handleChip = (chip: string) => {
    setOpen(true);
    sendMessage(chip);
  };

  const handleIdleOpen = () => {
    setIdleBubble(false);
    setIdleDismissed(true);
    setOpen(true);
  };

  // ── Panel position ────────────────────────────────────────────────
  const panelLeft = isMobile ? 16 : sidebarWidth + 20;

  // ── Sidebar trigger button ────────────────────────────────────────
  const triggerBtn = (
    <button
      onClick={() => { setOpen(o => !o); setIdleBubble(false); }}
      title="Soporte"
      style={{
        display: "flex", alignItems: "center", gap: 10,
        width: "100%", padding: (!isMobile && collapsed) ? "8px 0" : "9px 10px",
        justifyContent: (!isMobile && collapsed) ? "center" : "flex-start",
        background: open ? "rgba(249,115,22,0.12)" : "rgba(255,255,255,0.04)",
        border: open ? "1px solid rgba(249,115,22,0.25)" : "1px solid transparent",
        borderRadius: 10, cursor: "pointer",
        transition: "all 0.15s",
      }}
      onMouseEnter={e => { if (!open) e.currentTarget.style.background = "rgba(255,255,255,0.08)"; }}
      onMouseLeave={e => { if (!open) e.currentTarget.style.background = "rgba(255,255,255,0.04)"; }}
    >
      <div style={{ flexShrink: 0, position: "relative" }}>
        <DinoSVG state="jacked" pixelSize={2} />
        {idleBubble && (
          <span style={{ position: "absolute", top: -3, right: -3, width: 8, height: 8, borderRadius: "50%", background: "#F97316", boxShadow: "0 0 6px #F97316", animation: "dino-ping 1.5s ease-in-out infinite" }} />
        )}
      </div>
      {(isMobile || !collapsed) && (
        <span style={{ font: `600 0.8rem/1 ${fd}`, color: open ? "#F97316" : "rgba(255,255,255,0.65)", whiteSpace: "nowrap" }}>
          Soporte
        </span>
      )}
    </button>
  );

  return (
    <>
      <style>{`
        @keyframes dino-ping { 0%,100%{transform:scale(1);opacity:1} 50%{transform:scale(1.4);opacity:0.6} }
        @keyframes chat-in { from{opacity:0;transform:translateY(10px) scale(0.97)} to{opacity:1;transform:translateY(0) scale(1)} }
        @keyframes bubble-in { from{opacity:0;transform:translateY(6px)} to{opacity:1;transform:translateY(0)} }
        .dino-chat-msg::-webkit-scrollbar { width: 3px; }
        .dino-chat-msg::-webkit-scrollbar-track { background: transparent; }
        .dino-chat-msg::-webkit-scrollbar-thumb { background: rgba(0,0,0,0.12); border-radius: 99px; }
      `}</style>

      {/* ── Sidebar button ── */}
      {triggerBtn}

      {/* ── Idle bubble ── */}
      {idleBubble && !open && (
        <div style={{
          position: "fixed",
          bottom: 90,
          left: isMobile ? 16 : sidebarWidth + 16,
          zIndex: 8000,
          animation: "bubble-in 0.3s ease both",
        }}>
          <div style={{
            background: "#1A1D23",
            border: "1px solid rgba(249,115,22,0.35)",
            borderRadius: 14,
            padding: "11px 14px",
            display: "flex", alignItems: "center", gap: 10,
            boxShadow: "0 8px 24px rgba(0,0,0,0.3), 0 0 0 1px rgba(249,115,22,0.12)",
            maxWidth: 240,
          }}>
            <div style={{ flexShrink: 0 }}><DinoSVG state="jacked" pixelSize={2} /></div>
            <div style={{ flex: 1, minWidth: 0 }}>
              <p style={{ font: `600 0.78rem/1.3 ${fd}`, color: "#FFFFFF", margin: 0 }}>
                ¿Te puedo ayudar en algo? 💪
              </p>
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
              <button onClick={handleIdleOpen} style={{ background: "#F97316", border: "none", borderRadius: 7, padding: "4px 8px", font: `600 0.65rem/1 ${fd}`, color: "white", cursor: "pointer", whiteSpace: "nowrap" }}>
                Sí, Dale
              </button>
              <button onClick={() => { setIdleBubble(false); setIdleDismissed(true); }} style={{ background: "none", border: "none", font: `400 0.62rem/1 ${fd}`, color: "rgba(255,255,255,0.3)", cursor: "pointer", padding: "2px 0" }}>
                No, gracias
              </button>
            </div>
          </div>
          {/* tail */}
          <div style={{ position: "absolute", left: 20, bottom: -6, width: 12, height: 12, background: "#1A1D23", border: "1px solid rgba(249,115,22,0.35)", borderTop: "none", borderLeft: "none", transform: "rotate(45deg)" }} />
        </div>
      )}

      {/* ── Chat panel ── */}
      {open && (
        <div style={{
          position: "fixed",
          bottom: isMobile ? 0 : 24,
          left: panelLeft,
          width: isMobile ? "100vw" : 340,
          height: isMobile ? "75svh" : 480,
          zIndex: 8000,
          background: "#111318",
          border: "1px solid rgba(255,255,255,0.09)",
          borderRadius: isMobile ? "20px 20px 0 0" : 18,
          boxShadow: "0 24px 60px rgba(0,0,0,0.45), 0 0 0 1px rgba(249,115,22,0.08)",
          display: "flex", flexDirection: "column",
          overflow: "hidden",
          animation: "chat-in 0.22s cubic-bezier(0.34,1.56,0.64,1) both",
        }}>

          {/* Header */}
          <div style={{ display: "flex", alignItems: "center", gap: 10, padding: "12px 16px", borderBottom: "1px solid rgba(255,255,255,0.07)", flexShrink: 0 }}>
            <DinoSVG state="jacked" pixelSize={2} />
            <div style={{ flex: 1 }}>
              <p style={{ font: `700 0.85rem/1 ${fd}`, color: "#FFFFFF", margin: 0 }}>Rex</p>
              <p style={{ font: `400 0.68rem/1 ${fd}`, color: "rgba(255,255,255,0.35)", margin: 0 }}>Soporte FitGrowX · Siempre disponible</p>
            </div>
            <button onClick={() => setOpen(false)} style={{ background: "none", border: "none", cursor: "pointer", color: "rgba(255,255,255,0.35)", display: "flex", padding: 4 }}>
              <X size={15} />
            </button>
          </div>

          {/* Messages */}
          <div className="dino-chat-msg" style={{ flex: 1, overflowY: "auto", padding: "14px 14px 8px", display: "flex", flexDirection: "column", gap: 10 }}>

            {/* Welcome */}
            {messages.length === 0 && (
              <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                <div style={{ alignSelf: "flex-start", background: "rgba(255,255,255,0.06)", border: "1px solid rgba(255,255,255,0.08)", borderRadius: "4px 14px 14px 14px", padding: "10px 13px", maxWidth: "85%" }}>
                  <p style={{ font: `400 0.82rem/1.55 ${fd}`, color: "rgba(255,255,255,0.85)", margin: 0 }}>
                    ¡Hola! Soy Rex 🦕 ¿En qué te puedo ayudar hoy?
                  </p>
                </div>
                {/* Quick chips */}
                <div style={{ display: "flex", flexDirection: "column", gap: 6, marginTop: 4 }}>
                  {QUICK_CHIPS.map(chip => (
                    <button key={chip} onClick={() => handleChip(chip)} style={{
                      background: "rgba(249,115,22,0.08)", border: "1px solid rgba(249,115,22,0.22)",
                      borderRadius: 10, padding: "8px 12px", font: `500 0.78rem/1.3 ${fd}`,
                      color: "#FB923C", cursor: "pointer", textAlign: "left", transition: "background 0.14s",
                    }}
                    onMouseEnter={e => { e.currentTarget.style.background = "rgba(249,115,22,0.14)"; }}
                    onMouseLeave={e => { e.currentTarget.style.background = "rgba(249,115,22,0.08)"; }}>
                      {chip}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {messages.map((m, i) => (
              <div key={i} style={{ display: "flex", justifyContent: m.role === "user" ? "flex-end" : "flex-start" }}>
                <div style={{
                  maxWidth: "82%",
                  background: m.role === "user" ? "#F97316" : "rgba(255,255,255,0.06)",
                  border: m.role === "user" ? "none" : "1px solid rgba(255,255,255,0.08)",
                  borderRadius: m.role === "user" ? "14px 4px 14px 14px" : "4px 14px 14px 14px",
                  padding: "9px 13px",
                }}>
                  <p style={{ font: `400 0.82rem/1.55 ${fd}`, color: m.role === "user" ? "#fff" : "rgba(255,255,255,0.85)", margin: 0, whiteSpace: "pre-wrap" }}>
                    {m.content}
                  </p>
                </div>
              </div>
            ))}

            {loading && (
              <div style={{ display: "flex", justifyContent: "flex-start" }}>
                <div style={{ background: "rgba(255,255,255,0.06)", border: "1px solid rgba(255,255,255,0.08)", borderRadius: "4px 14px 14px 14px", padding: "10px 14px", display: "flex", alignItems: "center", gap: 6 }}>
                  <Loader2 size={13} color="rgba(255,255,255,0.4)" style={{ animation: "spin 0.9s linear infinite" }} />
                  <span style={{ font: `400 0.78rem/1 ${fd}`, color: "rgba(255,255,255,0.35)" }}>Escribiendo...</span>
                </div>
              </div>
            )}
            <div ref={bottomRef} />
          </div>

          {/* Input */}
          <div style={{ padding: "10px 12px", borderTop: "1px solid rgba(255,255,255,0.07)", display: "flex", gap: 8, flexShrink: 0, alignItems: "flex-end" }}>
            <textarea
              ref={inputRef}
              rows={1}
              value={input}
              onChange={e => setInput(e.target.value)}
              onKeyDown={e => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); sendMessage(input); } }}
              placeholder="Escribí tu consulta..."
              style={{
                flex: 1, background: "rgba(255,255,255,0.06)", border: "1px solid rgba(255,255,255,0.09)",
                borderRadius: 10, padding: "9px 12px", font: `400 0.82rem/1.4 ${fd}`,
                color: "rgba(255,255,255,0.85)", resize: "none", outline: "none",
                maxHeight: 80, overflowY: "auto",
                // eslint-disable-next-line @typescript-eslint/no-explicit-any
                fieldSizing: "content" as any,
              }}
            />
            <button
              onClick={() => sendMessage(input)}
              disabled={!input.trim() || loading}
              style={{
                width: 36, height: 36, borderRadius: 10, border: "none", flexShrink: 0,
                background: input.trim() && !loading ? "#F97316" : "rgba(255,255,255,0.06)",
                color: input.trim() && !loading ? "white" : "rgba(255,255,255,0.2)",
                cursor: input.trim() && !loading ? "pointer" : "not-allowed",
                display: "flex", alignItems: "center", justifyContent: "center",
                transition: "all 0.15s",
              }}
            >
              <Send size={15} />
            </button>
          </div>

        </div>
      )}

      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </>
  );
}
