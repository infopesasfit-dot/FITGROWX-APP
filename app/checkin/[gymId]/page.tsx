"use client";

import { useState, useEffect, use } from "react";
import { CheckCircle, XCircle, Loader2 } from "lucide-react";

const fd = "'Inter', sans-serif";

interface GymInfo { gym_name: string | null; logo_url: string | null }
interface CheckinResult {
  ok: boolean;
  already?: boolean;
  alumno?: { full_name: string; status: string; plan?: string | null };
  hora?: string;
  error?: string;
  error_code?: string;
}

function getInitials(name: string) {
  return name.split(" ").slice(0, 2).map(w => w[0] ?? "").join("").toUpperCase();
}

export default function CheckinPublicoPage({ params }: { params: Promise<{ gymId: string }> }) {
  const { gymId } = use(params);

  const [gymInfo, setGymInfo]     = useState<GymInfo | null>(null);
  const [gymLoading, setGymLoading] = useState(true);
  const [gymError, setGymError]   = useState(false);
  const [dni, setDni]             = useState("");
  const [loading, setLoading]     = useState(false);
  const [result, setResult]       = useState<CheckinResult | null>(null);

  useEffect(() => {
    fetch(`/api/gym/public-info?gym_id=${gymId}`)
      .then(r => r.json())
      .then(d => { if (d.error) { setGymError(true); return; } setGymInfo(d); })
      .catch(() => setGymError(true))
      .finally(() => setGymLoading(false));
  }, [gymId]);

  const handleCheckin = async () => {
    if (!dni.trim() || loading) return;
    setLoading(true);
    setResult(null);
    const res = await fetch("/api/alumno/checkin-publico", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ gym_id: gymId, dni: dni.trim() }),
    });
    const data: CheckinResult = await res.json();
    setResult(data);
    setLoading(false);
  };

  const handleReset = () => { setResult(null); setDni(""); };

  if (gymLoading) {
    return (
      <div style={{ minHeight: "100dvh", display: "flex", alignItems: "center", justifyContent: "center", background: "#0D0D14" }}>
        <Loader2 size={32} color="rgba(255,255,255,0.3)" style={{ animation: "spin 1s linear infinite" }} />
        <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
      </div>
    );
  }

  if (gymError) {
    return (
      <div style={{ minHeight: "100dvh", display: "flex", alignItems: "center", justifyContent: "center", background: "#0D0D14", padding: 24 }}>
        <div style={{ textAlign: "center" }}>
          <p style={{ font: `700 1.1rem/1 ${fd}`, color: "white", marginBottom: 8 }}>Gimnasio no encontrado</p>
          <p style={{ font: `400 0.82rem/1.4 ${fd}`, color: "rgba(255,255,255,0.35)" }}>El enlace puede estar desactualizado. Pedile al staff un nuevo código QR.</p>
        </div>
      </div>
    );
  }

  const gymName = gymInfo?.gym_name ?? "Tu Gimnasio";

  return (
    <>
      <style>{`
        @keyframes spin { to { transform: rotate(360deg); } }
        @keyframes slideUp { from { opacity: 0; transform: translateY(20px); } to { opacity: 1; transform: translateY(0); } }
        * { box-sizing: border-box; margin: 0; padding: 0; }
        body { background: #0D0D14; }
        input:focus { outline: 2px solid rgba(249,115,22,0.5); outline-offset: 0; }
      `}</style>

      <div style={{ minHeight: "100dvh", background: "#0D0D14", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", padding: "32px 20px", fontFamily: fd }}>
        <div style={{ width: "100%", maxWidth: 400, display: "flex", flexDirection: "column", gap: 28, animation: "slideUp 0.4s ease" }}>

          {/* Gym header */}
          <div style={{ textAlign: "center" }}>
            {gymInfo?.logo_url ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={gymInfo.logo_url} alt={gymName} style={{ width: 64, height: 64, objectFit: "contain", borderRadius: 18, marginBottom: 14, border: "1px solid rgba(255,255,255,0.08)" }} />
            ) : (
              <div style={{ width: 64, height: 64, borderRadius: 18, background: "rgba(249,115,22,0.12)", border: "1px solid rgba(249,115,22,0.2)", display: "flex", alignItems: "center", justifyContent: "center", margin: "0 auto 14px" }}>
                <span style={{ font: `800 1.4rem/1 ${fd}`, color: "#F97316" }}>{getInitials(gymName)}</span>
              </div>
            )}
            <h1 style={{ font: `800 1.45rem/1.1 ${fd}`, color: "white", letterSpacing: "-0.03em", marginBottom: 6 }}>{gymName}</h1>
            <p style={{ font: `400 0.82rem/1 ${fd}`, color: "rgba(255,255,255,0.35)" }}>Registro de asistencia</p>
          </div>

          {/* Form or Result */}
          {!result ? (
            <div style={{ background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.07)", borderRadius: 20, padding: 24, display: "flex", flexDirection: "column", gap: 18 }}>
              <div>
                <p style={{ font: `700 1rem/1 ${fd}`, color: "white", marginBottom: 6 }}>Ingresá tu DNI</p>
                <p style={{ font: `400 0.78rem/1.45 ${fd}`, color: "rgba(255,255,255,0.35)" }}>Sin puntos ni espacios. Tu asistencia se registra al instante.</p>
              </div>

              <input
                type="number"
                inputMode="numeric"
                pattern="[0-9]*"
                placeholder="Ej: 38492100"
                value={dni}
                onChange={e => setDni(e.target.value.replace(/\D/g, ""))}
                onKeyDown={e => e.key === "Enter" && handleCheckin()}
                style={{
                  width: "100%",
                  padding: "14px 16px",
                  background: "rgba(255,255,255,0.06)",
                  border: "1px solid rgba(255,255,255,0.10)",
                  borderRadius: 14,
                  font: `500 1.15rem/1 ${fd}`,
                  color: "white",
                  letterSpacing: "0.05em",
                }}
              />

              <button
                onClick={handleCheckin}
                disabled={!dni.trim() || loading}
                style={{
                  width: "100%",
                  padding: "15px 0",
                  background: !dni.trim() || loading ? "rgba(249,115,22,0.3)" : "linear-gradient(135deg, #F97316 0%, #EA580C 100%)",
                  color: "white",
                  border: "none",
                  borderRadius: 14,
                  font: `800 0.95rem/1 ${fd}`,
                  cursor: !dni.trim() || loading ? "not-allowed" : "pointer",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  gap: 10,
                  transition: "opacity 0.15s",
                }}
              >
                {loading ? (
                  <>
                    <Loader2 size={18} style={{ animation: "spin 1s linear infinite" }} />
                    Registrando...
                  </>
                ) : "Registrar asistencia"}
              </button>
            </div>
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
              {result.ok ? (
                <div style={{ background: result.alumno?.status === "activo" ? "rgba(249,115,22,0.08)" : "rgba(220,38,38,0.08)", border: `1px solid ${result.alumno?.status === "activo" ? "rgba(249,115,22,0.2)" : "rgba(220,38,38,0.2)"}`, borderRadius: 20, padding: 28, display: "flex", flexDirection: "column", alignItems: "center", gap: 14, textAlign: "center" }}>
                  <CheckCircle size={52} color="#F97316" strokeWidth={1.5} />
                  <div>
                    <p style={{ font: `900 1.5rem/1.1 ${fd}`, color: "white", letterSpacing: "-0.03em", marginBottom: 6 }}>
                      {result.already ? "Ya registrado hoy" : "¡Asistencia registrada!"}
                    </p>
                    <p style={{ font: `600 1rem/1 ${fd}`, color: "rgba(255,255,255,0.7)" }}>
                      {result.alumno?.full_name}
                    </p>
                    {result.hora && (
                      <p style={{ font: `400 0.76rem/1 ${fd}`, color: "rgba(255,255,255,0.3)", marginTop: 8 }}>
                        {result.hora.slice(0, 5)}h
                      </p>
                    )}
                  </div>
                </div>
              ) : (
                <div style={{ background: "rgba(220,38,38,0.06)", border: "1px solid rgba(220,38,38,0.18)", borderRadius: 20, padding: 28, display: "flex", flexDirection: "column", alignItems: "center", gap: 14, textAlign: "center" }}>
                  <XCircle size={52} color="#DC2626" strokeWidth={1.5} />
                  <div>
                    <p style={{ font: `800 1.1rem/1.2 ${fd}`, color: "white", marginBottom: 8 }}>
                      {result.error_code === "membership_expired" ? "Membresía vencida"
                        : result.error_code === "membership_inactive" ? "Membresía inactiva"
                        : "No encontrado"}
                    </p>
                    <p style={{ font: `400 0.82rem/1.5 ${fd}`, color: "rgba(255,255,255,0.45)" }}>
                      {result.error}
                    </p>
                    {result.alumno?.full_name && (
                      <p style={{ font: `600 0.84rem/1 ${fd}`, color: "rgba(255,255,255,0.6)", marginTop: 10 }}>
                        {result.alumno.full_name}
                      </p>
                    )}
                  </div>
                </div>
              )}

              <button
                onClick={handleReset}
                style={{ width: "100%", padding: "13px 0", background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.07)", borderRadius: 14, font: `600 0.82rem/1 ${fd}`, color: "rgba(255,255,255,0.4)", cursor: "pointer" }}
              >
                Registrar otra asistencia
              </button>
            </div>
          )}

          <p style={{ textAlign: "center", font: `400 0.68rem/1 ${fd}`, color: "rgba(255,255,255,0.12)" }}>
            Powered by FitGrowX
          </p>
        </div>
      </div>
    </>
  );
}
