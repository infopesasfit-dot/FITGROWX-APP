"use client";

import { Calendar } from "lucide-react";

const fd = "'Inter', sans-serif";
const DAYS = ["Dom", "Lun", "Mar", "Mié", "Jue", "Vie", "Sáb"];
const DAYS_FULL = ["Domingo", "Lunes", "Martes", "Miércoles", "Jueves", "Viernes", "Sábado"];

const gc = {
  background: "rgba(255,255,255,0.04)",
  backdropFilter: "blur(20px)",
  WebkitBackdropFilter: "blur(20px)",
  border: "1px solid rgba(255,255,255,0.08)",
  borderRadius: 16,
};

interface GymClass {
  id: string;
  class_name: string;
  day_of_week: number;
  start_time: string;
  max_capacity: number;
  event_type: "regular" | "especial";
  notes: string | null;
  coach_name: string | null;
}

interface Reserva { clase_id: string; fecha: string; }

interface Day { date: Date; label: string; iso: string; dow: number }

interface PanelTabCalendarioProps {
  days7: Day[];
  selectedDayIdx: number;
  setSelectedDayIdx: (idx: number) => void;
  clases: GymClass[];
  reservas: Reserva[];
  countsMap: Record<string, number>;
  misReservas: Array<GymClass & Day>;
  reservando: string | null;
  handleReservar: (clase_id: string, fecha: string) => void;
}

