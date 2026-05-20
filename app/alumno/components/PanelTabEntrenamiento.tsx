"use client";

import { Dumbbell } from "lucide-react";

const fd = "'Inter', sans-serif";

const gc = {
  background: "rgba(255,255,255,0.04)",
  backdropFilter: "blur(20px)",
  WebkitBackdropFilter: "blur(20px)",
  border: "1px solid rgba(255,255,255,0.08)",
  borderRadius: 16,
};

interface Ejercicio {
  nombre: string;
  series: number;
  repeticiones: number;
  peso_sugerido: string;
  _meta?: boolean;
  modalidad?: string;
  time_cap?: string;
  reps?: string;
}

interface Peso { id: string; ejercicio: string; peso: number; fecha: string; notas: string | null; }
interface WorkoutSession {
  rutina_nombre: string;
  series_log: Record<string, { completadas: number; total: number; kg_usado: number | null }>;
  completada: boolean;
  offline: boolean;
  inicio: string;
}

interface PanelTabEntrenamientoProps {
  rutina: { nombre: string; ejercicios: Ejercicio[] } | null;
  workoutSession: WorkoutSession | null;
  wsSyncing: boolean;
  isCompactScreen: boolean;
  restSeconds: number | null;
  restTotal: number;
  inlineKg: Record<string, string>;
  inlineSaving: Record<string, boolean>;
  latestPesoByExercise: Map<string, Peso>;
  markSerie: (ejercicio: string, idx: number) => void;
  handleInlineKgSave: (ejercicio: string) => void;
  setInlineKg: (fn: (prev: Record<string, string>) => Record<string, string>) => void;
  startRest: (seconds: number) => void;
  handleFinalize: () => void;
}

export function PanelTabEntrenamiento({
  rutina,
  workoutSession,
  wsSyncing,
  isCompactScreen,
  restSeconds,
  restTotal,
  inlineKg,
  inlineSaving,
  latestPesoByExercise,
  markSerie,
  handleInlineKgSave,
  setInlineKg,
  startRest,
  handleFinalize,
}: PanelTabEntrenamientoProps) {
  if (!rutina) {
    return (
      <div style={{ display: "flex", flexDirection: "column", gap: isCompactScreen ? 10 : 8, animation: "fadeUp 0.22s ease" }}>
        <div style={{ ...gc, padding: "48px 24px", textAlign: "center" }}>
          <Dumbbell size={28} color="rgba(255,255,255,0.15)" strokeWidth={1.5} style={{ margin: "0 auto 16px" }} />
          <p style={{ font: `600 0.95rem/1 ${fd}`, color: "#FFFFFF", marginBottom: 6 }}>Sin rutina asignada</p>
          <p style={{ font: `400 0.78rem/1.5 ${fd}`, color: "rgba(255,255,255,0.3)" }}>Tu entrenador aun no configuro tu rutina.</p>
        </div>
      </div>
    );
  }

  const isWod = !!(rutina.ejercicios[0]?._meta);
  const wodMeta = isWod ? rutina.ejercicios[0] : null;
  const items = isWod ? rutina.ejercicios.slice(1) : rutina.ejercicios;

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: isCompactScreen ? 12 : 10, animation: "fadeUp 0.22s ease" }}>
      <div style={{
        ...(isCompactScreen ? {
          background: "rgba(255,255,255,0.03)",
          border: "1px solid rgba(255,255,255,0.06)",
          borderRadius: 18,
        } : gc),
        padding: isCompactScreen ? "14px 16px" : "16px 18px",
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        gap: 12,
      }}>
        <div>
          <p style={{ font: `400 0.65rem/1 ${fd}`, color: "rgba(255,255,255,0.3)", letterSpacing: "0.08em", textTransform: "uppercase", marginBottom: 6 }}>
            {isWod ? "Tu WOD" : "Tu rutina"}
          </p>
          <h2 style={{ font: `700 ${isCompactScreen ? "1.04rem" : "1.2rem"}/1.1 ${fd}`, color: "#FFFFFF", letterSpacing: "-0.02em" }}>{rutina.nombre}</h2>
        </div>
        {isWod && wodMeta ? (
          <div style={{ textAlign: "right" }}>
            <span style={{ padding: "4px 10px", borderRadius: 9999, background: "rgba(99,102,241,0.18)", border: "1px solid rgba(99,102,241,0.25)", font: `700 0.7rem/1 ${fd}`, color: "#818cf8" }}>{wodMeta.modalidad}</span>
            <p style={{ font: `400 0.62rem/1 ${fd}`, color: "rgba(255,255,255,0.25)", marginTop: 4 }}>{wodMeta.time_cap} min</p>
          </div>
        ) : (
          <span style={{ font: `600 0.72rem/1 ${fd}`, color: "rgba(255,255,255,0.4)", flexShrink: 0, background: "rgba(255,255,255,0.04)", padding: "6px 12px", borderRadius: 9999 }}>💪 {items.length}</span>
        )}
      </div>

      {items.map((ej, i) => (
        <div key={i} style={{
          ...(isCompactScreen ? {
            background: "rgba(255,255,255,0.03)",
            border: "1px solid rgba(255,255,255,0.06)",
            borderRadius: 18,
          } : gc),
          padding: isCompactScreen ? "16px 14px" : "15px 16px",
        }}>
          <p style={{ font: `600 ${isCompactScreen ? "1rem" : "0.95rem"}/1.2 ${fd}`, color: "#FFFFFF", marginBottom: 12 }}>
            {ej.nombre}
          </p>
          <span style={{ font: `600 0.8rem/1 ${fd}`, color: "rgba(255,255,255,0.35)", marginTop: 12 }}>
            {isWod ? ej.reps : `${ej.series}x${ej.repeticiones}`}
          </span>
        </div>
      ))}

      {workoutSession && !workoutSession.completada && (
        <button onClick={handleFinalize} disabled={wsSyncing} style={{ width: "100%", minHeight: 52, background: "linear-gradient(135deg,#F97316 0%,#EA580C 100%)", border: "none", borderRadius: 16, font: `700 0.9rem/1 ${fd}`, color: "#FFFFFF", cursor: wsSyncing ? "not-allowed" : "pointer", opacity: wsSyncing ? 0.6 : 1 }}>
          {wsSyncing ? "Guardando..." : "Finalizar entrenamiento"}
        </button>
      )}
    </div>
  );
}
