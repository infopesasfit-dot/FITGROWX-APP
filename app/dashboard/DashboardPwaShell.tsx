"use client";

import { useEffect, useState } from "react";

const fd = "var(--font-inter, 'Inter', sans-serif)";
const ACCENT = "#2563EB";

export function DashboardPwaShell({ children }: { children: React.ReactNode }) {
  const [showBanner, setShowBanner] = useState(false);
  const [isIos, setIsIos] = useState(false);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const [deferredPrompt, setDeferredPrompt] = useState<any>(null);

  useEffect(() => {
    // Inyectar <link rel="manifest"> dinámicamente para App Router (client layout)
    const existing = document.querySelector('link[rel="manifest"]');
    if (!existing) {
      const link = document.createElement("link");
      link.rel = "manifest";
      link.href = "/manifest-dashboard.json";
      document.head.appendChild(link);
    }

    // Tags para iOS standalone
    const setMeta = (name: string, content: string) => {
      if (!document.querySelector(`meta[name="${name}"]`)) {
        const m = document.createElement("meta");
        m.name = name;
        m.content = content;
        document.head.appendChild(m);
      }
    };
    setMeta("apple-mobile-web-app-capable", "yes");
    setMeta("apple-mobile-web-app-title", "FitGrowX Admin");
    setMeta("apple-mobile-web-app-status-bar-style", "default");

    // Registrar service worker
    if ("serviceWorker" in navigator) {
      navigator.serviceWorker.register("/sw-dashboard.js", { scope: "/dashboard/" }).catch(() => {});
    }

    // Ya instalada: no mostrar banner
    if (window.matchMedia("(display-mode: standalone)").matches) return;
    if (localStorage.getItem("fitgrowx_owner_pwa_dismissed")) return;

    const ios = /iphone|ipad|ipod/i.test(navigator.userAgent);
    setIsIos(ios);

    if (ios) {
      setTimeout(() => setShowBanner(true), 4000);
    } else {
      const handler = (e: Event) => {
        e.preventDefault();
        setDeferredPrompt(e);
        setTimeout(() => setShowBanner(true), 4000);
      };
      window.addEventListener("beforeinstallprompt", handler);
      return () => window.removeEventListener("beforeinstallprompt", handler);
    }
  }, []);

  const handleInstall = async () => {
    if (!deferredPrompt) return;
    deferredPrompt.prompt();
    const { outcome } = await deferredPrompt.userChoice;
    if (outcome === "accepted") setShowBanner(false);
    setDeferredPrompt(null);
  };

  const handleDismiss = () => {
    setShowBanner(false);
    localStorage.setItem("fitgrowx_owner_pwa_dismissed", "1");
  };

  return (
    <>
      {children}

      {showBanner && (
        <div style={{
          position: "fixed", bottom: 24, left: 12, right: 12, zIndex: 9999,
          background: "rgba(255,255,255,0.97)", backdropFilter: "blur(20px)", WebkitBackdropFilter: "blur(20px)",
          border: `1px solid ${ACCENT}22`,
          borderRadius: 18,
          padding: "14px 16px",
          boxShadow: "0 8px 32px rgba(37,99,235,0.15), 0 2px 8px rgba(15,23,42,0.08)",
          display: "flex", alignItems: "center", gap: 12,
          animation: "ownerPwaSlide 0.35s cubic-bezier(0.34,1.56,0.64,1)",
        }}>
          <style>{`
            @keyframes ownerPwaSlide {
              from { opacity: 0; transform: translateY(24px); }
              to   { opacity: 1; transform: translateY(0); }
            }
          `}</style>

          <div style={{
            width: 42, height: 42, borderRadius: 12,
            background: `rgba(37,99,235,0.08)`,
            flexShrink: 0, display: "flex", alignItems: "center", justifyContent: "center",
          }}>
            <img src="/images/logo-favicon-fitgrowx.png" alt="FitGrowX" style={{ width: 28, height: 28, objectFit: "contain" }} />
          </div>

          <div style={{ flex: 1, minWidth: 0 }}>
            <p style={{ font: `700 0.84rem/1.2 ${fd}`, color: "#0F172A", marginBottom: 3 }}>
              Instalá FitGrowX en tu celu
            </p>
            {isIos ? (
              <p style={{ font: `400 0.7rem/1.45 ${fd}`, color: "#6B7280" }}>
                Tocá <strong style={{ color: "#374151" }}>Compartir</strong> → <strong style={{ color: "#374151" }}>Agregar a inicio</strong> para acceder sin señal
              </p>
            ) : (
              <p style={{ font: `400 0.7rem/1.45 ${fd}`, color: "#6B7280" }}>
                Consultá alumnos y pagos aunque no tengas señal
              </p>
            )}
          </div>

          {!isIos && deferredPrompt && (
            <button
              onClick={() => void handleInstall()}
              style={{
                flexShrink: 0, padding: "8px 14px", borderRadius: 10,
                border: "none", background: ACCENT, color: "white",
                font: `700 0.75rem/1 ${fd}`, cursor: "pointer",
              }}
            >
              Instalar
            </button>
          )}

          <button
            onClick={handleDismiss}
            style={{
              flexShrink: 0, width: 26, height: 26, borderRadius: 8,
              border: "none", background: "rgba(15,23,42,0.05)",
              color: "#9CA3AF", cursor: "pointer",
              display: "flex", alignItems: "center", justifyContent: "center",
              font: "600 0.9rem/1 sans-serif",
            }}
          >
            ✕
          </button>
        </div>
      )}
    </>
  );
}
