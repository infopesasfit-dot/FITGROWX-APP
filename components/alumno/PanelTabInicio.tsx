"use client";

import { useState, useEffect } from "react";
import QRCode from "qrcode";
import { QrCode } from "lucide-react";

const sy = "'Syne', 'Inter', sans-serif";
const dm = "'DM Sans', 'Inter', sans-serif";
const fm = "var(--font-mono, 'JetBrains Mono', monospace)";

interface Session {
  alumno_id: string;
  gym_id: string;
  full_name: string;
  status: string;
  plan: string | null;
  expiration: string | null;
}

interface GymClass {
  id: string;
  class_name: string;
  day_of_week: number;
  start_time: string;
  coach_name: string | null;
}

interface PanelTabInicioProps {
  session: Session;
  clases: GymClass[];
  rutina: { nombre: string } | null;
  asistCount: number;
  onShowQR: () => void;
}

function fmtExp(iso: string | null) {
  if (!iso) return null;
  const d = new Date(iso + "T00:00:00");
  return `${String(d.getDate()).padStart(2, "0")}/${String(d.getMonth() + 1).padStart(2, "0")}/${d.getFullYear()}`;
}

function fmtTime(t: string) {
  const [h, m] = t.split(":");
  const hour = parseInt(h, 10);
  const ampm = hour >= 12 ? "PM" : "AM";
  const h12 = hour % 12 || 12;
  return `${h12}:${m} ${ampm}`;
}

