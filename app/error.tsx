"use client";

import Link from "next/link";

export default function RootError({ reset }: { error: Error; reset: () => void }) {
  return (
    <main style={{ minHeight: "100vh", background: "#040508", color: "#fff", fontFamily: "'Inter', sans-serif", display: "flex", alignItems: "center", justifyContent: "center" }}>
      <div style={{ textAlign: "center", padding: "0 24px", maxWidth: 420 }}>
        <div style={{ fontSize: 48, marginBottom: 16 }}>⚡</div>
        <h1 style={{ fontSize: "1.6rem", fontWeight: 700, letterSpacing: "-0.04em", marginBottom: 8 }}>
          Algo salió mal
        </h1>
        <p style={{ color: "rgba(255,255,255,0.4)", fontSize: "0.875rem", lineHeight: 1.6, marginBottom: 28 }}>
          Ocurrió un error inesperado. Si el problema persiste, contactá a soporte.
        </p>
        <div style={{ display: "flex", gap: 12, justifyContent: "center", flexWrap: "wrap" }}>
          <button
            onClick={reset}
            style={{
              padding: "11px 24px", borderRadius: 9999, border: "none", cursor: "pointer",
              background: "linear-gradient(180deg, #ff7a1a 0%, #ff6000 55%, #e05000 100%)",
              color: "#fff", fontWeight: 600, fontSize: "0.875rem",
            }}
          >
            Reintentar
          </button>
          <Link
            href="/"
            style={{
              padding: "11px 24px", borderRadius: 9999, textDecoration: "none",
              border: "1px solid rgba(255,255,255,0.12)", background: "transparent",
              color: "rgba(255,255,255,0.7)", fontWeight: 500, fontSize: "0.875rem",
            }}
          >
            Ir al inicio
          </Link>
        </div>
      </div>
    </main>
  );
}
