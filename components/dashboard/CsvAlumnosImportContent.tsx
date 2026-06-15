"use client";

import { useRef, useState } from "react";
import Papa from "papaparse";
import { ClipboardCopy, Check, Upload, Download, MessageSquare, X, AlertTriangle } from "lucide-react";

const accent = "#FF6A00";
const fd = "var(--font-inter, 'Inter', sans-serif)";
const fb = "var(--font-inter, 'Inter', sans-serif)";
const t1 = "#1A1D23";
const t2 = "#6B7280";
const t3 = "#9CA3AF";

const AI_PROMPT = `Tengo una lista de alumnos de mi gimnasio y necesito que conviertas el archivo que voy a adjuntar a un archivo CSV listo para importar.

IMPORTANTE:
- Analizá el archivo adjunto (Excel, CSV, PDF, imagen o texto).
- Convertí los datos al formato CSV.
- Entregame un archivo CSV descargable.
- La primera fila debe contener exactamente estos encabezados:
dni,full_name,telefono

Reglas:
- dni: número de documento solo con números, sin puntos ni espacios.`;

type CsvInputRow = {
  nombre?: string; apellido?: string; dni?: string; telefono?: string;
  full_name?: string; nombre_completo?: string; phone_number?: string;
  whatsapp?: string; phone?: string; documento?: string; document?: string;
};

// ── Validation ────────────────────────────────────────────────────────────────

type IssueField = "phone_number" | "dni" | "full_name";
interface RowIssue { field: IssueField; msg: string }

interface ValidatedRow {
  idx: number;
  full_name: string;
  phone_number: string;
  phone_normalized: string;
  dni: string;
  issues: RowIssue[];
}

function validatePhone(raw: string): { normalized: string; issue: RowIssue | null } {
  if (!raw.trim()) return { normalized: "", issue: null };
  const digits = raw.replace(/\D/g, "");
  if (digits.length < 8)
    return { normalized: raw, issue: { field: "phone_number", msg: "Muy corto — ¿falta código de área?" } };
  if (digits.length < 10)
    return { normalized: raw, issue: { field: "phone_number", msg: "Posible código de área faltante (ej: 11 para AMBA)" } };
  let d = digits;
  if (d.startsWith("0")) d = d.slice(1);
  if (!d.startsWith("54")) d = "549" + d;
  else if (d.startsWith("54") && !d.startsWith("549")) d = "549" + d.slice(2);
  return { normalized: "+" + d, issue: null };
}

function validateDni(dni: string): RowIssue | null {
  if (!dni.trim()) return null;
  const digits = dni.replace(/\./g, "").trim();
  if (!/^\d{6,9}$/.test(digits))
    return { field: "dni", msg: "DNI inválido — debe tener 6 a 9 dígitos" };
  return null;
}

function validateRow(raw: { idx: number; full_name: string; phone_number: string; dni: string }): ValidatedRow {
  const issues: RowIssue[] = [];
  if (raw.full_name.length < 2) issues.push({ field: "full_name", msg: "Nombre demasiado corto" });
  const { normalized, issue: phoneIssue } = validatePhone(raw.phone_number);
  if (phoneIssue) issues.push(phoneIssue);
  const dniIssue = validateDni(raw.dni);
  if (dniIssue) issues.push(dniIssue);
  return { ...raw, phone_normalized: normalized, issues };
}

// ── Types ─────────────────────────────────────────────────────────────────────

interface ImportedAlumno { id: string; phone: string | null; full_name: string }
type SendPhase = "idle" | "sending" | "done" | "cancelled";
type Phase = "upload" | "preview" | "done";

interface CsvAlumnosImportContentProps {
  gymId: string;
  gymPlanType?: string;
  currentAlumnoCount?: number;
  onImported: (count: number) => Promise<void> | void;
  onSecondaryAction?: () => Promise<void> | void;
  secondaryLabel?: string;
  confirmLabel?: string;
}

