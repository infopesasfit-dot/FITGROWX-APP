"use client";

import { useState, useRef, useEffect } from "react";
import { MessageCircle, X, BookOpen, Headphones } from "lucide-react";

const SUPPORT_WA = process.env.NEXT_PUBLIC_FITGROWX_SUPPORT_WA ?? "5491100000000";

export default function FloatingSupport() {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  const waUrl = `https://wa.me/${SUPPORT_WA}?text=${encodeURIComponent("Hola! Necesito soporte con FitGrowX.")}`;

  return (
    <div ref={ref} style={{ position: "fixed", bottom: 24, right: 24, zIndex: 9990, display: "flex", flexDirection: "column", alignItems: "flex-end", gap: 10 }}>

      {/* Menu */}
      {open && (
        <div style={{
          background: "#FFFFFF",
          borderRadius: 16,
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
            <p style={{ font: "700 0.8rem/1 'Inter', sans-serif", color: "#1A1D23" }}>¿En qué te ayudamos?</p>
          </div>

          <div style={{ padding: 6 }}>
            <a
              href={waUrl}
              target="_blank"
              rel="noopener noreferrer"
              onClick={() => setOpen(false)}
              style={{
                display: "flex", alignItems: "center", gap: 10,
                padding: "9px 10px", borderRadius: 10,
                textDecoration: "none", color: "#1A1D23",
                font: "500 0.845rem/1 'Inter', sans-serif",
                transition: "background 0.12s",
              }}
              onMouseEnter={e => (e.currentTarget.style.background = "#F4F5F9")}
              onMouseLeave={e => (e.currentTarget.style.background = "transparent")}
            >
              <div style={{ width: 32, height: 32, borderRadius: 9, background: "rgba(37,211,102,0.1)", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                <Headphones size={15} color="#22c55e" />
              </div>
              <div>
                <p style={{ margin: 0, font: "600 0.845rem/1 'Inter', sans-serif", color: "#1A1D23" }}>Chat de Soporte</p>
                <p style={{ margin: "2px 0 0", font: "400 0.72rem/1 'Inter', sans-serif", color: "#9CA3AF" }}>WhatsApp</p>
              </div>
            </a>

            <a
              href="https://docs.fitgrowx.com"
              target="_blank"
              rel="noopener noreferrer"
              onClick={() => setOpen(false)}
              style={{
                display: "flex", alignItems: "center", gap: 10,
                padding: "9px 10px", borderRadius: 10,
                textDecoration: "none", color: "#1A1D23",
                font: "500 0.845rem/1 'Inter', sans-serif",
                transition: "background 0.12s",
              }}
              onMouseEnter={e => (e.currentTarget.style.background = "#F4F5F9")}
              onMouseLeave={e => (e.currentTarget.style.background = "transparent")}
            >
              <div style={{ width: 32, height: 32, borderRadius: 9, background: "rgba(249,115,22,0.08)", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                <BookOpen size={15} color="#F97316" />
              </div>
              <div>
                <p style={{ margin: 0, font: "600 0.845rem/1 'Inter', sans-serif", color: "#1A1D23" }}>Documentación</p>
                <p style={{ margin: "2px 0 0", font: "400 0.72rem/1 'Inter', sans-serif", color: "#9CA3AF" }}>Guías y tutoriales</p>
              </div>
            </a>
          </div>
        </div>
      )}

      {/* FAB button */}
      <button
        onClick={() => setOpen(o => !o)}
        style={{
          width: 52, height: 52,
          borderRadius: "50%",
          background: open ? "#1A1D23" : "#F97316",
          border: "none",
          cursor: "pointer",
          display: "flex", alignItems: "center", justifyContent: "center",
          boxShadow: open
            ? "0 4px 20px rgba(26,29,35,0.35)"
            : "0 4px 20px rgba(249,115,22,0.45)",
          transition: "all 0.2s cubic-bezier(0.34,1.56,0.64,1)",
          transform: open ? "rotate(0deg)" : "rotate(0deg)",
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
