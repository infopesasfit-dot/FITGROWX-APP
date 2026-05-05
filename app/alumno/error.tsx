"use client";

export default function AlumnoError({ reset }: { error: Error; reset: () => void }) {
  return (
    <div style={{
      minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center",
      background: "#09090b", padding: "0 24px",
    }}>
      <div style={{ textAlign: "center", maxWidth: 360 }}>
        <div style={{ fontSize: 40, marginBottom: 16 }}>😅</div>
        <h2 style={{ fontSize: "1.1rem", fontWeight: 700, color: "#fff", letterSpacing: "-0.03em", marginBottom: 8 }}>
          Algo salió mal
        </h2>
        <p style={{ color: "rgba(255,255,255,0.38)", fontSize: "0.82rem", lineHeight: 1.6, marginBottom: 24 }}>
          No pudimos cargar tu panel. Podés reintentar o pedirle al gimnasio el link de acceso nuevamente.
        </p>
        <button
          onClick={reset}
          style={{
            padding: "11px 28px", borderRadius: 9999, border: "none", cursor: "pointer",
            background: "#FF6A00", color: "#fff", fontWeight: 600, fontSize: "0.875rem",
          }}
        >
          Reintentar
        </button>
      </div>
    </div>
  );
}
