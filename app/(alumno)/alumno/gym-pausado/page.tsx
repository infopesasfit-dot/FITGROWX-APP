"use client";

import { useRouter } from "next/navigation";

export default function GymPausadoPage() {
  const router = useRouter();

  return (
    <div style={{
      minHeight: "100vh",
      background: "#0D0D14",
      display: "flex",
      flexDirection: "column",
      alignItems: "center",
      justifyContent: "center",
      padding: 24,
      color: "#FFFFFF",
      fontFamily: "'Inter', sans-serif",
    }}>
      <div style={{
        maxWidth: 380,
        width: "100%",
        background: "rgba(255,255,255,0.04)",
        border: "1px solid rgba(255,255,255,0.08)",
        borderRadius: 20,
        padding: "40px 28px",
        textAlign: "center",
      }}>
        <div style={{
          width: 56,
          height: 56,
          borderRadius: "50%",
          background: "rgba(249,115,22,0.12)",
          border: "1px solid rgba(249,115,22,0.3)",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          margin: "0 auto 20px",
          fontSize: 24,
        }}>⏸</div>

        <h1 style={{
          font: "700 1.25rem/1.3 'Inter', sans-serif",
          marginBottom: 12,
          letterSpacing: "-0.01em",
        }}>
          Acceso temporalmente pausado
        </h1>

        <p style={{
          font: "400 0.9rem/1.5 'Inter', sans-serif",
          color: "rgba(255,255,255,0.6)",
          marginBottom: 24,
        }}>
          Este gimnasio no está disponible en este momento. Por favor, contactá a tu profesor para más información.
        </p>

        <button
          onClick={() => router.replace("/alumno/login")}
          style={{
            background: "rgba(255,255,255,0.04)",
            border: "1px solid rgba(255,255,255,0.07)",
            borderRadius: 12,
            padding: "12px 24px",
            font: "500 0.8rem/1 'Inter', sans-serif",
            color: "rgba(255,255,255,0.5)",
            cursor: "pointer",
            letterSpacing: "0.05em",
          }}
        >
          VOLVER
        </button>
      </div>
    </div>
  );
}
