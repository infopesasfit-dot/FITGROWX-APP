"use client";

import { Eye } from "lucide-react";

const fd = "'Inter', sans-serif";

const gc = {
  background: "rgba(255,255,255,0.04)",
  backdropFilter: "blur(20px)",
  WebkitBackdropFilter: "blur(20px)",
  border: "1px solid rgba(255,255,255,0.08)",
  borderRadius: 16,
};

interface Foto { id: string; foto_url: string; fecha: string; notas: string | null; privada: boolean }
interface Session { alumno_id: string; gym_id: string; full_name: string; status: string; plan: string | null; expiration: string | null; dni: string | null; deuda_pendiente?: number }

interface PanelTabPerfilProps {
  session: Session | null;
  fotos: Foto[];
  fotosLoading: boolean;
  showQR: boolean;
  setShowQR: (show: boolean) => void;
  handleShare: (foto_id: string) => void;
  handleDeleteFoto: (foto_id: string) => void;
  showComparador: () => void;
  logout: () => void;
}

export function PanelTabPerfil({
  session,
  fotos,
  fotosLoading,
  showQR,
  setShowQR,
  handleShare,
  handleDeleteFoto,
  showComparador,
  logout,
}: PanelTabPerfilProps) {
  if (!session) return null;

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 8, animation: "fadeUp 0.22s ease" }}>
      {/* Datos personales */}
      <div style={{ ...gc, padding: "18px 18px" }}>
        <p style={{ font: `600 0.85rem/1 ${fd}`, color: "#FFFFFF", marginBottom: 12 }}>Perfil</p>
        <div style={{ display: "grid", gap: 10 }}>
          <div>
            <p style={{ font: `400 0.65rem/1 ${fd}`, color: "rgba(255,255,255,0.3)", marginBottom: 4 }}>Nombre</p>
            <p style={{ font: `500 0.9rem/1 ${fd}`, color: "#FFFFFF" }}>{session.full_name}</p>
          </div>
          {session.dni && (
            <div>
              <p style={{ font: `400 0.65rem/1 ${fd}`, color: "rgba(255,255,255,0.3)", marginBottom: 4 }}>DNI</p>
              <p style={{ font: `500 0.9rem/1 ${fd}`, color: "#FFFFFF" }}>...{session.dni.slice(-4)}</p>
            </div>
          )}
          {session.plan && (
            <div>
              <p style={{ font: `400 0.65rem/1 ${fd}`, color: "rgba(255,255,255,0.3)", marginBottom: 4 }}>Plan</p>
              <p style={{ font: `500 0.9rem/1 ${fd}`, color: "#FFFFFF" }}>{session.plan}</p>
            </div>
          )}
        </div>
      </div>

      {/* Fotos */}
      {fotosLoading ? (
        <div style={{ ...gc, padding: "24px", textAlign: "center" }}>
          <p style={{ font: `400 0.8rem/1 ${fd}`, color: "rgba(255,255,255,0.3)" }}>Cargando fotos...</p>
        </div>
      ) : fotos.length === 0 ? (
        <div style={{ ...gc, padding: "24px", textAlign: "center" }}>
          <p style={{ font: `400 0.8rem/1 ${fd}`, color: "rgba(255,255,255,0.3)" }}>Sin fotos aún</p>
        </div>
      ) : (
        <div style={{ ...gc, padding: "14px" }}>
          <p style={{ font: `600 0.85rem/1 ${fd}`, color: "#FFFFFF", marginBottom: 12, paddingLeft: 4 }}>Galería</p>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(80px, 1fr))", gap: 8 }}>
            {fotos.map(f => (
              <div
                key={f.id}
                style={{
                  position: "relative",
                  paddingBottom: "100%",
                  borderRadius: 12,
                  overflow: "hidden",
                  background: "rgba(255,255,255,0.05)",
                  border: "1px solid rgba(255,255,255,0.08)",
                }}
              >
                <img
                  src={f.foto_url}
                  alt="Foto"
                  style={{
                    position: "absolute",
                    inset: 0,
                    width: "100%",
                    height: "100%",
                    objectFit: "cover",
                  }}
                />
                {f.privada && (
                  <div style={{ position: "absolute", top: 4, right: 4, background: "rgba(0,0,0,0.6)", padding: "2px 6px", borderRadius: 6, display: "flex", alignItems: "center" }}>
                    <Eye size={10} color="rgba(255,255,255,0.7)" />
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Acciones */}
      <button
        onClick={logout}
        style={{
          width: "100%",
          padding: "12px 16px",
          background: "rgba(239,68,68,0.1)",
          border: "1px solid rgba(239,68,68,0.2)",
          borderRadius: 12,
          font: `600 0.85rem/1 ${fd}`,
          color: "#EF4444",
          cursor: "pointer",
        }}
      >
        Cerrar sesión
      </button>
    </div>
  );
}
