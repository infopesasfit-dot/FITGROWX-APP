"use client";

import { useEffect, useState } from "react";

const fd = "'Inter', sans-serif";

interface OfflineIndicatorProps {
  isSyncing?: boolean;
  syncedCount?: number;
}

export function OfflineIndicator({ isSyncing, syncedCount }: OfflineIndicatorProps) {
  const [isOnline, setIsOnline] = useState(true);
  const [showSynced, setShowSynced] = useState(false);

  useEffect(() => {
    const handleOnline = () => setIsOnline(true);
    const handleOffline = () => setIsOnline(false);

    window.addEventListener("online", handleOnline);
    window.addEventListener("offline", handleOffline);

    return () => {
      window.removeEventListener("online", handleOnline);
      window.removeEventListener("offline", handleOffline);
    };
  }, []);

  useEffect(() => {
    if (syncedCount && syncedCount > 0) {
      // eslint-disable-next-line react-hooks/exhaustive-deps
      setShowSynced(true);
      const timer = setTimeout(() => setShowSynced(false), 3000);
      return () => clearTimeout(timer);
    }
  }, [syncedCount]);

  if (isOnline && !isSyncing && !showSynced) return null;

  return (
    <div
      style={{
        position: "fixed",
        bottom: 120,
        left: "50%",
        transform: "translateX(-50%)",
        zIndex: 250,
        display: "flex",
        alignItems: "center",
        gap: 8,
        padding: "10px 16px",
        borderRadius: 10,
        background: isOnline
          ? showSynced
            ? "rgba(52,211,153,0.15)"
            : "rgba(255,255,255,0.05)"
          : "rgba(239,68,68,0.15)",
        border: isOnline
          ? showSynced
            ? "1px solid rgba(52,211,153,0.2)"
            : "1px solid rgba(255,255,255,0.08)"
          : "1px solid rgba(239,68,68,0.2)",
        backdropFilter: "blur(20px)",
        WebkitBackdropFilter: "blur(20px)",
        font: `500 0.78rem/1 ${fd}`,
        color: isOnline ? (showSynced ? "#34D399" : "rgba(255,255,255,0.5)") : "#EF4444",
        animation: "slideUp 0.3s ease",
      }}
    >
      <style>{`@keyframes slideUp { from { opacity:0; transform:translate(-50%, 10px); } to { opacity:1; transform:translate(-50%, 0); } }`}</style>

      {isOnline ? (
        <>
          {isSyncing && (
            <>
              <div
                style={{
                  width: 8,
                  height: 8,
                  borderRadius: "50%",
                  background: "rgba(255,255,255,0.5)",
                  animation: "pulse 1.5s infinite",
                }}
              />
              <style>{`@keyframes pulse { 0%, 100% { opacity: 0.6; } 50% { opacity: 1; } }`}</style>
              Sincronizando...
            </>
          )}
          {showSynced && (
            <>
              ✓ {syncedCount} elemento{syncedCount !== 1 ? "s" : ""} sincronizado{syncedCount !== 1 ? "s" : ""}
            </>
          )}
        </>
      ) : (
        <>
          <div style={{ width: 8, height: 8, borderRadius: "50%", background: "#EF4444" }} />
          Sin conexión - Los cambios se guardarán cuando vuelvas online
        </>
      )}
    </div>
  );
}
