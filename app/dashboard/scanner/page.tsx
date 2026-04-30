"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { QrCode, CheckCircle, XCircle, RefreshCw, Scan, Copy, Download, ChevronDown } from "lucide-react";
import { getCachedProfile } from "@/lib/gym-cache";

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
  const [openSections, setOpenSections] = useState<Set<number>>(new Set());
  const [isMobile, setIsMobile] = useState(false);

  const toggleSection = (num: number) => {
    setOpenSections(prev => {
      const next = new Set(prev);
      if (next.has(num)) {
        next.delete(num);
        if (num === 1) stopCamera();
      } else {
        next.add(num);
      }
      return next;
    });
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

  const sections = [
    {
      num: 1,
      title: "Escanear QR del alumno",
      subtitle: "El staff lee el código del alumno con la cámara.",
      accent: "#F97316",
    },
    {
      num: 2,
      title: "QR fijo del gimnasio",
      subtitle: "El alumno escanea un código puesto en la entrada.",
      accent: "#1A1D23",
    },
    {
      num: 3,
      title: "Ingreso manual por DNI",
      subtitle: "Escribí el DNI del alumno para registrar su entrada.",
      accent: "#6366F1",
    },
  ];

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: isMobile ? 14 : 16, maxWidth: 560, margin: "0 auto", overflowX: "hidden" }}>

      {/* Header */}
      <div style={{ marginBottom: 2 }}>
        <h1 style={{ font: `800 1.6rem/1 ${fd}`, color: "#1A1D23", letterSpacing: "-0.035em" }}>Escáner de Presencia</h1>
        <p style={{ font: `400 0.82rem/1.5 ${fd}`, color: "#6B7280", marginTop: 6 }}>
          Elegí cómo registrar la asistencia.
        </p>
      </div>

      {/* Result card — visible desde cualquier método */}
      {result && !loading && (
        <div style={{ borderRadius: 16, overflow: "hidden", border: "1px solid rgba(0,0,0,0.07)" }}>
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

      {/* Accordions */}
      <style>{`
        @keyframes scanLine { 0%, 100% { top: 12%; } 50% { top: 88%; } }
        @keyframes spin { to { transform: rotate(360deg); } }
      `}</style>

      {sections.map(s => {
        const isOpen = openSections.has(s.num);
        return (
          <div key={s.num} style={{ background: "white", border: `1px solid ${isOpen ? `${s.accent}28` : "rgba(0,0,0,0.07)"}`, borderRadius: 16, overflow: "hidden", transition: "border-color 0.2s" }}>

            {/* Accordion header */}
            <button
              onClick={() => toggleSection(s.num)}
              style={{ width: "100%", minHeight: 72, padding: isMobile ? "16px" : "16px 18px", display: "flex", alignItems: "center", gap: 12, background: "transparent", border: "none", cursor: "pointer", textAlign: "left" }}
            >
              <div style={{ width: 30, height: 30, borderRadius: 9, background: s.accent, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                <span style={{ font: `800 0.78rem/1 ${fd}`, color: "white" }}>{s.num}</span>
              </div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <p style={{ font: `700 0.9rem/1 ${fd}`, color: "#1A1D23" }}>{s.title}</p>
                <p style={{ font: `400 0.75rem/1.4 ${fd}`, color: "#6B7280", marginTop: 3 }}>{s.subtitle}</p>
              </div>
              <ChevronDown
                size={18}
                color="#9CA3AF"
                style={{ flexShrink: 0, transform: isOpen ? "rotate(180deg)" : "rotate(0deg)", transition: "transform 0.2s ease" }}
              />
            </button>

            {/* Accordion body */}
            {isOpen && (
              <div style={{ borderTop: "1px solid rgba(0,0,0,0.05)", padding: isMobile ? "16px" : "18px" }}>

                {/* Sección 1: Cámara */}
                {s.num === 1 && (
                  <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
                    <div style={{ background: "#111", borderRadius: 14, overflow: "hidden", position: "relative", aspectRatio: "4/3" }}>
                      <video ref={videoRef} playsInline muted style={{ width: "100%", height: "100%", objectFit: "cover", display: scanning ? "block" : "none" }} />
                      {!scanning && (
                        <div style={{ position: "absolute", inset: 0, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 14 }}>
                          <div style={{ width: 72, height: 72, borderRadius: "50%", background: "rgba(255,255,255,0.06)", display: "flex", alignItems: "center", justifyContent: "center" }}>
                            <QrCode size={32} color="rgba(255,255,255,0.4)" />
                          </div>
                          {camError && <p style={{ font: `400 0.78rem/1.4 ${fd}`, color: "#FCA5A5", textAlign: "center", maxWidth: 240, padding: "0 16px" }}>{camError}</p>}
                          {hasDetector ? (
                            <button onClick={startCamera} style={{ display: "flex", alignItems: "center", gap: 8, padding: "11px 22px", background: "#F97316", color: "white", border: "none", borderRadius: 11, font: `700 0.875rem/1 ${fd}`, cursor: "pointer" }}>
                              <Scan size={15} /> Iniciar cámara
                            </button>
                          ) : (
                            <p style={{ font: `400 0.76rem/1.4 ${fd}`, color: "rgba(255,255,255,0.35)", textAlign: "center", maxWidth: 220, padding: "0 16px" }}>Tu navegador no soporta escaneo en vivo.</p>
                          )}
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
                        <button onClick={stopCamera} style={{ position: "absolute", top: 10, right: 10, background: "rgba(0,0,0,0.6)", border: "1px solid rgba(255,255,255,0.1)", borderRadius: 8, padding: "5px 11px", font: `600 0.72rem/1 ${fd}`, color: "rgba(255,255,255,0.7)", cursor: "pointer" }}>Detener</button>
                      )}
                      {loading && (
                        <div style={{ position: "absolute", inset: 0, background: "rgba(0,0,0,0.65)", display: "flex", alignItems: "center", justifyContent: "center" }}>
                          <div style={{ width: 38, height: 38, borderRadius: "50%", border: "3px solid rgba(249,115,22,0.2)", borderTopColor: "#F97316", animation: "spin 0.8s linear infinite" }} />
                        </div>
                      )}
                    </div>
                    {/* Foto del QR (fallback iOS) */}
                    <label style={{ display: "flex", alignItems: "center", gap: 10, minHeight: 48, padding: "11px 14px", border: "1px solid rgba(0,0,0,0.08)", borderRadius: 12, cursor: "pointer" }}>
                      <QrCode size={15} color="#6B7280" />
                      <span style={{ font: `500 0.82rem/1 ${fd}`, color: "#374151" }}>Sacar foto del QR (alternativa)</span>
                      <input type="file" accept="image/*" capture="environment" style={{ display: "none" }} onChange={handleFileCapture} />
                    </label>
                  </div>
                )}

                {/* Sección 2: QR fijo */}
                {s.num === 2 && (
                  <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 18 }}>
                    {gymId && checkinUrl ? (
                      <>
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img src={`https://api.qrserver.com/v1/create-qr-code/?size=220x220&data=${encodeURIComponent(checkinUrl)}&color=1A1D23&bgcolor=FFFFFF&qzone=1`} alt="QR del gimnasio" width={220} height={220} style={{ borderRadius: 14, border: "1px solid rgba(0,0,0,0.06)" }} />
                        <div style={{ textAlign: "center" }}>
                          <p style={{ font: `600 0.78rem/1 ${fd}`, color: "#1A1D23", marginBottom: 4 }}>Enlace de check-in</p>
                          <p style={{ font: `400 0.7rem/1.4 ${fd}`, color: "#6B7280", wordBreak: "break-all", maxWidth: 320 }}>{checkinUrl}</p>
                        </div>
                        <div style={{ display: "flex", gap: 8, flexWrap: "wrap", justifyContent: "center", width: "100%" }}>
                          <button onClick={() => { navigator.clipboard.writeText(checkinUrl); setCopied(true); setTimeout(() => setCopied(false), 2200); }} style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 7, minHeight: 48, padding: "10px 16px", background: copied ? "#22C55E" : "#1A1D23", color: "white", border: "none", borderRadius: 12, font: `600 0.8rem/1 ${fd}`, cursor: "pointer", transition: "background 0.2s", flex: isMobile ? "1 1 100%" : undefined, width: isMobile ? "100%" : undefined }}>
                            <Copy size={14} />{copied ? "Copiado ✓" : "Copiar enlace"}
                          </button>
                          <a href={`https://api.qrserver.com/v1/create-qr-code/?size=800x800&data=${encodeURIComponent(checkinUrl)}&color=1A1D23&bgcolor=FFFFFF&qzone=2`} download="qr-checkin-gym.png" target="_blank" rel="noopener noreferrer" style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 7, minHeight: 48, padding: "10px 16px", background: "white", color: "#1A1D23", border: "1px solid rgba(0,0,0,0.12)", borderRadius: 12, font: `600 0.8rem/1 ${fd}`, textDecoration: "none", flex: isMobile ? "1 1 100%" : undefined, width: isMobile ? "100%" : undefined }}>
                            <Download size={14} />Descargar QR
                          </a>
                        </div>
                        <div style={{ background: "#F8FAFC", borderRadius: 12, padding: "14px 16px", width: "100%" }}>
                          <p style={{ font: `700 0.78rem/1 ${fd}`, color: "#1A1D23", marginBottom: 10 }}>¿Cómo lo usa el alumno?</p>
                          {["Escanea el QR con la cámara (no hace falta app).", "Ingresa su DNI en la pantalla que aparece.", "El sistema verifica su membresía y registra la entrada."].map((step, i) => (
                            <div key={i} style={{ display: "flex", gap: 9, alignItems: "flex-start", marginBottom: i < 2 ? 8 : 0 }}>
                              <div style={{ width: 18, height: 18, borderRadius: 5, background: "#F97316", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0, marginTop: 1 }}>
                                <span style={{ font: `800 0.62rem/1 ${fd}`, color: "white" }}>{i + 1}</span>
                              </div>
                              <p style={{ font: `400 0.78rem/1.5 ${fd}`, color: "#6B7280" }}>{step}</p>
                            </div>
                          ))}
                        </div>
                      </>
                    ) : (
                      <div style={{ padding: "28px 0", display: "flex", flexDirection: "column", alignItems: "center", gap: 10 }}>
                        <div style={{ width: 30, height: 30, borderRadius: "50%", border: "3px solid rgba(249,115,22,0.2)", borderTopColor: "#F97316", animation: "spin 0.8s linear infinite" }} />
                        <p style={{ font: `400 0.8rem/1 ${fd}`, color: "#9CA3AF" }}>Cargando QR...</p>
                      </div>
                    )}
                  </div>
                )}

                {/* Sección 3: DNI manual */}
                {s.num === 3 && (
                  <div style={{ display: "grid", gridTemplateColumns: isMobile ? "1fr" : "1fr auto", gap: 8 }}>
                    <input
                      type="text"
                      inputMode="numeric"
                      placeholder="DNI del alumno..."
                      value={manualId}
                      onChange={e => setManualId(e.target.value.replace(/\D/g, ""))}
                      onKeyDown={e => e.key === "Enter" && handleManual()}
                      style={{ width: "100%", minHeight: 48, padding: "11px 13px", border: "1px solid rgba(0,0,0,0.12)", borderRadius: 12, font: `400 0.94rem/1 ${fd}`, color: "#1A1D23", outline: "none", boxSizing: "border-box" }}
                    />
                    <button
                      onClick={handleManual}
                      disabled={!manualId.trim() || loading}
                      style={{ minHeight: 48, padding: "11px 18px", background: "#6366F1", color: "white", border: "none", borderRadius: 12, font: `700 0.85rem/1 ${fd}`, cursor: !manualId.trim() ? "not-allowed" : "pointer", opacity: !manualId.trim() ? 0.5 : 1, whiteSpace: "nowrap", width: isMobile ? "100%" : undefined }}
                    >
                      Registrar
                    </button>
                  </div>
                )}

              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
