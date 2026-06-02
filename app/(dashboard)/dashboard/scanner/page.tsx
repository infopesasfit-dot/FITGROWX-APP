"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { QrCode, CheckCircle, XCircle, RefreshCw, Scan, Copy, Download, X } from "lucide-react";
import { getCachedProfile, invalidateDashboardCache, invalidateAsistenciasCache } from "@/lib/gym-cache";
import QRCode from "qrcode";

type DetectedBarcode = {
  rawValue?: string;
};

type BarcodeDetectorConstructor = new (options?: {
  formats?: string[];
}) => {
  detect(source: HTMLVideoElement | ImageBitmap): Promise<DetectedBarcode[]>;
};

const fd = "var(--font-inter, 'Inter', sans-serif)";

interface CheckinResult {
  ok: boolean;
  already?: boolean;
  alumno?: {
    full_name: string;
    plan: string | null;
    status: string;
    expiration: string | null;
  };
  hora?: string;
  error?: string;
  error_code?: string;
  error_title?: string;
  error_hint?: string;
}

const STATUS_LABEL: Record<string, string> = {
  activo: "Activo", vencido: "Vencido", pendiente: "Pendiente", pausado: "Pausado",
};
const STATUS_COLOR: Record<string, string> = {
  activo: "#FF6A00", vencido: "#DC2626", pendiente: "#D97706", pausado: "#64748B",
};

