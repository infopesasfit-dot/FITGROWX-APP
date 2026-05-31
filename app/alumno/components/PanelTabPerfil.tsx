"use client";

import { useState, useEffect, useRef } from "react";
import {
  Camera, User, ChevronRight, ChevronLeft,
  Mail, Phone, CreditCard, Shield, Gift, Dumbbell, Scale,
} from "lucide-react";
import { useAlumnoFotos } from "../hooks/useAlumnoFotos";

const sy = "'Syne', 'Inter', sans-serif";
const dm = "'DM Sans', 'Inter', sans-serif";
const fm = "var(--font-mono, 'JetBrains Mono', monospace)";

type Section = null | "datos" | "fotos" | "historial" | "privacidad" | "reseller";

interface Session {
  alumno_id: string;
  gym_id: string;
  full_name: string;
  status: string;
  plan: string | null;
  expiration: string | null;
  dni: string | null;
  deuda_pendiente?: number;
  email?: string | null;
  phone?: string | null;
  avatar_url?: string | null;
}

interface Medida {
  id: string;
  peso_kg: number;
  grasa_pct: number | null;
  cintura_cm: number | null;
  fecha: string;
}

interface WorkoutSession {
  id: string;
  fecha: string;
  rutina_nombre: string | null;
  completada: boolean;
  series_log: Record<string, unknown>;
}

interface PanelTabPerfilProps {
  session: Session | null;
  logout: () => void;
  showToast: (msg: string, ok?: boolean) => void;
  gymName: string | null;
  logoUrl: string | null;
  rutina?: { nombre: string } | null;
}

// ── Helpers ──────────────────────────────────────────────────────────────────

function fmtDate(iso: string) {
  const d = new Date(iso + "T00:00:00");
  return `${String(d.getDate()).padStart(2, "0")}/${String(d.getMonth() + 1).padStart(2, "0")}/${d.getFullYear()}`;
}

function fmtDateShort(iso: string) {
  const d = new Date(iso + "T00:00:00");
  return d.toLocaleDateString("es-AR", { day: "numeric", month: "short", year: "numeric" });
}

// ── Sub-components ────────────────────────────────────────────────────────────

function SubHeader({ title, onBack }: { title: string; onBack: () => void }) {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 4, padding: "12px 16px 16px", borderBottom: "1px solid rgba(255,255,255,0.06)", marginBottom: 20 }}>
      <button
        onClick={onBack}
        style={{ display: "flex", alignItems: "center", gap: 3, background: "none", border: "none", cursor: "pointer", color: "#F97316", font: `500 0.82rem/1 ${dm}`, padding: "6px 8px 6px 0", minHeight: 44 }}
      >
        <ChevronLeft size={17} color="#F97316" strokeWidth={2.5} />
        Volver
      </button>
      <span style={{ flex: 1, textAlign: "center", font: `700 0.9rem/1 ${sy}`, color: "#FFFFFF", paddingRight: 64 }}>
        {title}
      </span>
    </div>
  );
}

function FieldLabel({ children }: { children: React.ReactNode }) {
  return (
    <p style={{ font: `500 0.58rem/1 ${dm}`, color: "rgba(255,255,255,0.3)", letterSpacing: "0.1em", textTransform: "uppercase", margin: "0 0 6px 2px" }}>
      {children}
    </p>
  );
}

function SettingsGroup({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div style={{ marginBottom: 28 }}>
      <p style={{ font: `500 0.6rem/1 ${dm}`, color: "rgba(255,255,255,0.28)", letterSpacing: "0.12em", textTransform: "uppercase", marginBottom: 8, paddingLeft: 4 }}>
        {label}
      </p>
      <div style={{ borderRadius: 14, overflow: "hidden", border: "1px solid rgba(255,255,255,0.08)" }}>
        {children}
      </div>
    </div>
  );
}

