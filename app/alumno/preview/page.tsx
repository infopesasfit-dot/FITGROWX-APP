"use client";

import { useEffect, useState, Suspense } from "react";
import { useSearchParams } from "next/navigation";
import { supabase } from "@/lib/supabase";
import { CheckCircle2, CalendarDays, ClipboardList, QrCode } from "lucide-react";

type GymInfo = {
  gym_name: string | null;
  logo_url: string | null;
  accent_color: string | null;
  plan_type?: string | null;
};

const fd = "Inter, system-ui, sans-serif";

function PreviewInner() {
  const params = useSearchParams();
  const slug = params.get("slug") ?? "";
  const [gym, setGym] = useState<GymInfo | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/exhaustive-deps
    if (!slug) { setLoading(false); return; }
    (async () => {
      const { data } = await supabase
        .from("gym_settings")
        .select("gym_id, gym_name, logo_url, accent_color")
        .eq("slug", slug)
        .maybeSingle();
      if (data) {
        const { data: gymRow } = await supabase
          .from("gyms")
          .select("plan_type")
          .eq("id", data.gym_id)
          .maybeSingle();
        setGym({ ...data, plan_type: gymRow?.plan_type ?? null });
      }
      setLoading(false);
    })();
  }, [slug]);

  if (loading) {
    return (
      <div style={{ minHeight: "100dvh", display: "flex", alignItems: "center", justifyContent: "center", background: "#F3F4F6" }}>
        <p style={{ fontFamily: fd, color: "#9CA3AF", fontSize: "0.9rem" }}>Cargando preview...</p>
      </div>
    );
  }

  if (!gym) {
    return (
      <div style={{ minHeight: "100dvh", display: "flex", alignItems: "center", justifyContent: "center", background: "#F3F4F6" }}>
        <p style={{ fontFamily: fd, color: "#9CA3AF", fontSize: "0.9rem" }}>Gym no encontrado.</p>
      </div>
    );
  }

  const ACCENT = gym.accent_color ?? "#F97316";
  const isPro  = gym.plan_type === "crecimiento";
  const gymName = gym.gym_name ?? "Tu Gimnasio";

  return (
    <div style={{ minHeight: "100dvh", background: "#F3F4F6", display: "flex", flexDirection: "column", alignItems: "center", fontFamily: fd }}>

      {/* Banner de preview */}
      <div style={{ width: "100%", background: "#1E293B", padding: "10px 20px", display: "flex", alignItems: "center", justifyContent: "center", gap: 10 }}>
        <span style={{ fontSize: "0.75rem", color: "rgba(255,255,255,0.55)", fontWeight: 500 }}>
          Vista previa · Así ve tu app un alumno real
        </span>
      </div>

      {/* Simulación de pantalla de celular */}
      <div style={{ width: "100%", maxWidth: 390, flex: 1, background: "#FFFFFF", display: "flex", flexDirection: "column", boxShadow: "0 8px 40px rgba(0,0,0,0.12)" }}>

        {/* Header */}
        <div style={{ padding: "16px 20px 14px", background: "#1A1D23", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            {isPro && gym.logo_url ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={gym.logo_url} alt={gymName} style={{ height: 32, width: "auto", objectFit: "contain", maxWidth: 100 }} />
            ) : (
              <span style={{ font: `800 1rem/1 ${fd}`, color: "#FFFFFF", fontStyle: "italic", letterSpacing: "-0.03em" }}>
                {gymName.split(" ").slice(0, -1).join(" ")}{gymName.split(" ").length > 1 ? " " : ""}
                <span style={{ color: ACCENT }}>{gymName.split(" ").slice(-1)[0]}</span>
              </span>
            )}
          </div>
          <div style={{ width: 34, height: 34, borderRadius: "50%", background: ACCENT, display: "flex", alignItems: "center", justifyContent: "center" }}>
            <span style={{ font: `700 0.75rem/1 ${fd}`, color: "white" }}>JG</span>
          </div>
        </div>

        {/* Body */}
        <div style={{ flex: 1, padding: "20px 16px", display: "flex", flexDirection: "column", gap: 14, background: "#F8F9FA" }}>

          {/* Saludo */}
          <div>
            <p style={{ font: `400 0.82rem/1 ${fd}`, color: "#6B7280", marginBottom: 4 }}>Hola, Juan García</p>
            <p style={{ font: `700 1.3rem/1.15 ${fd}`, color: "#111827", letterSpacing: "-0.02em" }}>
              Buen entrenamiento 💪
            </p>
          </div>

          {/* Card membresía */}
          <div style={{ borderRadius: 18, padding: "18px 20px", background: `linear-gradient(135deg, ${ACCENT} 0%, ${ACCENT}cc 100%)`, color: "white", boxShadow: `0 6px 24px ${ACCENT}44` }}>
            <p style={{ font: `600 0.72rem/1 ${fd}`, opacity: 0.75, letterSpacing: "0.06em", textTransform: "uppercase", marginBottom: 8 }}>Estado de membresía</p>
            <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 6 }}>
              <CheckCircle2 size={18} />
              <span style={{ font: `700 1rem/1 ${fd}` }}>Activo</span>
            </div>
            <p style={{ font: `400 0.8rem/1 ${fd}`, opacity: 0.75 }}>Vence el 15 de julio</p>
            <div style={{ marginTop: 14, paddingTop: 14, borderTop: "1px solid rgba(255,255,255,0.2)" }}>
              <p style={{ font: `600 0.72rem/1 ${fd}`, opacity: 0.7 }}>Plan Mensual</p>
            </div>
          </div>

          {/* Accesos rápidos */}
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 10 }}>
            {[
              { icon: <QrCode size={20} />, label: "Mi QR" },
              { icon: <CalendarDays size={20} />, label: "Clases" },
              { icon: <ClipboardList size={20} />, label: "Historial" },
            ].map(({ icon, label }) => (
              <div key={label} style={{ borderRadius: 14, background: "white", padding: "14px 10px", display: "flex", flexDirection: "column", alignItems: "center", gap: 8, boxShadow: "0 1px 4px rgba(0,0,0,0.06)", border: "1px solid rgba(0,0,0,0.05)" }}>
                <span style={{ color: ACCENT }}>{icon}</span>
                <span style={{ font: `600 0.72rem/1 ${fd}`, color: "#374151" }}>{label}</span>
              </div>
            ))}
          </div>

          {/* Próxima clase */}
          <div style={{ borderRadius: 16, background: "white", padding: "16px", boxShadow: "0 1px 4px rgba(0,0,0,0.06)", border: "1px solid rgba(0,0,0,0.05)" }}>
            <p style={{ font: `700 0.78rem/1 ${fd}`, color: "#111827", marginBottom: 12 }}>Próxima clase</p>
            <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
              <div style={{ width: 40, height: 40, borderRadius: 12, background: `${ACCENT}18`, display: "flex", alignItems: "center", justifyContent: "center" }}>
                <CalendarDays size={18} color={ACCENT} />
              </div>
              <div>
                <p style={{ font: `600 0.85rem/1 ${fd}`, color: "#111827" }}>Funcional</p>
                <p style={{ font: `400 0.75rem/1 ${fd}`, color: "#6B7280", marginTop: 3 }}>Mañana · 9:00 AM</p>
              </div>
              <div style={{ marginLeft: "auto", padding: "5px 12px", borderRadius: 8, background: `${ACCENT}18`, font: `600 0.72rem/1 ${fd}`, color: ACCENT }}>
                Reservada
              </div>
            </div>
          </div>

        </div>
      </div>

      <div style={{ width: "100%", maxWidth: 390, padding: "14px 20px", textAlign: "center" }}>
        <p style={{ font: `400 0.72rem/1.5 ${fd}`, color: "#9CA3AF" }}>
          Esto es una preview con datos de ejemplo. Tus alumnos verán su información real.
        </p>
      </div>
    </div>
  );
}

export default function AlumnoPreviewPage() {
  return (
    <Suspense>
      <PreviewInner />
    </Suspense>
  );
}
