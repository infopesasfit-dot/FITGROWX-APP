"use client";

const fd = "'Inter', sans-serif";

const gc = {
  background: "rgba(255,255,255,0.04)",
  backdropFilter: "blur(20px)",
  WebkitBackdropFilter: "blur(20px)",
  border: "1px solid rgba(255,255,255,0.08)",
  borderRadius: 16,
};

interface Medida { id: string; peso_kg: number; grasa_pct: number | null; cintura_cm: number | null; fecha: string; }

interface Ranking { pos: number; name: string; count: number; isMe: boolean }

interface PanelTabMetasProps {
  asistTotal: number;
  asistCount: number;
  medidas: Medida[];
  pesos: Array<{ ejercicio: string }>;
  ranking: Ranking[];
  myRankPos: number;
  rankLoaded: boolean;
}

export function PanelTabMetas({
  asistTotal,
  asistCount,
  medidas,
  pesos,
  ranking,
  myRankPos,
  rankLoaded,
}: PanelTabMetasProps) {
  const BADGES = [
    { emoji: "🥇", title: "Primera visita", desc: "Viniste por primera vez", earned: asistTotal >= 1 },
    { emoji: "⚡", title: "10 visitas", desc: "Acumulaste 10 asistencias", earned: asistTotal >= 10 },
    { emoji: "💪", title: "25 visitas", desc: "Acumulaste 25 asistencias", earned: asistTotal >= 25 },
    { emoji: "🏆", title: "50 visitas", desc: "Acumulaste 50 asistencias", earned: asistTotal >= 50 },
    { emoji: "👑", title: "100 visitas", desc: "Leyenda del gym", earned: asistTotal >= 100 },
    { emoji: "🔥", title: "Activo este mes", desc: "8+ asistencias en el mes", earned: asistCount >= 8 },
    { emoji: "📊", title: "Me mido", desc: "Registraste tus medidas corporales", earned: medidas.length > 0 },
    { emoji: "🎯", title: "Registro de cargas", desc: "Registraste tus pesos en ejercicios", earned: pesos.length > 0 },
  ];

  const earnedCount = BADGES.filter(b => b.earned).length;

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 8, animation: "fadeUp 0.22s ease" }}>
      {/* Insignias */}
      <div style={{ ...gc, padding: "18px 18px" }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 14 }}>
          <p style={{ font: `600 0.85rem/1 ${fd}`, color: "#FFFFFF" }}>Insignias</p>
          <span style={{ font: `500 0.65rem/1 ${fd}`, color: "rgba(255,255,255,0.3)" }}>{earnedCount}/{BADGES.length}</span>
        </div>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 10 }}>
          {BADGES.map(b => (
            <div key={b.title} style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 5, opacity: b.earned ? 1 : 0.22 }}>
              <div style={{ width: 44, height: 44, borderRadius: 14, background: b.earned ? "rgba(249,115,22,0.12)" : "rgba(255,255,255,0.04)", border: `1px solid ${b.earned ? "rgba(249,115,22,0.3)" : "rgba(255,255,255,0.06)"}`, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 20 }}>
                {b.emoji}
              </div>
              <span style={{ font: `500 0.52rem/1.2 ${fd}`, color: b.earned ? "rgba(255,255,255,0.7)" : "rgba(255,255,255,0.3)", textAlign: "center" }}>
                {b.title}
              </span>
            </div>
          ))}
        </div>
      </div>

      {/* Ranking */}
      {(ranking.length > 0 || rankLoaded) && (
        <div style={{ ...gc, padding: "18px 18px" }}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 14 }}>
            <p style={{ font: `600 0.85rem/1 ${fd}`, color: "#FFFFFF" }}>Top del mes</p>
            {myRankPos > 0 && (
              <span style={{ font: `500 0.65rem/1 ${fd}`, color: myRankPos <= 3 ? "#F97316" : "rgba(255,255,255,0.3)" }}>
                #{myRankPos} en tu gym
              </span>
            )}
          </div>
          {ranking.length === 0 ? (
            <p style={{ font: `400 0.72rem/1 ${fd}`, color: "rgba(255,255,255,0.2)", textAlign: "center", padding: "8px 0" }}>
              Nadie registró asistencias este mes aún.
            </p>
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
              {ranking.slice(0, 5).map(r => (
                <div key={r.pos} style={{ display: "flex", alignItems: "center", gap: 10, padding: "8px 10px", borderRadius: 10, background: r.isMe ? "rgba(249,115,22,0.08)" : "rgba(255,255,255,0.02)" }}>
                  <span style={{ font: `700 0.75rem/1 ${fd}`, color: r.pos <= 3 ? ["#FFD700", "#C0C0C0", "#CD7F32"][r.pos - 1] : "rgba(255,255,255,0.2)", width: 18, textAlign: "center" }}>
                    {r.pos <= 3 ? ["🥇", "🥈", "🥉"][r.pos - 1] : `#${r.pos}`}
                  </span>
                  <span style={{ flex: 1, font: `${r.isMe ? "600" : "400"} 0.82rem/1 ${fd}`, color: r.isMe ? "#FFFFFF" : "rgba(255,255,255,0.55)" }}>
                    {r.name}{r.isMe ? " (vos)" : ""}
                  </span>
                  <span style={{ font: `600 0.8rem/1 ${fd}`, color: r.isMe ? "#F97316" : "rgba(255,255,255,0.35)" }}>
                    {r.count}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Peso actual */}
      {medidas.length > 0 && (() => {
        const latest = medidas[0];
        return (
          <div style={{ ...gc, padding: "18px 20px" }}>
            <p style={{ font: `400 0.6rem/1 ${fd}`, color: "rgba(255,255,255,0.3)", letterSpacing: "0.08em", marginBottom: 8 }}>
              Peso actual
            </p>
            <div style={{ display: "flex", alignItems: "baseline", gap: 6 }}>
              <span style={{ font: `700 2.4rem/1 ${fd}`, color: "#FFFFFF" }}>{latest.peso_kg}</span>
              <span style={{ font: `500 0.9rem/1 ${fd}`, color: "rgba(255,255,255,0.3)" }}>kg</span>
            </div>
          </div>
        );
      })()}
    </div>
  );
}
