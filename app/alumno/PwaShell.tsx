"use client";

import { useEffect, useState } from "react";

export function PwaShell({ children }: { children: React.ReactNode }) {
  const [showBanner, setShowBanner] = useState(false);
  const [isIos, setIsIos]           = useState(false);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const [deferredPrompt, setDeferredPrompt] = useState<any>(null);

  useEffect(() => {
    // Registrar service worker
    if ("serviceWorker" in navigator) {
      navigator.serviceWorker.register("/sw.js").catch(() => {});
    }

    // No mostrar si ya está instalada
    if (window.matchMedia("(display-mode: standalone)").matches) return;
    // No mostrar si el usuario ya descartó
    if (localStorage.getItem("fitgrowx_pwa_dismissed")) return;

    const ios = /iphone|ipad|ipod/i.test(navigator.userAgent);
    setIsIos(ios);

    if (ios) {
      // En iOS no hay evento, mostrar instrucciones manuales
      setTimeout(() => setShowBanner(true), 3000);
    } else {
      // Android/Chrome: capturar el evento nativo
      const handler = (e: Event) => {
        e.preventDefault();
        setDeferredPrompt(e);
        setTimeout(() => setShowBanner(true), 3000);
      };
      window.addEventListener("beforeinstallprompt", handler);
      return () => window.removeEventListener("beforeinstallprompt", handler);
    }
  }, []);

  const handleInstall = async () => {
    if (deferredPrompt) {
      deferredPrompt.prompt();
      const { outcome } = await deferredPrompt.userChoice;
      if (outcome === "accepted") setShowBanner(false);
      setDeferredPrompt(null);
    }
  };

  const handleDismiss = () => {
    setShowBanner(false);
    localStorage.setItem("fitgrowx_pwa_dismissed", "1");
  };

  return (
    <>
      {children}

      {/* Banner de instalación */}
      {showBanner && (
        <div style={{
          position: "fixed", bottom: 80, left: 12, right: 12, zIndex: 400,
          background: "rgba(15,15,20,0.96)", backdropFilter: "blur(20px)", WebkitBackdropFilter: "blur(20px)",
          border: "1px solid rgba(249,115,22,0.25)", borderRadius: 18,
          padding: "14px 16px", boxShadow: "0 8px 32px rgba(0,0,0,0.5)",
          display: "flex", alignItems: "center", gap: 12,
          animation: "slideUp 0.3s cubic-bezier(0.34,1.56,0.64,1)",
        }}>
          <style>{`@keyframes slideUp { from { opacity:0; transform:translateY(20px); } to { opacity:1; transform:translateY(0); } }`}</style>
          <div style={{ width: 40, height: 40, borderRadius: 12, background: "rgba(249,115,22,0.15)", flexShrink: 0, display: "flex", alignItems: "center", justifyContent: "center" }}>
            <img src="/images/logo-favicon-fitgrowx.png" alt="FitGrowX" style={{ width: 26, height: 26, objectFit: "contain" }} />
          </div>
          <div style={{ flex: 1, minWidth: 0 }}>
            <p style={{ font: "700 0.82rem/1.2 'Inter', sans-serif", color: "#FFFFFF", marginBottom: 3 }}>
              Agregá la app al inicio
            </p>
            {isIos ? (
              <p style={{ font: "400 0.7rem/1.4 'Inter', sans-serif", color: "rgba(255,255,255,0.45)" }}>
                Tocá <strong style={{ color: "rgba(255,255,255,0.65)" }}>Compartir</strong> → <strong style={{ color: "rgba(255,255,255,0.65)" }}>Agregar a inicio</strong>
              </p>
            ) : (
              <p style={{ font: "400 0.7rem/1.4 'Inter', sans-serif", color: "rgba(255,255,255,0.45)" }}>
                Abrila directo desde tu celu, sin browser
              </p>
            )}
          </div>
          {!isIos && deferredPrompt && (
            <button
              onClick={() => void handleInstall()}
              style={{ flexShrink: 0, padding: "8px 14px", borderRadius: 10, border: "none", background: "#F97316", color: "white", font: "700 0.75rem/1 'Inter', sans-serif", cursor: "pointer" }}
            >
              Instalar
            </button>
          )}
          <button
            onClick={handleDismiss}
            style={{ flexShrink: 0, width: 26, height: 26, borderRadius: 8, border: "none", background: "rgba(255,255,255,0.07)", color: "rgba(255,255,255,0.4)", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", font: "600 0.9rem/1 sans-serif" }}
          >
            ✕
          </button>
        </div>
      )}
    </>
  );
}