export function PanelTabCalendario({
  days7,
  selectedDayIdx,
  setSelectedDayIdx,
  clases,
  reservas,
  countsMap,
  misReservas,
  reservando,
  handleReservar,
}: PanelTabCalendarioProps) {
  const selectedDay = days7[selectedDayIdx];

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 10, animation: "fadeUp 0.22s ease" }}>
      {/* Weekly day slider */}
      <div style={{ display: "flex", gap: 6, overflowX: "auto", paddingBottom: 4, scrollbarWidth: "none" }}>
        <style>{`.day-scroll::-webkit-scrollbar{display:none}`}</style>
        {days7.map((day, idx) => {
          const active = idx === selectedDayIdx;
          const hasCls = clases.some(c => c.day_of_week === day.dow);
          return (
            <button
              key={day.iso}
              onClick={() => setSelectedDayIdx(idx)}
              className="tap-active"
              style={{ flexShrink: 0, display: "flex", flexDirection: "column", alignItems: "center", gap: 4, padding: "10px 0", width: 52, borderRadius: 14, border: `1.5px solid ${active ? "#F97316" : "rgba(255,255,255,0.07)"}`, background: active ? "rgba(249,115,22,0.12)" : "rgba(255,255,255,0.03)", cursor: "pointer" }}
            >
              <span style={{ font: `500 0.6rem/1 ${fd}`, color: active ? "#F97316" : "rgba(255,255,255,0.3)", letterSpacing: "0.06em", textTransform: "uppercase" }}>
                {day.label === "Hoy" ? "HOY" : DAYS[day.dow].slice(0, 3).toUpperCase()}
              </span>
              <span style={{ font: `700 1.1rem/1 ${fd}`, color: active ? "#FFFFFF" : "rgba(255,255,255,0.45)" }}>
                {day.date.getDate()}
              </span>
              {hasCls && <div style={{ width: 4, height: 4, borderRadius: "50%", background: active ? "#F97316" : "rgba(255,255,255,0.15)" }} />}
            </button>
          );
        })}
      </div>

      {/* Day label */}
      <p style={{ font: `600 0.72rem/1 ${fd}`, color: "rgba(255,255,255,0.3)", letterSpacing: "0.08em", textTransform: "uppercase" }}>
        {selectedDay.label === "Hoy" ? `Hoy · ${DAYS_FULL[selectedDay.dow]}` : `${DAYS_FULL[selectedDay.dow]} ${selectedDay.date.getDate()}`}
      </p>

      {/* Class cards for selected day */}
      {(() => {
        const dayClases = clases.filter(c => c.day_of_week === selectedDay.dow);
        if (dayClases.length === 0) return (
          <div style={{ ...gc, padding: "36px 24px", textAlign: "center" }}>
            <Calendar size={22} color="rgba(255,255,255,0.15)" strokeWidth={1.5} style={{ margin: "0 auto 14px" }} />
            <p style={{ font: `500 0.85rem/1.4 ${fd}`, color: "rgba(255,255,255,0.3)" }}>No hay clases este día.</p>
          </div>
        );
        return (
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            {dayClases.map(c => {
              const reserved = reservas.some(r => r.clase_id === c.id && r.fecha === selectedDay.iso);
              const busy = reservando === `${c.id}|${selectedDay.iso}`;
              const count = countsMap[`${c.id}|${selectedDay.iso}`] ?? 0;
              const isFull = !reserved && count >= c.max_capacity;
              const available = c.max_capacity - count;
              const isEspecial = c.event_type === "especial";
              return (
                <div
                  key={c.id}
                  style={{
                    background: isEspecial ? "rgba(245,158,11,0.06)" : "rgba(255,255,255,0.04)",
                    backdropFilter: "blur(20px)",
                    WebkitBackdropFilter: "blur(20px)",
                    border: `1px solid ${reserved ? "rgba(52,211,153,0.2)" : isEspecial ? "rgba(245,158,11,0.2)" : "rgba(255,255,255,0.07)"}`,
                    borderRadius: 14,
                    padding: "14px 15px",
                  }}
                >
                  <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 10 }}>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ display: "flex", alignItems: "center", gap: 7, marginBottom: 5 }}>
                        <span style={{ font: `400 0.72rem/1 ${fd}`, color: isEspecial ? "rgba(245,158,11,0.7)" : "rgba(255,255,255,0.35)", letterSpacing: "0.04em" }}>{c.start_time.slice(0, 5)}h</span>
                        {isEspecial && (
                          <span style={{ font: `700 0.55rem/1 ${fd}`, color: "#D97706", background: "rgba(245,158,11,0.12)", border: "1px solid rgba(245,158,11,0.25)", padding: "2px 7px", borderRadius: 9999, letterSpacing: "0.06em" }}>ESPECIAL</span>
                        )}
                        {reserved && (
                          <span style={{ font: `600 0.55rem/1 ${fd}`, color: "#34D399", background: "rgba(52,211,153,0.1)", border: "1px solid rgba(52,211,153,0.2)", padding: "2px 7px", borderRadius: 9999, letterSpacing: "0.06em" }}>RESERVADO</span>
                        )}
                      </div>
                      <p style={{ font: `600 1rem/1.1 ${fd}`, color: "#FFFFFF", marginBottom: 4 }}>{c.class_name}</p>
                      <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                        {c.coach_name && (
                          <span style={{ font: `400 0.72rem/1 ${fd}`, color: "rgba(255,255,255,0.35)" }}>{c.coach_name}</span>
                        )}
                        {!reserved && !isFull && (
                          <span style={{ font: `400 0.72rem/1 ${fd}`, color: available <= 3 ? "#F97316" : "rgba(255,255,255,0.25)" }}>
                            {available} cupo{available !== 1 ? "s" : ""}
                          </span>
                        )}
                        {isFull && (
                          <span style={{ font: `500 0.72rem/1 ${fd}`, color: "#EF4444" }}>Sin cupos</span>
                        )}
                      </div>
                      {c.notes && (
                        <p style={{ font: `400 0.7rem/1.45 ${fd}`, color: "rgba(255,255,255,0.25)", marginTop: 6 }}>{c.notes}</p>
                      )}
                    </div>
                    <div style={{ flexShrink: 0 }}>
                      {reserved ? (
                        <button
                          onClick={() => handleReservar(c.id, selectedDay.iso)}
                          disabled={busy}
                          className="tap-active"
                          style={{ padding: "8px 14px", borderRadius: 9, border: "1px solid rgba(239,68,68,0.25)", background: "rgba(239,68,68,0.07)", color: "#EF4444", font: `500 0.72rem/1 ${fd}`, cursor: busy ? "not-allowed" : "pointer", opacity: busy ? 0.5 : 1, whiteSpace: "nowrap" }}
                        >
                          {busy ? "..." : "Cancelar"}
                        </button>
                      ) : isFull ? (
                        <button
                          disabled
                          style={{ padding: "8px 14px", borderRadius: 9, border: "1px solid rgba(255,255,255,0.07)", background: "transparent", color: "rgba(255,255,255,0.2)", font: `500 0.72rem/1 ${fd}`, cursor: "not-allowed", whiteSpace: "nowrap" }}
                        >
                          Lista de espera
                        </button>
                      ) : (
                        <button
                          onClick={() => handleReservar(c.id, selectedDay.iso)}
                          disabled={busy}
                          className="tap-active"
                          style={{ padding: "8px 14px", borderRadius: 9, border: "none", background: isEspecial ? "#D97706" : "#F97316", color: "#FFFFFF", font: `600 0.72rem/1 ${fd}`, cursor: busy ? "not-allowed" : "pointer", opacity: busy ? 0.5 : 1, whiteSpace: "nowrap" }}
                        >
                          {busy ? "..." : "Reservar"}
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        );
      })()}

      {/* My upcoming reservations summary */}
      {misReservas.length > 0 && (
        <div style={{ ...gc, padding: "13px 15px", marginTop: 4 }}>
          <p style={{ font: `500 0.62rem/1 ${fd}`, color: "rgba(255,255,255,0.3)", letterSpacing: "0.1em", textTransform: "uppercase", marginBottom: 10 }}>Mis reservas esta semana</p>
          <div style={{ display: "flex", flexDirection: "column", gap: 7 }}>
            {misReservas.map(c => (
              <div key={`${c.id}|${c.iso}`} style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                <div>
                  <span style={{ font: `500 0.82rem/1 ${fd}`, color: "#FFFFFF" }}>{c.class_name}</span>
                  <span style={{ font: `400 0.7rem/1 ${fd}`, color: "rgba(255,255,255,0.3)", marginLeft: 8 }}>{c.label === "Hoy" ? "Hoy" : c.label} · {c.start_time.slice(0, 5)}h</span>
                </div>
                <button
                  onClick={() => handleReservar(c.id, c.iso)}
                  disabled={reservando === `${c.id}|${c.iso}`}
                  className="tap-active"
                  style={{ padding: "5px 10px", borderRadius: 7, border: "1px solid rgba(239,68,68,0.2)", background: "rgba(239,68,68,0.05)", color: "#EF4444", font: `500 0.65rem/1 ${fd}`, cursor: "pointer", whiteSpace: "nowrap" }}
                >
                  {reservando === `${c.id}|${c.iso}` ? "..." : "Cancelar"}
                </button>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
