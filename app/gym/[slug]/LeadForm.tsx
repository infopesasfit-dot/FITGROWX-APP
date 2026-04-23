"use client";

import { useState } from "react";
import { createClient } from "@supabase/supabase-js";
import { ChevronRight, CheckCircle } from "lucide-react";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

const fb = "system-ui, -apple-system, 'Helvetica Neue', sans-serif";
const fd = "'Nunito', system-ui, -apple-system, sans-serif";

interface Props {
  gymId: string;
  accentColor: string;
  gymName: string;
}

export default function LeadForm({ gymId, accentColor, gymName }: Props) {
  const [name,      setName]      = useState("");
  const [phone,     setPhone]     = useState("");
  const [submitted, setSubmitted] = useState(false);
  const [loading,   setLoading]   = useState(false);
  const [error,     setError]     = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim() || !phone.trim()) return;
    setLoading(true);
    setError(null);

    const { error: err } = await supabase.from("prospectos").insert({
      gym_id:    gymId,
      full_name: name.trim(),
      phone:     phone.trim(),
      status:    "pendiente",
    });

    if (err) {
      setError("Hubo un error. Por favor intentá de nuevo.");
      setLoading(false);
      return;
    }

    setSubmitted(true);
    setLoading(false);
  };

  if (submitted) {
    return (
      <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 16, padding: "32px 0" }}>
        <div style={{ width: 64, height: 64, borderRadius: "50%", background: `${accentColor}15`, border: `2px solid ${accentColor}30`, display: "flex", alignItems: "center", justifyContent: "center" }}>
          <CheckCircle size={30} color={accentColor} />
        </div>
        <div style={{ textAlign: "center" as const }}>
          <p style={{ fontFamily: fd, fontWeight: 700, fontSize: "1.25rem", color: "#1C1C1E", letterSpacing: "-0.02em", marginBottom: 8 }}>
            ¡Listo, {name.split(" ")[0]}!
          </p>
          <p style={{ fontFamily: fb, fontWeight: 400, fontSize: "0.9rem", color: "#636366", lineHeight: 1.6, maxWidth: 280 }}>
            Te contactamos a la brevedad para coordinar tu clase gratis en <strong style={{ color: "#1C1C1E" }}>{gymName}</strong>. ¡Nos vemos pronto!
          </p>
        </div>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} style={{ display: "flex", flexDirection: "column", gap: 12 }}>
      <div>
        <label style={{ display: "block", fontFamily: fb, fontWeight: 500, fontSize: "0.78rem", color: "#636366", marginBottom: 6, letterSpacing: "0.02em" }}>
          Nombre
        </label>
        <input
          type="text"
          value={name}
          onChange={e => setName(e.target.value)}
          placeholder="Tu nombre completo"
          required
          style={{
            width: "100%", padding: "13px 16px",
            border: "1.5px solid #E5E5EA", borderRadius: 12,
            fontFamily: fb, fontSize: "0.95rem", color: "#1C1C1E",
            background: "#FAFAFA", outline: "none",
            boxSizing: "border-box" as const, transition: "border-color 0.15s",
          }}
          onFocus={e => (e.currentTarget.style.borderColor = accentColor)}
          onBlur={e => (e.currentTarget.style.borderColor = "#E5E5EA")}
        />
      </div>

      <div>
        <label style={{ display: "block", fontFamily: fb, fontWeight: 500, fontSize: "0.78rem", color: "#636366", marginBottom: 6, letterSpacing: "0.02em" }}>
          WhatsApp
        </label>
        <input
          type="tel"
          value={phone}
          onChange={e => setPhone(e.target.value)}
          placeholder="+54 9 11 1234-5678"
          required
          style={{
            width: "100%", padding: "13px 16px",
            border: "1.5px solid #E5E5EA", borderRadius: 12,
            fontFamily: fb, fontSize: "0.95rem", color: "#1C1C1E",
            background: "#FAFAFA", outline: "none",
            boxSizing: "border-box" as const, transition: "border-color 0.15s",
          }}
          onFocus={e => (e.currentTarget.style.borderColor = accentColor)}
          onBlur={e => (e.currentTarget.style.borderColor = "#E5E5EA")}
        />
      </div>

      {error && (
        <p style={{ fontFamily: fb, fontSize: "0.8rem", color: "#DC2626", padding: "8px 12px", background: "rgba(220,38,38,0.06)", borderRadius: 8 }}>
          {error}
        </p>
      )}

      <button
        type="submit"
        disabled={loading || !name.trim() || !phone.trim()}
        style={{
          width: "100%", display: "flex", alignItems: "center", justifyContent: "center", gap: 8,
          padding: "15px 24px", borderRadius: 9999, border: "none",
          background: loading || !name.trim() || !phone.trim() ? "#AEAEB2" : accentColor,
          color: "white", fontFamily: fd, fontWeight: 700, fontSize: "1rem",
          letterSpacing: "-0.01em", cursor: loading || !name.trim() || !phone.trim() ? "default" : "pointer",
          boxShadow: loading || !name.trim() || !phone.trim() ? "none" : `0 4px 20px ${accentColor}50`,
          transition: "all 0.18s", marginTop: 4,
        }}
      >
        {loading ? "Enviando…" : "Agendar Clase Gratis"}
        {!loading && <ChevronRight size={18} strokeWidth={2.5} />}
      </button>

      <p style={{ textAlign: "center" as const, fontFamily: fb, fontSize: "0.72rem", color: "#AEAEB2", marginTop: 4 }}>
        100% gratis · Sin tarjeta requerida · Sin compromiso
      </p>
    </form>
  );
}
