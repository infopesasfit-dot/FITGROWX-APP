"use client";

import { useRef, useState } from "react";
import Papa from "papaparse";
import { ClipboardCopy, Check, Upload, Download, MessageSquare, X } from "lucide-react";
import { supabase } from "@/lib/supabase";

const accent = "#FF6A00";
const fd = "var(--font-inter, 'Inter', sans-serif)";
const fb = "var(--font-inter, 'Inter', sans-serif)";
const t1 = "#1A1D23";
const t2 = "#6B7280";
const t3 = "#9CA3AF";

const AI_PROMPT = `Tengo una lista de contactos de mi gimnasio y necesito exportarla como CSV con exactamente estas cuatro columnas:
nombre,apellido,dni,telefono

Reglas:
- nombre: nombre de pila de la persona
- apellido: apellido de la persona
- dni: número de documento (solo dígitos, sin puntos)
- telefono: número con código de país si lo tenés (ej: +5491122334455)
- Sin filas de encabezado extra, solo los datos
- Sin comillas innecesarias
- Una persona por línea

Por favor convertí mis contactos a ese formato CSV.`;

interface ManualRow {
  full_name: string;
  phone_number: string;
  dni: string;
}

interface ImportedAlumno {
  id: string;
  phone: string | null;
  full_name: string;
}

type CsvInputRow = {
  nombre?: string;
  apellido?: string;
  dni?: string;
  telefono?: string;
  full_name?: string;
  nombre_completo?: string;
  phone_number?: string;
  whatsapp?: string;
  phone?: string;
  documento?: string;
  document?: string;
};

