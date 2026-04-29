"use client";

import { useState, useEffect } from "react";
import {
  Zap,
  Bell,
  MessageSquare,
  UserX,
  Save,
  Send,
  RefreshCw,
} from "lucide-react";
import { supabase } from "@/lib/supabase";

const fd = "var(--font-inter, 'Inter', sans-serif)";
const fb = "var(--font-inter, 'Inter', sans-serif)";
const t1 = "#1A1D23";
const t2 = "#6B7280";
const t3 = "#9CA3AF";
const ACCENT = "#2563EB";
const ACCENT_DARK = "#1D4ED8";
const ACCENT_SOFT = "rgba(37,99,235,0.08)";
const ACCENT_BORDER = "rgba(37,99,235,0.18)";

const card = {
  background: "#FFFFFF",
  border: "1px solid rgba(0,0,0,0.05)",
  borderRadius: 14,
  boxShadow: "0 2px 8px rgba(0,0,0,0.06), 0 0 1px rgba(0,0,0,0.04)",
};

// --- Componentes Auxiliares ---
function Toggle({ checked, onChange }: { checked: boolean; onChange: () => void }) {
  return (
    <button
      type="button" onClick={onChange}
      style={{ width: 44, height: 24, borderRadius: 9999, border: "none", background: checked ? ACCENT : "rgba(0,0,0,0.12)", position: "relative", cursor: "pointer", transition: "background 0.2s", flexShrink: 0 }}
    >
      <span style={{ position: "absolute", top: 3, left: checked ? 23 : 3, width: 18, height: 18, borderRadius: "50%", background: "white", boxShadow: "0 1px 4px rgba(0,0,0,0.20)", transition: "left 0.2s", display: "block" }} />
    </button>
  );
}

