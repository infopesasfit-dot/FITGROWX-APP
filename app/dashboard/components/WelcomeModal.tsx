"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import { X, UserPlus, FileSpreadsheet } from "lucide-react";
import { CsvAlumnosImportContent } from "@/app/dashboard/components/CsvAlumnosImportContent";


const accent = "#FF6A00";
const fd = "var(--font-inter, 'Inter', sans-serif)";
const fb = "var(--font-inter, 'Inter', sans-serif)";
const t1 = "#1A1D23";
const t2 = "#6B7280";
const t3 = "#9CA3AF";

interface ManualRow { full_name: string; phone_number: string; }
type Tab = "manual" | "csv";

export default function WelcomeModal() {
  const [show, setShow]           = useState(false);
  const [gymId, setGymId]         = useState<string | null>(null);
  const [tab, setTab]             = useState<Tab>("manual");
  const [rows, setRows]           = useState<ManualRow[]>([{ full_name: "", phone_number: "" }]);
  const [loading, setLoading]     = useState(false);
  const [error, setError]         = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;
      const { data } = await supabase
        .from("gym_settings")
        .select("gym_id, onboarding_completed")
        .eq("gym_id", user.id)
        .maybeSingle();
      if (!data || data.onboarding_completed === false) {
        setGymId(user.id);
        setShow(true);
      }
    })();
  }, []);

  const handleManualFinish = async () => {
    if (!gymId) return;
    setLoading(true);
    setError(null);

    try {
      const valid = rows.filter(r => r.full_name.trim() || r.phone_number.trim());
      if (valid.length > 0) {
        const { error: insertErr } = await supabase.from("alumnos").insert(
          valid.map(r => ({ gym_id: gymId, full_name: r.full_name, phone: r.phone_number, status: "activo" }))
        );
        if (insertErr) throw insertErr;
      }

      await supabase
        .from("gym_settings")
        .update({ onboarding_completed: true })
        .eq("gym_id", gymId);

      setShow(false);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Ocurrió un error. Intentá de nuevo.");
    } finally {
      setLoading(false);
    }
  };

  const completeOnboarding = async () => {
    if (!gymId) return;
    await supabase
      .from("gym_settings")
      .update({ onboarding_completed: true })
      .eq("gym_id", gymId);
    setShow(false);
  };

  const handleSkip = async () => {
    if (!gymId) return;
    await supabase
      .from("gym_settings")
      .update({ onboarding_completed: true })
      .eq("gym_id", gymId);
    setShow(false);
  };

  if (!show) return null;

  return (
    <>
      {/* Backdrop */}
      <div
        style={{
          position: "fixed", inset: 0, zIndex: 999,
          background: "rgba(5,5,5,0.72)",
          backdropFilter: "blur(6px)",
          WebkitBackdropFilter: "blur(6px)",
        }}
      />

      {/* Modal */}
      <div
        style={{
          position: "fixed", inset: 0, zIndex: 1000,
          display: "flex", alignItems: "center", justifyContent: "center",
          padding: 20,
        }}
      >
        <div
          style={{
            background: "#FFFFFF",
            borderRadius: 24,
            width: "100%",
            maxWidth: 560,
            maxHeight: "90vh",
            overflowY: "auto",
            boxShadow: "0 32px 80px rgba(0,0,0,0.22), 0 0 0 1px rgba(0,0,0,0.05)",
            animation: "modalIn 0.28s cubic-bezier(0.34,1.56,0.64,1) both",
          }}
        >
          <style>{`
            @keyframes modalIn {
              from { opacity: 0; transform: translateY(18px) scale(0.96); }
              to   { opacity: 1; transform: translateY(0) scale(1); }
            }
          `}</style>

          {/* Header */}
          <div
            style={{
              background: "linear-gradient(135deg, #1A1D23 0%, #2C2C2E 100%)",
              borderRadius: "24px 24px 0 0",
              padding: "28px 28px 24px",
              position: "relative",
              overflow: "hidden",
            }}
          >
            {/* Decorative glow */}
            <div style={{ position: "absolute", top: -40, right: -40, width: 180, height: 180, borderRadius: "50%", background: `radial-gradient(circle, ${accent}33 0%, transparent 70%)`, pointerEvents: "none" }} />
            <div style={{ position: "absolute", bottom: -60, left: -20, width: 140, height: 140, borderRadius: "50%", background: "radial-gradient(circle, rgba(30,80,240,0.15) 0%, transparent 70%)", pointerEvents: "none" }} />

            <div style={{ position: "relative", zIndex: 1 }}>
              <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 12 }}>
                <div>
                  <div style={{ display: "inline-flex", alignItems: "center", gap: 7, background: `${accent}22`, border: `1px solid ${accent}44`, borderRadius: 9999, padding: "4px 12px", marginBottom: 12 }}>
                    <span style={{ width: 6, height: 6, borderRadius: "50%", background: accent, display: "inline-block" }} />
                    <span style={{ font: `700 0.68rem/1 ${fb}`, color: accent, textTransform: "uppercase", letterSpacing: "0.1em" }}>Bienvenido a FitGrowX</span>
                  </div>
                  <h2 style={{ font: `800 1.5rem/1.2 ${fd}`, color: "white", marginBottom: 8 }}>
                    Importá tus<br />primeros prospectos
                  </h2>
                  <p style={{ font: `400 0.85rem/1.55 ${fb}`, color: "rgba(255,255,255,0.55)" }}>
                    Cargá tu lista de contactos ahora para empezar a dar seguimiento desde el primer día.
                  </p>
                </div>
              </div>
            </div>
          </div>

          {/* Body */}
          <div style={{ padding: "24px 28px 28px" }}>

            {/* Tabs */}
            <div style={{ display: "flex", gap: 0, background: "#F0F2F8", borderRadius: 12, padding: 4, marginBottom: 22 }}>
              {([
                { key: "manual" as Tab, label: "Agregar manual", Icon: UserPlus },
                { key: "csv"    as Tab, label: "Importar CSV",   Icon: FileSpreadsheet },
              ] as const).map(({ key, label, Icon }) => (
                <button
                  key={key}
                  onClick={() => setTab(key)}
                  style={{
                    flex: 1, display: "flex", alignItems: "center", justifyContent: "center", gap: 7,
                    padding: "10px 12px", borderRadius: 9, border: "none", cursor: "pointer",
                    font: `600 0.82rem/1 ${fb}`,
                    background: tab === key ? "white" : "transparent",
                    color: tab === key ? t1 : t3,
                    boxShadow: tab === key ? "0 1px 4px rgba(0,0,0,0.10)" : "none",
                    transition: "all 0.14s",
                  }}
                >
                  <Icon size={14} />
                  {label}
                </button>
              ))}
            </div>

            {/* Manual tab */}
            {tab === "manual" && (
              <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr auto", gap: 8, alignItems: "center", marginBottom: 4 }}>
                  {["Nombre completo", "Teléfono"].map(h => (
                    <span key={h} style={{ font: `600 0.68rem/1 ${fb}`, color: t3, textTransform: "uppercase", letterSpacing: "0.07em" }}>{h}</span>
                  ))}
                  <span />
                </div>
                {rows.map((row, i) => (
                  <div key={i} style={{ display: "grid", gridTemplateColumns: "1fr 1fr auto", gap: 8, alignItems: "center" }}>
                    <input
                      value={row.full_name}
                      onChange={e => setRows(r => r.map((x, j) => j === i ? { ...x, full_name: e.target.value } : x))}
                      placeholder="Juan Pérez"
                      style={inputStyle}
                    />
                    <input
                      value={row.phone_number}
                      onChange={e => setRows(r => r.map((x, j) => j === i ? { ...x, phone_number: e.target.value } : x))}
                      placeholder="+5491122334455"
                      style={inputStyle}
                    />
                    <button
                      onClick={() => setRows(r => r.length === 1 ? r : r.filter((_, j) => j !== i))}
                      style={{ width: 30, height: 30, borderRadius: 8, border: "1px solid #E5E7EB", background: "none", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", color: t3 }}
                    >
                      <X size={13} />
                    </button>
                  </div>
                ))}
                <button
                  onClick={() => setRows(r => [...r, { full_name: "", phone_number: "" }])}
                  style={{ alignSelf: "flex-start", background: "none", border: `1px dashed ${t3}`, color: t2, borderRadius: 9, padding: "7px 14px", font: `500 0.78rem/1 ${fb}`, cursor: "pointer", marginTop: 2 }}
                >
                  + Agregar fila
                </button>
              </div>
            )}

            {tab === "csv" && gymId && (
              <CsvAlumnosImportContent
                gymId={gymId}
                onImported={completeOnboarding}
                onSecondaryAction={handleSkip}
                secondaryLabel="Lo haré más tarde"
                confirmLabel="Importar contactos"
              />
            )}

            {/* Error */}
            {tab === "manual" && error && (
              <div style={{ background: "rgba(239,68,68,0.07)", border: "1px solid rgba(239,68,68,0.2)", borderRadius: 10, padding: "10px 14px", marginTop: 14 }}>
                <p style={{ font: `500 0.8rem/1 ${fb}`, color: "#DC2626" }}>{error}</p>
              </div>
            )}

            {tab === "manual" && (
              <div style={{ display: "flex", alignItems: "center", gap: 10, marginTop: 24 }}>
                <button
                  onClick={handleSkip}
                  style={{ flex: 1, padding: "13px", borderRadius: 12, border: "1px solid #E5E7EB", background: "none", font: `600 0.85rem/1 ${fb}`, color: t2, cursor: "pointer" }}
                >
                  Lo haré más tarde
                </button>
                <button
                  onClick={handleManualFinish}
                  disabled={loading}
                  style={{
                    flex: 2, padding: "13px", borderRadius: 12, border: "none", cursor: loading ? "not-allowed" : "pointer",
                    background: loading ? "#D1D5DB" : accent,
                    color: "white",
                    font: `800 0.88rem/1 ${fd}`,
                    boxShadow: loading ? "none" : `0 4px 14px ${accent}50`,
                    transition: "background 0.14s, box-shadow 0.14s",
                    opacity: loading ? 0.7 : 1,
                  }}
                >
                  {loading ? "Guardando..." : "Guardar y empezar →"}
                </button>
              </div>
            )}
          </div>
        </div>
      </div>
    </>
  );
}

const inputStyle: React.CSSProperties = {
  padding: "9px 12px",
  border: "1px solid #E5E7EB",
  borderRadius: 9,
  font: `400 0.83rem/1 var(--font-inter, 'Inter', sans-serif)`,
  color: "#1A1D23",
  outline: "none",
  width: "100%",
  background: "#FAFAFA",
  transition: "border-color 0.14s",
};
