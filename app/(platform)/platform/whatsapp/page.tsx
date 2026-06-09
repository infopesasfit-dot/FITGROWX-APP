"use client";

import { useState, useEffect, useRef, memo } from "react";
import { supabase } from "@/lib/supabase";
import { WaHealthDashboard } from "@/components/wa-health-dashboard";
import { useBrandAlert, useBrandConfirm } from "@/components/brand-confirm";
import { CheckCircle, Loader2, ShieldAlert, Smartphone, WifiOff, X } from "lucide-react";

const fd = "var(--font-inter, 'Inter', sans-serif)";
const fb = "var(--font-inter, 'Inter', sans-serif)";

const shellCard: React.CSSProperties = {
  background: "rgba(248,250,252,0.88)",
  border: "1px solid rgba(255,255,255,0.85)",
  borderRadius: 28,
  boxShadow:
    "0 28px 60px rgba(15,23,42,0.10), 0 6px 16px rgba(15,23,42,0.05), inset 0 1px 0 rgba(255,255,255,0.6)",
};

function getErrorMessage(value: unknown) {
  if (value instanceof Error) return value.message;
  if (typeof value === "string") return value;
  if (value && typeof value === "object" && "message" in value && typeof (value as { message?: unknown }).message === "string") {
    return (value as { message: string }).message;
  }
  return "No se pudo cargar el panel de WhatsApp.";
}

const PLAT_SESSION = "fitgrowx-platform";

const DEFAULT_TEMPLATES = {
  bienvenida:    "¡Hola {nombre}! 🎉 Bienvenido a FitGrowX. Tu gym ya está listo para escalar. Si tenés alguna duda, respondé este mensaje.",
  activacion_d3: "Ey {nombre}! Eli de FitGrowX 👋 ¿Pudiste arrancar a cargar tus alumnos? Si querés te muestro cómo hacerlo en 5 minutos, es más fácil de lo que parece.",
  trial_vence:   "¡Hola {nombre}! ⏰ Tu período de prueba de FitGrowX vence en {dias} días. ¿Querés seguir creciendo? Hablemos para activar tu plan.",
  trial_expirado:"Hola {nombre}! Tu prueba de FitGrowX venció hoy. Tus datos siguen guardados. Si querés seguir usándolo, hablemos ahora y lo resolvemos 🙌",
  primer_pago:   "🎉 {nombre}, tu gym acaba de recibir su primer pago en FitGrowX. Así se empieza a escalar. Cualquier cosa estamos acá.",
  inactivo_7d:   "Ey {nombre}! Eli de FitGrowX. ¿Cómo va el gym? ¿Pudieron arrancar a usar el sistema o todavía están poniéndolo a punto? Cualquier cosa me avisás 🙌",
  reactivacion:  "¡Hola {nombre}! 👋 Hace un tiempo que no te vemos por FitGrowX. ¿Todo bien con el gym? Estamos acá para ayudarte.",
};

