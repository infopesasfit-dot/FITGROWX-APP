"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { Building2, Mail, Lock, CreditCard, Zap, ChevronRight, Save, ImagePlus, Star, Trash2, Upload, AlertTriangle, ExternalLink } from "lucide-react";
import { supabase } from "@/lib/supabase";

const fd = "var(--font-inter, 'Inter', sans-serif)";
const fb = "var(--font-inter, 'Inter', sans-serif)";
const t1 = "#1A1D23";
const t2 = "#6B7280";
const t3 = "#9CA3AF";
const ORANGE = "#F97316";

const card = {
  background: "#FFFFFF",
  border: "1px solid rgba(0,0,0,0.05)",
  borderRadius: 14,
  boxShadow: "0 2px 8px rgba(0,0,0,0.06), 0 0 1px rgba(0,0,0,0.04)",
};

const inputStyle = {
  width: "100%",
  padding: "11px 14px",
  background: "#F0F2F8",
  border: "1px solid rgba(0,0,0,0.08)",
  borderRadius: 10,
  font: `400 0.875rem/1 ${fb}`,
  color: t1,
  outline: "none",
  boxSizing: "border-box" as const,
  transition: "border-color 0.14s",
};

function SectionHeader({ icon, title, desc }: { icon: React.ReactNode; title: string; desc: string }) {
  return (
    <div style={{ display: "flex", alignItems: "flex-start", gap: 14, marginBottom: 24 }}>
      <div style={{ width: 40, height: 40, borderRadius: 10, background: "#2C2C2E", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
        {icon}
      </div>
      <div>
        <h2 style={{ font: `700 1rem/1 ${fd}`, color: t1, marginBottom: 4 }}>{title}</h2>
        <p style={{ font: `400 0.82rem/1.4 ${fb}`, color: t2 }}>{desc}</p>
      </div>
    </div>
  );
}

export default function AjustesPage() {
  const [gymName, setGymName] = useState("Power House Gym");
  const [email,   setEmail]   = useState("admin@gym.com");

  const [metodo, setMetodo] = useState<"alias" | "cbu" | "mp">("alias");
  const [alias,  setAlias]  = useState("");
  const [cbu,    setCbu]    = useState("");
  const [mpLink, setMpLink] = useState("");

  const [saved, setSaved] = useState(false);

  // Brand / logo state
  const [gymId,         setGymId]         = useState<string | null>(null);
  const [planType,      setPlanType]       = useState<string | null>(null);
  const [isTrial,       setIsTrial]        = useState(false);
  const [trialDaysLeft, setTrialDaysLeft]  = useState<number | null>(null);
  const [logoUrl,       setLogoUrl]        = useState<string | null>(null);
  const [logoPreview,   setLogoPreview]    = useState<string | null>(null);
  const [logoFile,      setLogoFile]       = useState<File | null>(null);
  const [uploading,     setUploading]      = useState(false);
  const [logoSaved,     setLogoSaved]      = useState(false);
  const [logoError,     setLogoError]      = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Load user data
  useEffect(() => {
    (async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      setGymId(user.id);

      const [{ data: profile }, { data: settings }] = await Promise.all([
        supabase.from("profiles")
          .select("gym_id, gyms(trial_expires_at, is_subscription_active, plan_type)")
          .eq("id", user.id)
          .maybeSingle(),
        supabase.from("gym_settings")
          .select("gym_name, logo_url")
          .eq("gym_id", user.id)
          .maybeSingle(),
      ]);

      if (settings?.gym_name) setGymName(settings.gym_name);
      if (settings?.logo_url) setLogoUrl(settings.logo_url);

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const gym = Array.isArray(profile?.gyms) ? profile?.gyms[0] : (profile?.gyms as any);
      if (gym) {
        setPlanType(gym.plan_type ?? null);
        if (!gym.is_subscription_active && gym.trial_expires_at) {
          const diff = new Date(gym.trial_expires_at).getTime() - Date.now();
          const left = Math.max(0, Math.ceil(diff / 86_400_000));
          setTrialDaysLeft(left);
          setIsTrial(left > 0);
        }
      }
    })();
  }, []);

  const canUseBranding = isTrial || planType === "full_marca";

  const handleSave = async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;
    const { data: profile } = await supabase.from("profiles").select("gym_id").eq("id", user.id).single();
    if (profile?.gym_id) {
      await supabase.from("gyms").update({ name: gymName }).eq("id", profile.gym_id);
    }
    await supabase.from("gym_settings").upsert({ gym_id: user.id, gym_name: gymName }, { onConflict: "gym_id" });
    setSaved(true);
    setTimeout(() => setSaved(false), 2200);
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 2 * 1024 * 1024) {
      setLogoError("El archivo no puede superar 2 MB.");
      return;
    }
    if (!file.type.startsWith("image/")) {
      setLogoError("Solo se aceptan imágenes (PNG, JPG, SVG, WEBP).");
      return;
    }
    setLogoError(null);
    setLogoFile(file);
    setLogoPreview(URL.createObjectURL(file));
  };

  const handleLogoUpload = async () => {
    if (!logoFile || !gymId) return;
    setUploading(true);
    setLogoError(null);
    try {
      const ext = logoFile.name.split(".").pop() ?? "png";
      const path = `${gymId}/logo.${ext}`;

      const { error: uploadError } = await supabase.storage
        .from("gym-logos")
        .upload(path, logoFile, { upsert: true, contentType: logoFile.type });

      if (uploadError) throw uploadError;

      const { data: urlData } = supabase.storage.from("gym-logos").getPublicUrl(path);
      const publicUrl = urlData.publicUrl;

      await supabase.from("gym_settings")
        .upsert({ gym_id: gymId, logo_url: publicUrl }, { onConflict: "gym_id" });

      setLogoUrl(publicUrl);
      setLogoFile(null);
      setLogoPreview(null);
      setLogoSaved(true);
      setTimeout(() => setLogoSaved(false), 2500);
    } catch (err) {
      setLogoError(err instanceof Error ? err.message : "Error al subir el logo.");
    } finally {
      setUploading(false);
    }
  };

  const handleLogoRemove = async () => {
    if (!gymId) return;
    await supabase.from("gym_settings")
      .update({ logo_url: null })
      .eq("gym_id", gymId);
    setLogoUrl(null);
    setLogoPreview(null);
    setLogoFile(null);
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  const activeLogoSrc = logoPreview ?? logoUrl;

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 18 }}>

      {/* Header */}
      <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between" }}>
        <div>
          <p style={{ font: `500 0.72rem/1 ${fb}`, color: t3, textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: 6 }}>Configuración</p>
          <h1 style={{ font: `800 2rem/1 ${fd}`, color: t1, letterSpacing: "-0.02em" }}>Ajustes del Gimnasio</h1>
          <p style={{ font: `400 0.875rem/1.4 ${fb}`, color: t2, marginTop: 4 }}>Editá el perfil y los métodos de cobro de tu negocio.</p>
        </div>
        <button
          onClick={handleSave}
          style={{
            display: "flex", alignItems: "center", gap: 6,
            background: ORANGE, color: "white", border: "none",
            padding: "10px 20px", borderRadius: 12,
            font: `700 0.875rem/1 ${fd}`, cursor: "pointer",
            boxShadow: "0 4px 14px rgba(249,115,22,0.25)",
            transition: "opacity 0.2s",
          }}
          onMouseEnter={e => { if (!saved) e.currentTarget.style.opacity = "0.9"; }}
          onMouseLeave={e => (e.currentTarget.style.opacity = "1")}
        >
          <Save size={15} />
          {saved ? "Guardado ✓" : "Guardar Cambios"}
        </button>
      </div>

      {/* ── Bloque 1: Perfil del Gimnasio ── */}
      <div style={{ ...card, padding: "28px 28px 24px" }}>
        <SectionHeader
          icon={<Building2 size={18} color="white" />}
          title="Perfil del Gimnasio"
          desc="Datos de tu negocio y acceso a tu cuenta."
        />

        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
          <div>
            <label style={{ display: "block", font: `500 0.78rem/1 ${fb}`, color: t1, marginBottom: 6 }}>Nombre del Gimnasio</label>
            <div style={{ position: "relative" }}>
              <Building2 size={14} style={{ position: "absolute", left: 12, top: "50%", transform: "translateY(-50%)", color: t3 }} />
              <input
                value={gymName}
                onChange={e => setGymName(e.target.value)}
                style={{ ...inputStyle, paddingLeft: 34 }}
                onFocus={e => (e.currentTarget.style.borderColor = ORANGE)}
                onBlur={e => (e.currentTarget.style.borderColor = "rgba(0,0,0,0.08)")}
              />
            </div>
          </div>

          <div>
            <label style={{ display: "block", font: `500 0.78rem/1 ${fb}`, color: t1, marginBottom: 6 }}>Email de Contacto</label>
            <div style={{ position: "relative" }}>
              <Mail size={14} style={{ position: "absolute", left: 12, top: "50%", transform: "translateY(-50%)", color: t3 }} />
              <input
                type="email"
                value={email}
                onChange={e => setEmail(e.target.value)}
                style={{ ...inputStyle, paddingLeft: 34 }}
                onFocus={e => (e.currentTarget.style.borderColor = ORANGE)}
                onBlur={e => (e.currentTarget.style.borderColor = "rgba(0,0,0,0.08)")}
              />
            </div>
          </div>
        </div>

        <div style={{ marginTop: 20, paddingTop: 20, borderTop: "1px solid rgba(0,0,0,0.06)", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <div>
            <p style={{ font: `600 0.83rem/1 ${fb}`, color: t1, marginBottom: 3 }}>Contraseña</p>
            <p style={{ font: `400 0.75rem/1 ${fb}`, color: t3 }}>Última actualización hace 3 meses</p>
          </div>
          <button
            style={{
              display: "flex", alignItems: "center", gap: 6,
              background: "#F0F2F8", color: t2, border: "1px solid rgba(0,0,0,0.08)",
              padding: "9px 16px", borderRadius: 10,
              font: `600 0.8rem/1 ${fb}`, cursor: "pointer",
              transition: "all 0.14s",
            }}
            onMouseEnter={e => { e.currentTarget.style.background = "#E4E6EF"; e.currentTarget.style.color = t1; }}
            onMouseLeave={e => { e.currentTarget.style.background = "#F0F2F8"; e.currentTarget.style.color = t2; }}
          >
            <Lock size={13} /> Cambiar Contraseña <ChevronRight size={13} />
          </button>
        </div>
      </div>

      {/* ── Bloque 2: Marca del Gym ── */}
      <div style={{ ...card, padding: "28px 28px 24px", position: "relative", overflow: "hidden" }}>

        {/* Header del bloque */}
        <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", marginBottom: 24 }}>
          <div style={{ display: "flex", alignItems: "flex-start", gap: 14 }}>
            <div style={{ width: 40, height: 40, borderRadius: 10, background: "#2C2C2E", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
              <ImagePlus size={18} color="white" />
            </div>
            <div>
              <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 4 }}>
                <h2 style={{ font: `700 1rem/1 ${fd}`, color: t1 }}>Logo del Gym</h2>
                {isTrial && trialDaysLeft !== null && (
                  <span style={{
                    padding: "3px 9px", borderRadius: 9999,
                    background: "rgba(249,115,22,0.10)",
                    border: "1px solid rgba(249,115,22,0.25)",
                    font: `600 0.7rem/1 ${fb}`,
                    color: ORANGE,
                  }}>
                    Trial · {trialDaysLeft}d restantes
                  </span>
                )}
                {planType === "full_marca" && !isTrial && (
                  <span style={{
                    display: "flex", alignItems: "center", gap: 4,
                    padding: "3px 9px", borderRadius: 9999,
                    background: "rgba(249,115,22,0.10)",
                    border: "1px solid rgba(249,115,22,0.25)",
                    font: `600 0.7rem/1 ${fb}`,
                    color: ORANGE,
                  }}>
                    <Star size={10} /> Full Marca
                  </span>
                )}
              </div>
              <p style={{ font: `400 0.82rem/1.4 ${fb}`, color: t2 }}>
                Tu logo aparecerá en el sidebar, panel del alumno y tu página pública de reservas.
              </p>
            </div>
          </div>
        </div>

        {canUseBranding ? (
          /* ── Estado: acceso activo ── */
          <div>
            <div style={{ display: "flex", alignItems: "flex-start", gap: 20 }}>

              {/* Preview */}
              <div
                style={{
                  width: 120, height: 80, borderRadius: 12, flexShrink: 0,
                  border: "1.5px dashed rgba(0,0,0,0.12)",
                  background: "#F7F8FC",
                  display: "flex", alignItems: "center", justifyContent: "center",
                  overflow: "hidden", position: "relative",
                }}
              >
                {activeLogoSrc ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={activeLogoSrc}
                    alt="Logo preview"
                    style={{ maxWidth: "90%", maxHeight: "90%", objectFit: "contain" }}
                  />
                ) : (
                  <div style={{ textAlign: "center" }}>
                    <ImagePlus size={22} color={t3} style={{ margin: "0 auto 4px" }} />
                    <p style={{ font: `400 0.65rem/1 ${fb}`, color: t3 }}>Sin logo</p>
                  </div>
                )}
                {logoPreview && (
                  <span style={{
                    position: "absolute", top: 4, right: 4,
                    background: ORANGE, color: "white",
                    font: `700 0.58rem/1 ${fb}`,
                    padding: "2px 6px", borderRadius: 6,
                  }}>
                    Preview
                  </span>
                )}
              </div>

              {/* Controls */}
              <div style={{ flex: 1 }}>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/png,image/jpeg,image/jpg,image/svg+xml,image/webp"
                  onChange={handleFileSelect}
                  style={{ display: "none" }}
                  id="logo-file-input"
                />

                <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
                  <label
                    htmlFor="logo-file-input"
                    style={{
                      display: "inline-flex", alignItems: "center", gap: 6,
                      padding: "9px 16px", borderRadius: 10, cursor: "pointer",
                      background: "#F0F2F8", border: "1px solid rgba(0,0,0,0.08)",
                      font: `600 0.8rem/1 ${fb}`, color: t1,
                      transition: "all 0.14s",
                    }}
                    onMouseEnter={e => { e.currentTarget.style.background = "#E4E6EF"; }}
                    onMouseLeave={e => { e.currentTarget.style.background = "#F0F2F8"; }}
                  >
                    <Upload size={13} /> Elegir imagen
                  </label>

                  {logoFile && (
                    <button
                      onClick={handleLogoUpload}
                      disabled={uploading}
                      style={{
                        display: "inline-flex", alignItems: "center", gap: 6,
                        padding: "9px 16px", borderRadius: 10, border: "none", cursor: "pointer",
                        background: uploading ? "#ccc" : ORANGE, color: "white",
                        font: `700 0.8rem/1 ${fd}`,
                        boxShadow: uploading ? "none" : "0 4px 12px rgba(249,115,22,0.25)",
                        transition: "all 0.14s",
                      }}
                    >
                      <Save size={13} />
                      {uploading ? "Subiendo..." : "Guardar logo"}
                    </button>
                  )}

                  {logoUrl && !logoFile && (
                    <button
                      onClick={handleLogoRemove}
                      style={{
                        display: "inline-flex", alignItems: "center", gap: 6,
                        padding: "9px 16px", borderRadius: 10,
                        background: "transparent", color: "#EF4444",
                        border: "1px solid rgba(239,68,68,0.2)", cursor: "pointer",
                        font: `600 0.8rem/1 ${fb}`, transition: "all 0.14s",
                      }}
                      onMouseEnter={e => { e.currentTarget.style.background = "rgba(239,68,68,0.05)"; }}
                      onMouseLeave={e => { e.currentTarget.style.background = "transparent"; }}
                    >
                      <Trash2 size={13} /> Quitar logo
                    </button>
                  )}
                </div>

                <p style={{ font: `400 0.73rem/1.5 ${fb}`, color: t3, marginTop: 10 }}>
                  PNG, JPG, SVG o WEBP · Máx. 2 MB · Fondo transparente recomendado
                </p>

                {logoSaved && (
                  <p style={{ font: `600 0.78rem/1 ${fb}`, color: "#22c55e", marginTop: 8 }}>
                    ✓ Logo guardado correctamente
                  </p>
                )}

                {logoError && (
                  <p style={{ font: `500 0.78rem/1 ${fb}`, color: "#EF4444", marginTop: 8 }}>
                    {logoError}
                  </p>
                )}
              </div>
            </div>

            {/* Aviso trial */}
            {isTrial && (
              <div style={{
                marginTop: 18,
                display: "flex", alignItems: "center", gap: 8,
                padding: "10px 14px",
                background: "rgba(249,115,22,0.05)",
                borderRadius: 10,
                border: "1px solid rgba(249,115,22,0.15)",
              }}>
                <Zap size={13} color={ORANGE} style={{ flexShrink: 0 }} />
                <p style={{ font: `400 0.78rem/1.4 ${fb}`, color: ORANGE }}>
                  Disponible durante el trial. Al finalizar, esta función requiere el <strong>Plan Full Marca</strong>.
                </p>
              </div>
            )}
          </div>
        ) : (
          /* ── Estado: plan no incluye branding ── */
          <div style={{
            padding: "28px 24px", borderRadius: 12, textAlign: "center",
            background: "linear-gradient(135deg, #F7F8FC 0%, #F0F2F8 100%)",
            border: "1.5px dashed rgba(0,0,0,0.10)",
          }}>
            <div style={{
              width: 48, height: 48, borderRadius: 12, margin: "0 auto 14px",
              background: "rgba(249,115,22,0.08)", border: "1px solid rgba(249,115,22,0.18)",
              display: "flex", alignItems: "center", justifyContent: "center",
            }}>
              <Star size={20} color={ORANGE} />
            </div>
            <p style={{ font: `700 0.95rem/1 ${fd}`, color: t1, marginBottom: 6 }}>
              Función exclusiva del Plan Full Marca
            </p>
            <p style={{ font: `400 0.82rem/1.5 ${fb}`, color: t2, maxWidth: 340, margin: "0 auto 20px" }}>
              Subí el logo de tu gym y mostralo en el panel, la app del alumno y tu página de reservas. Sin marca de FitGrowX.
            </p>
            <a
              href="/dashboard/suscripcion"
              style={{
                display: "inline-flex", alignItems: "center", gap: 6,
                padding: "11px 22px", borderRadius: 12,
                background: ORANGE, color: "white", textDecoration: "none",
                font: `700 0.875rem/1 ${fd}`,
                boxShadow: "0 4px 14px rgba(249,115,22,0.28)",
                transition: "opacity 0.2s",
              }}
              onMouseEnter={e => (e.currentTarget.style.opacity = "0.9")}
              onMouseLeave={e => (e.currentTarget.style.opacity = "1")}
            >
              <Star size={14} /> Ver Plan Full Marca
            </a>
          </div>
        )}
      </div>

      {/* ── Bloque 3: Métodos de Cobro ── */}
      <div style={{ ...card, padding: "28px 28px 24px" }}>
        <SectionHeader
          icon={<CreditCard size={18} color="white" />}
          title="Métodos de Cobro"
          desc="Esta info se adjuntará automáticamente en los recordatorios enviados a tus alumnos."
        />

        <div style={{ display: "flex", gap: 8, marginBottom: 20 }}>
          {([
            { key: "alias", label: "Alias CBU" },
            { key: "cbu",   label: "CBU / CVU" },
            { key: "mp",    label: "Mercado Pago" },
          ] as { key: "alias" | "cbu" | "mp"; label: string }[]).map(m => (
            <button
              key={m.key}
              onClick={() => setMetodo(m.key)}
              style={{
                padding: "8px 18px", borderRadius: 9999, border: "none",
                font: `600 0.8rem/1 ${fb}`, cursor: "pointer", transition: "all 0.14s",
                background: metodo === m.key ? "#2C2C2E" : "#F0F2F8",
                color: metodo === m.key ? "white" : t2,
              }}
            >
              {m.label}
            </button>
          ))}
        </div>

        {metodo === "alias" && (
          <div>
            <label style={{ display: "block", font: `500 0.78rem/1 ${fb}`, color: t1, marginBottom: 6 }}>Tu Alias</label>
            <input
              value={alias}
              onChange={e => setAlias(e.target.value)}
              placeholder="mi.gym.alias"
              style={inputStyle}
              onFocus={e => (e.currentTarget.style.borderColor = ORANGE)}
              onBlur={e => (e.currentTarget.style.borderColor = "rgba(0,0,0,0.08)")}
            />
          </div>
        )}

        {metodo === "cbu" && (
          <div>
            <label style={{ display: "block", font: `500 0.78rem/1 ${fb}`, color: t1, marginBottom: 6 }}>CBU / CVU (22 dígitos)</label>
            <input
              value={cbu}
              onChange={e => setCbu(e.target.value)}
              placeholder="0000000000000000000000"
              maxLength={22}
              style={inputStyle}
              onFocus={e => (e.currentTarget.style.borderColor = ORANGE)}
              onBlur={e => (e.currentTarget.style.borderColor = "rgba(0,0,0,0.08)")}
            />
          </div>
        )}

        {metodo === "mp" && (
          <div>
            <label style={{ display: "block", font: `500 0.78rem/1 ${fb}`, color: t1, marginBottom: 6 }}>Link de pago de Mercado Pago</label>
            <input
              value={mpLink}
              onChange={e => setMpLink(e.target.value)}
              placeholder="https://mpago.la/tu-link"
              style={inputStyle}
              onFocus={e => (e.currentTarget.style.borderColor = ORANGE)}
              onBlur={e => (e.currentTarget.style.borderColor = "rgba(0,0,0,0.08)")}
            />
          </div>
        )}

        <div style={{ marginTop: 14, display: "flex", alignItems: "center", gap: 8, padding: "10px 14px", background: "rgba(249,115,22,0.05)", borderRadius: 10, border: "1px solid rgba(249,115,22,0.15)" }}>
          <Zap size={13} color={ORANGE} style={{ flexShrink: 0 }} />
          <p style={{ font: `400 0.78rem/1.4 ${fb}`, color: ORANGE }}>
            Este dato se incluirá automáticamente al final de cada recordatorio de vencimiento enviado a tus alumnos.
          </p>
        </div>
      </div>

      {/* ── Bloque 4: Suscripción y Cancelación ── */}
      <div style={{ ...card, padding: "28px 28px 24px" }}>
        <SectionHeader
          icon={<AlertTriangle size={18} color="white" />}
          title="Suscripción y Cancelación"
          desc="Gestioná tu plan activo o cancelá tu suscripción."
        />

        <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>

          {/* Ir a suscripción */}
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "16px 18px", borderRadius: 12, background: "#F7F8FC", border: "1px solid rgba(0,0,0,0.06)" }}>
            <div>
              <p style={{ font: `600 0.88rem/1 ${fd}`, color: t1, marginBottom: 3 }}>Ver o cambiar plan</p>
              <p style={{ font: `400 0.75rem/1.4 ${fb}`, color: t2 }}>Consultá tu plan actual o actualizá tu suscripción.</p>
            </div>
            <a
              href="/dashboard/suscripcion"
              style={{
                display: "inline-flex", alignItems: "center", gap: 6,
                padding: "9px 16px", borderRadius: 10, textDecoration: "none",
                background: "#1A1D23", color: "white",
                font: `600 0.8rem/1 ${fd}`, flexShrink: 0,
                transition: "opacity 0.15s",
              }}
              onMouseEnter={e => (e.currentTarget.style.opacity = "0.85")}
              onMouseLeave={e => (e.currentTarget.style.opacity = "1")}
            >
              Ver suscripción <ChevronRight size={13} />
            </a>
          </div>

          {/* Cancelación */}
          <div style={{ padding: "16px 18px", borderRadius: 12, border: "1px solid rgba(239,68,68,0.15)", background: "rgba(239,68,68,0.03)" }}>
            <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 16 }}>
              <div>
                <p style={{ font: `600 0.88rem/1 ${fd}`, color: "#DC2626", marginBottom: 4 }}>Cancelar suscripción</p>
                <p style={{ font: `400 0.78rem/1.5 ${fb}`, color: t2, maxWidth: 380 }}>
                  Podés cancelar en cualquier momento. Tu acceso se mantiene hasta el final del período ya abonado, sin reintegros proporcionales.
                </p>
                <Link
                  href="/terminos"
                  target="_blank"
                  style={{ display: "inline-flex", alignItems: "center", gap: 4, marginTop: 8, font: `500 0.74rem/1 ${fb}`, color: t3, textDecoration: "none" }}
                >
                  <ExternalLink size={11} /> Ver política de cancelación (sección 5)
                </Link>
              </div>
              <a
                href="mailto:soporte@fitgrowx.com?subject=Solicitud%20de%20cancelación%20de%20suscripción"
                style={{
                  display: "inline-flex", alignItems: "center", gap: 6,
                  padding: "9px 16px", borderRadius: 10, textDecoration: "none", flexShrink: 0,
                  background: "transparent", color: "#DC2626",
                  border: "1px solid rgba(239,68,68,0.3)",
                  font: `600 0.8rem/1 ${fd}`,
                  transition: "all 0.15s",
                }}
                onMouseEnter={e => { e.currentTarget.style.background = "rgba(239,68,68,0.06)"; }}
                onMouseLeave={e => { e.currentTarget.style.background = "transparent"; }}
              >
                Solicitar cancelación
              </a>
            </div>
          </div>

        </div>
      </div>

    </div>
  );
}
