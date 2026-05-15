"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
);

const fd = "'Inter', system-ui, sans-serif";
const DAYS_ES = ["Dom", "Lun", "Mar", "Mié", "Jue", "Vie", "Sáb"];
const DAYS_FULL = ["Domingo", "Lunes", "Martes", "Miércoles", "Jueves", "Viernes", "Sábado"];
const MONTHS_ES = ["Enero","Febrero","Marzo","Abril","Mayo","Junio","Julio","Agosto","Septiembre","Octubre","Noviembre","Diciembre"];

type GymClass = { id: string; class_name: string; day_of_week: number; start_time: string; coach_name: string | null };
type GymData  = { gym_id: string; gym_name: string | null; accent_color: string | null; logo_url: string | null };
type Slot     = { date: string; dow: number; label: string; shortLabel: string; classes: GymClass[] }
type Selection = { slot: Slot; clase: GymClass | null };

function next14Days(): { iso: string; dow: number; label: string; shortLabel: string }[] {
  const days = [];
  for (let i = 1; i <= 14; i++) {
    const d = new Date();
    d.setDate(d.getDate() + i);
    const iso = d.toISOString().slice(0, 10);
    const dow = d.getDay();
    days.push({
      iso,
      dow,
      label:      `${DAYS_FULL[dow]} ${d.getDate()} de ${MONTHS_ES[d.getMonth()]}`,
      shortLabel: `${DAYS_ES[dow]} ${d.getDate()}/${d.getMonth() + 1}`,
    });
  }
  return days;
}

