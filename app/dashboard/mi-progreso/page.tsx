"use client";

import { useState, useEffect } from "react";
import { TrendingUp, Calendar, Award, Dumbbell } from "lucide-react";
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

interface Profile {
  full_name: string;
  next_expiration_date: string | null;
  status: string;
  planes: { nombre: string; precio: number } | null;
}

export default function MiProgresoPage() {
  const [profile, setProfile] = useState<Profile | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) { setLoading(false); return; }

      const { data } = await supabase
        .from("alumnos")
        .select("full_name, next_expiration_date, status, planes(nombre, precio)")
        .eq("user_id", user.id)
        .maybeSingle();

      setProfile(data as Profile | null);
      setLoading(false);
    })();
  }, []);

  const stats = [
    { label: "Plan Actual",        value: loading ? "—" : (profile?.planes?.nombre ?? "Sin plan"), icon: <Dumbbell size={16} color="white" /> },
    { label: "Estado",             value: loading ? "—" : (profile?.status ?? "—"),                icon: <Award size={16} color="white" /> },
    { label: "Próximo Vencimiento",value: loading ? "—" : (profile?.next_expiration_date ?? "—"),  icon: <Calendar size={16} color="white" /> },
    { label: "Asistencias (mes)",  value: "—",                                                     icon: <TrendingUp size={16} color="white" /> },
  ];

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 18 }}>

      {/* Header */}
      <div>
        <p style={{ font: `500 0.72rem/1 ${fb}`, color: t3, textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: 6 }}>Alumno</p>
        <h1 style={{ font: `800 2rem/1 ${fd}`, color: t1, letterSpacing: "-0.02em" }}>
          Mi Progreso
        </h1>
        <p style={{ font: `400 0.875rem/1.4 ${fb}`, color: t2, marginTop: 4 }}>
          {loading ? "Cargando..." : `Bienvenido, ${profile?.full_name ?? "alumno"}.`}
        </p>
      </div>

      {/* KPI row */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 14 }}>
        {stats.map(s => (
          <div key={s.label} style={{ ...card, padding: "16px 18px" }}>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 10 }}>
              <span style={{ font: `500 0.72rem/1 ${fb}`, color: t3, textTransform: "uppercase", letterSpacing: "0.06em" }}>{s.label}</span>
              <div style={{ width: 30, height: 30, borderRadius: 8, background: "#2C2C2E", display: "flex", alignItems: "center", justifyContent: "center" }}>{s.icon}</div>
            </div>
            <p style={{ font: `800 1.4rem/1 ${fd}`, color: t1 }}>{s.value}</p>
          </div>
        ))}
      </div>

      {/* Placeholder — expandable later */}
      <div style={{ ...card, padding: "40px 28px", textAlign: "center" as const }}>
        <TrendingUp size={40} color={t3} style={{ margin: "0 auto 14px" }} />
        <p style={{ font: `700 1rem/1 ${fd}`, color: t1, marginBottom: 6 }}>Tu historial de asistencia</p>
        <p style={{ font: `400 0.82rem/1.5 ${fb}`, color: t2 }}>
          Próximamente vas a poder ver tu historial completo, metas y evolución física.
        </p>
      </div>

    </div>
  );
}
