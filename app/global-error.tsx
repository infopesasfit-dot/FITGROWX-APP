"use client";

export default function GlobalError({ reset }: { error: Error; reset: () => void }) {
  return (
    <html lang="es">
      <body style={{ margin: 0, background: "#040508", color: "#fff", fontFamily: "'Inter', sans-serif", display: "flex", alignItems: "center", justifyContent: "center", minHeight: "100vh" }}>
        <div style={{ textAlign: "center", padding: "0 24px", maxWidth: 400 }}>
          <div style={{ fontSize: 48, marginBottom: 16 }}>⚡</div>
          <h1 style={{ fontSize: "1.5rem", fontWeight: 700, letterSpacing: "-0.04em", marginBottom: 8 }}>
            Algo salió mal
          </h1>
          <p style={{ color: "rgba(255,255,255,0.4)", fontSize: "0.9rem", lineHeight: 1.6, marginBottom: 28 }}>
            Ocurrió un error inesperado. Podés intentar recargar la página.
          </p>
          <button
            onClick={reset}
            style={{
              padding: "12px 28px", borderRadius: 9999, border: "none", cursor: "pointer",
              background: "linear-gradient(180deg, #ff7a1a 0%, #ff6000 55%, #e05000 100%)",
              color: "#fff", fontWeight: 600, fontSize: "0.875rem",
            }}
          >
            Reintentar
          </button>
        </div>
      </body>
    </html>
  );
}
