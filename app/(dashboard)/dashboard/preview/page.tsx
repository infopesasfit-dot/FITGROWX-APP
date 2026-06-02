"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";

const fd = "var(--font-inter, 'Inter', sans-serif)";

export default function PreviewPage() {
  const router = useRouter();
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetch("/api/dashboard/preview-token", { credentials: "include" })
      .then(r => r.json())
      .then(d => {
        if (d.previewUrl) setPreviewUrl(d.previewUrl);
        else setError(d.error ?? "No se pudo generar el preview.");
      })
      .catch(() => setError("Error de conexión."));
  }, []);

  return (
    <div style={{
      minHeight: "100vh",
      background: "#0D1117",
      display: "flex",
      flexDirection: "column",
      alignItems: "center",
      fontFamily: fd,
    }}>
      {/* Header */}
      <div style={{
        width: "100%",
        display: "flex",
        alignItems: "center",
        gap: 12,
        padding: "16px 24px",
        borderBottom: "1px solid rgba(255,255,255,0.06)",
      }}>
        <button
          onClick={() => router.push("/dashboard")}
          style={{
            display: "flex", alignItems: "center", gap: 6,
            background: "rgba(255,255,255,0.06)", border: "1px solid rgba(255,255,255,0.1)",
            borderRadius: 10, padding: "8px 14px",
            font: `500 0.82rem/1 ${fd}`, color: "rgba(255,255,255,0.7)",
            cursor: "pointer",
          }}
        >
          ← Volver al dashboard
        </button>
        <span style={{ font: `600 0.9rem/1 ${fd}`, color: "rgba(255,255,255,0.5)" }}>
          👁 Vista previa de la app
        </span>
      </div>

      {/* Phone frame */}
      <div style={{ flex: 1, display: "flex", alignItems: "center", justifyContent: "center", padding: "32px 16px 48px" }}>
        {error ? (
          <div style={{ textAlign: "center", color: "rgba(255,255,255,0.5)", font: `400 0.9rem/1.5 ${fd}` }}>
            <div style={{ fontSize: 32, marginBottom: 12 }}>⚠️</div>
            {error}
          </div>
        ) : !previewUrl ? (
          <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 16 }}>
            <div style={{
              width: 40, height: 40, borderRadius: "50%",
              border: "3px solid #F97316", borderTopColor: "transparent",
              animation: "spin 0.8s linear infinite",
            }} />
            <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
            <span style={{ font: `500 0.85rem/1 ${fd}`, color: "rgba(255,255,255,0.35)" }}>
              Generando vista previa…
            </span>
          </div>
        ) : (
          /* iPhone 14 frame */
          <div style={{
            position: "relative",
            width: 414,
            height: 896,
            background: "#1C1C1E",
            borderRadius: 54,
            boxShadow: "0 0 0 2px #3A3A3C, 0 30px 80px rgba(0,0,0,0.7), inset 0 0 0 2px #2C2C2E",
            overflow: "hidden",
            flexShrink: 0,
          }}>
            {/* Notch */}
            <div style={{
              position: "absolute", top: 0, left: "50%", transform: "translateX(-50%)",
              width: 120, height: 34,
              background: "#1C1C1E",
              borderRadius: "0 0 20px 20px",
              zIndex: 10,
            }} />
            {/* Screen */}
            <div style={{
              position: "absolute",
              inset: 4,
              borderRadius: 50,
              overflow: "hidden",
              background: "#000",
            }}>
              <iframe
                src={previewUrl}
                style={{ width: "100%", height: "100%", border: "none" }}
                title="App del alumno — vista previa"
              />
            </div>
            {/* Home indicator */}
            <div style={{
              position: "absolute", bottom: 10, left: "50%", transform: "translateX(-50%)",
              width: 120, height: 5,
              background: "rgba(255,255,255,0.35)",
              borderRadius: 9999,
              zIndex: 10,
            }} />
          </div>
        )}
      </div>
    </div>
  );
}