export default function ReservarPage() {
  const params = useParams<{ slug: string }>();
  const slug   = typeof params?.slug === "string" ? params.slug : "";

  const [gym,       setGym]       = useState<GymData | null>(null);
  const [classes,   setClasses]   = useState<GymClass[]>([]);
  const [loading,   setLoading]   = useState(true);
  const [notFound,  setNotFound]  = useState(false);

  const [step,      setStep]      = useState<"phone" | "slots" | "confirm" | "done">("phone");
  const [phone,     setPhone]     = useState("");
  const [inputName, setInputName] = useState("");
  const [nombre,    setNombre]    = useState("");
  const [selected,  setSelected]  = useState<Selection | null>(null);
  const [saving,    setSaving]    = useState(false);
  const [error,     setError]     = useState<string | null>(null);
  const [lookingUp, setLookingUp] = useState(false);

  useEffect(() => {
    if (!slug) return;
    (async () => {
      const { data } = await supabase
        .from("gym_settings")
        .select("gym_id, gym_name, accent_color, logo_url")
        .eq("slug", slug)
        .maybeSingle();
      if (!data) { setNotFound(true); setLoading(false); return; }
      setGym(data);

      const { data: cls } = await supabase
        .from("gym_classes")
        .select("id, class_name, day_of_week, start_time, coach_name")
        .eq("gym_id", data.gym_id)
        .order("start_time");
      setClasses(cls ?? []);
      setLoading(false);
    })();
  }, [slug]);

  const ACCENT    = gym?.accent_color ?? "#F97316";
  const freeMode  = classes.length === 0;

  const slots: Slot[] = next14Days()
    .map(d => ({
      date:       d.iso,
      dow:        d.dow,
      label:      d.label,
      shortLabel: d.shortLabel,
      classes:    classes.filter(c => c.day_of_week === d.dow),
    }))
    .filter(s => freeMode || s.classes.length > 0);

  const handlePhoneSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!gym || !phone.trim()) return;
    setLookingUp(true); setError(null);
    const res  = await fetch("/api/gym/reservar-clase-gratis", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ gym_id: gym.gym_id, phone: phone.trim(), name: inputName.trim() || undefined }),
    });
    const data = await res.json();
    setLookingUp(false);
    if (!res.ok) { setError(data.error ?? "No se pudo verificar tu número."); return; }
    setNombre(data.nombre);
    setStep("slots");
  };

  const handleConfirm = async () => {
    if (!gym || !selected) return;
    setSaving(true); setError(null);
    const res  = await fetch("/api/gym/reservar-clase-gratis", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        gym_id:       gym.gym_id,
        phone:        phone.trim(),
        fecha:        selected.slot.date,
        ...(selected.clase ? {
          clase_id:    selected.clase.id,
          hora:        selected.clase.start_time,
          clase_nombre: selected.clase.class_name,
        } : {}),
      }),
    });
    const data = await res.json();
    setSaving(false);
    if (!res.ok) { setError(data.error ?? "No se pudo guardar la reserva."); return; }
    setStep("done");
  };

  if (loading) return (
    <div style={{ minHeight: "100dvh", background: "#0D1117", display: "flex", alignItems: "center", justifyContent: "center" }}>
      <div style={{ width: 36, height: 36, borderRadius: "50%", border: `3px solid ${ACCENT}`, borderTopColor: "transparent", animation: "spin 0.8s linear infinite" }} />
      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </div>
  );

  if (notFound || !gym) return (
    <div style={{ minHeight: "100dvh", background: "#0D1117", display: "flex", alignItems: "center", justifyContent: "center", fontFamily: fd }}>
      <p style={{ color: "rgba(255,255,255,.35)" }}>Página no encontrada.</p>
    </div>
  );

  return (
    <div style={{ minHeight: "100dvh", background: "#0D1117", fontFamily: fd, display: "flex", flexDirection: "column", alignItems: "center", padding: "48px 20px 80px" }}>
      <style>{`@keyframes spin { to { transform: rotate(360deg); } } @keyframes fadeUp { from { opacity:0; transform:translateY(8px); } to { opacity:1; transform:translateY(0); } }`}</style>

      <div style={{ width: "100%", maxWidth: 480, animation: "fadeUp .3s ease" }}>
        {/* Header */}
        <div style={{ textAlign: "center", marginBottom: 32 }}>
          {gym.logo_url
            ? <img src={gym.logo_url} alt={gym.gym_name ?? ""} style={{ height: 44, maxWidth: 160, objectFit: "contain", margin: "0 auto 16px", display: "block" }} />
            : <p style={{ font: `800 0.72rem/1 ${fd}`, color: ACCENT, letterSpacing: ".14em", textTransform: "uppercase", marginBottom: 16 }}>{gym.gym_name}</p>
          }
          <h1 style={{ font: `800 1.6rem/1.1 ${fd}`, color: "#FFFFFF", letterSpacing: "-0.03em", margin: "0 0 8px" }}>
            {step === "done" ? "¡Clase confirmada!" : "Agendá tu clase de prueba"}
          </h1>
          {step === "phone" && (
            <p style={{ font: `400 0.875rem/1.6 ${fd}`, color: "rgba(255,255,255,.4)", margin: 0 }}>
              Ingresá tu WhatsApp para ver los horarios disponibles.
            </p>
          )}
          {step === "slots" && (
            <p style={{ font: `400 0.875rem/1.6 ${fd}`, color: "rgba(255,255,255,.4)", margin: 0 }}>
              Hola <span style={{ color: "#FFFFFF", fontWeight: 600 }}>{nombre}</span>,{" "}
              {freeMode ? "elegí el día que querés venir." : "elegí el día y horario."}
            </p>
          )}
        </div>

        {/* Step: phone */}
        {step === "phone" && (
          <form onSubmit={handlePhoneSubmit} style={{ background: "rgba(255,255,255,.04)", border: "1px solid rgba(255,255,255,.08)", borderRadius: 20, padding: "28px 24px", display: "flex", flexDirection: "column", gap: 14 }}>
            <div>
              <label style={{ display: "block", font: `600 0.7rem/1 ${fd}`, color: "rgba(255,255,255,.4)", textTransform: "uppercase", letterSpacing: ".07em", marginBottom: 8 }}>
                Tu nombre
              </label>
              <input
                type="text"
                value={inputName}
                onChange={e => setInputName(e.target.value)}
                placeholder="Nombre y apellido"
                style={{ width: "100%", padding: "13px 16px", borderRadius: 12, background: "rgba(255,255,255,.07)", border: "1px solid rgba(255,255,255,.12)", color: "#FFFFFF", font: `400 0.9rem/1 ${fd}`, outline: "none", boxSizing: "border-box" }}
              />
            </div>
            <div>
              <label style={{ display: "block", font: `600 0.7rem/1 ${fd}`, color: "rgba(255,255,255,.4)", textTransform: "uppercase", letterSpacing: ".07em", marginBottom: 8 }}>
                Tu WhatsApp *
              </label>
              <input
                required
                type="tel"
                value={phone}
                onChange={e => setPhone(e.target.value)}
                placeholder="5491112345678"
                style={{ width: "100%", padding: "13px 16px", borderRadius: 12, background: "rgba(255,255,255,.07)", border: "1px solid rgba(255,255,255,.12)", color: "#FFFFFF", font: `400 0.9rem/1 ${fd}`, outline: "none", boxSizing: "border-box" }}
              />
            </div>
            {error && <p style={{ font: `400 0.8rem/1.4 ${fd}`, color: "#F87171", margin: 0 }}>{error}</p>}
            <button
              type="submit"
              disabled={lookingUp}
              style={{ padding: "14px", borderRadius: 13, border: "none", background: ACCENT, color: "#FFFFFF", font: `700 0.95rem/1 ${fd}`, cursor: lookingUp ? "default" : "pointer", opacity: lookingUp ? .7 : 1, display: "flex", alignItems: "center", justifyContent: "center", gap: 8 }}
            >
              {lookingUp && <div style={{ width: 16, height: 16, borderRadius: "50%", border: "2px solid rgba(255,255,255,.4)", borderTopColor: "white", animation: "spin .7s linear infinite" }} />}
              {lookingUp ? "Buscando…" : "Ver horarios disponibles →"}
            </button>
          </form>
        )}

        {/* Step: slots */}
        {step === "slots" && (
          <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>

            {/* Free mode: date grid */}
            {freeMode && (
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
                {slots.map(slot => {
                  const isSel = selected?.slot.date === slot.date;
                  return (
                    <button
                      key={slot.date}
                      onClick={() => { setSelected({ slot, clase: null }); setStep("confirm"); }}
                      style={{
                        padding: "16px 12px", borderRadius: 14, textAlign: "center",
                        background: isSel ? `${ACCENT}18` : "rgba(255,255,255,.04)",
                        border: `1px solid ${isSel ? ACCENT : "rgba(255,255,255,.08)"}`,
                        cursor: "pointer",
                      }}
                    >
                      <p style={{ font: `700 0.95rem/1 ${fd}`, color: "#FFFFFF", margin: "0 0 5px" }}>{slot.shortLabel}</p>
                      <p style={{ font: `400 0.72rem/1 ${fd}`, color: "rgba(255,255,255,.35)", margin: 0 }}>{DAYS_FULL[slot.dow]}</p>
                    </button>
                  );
                })}
              </div>
            )}

            {/* Class mode: list by day */}
            {!freeMode && slots.map(slot => (
              <div key={slot.date}>
                <p style={{ font: `700 0.72rem/1 ${fd}`, color: "rgba(255,255,255,.35)", textTransform: "uppercase", letterSpacing: ".08em", margin: "0 0 8px 4px" }}>{slot.label}</p>
                <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                  {slot.classes.map(clase => {
                    const isSel = selected?.slot.date === slot.date && selected?.clase?.id === clase.id;
                    return (
                      <button
                        key={clase.id}
                        onClick={() => { setSelected({ slot, clase }); setStep("confirm"); }}
                        style={{
                          display: "flex", alignItems: "center", justifyContent: "space-between",
                          padding: "16px 18px", borderRadius: 14,
                          background: isSel ? `${ACCENT}18` : "rgba(255,255,255,.04)",
                          border: `1px solid ${isSel ? ACCENT : "rgba(255,255,255,.08)"}`,
                          cursor: "pointer", textAlign: "left", width: "100%",
                        }}
                      >
                        <div>
                          <p style={{ font: `700 0.9rem/1 ${fd}`, color: "#FFFFFF", margin: "0 0 5px" }}>{clase.class_name}</p>
                          {clase.coach_name && <p style={{ font: `400 0.75rem/1 ${fd}`, color: "rgba(255,255,255,.35)", margin: 0 }}>con {clase.coach_name}</p>}
                        </div>
                        <span style={{ font: `700 1rem/1 ${fd}`, color: ACCENT, flexShrink: 0, marginLeft: 12 }}>
                          {clase.start_time.slice(0, 5)}
                        </span>
                      </button>
                    );
                  })}
                </div>
              </div>
            ))}

            <button
              onClick={() => { setStep("phone"); setError(null); }}
              style={{ padding: "12px", borderRadius: 12, border: "none", background: "transparent", color: "rgba(255,255,255,.25)", font: `500 0.8rem/1 ${fd}`, cursor: "pointer", marginTop: 4 }}
            >
              ← Cambiar número
            </button>
          </div>
        )}

        {/* Step: confirm */}
        {step === "confirm" && selected && (
          <div style={{ background: "rgba(255,255,255,.04)", border: "1px solid rgba(255,255,255,.08)", borderRadius: 20, padding: "28px 24px", display: "flex", flexDirection: "column", gap: 20 }}>
            <div>
              <p style={{ font: `600 0.7rem/1 ${fd}`, color: "rgba(255,255,255,.35)", textTransform: "uppercase", letterSpacing: ".08em", margin: "0 0 16px" }}>Confirmá tu reserva</p>
              <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                {[
                  ...(selected.clase ? [["Clase", selected.clase.class_name]] : []),
                  ["Día",     selected.slot.label],
                  ...(selected.clase ? [["Horario", selected.clase.start_time.slice(0, 5)]] : []),
                  ...(selected.clase?.coach_name ? [["Profe", selected.clase.coach_name]] : []),
                ].map(([label, value]) => (
                  <div key={label} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "10px 0", borderBottom: "1px solid rgba(255,255,255,.05)" }}>
                    <span style={{ font: `500 0.8rem/1 ${fd}`, color: "rgba(255,255,255,.4)" }}>{label}</span>
                    <span style={{ font: `600 0.9rem/1 ${fd}`, color: "#FFFFFF" }}>{value}</span>
                  </div>
                ))}
              </div>
            </div>
            {error && <p style={{ font: `400 0.8rem/1.4 ${fd}`, color: "#F87171", margin: 0 }}>{error}</p>}
            <button
              onClick={handleConfirm}
              disabled={saving}
              style={{ padding: "15px", borderRadius: 13, border: "none", background: ACCENT, color: "#FFFFFF", font: `700 0.95rem/1 ${fd}`, cursor: saving ? "default" : "pointer", opacity: saving ? .7 : 1, display: "flex", alignItems: "center", justifyContent: "center", gap: 8 }}
            >
              {saving && <div style={{ width: 16, height: 16, borderRadius: "50%", border: "2px solid rgba(255,255,255,.4)", borderTopColor: "white", animation: "spin .7s linear infinite" }} />}
              {saving ? "Guardando…" : "Confirmar clase de prueba ✓"}
            </button>
            <button
              onClick={() => { setStep("slots"); setError(null); }}
              style={{ padding: "10px", borderRadius: 12, border: "none", background: "transparent", color: "rgba(255,255,255,.25)", font: `500 0.8rem/1 ${fd}`, cursor: "pointer" }}
            >
              ← Elegir otro horario
            </button>
          </div>
        )}

        {/* Step: done */}
        {step === "done" && selected && (
          <div style={{ background: "rgba(255,255,255,.04)", border: "1px solid rgba(255,255,255,.08)", borderRadius: 20, padding: "40px 24px", textAlign: "center" }}>
            <div style={{ width: 64, height: 64, borderRadius: "50%", background: `${ACCENT}20`, border: `2px solid ${ACCENT}50`, display: "flex", alignItems: "center", justifyContent: "center", margin: "0 auto 20px", fontSize: "1.8rem" }}>💪</div>
            <h2 style={{ font: `700 1.2rem/1.2 ${fd}`, color: "#FFFFFF", margin: "0 0 10px" }}>
              ¡Listo, {nombre}!
            </h2>
            <p style={{ font: `400 0.875rem/1.65 ${fd}`, color: "rgba(255,255,255,.45)", margin: "0 0 24px" }}>
              Tu {selected.clase ? "clase de prueba" : "visita"} en <strong style={{ color: "#FFFFFF" }}>{gym.gym_name}</strong> está confirmada para el <strong style={{ color: "#FFFFFF" }}>{selected.slot.label}</strong>{selected.clase ? <> a las <strong style={{ color: ACCENT }}>{selected.clase.start_time.slice(0, 5)}</strong></> : ""}.
            </p>
            <p style={{ font: `400 0.8rem/1.5 ${fd}`, color: "rgba(255,255,255,.25)", margin: 0 }}>
              Te mandamos la confirmación por WhatsApp. ¡Nos vemos! 🎉
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
