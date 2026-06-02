"use client";

import { DinoSVG } from "@/components/dashboard/DinoSVG";

export default function AlumnoError({ reset }: { error: Error; reset: () => void }) {
  return (
    <div style={{
      minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center",
      background: "#f5f5f5", padding: "0 24px",
    }}>
      <div className="dashboard-card" style={{
        maxWidth: 380, width: "100%", padding: "40px 32px",
        textAlign: "center", display: "flex", flexDirection: "column", alignItems: "center", gap: 16,
      }}>
        <div style={{ marginBottom: 8 }}>
          <DinoSVG state="flaco" pixelSize={5} />
        </div>
        <h2 style={{ fontSize: "1.1rem", fontWeight: 700, color: "#101114", letterSpacing: "-0.03em", marginBottom: 4 }}>
          Algo salió mal
        </h2>
        <p style={{ color: "#515765", fontSize: "0.82rem", lineHeight: 1.6, marginBottom: 24 }}>
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