// ── Component ─────────────────────────────────────────────────────────────────

export function CsvAlumnosImportContent({
  gymId,
  gymPlanType = "crecimiento",
  currentAlumnoCount = 0,
  onImported,
  onSecondaryAction,
  secondaryLabel = "Cancelar",
}: CsvAlumnosImportContentProps) {
  const [phase,          setPhase]          = useState<Phase>("upload");
  const [fileName,       setFileName]       = useState("");
  const [skippedRows,    setSkippedRows]    = useState(0);
  const [validatedRows,  setValidatedRows]  = useState<ValidatedRow[]>([]);
  const [editingCell,    setEditingCell]    = useState<{ idx: number; field: IssueField } | null>(null);
  const [editValue,      setEditValue]      = useState("");
  const [copied,         setCopied]         = useState(false);
  const [loading,        setLoading]        = useState(false);
  const [error,          setError]          = useState<string | null>(null);
  const [partialCount,   setPartialCount]   = useState(0);
  const [importedAlumnos,setImportedAlumnos]= useState<ImportedAlumno[] | null>(null);
  const [importedCount,  setImportedCount]  = useState(0);
  const [sendPhase,      setSendPhase]      = useState<SendPhase>("idle");
  const [sendProgress,   setSendProgress]   = useState(0);
  const abortRef = useRef(false);
  const fileRef  = useRef<HTMLInputElement>(null);

  // ── Derived ────────────────────────────────────────────────────────────────
  const problemRows = validatedRows.filter(r => r.issues.length > 0);
  const cleanRows   = validatedRows.filter(r => r.issues.length === 0);

  // ── Handlers ───────────────────────────────────────────────────────────────

  const handleCopyPrompt = async () => {
    await navigator.clipboard.writeText(AI_PROMPT);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setFileName(file.name);
    setError(null);
    Papa.parse<CsvInputRow>(file, {
      header: true,
      skipEmptyLines: true,
      transformHeader: (h) => h.trim().toLowerCase().replace(/\s+/g, "_"),
      complete: (results) => {
        const allRows = results.data
          .filter((r): r is CsvInputRow => typeof r === "object" && r !== null)
          .map((r, i) => {
            const nombre   = String(r.nombre ?? "").trim();
            const apellido = String(r.apellido ?? "").trim();
            const full_name = nombre || apellido
              ? [nombre, apellido].filter(Boolean).join(" ")
              : String(r.full_name ?? r.nombre_completo ?? "").trim();
            const phone_number = String(r.telefono ?? r.phone_number ?? r.whatsapp ?? r.phone ?? "").trim();
            const dni = String(r.dni ?? r.documento ?? r.document ?? "").trim().replace(/\./g, "");
            return validateRow({ idx: i, full_name, phone_number, dni });
          });

        const withName = allRows.filter(r => r.full_name.length > 0);
        setSkippedRows(allRows.length - withName.length);
        setValidatedRows(withName.map((r, i) => ({ ...r, idx: i })));

        if (withName.length === 0) {
          setError("Ninguna fila tiene un nombre válido. Revisá que la columna se llame 'nombre', 'apellido' o 'full_name'.");
          return;
        }
        setPhase("preview");
      },
      error: (err) => setError(`No se pudo leer el archivo: ${err.message}.`),
    });
  };

  const startEdit = (idx: number, field: IssueField) => {
    const row = validatedRows.find(r => r.idx === idx);
    if (!row) return;
    setEditingCell({ idx, field });
    setEditValue(row[field]);
  };

  const commitEdit = () => {
    if (!editingCell) return;
    setValidatedRows(prev => prev.map(r => {
      if (r.idx !== editingCell.idx) return r;
      const updated = { ...r, [editingCell.field]: editValue.trim() };
      return validateRow({ idx: r.idx, full_name: updated.full_name, phone_number: updated.phone_number, dni: updated.dni });
    }));
    setEditingCell(null);
  };

  const friendlyInsertError = (msg: string): string => {
    if (msg.includes("23505") || msg.includes("duplicate key")) {
      if (msg.includes("dni"))   return "Hay alumnos con DNI duplicado. Revisá que no estés importando contactos que ya existen.";
      if (msg.includes("phone")) return "Hay alumnos con teléfono duplicado. Revisá que no estés importando contactos que ya existen.";
      return "Algunos registros ya existen (DNI o teléfono duplicado). Eliminá esas filas y volvé a intentarlo.";
    }
    if (msg.includes("violates not-null") || msg.includes("null value"))
      return "Una fila tiene un campo obligatorio vacío. Revisá que todos los contactos tengan nombre.";
    if (msg.includes("network") || msg.includes("fetch"))
      return "Error de conexión. Verificá tu internet y volvé a intentarlo.";
    return `Error al importar: ${msg}`;
  };

  const handleImport = async (rows: ValidatedRow[]) => {
    if (rows.length === 0) { setError("No hay alumnos para importar."); return; }

    setLoading(true);
    setError(null);
    setPartialCount(0);

    try {
      const res = await fetch("/api/admin/alumnos/import-csv", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          rows: rows.map(r => ({
            full_name: r.full_name,
            phone: r.phone_normalized || r.phone_number || null,
            dni: r.dni || null,
          })),
        }),
      });

      const data = await res.json();
      setLoading(false);

      if (!res.ok) {
        setError(data.error ?? "Error al importar.");
        if (data.inserted_count && data.inserted_count > 0) {
          setPartialCount(data.inserted_count);
        }
        return;
      }

      const inserted = (data.inserted ?? []) as ImportedAlumno[];
      setImportedAlumnos(inserted);
      setImportedCount(data.inserted_count ?? inserted.length);

      // Aviso suave si hay teléfonos duplicados
      if (data.duplicate_phones && data.duplicate_phones.length > 0) {
        const last4 = data.duplicate_phones.map((p: string) => p.slice(-4)).join(", ");
        setError(`Aviso: ${data.duplicate_phones.length} teléfono(s) ya existían en tu gym (terminados en ${last4}). Los alumnos se importaron igual.`);
      }
    } catch (err) {
      setLoading(false);
      setError("Error de conexión. Verificá tu internet y volvé a intentarlo.");
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
          method: "POST", headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ alumno_id: withPhone[i].id, type: "welcome" }),
        });
      } catch { /* continue */ }
      setSendProgress(i + 1);
      if (i < withPhone.length - 1 && !abortRef.current) {
        const delay = 10_000 + Math.random() * 10_000;
        await new Promise<void>(resolve => {
          const tid = setTimeout(resolve, delay);
          const check = setInterval(() => { if (abortRef.current) { clearTimeout(tid); clearInterval(check); resolve(); } }, 500);
          setTimeout(() => clearInterval(check), delay + 100);
        });
      }
    }
    setSendPhase(abortRef.current ? "cancelled" : "done");
    await onImported(importedCount);
  };

  const handleSkip = async () => { await onImported(importedCount); };

  const handleDownloadTemplate = () => {
    const csv = "nombre,apellido,dni,telefono\nJuan,Pérez,12345678,+5491122334455\nMaría,Gómez,87654321,+5491166677788\n";
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url; a.download = "fitgrowx_plantilla_alumnos.csv"; a.click();
    URL.revokeObjectURL(url);
  };

  // ── Phase: WA send (post-import) ───────────────────────────────────────────

  if (importedAlumnos !== null) {
    const withPhone = importedAlumnos.filter(a => a.phone);
    const pct = withPhone.length > 0 ? Math.round((sendProgress / withPhone.length) * 100) : 0;
    const isPartial = error !== null;
    return (
      <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
        <div style={{ textAlign: "center", padding: "8px 0" }}>
          <div style={{ fontSize: 36, marginBottom: 10 }}>{isPartial ? "⚠️" : "✅"}</div>
          <p style={{ font: `800 1.1rem/1 ${fd}`, color: t1 }}>{importedCount} alumnos importados</p>
          <p style={{ font: `400 0.8rem/1.4 ${fb}`, color: t2, marginTop: 6 }}>
            {withPhone.length > 0 ? `${withPhone.length} tienen número de WhatsApp.` : "Ninguno tiene teléfono registrado."}
          </p>
        </div>
        {isPartial && (
          <div style={{ background: "rgba(217,119,6,0.07)", border: "1px solid rgba(217,119,6,0.22)", borderRadius: 10, padding: "10px 14px" }}>
            <p style={{ font: `500 0.8rem/1.45 ${fb}`, color: "#92400E" }}>{error}</p>
          </div>
        )}
        {withPhone.length > 0 && sendPhase === "idle" && (
          <div style={{ background: "rgba(37,211,102,0.06)", border: "1px solid rgba(37,211,102,0.20)", borderRadius: 14, padding: "18px 20px" }}>
            <div style={{ display: "flex", alignItems: "flex-start", gap: 14 }}>
              <div style={{ width: 40, height: 40, borderRadius: 11, background: "rgba(37,211,102,0.12)", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                <MessageSquare size={18} color="#25D366" />
              </div>
              <div style={{ flex: 1 }}>
                <p style={{ font: `700 0.9rem/1 ${fd}`, color: t1, marginBottom: 5 }}>Enviar Link de Acceso por WhatsApp</p>
                <p style={{ font: `400 0.76rem/1.5 ${fb}`, color: t2 }}>Cada alumno recibirá un link único para entrar a su panel, sin contraseña.</p>
                <p style={{ font: `500 0.72rem/1.4 ${fb}`, color: t3, marginTop: 6 }}>
                  1 mensaje cada 10-20 seg para evitar restricciones de WhatsApp. Estimado:{" "}
                  <strong style={{ color: t2 }}>~{Math.ceil(withPhone.length * 15 / 60)} min</strong>
                </p>
              </div>
            </div>
          </div>
        )}
        {(sendPhase === "sending" || sendPhase === "done" || sendPhase === "cancelled") && (
          <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <span style={{ font: `600 0.82rem/1 ${fd}`, color: t1 }}>
                {sendPhase === "done" ? "✅ Accesos enviados" : sendPhase === "cancelled" ? "⛔ Envío cancelado" : `Enviando: ${sendProgress}/${withPhone.length}...`}
              </span>
              <span style={{ font: `700 0.8rem/1 ${fb}`, color: accent }}>{pct}%</span>
            </div>
            <div style={{ height: 8, background: "rgba(0,0,0,0.07)", borderRadius: 9999, overflow: "hidden" }}>
              <div style={{ height: "100%", width: `${pct}%`, background: sendPhase === "cancelled" ? "#DC2626" : accent, borderRadius: 9999, transition: "width 0.4s ease" }} />
            </div>
          </div>
        )}
        <div style={{ display: "flex", gap: 10 }}>
          {sendPhase === "idle" && (
            <>
              <button onClick={handleSkip} style={{ flex: 1, padding: "12px", borderRadius: 12, border: "1px solid #E5E7EB", background: "none", font: `600 0.85rem/1 ${fb}`, color: t2, cursor: "pointer" }}>
                {withPhone.length === 0 ? "Cerrar" : "Omitir envío"}
              </button>
              {withPhone.length > 0 && (
                <button onClick={() => void handleSendAccesos()} style={{ flex: 2, padding: "12px", borderRadius: 12, border: "none", background: "#25D366", color: "white", font: `800 0.88rem/1 ${fd}`, cursor: "pointer", boxShadow: "0 4px 14px rgba(37,211,102,0.30)", display: "flex", alignItems: "center", justifyContent: "center", gap: 8 }}>
                  <MessageSquare size={15} /> Enviar accesos ({withPhone.length})
                </button>
              )}
            </>
          )}
          {sendPhase === "sending" && (
            <button onClick={() => { abortRef.current = true; }} style={{ flex: 1, padding: "12px", borderRadius: 12, border: "1px solid rgba(220,38,38,0.25)", background: "rgba(220,38,38,0.05)", font: `600 0.85rem/1 ${fb}`, color: "#DC2626", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", gap: 6 }}>
              <X size={14} /> Cancelar envío
            </button>
          )}
          {(sendPhase === "done" || sendPhase === "cancelled") && (
            <button onClick={handleSkip} style={{ flex: 1, padding: "12px", borderRadius: 12, border: "none", background: accent, color: "white", font: `700 0.88rem/1 ${fd}`, cursor: "pointer" }}>
              Cerrar
            </button>
          )}
        </div>
      </div>
    );
  }

  // ── Phase: preview + validation ────────────────────────────────────────────

  if (phase === "preview") {
    const colGrid = "minmax(120px,2fr) minmax(100px,1.5fr) minmax(80px,1fr)";
    const thStyle: React.CSSProperties = { font: `600 0.68rem/1 ${fb}`, color: t3, textTransform: "uppercase", letterSpacing: "0.04em" };

    const renderCell = (row: ValidatedRow, field: IssueField, value: string) => {
      const issue = row.issues.find(i => i.field === field);
      const isEditing = editingCell?.idx === row.idx && editingCell?.field === field;
      if (isEditing) {
        return (
          <div style={{ display: "flex", flexDirection: "column", gap: 2 }}>
            <input
              autoFocus
              value={editValue}
              onChange={e => setEditValue(e.target.value)}
              onBlur={commitEdit}
              onKeyDown={e => { if (e.key === "Enter") commitEdit(); if (e.key === "Escape") setEditingCell(null); }}
              style={{ width: "100%", padding: "4px 8px", border: `1px solid ${accent}`, borderRadius: 6, font: `400 0.8rem/1 ${fb}`, color: t1, outline: "none", boxSizing: "border-box" }}
            />
          </div>
        );
      }
      return (
        <div style={{ display: "flex", flexDirection: "column", gap: 2 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 4 }}>
            <span style={{ font: `${issue ? "500" : "400"} 0.8rem/1 ${fb}`, color: issue ? "#92400E" : t1 }}>
              {value || <span style={{ color: t3, font: `400 0.75rem/1 ${fb}` }}>vacío</span>}
            </span>
            {issue && (
              <button onClick={() => startEdit(row.idx, field)} title="Editar" style={{ background: "none", border: "none", cursor: "pointer", color: accent, display: "flex", padding: 0, flexShrink: 0 }}>
                <AlertTriangle size={12} />
              </button>
            )}
          </div>
          {issue && (
            <span style={{ font: `400 0.68rem/1.3 ${fb}`, color: "#B45309", lineHeight: 1.3 }}>{issue.msg}</span>
          )}
        </div>
      );
    };

    return (
      <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>

        {/* Summary banner */}
        <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
          <div style={{ flex: 1, minWidth: 120, background: "rgba(34,197,94,0.07)", border: "1px solid rgba(34,197,94,0.20)", borderRadius: 10, padding: "10px 14px", display: "flex", alignItems: "center", gap: 8 }}>
            <span style={{ fontSize: "1.1rem" }}>✅</span>
            <div>
              <p style={{ font: `700 0.95rem/1 ${fd}`, color: "#15803D" }}>{cleanRows.length}</p>
              <p style={{ font: `400 0.72rem/1 ${fb}`, color: "#166534", marginTop: 2 }}>listos para importar</p>
            </div>
          </div>
          {problemRows.length > 0 && (
            <div style={{ flex: 1, minWidth: 120, background: "rgba(249,115,22,0.07)", border: "1px solid rgba(249,115,22,0.22)", borderRadius: 10, padding: "10px 14px", display: "flex", alignItems: "center", gap: 8 }}>
              <span style={{ fontSize: "1.1rem" }}>⚠️</span>
              <div>
                <p style={{ font: `700 0.95rem/1 ${fd}`, color: "#C2410C" }}>{problemRows.length}</p>
                <p style={{ font: `400 0.72rem/1 ${fb}`, color: "#9A3412", marginTop: 2 }}>con datos para revisar</p>
              </div>
            </div>
          )}
        </div>

        {problemRows.length > 0 && (
          <p style={{ font: `400 0.76rem/1.5 ${fb}`, color: t2, margin: 0 }}>
            Hacé clic en <AlertTriangle size={11} style={{ display: "inline", verticalAlign: "middle", color: accent }} /> para editar un campo. Podés importar todos igualmente o solo los válidos.
          </p>
        )}

        {/* Table */}
        <div style={{ border: "1px solid #E5E7EB", borderRadius: 10, overflow: "hidden" }}>
          {/* Header */}
          <div style={{ display: "grid", gridTemplateColumns: colGrid, background: "#F9FAFB", padding: "8px 14px", borderBottom: "1px solid #E5E7EB", gap: 8 }}>
            <span style={thStyle}>Nombre</span>
            <span style={thStyle}>Teléfono</span>
            <span style={thStyle}>DNI</span>
          </div>
          {/* Scrollable body — problems first */}
          <div style={{ maxHeight: 260, overflowY: "auto" }}>
            {[...problemRows, ...cleanRows].map((row, i) => {
              const hasProblem = row.issues.length > 0;
              const isLast = i === validatedRows.length - 1;
              return (
                <div
                  key={row.idx}
                  style={{
                    display: "grid", gridTemplateColumns: colGrid, gap: 8,
                    padding: "9px 14px",
                    borderBottom: isLast ? "none" : "1px solid #F3F4F6",
                    borderLeft: hasProblem ? `3px solid ${accent}` : "3px solid transparent",
                    background: hasProblem ? "rgba(249,115,22,0.03)" : "transparent",
                    alignItems: "start",
                  }}
                >
                  {renderCell(row, "full_name", row.full_name)}
                  {renderCell(row, "phone_number", row.phone_normalized || row.phone_number)}
                  {renderCell(row, "dni", row.dni)}
                </div>
              );
            })}
          </div>
        </div>

        {skippedRows > 0 && (
          <p style={{ font: `400 0.74rem/1.4 ${fb}`, color: t3 }}>
            ⚠️ {skippedRows} fila{skippedRows !== 1 ? "s" : ""} sin nombre ignorada{skippedRows !== 1 ? "s" : ""}.
          </p>
        )}

        {error && (
          <div style={{ background: "rgba(239,68,68,0.07)", border: "1px solid rgba(239,68,68,0.2)", borderRadius: 10, padding: "10px 14px" }}>
            <p style={{ font: `500 0.8rem/1 ${fb}`, color: "#DC2626" }}>{error}</p>
          </div>
        )}

        {/* Actions */}
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
          <button
            onClick={() => { setPhase("upload"); setError(null); }}
            style={{ padding: "11px 16px", borderRadius: 12, border: "1px solid #E5E7EB", background: "none", font: `600 0.82rem/1 ${fb}`, color: t2, cursor: "pointer", flexShrink: 0 }}
          >
            ← Cambiar archivo
          </button>
          {problemRows.length > 0 && cleanRows.length > 0 && (
            <button
              onClick={() => void handleImport(cleanRows)}
              disabled={loading}
              style={{ flex: 1, padding: "11px 14px", borderRadius: 12, border: `1px solid ${accent}30`, background: `${accent}08`, font: `600 0.82rem/1 ${fb}`, color: accent, cursor: loading ? "not-allowed" : "pointer", opacity: loading ? 0.6 : 1, whiteSpace: "nowrap" }}
            >
              Solo válidos ({cleanRows.length})
            </button>
          )}
          <button
            onClick={() => void handleImport(validatedRows)}
            disabled={loading}
            style={{ flex: 2, padding: "11px 16px", borderRadius: 12, border: "none", background: loading ? "#D1D5DB" : accent, color: "white", font: `800 0.88rem/1 ${fd}`, cursor: loading ? "not-allowed" : "pointer", boxShadow: loading ? "none" : `0 4px 14px ${accent}50`, whiteSpace: "nowrap" }}
          >
            {loading
              ? `Importando${partialCount > 0 ? ` (${partialCount}/${validatedRows.length})` : ""}...`
              : `Importar todos (${validatedRows.length}) →`}
          </button>
        </div>
      </div>
    );
  }

  // ── Phase: upload ──────────────────────────────────────────────────────────

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
      <div style={{ background: "#F8F4FF", border: "1px solid #E9D5FF", borderRadius: 14, padding: 16 }}>
        <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 10, marginBottom: 10 }}>
          <div>
            <p style={{ font: `700 0.82rem/1 ${fd}`, color: "#1E50F0", marginBottom: 4 }}>Paso 1 — Generá tu CSV con IA</p>
            <p style={{ font: `400 0.76rem/1.5 ${fb}`, color: "#1E50F0" }}>Copiá este prompt y pegalo en ChatGPT o Claude con tu lista de contactos.</p>
          </div>
          <button onClick={handleCopyPrompt} style={{ display: "flex", alignItems: "center", gap: 6, padding: "8px 14px", borderRadius: 9999, border: "none", cursor: "pointer", background: copied ? accent : "#1E50F0", color: "white", font: `700 0.75rem/1 ${fb}`, transition: "background 0.2s", flexShrink: 0 }}>
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
          <button onClick={handleDownloadTemplate} style={{ display: "inline-flex", alignItems: "center", gap: 6, padding: "8px 12px", borderRadius: 9999, border: "1px solid rgba(30,80,240,0.14)", background: "rgba(30,80,240,0.05)", color: "#1E50F0", cursor: "pointer", font: `700 0.74rem/1 ${fb}` }}>
            <Download size={13} /> Descargar plantilla
          </button>
        </div>
        <div
          onClick={() => fileRef.current?.click()}
          style={{ border: `2px dashed ${fileName ? accent : "#D1D5DB"}`, borderRadius: 14, padding: "28px 20px", textAlign: "center", cursor: "pointer", background: fileName ? `${accent}08` : "#FAFAFA" }}
          onMouseEnter={e => { e.currentTarget.style.borderColor = accent; }}
          onMouseLeave={e => { e.currentTarget.style.borderColor = fileName ? accent : "#D1D5DB"; }}
        >
          <Upload size={24} color={fileName ? accent : t3} style={{ margin: "0 auto 10px" }} />
          <p style={{ font: `600 0.85rem/1 ${fd}`, color: t2 }}>Hacé clic para seleccionar el CSV</p>
          <p style={{ font: `400 0.72rem/1.45 ${fb}`, color: t3, marginTop: 4 }}>
            Columnas: <strong>nombre</strong>, <strong>apellido</strong>, <strong>dni</strong>, <strong>telefono</strong>
          </p>
        </div>
        <input ref={fileRef} type="file" accept=".csv,text/csv" onChange={handleFileChange} style={{ display: "none" }} />
      </div>

      {error && (
        <div style={{ background: "rgba(239,68,68,0.07)", border: "1px solid rgba(239,68,68,0.2)", borderRadius: 10, padding: "10px 14px" }}>
          <p style={{ font: `500 0.8rem/1 ${fb}`, color: "#DC2626" }}>{error}</p>
        </div>
      )}

      <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
        {onSecondaryAction && (
          <button onClick={() => void onSecondaryAction()} style={{ flex: 1, padding: "13px", borderRadius: 12, border: "1px solid #E5E7EB", background: "none", font: `600 0.85rem/1 ${fb}`, color: t2, cursor: "pointer" }}>
            {secondaryLabel}
          </button>
        )}
      </div>
    </div>
  );
}