export default function ScannerPage() {
  const videoRef     = useRef<HTMLVideoElement>(null);
  const animRef      = useRef<number | null>(null);
  const lastQR       = useRef<string | null>(null);
  const cooldownRef  = useRef(false);
  const cooldownTimeoutRef = useRef<number | null>(null);

  const getBarcodeDetector = () =>
    (window as Window & { BarcodeDetector?: BarcodeDetectorConstructor }).BarcodeDetector;

  const [scanning,   setScanning]   = useState(false);
  const [result,     setResult]     = useState<CheckinResult | null>(null);
  const [loading,    setLoading]    = useState(false);
  const [camError,   setCamError]   = useState<string | null>(null);
  const hasDetector = typeof window !== "undefined" && Boolean(getBarcodeDetector());

  const [gymId,  setGymId]  = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [activeTab, setActiveTab] = useState<1 | 2 | 3>(1);
  const [prevTab, setPrevTab] = useState<1 | 2 | 3>(1);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isMobile, setIsMobile] = useState(false);
  const [qrDataUrl, setQrDataUrl] = useState<string | null>(null);

  const handleTabClick = (tab: 1 | 2 | 3) => {
    if (tab === 3) {
      setPrevTab(activeTab);
      setIsModalOpen(true);
    } else {
      if (activeTab === 1 && tab !== 1) stopCamera();
      if (tab === 1 && activeTab === 1) stopCamera();
      setActiveTab(tab);
    }
  };

  const closeModal = () => {
    setIsModalOpen(false);
    setActiveTab(prevTab);
  };
  const checkinUrl = gymId ? `${process.env.NEXT_PUBLIC_APP_URL ?? "https://fitgrowx.com"}/checkin/${gymId}` : "";

  useEffect(() => {
    getCachedProfile().then(p => { if (p?.gymId) setGymId(p.gymId); });
  }, []);

  useEffect(() => {
    const check = () => setIsMobile(window.innerWidth < 768);
    check();
    window.addEventListener("resize", check);
    return () => window.removeEventListener("resize", check);
  }, []);

  useEffect(() => {
    if (!checkinUrl) {
      setQrDataUrl(null);
      return;
    }
    QRCode.toDataURL(checkinUrl, {
      width: isMobile ? 240 : 280,
      margin: 2,
      color: { dark: "#1A1D23", light: "#FFFFFF" },
    })
      .then(setQrDataUrl)
      .catch(() => setQrDataUrl(null));
  }, [checkinUrl, isMobile]);

  const processQR = useCallback(async (qr_data: string) => {
    if (cooldownRef.current || qr_data === lastQR.current) return;
    lastQR.current = qr_data;
    cooldownRef.current = true;
    setLoading(true);
    setResult(null);

    const res = await fetch("/api/alumno/checkin", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ qr_data }),
    });
    const data: CheckinResult = await res.json();
    setResult(data);
    if (data.ok) {
      invalidateAsistenciasCache();
      invalidateDashboardCache();
    }
    setLoading(false);

    // Reset cooldown after 3s so the same QR can be re-scanned
    if (cooldownTimeoutRef.current) {
      window.clearTimeout(cooldownTimeoutRef.current);
    }
    cooldownTimeoutRef.current = window.setTimeout(() => {
      cooldownRef.current = false;
      lastQR.current = null;
      cooldownTimeoutRef.current = null;
    }, 3000);
  }, []);

  const startCamera = useCallback(async () => {
    if (scanning || loading || !hasDetector) return;
    setCamError(null);
    setResult(null);
    lastQR.current = null;
    cooldownRef.current = false;

    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: "environment", width: { ideal: 1280 }, height: { ideal: 720 } },
      });
      if (!videoRef.current) return;
      videoRef.current.srcObject = stream;
      await videoRef.current.play();
      setScanning(true);

      const BarcodeDetector = getBarcodeDetector();
      if (!BarcodeDetector) {
        setCamError("Tu navegador no soporta lectura de QR en vivo.");
        return;
      }
      const detector = new BarcodeDetector({ formats: ["qr_code"] });
      const scan = async () => {
        if (!videoRef.current || videoRef.current.readyState < 2) {
          animRef.current = requestAnimationFrame(scan);
          return;
        }
        if (cooldownRef.current) {
          animRef.current = requestAnimationFrame(scan);
          return;
        }
        try {
          const codes = await detector.detect(videoRef.current);
          const qrValue = codes[0]?.rawValue;
          if (typeof qrValue === "string" && qrValue.length > 0) {
            await processQR(qrValue);
          }
        } catch { /* ignore */ }
        animRef.current = requestAnimationFrame(scan);
      };
      animRef.current = requestAnimationFrame(scan);
    } catch (e) {
      setCamError(e instanceof Error ? e.message : "No se pudo acceder a la cámara.");
    }
  }, [hasDetector, loading, processQR, scanning]);

  const stopCamera = useCallback(() => {
    if (animRef.current) cancelAnimationFrame(animRef.current);
    if (cooldownTimeoutRef.current) {
      window.clearTimeout(cooldownTimeoutRef.current);
      cooldownTimeoutRef.current = null;
    }
    cooldownRef.current = false;
    lastQR.current = null;
    if (videoRef.current?.srcObject) {
      (videoRef.current.srcObject as MediaStream).getTracks().forEach(t => t.stop());
      videoRef.current.srcObject = null;
    }
    setScanning(false);
  }, []);

  useEffect(() => {
    return () => { stopCamera(); };
  }, [stopCamera]);

  // Fallback: process image from file input
  const handleFileCapture = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    e.target.value = "";

    const BarcodeDetector = getBarcodeDetector();
    if (!BarcodeDetector) {
      setResult({ ok: false, error: "Tu dispositivo no soporta lectura de QR automática. Usá la entrada manual." });
      return;
    }

    try {
      const imageBitmap = await createImageBitmap(file);
      const detector = new BarcodeDetector({ formats: ["qr_code"] });
      const codes = await detector.detect(imageBitmap);
      const qrValue = codes[0]?.rawValue;
      if (typeof qrValue === "string" && qrValue.length > 0) {
        await processQR(qrValue);
      } else {
        setResult({ ok: false, error: "No se detectó ningún QR en la imagen." });
      }
    } catch {
      setResult({ ok: false, error: "Error al procesar la imagen." });
    }
  };

  // Manual input
  const [manualId, setManualId] = useState("");
  const handleManual = async () => {
    if (!manualId.trim()) return;
    await processQR(`FITGROWX:${manualId.trim()}`);
    setManualId("");
  };

  const statusColor = result?.alumno ? (STATUS_COLOR[result.alumno.status] ?? "#6B7280") : "#6B7280";
  const statusLabel = result?.alumno ? (STATUS_LABEL[result.alumno.status] ?? result.alumno.status) : "";
  const isMembershipIssue = result?.error_code === "membership_expired" || result?.error_code === "membership_inactive";
  const isSystemIssue = result?.error_code === "system_error";

  return (
    <div style={{ width: "100%", maxWidth: isMobile ? "100%" : 760, margin: "0 auto", padding: isMobile ? "16px 14px 28px" : "28px 24px 40px", display: "flex", flexDirection: "column", gap: isMobile ? 14 : 18, overflowX: "hidden", boxSizing: "border-box" }}>

      {/* Header */}
      <div style={{ display: "flex", flexDirection: isMobile ? "column" : "row", justifyContent: "space-between", alignItems: isMobile ? "flex-start" : "flex-end", gap: 14, marginBottom: isMobile ? 2 : 4 }}>
        <div>
          <p style={{ font: `800 0.72rem/1 ${fd}`, color: "#F97316", letterSpacing: "0.08em", textTransform: "uppercase", marginBottom: 10 }}>Control de acceso</p>
          <h1 style={{ font: `850 ${isMobile ? "1.85rem" : "2.25rem"}/0.98 ${fd}`, color: "#15171D", letterSpacing: "-0.035em" }}>Escáner de Presencia</h1>
        </div>
        <p style={{ font: `500 0.86rem/1.45 ${fd}`, color: "#667085", margin: 0, maxWidth: isMobile ? "100%" : 260, textAlign: isMobile ? "left" : "right" }}>
          Elegí un método y registrá la entrada en segundos.
        </p>
      </div>

      {/* Result card — visible desde cualquier método */}
      {result && !loading && (
        <div style={{ borderRadius: 20, overflow: "hidden", border: "1px solid #E6E8EC", background: "white", boxShadow: "0 18px 46px rgba(16,24,40,0.08)" }}>
          {result.ok && result.alumno ? (
            <>
              {result.alumno.status === "activo" ? (
                <div style={{ background: "#FF6A00", padding: "24px", display: "flex", flexDirection: "column", alignItems: "center", gap: 10 }}>
                  <CheckCircle size={48} color="white" strokeWidth={2} />
                  <p style={{ font: `900 1.5rem/1 ${fd}`, color: "white", letterSpacing: "-0.03em" }}>AL DÍA ✓</p>
                  {result.hora && <p style={{ font: `400 0.75rem/1 ${fd}`, color: "rgba(255,255,255,0.75)" }}>{result.hora.slice(0, 5)}h · {result.already ? "Ya registrado hoy" : "Entrada registrada"}</p>}
                </div>
              ) : (
                <div style={{ background: "#DC2626", padding: "24px", display: "flex", flexDirection: "column", alignItems: "center", gap: 10 }}>
                  <XCircle size={48} color="white" strokeWidth={2} />
                  <p style={{ font: `900 1.5rem/1 ${fd}`, color: "white", letterSpacing: "-0.03em" }}>DEUDA PENDIENTE</p>
                  <p style={{ font: `500 0.8rem/1 ${fd}`, color: "rgba(255,255,255,0.8)" }}>Cuota vencida — contactar al alumno</p>
                </div>
              )}
              <div style={{ background: "white", padding: "14px 18px", display: "flex", alignItems: "center", gap: 12 }}>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <p style={{ font: `700 1rem/1.2 ${fd}`, color: "#1A1D23", marginBottom: 4 }}>{result.alumno.full_name}</p>
                  <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                    <span style={{ font: `600 0.68rem/1 ${fd}`, color: statusColor, background: `${statusColor}12`, border: `1px solid ${statusColor}22`, padding: "3px 8px", borderRadius: 9999 }}>{statusLabel}</span>
                    {result.alumno.plan && <span style={{ font: `400 0.68rem/1 ${fd}`, color: "#6B7280", border: "1px solid rgba(0,0,0,0.08)", padding: "3px 8px", borderRadius: 9999 }}>{result.alumno.plan}</span>}
                    {result.alumno.expiration && <span style={{ font: `400 0.68rem/1 ${fd}`, color: "#6B7280", border: "1px solid rgba(0,0,0,0.08)", padding: "3px 8px", borderRadius: 9999 }}>Vence: {result.alumno.expiration}</span>}
                  </div>
                </div>
                {result.already && <RefreshCw size={18} color="#3B82F6" />}
              </div>
            </>
          ) : (
            <div style={{ background: isSystemIssue ? "rgba(217,119,6,0.06)" : "rgba(220,38,38,0.04)", border: `1px solid ${isSystemIssue ? "rgba(217,119,6,0.28)" : "rgba(220,38,38,0.3)"}`, borderRadius: 16, padding: "18px 20px", display: "flex", alignItems: "flex-start", gap: 12 }}>
              <XCircle size={20} color={isSystemIssue ? "#D97706" : "#DC2626"} />
              <div style={{ display: "flex", flexDirection: "column", gap: 5 }}>
                <p style={{ font: `800 0.95rem/1 ${fd}`, color: isSystemIssue ? "#B45309" : "#B91C1C" }}>{result.error_title ?? "Error al escanear"}</p>
                {result.alumno?.full_name && <p style={{ font: `600 0.84rem/1.3 ${fd}`, color: "#1A1D23" }}>{result.alumno.full_name}</p>}
                <p style={{ font: `500 0.84rem/1.4 ${fd}`, color: isSystemIssue ? "#92400E" : "#DC2626" }}>{result.error ?? "Error desconocido."}</p>
                {result.error_hint && <p style={{ font: `400 0.78rem/1.4 ${fd}`, color: "#6B7280" }}>{result.error_hint}</p>}
                {isMembershipIssue && result.alumno?.expiration && <p style={{ font: `400 0.78rem/1.4 ${fd}`, color: "#6B7280" }}>Vencimiento: {result.alumno.expiration}</p>}
              </div>
            </div>
          )}
        </div>
      )}

      {/* Pill tabs */}
      <div style={{ display: "flex", gap: isMobile ? 8 : 12, justifyContent: "center", flexWrap: "wrap" }}>
        {[
          { id: 1, label: "Escanear con cámara" },
          { id: 2, label: "QR de ingreso" },
          { id: 3, label: "Ingreso por DNI" },
        ].map(tab => (
          <button
            key={tab.id}
            onClick={() => handleTabClick(tab.id as 1 | 2 | 3)}
            style={{
              padding: "7px 16px",
              borderRadius: 9999,
              border: activeTab === tab.id ? "none" : "1px solid #E6E8EC",
              background: activeTab === tab.id ? "#F97316" : "white",
              color: activeTab === tab.id ? "white" : "#1A1D23",
              font: `${activeTab === tab.id ? "700" : "600"} 0.8rem/1 ${fd}`,
              cursor: "pointer",
              transition: "all 0.2s",
              boxShadow: "none",
            }}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Content area */}
      <style>{`
        @keyframes scanLine { 0%, 100% { top: 12%; } 50% { top: 88%; } }
        @keyframes spin { to { transform: rotate(360deg); } }
      `}</style>

      {/* Tab 1: Camera */}
      {activeTab === 1 && (
        <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
          <div style={{ background: "linear-gradient(145deg, #0B0D10, #171A21)", borderRadius: 16, overflow: "hidden", position: "relative", width: "100%", height: 280 }}>
            <video ref={videoRef} playsInline muted style={{ position: "absolute", top: 0, left: 0, width: "100%", height: "100%", objectFit: "cover", display: scanning ? "block" : "none" }} />
            {!scanning && (
              <div style={{ position: "absolute", inset: 0, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 14, padding: "16px" }}>
                <div style={{ width: 82, height: 82, borderRadius: "50%", background: "rgba(255,255,255,0.07)", display: "flex", alignItems: "center", justifyContent: "center", border: "1px solid rgba(255,255,255,0.08)" }}>
                  <QrCode size={36} color="rgba(255,255,255,0.48)" />
                </div>
                {camError && <p style={{ font: `400 0.78rem/1.4 ${fd}`, color: "#FCA5A5", textAlign: "center", maxWidth: 240 }}>{camError}</p>}
                {!hasDetector && <p style={{ font: `400 0.76rem/1.4 ${fd}`, color: "rgba(255,255,255,0.35)", textAlign: "center", maxWidth: 220 }}>Tu navegador no soporta escaneo en vivo.</p>}
              </div>
            )}
            {scanning && (
              <div style={{ position: "absolute", inset: 0, display: "flex", alignItems: "center", justifyContent: "center", pointerEvents: "none" }}>
                {[["top:15%","left:20%","top","left"],["top:15%","right:20%","top","right"],["bottom:15%","left:20%","bottom","left"],["bottom:15%","right:20%","bottom","right"]].map(([t,l,vert,horiz], i) => (
                  <div key={i} style={{ position: "absolute", [vert!]: t.split(":")[1], [horiz!]: l.split(":")[1], width: 26, height: 26, borderTop: vert === "top" ? "3px solid #F97316" : "none", borderBottom: vert === "bottom" ? "3px solid #F97316" : "none", borderLeft: horiz === "left" ? "3px solid #F97316" : "none", borderRight: horiz === "right" ? "3px solid #F97316" : "none", borderRadius: vert === "top" && horiz === "left" ? "4px 0 0 0" : vert === "top" && horiz === "right" ? "0 4px 0 0" : vert === "bottom" && horiz === "left" ? "0 0 0 4px" : "0 0 4px 0" }} />
                ))}
                <div style={{ position: "absolute", left: "20%", right: "20%", height: 2, background: "rgba(249,115,22,0.6)", animation: "scanLine 2s ease-in-out infinite", top: "15%" }} />
              </div>
            )}
            {scanning && (
              <button onClick={stopCamera} style={{ position: "absolute", top: 10, right: 10, background: "rgba(0,0,0,0.6)", border: "1px solid rgba(255,255,255,0.1)", borderRadius: 8, padding: "5px 11px", font: `600 0.72rem/1 ${fd}`, color: "rgba(255,255,255,0.7)", cursor: "pointer", zIndex: 10 }}>Detener</button>
            )}
            {loading && (
              <div style={{ position: "absolute", inset: 0, background: "rgba(0,0,0,0.65)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 10 }}>
                <div style={{ width: 38, height: 38, borderRadius: "50%", border: "3px solid rgba(249,115,22,0.2)", borderTopColor: "#F97316", animation: "spin 0.8s linear infinite" }} />
              </div>
            )}
          </div>
          {hasDetector && !scanning && (
            <button onClick={startCamera} style={{ minHeight: 44, display: "flex", alignItems: "center", justifyContent: "center", gap: 8, padding: "10px 18px", background: "#F97316", color: "white", border: "none", borderRadius: 12, font: `700 0.8rem/1 ${fd}`, cursor: "pointer", boxShadow: "none", width: "100%" }}>
              <Scan size={15} /> Iniciar cámara
            </button>
          )}
          <label style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 10, minHeight: 44, padding: "10px 14px", border: "1px solid #E6E8EC", borderRadius: 12, cursor: "pointer", background: "#FBFCFD", transition: "all 0.2s" }}>
            <QrCode size={14} color="#6B7280" />
            <span style={{ font: `650 0.8rem/1 ${fd}`, color: "#374151" }}>Sacar foto del QR</span>
            <input type="file" accept="image/*" capture="environment" style={{ display: "none" }} onChange={handleFileCapture} />
          </label>
        </div>
      )}

      {/* Tab 2: Fixed QR */}
      {activeTab === 2 && (
        <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 16, width: "100%" }}>
          {gymId && checkinUrl ? (
            <>
              <div style={{ display: "flex", alignItems: "center", justifyContent: "center", padding: isMobile ? "16px" : "20px" }}>
                {qrDataUrl ? (
                  <img src={qrDataUrl} alt="QR del gimnasio" width={240} height={240} style={{ borderRadius: 18, border: "1px solid #E6E8EC", background: "white", boxShadow: "0 18px 45px rgba(16,24,40,0.10)" }} />
                ) : (
                  <div style={{ width: 38, height: 38, borderRadius: "50%", border: "3px solid rgba(249,115,22,0.2)", borderTopColor: "#F97316", animation: "spin 0.8s linear infinite" }} />
                )}
              </div>
              <div style={{ width: "100%", textAlign: "center" }}>
                <p style={{ font: `750 0.82rem/1 ${fd}`, color: "#171A21", marginBottom: 8 }}>Enlace de check-in</p>
                <p style={{ font: `500 0.78rem/1.5 ${fd}`, color: "#667085", wordBreak: "break-all", padding: "0 8px" }}>{checkinUrl}</p>
              </div>
              <div style={{ display: "grid", gridTemplateColumns: isMobile ? "1fr" : "1fr 1fr", gap: 10, width: "100%", maxWidth: 520, margin: "0 auto" }}>
                <button onClick={() => { navigator.clipboard.writeText(checkinUrl); setCopied(true); setTimeout(() => setCopied(false), 2200); }} style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 8, minHeight: 42, padding: "9px 14px", background: copied ? "#16A34A" : "#171A21", color: "white", border: "none", borderRadius: 12, font: `700 0.78rem/1 ${fd}`, cursor: "pointer", transition: "background 0.2s" }}>
                  <Copy size={13} />{copied ? "Copiado ✓" : "Copiar enlace"}
                </button>
                <button
                  onClick={async () => {
                    if (!checkinUrl) return;
                    const big = await QRCode.toDataURL(checkinUrl, { width: 900, margin: 3, color: { dark: '#1A1D23', light: '#FFFFFF' } });
                    const a = document.createElement('a');
                    a.href = big;
                    a.download = 'qr-checkin-gym.png';
                    a.click();
                  }}
                  style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 8, minHeight: 42, padding: "9px 14px", background: "#FBFCFD", color: "#171A21", border: "1px solid #D8DCE2", borderRadius: 12, font: `700 0.78rem/1 ${fd}`, cursor: "pointer" }}
                >
                  <Download size={13} />Descargar QR
                </button>
              </div>
            </>
          ) : (
            <div style={{ padding: "40px 0", display: "flex", flexDirection: "column", alignItems: "center", gap: 12, width: "100%" }}>
              <div style={{ width: 38, height: 38, borderRadius: "50%", border: "3px solid rgba(249,115,22,0.2)", borderTopColor: "#F97316", animation: "spin 0.8s linear infinite" }} />
              <p style={{ font: `400 0.8rem/1 ${fd}`, color: "#9CA3AF" }}>Cargando QR...</p>
            </div>
          )}
        </div>
      )}

      {/* Modal for DNI entry */}
      {isModalOpen && (
        <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.5)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 1000, padding: "16px" }}>
          <div style={{ background: "white", borderRadius: 20, padding: "24px", maxWidth: 400, width: "100%", boxShadow: "0 25px 50px rgba(16,24,40,0.15)" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 20 }}>
              <h2 style={{ font: `800 1.3rem/1 ${fd}`, color: "#1A1D23", margin: 0 }}>Ingreso manual</h2>
              <button onClick={closeModal} style={{ background: "none", border: "none", cursor: "pointer", padding: 0 }}>
                <X size={24} color="#9CA3AF" />
              </button>
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
              <input
                type="text"
                inputMode="numeric"
                placeholder="DNI del alumno..."
                value={manualId}
                onChange={e => setManualId(e.target.value.replace(/\D/g, ""))}
                onKeyDown={e => e.key === "Enter" && handleManual()}
                autoFocus
                style={{ minHeight: 54, padding: "13px 15px", border: "1px solid #D8DCE2", borderRadius: 14, font: `600 1rem/1 ${fd}`, color: "#1A1D23", outline: "none", boxSizing: "border-box", background: "#FBFCFD" }}
              />
              <button
                onClick={handleManual}
                disabled={!manualId.trim() || loading}
                style={{ minHeight: 44, padding: "10px 18px", background: "#F97316", color: "white", border: "none", borderRadius: 12, font: `700 0.8rem/1 ${fd}`, cursor: !manualId.trim() ? "not-allowed" : "pointer", opacity: !manualId.trim() ? 0.5 : 1, width: "100%", boxShadow: "none" }}
              >
                Registrar entrada
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
