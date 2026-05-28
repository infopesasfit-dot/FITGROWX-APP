"use client";

import { Ref } from "react";

interface Session {
  alumno_id: string;
  gym_id: string;
  full_name: string;
  dni: string | null;
}

interface QrModalProps {
  showQR: boolean;
  setShowQR: (show: boolean) => void;
  session: Session;
  checkinMode: "qr" | "scan";
  setCheckinMode: (mode: "qr" | "scan") => void;
  checkinLoading: boolean;
  setCheckinLoading: (loading: boolean) => void;
  checkinResult: { ok: boolean; already?: boolean; full_name?: string; hora?: string; error?: string } | null;
  setCheckinResult: (result: { ok: boolean; already?: boolean; full_name?: string; hora?: string; error?: string } | null) => void;
  scanActive: boolean;
  setScanActive: (active: boolean) => void;
  scanError: string | null;
  setScanError: (error: string | null) => void;
  scanVideoRef: Ref<HTMLVideoElement>;
  scanAnimRef: React.MutableRefObject<number | null>;
  scanCooldown: React.MutableRefObject<boolean>;
  fd: string;
  startScan: () => Promise<void>;
  stopScan: () => void;
}

export function QrModal({
  showQR,
  setShowQR,
  session,
  checkinMode,
  setCheckinMode,
  checkinLoading,
  setCheckinLoading,
  checkinResult,
  setCheckinResult,
  scanActive,
  setScanActive,
  scanError,
  setScanError,
  scanVideoRef,
  scanAnimRef,
  scanCooldown,
  fd,
  startScan,
  stopScan,
}: QrModalProps) {
  if (!showQR || !session) return null;

  return (
    <div onClick={() => setShowQR(false)} style={{ position: "fixed", inset: 0, zIndex: 400, background: "rgba(0,0,0,0.88)", backdropFilter: "blur(32px)", WebkitBackdropFilter: "blur(32px)", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", padding: 20 }}>
      <div onClick={e => e.stopPropagation()} style={{ textAlign: "center", maxWidth: 300, width: "100%", animation: "fadeUp 0.22s cubic-bezier(0.16,1,0.3,1)" }}>

        {/* Tab switcher */}
        <div style={{ display: "flex", gap: 4, background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.08)", borderRadius: 14, padding: 4, marginBottom: 20 }}>
          {([
            { key: "qr",   label: "Mi QR" },
            { key: "scan", label: "Escanear" },
          ] as const).map(({ key, label }) => (
            <button
              key={key}
              onClick={() => { setCheckinMode(key); setCheckinResult(null); }}
              style={{ flex: 1, padding: "8px 0", borderRadius: 10, border: "none", background: checkinMode === key ? "rgba(249,115,22,0.18)" : "transparent", color: checkinMode === key ? "#F97316" : "rgba(255,255,255,0.3)", font: `${checkinMode === key ? "700" : "500"} 0.7rem/1 ${fd}`, cursor: "pointer", transition: "all 0.15s", letterSpacing: "0.02em" }}
            >
              {label}
            </button>
          ))}
        </div>

        {/* Mode: Mi QR */}
        {checkinMode === "qr" && (
          <>
            <p style={{ font: `400 0.62rem/1 ${fd}`, color: "rgba(255,255,255,0.2)", letterSpacing: "0.2em", textTransform: "uppercase", marginBottom: 16 }}>El staff escanea este codigo</p>
            <div style={{ background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.08)", borderRadius: 24, padding: 24, position: "relative", overflow: "hidden", marginBottom: 16 }}>
              <div style={{ position: "absolute", top: 14, left: 14, width: 16, height: 16, borderTop: "1.5px solid rgba(249,115,22,0.4)", borderLeft: "1.5px solid rgba(249,115,22,0.4)", borderRadius: "3px 0 0 0" }} />
              <div style={{ position: "absolute", top: 14, right: 14, width: 16, height: 16, borderTop: "1.5px solid rgba(249,115,22,0.4)", borderRight: "1.5px solid rgba(249,115,22,0.4)", borderRadius: "0 3px 0 0" }} />
              <div style={{ position: "absolute", bottom: 14, left: 14, width: 16, height: 16, borderBottom: "1.5px solid rgba(249,115,22,0.4)", borderLeft: "1.5px solid rgba(249,115,22,0.4)", borderRadius: "0 0 0 3px" }} />
              <div style={{ position: "absolute", bottom: 14, right: 14, width: 16, height: 16, borderBottom: "1.5px solid rgba(249,115,22,0.4)", borderRight: "1.5px solid rgba(249,115,22,0.4)", borderRadius: "0 0 3px 0" }} />
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={`https://api.qrserver.com/v1/create-qr-code/?size=220x220&data=FITGROWX:ID:${session.alumno_id}&color=FFFFFF&bgcolor=0D0D14&qzone=1`} alt="QR" width={220} height={220} style={{ display: "block", margin: "0 auto", borderRadius: 4 }} />
            </div>
            <p style={{ font: `600 0.95rem/1 ${fd}`, color: "#FFFFFF", letterSpacing: "-0.01em", marginBottom: 4 }}>{session.full_name}</p>
            <p style={{ font: `400 0.6rem/1 ${fd}`, color: "rgba(255,255,255,0.18)", letterSpacing: "0.1em", marginBottom: 20, fontVariantNumeric: "tabular-nums" }}>DNI {session.dni ?? "—"}</p>
          </>
        )}

        {/* Mode: Escanear QR del gym */}
        {checkinMode === "scan" && (
          <div style={{ marginBottom: 20 }}>
            <p style={{ font: `400 0.62rem/1 ${fd}`, color: "rgba(255,255,255,0.2)", letterSpacing: "0.2em", textTransform: "uppercase", marginBottom: 16 }}>Apuntá la cámara al QR del gym</p>
            {checkinResult ? (
              <div style={{ background: checkinResult.ok ? "rgba(52,211,153,0.06)" : "rgba(239,68,68,0.06)", border: `1px solid ${checkinResult.ok ? "rgba(52,211,153,0.18)" : "rgba(239,68,68,0.18)"}`, borderRadius: 16, padding: "14px 16px", display: "flex", alignItems: "center", gap: 12 }}>
                <div style={{ width: 36, height: 36, borderRadius: "50%", background: checkinResult.ok ? "rgba(52,211,153,0.12)" : "rgba(239,68,68,0.12)", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                  {checkinResult.ok
                    ? <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#34D399" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12"/></svg>
                    : <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#EF4444" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
                  }
                </div>
                <div style={{ flex: 1, minWidth: 0, textAlign: "left" }}>
                  <p style={{ font: `700 0.9rem/1.2 ${fd}`, color: "#FFFFFF", letterSpacing: "-0.01em" }}>
                    {checkinResult.already ? "Ya registrado hoy" : checkinResult.ok ? "¡Buen entreno!" : "Sin acceso"}
                  </p>
                  {checkinResult.ok && checkinResult.hora && <p style={{ font: `400 0.62rem/1 ${fd}`, color: "rgba(255,255,255,0.25)", marginTop: 3 }}>{checkinResult.hora.slice(0, 5)}h · Entrada registrada</p>}
                  {!checkinResult.ok && checkinResult.error && <p style={{ font: `400 0.72rem/1.3 ${fd}`, color: "#EF4444", marginTop: 3 }}>{checkinResult.error}</p>}
                </div>
              </div>
            ) : scanActive ? (
              <div style={{ position: "relative", borderRadius: 16, overflow: "hidden", background: "#000", aspectRatio: "4/3" }}>
                <video ref={scanVideoRef} playsInline muted style={{ width: "100%", height: "100%", objectFit: "cover", display: "block" }} />
                {/* Viewfinder overlay */}
                <div style={{ position: "absolute", inset: 0, display: "flex", alignItems: "center", justifyContent: "center", pointerEvents: "none" }}>
                  <div style={{ width: 160, height: 160, position: "relative" }}>
                    {[{ top: 0, left: 0 }, { top: 0, right: 0 }, { bottom: 0, left: 0 }, { bottom: 0, right: 0 }].map((pos, i) => (
                      <div key={i} style={{ position: "absolute", width: 24, height: 24, ...pos,
                        borderTop: (i < 2) ? "2.5px solid #F97316" : "none",
                        borderBottom: (i >= 2) ? "2.5px solid #F97316" : "none",
                        borderLeft: (i === 0 || i === 2) ? "2.5px solid #F97316" : "none",
                        borderRight: (i === 1 || i === 3) ? "2.5px solid #F97316" : "none",
                      }} />
                    ))}
                  </div>
                </div>
                {checkinLoading && (
                  <div style={{ position: "absolute", inset: 0, background: "rgba(0,0,0,0.6)", display: "flex", alignItems: "center", justifyContent: "center" }}>
                    <div style={{ width: 24, height: 24, borderRadius: "50%", border: "3px solid rgba(255,255,255,0.2)", borderTopColor: "#F97316", animation: "spin 0.7s linear infinite" }} />
                  </div>
                )}
                <button onClick={stopScan} style={{ position: "absolute", top: 10, right: 10, width: 30, height: 30, borderRadius: "50%", background: "rgba(0,0,0,0.5)", border: "none", color: "white", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 14 }}>✕</button>
              </div>
            ) : (
              <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                {scanError && <p style={{ font: `400 0.75rem/1.4 ${fd}`, color: "#EF4444", textAlign: "left" }}>{scanError}</p>}
                <button
                  onClick={startScan}
                  style={{ width: "100%", padding: "13px 0", background: "linear-gradient(135deg, #F97316 0%, #EA580C 100%)", border: "none", borderRadius: 14, font: `700 0.85rem/1 ${fd}`, color: "#FFFFFF", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", gap: 8 }}
                >
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z"/><circle cx="12" cy="13" r="4"/></svg>
                  Abrir cámara
                </button>
              </div>
            )}
          </div>
        )}

        <button onClick={() => setShowQR(false)} style={{ width: "100%", padding: "13px 0", background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.07)", borderRadius: 14, font: `500 0.7rem/1 ${fd}`, color: "rgba(255,255,255,0.35)", cursor: "pointer", letterSpacing: "0.08em" }}>
          CERRAR
        </button>
      </div>
    </div>
  );
}