function WhatsAppPage() {
  const confirm = useBrandConfirm();
  const brandAlert = useBrandAlert();

  const [loading, setLoading] = useState(true);
  const [authorized, setAuthorized] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [platWaStatus, setPlatWaStatus] = useState<"unknown" | "connected" | "disconnected">("unknown");
  const [platWaPhone, setPlatWaPhone] = useState<string | null>(null);
  const [platQrOpen, setPlatQrOpen] = useState(false);
  const [platQrImage, setPlatQrImage] = useState<string | null>(null);
  const [platQrLoading, setPlatQrLoading] = useState(false);
  const [platQrError, setPlatQrError] = useState<"max" | null>(null);
  const platPollRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const platRetryRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const [platMsgTemplate, setPlatMsgTemplate] = useState(DEFAULT_TEMPLATES);
  const [platAutoEnabled, setPlatAutoEnabled] = useState<Record<string, boolean>>({});
  const [tplSaving, setTplSaving] = useState<Record<string, boolean>>({});
  const [tplTesting, setTplTesting] = useState<Record<string, "idle" | "sending" | "ok" | "error">>({});
  const tplSaveTimers = useRef<Record<string, ReturnType<typeof setTimeout>>>({});

  const platWaProxy = async (action: string, extra?: Record<string, string>) => {
    return fetch("/api/wa/proxy", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action, gymId: PLAT_SESSION, ...extra }),
    });
  };

  const platStopPolling = () => {
    if (platPollRef.current) { clearInterval(platPollRef.current); platPollRef.current = null; }
    if (platRetryRef.current) { clearTimeout(platRetryRef.current); platRetryRef.current = null; }
  };

  const platStartStatusPoll = () => {
    platStopPolling();
    platPollRef.current = setInterval(async () => {
      try {
        const res = await platWaProxy("session-status");
        const data = await res.json();
        if (data.status === "active") {
          platStopPolling();
          setPlatWaStatus("connected");
          if (data.phone) setPlatWaPhone(data.phone);
          setPlatQrOpen(false);
        }
      } catch { /* noop */ }
    }, 3000);
  };

  const platAttemptQr = async (attempt: number) => {
    setPlatQrLoading(true);
    setPlatQrImage(null);
    try {
      if (attempt === 0) await platWaProxy("session-delete").catch(() => {});
      const res = await platWaProxy("qr-data");
      const data = await res.json();
      if (data.status === "active") {
        setPlatWaStatus("connected");
        setPlatQrOpen(false);
        setPlatQrLoading(false);
        return;
      }
      if (data.qr) {
        setPlatQrImage(data.qr);
        setPlatQrLoading(false);
        platStartStatusPoll();
        return;
      }
      platRetryRef.current = setTimeout(() => platAttemptQr(attempt + 1), 2000);
    } catch {
      setPlatQrLoading(false);
      if (attempt < 4) platRetryRef.current = setTimeout(() => platAttemptQr(attempt + 1), 3000);
      else setPlatQrError("max");
    }
  };

  const platOpenQr = () => {
    platStopPolling();
    setPlatQrOpen(true);
    setPlatQrImage(null);
    setPlatQrError(null);
    void platAttemptQr(0);
  };

  const handleTplChange = (key: string, value: string) => {
    setPlatMsgTemplate(prev => ({ ...prev, [key]: value }));
    if (tplSaveTimers.current[key]) clearTimeout(tplSaveTimers.current[key]);
    tplSaveTimers.current[key] = setTimeout(async () => {
      setTplSaving(prev => ({ ...prev, [key]: true }));
      try {
        await fetch("/api/platform/wa-templates", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ key, body: value }),
        });
      } catch { /* non-fatal */ }
      setTplSaving(prev => ({ ...prev, [key]: false }));
    }, 1500);
  };

  const handleTplTest = async (key: string, body: string) => {
    const ownerPhone = process.env.NEXT_PUBLIC_OWNER_PHONE ?? "";
    const phone = prompt("Número para el test (ej: 5491164893435):", ownerPhone || "");
    if (!phone?.trim()) return;
    setTplTesting(prev => ({ ...prev, [key]: "sending" }));
    const r = await fetch("/api/platform/wa-templates/test", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ key, phone: phone.trim(), body }),
    });
    const state = r.ok ? "ok" : "error";
    setTplTesting(prev => ({ ...prev, [key]: state }));
    setTimeout(() => setTplTesting(prev => ({ ...prev, [key]: "idle" })), 3000);
  };

  const handleTplToggle = async (key: string, enabled: boolean) => {
    setPlatAutoEnabled(prev => ({ ...prev, [key]: enabled }));
    try {
      await fetch("/api/platform/wa-templates", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ key, enabled }),
      });
    } catch { /* non-fatal */ }
  };

  // Auth check
  useEffect(() => {
    let active = true;
    (async () => {
      try {
        const { data: { user }, error: authError } = await supabase.auth.getUser();
        if (authError) throw authError;
        if (!user) { if (active) { setError("Necesitas iniciar sesión."); setLoading(false); } return; }
        const { data: profile, error: profileError } = await supabase
          .from("profiles").select("role").eq("id", user.id).limit(1).maybeSingle();
        if (profileError) throw profileError;
        if (!profile) throw new Error("No se encontró tu perfil en la tabla profiles.");
        if (profile.role !== "platform_owner") {
          if (active) { setError("Tu usuario no tiene acceso al panel de plataforma."); setLoading(false); }
          return;
        }
        if (active) setAuthorized(true);

        // Load WA session status
        try {
          const res = await platWaProxy("session-status");
          const data = await res.json();
          if (active) {
            setPlatWaStatus(data.status === "active" ? "connected" : "disconnected");
            if (data.phone) setPlatWaPhone(data.phone);
          }
        } catch { if (active) setPlatWaStatus("disconnected"); }

        // Load templates
        try {
          const res = await fetch("/api/platform/wa-templates");
          if (res.ok) {
            const dbTpl: Record<string, { body: string; enabled: boolean }> = await res.json();
            if (Object.keys(dbTpl).length > 0 && active) {
              const bodies: Record<string, string> = {};
              const enableds: Record<string, boolean> = {};
              for (const [k, v] of Object.entries(dbTpl)) { bodies[k] = v.body; enableds[k] = v.enabled; }
              setPlatMsgTemplate(prev => ({ ...prev, ...bodies }));
              setPlatAutoEnabled(prev => ({ ...prev, ...enableds }));
            }
          }
        } catch { /* non-fatal */ }

        if (active) setLoading(false);
      } catch (caughtError) {
        if (active) { setError(getErrorMessage(caughtError)); setLoading(false); }
      }
    })();
    return () => { active = false; platStopPolling(); };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  if (loading) {
    return (
      <div style={{ maxWidth: 1280, margin: "0 auto", padding: "16px 24px 48px" }}>
        <div style={{ ...shellCard, padding: 28 }}>
          <p style={{ font: `500 0.95rem/1.6 ${fb}`, color: "#64748B" }}>Cargando...</p>
        </div>
      </div>
    );
  }

  if (error || !authorized) {
    return (
      <div style={{ maxWidth: 1280, margin: "0 auto", padding: "16px 24px 48px" }}>
        <div style={{ ...shellCard, padding: 28 }}>
          <div style={{ display: "flex", gap: 12, alignItems: "flex-start" }}>
            <ShieldAlert size={20} color="#DC2626" style={{ flexShrink: 0, marginTop: 2 }} />
            <p style={{ font: `400 0.92rem/1.6 ${fb}`, color: "#64748B" }}>{error ?? "Sin acceso."}</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div style={{ maxWidth: 1280, margin: "0 auto", padding: "16px 24px 48px" }}>
      {/* Connection status banner */}
      <section style={{
        ...shellCard,
        padding: "22px 26px",
        marginBottom: 20,
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        gap: 16,
        flexWrap: "wrap",
        borderLeft: `4px solid ${platWaStatus === "connected" ? "#16A34A" : platWaStatus === "disconnected" ? "#DC2626" : "#94A3B8"}`,
      }}>
        <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
          <div style={{
            width: 44, height: 44, borderRadius: 14,
            background: platWaStatus === "connected" ? "rgba(22,163,74,0.12)" : platWaStatus === "disconnected" ? "rgba(220,38,38,0.10)" : "rgba(148,163,184,0.14)",
            display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0,
          }}>
            {platWaStatus === "connected"
              ? <CheckCircle size={20} color="#16A34A" />
              : platWaStatus === "disconnected"
              ? <WifiOff size={20} color="#DC2626" />
              : <Loader2 size={20} color="#94A3B8" style={{ animation: "spin 1s linear infinite" }} />}
          </div>
          <div>
            <p style={{ margin: 0, font: `700 0.95rem/1 ${fd}`, color: "#111827" }}>
              {platWaStatus === "connected"
                ? `Conectado${platWaPhone ? ` · ${platWaPhone}` : ""}`
                : platWaStatus === "disconnected" ? "Sin conexión" : "Verificando..."}
            </p>
          </div>
        </div>
        <button
          type="button"
          onClick={platOpenQr}
          style={{
            padding: "10px 18px", borderRadius: 12, border: "none",
            background: platWaStatus === "connected" ? "rgba(15,23,42,0.08)" : "#111827",
            color: platWaStatus === "connected" ? "#374151" : "#fff",
            font: `600 0.85rem/1 ${fd}`, cursor: "pointer",
            display: "flex", alignItems: "center", gap: 7, flexShrink: 0,
          }}
        >
          <Smartphone size={15} />
          {platWaStatus === "connected" ? "Reconectar QR" : "Conectar QR"}
        </button>
        <button
          type="button"
          onClick={async () => {
            if (!await confirm({
              eyebrow: "WhatsApp",
              title: "¿Limpiar credenciales guardadas?",
              message: "Esto forzará un nuevo QR para conectar la cuenta.",
              confirmLabel: "Limpiar",
              variant: "danger",
            })) return;
            try {
              const res = await fetch("/api/whatsapp/wipe", {
                method: "POST",
                headers: { "Content-Type": "application/json", "X-Confirm-Wipe": "true" },
                body: JSON.stringify({ gymId: "fitgrowx-platform" }),
              });
              if (res.ok) {
                await brandAlert({ eyebrow: "WhatsApp", title: "Credenciales limpias", message: "Escaneá el QR nuevamente.", variant: "success" });
                setPlatWaStatus("unknown");
                setTimeout(() => { void platAttemptQr(0); }, 1000);
              } else {
                await brandAlert({ eyebrow: "WhatsApp", title: "Error al limpiar credenciales", variant: "danger" });
              }
            } catch (err) {
              await brandAlert({ eyebrow: "WhatsApp", title: "Error", message: err instanceof Error ? err.message : "desconocido", variant: "danger" });
            }
          }}
          style={{
            padding: "10px 18px", borderRadius: 12,
            border: "1px solid #FCA5A5", background: "#FEF2F2", color: "#B91C1C",
            font: `600 0.85rem/1 ${fd}`, cursor: "pointer", flexShrink: 0,
          }}
        >
          Limpiar credenciales
        </button>
      </section>

      {/* QR Modal */}
      {platQrOpen && (
        <div style={{ position: "fixed", inset: 0, zIndex: 9999, background: "rgba(0,0,0,0.55)", display: "flex", alignItems: "center", justifyContent: "center" }}>
          <div style={{ background: "#fff", borderRadius: 24, padding: "36px 40px", maxWidth: 420, width: "90%", textAlign: "center", position: "relative" }}>
            <button type="button" onClick={() => { platStopPolling(); setPlatQrOpen(false); }} style={{ position: "absolute", top: 14, right: 14, background: "none", border: "none", cursor: "pointer", padding: 4 }}>
              <X size={18} color="#6B7280" />
            </button>
            <Smartphone size={28} color="#111827" style={{ marginBottom: 12 }} />
            <p style={{ margin: "0 0 6px", font: `700 1rem/1 ${fd}`, color: "#111827" }}>Conectá tu WhatsApp</p>
            <p style={{ margin: "0 0 22px", font: `400 0.85rem/1.5 ${fb}`, color: "#6B7280" }}>
              Abrí WhatsApp → Dispositivos vinculados → Vincular dispositivo → Escaneá el QR
            </p>
            {platQrLoading && !platQrImage && (
              <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 12, padding: "30px 0" }}>
                <Loader2 size={32} color="#2563EB" style={{ animation: "spin 1s linear infinite" }} />
                <p style={{ margin: 0, font: `400 0.85rem/1 ${fb}`, color: "#64748B" }}>Generando QR...</p>
              </div>
            )}
            {platQrImage && (
              <img src={platQrImage} alt="QR WhatsApp" style={{ width: 220, height: 220, borderRadius: 12, border: "1px solid rgba(0,0,0,0.08)" }} />
            )}
            {platQrError === "max" && (
              <div style={{ padding: "20px 0" }}>
                <p style={{ margin: "0 0 14px", font: `500 0.88rem/1.5 ${fb}`, color: "#B91C1C" }}>No se pudo generar el QR. Intentá de nuevo.</p>
                <button type="button" onClick={() => { setPlatQrError(null); void platAttemptQr(0); }} style={{ padding: "8px 20px", borderRadius: 10, border: "none", background: "#111827", color: "#fff", font: `600 0.85rem/1 ${fd}`, cursor: "pointer" }}>
                  Reintentar
                </button>
              </div>
            )}
            {platQrImage && (
              <p style={{ margin: "14px 0 0", font: `400 0.8rem/1.5 ${fb}`, color: "#9CA3AF" }}>
                El QR se actualiza automáticamente. Una vez escaneado, se cerrará esta ventana.
              </p>
            )}
          </div>
        </div>
      )}

      {/* WhatsApp Health Dashboard */}
      <section style={{ marginBottom: 28 }}>
        <WaHealthDashboard />
      </section>

      {/* Automatizaciones */}
      <section style={{ ...shellCard, padding: "26px 28px" }}>
        <div style={{ marginBottom: 20 }}>
          <p style={{ margin: "0 0 4px", font: `700 1rem/1 ${fd}`, color: "#111827" }}>Automatizaciones</p>
          <p style={{ margin: 0, font: `400 0.83rem/1.5 ${fb}`, color: "#6B7280" }}>
            Cada mensaje se dispara automáticamente. Activá o desactivá por separado y editá el texto cuando quieras — se guarda solo.
          </p>
        </div>
        <div style={{ display: "flex", flexDirection: "column", gap: 1, border: "1px solid rgba(15,23,42,0.08)", borderRadius: 14, overflow: "hidden" }}>
          {(["bienvenida", "activacion_d3", "trial_vence", "trial_expirado", "primer_pago", "inactivo_7d", "reactivacion"] as const).map((key, idx, arr) => {
            const labels: Record<string, string> = {
              bienvenida:     "Bienvenida",
              activacion_d3:  "Día 3 sin alumnos",
              trial_vence:    "Trial por vencer",
              trial_expirado: "Trial vencido",
              primer_pago:    "Primer pago 🎉",
              inactivo_7d:    "Sin actividad 7 días",
              reactivacion:   "Reactivación manual",
            };
            const enabled = platAutoEnabled[key] !== false;
            const saving  = tplSaving[key];
            return (
              <div key={key} style={{ borderBottom: idx < arr.length - 1 ? "1px solid rgba(15,23,42,0.06)" : "none", opacity: enabled ? 1 : 0.5, transition: "opacity 0.2s" }}>
                <div style={{ display: "flex", alignItems: "center", gap: 12, padding: "13px 16px", background: "white" }}>
                  <button
                    type="button"
                    onClick={() => handleTplToggle(key, !enabled)}
                    style={{ flexShrink: 0, width: 38, height: 21, borderRadius: 11, background: enabled ? "#111827" : "#D1D5DB", border: "none", cursor: "pointer", position: "relative", transition: "background 0.2s" }}
                  >
                    <span style={{ position: "absolute", top: 2.5, left: enabled ? 19 : 2.5, width: 16, height: 16, borderRadius: "50%", background: "white", boxShadow: "0 1px 3px rgba(0,0,0,0.2)", transition: "left 0.2s", display: "block" }} />
                  </button>
                  <p style={{ margin: 0, font: `600 0.85rem/1 ${fd}`, color: enabled ? "#111827" : "#9CA3AF", flex: 1 }}>{labels[key]}</p>
                  {saving && <span style={{ font: `400 0.72rem/1 ${fb}`, color: "#94A3B8" }}>guardando…</span>}
                  <button
                    type="button"
                    onClick={() => handleTplTest(key, platMsgTemplate[key])}
                    disabled={tplTesting[key] === "sending"}
                    style={{ padding: "4px 12px", borderRadius: 7, border: "1px solid rgba(15,23,42,0.10)", background: "white", font: `500 0.72rem/1 ${fd}`, color: tplTesting[key] === "ok" ? "#16A34A" : tplTesting[key] === "error" ? "#DC2626" : "#6B7280", cursor: "pointer", flexShrink: 0 }}
                  >
                    {tplTesting[key] === "sending" ? "Enviando…" : tplTesting[key] === "ok" ? "✓ Enviado" : tplTesting[key] === "error" ? "Error" : "Probar"}
                  </button>
                </div>
                <div style={{ padding: "0 16px 13px 66px", background: "white" }}>
                  <textarea
                    rows={3}
                    value={platMsgTemplate[key]}
                    onChange={e => handleTplChange(key, e.target.value)}
                    style={{ width: "100%", padding: "9px 12px", borderRadius: 9, border: "1px solid rgba(15,23,42,0.08)", background: "#F9FAFB", font: `400 0.83rem/1.6 ${fb}`, color: "#374151", outline: "none", resize: "vertical", boxSizing: "border-box" }}
                  />
                </div>
              </div>
            );
          })}
        </div>
      </section>
    </div>
  );
}

export default memo(WhatsAppPage);