// --- Componente de la Página ---
export default function AutomatizacionesPage() {
  const [gymId,     setGymId]     = useState<string | null>(null);

  const DEFAULT_MAGICLINK_MSG = "¡Hola [Nombre]! 👋\nIngresá a tu panel de *[Gym]* desde acá:\n[Link]";

  const [recordatorio,        setRecordatorio]        = useState(true);
  const [inactividad,         setInactividad]         = useState(false);
  const [inactividadDias,     setInactividadDias]     = useState(7);
  const [inactividadMsg,      setInactividadMsg]      = useState("");
  const [enviandoReactivacion, setEnviandoReactivacion] = useState(false);
  const [reactivacionResult,  setReactivacionResult]  = useState<{ ok: boolean; msg: string } | null>(null);
  const [gymName,             setGymName]             = useState("");
  const [aliasGym,       setAliasGym]       = useState("");
  const [magiclinkMsg,   setMagiclinkMsg]   = useState(DEFAULT_MAGICLINK_MSG);
  const [leadAutoWelcome,  setLeadAutoWelcome]  = useState(true);
  const [renovacionActivo, setRenovacionActivo] = useState(true);
  const [renovacionMsg,    setRenovacionMsg]    = useState("");
  const [saving,           setSaving]           = useState(false);
  const [savedOk,          setSavedOk]          = useState(false);

  // Obtener gymId del usuario logueado
  useEffect(() => {
    (async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (user) setGymId(user.id);
    })();
  }, []);

  // Carga inicial de settings desde Supabase
  useEffect(() => {
    if (!gymId) return;
    (async () => {
      const { data: s } = await supabase.from("gym_settings").select("*").eq("gym_id", gymId).maybeSingle();
      if (s) {
        if (s.cobro_alias)              { setAliasGym(s.cobro_alias); }
        if (s.gym_name)                   setGymName(s.gym_name);
        if (s.magiclink_msg)              setMagiclinkMsg(s.magiclink_msg);
        if (s.inactividad_activo != null)  setInactividad(s.inactividad_activo);
        if (s.inactividad_dias)            setInactividadDias(s.inactividad_dias);
        if (s.inactividad_msg)             setInactividadMsg(s.inactividad_msg);
        if (s.vencimiento_activo != null)  setRecordatorio(s.vencimiento_activo);
        if (s.lead_auto_welcome != null)   setLeadAutoWelcome(s.lead_auto_welcome);
        if (s.renewal_activo != null)      setRenovacionActivo(s.renewal_activo);
        if (s.renewal_msg)                 setRenovacionMsg(s.renewal_msg);
      }
    })();
  }, [gymId]);

  const saveSettings = async () => {
    setSaving(true);
    await supabase.from("gym_settings").upsert({
      gym_id: gymId,
      cobro_alias: aliasGym.trim() || null,
      gym_name: gymName.trim() || null,
      magiclink_msg: magiclinkMsg.trim() || null,
      inactividad_activo: inactividad,
      inactividad_dias: inactividadDias,
      inactividad_msg: inactividadMsg.trim() || null,
      vencimiento_activo: recordatorio,
      lead_auto_welcome: leadAutoWelcome,
      renewal_activo: renovacionActivo,
      renewal_msg: renovacionMsg.trim() || null,
    }, { onConflict: "gym_id" });
    setSaving(false);
    setSavedOk(true);
    setTimeout(() => setSavedOk(false), 2400);
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 18 }}>

      {/* ── Mensaje de Acceso de Alumnos ── */}
      <div style={{ ...card, padding: "28px 28px 24px" }}>
        <div style={{ display: "flex", alignItems: "flex-start", gap: 14, marginBottom: 20 }}>
          <div style={{ width: 40, height: 40, borderRadius: 10, background: "#2C2C2E", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
            <MessageSquare size={18} color={ACCENT} />
          </div>
          <div>
            <h2 style={{ font: `700 1rem/1 ${fd}`, color: t1, marginBottom: 4 }}>Mensaje de Acceso al Panel</h2>
            <p style={{ font: `400 0.82rem/1.4 ${fb}`, color: t2 }}>Texto que recibe el alumno cuando solicita su link de ingreso por WhatsApp.</p>
          </div>
        </div>

        <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
          {/* Nombre del gym */}
          <div>
            <label style={{ display: "block", font: `500 0.72rem/1 ${fb}`, color: t3, marginBottom: 7 }}>
              Nombre de tu Gym / Box
            </label>
            <input
              value={gymName}
              onChange={e => setGymName(e.target.value)}
              placeholder="Ej: CrossFit La Boca, Gym Power, Box Norte…"
              style={{ width: "100%", padding: "10px 12px", borderRadius: 8, border: "1px solid #E5E7EB", font: `400 0.875rem/1 ${fb}`, color: t1, outline: "none", boxSizing: "border-box" }}
            />
          </div>

          {/* Plantilla del mensaje */}
          <div>
            <label style={{ display: "block", font: `500 0.72rem/1 ${fb}`, color: t3, marginBottom: 4 }}>
              Mensaje personalizado
            </label>
            <p style={{ font: `400 0.72rem/1.4 ${fb}`, color: t3, marginBottom: 7 }}>
              Variables disponibles: <code style={{ background: ACCENT_SOFT, color: ACCENT, padding: "1px 5px", borderRadius: 4 }}>[Nombre]</code>{" "}
              <code style={{ background: ACCENT_SOFT, color: ACCENT, padding: "1px 5px", borderRadius: 4 }}>[Gym]</code>{" "}
              <code style={{ background: ACCENT_SOFT, color: ACCENT, padding: "1px 5px", borderRadius: 4 }}>[Link]</code>
            </p>
            <textarea
              value={magiclinkMsg}
              onChange={e => setMagiclinkMsg(e.target.value)}
              rows={4}
              style={{ width: "100%", padding: "10px 12px", borderRadius: 8, border: "1px solid #E5E7EB", font: `400 0.875rem/1.5 ${fb}`, color: t1, outline: "none", resize: "vertical", boxSizing: "border-box" }}
            />
            <div style={{ marginTop: 8, padding: "10px 14px", background: "#F9FAFB", borderRadius: 8, border: "1px solid rgba(0,0,0,0.06)" }}>
              <p style={{ font: `500 0.7rem/1 ${fb}`, color: t3, marginBottom: 6, textTransform: "uppercase", letterSpacing: "0.06em" }}>Preview</p>
              <p style={{ font: `400 0.82rem/1.5 ${fb}`, color: t1, whiteSpace: "pre-line" }}>
                {magiclinkMsg
                  .replace(/\[Nombre\]/g, "Julián Álvarez")
                  .replace(/\[Gym\]/g,    gymName || "tu gimnasio")
                  .replace(/\[Link\]/g,   "https://fitgrowx.app/alumno/auth?token=…")}
              </p>
            </div>
          </div>

          <div style={{ display: "flex", justifyContent: "flex-end" }}>
            <button
              onClick={saveSettings}
              disabled={saving}
              style={{ display: "flex", alignItems: "center", gap: 6, padding: "9px 18px", borderRadius: 9, border: "none", background: savedOk ? ACCENT_DARK : `linear-gradient(135deg, ${ACCENT_DARK} 0%, ${ACCENT} 100%)`, color: "white", font: `700 0.82rem/1 ${fd}`, cursor: "pointer", boxShadow: "0 10px 20px rgba(37,99,235,0.14)" }}
            >
              <Save size={13} /> {savedOk ? "Guardado ✓" : saving ? "Guardando..." : "Guardar mensaje"}
            </button>
          </div>
        </div>
      </div>

      {/* ── Mensajes Automáticos (Plan PRO) ── */}
      <div style={{ ...card, padding: "28px 28px 24px" }}>
        <div style={{ display: "flex", alignItems: "flex-start", gap: 14, marginBottom: 24 }}>
          <div style={{ width: 40, height: 40, borderRadius: 10, background: "#2C2C2E", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
            <Zap size={18} color="white" />
          </div>
          <div>
            <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 4 }}>
              <h2 style={{ font: `700 1rem/1 ${fd}`, color: t1 }}>Mensajes Automáticos</h2>
              <span style={{ font: `700 0.62rem/1 ${fd}`, color: ACCENT, background: ACCENT_SOFT, border: `1px solid ${ACCENT_BORDER}`, borderRadius: 9999, padding: "3px 8px" }}>Plan PRO</span>
            </div>
            <p style={{ font: `400 0.82rem/1.4 ${fb}`, color: t2 }}>Activá recordatorios y alertas para retener alumnos sin esfuerzo.</p>
          </div>
        </div>

        {/* Alias / Cobro */}
        <div style={{ padding: "16px 20px", background: "rgba(37,99,235,0.04)", borderRadius: 12, border: "1px solid rgba(37,99,235,0.18)", marginBottom: 14 }}>
          <label style={{ display: "block", font: `600 0.78rem/1 ${fb}`, color: ACCENT, marginBottom: 6, textTransform: "uppercase", letterSpacing: "0.06em" }}>Mi Alias / CBU de Cobro</label>
          <input
            value={aliasGym}
            onChange={e => setAliasGym(e.target.value)}
            placeholder="Ej: Alias: GYM.POWER.MP"
            style={{ width: "100%", padding: "9px 12px", background: "white", border: "1px solid rgba(37,99,235,0.25)", borderRadius: 8, font: `400 0.875rem/1 ${fb}`, color: "#1A1D23", outline: "none", boxSizing: "border-box" }}
          />
        </div>

        {/* Recordatorio */}
        <div style={{ padding: "18px 20px", background: "#F9FAFB", borderRadius: 12, border: "1px solid rgba(0,0,0,0.06)", marginBottom: 14 }}>
          <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 16 }}>
            <div style={{ display: "flex", gap: 12 }}>
              <div style={{ width: 36, height: 36, borderRadius: 9, background: recordatorio ? ACCENT_SOFT : "#F0F2F8", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                <Bell size={16} color={recordatorio ? ACCENT : t3} />
              </div>
              <div>
                <p style={{ font: `600 0.875rem/1 ${fd}`, color: t1, marginBottom: 4 }}>Recordatorio de Vencimiento</p>
                <p style={{ font: `400 0.78rem/1.4 ${fb}`, color: t2 }}>Envía un mensaje 3 días antes de que venza la cuota.</p>
              </div>
            </div>
            <Toggle checked={recordatorio} onChange={() => setRecordatorio(!recordatorio)} />
          </div>
        </div>

        {/* Renovación de cuota */}
        <div style={{ padding: "18px 20px", background: renovacionActivo ? "rgba(255,106,0,0.03)" : "#F9FAFB", borderRadius: 12, border: `1px solid ${renovacionActivo ? "rgba(255,106,0,0.18)" : "rgba(0,0,0,0.06)"}`, marginBottom: 14 }}>
          <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 16, marginBottom: renovacionActivo ? 16 : 0 }}>
            <div style={{ display: "flex", gap: 12 }}>
              <div style={{ width: 36, height: 36, borderRadius: 9, background: renovacionActivo ? "rgba(255,106,0,0.10)" : "#F0F2F8", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                <RefreshCw size={16} color={renovacionActivo ? "#FF6A00" : t3} />
              </div>
              <div>
                <p style={{ font: `600 0.875rem/1 ${fd}`, color: t1, marginBottom: 4 }}>Mensaje de Renovación + Acceso</p>
                <p style={{ font: `400 0.78rem/1.4 ${fb}`, color: t2 }}>Envía un mensaje con el link de acceso al confirmar un pago.</p>
              </div>
            </div>
            <Toggle checked={renovacionActivo} onChange={() => setRenovacionActivo(v => !v)} />
          </div>

          {renovacionActivo && (
            <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
              <div>
                <label style={{ display: "block", font: `500 0.72rem/1 ${fb}`, color: t3, marginBottom: 4 }}>
                  Mensaje personalizado
                </label>
                <p style={{ font: `400 0.72rem/1.4 ${fb}`, color: t3, marginBottom: 7 }}>
                  Variables: <code style={{ background: ACCENT_SOFT, color: ACCENT, padding: "1px 5px", borderRadius: 4 }}>[Nombre]</code>{" "}
                  <code style={{ background: ACCENT_SOFT, color: ACCENT, padding: "1px 5px", borderRadius: 4 }}>[Gym]</code>{" "}
                  <code style={{ background: ACCENT_SOFT, color: ACCENT, padding: "1px 5px", borderRadius: 4 }}>[Link]</code>
                </p>
                <textarea
                  value={renovacionMsg}
                  onChange={e => setRenovacionMsg(e.target.value)}
                  placeholder={`¡Hola [Nombre]! 💪 Tu cuota en *[Gym]* está al día.\n\nIngresá a tu panel desde acá 👇\n[Link]\n\n_El acceso dura 30 días._`}
                  rows={4}
                  style={{ width: "100%", padding: "10px 12px", borderRadius: 8, border: "1px solid #E5E7EB", font: `400 0.875rem/1.5 ${fb}`, color: t1, outline: "none", resize: "vertical", boxSizing: "border-box" }}
                />
              </div>
              {renovacionMsg && (
                <div style={{ padding: "10px 14px", background: "#F9FAFB", borderRadius: 8, border: "1px solid rgba(0,0,0,0.06)" }}>
                  <p style={{ font: `500 0.7rem/1 ${fb}`, color: t3, marginBottom: 6, textTransform: "uppercase", letterSpacing: "0.06em" }}>Preview</p>
                  <p style={{ font: `400 0.82rem/1.5 ${fb}`, color: t1, whiteSpace: "pre-line" }}>
                    {renovacionMsg
                      .replace(/\[Nombre\]/g, "Julián Álvarez")
                      .replace(/\[Gym\]/g,    gymName || "tu gimnasio")
                      .replace(/\[Link\]/g,   "https://fitgrowx.com/alumno/auth?token=…")}
                  </p>
                </div>
              )}
              <div style={{ display: "flex", justifyContent: "flex-end" }}>
                <button
                  onClick={saveSettings}
                  disabled={saving}
                  style={{ display: "flex", alignItems: "center", gap: 6, padding: "9px 18px", borderRadius: 9, border: "none", background: savedOk ? ACCENT_DARK : `linear-gradient(135deg, ${ACCENT_DARK} 0%, ${ACCENT} 100%)`, color: "white", font: `700 0.78rem/1 ${fd}`, cursor: "pointer", boxShadow: "0 10px 20px rgba(37,99,235,0.14)" }}
                >
                  <Save size={13} /> {savedOk ? "Guardado ✓" : "Guardar"}
                </button>
              </div>
            </div>
          )}
        </div>

        {/* Bienvenida Leads */}
        <div style={{ padding: "18px 20px", background: "#F9FAFB", borderRadius: 12, border: "1px solid rgba(0,0,0,0.06)", marginBottom: 14 }}>
          <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 16 }}>
            <div style={{ display: "flex", gap: 12 }}>
              <div style={{ width: 36, height: 36, borderRadius: 9, background: leadAutoWelcome ? "rgba(16,185,129,0.10)" : "#F0F2F8", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                <Zap size={16} color={leadAutoWelcome ? ACCENT : t3} />
              </div>
              <div>
                <p style={{ font: `600 0.875rem/1 ${fd}`, color: t1, marginBottom: 4 }}>Bienvenida Automática a Leads</p>
                <p style={{ font: `400 0.78rem/1.4 ${fb}`, color: t2 }}>Mensaje instantáneo cuando agendan desde tu landing.</p>
              </div>
            </div>
            <Toggle checked={leadAutoWelcome} onChange={() => setLeadAutoWelcome(!leadAutoWelcome)} />
          </div>
        </div>

        {/* Recuperación por inactividad */}
        <div style={{ padding: "18px 20px", background: inactividad ? "rgba(220,38,38,0.03)" : "#F9FAFB", borderRadius: 12, border: `1px solid ${inactividad ? "rgba(220,38,38,0.15)" : "rgba(0,0,0,0.06)"}` }}>
          <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 16, marginBottom: inactividad ? 16 : 0 }}>
            <div style={{ display: "flex", gap: 12 }}>
              <div style={{ width: 36, height: 36, borderRadius: 9, background: inactividad ? "rgba(220,38,38,0.10)" : "#F0F2F8", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                <UserX size={16} color={inactividad ? "#DC2626" : t3} />
              </div>
              <div>
                <p style={{ font: `600 0.875rem/1 ${fd}`, color: t1, marginBottom: 4 }}>Recuperación por Inactividad</p>
                <p style={{ font: `400 0.78rem/1.4 ${fb}`, color: t2 }}>Mensaje automático a alumnos que no van hace X días.</p>
              </div>
            </div>
            <Toggle checked={inactividad} onChange={() => { setInactividad(v => !v); }} />
          </div>

          {inactividad && (
            <div style={{ display: "flex", flexDirection: "column", gap: 12, paddingTop: 4 }}>
              {/* Días */}
              <div>
                <label style={{ display: "block", font: `500 0.72rem/1 ${fb}`, color: t3, marginBottom: 6 }}>
                  Días sin asistencia para activar mensaje
                </label>
                <div style={{ display: "flex", gap: 6 }}>
                  {[3, 5, 7, 10, 14].map(d => (
                    <button
                      key={d}
                      onClick={() => setInactividadDias(d)}
                      style={{ padding: "7px 14px", borderRadius: 8, border: `1px solid ${inactividadDias === d ? "#DC2626" : "rgba(0,0,0,0.1)"}`, background: inactividadDias === d ? "rgba(220,38,38,0.07)" : "white", color: inactividadDias === d ? "#DC2626" : t2, font: `600 0.78rem/1 ${fd}`, cursor: "pointer" }}
                    >
                      {d}d
                    </button>
                  ))}
                </div>
              </div>

              {/* Mensaje personalizable */}
              <div>
                <label style={{ display: "block", font: `500 0.72rem/1 ${fb}`, color: t3, marginBottom: 4 }}>
                  Mensaje de reactivación
                </label>
                <p style={{ font: `400 0.72rem/1.4 ${fb}`, color: t3, marginBottom: 7 }}>
                  Variables: <code style={{ background: ACCENT_SOFT, color: ACCENT, padding: "1px 5px", borderRadius: 4 }}>[Nombre]</code>{" "}
                  <code style={{ background: ACCENT_SOFT, color: ACCENT, padding: "1px 5px", borderRadius: 4 }}>[Gym]</code>{" "}
                  <code style={{ background: ACCENT_SOFT, color: ACCENT, padding: "1px 5px", borderRadius: 4 }}>[Dias]</code>
                </p>
                <textarea
                  value={inactividadMsg}
                  onChange={e => setInactividadMsg(e.target.value)}
                  placeholder={`¡Hola [Nombre]! 💪 Te extrañamos en *[Gym]*. Hace más de [Dias] días que no te vemos. ¡Volvé cuando quieras!`}
                  rows={3}
                  style={{ width: "100%", padding: "10px 12px", borderRadius: 8, border: "1px solid #E5E7EB", font: `400 0.875rem/1.5 ${fb}`, color: t1, outline: "none", resize: "vertical", boxSizing: "border-box" }}
                />
              </div>

              {/* Enviar ahora + guardar */}
              <div style={{ display: "flex", gap: 8, justifyContent: "flex-end" }}>
                <button
                  onClick={async () => {
                    setEnviandoReactivacion(true);
                    setReactivacionResult(null);
                    await saveSettings();
                    const d = await fetch("/api/cron/ausentes-trigger", {
                      method: "POST",
                      headers: { "Content-Type": "application/json" },
                      body: JSON.stringify({ gym_id: gymId }),
                    }).then(r => r.json()).catch(() => ({ ok: false, error: "Error de red" }));
                    setEnviandoReactivacion(false);
                    setReactivacionResult({ ok: d.ok, msg: d.ok ? `✓ ${d.enviados ?? 0} mensajes enviados` : (d.error ?? "Error") });
                    setTimeout(() => setReactivacionResult(null), 6000);
                  }}
                  disabled={enviandoReactivacion}
                  style={{ display: "flex", alignItems: "center", gap: 6, padding: "9px 16px", borderRadius: 9, border: "1px solid rgba(220,38,38,0.2)", background: "rgba(220,38,38,0.06)", color: "#DC2626", font: `600 0.78rem/1 ${fd}`, cursor: enviandoReactivacion ? "not-allowed" : "pointer", opacity: enviandoReactivacion ? 0.6 : 1 }}
                >
                  <Send size={13} /> {enviandoReactivacion ? "Enviando..." : "Enviar ahora"}
                </button>
                <button
                  onClick={saveSettings}
                  disabled={saving}
                  style={{ display: "flex", alignItems: "center", gap: 6, padding: "9px 18px", borderRadius: 9, border: "none", background: savedOk ? ACCENT_DARK : `linear-gradient(135deg, ${ACCENT_DARK} 0%, ${ACCENT} 100%)`, color: "white", font: `700 0.78rem/1 ${fd}`, cursor: "pointer", boxShadow: "0 10px 20px rgba(37,99,235,0.14)" }}
                >
                  <Save size={13} /> {savedOk ? "Guardado ✓" : "Guardar"}
                </button>
              </div>

              {reactivacionResult && (
                <p style={{ font: `500 0.75rem/1 ${fb}`, color: reactivacionResult.ok ? ACCENT : "#DC2626", textAlign: "right" }}>
                  {reactivacionResult.msg}
                </p>
              )}
            </div>
          )}
        </div>
      </div>

    </div>
  );
}
