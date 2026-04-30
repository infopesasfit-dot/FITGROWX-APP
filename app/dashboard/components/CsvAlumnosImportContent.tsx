"use client";

import { useRef, useState } from "react";
import Papa from "papaparse";
import { ClipboardCopy, Check, Upload, Download } from "lucide-react";
import { supabase } from "@/lib/supabase";

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

interface ManualRow {
  full_name: string;
  phone_number: string;
}

type CsvInputRow = {
  full_name?: string;
  nombre_completo?: string;
  phone_number?: string;
  whatsapp?: string;
  phone?: string;
  telefono?: string;
};

interface CsvAlumnosImportContentProps {
  gymId: string;
  onImported: (count: number) => Promise<void> | void;
  onSecondaryAction?: () => Promise<void> | void;
  secondaryLabel?: string;
  confirmLabel?: string;
}

export function CsvAlumnosImportContent({
  gymId,
  onImported,
  onSecondaryAction,
  secondaryLabel = "Cancelar",
  confirmLabel = "Importar CSV",
}: CsvAlumnosImportContentProps) {
  const [csvData, setCsvData] = useState<ManualRow[]>([]);
  const [fileName, setFileName] = useState("");
  const [copied, setCopied] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  const handleCopyPrompt = async () => {
    await navigator.clipboard.writeText(AI_PROMPT);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setFileName(file.name);
    Papa.parse<CsvInputRow>(file, {
      header: true,
      skipEmptyLines: true,
      transformHeader: (h) => h.trim().toLowerCase().replace(/\s+/g, "_"),
      complete: (results) => {
        const parsed: ManualRow[] = results.data
          .filter(
            (r): r is CsvInputRow =>
              typeof r === "object" &&
              r !== null &&
              Boolean(r.full_name || r.nombre_completo || r.phone_number || r.whatsapp),
          )
          .map((r) => ({
            full_name: String(r.full_name ?? r.nombre_completo ?? "").trim(),
            phone_number: String(r.phone_number ?? r.whatsapp ?? r.phone ?? r.telefono ?? "").trim(),
          }))
          .filter((r) => r.full_name || r.phone_number);

        setCsvData(parsed);
        setError(null);
      },
      error: () => setError("No se pudo leer el archivo CSV."),
    });
  };

  const handleImport = async () => {
    if (csvData.length === 0) {
      setError("Subí un CSV válido antes de continuar.");
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const CHUNK = 200;
      for (let i = 0; i < csvData.length; i += CHUNK) {
        const { error: insertErr } = await supabase.from("alumnos").insert(
          csvData.slice(i, i + CHUNK).map((r) => ({
            gym_id: gymId,
            full_name: r.full_name,
            phone: r.phone_number,
            status: "activo",
          })),
        );
        if (insertErr) throw insertErr;
      }

      await onImported(csvData.length);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Ocurrió un error. Intentá de nuevo.");
    } finally {
      setLoading(false);
    }
  };

  const handleDownloadTemplate = () => {
    const csv = "full_name,phone_number\nJuan Perez,+5491122334455\nMaria Gomez,+5491166677788\n";
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = "fitgrowx_plantilla_alumnos.csv";
    link.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
      <div style={{ background: "#F8F4FF", border: "1px solid #E9D5FF", borderRadius: 14, padding: 16 }}>
        <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 10, marginBottom: 10 }}>
          <div>
            <p style={{ font: `700 0.82rem/1 ${fd}`, color: "#1E50F0", marginBottom: 4 }}>Paso 1 — Generá tu CSV con IA</p>
            <p style={{ font: `400 0.76rem/1.5 ${fb}`, color: "#1E50F0" }}>
              Copiá este prompt y pegalo en ChatGPT o Claude con tu lista de contactos.
            </p>
          </div>
          <button
            onClick={handleCopyPrompt}
            style={{
              display: "flex",
              alignItems: "center",
              gap: 6,
              padding: "8px 14px",
              borderRadius: 9999,
              border: "none",
              cursor: "pointer",
              background: copied ? "#FF6A00" : "#1E50F0",
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
        <pre
          style={{
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
          }}
        >
          {AI_PROMPT}
        </pre>
      </div>

      <div>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10, marginBottom: 10, flexWrap: "wrap" }}>
          <p style={{ font: `700 0.82rem/1 ${fd}`, color: t1 }}>Paso 2 — Subí el archivo CSV</p>
          <button
            onClick={handleDownloadTemplate}
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: 6,
              padding: "8px 12px",
              borderRadius: 9999,
              border: "1px solid rgba(30,80,240,0.14)",
              background: "rgba(30,80,240,0.05)",
              color: "#1E50F0",
              cursor: "pointer",
              font: `700 0.74rem/1 ${fb}`,
            }}
          >
            <Download size={13} />
            Descargar plantilla
          </button>
        </div>
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
          onMouseEnter={(e) => {
            e.currentTarget.style.borderColor = accent;
            e.currentTarget.style.background = `${accent}06`;
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.borderColor = fileName ? accent : "#D1D5DB";
            e.currentTarget.style.background = fileName ? `${accent}08` : "#FAFAFA";
          }}
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
              <p style={{ font: `400 0.72rem/1.45 ${fb}`, color: t3, marginTop: 4 }}>
                Columnas requeridas: <strong>full_name</strong>, <strong>phone_number</strong>
              </p>
            </>
          )}
        </div>
        <input ref={fileRef} type="file" accept=".csv,text/csv" onChange={handleFileChange} style={{ display: "none" }} />
      </div>

      {csvData.length > 0 && (
        <div style={{ border: "1px solid #E5E7EB", borderRadius: 10, overflow: "hidden" }}>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", background: "#F9FAFB", padding: "8px 14px", borderBottom: "1px solid #E5E7EB" }}>
            {["Nombre", "Teléfono"].map((h) => (
              <span key={h} style={{ font: `600 0.68rem/1 ${fb}`, color: t3, textTransform: "uppercase" }}>
                {h}
              </span>
            ))}
          </div>
          {csvData.slice(0, 5).map((r, i) => (
            <div key={`${r.full_name}-${r.phone_number}-${i}`} style={{ display: "grid", gridTemplateColumns: "1fr 1fr", padding: "9px 14px", borderBottom: i < Math.min(csvData.length, 5) - 1 ? "1px solid #F3F4F6" : "none" }}>
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

      {error && (
        <div style={{ background: "rgba(239,68,68,0.07)", border: "1px solid rgba(239,68,68,0.2)", borderRadius: 10, padding: "10px 14px" }}>
          <p style={{ font: `500 0.8rem/1 ${fb}`, color: "#DC2626" }}>{error}</p>
        </div>
      )}

      <div style={{ display: "flex", alignItems: "center", gap: 10, marginTop: 8 }}>
        {onSecondaryAction && (
          <button
            onClick={() => void onSecondaryAction()}
            style={{ flex: 1, padding: "13px", borderRadius: 12, border: "1px solid #E5E7EB", background: "none", font: `600 0.85rem/1 ${fb}`, color: t2, cursor: "pointer" }}
          >
            {secondaryLabel}
          </button>
        )}
        <button
          onClick={() => void handleImport()}
          disabled={loading}
          style={{
            flex: onSecondaryAction ? 2 : 1,
            padding: "13px",
            borderRadius: 12,
            border: "none",
            cursor: loading ? "not-allowed" : "pointer",
            background: loading ? "#D1D5DB" : accent,
            color: "white",
            font: `800 0.88rem/1 ${fd}`,
            boxShadow: loading ? "none" : `0 4px 14px ${accent}50`,
            transition: "background 0.14s, box-shadow 0.14s",
            opacity: loading ? 0.7 : 1,
          }}
        >
          {loading ? "Importando..." : `${confirmLabel}${csvData.length > 0 ? ` (${csvData.length})` : ""} →`}
        </button>
      </div>
    </div>
  );
}
