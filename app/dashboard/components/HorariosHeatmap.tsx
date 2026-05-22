interface HorariosHeatmapProps {
  asistHoras: number[];
  isDesktop: boolean;
}

const accentDeep = "#E65A00";
const orangeGlow = "rgba(255,122,24,0.4)";

export function HorariosHeatmap({ asistHoras, isDesktop }: HorariosHeatmapProps) {
  const peakH = asistHoras.indexOf(Math.max(...asistHoras));

  return (
    <div className="dashboard-card" style={{ padding: isDesktop ? "20px" : "16px" }}>
      <p style={{
        font: `800 ${isDesktop ? "0.95rem" : "0.9rem"}/1 var(--font-family-display, 'Inter', sans-serif)`,
        color: "var(--color-text-1, #1A1D23)",
        marginBottom: 4,
      }}>
        Cuándo viene la gente
      </p>
      <p style={{
        font: `500 0.7rem/1.45 var(--font-family-display, 'Inter', sans-serif)`,
        color: "var(--color-text-3, #9CA3AF)",
        marginBottom: 16,
      }}>
        El horario con más movimiento.
      </p>
      <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
        {[6, 7, 8, 9, 10, 17, 18, 19, 20, 21, 22].map((h) => {
          const count = asistHoras[h] ?? 0;
          const pct = asistHoras[peakH] > 0 ? (count / asistHoras[peakH]) * 100 : 0;
          const isPeak = h === peakH && count > 0;
          return (
            <div key={h} style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <span style={{
                width: 28,
                flexShrink: 0,
                textAlign: "right",
                font: `600 0.62rem/1 var(--font-family-body, 'Inter', sans-serif)`,
                color: "var(--color-text-3, #9CA3AF)",
              }}>
                {h}h
              </span>
              <div style={{
                flex: 1,
                height: 7,
                background: "#EDF1F5",
                borderRadius: 9999,
                overflow: "hidden",
              }}>
                <div style={{
                  width: `${pct}%`,
                  height: "100%",
                  background: isPeak ? orangeGlow : "#17181B",
                  borderRadius: 9999,
                }} />
              </div>
              <span style={{
                width: 16,
                flexShrink: 0,
                font: `700 0.62rem/1 var(--font-family-display, 'Inter', sans-serif)`,
                color: isPeak ? accentDeep : "var(--color-text-2, #6B7280)",
              }}>
                {count}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}
