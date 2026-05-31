"use client";

import { useRef } from "react";
import { Camera, Mail, Phone, CreditCard, Shield } from "lucide-react";
import { useAlumnoFotos } from "../hooks/useAlumnoFotos";

const sy = "'Syne', 'Inter', sans-serif";
const dm = "'DM Sans', 'Inter', sans-serif";
const fm = "var(--font-mono, 'JetBrains Mono', monospace)";

const gc = {
  background: "rgba(255,255,255,0.07)",
  backdropFilter: "blur(16px)",
  WebkitBackdropFilter: "blur(16px)",
  border: "1px solid rgba(255,255,255,0.10)",
  borderRadius: 16,
};

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

interface PanelTabPerfilProps {
  session: Session | null;
  logout: () => void;
  showToast: (msg: string, ok?: boolean) => void;
  gymName: string | null;
  logoUrl: string | null;
  rutina?: { nombre: string } | null;
}

function DataRow({ icon, label, value, mono = false }: { icon: React.ReactNode; label: string; value: string; mono?: boolean }) {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
      <div style={{ flexShrink: 0, width: 32, height: 32, borderRadius: 9, background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.07)", display: "flex", alignItems: "center", justifyContent: "center" }}>
        {icon}
      </div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <p style={{ font: `400 0.6rem/1 ${dm}`, color: "rgba(255,255,255,0.28)", letterSpacing: "0.08em", textTransform: "uppercase", margin: "0 0 3px" }}>{label}</p>
        <p style={{ font: `500 0.85rem/1 ${mono ? fm : dm}`, color: value === "—" ? "rgba(255,255,255,0.2)" : "#FFFFFF", margin: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{value}</p>
      </div>
    </div>
  );
}

export function PanelTabPerfil({ session, logout, showToast, gymName, logoUrl, rutina }: PanelTabPerfilProps) {
  const {
    fotos,
    fotosLoading,
    fotoUploading,
    nuevaFotoPrivada,
    setNuevaFotoPrivada,
    fotoInputRef,
    handleFotoUpload,
    handleTogglePrivada,
    handleDeleteFoto,
    comparadorUrl,
    setComparadorUrl,
    setComparadorMode,
    setFotosSeleccionadas,
    handleShareComparador,
    avatarUrl,
    avatarUploading,
    handleAvatarUpload,
  } = useAlumnoFotos(session, showToast, gymName, logoUrl);

  const avatarInputRef = useRef<HTMLInputElement>(null);

  if (!session) return null;

  const initials = session.full_name.split(" ").slice(0, 2).map(w => w[0]).join("").toUpperCase();
  const isActivo = session.status === "activo";

  const formatExpiration = (exp: string | null) => {
    if (!exp) return null;
    const d = new Date(exp + "T00:00:00");
    return `${String(d.getDate()).padStart(2, "0")}/${String(d.getMonth() + 1).padStart(2, "0")}/${d.getFullYear()}`;
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 16, animation: "fadeUp 0.22s ease" }}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Syne:wght@600;700;800&family=DM+Sans:ital,opsz,wght@0,9..40,400;0,9..40,500;0,9..40,600&display=swap');
        @keyframes fadeUp { from { opacity:0; transform:translateY(14px); } to { opacity:1; transform:translateY(0); } }
        @keyframes spin   { to { transform: rotate(360deg); } }
      `}</style>

      {/* Hidden file inputs */}
      <input
        ref={avatarInputRef}
        type="file"
        accept="image/*"
        style={{ display: "none" }}
        onChange={e => { const f = e.target.files?.[0]; if (f) handleAvatarUpload(f); e.target.value = ""; }}
      />
      <input
        ref={fotoInputRef}
        type="file"
        accept="image/*"
        style={{ display: "none" }}
        onChange={e => { const f = e.target.files?.[0]; if (f) handleFotoUpload(f); e.target.value = ""; }}
      />

      {/* ── HEADER ─────────────────────────────────────────────── */}
      <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 16, padding: "28px 24px 24px" }}>
        {/* Avatar */}
        <div style={{ position: "relative" }}>
          <div
            onClick={() => avatarInputRef.current?.click()}
            style={{
              width: 88, height: 88, borderRadius: "50%",
              background: avatarUrl ? "transparent" : "#F97316",
              border: "2.5px solid rgba(249,115,22,0.4)",
              overflow: "hidden", cursor: "pointer",
              display: "flex", alignItems: "center", justifyContent: "center",
              position: "relative",
            }}
          >
            {avatarUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={avatarUrl} alt="Avatar" style={{ width: "100%", height: "100%", objectFit: "cover" }} />
            ) : (
              <span style={{ font: `700 1.8rem/1 ${sy}`, color: "#fff", letterSpacing: "-0.02em" }}>{initials}</span>
            )}
            {avatarUploading && (
              <div style={{ position: "absolute", inset: 0, background: "rgba(0,0,0,0.65)", display: "flex", alignItems: "center", justifyContent: "center" }}>
                <div style={{ width: 20, height: 20, borderRadius: "50%", border: "2px solid rgba(255,255,255,0.2)", borderTopColor: "#fff", animation: "spin 0.8s linear infinite" }} />
              </div>
            )}
          </div>
          <button
            onClick={() => avatarInputRef.current?.click()}
            style={{
              position: "absolute", bottom: 0, right: 0,
              width: 28, height: 28, borderRadius: "50%",
              background: "#F97316", border: "2.5px solid #0D1117",
              display: "flex", alignItems: "center", justifyContent: "center",
              cursor: "pointer",
            }}
          >
            <Camera size={13} color="#fff" />
          </button>
        </div>

        {/* Name + badges */}
        <div style={{ textAlign: "center", display: "flex", flexDirection: "column", gap: 10, alignItems: "center" }}>
          <h2 style={{ font: `700 1.7rem/1 ${sy}`, color: "#FFFFFF", letterSpacing: "-0.04em", margin: 0 }}>
            {session.full_name}
          </h2>
          <div style={{ display: "flex", gap: 6, justifyContent: "center", flexWrap: "wrap" }}>
            <span style={{
              font: `600 0.62rem/1 ${dm}`,
              color: isActivo ? "#F97316" : "#EF4444",
              background: isActivo ? "rgba(249,115,22,0.1)" : "rgba(239,68,68,0.1)",
              border: `1px solid ${isActivo ? "rgba(249,115,22,0.25)" : "rgba(239,68,68,0.25)"}`,
              padding: "5px 11px", borderRadius: 9999, letterSpacing: "0.07em", textTransform: "uppercase",
            }}>
              {isActivo ? "Activo" : "Vencido"}
            </span>
            {session.plan && (
              <span style={{
                font: `400 0.65rem/1 ${dm}`, color: "rgba(255,255,255,0.4)",
                border: "1px solid rgba(255,255,255,0.1)", padding: "5px 11px", borderRadius: 9999,
              }}>
                {session.plan}
              </span>
            )}
          </div>
          {session.expiration && (
            <p style={{ font: `400 0.72rem/1 ${fm}`, color: "rgba(255,255,255,0.28)", margin: 0, letterSpacing: "0.04em" }}>
              Vence: {formatExpiration(session.expiration)}
            </p>
          )}
        </div>
      </div>

      {/* ── CARD: Mis datos ─────────────────────────────────────── */}
      <div style={{ ...gc, padding: "20px" }}>
        <p style={{ font: `600 0.65rem/1 ${dm}`, color: "rgba(255,255,255,0.3)", letterSpacing: "0.1em", textTransform: "uppercase", marginBottom: 18 }}>Mis datos</p>
        <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
          <DataRow
            icon={<Mail size={14} color="rgba(255,255,255,0.4)" />}
            label="Email"
            value={session.email ?? "—"}
          />
          <DataRow
            icon={<Phone size={14} color="rgba(255,255,255,0.4)" />}
            label="Teléfono"
            value={session.phone ? (session.phone.startsWith("+") ? session.phone : `+${session.phone}`) : "—"}
            mono
          />
          <DataRow
            icon={<CreditCard size={14} color="rgba(255,255,255,0.4)" />}
            label="DNI"
            value={session.dni ? `···${session.dni.slice(-4)}` : "—"}
            mono
          />
        </div>
      </div>

      {/* ── CARD: Mi progreso ───────────────────────────────────── */}
      <div style={{ ...gc, padding: "20px" }}>
        <p style={{ font: `600 0.65rem/1 ${dm}`, color: "rgba(255,255,255,0.3)", letterSpacing: "0.1em", textTransform: "uppercase", marginBottom: 18 }}>Mi progreso</p>

        {/* Upload + toggle privada */}
        <div style={{ display: "flex", gap: 10, alignItems: "center", marginBottom: 18 }}>
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
          <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 4 }}>
            <button
              onClick={() => setNuevaFotoPrivada(!nuevaFotoPrivada)}
              style={{
                width: 40, height: 22, borderRadius: 11,
                background: nuevaFotoPrivada ? "#F97316" : "rgba(255,255,255,0.12)",
                border: "none", cursor: "pointer", position: "relative", transition: "background 0.2s", flexShrink: 0,
              }}
            >
              <div style={{
                position: "absolute", top: 3,
                left: nuevaFotoPrivada ? 21 : 3,
                width: 16, height: 16, borderRadius: "50%", background: "#fff",
                transition: "left 0.2s",
              }} />
            </button>
            <span style={{ font: `400 0.52rem/1 ${dm}`, color: "rgba(255,255,255,0.28)", letterSpacing: "0.04em" }}>
              {nuevaFotoPrivada ? "PRIVADA" : "PÚBLICA"}
            </span>
          </div>
        </div>

        {/* Photos grid */}
        {fotosLoading ? (
          <div style={{ textAlign: "center", padding: "20px 0" }}>
            <div style={{ width: 20, height: 20, borderRadius: "50%", border: "2px solid rgba(255,255,255,0.08)", borderTopColor: "rgba(255,255,255,0.5)", margin: "0 auto", animation: "spin 0.8s linear infinite" }} />
          </div>
        ) : fotos.length === 0 ? (
          <div style={{ textAlign: "center", padding: "24px 0", border: "1px dashed rgba(255,255,255,0.08)", borderRadius: 12 }}>
            <p style={{ font: `400 0.78rem/1.6 ${dm}`, color: "rgba(255,255,255,0.22)", margin: 0 }}>
              Subí tu primera foto para<br />trackear tu progreso visual
            </p>
          </div>
        ) : (
          <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 8 }}>
            {fotos.map(f => (
              <div key={f.id}>
                <div style={{ paddingBottom: "100%", borderRadius: 10, overflow: "hidden", background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.08)", position: "relative" }}>
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={f.foto_url} alt="Foto progreso" style={{ position: "absolute", inset: 0, width: "100%", height: "100%", objectFit: "cover" }} />
                </div>
                <p style={{ font: `400 0.58rem/1 ${fm}`, color: "rgba(255,255,255,0.3)", textAlign: "center", margin: "5px 0 4px", letterSpacing: "0.02em" }}>
                  {new Date(f.fecha + "T00:00:00").toLocaleDateString("es-AR", { day: "numeric", month: "short" })}
                </p>
                <div style={{ display: "flex", gap: 4, justifyContent: "center" }}>
                  <button
                    onClick={() => handleTogglePrivada(f.id, f.privada)}
                    title={f.privada ? "Privada — click para hacer pública" : "Pública — click para hacer privada"}
                    style={{ background: "rgba(255,255,255,0.06)", border: "1px solid rgba(255,255,255,0.09)", borderRadius: 6, padding: "3px 7px", cursor: "pointer", font: `400 0.6rem/1 ${dm}`, color: "rgba(255,255,255,0.4)" }}
                  >
                    {f.privada ? "🔒" : "👁"}
                  </button>
                  <button
                    onClick={() => handleDeleteFoto(f.id)}
                    style={{ background: "rgba(239,68,68,0.07)", border: "1px solid rgba(239,68,68,0.14)", borderRadius: 6, padding: "3px 7px", cursor: "pointer", font: `500 0.6rem/1 ${dm}`, color: "rgba(239,68,68,0.6)" }}
                  >
                    ✕
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Rutina asignada */}
        {rutina && (
          <div style={{ marginTop: 20, padding: "12px 14px", background: "rgba(249,115,22,0.07)", border: "1px solid rgba(249,115,22,0.15)", borderRadius: 10 }}>
            <p style={{ font: `500 0.6rem/1 ${dm}`, color: "rgba(249,115,22,0.6)", letterSpacing: "0.08em", textTransform: "uppercase", marginBottom: 5 }}>Rutina asignada</p>
            <p style={{ font: `600 0.88rem/1 ${sy}`, color: "#FFFFFF", margin: 0 }}>{rutina.nombre}</p>
          </div>
        )}
      </div>

      {/* ── CARD: Privacidad ────────────────────────────────────── */}
      <div style={{ ...gc, padding: "16px 20px" }}>
        <div style={{ display: "flex", alignItems: "flex-start", gap: 12 }}>
          <Shield size={17} color="rgba(255,255,255,0.35)" style={{ flexShrink: 0, marginTop: 2 }} />
          <div>
            <p style={{ font: `600 0.82rem/1.3 ${dm}`, color: "rgba(255,255,255,0.65)", margin: "0 0 5px" }}>Tus datos están protegidos</p>
            <p style={{ font: `400 0.72rem/1.6 ${dm}`, color: "rgba(255,255,255,0.32)", margin: "0 0 10px" }}>
              Las fotos de progreso son privadas por defecto. Solo vos y el staff del gimnasio pueden verlas.
            </p>
            <a href="/privacidad" style={{ font: `400 0.68rem/1 ${dm}`, color: "rgba(255,255,255,0.22)", textDecoration: "underline", textUnderlineOffset: 3 }}>
              Política de privacidad
            </a>
          </div>
        </div>
      </div>

      {/* ── CARD: Recomendá ─────────────────────────────────────── */}
      <div style={{ ...gc, padding: "20px", background: "linear-gradient(135deg, rgba(249,115,22,0.1) 0%, rgba(255,255,255,0.04) 100%)", borderColor: "rgba(249,115,22,0.14)" }}>
        <p style={{ font: `600 0.88rem/1.4 ${dm}`, color: "rgba(255,255,255,0.82)", margin: "0 0 6px" }}>Sumá un ingreso recomendando FitGrowX</p>
        <p style={{ font: `400 0.72rem/1.6 ${dm}`, color: "rgba(255,255,255,0.32)", margin: "0 0 14px" }}>Ganá comisión cada vez que un gimnasio se registra con tu link.</p>
        <a href="/reseller" style={{ display: "inline-block", font: `600 0.78rem/1 ${dm}`, color: "#F97316", textDecoration: "none" }}>
          Conocé el programa →
        </a>
      </div>

      {/* ── Logout ──────────────────────────────────────────────── */}
      <button
        onClick={logout}
        style={{
          width: "100%", padding: "12px 16px",
          background: "rgba(239,68,68,0.07)", border: "1px solid rgba(239,68,68,0.16)",
          borderRadius: 12, font: `600 0.82rem/1 ${dm}`, color: "rgba(239,68,68,0.65)",
          cursor: "pointer", marginBottom: 8,
        }}
      >
        Cerrar sesión
      </button>

      {/* ── Comparador modal (preserved) ────────────────────────── */}
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
