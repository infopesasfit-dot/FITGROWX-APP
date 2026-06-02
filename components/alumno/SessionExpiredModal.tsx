"use client";

import { useRouter } from "next/navigation";

interface SessionExpiredModalProps {
  show: boolean;
  onClose?: () => void;
}

export function SessionExpiredModal({ show, onClose }: SessionExpiredModalProps) {
  const router = useRouter();

  if (!show) return null;

  const handleLogin = async () => {
    await fetch("/api/alumno/logout", { method: "POST", credentials: "include" }).catch(() => {});
    router.replace("/alumno/login");
  };

  return (
    <div style={{
      position: "fixed",
      inset: 0,
      background: "rgba(0,0,0,0.88)",
      display: "flex",
      alignItems: "center",
      justifyContent: "center",
      zIndex: 9999,
    }}>
      <div style={{
        background: "rgba(15,15,20,0.95)",
        backdropFilter: "blur(20px)",
        border: "1px solid rgba(255,255,255,0.08)",
        borderRadius: 24,
        padding: "32px 28px",
        maxWidth: 360,
        textAlign: "center",
      }}>
        <div style={{ fontSize: 44, marginBottom: 16 }}>⏱️</div>
        <h2 style={{ font: "700 1.3rem/1.1 Inter, sans-serif", color: "#FFFFFF", marginBottom: 10 }}>
          Sesión expirada
        </h2>
        <p style={{ font: "400 0.9rem/1.5 Inter, sans-serif", color: "rgba(255,255,255,0.5)", marginBottom: 24 }}>
          Tu sesión ha caducado. Necesitás volver a iniciar sesión para continuar.
        </p>
        <button
          onClick={handleLogin}
          style={{
            width: "100%",
            padding: "12px 20px",
            borderRadius: 12,
            border: "none",
            background: "#F97316",
            color: "#FFFFFF",
            font: "600 0.95rem/1 Inter, sans-serif",
            cursor: "pointer",
          }}
        >
          Iniciar sesión
        </button>
      </div>
    </div>
  );
}
