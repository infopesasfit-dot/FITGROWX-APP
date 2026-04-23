"use client";

import { useState } from "react";
import { Building2, Mail, Lock, CreditCard, Zap, ChevronRight, Save } from "lucide-react";
import { supabase } from "@/lib/supabase";

const fd = "var(--font-inter, 'Inter', sans-serif)";
const fb = "var(--font-inter, 'Inter', sans-serif)";
const t1 = "#1A1D23";
const t2 = "#6B7280";
const t3 = "#9CA3AF";
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

  const handleSave = async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;
    const { data: profile } = await supabase.from("profiles").select("gym_id").eq("id", user.id).single();
    if (profile?.gym_id) {
      await supabase.from("gyms").update({ name: gymName }).eq("id", profile.gym_id);
    }
    setSaved(true);
    setTimeout(() => setSaved(false), 2200);
  };

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
            background: "#F97316",
            color: "white", border: "none", padding: "10px 20px",
            borderRadius: 12, font: `700 0.875rem/1 ${fd}`,
            cursor: "pointer", boxShadow: "0 4px 14px rgba(249,115,22,0.25)",
            transition: "background 0.2s",
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
                onFocus={e => (e.currentTarget.style.borderColor = "#F97316")}
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
                onFocus={e => (e.currentTarget.style.borderColor = "#F97316")}
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

      {/* ── Bloque 2: Métodos de Cobro ── */}
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
              onFocus={e => (e.currentTarget.style.borderColor = "#F97316")}
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
              onFocus={e => (e.currentTarget.style.borderColor = "#F97316")}
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
              onFocus={e => (e.currentTarget.style.borderColor = "#F97316")}
              onBlur={e => (e.currentTarget.style.borderColor = "rgba(0,0,0,0.08)")}
            />
          </div>
        )}

        <div style={{ marginTop: 14, display: "flex", alignItems: "center", gap: 8, padding: "10px 14px", background: "rgba(249,115,22,0.05)", borderRadius: 10, border: "1px solid rgba(249,115,22,0.15)" }}>
          <Zap size={13} color="#F97316" style={{ flexShrink: 0 }} />
          <p style={{ font: `400 0.78rem/1.4 ${fb}`, color: "#F97316" }}>
            Este dato se incluirá automáticamente al final de cada recordatorio de vencimiento enviado a tus alumnos.
          </p>
        </div>
      </div>

    </div>
  );
}