type SendPhase = "idle" | "sending" | "done" | "cancelled";

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
  const [csvData,        setCsvData]        = useState<ManualRow[]>([]);
  const [fileName,       setFileName]       = useState("");
  const [copied,         setCopied]         = useState(false);
  const [loading,        setLoading]        = useState(false);
  const [error,          setError]          = useState<string | null>(null);

  // post-import phase
  const [importedAlumnos, setImportedAlumnos] = useState<ImportedAlumno[] | null>(null);
  const [importedCount,   setImportedCount]   = useState(0);
  const [sendPhase,       setSendPhase]       = useState<SendPhase>("idle");
  const [sendProgress,    setSendProgress]    = useState(0);
  const abortRef = useRef(false);

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
          .filter((r): r is CsvInputRow => typeof r === "object" && r !== null)
          .map((r) => {
            const nombre   = String(r.nombre ?? "").trim();
            const apellido = String(r.apellido ?? "").trim();
            let full_name  = "";
            if (nombre || apellido) {
              full_name = [nombre, apellido].filter(Boolean).join(" ");
            } else {
              full_name = String(r.full_name ?? r.nombre_completo ?? "").trim();
            }
            const phone_number = String(r.telefono ?? r.phone_number ?? r.whatsapp ?? r.phone ?? "").trim();
            const dni = String(r.dni ?? r.documento ?? r.document ?? "").trim().replace(/\./g, "");
            return { full_name, phone_number, dni };
          })
          .filter((r) => r.full_name || r.phone_number);

        setCsvData(parsed);
        setError(null);
      },
      error: () => setError("No se pudo leer el archivo CSV."),
    });
  };

  const handleImport = async () => {
    if (csvData.length === 0) { setError("Subí un CSV válido antes de continuar."); return; }
    setLoading(true);
    setError(null);
    const allInserted: ImportedAlumno[] = [];
    try {
      const CHUNK = 200;
      for (let i = 0; i < csvData.length; i += CHUNK) {
        const { data, error: insertErr } = await supabase.from("alumnos").insert(
          csvData.slice(i, i + CHUNK).map((r) => ({
            gym_id:    gymId,
            full_name: r.full_name,
            phone:     r.phone_number || null,
            dni:       r.dni || null,
            status:    "activo",
          }))
        ).select("id, phone, full_name");
        if (insertErr) throw insertErr;
        if (data) allInserted.push(...(data as ImportedAlumno[]));
      }
      setImportedAlumnos(allInserted);
      setImportedCount(allInserted.length);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Ocurrió un error. Intentá de nuevo.");
    } finally {
      setLoading(false);
    }
  };

  const handleSendAccesos = async () => {
    if (!importedAlumnos) return;
    const withPhone = importedAlumnos.filter(a => a.phone);
    if (withPhone.length === 0) return;

    abortRef.current = false;
    setSendPhase("sending");
    setSendProgress(0);

    for (let i = 0; i < withPhone.length; i++) {
      if (abortRef.current) break;

      try {
        await fetch("/api/alumno/send-welcome", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ alumno_id: withPhone[i].id, type: "welcome" }),
        });
      } catch { /* continue on error */ }

      setSendProgress(i + 1);

      if (i < withPhone.length - 1 && !abortRef.current) {
        const delay = 10_000 + Math.random() * 10_000;
        await new Promise<void>(resolve => {
          const tid = setTimeout(resolve, delay);
          // allow cancel to short-circuit
          const check = setInterval(() => {
            if (abortRef.current) { clearTimeout(tid); clearInterval(check); resolve(); }
          }, 500);
          // clean up interval after timeout fires
          setTimeout(() => clearInterval(check), delay + 100);
        });
      }
    }

    setSendPhase(abortRef.current ? "cancelled" : "done");
    await onImported(importedCount);
  };

  const handleSkip = async () => {
    await onImported(importedCount);
  };

  const handleDownloadTemplate = () => {
    const csv = "nombre,apellido,dni,telefono\nJuan,Pérez,12345678,+5491122334455\nMaría,Gómez,87654321,+5491166677788\n";
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = "fitgrowx_plantilla_alumnos.csv";
    link.click();
    URL.revokeObjectURL(url);
  };

  // ── Phase 2: WA send panel ─────────────────────────────────────────────────
  if (importedAlumnos !== null) {
    const withPhone = importedAlumnos.filter(a => a.phone);
    const pct = withPhone.length > 0 ? Math.round((sendProgress / withPhone.length) * 100) : 0;

    return (
      <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
        {/* Success header */}
        <div style={{ textAlign: "center", padding: "8px 0" }}>
          <div style={{ fontSize: 36, marginBottom: 10 }}>✅</div>
          <p style={{ font: `800 1.1rem/1 ${fd}`, color: t1 }}>{importedCount} alumnos importados</p>
          <p style={{ font: `400 0.8rem/1.4 ${fb}`, color: t2, marginTop: 6 }}>
            {withPhone.length > 0
              ? `${withPhone.length} tienen número de WhatsApp.`
              : "Ninguno tiene número de teléfono registrado."}
          </p>
        </div>

        {withPhone.length > 0 && sendPhase === "idle" && (
          <div style={{ background: "rgba(37,211,102,0.06)", border: "1px solid rgba(37,211,102,0.20)", borderRadius: 14, padding: "18px 20px" }}>
            <div style={{ display: "flex", alignItems: "flex-start", gap: 14 }}>
              <div style={{ width: 40, height: 40, borderRadius: 11, background: "rgba(37,211,102,0.12)", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                <MessageSquare size={18} color="#25D366" />
              </div>
              <div style={{ flex: 1 }}>
                <p style={{ font: `700 0.9rem/1 ${fd}`, color: t1, marginBottom: 5 }}>
                  Enviar Link de Acceso por WhatsApp
                </p>
                <p style={{ font: `400 0.76rem/1.5 ${fb}`, color: t2 }}>
                  Cada alumno recibirá un link único para entrar directo a su panel (membresía + QR), sin necesidad de contraseña.
                </p>
                <p style={{ font: `500 0.72rem/1.4 ${fb}`, color: t3, marginTop: 6 }}>
                  Se envía 1 mensaje cada 10-20 segundos para evitar restricciones de WhatsApp. Estimado:{" "}
                  <strong style={{ color: t2 }}>~{Math.ceil(withPhone.length * 15 / 60)} min</strong>
                </p>
              </div>
            </div>
          </div>
        )}

        {/* Progress bar while sending */}
        {(sendPhase === "sending" || sendPhase === "done" || sendPhase === "cancelled") && (
          <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <span style={{ font: `600 0.82rem/1 ${fd}`, color: t1 }}>
                {sendPhase === "done"      ? "✅ Accesos enviados" :
                 sendPhase === "cancelled" ? "⛔ Envío cancelado" :
                 `Enviando accesos: ${sendProgress}/${withPhone.length}...`}
              </span>
              <span style={{ font: `700 0.8rem/1 ${fb}`, color: accent }}>{pct}%</span>
            </div>
            <div style={{ height: 8, background: "rgba(0,0,0,0.07)", borderRadius: 9999, overflow: "hidden" }}>
              <div style={{
                height: "100%",
                width: `${pct}%`,
                background: sendPhase === "cancelled" ? "#DC2626" : accent,
                borderRadius: 9999,
                transition: "width 0.4s ease",
              }} />
            </div>
            {sendPhase === "sending" && sendProgress > 0 && (
              <p style={{ font: `400 0.72rem/1 ${fb}`, color: t3 }}>
                Próximo envío en ~{Math.round(10 + Math.random() * 10)}s…
              </p>
            )}
          </div>
        )}

        {/* Action buttons */}
        <div style={{ display: "flex", gap: 10 }}>
          {sendPhase === "idle" && (
            <>
              <button
                onClick={handleSkip}
                style={{ flex: 1, padding: "12px", borderRadius: 12, border: "1px solid #E5E7EB", background: "none", font: `600 0.85rem/1 ${fb}`, color: t2, cursor: "pointer" }}
              >
                {withPhone.length === 0 ? "Cerrar" : "Omitir envío"}
              </button>
              {withPhone.length > 0 && (
                <button
                  onClick={() => void handleSendAccesos()}
                  style={{ flex: 2, padding: "12px", borderRadius: 12, border: "none", background: "#25D366", color: "white", font: `800 0.88rem/1 ${fd}`, cursor: "pointer", boxShadow: "0 4px 14px rgba(37,211,102,0.30)", display: "flex", alignItems: "center", justifyContent: "center", gap: 8 }}
                >
                  <MessageSquare size={15} /> Enviar accesos ({withPhone.length})
                </button>
              )}
            </>
          )}
          {sendPhase === "sending" && (
            <button
              onClick={() => { abortRef.current = true; }}
              style={{ flex: 1, padding: "12px", borderRadius: 12, border: "1px solid rgba(220,38,38,0.25)", background: "rgba(220,38,38,0.05)", font: `600 0.85rem/1 ${fb}`, color: "#DC2626", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", gap: 6 }}
            >
              <X size={14} /> Cancelar envío
            </button>
          )}
          {(sendPhase === "done" || sendPhase === "cancelled") && (
            <button
              onClick={handleSkip}
              style={{ flex: 1, padding: "12px", borderRadius: 12, border: "none", background: accent, color: "white", font: `700 0.88rem/1 ${fd}`, cursor: "pointer" }}
            >
              Cerrar
            </button>
          )}
        </div>
      </div>
    );
  }

  // ── Phase 1: CSV import ────────────────────────────────────────────────────
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
            style={{ display: "flex", alignItems: "center", gap: 6, padding: "8px 14px", borderRadius: 9999, border: "none", cursor: "pointer", background: copied ? "#FF6A00" : "#1E50F0", color: "white", font: `700 0.75rem/1 ${fb}`, transition: "background 0.2s", flexShrink: 0 }}
          >
            {copied ? <Check size={13} /> : <ClipboardCopy size={13} />}
            {copied ? "Copiado" : "Copiar Prompt"}
          </button>
        </div>
        <pre style={{ background: "rgba(109,40,217,0.06)", border: "1px solid rgba(109,40,217,0.12)", borderRadius: 9, padding: "10px 12px", font: `400 0.72rem/1.6 ${fb}`, color: "#4C1D95", whiteSpace: "pre-wrap", wordBreak: "break-word", margin: 0, maxHeight: 120, overflowY: "auto" }}>
          {AI_PROMPT}
        </pre>
      </div>

      <div>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10, marginBottom: 10, flexWrap: "wrap" }}>
          <p style={{ font: `700 0.82rem/1 ${fd}`, color: t1 }}>Paso 2 — Subí el archivo CSV</p>
          <button
            onClick={handleDownloadTemplate}
            style={{ display: "inline-flex", alignItems: "center", gap: 6, padding: "8px 12px", borderRadius: 9999, border: "1px solid rgba(30,80,240,0.14)", background: "rgba(30,80,240,0.05)", color: "#1E50F0", cursor: "pointer", font: `700 0.74rem/1 ${fb}` }}
          >
            <Download size={13} />
            Descargar plantilla
          </button>
        </div>
        <div
          onClick={() => fileRef.current?.click()}
          style={{ border: `2px dashed ${fileName ? accent : "#D1D5DB"}`, borderRadius: 14, padding: "28px 20px", textAlign: "center", cursor: "pointer", transition: "border-color 0.14s, background 0.14s", background: fileName ? `${accent}08` : "#FAFAFA" }}
          onMouseEnter={(e) => { e.currentTarget.style.borderColor = accent; e.currentTarget.style.background = `${accent}06`; }}
          onMouseLeave={(e) => { e.currentTarget.style.borderColor = fileName ? accent : "#D1D5DB"; e.currentTarget.style.background = fileName ? `${accent}08` : "#FAFAFA"; }}
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
                Columnas: <strong>nombre</strong>, <strong>apellido</strong>, <strong>dni</strong>, <strong>telefono</strong>
              </p>
            </>
          )}
        </div>
        <input ref={fileRef} type="file" accept=".csv,text/csv" onChange={handleFileChange} style={{ display: "none" }} />
      </div>

      {csvData.length > 0 && (
        <div style={{ border: "1px solid #E5E7EB", borderRadius: 10, overflow: "hidden" }}>
          <div style={{ display: "grid", gridTemplateColumns: "2fr 1fr 1fr", background: "#F9FAFB", padding: "8px 14px", borderBottom: "1px solid #E5E7EB" }}>
            {["Nombre completo", "DNI", "Teléfono"].map((h) => (
              <span key={h} style={{ font: `600 0.68rem/1 ${fb}`, color: t3, textTransform: "uppercase" }}>{h}</span>
            ))}
          </div>
          {csvData.slice(0, 5).map((r, i) => (
            <div key={`${r.full_name}-${i}`} style={{ display: "grid", gridTemplateColumns: "2fr 1fr 1fr", padding: "9px 14px", borderBottom: i < Math.min(csvData.length, 5) - 1 ? "1px solid #F3F4F6" : "none" }}>
              <span style={{ font: `500 0.8rem/1 ${fb}`, color: t1 }}>{r.full_name || "—"}</span>
              <span style={{ font: `400 0.8rem/1 ${fb}`, color: t2 }}>{r.dni || "—"}</span>
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
          style={{ flex: onSecondaryAction ? 2 : 1, padding: "13px", borderRadius: 12, border: "none", cursor: loading ? "not-allowed" : "pointer", background: loading ? "#D1D5DB" : accent, color: "white", font: `800 0.88rem/1 ${fd}`, boxShadow: loading ? "none" : `0 4px 14px ${accent}50`, transition: "background 0.14s, box-shadow 0.14s", opacity: loading ? 0.7 : 1 }}
        >
          {loading ? "Importando..." : `${confirmLabel}${csvData.length > 0 ? ` (${csvData.length})` : ""} →`}
        </button>
      </div>
    </div>
  );
}