export function PanelTabInicio({ session, clases, rutina, asistCount, onShowQR }: PanelTabInicioProps) {
  const [qrDataUrl, setQrDataUrl] = useState<string | null>(null);

  useEffect(() => {
    if (!session.alumno_id) return;
    QRCode.toDataURL(`FITGROWX:ID:${session.alumno_id}`, {
      width: 160,
      margin: 1,
      color: { dark: "#FFFFFF", light: "#0D0D14" },
    }).then(setQrDataUrl).catch(() => {});
  }, [session.alumno_id]);

  const isActivo = session.status === "activo";
  const firstName = session.full_name.split(" ")[0];

  const todayDow = new Date().getDay();
  const proximaClase = clases
    .filter(c => c.day_of_week === todayDow)
    .sort((a, b) => a.start_time.localeCompare(b.start_time))[0] ?? null;

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 16, animation: "fadeUp 0.22s ease" }}>

      {/* Greeting */}
      <div style={{ padding: "4px 0 8px" }}>
        <h1 style={{ font: `700 1.9rem/1 ${sy}`, color: "#FFFFFF", letterSpacing: "-0.04em", marginBottom: 10 }}>
          Hola, {firstName}
        </h1>
        <div style={{ display: "flex", gap: 6, flexWrap: "wrap", alignItems: "center" }}>
          <span style={{
            font: `600 0.62rem/1 ${dm}`,
            color: isActivo ? "#fff" : "#EF4444",
            background: isActivo ? "#22C55E" : "rgba(239,68,68,0.1)",
            border: `1px solid ${isActivo ? "#22C55E" : "rgba(239,68,68,0.25)"}`,
            padding: "5px 11px", borderRadius: 9999, letterSpacing: "0.07em", textTransform: "uppercase",
          }}>
            {isActivo ? "Activo" : "Vencido"}
          </span>
          {session.expiration && (
            <span style={{ font: `400 0.68rem/1 ${fm}`, color: "rgba(255,255,255,0.28)", letterSpacing: "0.03em" }}>
              Vence: {fmtExp(session.expiration)}
            </span>
          )}
          {asistCount > 0 && (
            <span style={{ font: `500 0.62rem/1 ${dm}`, color: "#F97316", background: "rgba(249,115,22,0.08)", border: "1px solid rgba(249,115,22,0.18)", padding: "4px 9px", borderRadius: 9999 }}>
              {asistCount} asist. este mes
            </span>
          )}
        </div>
      </div>

      {/* QR card */}
      <button
        onClick={onShowQR}
        style={{
          display: "flex", alignItems: "center", gap: 16,
          padding: "16px 18px",
          background: "rgba(0,0,0,0.4)",
          border: "1px solid rgba(255,255,255,0.08)",
          borderRadius: 16,
          cursor: "pointer", textAlign: "left", width: "100%",
        }}
      >
        <div style={{
          width: 68, height: 68, borderRadius: 12,
          overflow: "hidden", background: "#0D0D14",
          flexShrink: 0,
          display: "flex", alignItems: "center", justifyContent: "center",
          border: "1px solid rgba(255,255,255,0.07)",
        }}>
          {qrDataUrl
            ? <img src={qrDataUrl} alt="Mi QR" width={64} height={64} style={{ display: "block" }} />
            : <QrCode size={26} color="rgba(255,255,255,0.18)" />
          }
        </div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <p style={{ font: `600 0.9rem/1 ${sy}`, color: "#FFFFFF", margin: "0 0 5px", letterSpacing: "-0.01em" }}>
            Mi QR de acceso
          </p>
          <p style={{ font: `400 0.72rem/1.5 ${dm}`, color: "rgba(255,255,255,0.35)", margin: 0 }}>
            El staff escanea este código para registrar tu entrada
          </p>
        </div>
      </button>

      {/* Daily summary */}
      <div style={{ background: "rgba(0,0,0,0.4)", border: "1px solid rgba(255,255,255,0.08)", borderRadius: 16, overflow: "hidden" }}>
        <div style={{ padding: "12px 16px 10px", borderBottom: "1px solid rgba(255,255,255,0.06)" }}>
          <p style={{ font: `500 0.6rem/1 ${dm}`, color: "rgba(255,255,255,0.28)", letterSpacing: "0.12em", textTransform: "uppercase", margin: 0 }}>Hoy</p>
        </div>

        {/* Clase */}
        <div style={{ padding: "14px 16px", borderBottom: "1px solid rgba(255,255,255,0.06)", display: "flex", alignItems: "center", gap: 12 }}>
          <div style={{
            width: 32, height: 32, borderRadius: 9, fontSize: 15,
            background: proximaClase ? "rgba(249,115,22,0.08)" : "rgba(255,255,255,0.04)",
            border: `1px solid ${proximaClase ? "rgba(249,115,22,0.18)" : "rgba(255,255,255,0.06)"}`,
            display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0,
          }}>
            📅
          </div>
          <div style={{ minWidth: 0 }}>
            <p style={{ font: `500 0.82rem/1 ${dm}`, color: "#FFFFFF", margin: "0 0 4px", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
              {proximaClase ? proximaClase.class_name : "No tenés clases hoy"}
            </p>
            {proximaClase && (
              <p style={{ font: `400 0.65rem/1 ${fm}`, color: "rgba(255,255,255,0.32)", margin: 0, letterSpacing: "0.03em" }}>
                {fmtTime(proximaClase.start_time)}{proximaClase.coach_name ? ` · ${proximaClase.coach_name}` : ""}
              </p>
            )}
          </div>
        </div>

        {/* Rutina */}
        <div style={{ padding: "14px 16px", display: "flex", alignItems: "center", gap: 12 }}>
          <div style={{
            width: 32, height: 32, borderRadius: 9, fontSize: 15,
            background: rutina ? "rgba(249,115,22,0.08)" : "rgba(255,255,255,0.04)",
            border: `1px solid ${rutina ? "rgba(249,115,22,0.18)" : "rgba(255,255,255,0.06)"}`,
            display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0,
          }}>
            💪
          </div>
          <div style={{ minWidth: 0 }}>
            <p style={{ font: `500 0.82rem/1 ${dm}`, color: "#FFFFFF", margin: "0 0 4px", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
              {rutina ? rutina.nombre : "Sin rutina asignada"}
            </p>
            <p style={{ font: `400 0.65rem/1 ${dm}`, color: "rgba(255,255,255,0.3)", margin: 0 }}>
              {rutina ? "Tu entrenamiento de hoy" : "Tu entrenador aún no configuró tu rutina"}
            </p>
          </div>
        </div>
      </div>

    </div>
  );
}
