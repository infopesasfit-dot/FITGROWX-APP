"use client";

import Image from "next/image";
import { useEffect, useState } from "react";
import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
);

const DAYS = ["Domingo","Lunes","Martes","Miércoles","Jueves","Viernes","Sábado"];

type GymClass = {
  id: string;
  class_name: string;
  day_of_week: number;
  start_time: string;
  max_capacity: number;
  reserved: number;
};

type GymInfo = {
  gym_name?: string;
  logo_url?: string;
  accent_color?: string;
};

export default function ReservaPage({ params }: { params: { gymId: string } }) {
  const { gymId } = params;

  const [gym,     setGym]     = useState<GymInfo>({});
  const [classes, setClasses] = useState<GymClass[]>([]);
  const [loading, setLoading] = useState(true);

  const [selected, setSelected] = useState<GymClass | null>(null);
  const [name,     setName]     = useState("");
  const [phone,    setPhone]    = useState("");
  const [sending,  setSending]  = useState(false);
  const [done,     setDone]     = useState(false);
  const [error,    setError]    = useState<string | null>(null);

  const ACCENT = gym.accent_color ?? "#F97316";

  useEffect(() => {
    (async () => {
      const [{ data: settings }, { data: rawClasses }] = await Promise.all([
        supabase.from("gym_settings").select("gym_name,logo_url,accent_color").eq("gym_id", gymId).maybeSingle(),
        supabase.from("gym_classes").select("id,class_name,day_of_week,start_time,max_capacity").eq("gym_id", gymId).order("day_of_week").order("start_time"),
      ]);

      if (settings) setGym(settings);

      if (rawClasses && rawClasses.length > 0) {
        const ids = rawClasses.map((c: { id: string }) => c.id);
        const { data: counts } = await supabase
          .from("class_reservations")
          .select("class_id")
          .in("class_id", ids);

        const countMap: Record<string, number> = {};
        (counts ?? []).forEach((r: { class_id: string }) => {
          countMap[r.class_id] = (countMap[r.class_id] ?? 0) + 1;
        });

        setClasses(rawClasses.map((c: Omit<GymClass, "reserved">) => ({
          ...c,
          reserved: countMap[c.id] ?? 0,
        })));
      }
      setLoading(false);
    })();
  }, [gymId]);

  const byDay = DAYS.map((day, i) => ({
    day,
    items: classes.filter(c => c.day_of_week === i),
  })).filter(g => g.items.length > 0);

  const book = async () => {
    if (!selected || !name.trim() || !phone.trim()) return;
    setSending(true);
    setError(null);
    try {
      const res  = await fetch("/api/reserva/book", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ classId: selected.id, leadName: name.trim(), leadPhone: phone.trim(), gymId }),
      });
      const data = await res.json();
      if (!res.ok) { setError(data.error ?? "Error al reservar"); setSending(false); return; }
      setDone(true);
    } catch {
      setError("Error de red. Intentá de nuevo.");
    }
    setSending(false);
  };

  if (loading) {
    return (
      <div style={{ minHeight: "100vh", background: "#0d1117", display: "flex", alignItems: "center", justifyContent: "center" }}>
        <div style={{ color: "#fff", opacity: .5, fontFamily: "system-ui", fontSize: "1rem" }}>Cargando clases…</div>
      </div>
    );
  }

  return (
    <div style={{ minHeight: "100vh", background: "#f4f5f7", fontFamily: "system-ui,sans-serif" }}>
      {/* Header */}
      <div style={{ background: "#1A1D23", padding: "28px 20px", textAlign: "center" }}>
        {gym.logo_url && <Image src={gym.logo_url} alt="Logo" width={160} height={52} unoptimized style={{ height: 52, width: "auto", objectFit: "contain", marginBottom: 12 }} />}
        <h1 style={{ color: "#fff", fontSize: "1.4rem", fontWeight: 800, margin: 0 }}>
          {gym.gym_name ?? "Reservá tu clase"}
        </h1>
        <p style={{ color: "rgba(255,255,255,.45)", fontSize: ".82rem", marginTop: 6 }}>
          Elegí el horario y anotate gratis
        </p>
      </div>

      <div style={{ maxWidth: 540, margin: "0 auto", padding: "24px 16px", display: "flex", flexDirection: "column", gap: 20 }}>
        {byDay.length === 0 ? (
          <div style={{ textAlign: "center", color: "#6B7280", paddingTop: 40 }}>
            No hay clases disponibles aún.
          </div>
        ) : byDay.map(({ day, items }) => (
          <div key={day}>
            <p style={{ fontSize: ".7rem", fontWeight: 700, color: "#9CA3AF", textTransform: "uppercase", letterSpacing: ".08em", marginBottom: 8 }}>{day}</p>
            <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
              {items.map(cls => {
                const full  = cls.reserved >= cls.max_capacity;
                const spots = cls.max_capacity - cls.reserved;
                const isSel = selected?.id === cls.id;
                return (
                  <button
                    key={cls.id}
                    onClick={() => { if (!full) { setSelected(cls); setDone(false); setError(null); }}}
                    disabled={full}
                    style={{
                      display: "flex", alignItems: "center", justifyContent: "space-between",
                      padding: "14px 18px", borderRadius: 12, border: `2px solid ${isSel ? ACCENT : "transparent"}`,
                      background: full ? "#f0f0f0" : "#fff",
                      boxShadow: "0 1px 4px rgba(0,0,0,.07)",
                      cursor: full ? "not-allowed" : "pointer",
                      opacity: full ? .55 : 1,
                      textAlign: "left", width: "100%",
                    }}
                  >
                    <div>
                      <p style={{ fontWeight: 700, fontSize: ".9rem", color: "#1A1D23", margin: 0 }}>{cls.class_name}</p>
                      <p style={{ fontSize: ".78rem", color: "#6B7280", margin: "3px 0 0" }}>{cls.start_time.slice(0,5)}hs</p>
                    </div>
                    <div style={{ textAlign: "right" }}>
                      <span style={{
                        fontSize: ".72rem", fontWeight: 700, borderRadius: 9999, padding: "4px 10px",
                        background: full ? "rgba(220,38,38,.1)" : `rgba(${ACCENT === "#F97316" ? "249,115,22" : "22,163,74"},.1)`,
                        color: full ? "#DC2626" : ACCENT,
                      }}>
                        {full ? "Completo" : `${spots} lugar${spots === 1 ? "" : "es"}`}
                      </span>
                    </div>
                  </button>
                );
              })}
            </div>
          </div>
        ))}

        {/* Formulario de reserva */}
        {selected && !done && (
          <div style={{ background: "#fff", borderRadius: 16, padding: "24px 20px", boxShadow: "0 4px 20px rgba(0,0,0,.08)" }}>
            <p style={{ fontWeight: 700, fontSize: "1rem", color: "#1A1D23", marginBottom: 4 }}>
              Reservar: {selected.class_name}
            </p>
            <p style={{ fontSize: ".78rem", color: "#6B7280", marginBottom: 20 }}>
              {DAYS[selected.day_of_week]} · {selected.start_time.slice(0,5)}hs
            </p>

            <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
              <input
                value={name}
                onChange={e => setName(e.target.value)}
                placeholder="Tu nombre"
                style={{ padding: "12px 14px", borderRadius: 10, border: "1px solid #E5E7EB", fontSize: ".875rem", outline: "none" }}
              />
              <input
                value={phone}
                onChange={e => setPhone(e.target.value)}
                placeholder="WhatsApp (ej: 5491112345678)"
                type="tel"
                style={{ padding: "12px 14px", borderRadius: 10, border: "1px solid #E5E7EB", fontSize: ".875rem", outline: "none" }}
              />
              {error && <p style={{ fontSize: ".78rem", color: "#DC2626" }}>{error}</p>}
              <button
                onClick={book}
                disabled={sending || !name.trim() || !phone.trim()}
                style={{
                  padding: "14px", borderRadius: 10, border: "none",
                  background: ACCENT, color: "#fff", fontWeight: 700, fontSize: ".9rem",
                  cursor: sending ? "wait" : "pointer", opacity: sending ? .7 : 1,
                }}
              >
                {sending ? "Reservando…" : "Confirmar reserva"}
              </button>
            </div>
          </div>
        )}

        {/* Confirmación */}
        {done && (
          <div style={{ background: "#fff", borderRadius: 16, padding: "28px 20px", textAlign: "center", boxShadow: "0 4px 20px rgba(0,0,0,.08)" }}>
            <div style={{ fontSize: "2.5rem", marginBottom: 12 }}>✅</div>
            <p style={{ fontWeight: 700, fontSize: "1.1rem", color: "#1A1D23" }}>¡Reserva confirmada!</p>
            <p style={{ fontSize: ".82rem", color: "#6B7280", marginTop: 8 }}>
              Te enviamos la confirmación por WhatsApp. ¡Te esperamos!
            </p>
            <button
              onClick={() => { setDone(false); setSelected(null); setName(""); setPhone(""); }}
              style={{ marginTop: 20, padding: "10px 24px", borderRadius: 9, border: `1px solid ${ACCENT}`, background: "transparent", color: ACCENT, fontWeight: 700, fontSize: ".82rem", cursor: "pointer" }}
            >
              Reservar otra clase
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
