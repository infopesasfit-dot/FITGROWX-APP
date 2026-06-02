"use client";

import { useState, useEffect } from "react";
import { Dumbbell } from "lucide-react";

const fd = "'Inter', sans-serif";
const fm = "var(--font-mono, 'JetBrains Mono', monospace)";

const gc = {
  background: "rgba(255,255,255,0.04)",
  backdropFilter: "blur(20px)",
  WebkitBackdropFilter: "blur(20px)",
  border: "1px solid rgba(255,255,255,0.08)",
  borderRadius: 16,
};

const rowCard = {
  background: "rgba(0,0,0,0.4)",
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

export interface Medida {
  id: string;
  peso_kg: number;
  grasa_pct: number | null;
  musculo_pct: number | null;
  cintura_cm: number | null;
  cadera_cm: number | null;
  brazo_cm: number | null;
  pierna_cm: number | null;
  fecha: string;
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
  // medidas
  medidas: Medida[];
  medidasLoading: boolean;
  onAddMedida: (m: Medida) => void;
  showToast: (msg: string, ok?: boolean) => void;
  alumnoId: string;
  gymId: string;
}

function fmtDate(iso: string) {
  const d = new Date(iso + "T00:00:00");
  return `${String(d.getDate()).padStart(2, "0")}/${String(d.getMonth() + 1).padStart(2, "0")}/${d.getFullYear()}`;
}

const inputSt: React.CSSProperties = {
  flex: 1, padding: "9px 12px",
  background: "rgba(255,255,255,0.06)",
  border: "1px solid rgba(255,255,255,0.10)",
  borderRadius: 10,
  font: `400 0.88rem/1 ${fm}`,
  color: "#FFFFFF", outline: "none",
  minWidth: 0,
};

function MedidasSection({ medidas, medidasLoading, onAddMedida, showToast, alumnoId, gymId }: {
  medidas: Medida[];
  medidasLoading: boolean;
  onAddMedida: (m: Medida) => void;
  showToast: (msg: string, ok?: boolean) => void;
  alumnoId: string;
  gymId: string;
}) {
  const [peso,    setPeso]    = useState("");
  const [grasa,   setGrasa]   = useState("");
  const [musculo, setMusculo] = useState("");
  const [cintura, setCintura] = useState("");
  const [cadera,  setCadera]  = useState("");
  const [brazo,   setBrazo]   = useState("");
  const [pierna,  setPierna]  = useState("");
  const [saving,  setSaving]  = useState(false);
  const [open,    setOpen]    = useState(false);

  const latest = medidas[0] ?? null;

  const handleSave = async () => {
    if (!peso.trim()) { showToast("Ingresá el peso.", false); return; }
    const pesoNum = parseFloat(peso);
    if (isNaN(pesoNum) || pesoNum < 20 || pesoNum > 300) { showToast("Peso inválido (20–300 kg).", false); return; }
    setSaving(true);
    try {
      const body: Record<string, unknown> = { alumno_id: alumnoId, gym_id: gymId, peso_kg: pesoNum };
      if (grasa.trim())   body.grasa_pct   = parseFloat(grasa);
      if (musculo.trim()) body.musculo_pct = parseFloat(musculo);
      if (cintura.trim()) body.cintura_cm  = parseFloat(cintura);
      if (cadera.trim())  body.cadera_cm   = parseFloat(cadera);
      if (brazo.trim())   body.brazo_cm    = parseFloat(brazo);
      if (pierna.trim())  body.pierna_cm   = parseFloat(pierna);
      const res = await fetch("/api/alumno/medidas", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify(body),
      });
      const d = await res.json();
      if (d.ok && d.medida) {
        onAddMedida(d.medida as Medida);
        setPeso(""); setGrasa(""); setMusculo(""); setCintura(""); setCadera(""); setBrazo(""); setPierna("");
        setOpen(false);
        showToast("Medida registrada");
      } else {
        showToast(d.error ?? "Error al registrar.", false);
      }
    } catch {
      showToast("Error de conexión.", false);
    }
    setSaving(false);
  };

  const metricRow = (label: string, val: number | null, unit: string) =>
    val != null ? (
      <div style={{ display: "flex", flexDirection: "column", gap: 2, minWidth: 0 }}>
        <p style={{ font: `400 0.56rem/1 ${fd}`, color: "rgba(255,255,255,0.28)", textTransform: "uppercase", letterSpacing: "0.08em", margin: 0 }}>{label}</p>
        <p style={{ font: `600 0.88rem/1 ${fm}`, color: "#FFFFFF", margin: 0 }}>{val}{unit}</p>
      </div>
    ) : null;

  return (
    <div style={{ ...rowCard, padding: "18px 16px", display: "flex", flexDirection: "column", gap: 16 }}>
      {/* Header */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
        <p style={{ font: `600 0.65rem/1 ${fd}`, color: "rgba(255,255,255,0.3)", letterSpacing: "0.1em", textTransform: "uppercase", margin: 0 }}>Mis medidas</p>
        <button
          onClick={() => setOpen(p => !p)}
          style={{ padding: "5px 12px", borderRadius: 9999, border: "1px solid rgba(249,115,22,0.3)", background: "rgba(249,115,22,0.08)", font: `600 0.72rem/1 ${fd}`, color: "#F97316", cursor: "pointer" }}
        >
          {open ? "Cancelar" : "+ Registrar"}
        </button>
      </div>

      {/* Latest medida */}
      {medidasLoading ? (
        <div style={{ display: "flex", justifyContent: "center", padding: "8px 0" }}>
          <div style={{ width: 18, height: 18, borderRadius: "50%", border: "2px solid rgba(255,255,255,0.08)", borderTopColor: "rgba(255,255,255,0.4)", animation: "spin 0.8s linear infinite" }} />
        </div>
      ) : latest ? (
        <div style={{ display: "flex", flexWrap: "wrap", gap: 16 }}>
          <div style={{ display: "flex", flexDirection: "column", gap: 2 }}>
            <p style={{ font: `400 0.56rem/1 ${fd}`, color: "rgba(255,255,255,0.28)", textTransform: "uppercase", letterSpacing: "0.08em", margin: 0 }}>Fecha</p>
            <p style={{ font: `500 0.72rem/1 ${fm}`, color: "rgba(255,255,255,0.45)", margin: 0 }}>{fmtDate(latest.fecha)}</p>
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: 2 }}>
            <p style={{ font: `400 0.56rem/1 ${fd}`, color: "rgba(255,255,255,0.28)", textTransform: "uppercase", letterSpacing: "0.08em", margin: 0 }}>Peso</p>
            <p style={{ font: `600 1.1rem/1 ${fm}`, color: "#FFFFFF", margin: 0 }}>{latest.peso_kg} <span style={{ font: `400 0.7rem/1 ${fd}`, color: "rgba(255,255,255,0.35)" }}>kg</span></p>
          </div>
          {metricRow("Grasa", latest.grasa_pct, "%")}
          {metricRow("Músculo", latest.musculo_pct, "%")}
          {metricRow("Cintura", latest.cintura_cm, "cm")}
          {metricRow("Cadera", latest.cadera_cm, "cm")}
          {metricRow("Brazo", latest.brazo_cm, "cm")}
          {metricRow("Pierna", latest.pierna_cm, "cm")}
        </div>
      ) : (
        <p style={{ font: `400 0.75rem/1 ${fd}`, color: "rgba(255,255,255,0.22)", margin: 0 }}>Sin medidas registradas aún.</p>
      )}

      {/* Form */}
      {open && (
        <div style={{ display: "flex", flexDirection: "column", gap: 10, borderTop: "1px solid rgba(255,255,255,0.06)", paddingTop: 14 }}>
          {/* Peso obligatorio */}
          <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
            <span style={{ font: `500 0.65rem/1 ${fd}`, color: "rgba(255,255,255,0.4)", width: 80, flexShrink: 0 }}>Peso kg *</span>
            <input style={inputSt} type="number" inputMode="decimal" placeholder="70.5" value={peso} onChange={e => setPeso(e.target.value)} />
          </div>
          {/* Opcionales en grid 2 cols */}
          {([
            ["Grasa %",    grasa,   setGrasa],
            ["Músculo %",  musculo, setMusculo],
            ["Cintura cm", cintura, setCintura],
            ["Cadera cm",  cadera,  setCadera],
            ["Brazo cm",   brazo,   setBrazo],
            ["Pierna cm",  pierna,  setPierna],
          ] as [string, string, React.Dispatch<React.SetStateAction<string>>][]).map(([label, val, set]) => (
            <div key={label} style={{ display: "flex", gap: 8, alignItems: "center" }}>
              <span style={{ font: `400 0.65rem/1 ${fd}`, color: "rgba(255,255,255,0.3)", width: 80, flexShrink: 0 }}>{label}</span>
              <input style={inputSt} type="number" inputMode="decimal" placeholder="—" value={val} onChange={e => set(e.target.value)} />
            </div>
          ))}
          <button
            onClick={handleSave}
            disabled={saving || !peso.trim()}
            style={{
              marginTop: 4, padding: "12px 0",
              background: saving || !peso.trim() ? "rgba(255,255,255,0.07)" : "linear-gradient(135deg,#F97316,#EA580C)",
              border: "none", borderRadius: 12,
              font: `600 0.85rem/1 ${fd}`, color: saving || !peso.trim() ? "rgba(255,255,255,0.3)" : "#fff",
              cursor: saving || !peso.trim() ? "not-allowed" : "pointer",
            }}
          >
            {saving ? "Registrando…" : "Registrar medida"}
          </button>
        </div>
      )}

      {/* Historial últimas 5 */}
      {!medidasLoading && medidas.length > 1 && (
        <div style={{ borderTop: "1px solid rgba(255,255,255,0.06)", paddingTop: 14, display: "flex", flexDirection: "column", gap: 0 }}>
          <p style={{ font: `500 0.6rem/1 ${fd}`, color: "rgba(255,255,255,0.25)", letterSpacing: "0.1em", textTransform: "uppercase", marginBottom: 10 }}>Historial</p>
          {medidas.slice(0, 5).map((m, i) => (
            <div key={m.id} style={{ display: "flex", alignItems: "center", gap: 12, padding: "9px 0", borderBottom: i < Math.min(medidas.length, 5) - 1 ? "1px solid rgba(255,255,255,0.05)" : "none" }}>
              <span style={{ font: `400 0.68rem/1 ${fm}`, color: "rgba(255,255,255,0.35)", flexShrink: 0, letterSpacing: "0.02em", width: 70 }}>{fmtDate(m.fecha)}</span>
              <span style={{ font: `600 0.82rem/1 ${fm}`, color: "#FFFFFF" }}>{m.peso_kg} kg</span>
              {m.grasa_pct != null && <span style={{ font: `400 0.68rem/1 ${fd}`, color: "rgba(255,255,255,0.35)" }}>{m.grasa_pct}% grasa</span>}
              {m.musculo_pct != null && <span style={{ font: `400 0.68rem/1 ${fd}`, color: "rgba(255,255,255,0.35)" }}>{m.musculo_pct}% musc.</span>}
            </div>
          ))}
        </div>
      )}
    </div>
  );
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
  medidas,
  medidasLoading,
  onAddMedida,
  showToast,
  alumnoId,
  gymId,
}: PanelTabEntrenamientoProps) {
  const showMedidas = !!(alumnoId && gymId);

  const entrenamientoBlock = rutina ? (
    <>
      <div style={{
        ...(isCompactScreen ? {
          background: "rgba(255,255,255,0.03)",
          border: "1px solid rgba(255,255,255,0.06)",
          borderRadius: 18,
        } : gc),
        padding: isCompactScreen ? "14px 16px" : "16px 18px",
        display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12,
      }}>
        <div>
          <p style={{ font: `400 0.65rem/1 ${fd}`, color: "rgba(255,255,255,0.3)", letterSpacing: "0.08em", textTransform: "uppercase", marginBottom: 6 }}>
            {!!(rutina.ejercicios[0]?._meta) ? "Tu WOD" : "Tu rutina"}
          </p>
          <h2 style={{ font: `700 ${isCompactScreen ? "1.04rem" : "1.2rem"}/1.1 ${fd}`, color: "#FFFFFF", letterSpacing: "-0.02em" }}>{rutina.nombre}</h2>
        </div>
        {!!(rutina.ejercicios[0]?._meta) && rutina.ejercicios[0] ? (
          <div style={{ textAlign: "right" }}>
            <span style={{ padding: "4px 10px", borderRadius: 9999, background: "rgba(99,102,241,0.18)", border: "1px solid rgba(99,102,241,0.25)", font: `700 0.7rem/1 ${fd}`, color: "#818cf8" }}>{rutina.ejercicios[0].modalidad}</span>
            <p style={{ font: `400 0.62rem/1 ${fd}`, color: "rgba(255,255,255,0.25)", marginTop: 4 }}>{rutina.ejercicios[0].time_cap} min</p>
          </div>
        ) : (
          <span style={{ font: `600 0.72rem/1 ${fd}`, color: "rgba(255,255,255,0.4)", flexShrink: 0, background: "rgba(255,255,255,0.04)", padding: "6px 12px", borderRadius: 9999 }}>💪 {(rutina.ejercicios[0]?._meta ? rutina.ejercicios.slice(1) : rutina.ejercicios).length}</span>
        )}
      </div>

      {(rutina.ejercicios[0]?._meta ? rutina.ejercicios.slice(1) : rutina.ejercicios).map((ej, i) => {
        const isWod = !!(rutina.ejercicios[0]?._meta);
        const log = workoutSession?.series_log[ej.nombre];
        const completadas = log?.completadas ?? 0;
        const lastKg = latestPesoByExercise.get(ej.nombre);

        return (
          <div key={i} style={{
            ...(isCompactScreen ? {
              background: "rgba(255,255,255,0.03)",
              border: "1px solid rgba(255,255,255,0.06)",
              borderRadius: 18,
            } : gc),
            padding: isCompactScreen ? "16px 14px" : "15px 16px",
            display: "flex", flexDirection: "column", gap: 14,
          }}>
            <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 8 }}>
              <p style={{ font: `600 ${isCompactScreen ? "1rem" : "0.95rem"}/1.2 ${fd}`, color: "#FFFFFF", margin: 0 }}>{ej.nombre}</p>
              <span style={{ font: `600 0.78rem/1 ${fd}`, color: "rgba(255,255,255,0.3)", flexShrink: 0, background: "rgba(255,255,255,0.04)", padding: "5px 10px", borderRadius: 9999 }}>
                {isWod ? ej.reps : `${ej.series}×${ej.repeticiones}`}
              </span>
            </div>

            {!isWod && ej.series > 0 && (
              <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                {Array(ej.series).fill(0).map((_, si) => {
                  const done = si < completadas;
                  return (
                    <button key={si} onClick={() => { markSerie(ej.nombre, si); if (!done) startRest(60); }}
                      style={{ width: 36, height: 36, borderRadius: 10, background: done ? "#F97316" : "rgba(255,255,255,0.06)", border: `1px solid ${done ? "#F97316" : "rgba(255,255,255,0.12)"}`, display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer", transition: "background 0.15s, border-color 0.15s", font: `700 0.72rem/1 ${fd}`, color: done ? "#fff" : "rgba(255,255,255,0.35)" }}>
                      {done ? "✓" : si + 1}
                    </button>
                  );
                })}
                {completadas > 0 && (
                  <span style={{ font: `400 0.65rem/1 ${fd}`, color: "rgba(255,255,255,0.28)", alignSelf: "center", marginLeft: 2 }}>{completadas}/{ej.series}</span>
                )}
              </div>
            )}

            {!isWod && (
              <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                <div style={{ display: "flex", gap: 8 }}>
                  <input type="number" inputMode="decimal" placeholder="kg" value={inlineKg[ej.nombre] ?? ""} onChange={e => setInlineKg(prev => ({ ...prev, [ej.nombre]: e.target.value }))}
                    style={{ flex: 1, padding: "9px 12px", background: "rgba(255,255,255,0.06)", border: "1px solid rgba(255,255,255,0.10)", borderRadius: 10, font: `400 0.88rem/1 ${fd}`, color: "#FFFFFF", outline: "none" }} />
                  <button onClick={() => handleInlineKgSave(ej.nombre)} disabled={inlineSaving[ej.nombre] || !inlineKg[ej.nombre]?.trim()}
                    style={{ padding: "9px 16px", borderRadius: 10, border: "none", background: inlineSaving[ej.nombre] || !inlineKg[ej.nombre]?.trim() ? "rgba(255,255,255,0.07)" : "rgba(249,115,22,0.85)", color: inlineSaving[ej.nombre] || !inlineKg[ej.nombre]?.trim() ? "rgba(255,255,255,0.3)" : "#fff", font: `600 0.8rem/1 ${fd}`, cursor: inlineSaving[ej.nombre] || !inlineKg[ej.nombre]?.trim() ? "not-allowed" : "pointer", whiteSpace: "nowrap" }}>
                    {inlineSaving[ej.nombre] ? "…" : "Guardar"}
                  </button>
                </div>
                {lastKg && <p style={{ font: `400 0.65rem/1 ${fd}`, color: "rgba(255,255,255,0.28)", margin: 0 }}>Último: {lastKg.peso} kg</p>}
              </div>
            )}
          </div>
        );
      })}

      {workoutSession && !workoutSession.completada && (
        <button onClick={handleFinalize} disabled={wsSyncing} style={{ width: "100%", minHeight: 52, background: "linear-gradient(135deg,#F97316 0%,#EA580C 100%)", border: "none", borderRadius: 16, font: `700 0.9rem/1 ${fd}`, color: "#FFFFFF", cursor: wsSyncing ? "not-allowed" : "pointer", opacity: wsSyncing ? 0.6 : 1 }}>
          {wsSyncing ? "Guardando..." : "Finalizar entrenamiento"}
        </button>
      )}
    </>
  ) : (
    <div style={{ ...gc, padding: "48px 24px", textAlign: "center" }}>
      <Dumbbell size={28} color="rgba(255,255,255,0.15)" strokeWidth={1.5} style={{ margin: "0 auto 16px" }} />
      <p style={{ font: `600 0.95rem/1 ${fd}`, color: "#FFFFFF", marginBottom: 6 }}>Sin rutina asignada</p>
      <p style={{ font: `400 0.78rem/1.5 ${fd}`, color: "rgba(255,255,255,0.3)" }}>Tu entrenador aun no configuro tu rutina.</p>
    </div>
  );

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: isCompactScreen ? 12 : 10, animation: "fadeUp 0.22s ease" }}>
      {entrenamientoBlock}
      {showMedidas && (
        <MedidasSection
          medidas={medidas}
          medidasLoading={medidasLoading}
          onAddMedida={onAddMedida}
          showToast={showToast}
          alumnoId={alumnoId}
          gymId={gymId}
        />
      )}
    </div>
  );
}
