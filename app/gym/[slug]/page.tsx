"use client";

import { useEffect, useState } from "react";
import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
);

type GymData = {
  gym_id: string;
  gym_name: string | null;
  logo_url: string | null;
  accent_color: string | null;
  landing_title: string | null;
  landing_desc: string | null;
};

export default function GymLandingPage({ params }: { params: { slug: string } }) {
  const [gym,      setGym]      = useState<GymData | null>(null);
  const [loading,  setLoading]  = useState(true);
  const [notFound, setNotFound] = useState(false);

  const [name,    setName]    = useState("");
  const [phone,   setPhone]   = useState("");
  const [email,   setEmail]   = useState("");
  const [sending, setSending] = useState(false);
  const [done,    setDone]    = useState(false);
  const [error,   setError]   = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      const { data } = await supabase
        .from("gym_settings")
        .select("gym_id, gym_name, logo_url, accent_color, landing_title, landing_desc")
        .eq("slug", params.slug)
        .maybeSingle();

      if (!data) { setNotFound(true); setLoading(false); return; }
      setGym(data);
      setLoading(false);
    })();
  }, [params.slug]);

  const ACCENT = gym?.accent_color ?? "#F97316";

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!gym) return;
    setSending(true);
    setError(null);

    const res  = await fetch("/api/gym/lead", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ gymId: gym.gym_id, name: name.trim(), phone: phone.trim(), email: email.trim() }),
    });
    const data = await res.json();

    if (!res.ok) { setError(data.error ?? "Error al enviar. Intentá de nuevo."); setSending(false); return; }
    setDone(true);
    setSending(false);
  };

  if (loading) return (
    <div style={{ minHeight: "100vh", background: "#0d1117", display: "flex", alignItems: "center", justifyContent: "center" }}>
      <p style={{ color: "rgba(255,255,255,.4)", fontFamily: "system-ui" }}>Cargando…</p>
    </div>
  );

  if (notFound) return (
    <div style={{ minHeight: "100vh", background: "#0d1117", display: "flex", alignItems: "center", justifyContent: "center" }}>
      <p style={{ color: "rgba(255,255,255,.4)", fontFamily: "system-ui" }}>Página no encontrada.</p>
    </div>
  );

  return (
    <div style={{ minHeight: "100vh", background: "#0d1117", fontFamily: "system-ui, sans-serif", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", padding: "40px 20px" }}>

      {/* Hero */}
      <div style={{ maxWidth: 480, width: "100%", textAlign: "center", marginBottom: 40 }}>
        {gym?.logo_url && (
          <img src={gym.logo_url} alt="Logo" style={{ height: 64, objectFit: "contain", marginBottom: 24 }} />
        )}
        <h1 style={{ color: "#fff", fontSize: "clamp(1.8rem, 5vw, 2.4rem)", fontWeight: 800, lineHeight: 1.1, margin: "0 0 16px", letterSpacing: "-0.02em" }}>
          {gym?.landing_title ?? "Probá una clase gratis."}
        </h1>
        <p style={{ color: "rgba(255,255,255,.55)", fontSize: "1rem", lineHeight: 1.6, margin: 0 }}>
          {gym?.landing_desc ?? "Vení a conocernos. Te esperamos con una clase de bienvenida totalmente gratis."}
        </p>
      </div>

      {/* Card */}
      <div style={{ maxWidth: 420, width: "100%", background: "#161b22", borderRadius: 20, padding: "32px 28px", border: "1px solid rgba(255,255,255,.07)", boxShadow: "0 20px 60px rgba(0,0,0,.4)" }}>
        {done ? (
          <div style={{ textAlign: "center", padding: "12px 0" }}>
            <div style={{ fontSize: "3rem", marginBottom: 16 }}>🎉</div>
            <h2 style={{ color: "#fff", fontWeight: 700, fontSize: "1.2rem", margin: "0 0 10px" }}>
              ¡Listo, {name.split(" ")[0]}!
            </h2>
            <p style={{ color: "rgba(255,255,255,.5)", fontSize: ".88rem", lineHeight: 1.6, margin: 0 }}>
              Te vamos a contactar por WhatsApp para coordinar tu clase. ¡Nos vemos pronto! 💪
            </p>
          </div>
        ) : (
          <form onSubmit={submit} style={{ display: "flex", flexDirection: "column", gap: 14 }}>
            <h2 style={{ color: "#fff", fontWeight: 700, fontSize: "1.1rem", margin: "0 0 6px", textAlign: "center" }}>
              Agendá tu clase gratis
            </h2>

            {/* Nombre */}
            <div>
              <label style={{ display: "block", color: "rgba(255,255,255,.55)", fontSize: ".75rem", fontWeight: 600, marginBottom: 6, textTransform: "uppercase", letterSpacing: ".06em" }}>
                Nombre completo *
              </label>
              <input
                required
                value={name}
                onChange={e => setName(e.target.value)}
                placeholder="Carlos Mendez"
                style={inputStyle}
              />
            </div>

            {/* Email */}
            <div>
              <label style={{ display: "block", color: "rgba(255,255,255,.55)", fontSize: ".75rem", fontWeight: 600, marginBottom: 6, textTransform: "uppercase", letterSpacing: ".06em" }}>
                Email *
              </label>
              <input
                required
                type="email"
                value={email}
                onChange={e => setEmail(e.target.value)}
                placeholder="carlos@email.com"
                style={inputStyle}
              />
            </div>

            {/* Teléfono */}
            <div>
              <label style={{ display: "block", color: "rgba(255,255,255,.55)", fontSize: ".75rem", fontWeight: 600, marginBottom: 6, textTransform: "uppercase", letterSpacing: ".06em" }}>
                WhatsApp *
              </label>
              <input
                required
                type="tel"
                value={phone}
                onChange={e => setPhone(e.target.value)}
                placeholder="5491112345678"
                style={inputStyle}
              />
              <p style={{ color: "rgba(255,255,255,.25)", fontSize: ".7rem", marginTop: 5 }}>
                Código de país sin + ni espacios
              </p>
            </div>

            {error && (
              <p style={{ color: "#f87171", fontSize: ".8rem", margin: 0 }}>{error}</p>
            )}

            <button
              type="submit"
              disabled={sending}
              style={{
                marginTop: 4,
                padding: "14px",
                borderRadius: 12,
                border: "none",
                background: ACCENT,
                color: "#fff",
                fontWeight: 700,
                fontSize: "1rem",
                cursor: sending ? "wait" : "pointer",
                opacity: sending ? .7 : 1,
                boxShadow: `0 4px 20px ${ACCENT}55`,
                transition: "opacity .15s",
              }}
            >
              {sending ? "Enviando…" : "Quiero mi clase gratis →"}
            </button>

            <p style={{ color: "rgba(255,255,255,.2)", fontSize: ".68rem", textAlign: "center", margin: 0 }}>
              Sin compromisos. Te contactamos por WhatsApp.
            </p>
          </form>
        )}
      </div>
    </div>
  );
}

const inputStyle: React.CSSProperties = {
  width: "100%",
  padding: "12px 14px",
  background: "rgba(255,255,255,.06)",
  border: "1px solid rgba(255,255,255,.1)",
  borderRadius: 10,
  color: "#fff",
  fontSize: ".875rem",
  outline: "none",
  boxSizing: "border-box",
};
