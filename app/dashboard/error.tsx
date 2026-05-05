"use client";

import Link from "next/link";

export default function DashboardError({ error, reset }: { error: Error; reset: () => void }) {
  const isAuth = error?.message?.toLowerCase().includes("auth") || error?.message?.toLowerCase().includes("session");

  return (
    <div style={{
      minHeight: "60vh", display: "flex", alignItems: "center", justifyContent: "center",
      padding: "0 24px",
    }}>
      <div style={{
        background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.08)",
        borderRadius: 24, padding: "40px 36px", maxWidth: 400, width: "100%", textAlign: "center",
      }}>
        <div style={{ fontSize: 40, marginBottom: 16 }}>{isAuth ? "🔒" : "⚡"}</div>
        <h2 style={{ fontSize: "1.2rem", fontWeight: 700, letterSpacing: "-0.03em", marginBottom: 8, color: "#fff" }}>
          {isAuth ? "Sesión expirada" : "Error al cargar"}
        </h2>
        <p style={{ color: "rgba(255,255,255,0.38)", fontSize: "0.82rem", lineHeight: 1.6, marginBottom: 24 }}>
          {isAuth
            ? "Tu sesión expiró. Iniciá sesión nuevamente para continuar."
            : "No pudimos cargar esta sección. Podés reintentar o volver al panel."}
        </p>
        <div style={{ display: "flex", gap: 10, justifyContent: "center", flexWrap: "wrap" }}>
          {isAuth ? (
            <Link
              href="/start?login=1"
              style={{
                padding: "10px 22px", borderRadius: 9999, textDecoration: "none",
                background: "linear-gradient(180deg, #ff7a1a 0%, #ff6000 55%, #e05000 100%)",
                color: "#fff", fontWeight: 600, fontSize: "0.82rem",
              }}
            >
              Iniciar sesión
            </Link>
          ) : (
            <>
              <button
                onClick={reset}
                style={{
                  padding: "10px 22px", borderRadius: 9999, border: "none", cursor: "pointer",
                  background: "linear-gradient(180deg, #ff7a1a 0%, #ff6000 55%, #e05000 100%)",
                  color: "#fff", fontWeight: 600, fontSize: "0.82rem",
                }}
              >
                Reintentar
              </button>
              <Link
                href="/dashboard"
                style={{
                  padding: "10px 22px", borderRadius: 9999, textDecoration: "none",
                  border: "1px solid rgba(255,255,255,0.12)", background: "transparent",
                  color: "rgba(255,255,255,0.6)", fontWeight: 500, fontSize: "0.82rem",
                }}
              >
                Volver al panel
              </Link>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
