"use client";

import { useEffect, useRef, useState } from "react";
import Papa from "papaparse";
import { supabase } from "@/lib/supabase";
import { X, Upload, ClipboardCopy, Check, UserPlus, FileSpreadsheet } from "lucide-react";


const accent = "#FF6A00";
const fd = "var(--font-inter, 'Inter', sans-serif)";
const fb = "var(--font-inter, 'Inter', sans-serif)";
const t1 = "#1A1D23";
const t2 = "#6B7280";
const t3 = "#9CA3AF";

const AI_PROMPT = `Tengo una lista de contactos de mi gimnasio y necesito exportarla como CSV con exactamente estas dos columnas:
nombre_completo,whatsapp

Reglas:
- nombre_completo: nombre completo de la persona
- whatsapp: número con código de país si lo tenés (ej: +5491122334455)
- Sin filas de encabezado extra, solo los datos
- Sin comillas innecesarias
- Una persona por línea

Por favor convertí mis contactos a ese formato CSV.`;

interface ManualRow { full_name: string; phone_number: string; }
type Tab = "manual" | "csv";

export default function WelcomeModal() {
  const [show, setShow]           = useState(false);
  const [gymId, setGymId]         = useState<string | null>(null);
  const [tab, setTab]             = useState<Tab>("manual");
  const [rows, setRows]           = useState<ManualRow[]>([{ full_name: "", phone_number: "" }]);
  const [csvData, setCsvData]     = useState<ManualRow[]>([]);
  const [fileName, setFileName]   = useState("");
  const [copied, setCopied]       = useState(false);
  const [loading, setLoading]     = useState(false);
  const [error, setError]         = useState<string | null>(null);
  const fileRef                   = useRef<HTMLInputElement>(null);

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

  const handleCopyPrompt = async () => {
    await navigator.clipboard.writeText(AI_PROMPT);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setFileName(file.name);
    Papa.parse<ManualRow>(file, {
      header: true,
      skipEmptyLines: true,
      transformHeader: (h) => h.trim().toLowerCase().replace(/\s+/g, "_"),
      complete: (results) => {
        const parsed: ManualRow[] = results.data
          .filter((r: any) =>
            r.full_name || r.nombre_completo || r.phone_number || r.whatsapp
          )
          .map((r: any) => ({
            full_name: String(
              r.full_name ?? r.nombre_completo ?? ""
            ).trim(),
            phone_number: String(
              r.phone_number ?? r.whatsapp ?? r.phone ?? r.telefono ?? ""
            ).trim(),
          }));
        setCsvData(parsed);
        setError(null);
      },
      error: () => setError("No se pudo leer el archivo CSV."),
    });
  };

  const handleFinish = async () => {
    if (!gymId) return;
    setLoading(true);
    setError(null);

    try {
      if (tab === "manual") {
        const valid = rows.filter(r => r.full_name.trim() || r.phone_number.trim());
        if (valid.length > 0) {
          const { error: insertErr } = await supabase.from("alumnos").insert(
            valid.map(r => ({ gym_id: gymId, full_name: r.full_name, phone: r.phone_number, status: "activo" }))
          );
          if (insertErr) throw insertErr;
        }
      } else {
        if (csvData.length > 0) {
          const CHUNK = 200;
          for (let i = 0; i < csvData.length; i += CHUNK) {
            const { error: insertErr } = await supabase.from("alumnos").insert(
              csvData.slice(i, i + CHUNK).map(r => ({ gym_id: gymId, full_name: r.full_name, phone: r.phone_number, status: "activo" }))
            );
            if (insertErr) throw insertErr;
          }
        }
      }

      await supabase
        .from("gym_settings")
        .update({ onboarding_completed: true })
        .eq("gym_id", gymId);

      setShow(false);
    } catch (e: any) {
      setError(e?.message ?? "Ocurrió un error. Intentá de nuevo.");
    } finally {
      setLoading(false);
    }
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
            <div style={{ position: "absolute", bottom: -60, left: -20, width: 140, height: 140, borderRadius: "50%", background: "radial-gradient(circle, rgba(139,92,246,0.15) 0%, transparent 70%)", pointerEvents: "none" }} />

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

            {/* CSV tab */}
            {tab === "csv" && (
              <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>

                {/* AI Prompt box */}
                <div style={{ background: "#F8F4FF", border: "1px solid #E9D5FF", borderRadius: 14, padding: 16 }}>
                  <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 10, marginBottom: 10 }}>
                    <div>
                      <p style={{ font: `700 0.82rem/1 ${fd}`, color: "#6D28D9", marginBottom: 4 }}>Paso 1 — Generá tu CSV con IA</p>
                      <p style={{ font: `400 0.76rem/1.5 ${fb}`, color: "#7C3AED" }}>
                        Copiá este prompt y pegalo en ChatGPT o Claude con tu lista de contactos.
                      </p>
                    </div>
                    <button
                      onClick={handleCopyPrompt}
                      style={{
                        display: "flex", alignItems: "center", gap: 6,
                        padding: "8px 14px", borderRadius: 9999, border: "none", cursor: "pointer",
                        background: copied ? "#22C55E" : "#6D28D9",
                        color: "white",
                        font: `700 0.75rem/1 ${fb}`,
                        transition: "background 0.2s",
                        flexShrink: 0,
                      }}
                    >
                      {copied ? <Check size={13} /> : <ClipboardCopy size={13} />}
                      {copied ? "Copiado" : "Copiar Prompt"}
                    </button>
                  </div>
                  <pre style={{
                    background: "rgba(109,40,217,0.06)",
                    border: "1px solid rgba(109,40,217,0.12)",
                    borderRadius: 9,
                    padding: "10px 12px",
                    font: `400 0.72rem/1.6 ${fb}`,
                    color: "#4C1D95",
                    whiteSpace: "pre-wrap",
                    wordBreak: "break-word",
                    margin: 0,
                    maxHeight: 120,
                    overflowY: "auto",
                  }}>
                    {AI_PROMPT}
                  </pre>
                </div>

                {/* File upload */}
                <div>
                  <p style={{ font: `700 0.82rem/1 ${fd}`, color: t1, marginBottom: 10 }}>Paso 2 — Subí el archivo CSV</p>
                  <div
                    onClick={() => fileRef.current?.click()}
                    style={{
                      border: `2px dashed ${fileName ? accent : "#D1D5DB"}`,
                      borderRadius: 14,
                      padding: "28px 20px",
                      textAlign: "center",
                      cursor: "pointer",
                      transition: "border-color 0.14s, background 0.14s",
                      background: fileName ? `${accent}08` : "#FAFAFA",
                    }}
                    onMouseEnter={e => { (e.currentTarget as HTMLDivElement).style.borderColor = accent; (e.currentTarget as HTMLDivElement).style.background = `${accent}06`; }}
                    onMouseLeave={e => { (e.currentTarget as HTMLDivElement).style.borderColor = fileName ? accent : "#D1D5DB"; (e.currentTarget as HTMLDivElement).style.background = fileName ? `${accent}08` : "#FAFAFA"; }}
                  >
                    <Upload size={24} color={fileName ? accent : t3} style={{ margin: "0 auto 10px" }} />
                    {fileName ? (
                      <>
                        <p style={{ font: `700 0.85rem/1 ${fd}`, color: t1 }}>{fileName}</p>
                        <p style={{ font: `400 0.75rem/1 ${fb}`, color: t2, marginTop: 4 }}>{csvData.length} contactos detectados</p>
                      </>
                    ) : (
                      <>
                        <p style={{ font: `600 0.85rem/1 ${fd}`, color: t2 }}>Hacé clic para seleccionar el CSV</p>
                        <p style={{ font: `400 0.72rem/1 ${fb}`, color: t3, marginTop: 4 }}>Columnas requeridas: full_name, phone_number</p>
                      </>
                    )}
                  </div>
                  <input
                    ref={fileRef}
                    type="file"
                    accept=".csv,text/csv"
                    onChange={handleFileChange}
                    style={{ display: "none" }}
                  />
                </div>

                {/* Preview */}
                {csvData.length > 0 && (
                  <div style={{ border: "1px solid #E5E7EB", borderRadius: 10, overflow: "hidden" }}>
                    <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", background: "#F9FAFB", padding: "8px 14px", borderBottom: "1px solid #E5E7EB" }}>
                      {["Nombre", "Teléfono"].map(h => <span key={h} style={{ font: `600 0.68rem/1 ${fb}`, color: t3, textTransform: "uppercase" }}>{h}</span>)}
                    </div>
                    {csvData.slice(0, 5).map((r, i) => (
                      <div key={i} style={{ display: "grid", gridTemplateColumns: "1fr 1fr", padding: "9px 14px", borderBottom: i < Math.min(csvData.length, 5) - 1 ? "1px solid #F3F4F6" : "none" }}>
                        <span style={{ font: `500 0.8rem/1 ${fb}`, color: t1 }}>{r.full_name || "—"}</span>
                        <span style={{ font: `400 0.8rem/1 ${fb}`, color: t2 }}>{r.phone_number || "—"}</span>
                      </div>
                    ))}
                    {csvData.length > 5 && (
                      <div style={{ padding: "8px 14px", background: "#F9FAFB" }}>
                        <span style={{ font: `400 0.72rem/1 ${fb}`, color: t3 }}>+ {csvData.length - 5} más...</span>
                      </div>
                    )}
                  </div>
                )}
              </div>
            )}

            {/* Error */}
            {error && (
              <div style={{ background: "rgba(239,68,68,0.07)", border: "1px solid rgba(239,68,68,0.2)", borderRadius: 10, padding: "10px 14px", marginTop: 14 }}>
                <p style={{ font: `500 0.8rem/1 ${fb}`, color: "#DC2626" }}>{error}</p>
              </div>
            )}

            {/* Actions */}
            <div style={{ display: "flex", alignItems: "center", gap: 10, marginTop: 24 }}>
              <button
                onClick={handleSkip}
                style={{ flex: 1, padding: "13px", borderRadius: 12, border: "1px solid #E5E7EB", background: "none", font: `600 0.85rem/1 ${fb}`, color: t2, cursor: "pointer" }}
              >
                Lo haré más tarde
              </button>
              <button
                onClick={handleFinish}
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
                {loading ? "Guardando..." : tab === "manual" ? "Guardar y empezar →" : `Importar ${csvData.length > 0 ? csvData.length + " contactos" : "CSV"} →`}
              </button>
            </div>
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
