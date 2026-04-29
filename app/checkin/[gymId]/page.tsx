"use client";

import Link from "next/link";
import { useState, useEffect, use } from "react";
import { CheckCircle, XCircle, Loader2 } from "lucide-react";

const fd = "'Inter', sans-serif";

interface GymInfo    { gym_name: string | null; logo_url: string | null }
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

type Phase = "loading" | "auto-checking" | "form" | "result";

export default function CheckinPublicoPage({ params }: { params: Promise<{ gymId: string }> }) {
  const { gymId } = use(params);

  const [gymInfo,  setGymInfo]  = useState<GymInfo | null>(null);
  const [gymError, setGymError] = useState(false);
  const [phase,    setPhase]    = useState<Phase>("loading");
  const [result,   setResult]   = useState<CheckinResult | null>(null);

  // ── 1. Load gym info + try auto check-in ──────────────────────────────────
  useEffect(() => {
    let cancelled = false;

    const run = async () => {
      // Fetch gym info
      const gymRes = await fetch(`/api/gym/public-info?gym_id=${gymId}`).catch(() => null);
      const gymData = gymRes ? await gymRes.json().catch(() => null) : null;
      if (cancelled) return;
      if (!gymData || gymData.error) { setGymError(true); setPhase("form"); return; }
      setGymInfo(gymData);

      // Try auto check-in from localStorage session
      const raw = typeof window !== "undefined" ? localStorage.getItem("fitgrowx_alumno") : null;
      if (!raw) { setPhase("form"); return; }

      let session: { gym_id?: string; token?: string } | null = null;
      try { session = JSON.parse(raw); } catch { setPhase("form"); return; }

      if (!session?.token || session.gym_id !== gymId) { setPhase("form"); return; }

      // Has a valid session for this gym → auto check-in
      setPhase("auto-checking");
      const res = await fetch("/api/alumno/checkin-publico", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${session.token}` },
        body: JSON.stringify({ gym_id: gymId }),
      }).catch(() => null);
      if (cancelled) return;

      if (!res) { setPhase("form"); return; }
      const data: CheckinResult = await res.json().catch(() => null);

      if (!data) { setPhase("form"); return; }

      // If the session is missing or expired, guide the user to login/manual help.
      if (!data.ok && data.error_code === "auth_required") { setPhase("form"); return; }

      setResult(data);
      setPhase("result");
    };

    run();
    return () => { cancelled = true; };
  }, [gymId]);

  const handleReset = () => { setResult(null); setPhase("form"); };

  // ── Gym name ───────────────────────────────────────────────────────────────
  const gymName = gymInfo?.gym_name ?? "Tu Gimnasio";

  // ── Shared styles ──────────────────────────────────────────────────────────
  const page: React.CSSProperties = {
    minHeight: "100dvh",
    background: "#0D0D14",
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
    justifyContent: "center",
    padding: "32px 20px",
    fontFamily: fd,
  };

  const wrap: React.CSSProperties = {
    width: "100%",
    maxWidth: 400,
    display: "flex",
    flexDirection: "column",
    gap: 24,
  };

  // ── Gym header (shared) ────────────────────────────────────────────────────
  const gymHeader = gymInfo ? (
    <div style={{ textAlign: "center" }}>
      {gymInfo.logo_url ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={gymInfo.logo_url} alt={gymName} style={{ width: 64, height: 64, objectFit: "contain", borderRadius: 18, marginBottom: 14, border: "1px solid rgba(255,255,255,0.08)" }} />
      ) : (
        <div style={{ width: 64, height: 64, borderRadius: 18, background: "rgba(249,115,22,0.12)", border: "1px solid rgba(249,115,22,0.2)", display: "flex", alignItems: "center", justifyContent: "center", margin: "0 auto 14px" }}>
          <span style={{ font: `800 1.4rem/1 ${fd}`, color: "#F97316" }}>{getInitials(gymName)}</span>
        </div>
      )}
      <h1 style={{ font: `800 1.4rem/1.1 ${fd}`, color: "white", letterSpacing: "-0.03em", marginBottom: 5 }}>{gymName}</h1>
      <p style={{ font: `400 0.78rem/1 ${fd}`, color: "rgba(255,255,255,0.3)" }}>Registro de asistencia</p>
    </div>
  ) : null;

  const footer = (
    <p style={{ textAlign: "center", font: `400 0.66rem/1 ${fd}`, color: "rgba(255,255,255,0.1)" }}>Powered by FitGrowX</p>
  );

  // ── Loading / auto-checking ────────────────────────────────────────────────
  if (phase === "loading" || phase === "auto-checking") {
    return (
      <>
        <style>{`@keyframes spin { to { transform: rotate(360deg); } } * { box-sizing: border-box; margin: 0; padding: 0; } body { background: #0D0D14; }`}</style>
        <div style={page}>
          <div style={{ ...wrap, alignItems: "center", gap: 20 }}>
            {gymHeader}
            <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 12 }}>
              <Loader2 size={32} color="#F97316" style={{ animation: "spin 1s linear infinite" }} />
              <p style={{ font: `500 0.82rem/1 ${fd}`, color: "rgba(255,255,255,0.35)" }}>
                {phase === "auto-checking" ? "Registrando tu asistencia..." : "Cargando..."}
              </p>
            </div>
            {footer}
          </div>
        </div>
      </>
    );
  }

  // ── Result ─────────────────────────────────────────────────────────────────
  if (phase === "result" && result) {
    const isOk = result.ok;
    const isAlreadyIn = result.ok && result.already;
    const isMembership = result.error_code === "membership_expired" || result.error_code === "membership_inactive";

    return (
      <>
        <style>{`* { box-sizing: border-box; margin: 0; padding: 0; } body { background: #0D0D14; } @keyframes slideUp { from { opacity: 0; transform: translateY(16px); } to { opacity: 1; transform: translateY(0); } }`}</style>
        <div style={page}>
          <div style={{ ...wrap, animation: "slideUp 0.35s ease" }}>
            {gymHeader}

            <div style={{
              background: isOk ? "rgba(249,115,22,0.07)" : "rgba(220,38,38,0.06)",
              border: `1px solid ${isOk ? "rgba(249,115,22,0.18)" : "rgba(220,38,38,0.18)"}`,
              borderRadius: 22,
              padding: "32px 24px",
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              gap: 16,
              textAlign: "center",
            }}>
              {isOk
                ? <CheckCircle size={58} color="#F97316" strokeWidth={1.5} />
                : <XCircle size={58} color="#DC2626" strokeWidth={1.5} />
              }

              <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                <p style={{ font: `900 1.5rem/1.1 ${fd}`, color: "white", letterSpacing: "-0.03em" }}>
                  {isAlreadyIn   ? "Ya registrado hoy"
                   : isOk        ? "¡Buen entrenamiento!"
                   : isMembership ? (result.error_code === "membership_expired" ? "Membresía vencida" : "Membresía inactiva")
                   :               "No encontrado"}
                </p>
                {result.alumno?.full_name && (
                  <p style={{ font: `600 1rem/1 ${fd}`, color: isOk ? "rgba(255,255,255,0.75)" : "rgba(255,255,255,0.6)" }}>
                    {result.alumno.full_name}
                  </p>
                )}
                {isOk && result.hora && (
                  <p style={{ font: `400 0.74rem/1 ${fd}`, color: "rgba(255,255,255,0.25)", marginTop: 4 }}>
                    Entrada registrada a las {result.hora.slice(0, 5)}h
                  </p>
                )}
                {!isOk && result.error && (
                  <p style={{ font: `400 0.82rem/1.5 ${fd}`, color: "rgba(255,255,255,0.4)", marginTop: 4 }}>
                    {result.error}
                  </p>
                )}
              </div>
            </div>

            <button
              onClick={handleReset}
              style={{ width: "100%", padding: "13px 0", background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.07)", borderRadius: 14, font: `500 0.8rem/1 ${fd}`, color: "rgba(255,255,255,0.3)", cursor: "pointer", fontFamily: fd }}
            >
              Registrar otra asistencia
            </button>
            {footer}
          </div>
        </div>
      </>
    );
  }

  // ── Login / staff fallback ─────────────────────────────────────────────────
  return (
    <>
      <style>{`@keyframes spin { to { transform: rotate(360deg); } } @keyframes slideUp { from { opacity: 0; transform: translateY(16px); } to { opacity: 1; transform: translateY(0); } } * { box-sizing: border-box; margin: 0; padding: 0; } body { background: #0D0D14; }`}</style>
      <div style={page}>
        <div style={{ ...wrap, animation: "slideUp 0.35s ease" }}>
          {gymError ? (
            <div style={{ textAlign: "center" }}>
              <p style={{ font: `700 1.1rem/1 ${fd}`, color: "white", marginBottom: 8 }}>Gimnasio no encontrado</p>
              <p style={{ font: `400 0.8rem/1.4 ${fd}`, color: "rgba(255,255,255,0.3)" }}>El enlace puede estar desactualizado. Pedile al staff un nuevo código QR.</p>
            </div>
          ) : (
            <>
              {gymHeader}
              <div style={{ background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.07)", borderRadius: 20, padding: 24, display: "flex", flexDirection: "column", gap: 18 }}>
                <div>
                  <p style={{ font: `700 1rem/1 ${fd}`, color: "white", marginBottom: 6 }}>Ingresá desde tu panel</p>
                  <p style={{ font: `400 0.78rem/1.55 ${fd}`, color: "rgba(255,255,255,0.3)" }}>
                    Para registrar la asistencia desde tu celular necesitás iniciar sesión con tu magic link. Si no podés entrar, el staff puede cargarla manualmente.
                  </p>
                </div>

                <Link
                  href={`/alumno/login?redirect=/checkin/${gymId}`}
                  style={{
                    textDecoration: "none",
                    width: "100%",
                    padding: "14px 16px",
                    background: "linear-gradient(135deg, #F97316 0%, #EA580C 100%)",
                    border: "none",
                    borderRadius: 14,
                    font: `800 0.95rem/1 ${fd}`,
                    color: "white",
                    fontFamily: fd,
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                  }}
                >
                  Recibir acceso por WhatsApp
                </Link>

                <div
                  style={{
                    padding: "14px 16px",
                    background: "rgba(255,255,255,0.03)",
                    border: "1px solid rgba(255,255,255,0.08)",
                    borderRadius: 14,
                  }}
                >
                  <p style={{ font: `700 0.82rem/1 ${fd}`, color: "white", marginBottom: 6 }}>¿No te llega el link?</p>
                  <p style={{ font: `400 0.76rem/1.5 ${fd}`, color: "rgba(255,255,255,0.35)" }}>
                    Pedile al staff que registre tu entrada de forma manual desde el panel del gimnasio.
                  </p>
                </div>
              </div>
            </>
          )}
          {footer}
        </div>
      </div>
    </>
  );
}