function SettingsRow({
  icon, label, sublabel, onPress, isLast,
}: {
  icon: React.ReactNode;
  label: string;
  sublabel?: string;
  onPress: () => void;
  isLast?: boolean;
}) {
  return (
    <button
      onClick={onPress}
      style={{
        display: "flex", alignItems: "center", gap: 14,
        padding: "14px 16px",
        background: "rgba(0,0,0,0.4)",
        border: "none",
        borderBottom: isLast ? "none" : "1px solid rgba(255,255,255,0.06)",
        width: "100%", cursor: "pointer", textAlign: "left",
      }}
    >
      <div style={{ width: 32, height: 32, borderRadius: 9, background: "rgba(255,255,255,0.07)", border: "1px solid rgba(255,255,255,0.06)", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
        {icon}
      </div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <p style={{ font: `400 0.88rem/1 ${dm}`, color: "#FFFFFF", margin: 0 }}>{label}</p>
        {sublabel && <p style={{ font: `400 0.68rem/1 ${dm}`, color: "rgba(255,255,255,0.3)", margin: "3px 0 0" }}>{sublabel}</p>}
      </div>
      <ChevronRight size={16} color="rgba(255,255,255,0.3)" />
    </button>
  );
}

// ── Main component ────────────────────────────────────────────────────────────

export function PanelTabPerfil({ session, logout, showToast, gymName, logoUrl, rutina }: PanelTabPerfilProps) {
  const {
    fotos, fotosLoading, fotoUploading, nuevaFotoPrivada, setNuevaFotoPrivada,
    fotoInputRef, handleFotoUpload, handleTogglePrivada, handleDeleteFoto,
    comparadorUrl, setComparadorUrl, setComparadorMode, setFotosSeleccionadas,
    handleShareComparador, avatarUrl, avatarUploading, handleAvatarUpload,
  } = useAlumnoFotos(session, showToast, gymName, logoUrl);

  const avatarInputRef = useRef<HTMLInputElement>(null);

  // Navigation
  const [activeSection, setActiveSection] = useState<Section>(null);
  const hadSectionRef = useRef(false);
  useEffect(() => { if (activeSection !== null) hadSectionRef.current = true; }, [activeSection]);

  // Datos: editable fields
  const [editNombre, setEditNombre] = useState(session?.full_name ?? "");
  const [editPhone,  setEditPhone]  = useState(session?.phone ?? "");
  const [editEmail,  setEditEmail]  = useState(session?.email ?? "");
  const [savingPerfil, setSavingPerfil] = useState(false);

  // Sync edit fields when session identity changes (e.g. first load)
  useEffect(() => {
    if (session) {
      setEditNombre(session.full_name);
      setEditPhone(session.phone ?? "");
      setEditEmail(session.email ?? "");
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [session?.alumno_id]);

  // Datos: medidas
  const [medidas,       setMedidas]       = useState<Medida[]>([]);
  const [medidasLoaded, setMedidasLoaded] = useState(false);
  const [medPeso,       setMedPeso]       = useState("");
  const [medGrasa,      setMedGrasa]      = useState("");
  const [medCintura,    setMedCintura]    = useState("");
  const [savingMedida,  setSavingMedida]  = useState(false);

  // Historial
  const [historial,       setHistorial]       = useState<WorkoutSession[]>([]);
  const [historialLoaded, setHistorialLoaded] = useState(false);
  const [historialLoading, setHistorialLoading] = useState(false);

  // Lazy-load section data
  useEffect(() => {
    if (activeSection === "datos" && !medidasLoaded && session) {
      fetch(`/api/alumno/medidas?alumno_id=${session.alumno_id}`, { credentials: "include" })
        .then(r => r.ok ? r.json() : { medidas: [] })
        .then(d => { setMedidas(d.medidas ?? []); setMedidasLoaded(true); })
        .catch(() => setMedidasLoaded(true));
    }
    if (activeSection === "historial" && !historialLoaded && session) {
      setHistorialLoading(true);
      fetch("/api/alumno/workout-history", { credentials: "include" })
        .then(r => r.ok ? r.json() : { sessions: [] })
        .then(d => { setHistorial(d.sessions ?? []); setHistorialLoaded(true); })
        .catch(() => setHistorialLoaded(true))
        .finally(() => setHistorialLoading(false));
    }
  }, [activeSection, medidasLoaded, historialLoaded, session]);

  if (!session) return null;

  const initials  = session.full_name.split(" ").slice(0, 2).map(w => w[0]).join("").toUpperCase();
  const isActivo  = session.status === "activo";

  const goTo = (s: Section) => setActiveSection(s);
  const goBack = () => setActiveSection(null);

  // ── Actions ────────────────────────────────────────────────────────────────

  const handleSavePerfil = async () => {
    if (!session) return;
    const update: Record<string, string> = {};
    if (editNombre.trim() && editNombre.trim() !== session.full_name) update.full_name = editNombre.trim();
    if (editPhone !== (session.phone ?? "")) update.phone = editPhone;
    if (editEmail !== (session.email ?? "")) update.email = editEmail;

    if (Object.keys(update).length > 0) {
      setSavingPerfil(true);
      try {
        const res = await fetch("/api/alumno/perfil", {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          credentials: "include",
          body: JSON.stringify(update),
        });
        const d = await res.json();
        if (d.ok) showToast("Datos actualizados");
        else showToast(d.error ?? "Error al guardar datos.", false);
      } catch {
        showToast("Error de conexión.", false);
      }
      setSavingPerfil(false);
    }
  };

  const handleSaveMedida = async () => {
    if (!session || !medPeso.trim()) return;
    const peso = parseFloat(medPeso);
    if (isNaN(peso) || peso < 20 || peso > 300) { showToast("Peso inválido (20–300 kg).", false); return; }

    setSavingMedida(true);
    try {
      const body: Record<string, unknown> = { alumno_id: session.alumno_id, gym_id: session.gym_id, peso_kg: peso };
      if (medGrasa.trim())   body.grasa_pct   = parseFloat(medGrasa);
      if (medCintura.trim()) body.cintura_cm  = parseFloat(medCintura);
      const res = await fetch("/api/alumno/medidas", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify(body),
      });
      const d = await res.json();
      if (d.ok && d.medida) {
        setMedidas(prev => [d.medida as Medida, ...prev]);
        setMedPeso(""); setMedGrasa(""); setMedCintura("");
        showToast("Medida registrada");
      } else {
        showToast(d.error ?? "Error al registrar medida.", false);
      }
    } catch {
      showToast("Error de conexión.", false);
    }
    setSavingMedida(false);
  };

  // ── Shared input style ─────────────────────────────────────────────────────

  const inputStyle: React.CSSProperties = {
    width: "100%", boxSizing: "border-box",
    padding: "11px 14px",
    background: "rgba(255,255,255,0.05)",
    border: "1px solid rgba(255,255,255,0.10)",
    borderRadius: 10,
    font: `400 0.88rem/1 ${dm}`,
    color: "#FFFFFF",
    outline: "none",
  };

  const numInputStyle: React.CSSProperties = {
    ...inputStyle,
    font: `400 0.88rem/1 ${fm}`,
    letterSpacing: "0.04em",
  };

  // ── Sub-sections ───────────────────────────────────────────────────────────

  const sectionTitles: Record<NonNullable<Section>, string> = {
    datos: "Mis datos",
    fotos: "Fotos y progreso",
    historial: "Historial",
    privacidad: "Privacidad",
    reseller: "Recomendá FitGrowX",
  };

  const renderDatos = () => (
    <div style={{ display: "flex", flexDirection: "column", gap: 20, padding: "0 16px 32px" }}>
      {/* Editable fields */}
      <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
        <div>
          <FieldLabel>Nombre</FieldLabel>
          <input
            style={inputStyle}
            value={editNombre}
            onChange={e => setEditNombre(e.target.value)}
            placeholder="Nombre completo"
          />
        </div>
        <div>
          <FieldLabel>Teléfono</FieldLabel>
          <input
            style={numInputStyle}
            type="tel"
            value={editPhone}
            onChange={e => setEditPhone(e.target.value)}
            placeholder="+54 9 11 1234 5678"
          />
        </div>
        <div>
          <FieldLabel>Email</FieldLabel>
          <input
            style={inputStyle}
            type="email"
            value={editEmail}
            onChange={e => setEditEmail(e.target.value)}
            placeholder="correo@ejemplo.com"
          />
        </div>
        {session.dni && (
          <div>
            <FieldLabel>DNI</FieldLabel>
            <div style={{ ...numInputStyle, display: "flex", alignItems: "center", gap: 8, padding: "11px 14px", opacity: 0.5, cursor: "default" }}>
              <CreditCard size={14} color="rgba(255,255,255,0.4)" />
              <span>···{session.dni.slice(-4)}</span>
            </div>
          </div>
        )}
        <button
          onClick={handleSavePerfil}
          disabled={savingPerfil}
          style={{
            padding: "13px 0",
            background: savingPerfil ? "rgba(249,115,22,0.4)" : "linear-gradient(135deg,#F97316,#EA580C)",
            border: "none", borderRadius: 12,
            font: `600 0.85rem/1 ${dm}`, color: "#fff",
            cursor: savingPerfil ? "not-allowed" : "pointer",
          }}
        >
          {savingPerfil ? "Guardando…" : "Guardar datos"}
        </button>
      </div>

      {/* Divider */}
      <div style={{ height: 1, background: "rgba(255,255,255,0.06)", margin: "4px 0" }} />

      {/* Medidas */}
      <div>
        <p style={{ font: `700 0.78rem/1 ${sy}`, color: "rgba(255,255,255,0.55)", letterSpacing: "-0.01em", marginBottom: 14 }}>
          Registrar medida
        </p>

        {/* Last medida */}
        {medidasLoaded && medidas[0] && (
          <div style={{ background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.07)", borderRadius: 10, padding: "10px 14px", marginBottom: 14, display: "flex", gap: 16 }}>
            <div>
              <p style={{ font: `400 0.56rem/1 ${dm}`, color: "rgba(255,255,255,0.3)", textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: 3 }}>Última</p>
              <p style={{ font: `600 0.7rem/1 ${fm}`, color: "rgba(255,255,255,0.5)" }}>{fmtDateShort(medidas[0].fecha)}</p>
            </div>
            <div>
              <p style={{ font: `400 0.56rem/1 ${dm}`, color: "rgba(255,255,255,0.3)", textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: 3 }}>Peso</p>
              <p style={{ font: `600 0.88rem/1 ${fm}`, color: "#FFFFFF" }}>{medidas[0].peso_kg} kg</p>
            </div>
            {medidas[0].grasa_pct != null && (
              <div>
                <p style={{ font: `400 0.56rem/1 ${dm}`, color: "rgba(255,255,255,0.3)", textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: 3 }}>Grasa</p>
                <p style={{ font: `600 0.88rem/1 ${fm}`, color: "#FFFFFF" }}>{medidas[0].grasa_pct}%</p>
              </div>
            )}
            {medidas[0].cintura_cm != null && (
              <div>
                <p style={{ font: `400 0.56rem/1 ${dm}`, color: "rgba(255,255,255,0.3)", textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: 3 }}>Cintura</p>
                <p style={{ font: `600 0.88rem/1 ${fm}`, color: "#FFFFFF" }}>{medidas[0].cintura_cm} cm</p>
              </div>
            )}
          </div>
        )}

        <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
          <div style={{ display: "flex", gap: 10 }}>
            <div style={{ flex: 1 }}>
              <FieldLabel>Peso (kg) *</FieldLabel>
              <input style={numInputStyle} type="number" inputMode="decimal" value={medPeso} onChange={e => setMedPeso(e.target.value)} placeholder="70.5" />
            </div>
            <div style={{ flex: 1 }}>
              <FieldLabel>Grasa % (opcional)</FieldLabel>
              <input style={numInputStyle} type="number" inputMode="decimal" value={medGrasa} onChange={e => setMedGrasa(e.target.value)} placeholder="18.0" />
            </div>
          </div>
          <div style={{ flex: 1 }}>
            <FieldLabel>Cintura cm (opcional)</FieldLabel>
            <input style={numInputStyle} type="number" inputMode="decimal" value={medCintura} onChange={e => setMedCintura(e.target.value)} placeholder="80" />
          </div>
          <button
            onClick={handleSaveMedida}
            disabled={savingMedida || !medPeso.trim()}
            style={{
              padding: "12px 0", marginTop: 4,
              background: savingMedida || !medPeso.trim() ? "rgba(255,255,255,0.07)" : "rgba(249,115,22,0.15)",
              border: `1px solid ${savingMedida || !medPeso.trim() ? "rgba(255,255,255,0.08)" : "rgba(249,115,22,0.3)"}`,
              borderRadius: 12,
              font: `600 0.82rem/1 ${dm}`,
              color: savingMedida || !medPeso.trim() ? "rgba(255,255,255,0.3)" : "#F97316",
              cursor: savingMedida || !medPeso.trim() ? "not-allowed" : "pointer",
            }}
          >
            {savingMedida ? "Registrando…" : "Registrar medida"}
          </button>
        </div>
      </div>
    </div>
  );

  const renderFotos = () => (
    <div style={{ display: "flex", flexDirection: "column", gap: 16, padding: "0 16px 32px" }}>
      <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
        <button
          onClick={() => fotoInputRef.current?.click()}
          disabled={fotoUploading}
          style={{
            flex: 1, padding: "13px 0",
            background: fotoUploading ? "rgba(249,115,22,0.4)" : "linear-gradient(135deg,#F97316,#EA580C)",
            border: "none", borderRadius: 12,
            font: `600 0.85rem/1 ${dm}`, color: "#fff",
            cursor: fotoUploading ? "not-allowed" : "pointer",
          }}
        >
          {fotoUploading ? "Subiendo…" : "Subir foto"}
        </button>
        <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 3 }}>
          <button
            onClick={() => setNuevaFotoPrivada(!nuevaFotoPrivada)}
            style={{
              width: 40, height: 22, borderRadius: 11,
              background: nuevaFotoPrivada ? "#F97316" : "rgba(255,255,255,0.12)",
              border: "none", cursor: "pointer", position: "relative", transition: "background 0.2s",
            }}
          >
            <div style={{ position: "absolute", top: 3, left: nuevaFotoPrivada ? 21 : 3, width: 16, height: 16, borderRadius: "50%", background: "#fff", transition: "left 0.2s" }} />
          </button>
          <span style={{ font: `400 0.52rem/1 ${dm}`, color: "rgba(255,255,255,0.28)", letterSpacing: "0.04em" }}>
            {nuevaFotoPrivada ? "PRIVADA" : "PÚBLICA"}
          </span>
        </div>
      </div>

      {fotosLoading ? (
        <div style={{ textAlign: "center", padding: "32px 0" }}>
          <div style={{ width: 22, height: 22, borderRadius: "50%", border: "2px solid rgba(255,255,255,0.08)", borderTopColor: "rgba(255,255,255,0.5)", margin: "0 auto", animation: "spin 0.8s linear infinite" }} />
        </div>
      ) : fotos.length === 0 ? (
        <div style={{ textAlign: "center", padding: "32px 0", border: "1px dashed rgba(255,255,255,0.08)", borderRadius: 12 }}>
          <p style={{ font: `400 0.8rem/1.6 ${dm}`, color: "rgba(255,255,255,0.22)", margin: 0 }}>
            Subí tu primera foto para<br />trackear tu progreso visual
          </p>
        </div>
      ) : (
        <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 10 }}>
          {fotos.map(f => (
            <div key={f.id}>
              <div style={{ paddingBottom: "100%", borderRadius: 10, overflow: "hidden", background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.08)", position: "relative" }}>
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={f.foto_url} alt="" style={{ position: "absolute", inset: 0, width: "100%", height: "100%", objectFit: "cover" }} />
              </div>
              <p style={{ font: `400 0.58rem/1 ${fm}`, color: "rgba(255,255,255,0.3)", textAlign: "center", margin: "5px 0 4px", letterSpacing: "0.02em" }}>
                {new Date(f.fecha + "T00:00:00").toLocaleDateString("es-AR", { day: "numeric", month: "short" })}
              </p>
              <div style={{ display: "flex", gap: 4, justifyContent: "center" }}>
                <button onClick={() => handleTogglePrivada(f.id, f.privada)} style={{ background: "rgba(255,255,255,0.06)", border: "1px solid rgba(255,255,255,0.09)", borderRadius: 6, padding: "3px 7px", cursor: "pointer", font: `400 0.6rem/1 ${dm}`, color: "rgba(255,255,255,0.4)" }}>
                  {f.privada ? "🔒" : "👁"}
                </button>
                <button onClick={() => handleDeleteFoto(f.id)} style={{ background: "rgba(239,68,68,0.07)", border: "1px solid rgba(239,68,68,0.14)", borderRadius: 6, padding: "3px 7px", cursor: "pointer", font: `500 0.6rem/1 ${dm}`, color: "rgba(239,68,68,0.6)" }}>
                  ✕
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {rutina && (
        <div style={{ padding: "12px 14px", background: "rgba(249,115,22,0.07)", border: "1px solid rgba(249,115,22,0.15)", borderRadius: 10 }}>
          <p style={{ font: `500 0.6rem/1 ${dm}`, color: "rgba(249,115,22,0.6)", letterSpacing: "0.08em", textTransform: "uppercase", marginBottom: 5 }}>Rutina asignada</p>
          <p style={{ font: `600 0.88rem/1 ${sy}`, color: "#FFFFFF", margin: 0 }}>{rutina.nombre}</p>
        </div>
      )}
    </div>
  );

  const renderHistorial = () => (
    <div style={{ display: "flex", flexDirection: "column", gap: 0, padding: "0 16px 32px" }}>
      {historialLoading ? (
        <div style={{ textAlign: "center", padding: "40px 0" }}>
          <div style={{ width: 22, height: 22, borderRadius: "50%", border: "2px solid rgba(255,255,255,0.08)", borderTopColor: "rgba(255,255,255,0.5)", margin: "0 auto", animation: "spin 0.8s linear infinite" }} />
        </div>
      ) : historial.length === 0 ? (
        <div style={{ textAlign: "center", padding: "40px 0", border: "1px dashed rgba(255,255,255,0.08)", borderRadius: 12 }}>
          <Dumbbell size={28} color="rgba(255,255,255,0.1)" style={{ marginBottom: 10 }} />
          <p style={{ font: `400 0.8rem/1.6 ${dm}`, color: "rgba(255,255,255,0.22)", margin: 0 }}>
            Sin sesiones registradas aún
          </p>
        </div>
      ) : (
        <div style={{ borderRadius: 14, overflow: "hidden", border: "1px solid rgba(255,255,255,0.08)" }}>
          {historial.map((s, i) => {
            const exerciseCount = Object.keys(s.series_log ?? {}).length;
            return (
              <div
                key={s.id}
                style={{
                  display: "flex", alignItems: "center", gap: 14,
                  padding: "13px 16px",
                  background: "rgba(0,0,0,0.4)",
                  borderBottom: i < historial.length - 1 ? "1px solid rgba(255,255,255,0.06)" : "none",
                }}
              >
                <div style={{ width: 32, height: 32, borderRadius: 9, background: s.completada ? "rgba(34,197,94,0.1)" : "rgba(255,255,255,0.05)", border: `1px solid ${s.completada ? "rgba(34,197,94,0.2)" : "rgba(255,255,255,0.06)"}`, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                  <Dumbbell size={14} color={s.completada ? "#22C55E" : "rgba(255,255,255,0.3)"} />
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <p style={{ font: `500 0.85rem/1.2 ${dm}`, color: "#FFFFFF", margin: "0 0 3px", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                    {s.rutina_nombre ?? "Entrenamiento libre"}
                  </p>
                  <p style={{ font: `400 0.65rem/1 ${dm}`, color: "rgba(255,255,255,0.3)", margin: 0 }}>
                    {exerciseCount > 0 ? `${exerciseCount} ejercicio${exerciseCount !== 1 ? "s" : ""}` : "Sin detalle"}
                  </p>
                </div>
                <p style={{ font: `400 0.68rem/1 ${fm}`, color: "rgba(255,255,255,0.35)", flexShrink: 0, letterSpacing: "0.02em" }}>
                  {fmtDate(s.fecha)}
                </p>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );

  const renderPrivacidad = () => (
    <div style={{ padding: "0 16px 32px" }}>
      <div style={{ background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.08)", borderRadius: 14, padding: "20px" }}>
        <div style={{ display: "flex", gap: 12, marginBottom: 14 }}>
          <Shield size={20} color="rgba(255,255,255,0.5)" style={{ flexShrink: 0, marginTop: 1 }} />
          <p style={{ font: `600 0.88rem/1.3 ${sy}`, color: "rgba(255,255,255,0.8)", margin: 0 }}>Tus datos están protegidos</p>
        </div>
        <p style={{ font: `400 0.78rem/1.7 ${dm}`, color: "rgba(255,255,255,0.38)", margin: "0 0 16px" }}>
          Las fotos de progreso son privadas por defecto. Solo vos y el staff del gimnasio pueden verlas. Nunca compartimos tu información personal con terceros.
        </p>
        <a href="/privacidad" style={{ font: `500 0.75rem/1 ${dm}`, color: "rgba(255,255,255,0.35)", textDecoration: "underline", textUnderlineOffset: 3 }}>
          Leer política de privacidad completa →
        </a>
      </div>
    </div>
  );

  const renderReseller = () => (
    <div style={{ padding: "0 16px 32px" }}>
      <div style={{ background: "linear-gradient(135deg, rgba(249,115,22,0.1) 0%, rgba(255,255,255,0.04) 100%)", border: "1px solid rgba(249,115,22,0.14)", borderRadius: 14, padding: "20px" }}>
        <p style={{ font: `700 1.05rem/1.3 ${sy}`, color: "#FFFFFF", margin: "0 0 10px", letterSpacing: "-0.02em" }}>
          Sumá un ingreso recomendando FitGrowX
        </p>
        <p style={{ font: `400 0.78rem/1.7 ${dm}`, color: "rgba(255,255,255,0.45)", margin: "0 0 20px" }}>
          Cada vez que un gimnasio se registra con tu link, ganás comisión. Sin inversión, sin riesgo.
        </p>
        <a
          href="/reseller"
          style={{
            display: "inline-flex", alignItems: "center", gap: 6,
            padding: "11px 18px",
            background: "linear-gradient(135deg,#F97316,#EA580C)",
            borderRadius: 10, textDecoration: "none",
            font: `600 0.82rem/1 ${dm}`, color: "#fff",
          }}
        >
          Conocé el programa <ChevronRight size={14} color="#fff" />
        </a>
      </div>
    </div>
  );

  // ── Render ─────────────────────────────────────────────────────────────────

  const mainAnim = hadSectionRef.current ? "slideInLeft 0.24s cubic-bezier(0.4,0,0.2,1)" : "fadeUp 0.22s ease";

  return (
    <div style={{ animation: "fadeUp 0.22s ease" }}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Syne:wght@600;700;800&family=DM+Sans:ital,opsz,wght@0,9..40,400;0,9..40,500;0,9..40,600&display=swap');
        @keyframes fadeUp      { from { opacity:0; transform:translateY(12px); } to { opacity:1; transform:translateY(0); } }
        @keyframes spin        { to { transform: rotate(360deg); } }
        @keyframes slideInRight { from { opacity:.6; transform:translateX(40px); } to { opacity:1; transform:translateX(0); } }
        @keyframes slideInLeft  { from { opacity:.6; transform:translateX(-40px); } to { opacity:1; transform:translateX(0); } }
      `}</style>

      {/* Hidden file inputs — always in DOM */}
      <input ref={avatarInputRef} type="file" accept="image/*" style={{ display: "none" }} onChange={e => { const f = e.target.files?.[0]; if (f) handleAvatarUpload(f); e.target.value = ""; }} />
      <input ref={fotoInputRef}   type="file" accept="image/*" style={{ display: "none" }} onChange={e => { const f = e.target.files?.[0]; if (f) handleFotoUpload(f); e.target.value = ""; }} />

      {/* ── Main screen ─────────────────────────────────────────── */}
      {activeSection === null && (
        <div style={{ animation: mainAnim }}>

          {/* Header: avatar row */}
          <div style={{ display: "flex", alignItems: "center", gap: 16, padding: "20px 16px 24px" }}>
            {/* Avatar */}
            <div style={{ position: "relative", flexShrink: 0 }}>
              <div
                onClick={() => avatarInputRef.current?.click()}
                style={{
                  width: 72, height: 72, borderRadius: "50%",
                  background: avatarUrl ? "transparent" : "#F97316",
                  border: "2px solid rgba(249,115,22,0.35)",
                  overflow: "hidden", cursor: "pointer",
                  display: "flex", alignItems: "center", justifyContent: "center",
                  position: "relative",
                }}
              >
                {avatarUrl
                  // eslint-disable-next-line @next/next/no-img-element
                  ? <img src={avatarUrl} alt="" style={{ width: "100%", height: "100%", objectFit: "cover" }} />
                  : <span style={{ font: `700 1.5rem/1 ${sy}`, color: "#fff" }}>{initials}</span>
                }
                {avatarUploading && (
                  <div style={{ position: "absolute", inset: 0, background: "rgba(0,0,0,0.65)", display: "flex", alignItems: "center", justifyContent: "center" }}>
                    <div style={{ width: 18, height: 18, borderRadius: "50%", border: "2px solid rgba(255,255,255,0.2)", borderTopColor: "#fff", animation: "spin 0.8s linear infinite" }} />
                  </div>
                )}
              </div>
              <button
                onClick={() => avatarInputRef.current?.click()}
                style={{ position: "absolute", bottom: 0, right: 0, width: 24, height: 24, borderRadius: "50%", background: "#F97316", border: "2px solid #0D1117", display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer" }}
              >
                <Camera size={11} color="#fff" />
              </button>
            </div>

            {/* Name + badge + expiration */}
            <div style={{ display: "flex", flexDirection: "column", gap: 7, minWidth: 0 }}>
              <h2 style={{ font: `700 1.35rem/1.1 ${sy}`, color: "#FFFFFF", letterSpacing: "-0.03em", margin: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                {session.full_name}
              </h2>
              <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                <span style={{
                  font: `600 0.6rem/1 ${dm}`,
                  color: isActivo ? "#FFFFFF" : "#EF4444",
                  background: isActivo ? "#22C55E" : "rgba(239,68,68,0.1)",
                  border: `1px solid ${isActivo ? "#22C55E" : "rgba(239,68,68,0.25)"}`,
                  padding: "4px 10px", borderRadius: 9999, letterSpacing: "0.07em", textTransform: "uppercase",
                }}>
                  {isActivo ? "Activo" : "Vencido"}
                </span>
                {session.plan && (
                  <span style={{ font: `400 0.62rem/1 ${dm}`, color: "rgba(255,255,255,0.38)", border: "1px solid rgba(255,255,255,0.09)", padding: "4px 10px", borderRadius: 9999 }}>
                    {session.plan}
                  </span>
                )}
              </div>
              {session.expiration && (
                <p style={{ font: `400 0.66rem/1 ${fm}`, color: "rgba(255,255,255,0.25)", margin: 0, letterSpacing: "0.03em" }}>
                  Vence: {fmtDate(session.expiration)}
                </p>
              )}
            </div>
          </div>

          {/* Groups */}
          <div style={{ padding: "0 16px 8px" }}>
            <SettingsGroup label="Cuenta">
              <SettingsRow icon={<User size={15} color="rgba(255,255,255,0.55)" />} label="Mis datos" sublabel={session.email ?? undefined} onPress={() => goTo("datos")} />
              <SettingsRow icon={<Scale size={15} color="rgba(255,255,255,0.55)" />} label="Fotos y progreso" sublabel={`${fotos.length} foto${fotos.length !== 1 ? "s" : ""}`} onPress={() => goTo("fotos")} />
              <SettingsRow icon={<Dumbbell size={15} color="rgba(255,255,255,0.55)" />} label="Historial" onPress={() => goTo("historial")} isLast />
            </SettingsGroup>

            <SettingsGroup label="FitGrowX">
              <SettingsRow icon={<Shield size={15} color="rgba(255,255,255,0.55)" />} label="Privacidad" onPress={() => goTo("privacidad")} />
              <SettingsRow icon={<Gift size={15} color="rgba(255,255,255,0.55)" />} label="Recomendá FitGrowX" sublabel="Ganá comisión por cada referido" onPress={() => goTo("reseller")} isLast />
            </SettingsGroup>
          </div>

          {/* Logout */}
          <div style={{ padding: "0 16px 32px" }}>
            <button
              onClick={logout}
              style={{
                width: "100%", padding: "13px 0",
                background: "rgba(239,68,68,0.07)", border: "1px solid rgba(239,68,68,0.16)",
                borderRadius: 12, font: `500 0.82rem/1 ${dm}`, color: "rgba(239,68,68,0.65)",
                cursor: "pointer",
              }}
            >
              Cerrar sesión
            </button>
          </div>
        </div>
      )}

      {/* ── Sub-screen ───────────────────────────────────────────── */}
      {activeSection !== null && (
        <div style={{ animation: "slideInRight 0.26s cubic-bezier(0.4,0,0.2,1)" }}>
          <SubHeader title={sectionTitles[activeSection]} onBack={goBack} />
          {activeSection === "datos"      && renderDatos()}
          {activeSection === "fotos"      && renderFotos()}
          {activeSection === "historial"  && renderHistorial()}
          {activeSection === "privacidad" && renderPrivacidad()}
          {activeSection === "reseller"   && renderReseller()}
        </div>
      )}

      {/* ── Comparador modal (preservado) ────────────────────────── */}
      {comparadorUrl && (
        <div style={{ position: "fixed", inset: 0, zIndex: 450, background: "rgba(0,0,0,0.94)", backdropFilter: "blur(24px)", WebkitBackdropFilter: "blur(24px)", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", padding: "20px 16px", gap: 16 }}>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={comparadorUrl} alt="Comparación de progreso" style={{ width: "100%", maxWidth: 440, borderRadius: 14, display: "block" }} />
          <div style={{ display: "flex", gap: 10, width: "100%", maxWidth: 440 }}>
            <button onClick={handleShareComparador} style={{ flex: 1, minHeight: 52, background: "linear-gradient(135deg,#F97316,#EA580C)", border: "none", borderRadius: 14, font: `700 0.9rem/1 ${dm}`, color: "#fff", cursor: "pointer" }}>
              Compartir
            </button>
            <button
              onClick={() => { setComparadorUrl(null); setComparadorMode(false); setFotosSeleccionadas([]); }}
              style={{ minHeight: 52, padding: "0 20px", background: "rgba(255,255,255,0.07)", border: "1px solid rgba(255,255,255,0.12)", borderRadius: 14, font: `600 0.82rem/1 ${dm}`, color: "rgba(255,255,255,0.65)", cursor: "pointer" }}
            >
              Cerrar
            </button>
          </div>
          <p style={{ font: `400 0.62rem/1.5 ${dm}`, color: "rgba(255,255,255,0.22)", textAlign: "center", maxWidth: 280 }}>
            Guardá la imagen o compartila directo a Instagram Stories
          </p>
        </div>
      )}
    </div>
  );
}
