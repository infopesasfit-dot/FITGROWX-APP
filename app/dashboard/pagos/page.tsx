"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import {
  TrendingUp, CreditCard, Wallet, CheckCircle, Clock, XCircle,
  Plus, Upload, X, Smartphone, DollarSign, Building2, Settings,
  Users, ShoppingBag,
} from "lucide-react";
import { supabase } from "@/lib/supabase";
import { getPagoAlumnoSummary, getPlanPeriodo } from "@/lib/supabase-relations";
import { addMonths } from "@/lib/date-utils";
import { getCachedProfile, getPageCache, setPageCache } from "@/lib/gym-cache";

// ── Brand tokens ──────────────────────────────────────────────────────────────
const fd = "var(--font-inter, 'Inter', sans-serif)";
const fb = "var(--font-inter, 'Inter', sans-serif)";
const t1 = "#1A1D23";
const t2 = "#6B7280";
const t3 = "#9CA3AF";
const card: React.CSSProperties = {
  background: "#FFFFFF",
  border: "1px solid rgba(0,0,0,0.05)",
  borderRadius: 14,
  boxShadow: "0 2px 8px rgba(0,0,0,0.06), 0 0 1px rgba(0,0,0,0.04)",
};
const ORANGE = "#F97316";
const BLUE   = "#4B6BFB";
const GREEN  = "#FF6A00";

// ── Types ─────────────────────────────────────────────────────────────────────
type Method     = "efectivo" | "transferencia" | "mercadopago" | "debito";
type PagoStatus = "pendiente" | "validado" | "rechazado";
type Concepto   = "membresia" | "clase" | "producto";

interface Pago {
  id: string;
  amount: number;
  date: string;
  method: Method;
  status: PagoStatus;
  concepto: Concepto;
  descripcion: string | null;
  comprobante_url: string | null;
  notes: string | null;
  alumno_id: string;
  alumnos: { full_name: string; phone: string | null } | null;
}

type PagoRow = {
  id: string;
  amount: number;
  date: string;
  method: Method;
  status: PagoStatus;
  concepto: Concepto;
  descripcion: string | null;
  comprobante_url: string | null;
  notes: string | null;
  alumno_id: string;
  alumnos: unknown;
};

interface AlumnoOption {
  id: string;
  full_name: string;
}

interface Cuenta {
  id: string;
  tipo: "alias" | "cbu" | "mercadopago";
  valor: string;
  titular: string | null;
  banco: string | null;
  activa: boolean;
}

const METHOD_META: Record<Method, { label: string; color: string; bg: string; icon: React.ReactNode }> = {
  efectivo:      { label: "Efectivo",      color: "#FF6A00", bg: "rgba(255,106,0,0.08)",   icon: <DollarSign size={14} /> },
  transferencia: { label: "Transferencia", color: BLUE,      bg: "rgba(75,107,251,0.08)",  icon: <Building2 size={14} /> },
  mercadopago:   { label: "Mercado Pago",  color: "#1E50F0", bg: "rgba(30,80,240,0.08)",   icon: <Smartphone size={14} /> },
  debito:        { label: "Débito",        color: "#1E50F0", bg: "rgba(30,80,240,0.08)",  icon: <Wallet size={14} /> },
};

const STATUS_META: Record<PagoStatus, { label: string; color: string; bg: string; icon: React.ReactNode }> = {
  pendiente: { label: "Pendiente", color: "#D97706", bg: "rgba(217,119,6,0.08)",   icon: <Clock size={11} /> },
  validado:  { label: "Validado",  color: "#FF6A00", bg: "rgba(255,106,0,0.08)",   icon: <CheckCircle size={11} /> },
  rechazado: { label: "Rechazado", color: "#DC2626", bg: "rgba(220,38,38,0.08)",   icon: <XCircle size={11} /> },
};

function initials(name: string) {
  return name.split(" ").slice(0, 2).map(w => w[0]).join("").toUpperCase();
}

function fmtARS(n: number) {
  return "$" + n.toLocaleString("es-AR");
}

const CONCEPTO_META: Record<Concepto, { label: string; color: string; bg: string; icon: React.ReactNode }> = {
  membresia: { label: "Membresía",    color: "#FF6A00", bg: "rgba(255,106,0,0.08)",  icon: <CreditCard size={11} /> },
  clase:     { label: "Clase/Evento", color: "#1E50F0", bg: "rgba(30,80,240,0.08)",  icon: <Users size={11} /> },
  producto:  { label: "Producto",     color: "#16A34A", bg: "rgba(22,163,74,0.08)",  icon: <ShoppingBag size={11} /> },
};

function mapPagoRow(row: PagoRow): Pago {
  return {
    id: row.id,
    amount: row.amount,
    date: row.date,
    method: row.method,
    status: row.status,
    concepto: row.concepto ?? "membresia",
    descripcion: row.descripcion ?? null,
    comprobante_url: row.comprobante_url,
    notes: row.notes,
    alumno_id: row.alumno_id,
    alumnos: getPagoAlumnoSummary(row.alumnos),
  };
}

// ── Chip ──────────────────────────────────────────────────────────────────────
function Chip({ meta }: { meta: { label: string; color: string; bg: string; icon: React.ReactNode } }) {
  return (
    <span style={{
      display: "inline-flex", alignItems: "center", gap: 4,
      background: meta.bg, color: meta.color,
      font: `600 0.68rem/1 ${fb}`, padding: "3px 9px", borderRadius: 9999,
    }}>
      {meta.icon} {meta.label}
    </span>
  );
}

// ── ProgressBar ───────────────────────────────────────────────────────────────
function ProgressBar({ pct, color }: { pct: number; color: string }) {
  return (
    <div style={{ height: 5, background: "rgba(0,0,0,0.07)", borderRadius: 9999, overflow: "hidden", marginTop: 8 }}>
      <div style={{ height: "100%", width: `${pct}%`, background: color, borderRadius: 9999, transition: "width 0.8s cubic-bezier(.34,1.56,.64,1)" }} />
    </div>
  );
}

// ── Page ──────────────────────────────────────────────────────────────────────
export default function PagosPage() {
  const [isMobile, setIsMobile] = useState(false);
  const [role,        setRole]        = useState<string>("admin");
  const [gymId,       setGymId]       = useState<string | null>(null);
  const [userId,      setUserId]      = useState<string | null>(null);
  const [pagos,       setPagos]       = useState<Pago[]>([]);
  const [cuentas,     setCuentas]     = useState<Cuenta[]>([]);
  const [loading,     setLoading]     = useState(true);
  const [tab,         setTab]         = useState<"resumen" | "pendientes" | "historial" | "cuentas">("resumen");
  const [validating,  setValidating]  = useState<Set<string>>(new Set());
  const [toast,       setToast]       = useState<{ msg: string; type: "ok" | "err" } | null>(null);

  // Pago form
  const [newPagoOpen,      setNewPagoOpen]      = useState(false);
  const [pagoConcepto,     setPagoConcepto]     = useState<Concepto>("membresia");
  const [pagoDescripcion,  setPagoDescripcion]  = useState("");
  const [pagoMethod,       setPagoMethod]       = useState<Method>("transferencia");
  const [pagoMonto,        setPagoMonto]        = useState("");
  const [pagoNotes,        setPagoNotes]        = useState("");
  const [comproFile,       setComproFile]       = useState<File | null>(null);
  const [uploading,        setUploading]        = useState(false);

  // Alumno combobox
  const [alumnos,        setAlumnos]        = useState<AlumnoOption[]>([]);
  const [alumnoSearch,   setAlumnoSearch]   = useState("");
  const [selectedAlumno, setSelectedAlumno] = useState<AlumnoOption | null>(null);
  const [showAlumnoList, setShowAlumnoList] = useState(false);

  const fileRef    = useRef<HTMLInputElement>(null);
  const alumnoRef  = useRef<HTMLDivElement>(null);

  const showToast = (msg: string, type: "ok" | "err") => {
    setToast({ msg, type });
    setTimeout(() => setToast(null), 3000);
  };

  // ── Renovar membresía del alumno al confirmar pago ────────────────────────
  const renewMembership = async (alumnoId: string) => {
    const { data: alumno } = await supabase
      .from("alumnos")
      .select("plan_id, next_expiration_date, planes(periodo)")
      .eq("id", alumnoId)
      .maybeSingle();

    if (!alumno) return;

    const PERIOD_MONTHS: Record<string, number> = {
      mes: 1, mensual: 1, trimestral: 3, anual: 12, año: 12,
    };
    const PERIOD_DAYS: Record<string, number> = { semanal: 7, semana: 7 };

    const periodo = getPlanPeriodo(alumno.planes) ?? "mensual";

    // Extender desde el vencimiento actual si no venció; si no, desde hoy
    const base = alumno.next_expiration_date && new Date(alumno.next_expiration_date) > new Date()
      ? new Date(alumno.next_expiration_date)
      : new Date();

    let newExpiry: string;
    if (PERIOD_MONTHS[periodo]) {
      newExpiry = addMonths(base, PERIOD_MONTHS[periodo]).toISOString().slice(0, 10);
    } else {
      base.setDate(base.getDate() + (PERIOD_DAYS[periodo] ?? 30));
      newExpiry = base.toISOString().slice(0, 10);
    }

    await supabase.from("alumnos").update({
      status: "activo",
      next_expiration_date: newExpiry,
    }).eq("id", alumnoId);
  };

  // Marca la membresía pendiente del alumno como pagada
  const updateMembresiaPagada = async (alumnoId: string) => {
    const { data: mem } = await supabase
      .from("membresias")
      .select("id")
      .eq("alumno_id", alumnoId)
      .eq("estado", "pendiente")
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    if (mem) {
      await supabase.from("membresias").update({ estado: "pagado" }).eq("id", mem.id);
    }
  };

  const fetchAll = useCallback(async (background = false) => {
    const profile = await getCachedProfile();
    if (!profile) { setLoading(false); return; }
    setUserId(profile.userId);
    setRole(profile.role);
    setGymId(profile.gymId);

    if (!background) {
      const cached = getPageCache<{ pagos: Pago[]; cuentas: Cuenta[]; alumnos: AlumnoOption[] }>(`pagos_${profile.gymId}`);
      if (cached) { setPagos(cached.pagos); setCuentas(cached.cuentas); setAlumnos(cached.alumnos); setLoading(false); }
      else setLoading(true);
    }

    const [{ data: pagosData }, { data: cuentasData }, { data: alumnosData }] = await Promise.all([
      supabase
        .from("pagos")
        .select("id, amount, date, method, status, concepto, descripcion, comprobante_url, notes, alumno_id, alumnos(full_name, phone)")
        .eq("gym_id", profile.gymId)
        .order("created_at", { ascending: false })
        .limit(100),
      supabase
        .from("gym_cuentas")
        .select("id, tipo, valor, titular, banco, activa")
        .eq("gym_id", profile.gymId)
        .eq("activa", true)
        .order("created_at"),
      supabase
        .from("alumnos")
        .select("id, full_name")
        .eq("gym_id", profile.gymId)
        .order("full_name"),
    ]);

    const pagos    = (pagosData ?? []).map((row) => mapPagoRow(row));
    const cuentas  = (cuentasData ?? []) as Cuenta[];
    const alumnos  = (alumnosData ?? []) as AlumnoOption[];
    setPagos(pagos);
    setCuentas(cuentas);
    setAlumnos(alumnos);
    setPageCache(`pagos_${profile.gymId}`, { pagos, cuentas, alumnos });
    setLoading(false);
  }, []);

  useEffect(() => { fetchAll(); }, [fetchAll]);

  useEffect(() => {
    const check = () => setIsMobile(window.innerWidth < 768);
    check();
    window.addEventListener("resize", check);
    return () => window.removeEventListener("resize", check);
  }, []);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (alumnoRef.current && !alumnoRef.current.contains(e.target as Node)) {
        setShowAlumnoList(false);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  // Derived
  const validados  = pagos.filter(p => p.status === "validado");
  const pendientes = pagos.filter(p => p.status === "pendiente");
  const totalMes   = validados.reduce((s, p) => s + p.amount, 0);
  const byMethod   = (m: Method) => validados.filter(p => p.method === m).reduce((s, p) => s + p.amount, 0);
  const cashTotal   = byMethod("efectivo");
  const transTotal  = byMethod("transferencia");
  const mpTotal     = byMethod("mercadopago");
  const debitTotal  = byMethod("debito");
  const maxMethod   = Math.max(cashTotal, transTotal, mpTotal, debitTotal, 1);

  const validarPago = async (pagoId: string) => {
    setValidating(prev => new Set(prev).add(pagoId));
    try {
      const { error } = await supabase
        .from("pagos").update({ status: "validado", validated_by: userId }).eq("id", pagoId);
      if (error) { showToast(`Error: ${error.message}`, "err"); return; }
      // Renovar membresía del alumno
      const pago = pagos.find(p => p.id === pagoId);
      if (pago) {
        await renewMembership(pago.alumno_id);
        fetch("/api/alumno/send-welcome", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ alumno_id: pago.alumno_id, type: "renewal" }),
        }).catch(() => {});
      }
      setPagos(prev => prev.map(p => p.id === pagoId ? { ...p, status: "validado" as PagoStatus } : p));
      showToast("Transferencia validada ✓", "ok");
    } finally {
      setValidating(prev => { const s = new Set(prev); s.delete(pagoId); return s; });
    }
  };

  const rechazarPago = async (pagoId: string) => {
    setValidating(prev => new Set(prev).add(pagoId));
    try {
      const { error } = await supabase.from("pagos").update({ status: "rechazado" }).eq("id", pagoId);
      if (error) { showToast(`Error: ${error.message}`, "err"); return; }
      setPagos(prev => prev.map(p => p.id === pagoId ? { ...p, status: "rechazado" as PagoStatus } : p));
      showToast("Pago rechazado.", "err");
    } finally {
      setValidating(prev => { const s = new Set(prev); s.delete(pagoId); return s; });
    }
  };

  const closePagoModal = () => {
    setNewPagoOpen(false);
    setPagoConcepto("membresia"); setPagoDescripcion("");
    setPagoMonto(""); setPagoNotes(""); setComproFile(null);
    setSelectedAlumno(null); setAlumnoSearch(""); setShowAlumnoList(false);
  };

  const submitPago = async () => {
    const monto = parseFloat(pagoMonto);
    if (!monto || monto <= 0) { showToast("Ingresá un monto válido.", "err"); return; }

    let alumnoId: string;
    if (role === "student") {
      const { data: alumnoData } = await supabase
        .from("alumnos").select("id").eq("user_id", userId!).maybeSingle();
      if (!alumnoData) { showToast("No se encontró tu registro de alumno.", "err"); return; }
      alumnoId = alumnoData.id;
    } else {
      if (!selectedAlumno) { showToast("Seleccioná un alumno.", "err"); return; }
      alumnoId = selectedAlumno.id;
    }

    setUploading(true);
    try {
      let comprUrl: string | null = null;
      if (comproFile) {
        const ext  = comproFile.name.split(".").pop();
        const path = `${gymId}/${Date.now()}.${ext}`;
        const { error: upErr } = await supabase.storage.from("comprobantes").upload(path, comproFile);
        if (upErr) { showToast(`Error al subir imagen: ${upErr.message}`, "err"); return; }
        const { data: urlData } = supabase.storage.from("comprobantes").getPublicUrl(path);
        comprUrl = urlData.publicUrl;
      }

      const needsValidation = pagoMethod === "transferencia";
      const { error } = await supabase.from("pagos").insert([{
        gym_id:          gymId,
        alumno_id:       alumnoId,
        amount:          monto,
        method:          pagoMethod,
        status:          needsValidation ? "pendiente" : "validado",
        concepto:        pagoConcepto,
        descripcion:     pagoDescripcion.trim() || null,
        comprobante_url: comprUrl,
        notes:           pagoNotes.trim() || null,
        date:            new Date().toISOString().slice(0, 10),
      }]);
      if (error) { showToast(`Error: ${error.message}`, "err"); return; }

      // Notificación: pago registrado
      const alumnoLabel = selectedAlumno?.full_name ?? `Alumno`;
      fetch("/api/notifications", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          gym_id: gymId,
          type: "new_payment",
          title: `Pago registrado: ${alumnoLabel}`,
          body: `$${monto.toLocaleString("es-AR")} · ${pagoMethod}${needsValidation ? " (pendiente)" : ""}`,
        }),
      }).catch(() => {});

      // Renovar membresía solo si el concepto es membresía
      if (pagoConcepto === "membresia") {
        await updateMembresiaPagada(alumnoId);
        if (!needsValidation) await renewMembership(alumnoId);
      }
      showToast(needsValidation ? "Comprobante enviado. Esperá la validación ✓" : "Pago registrado ✓", "ok");
      closePagoModal();
      fetchAll();
    } finally { setUploading(false); }
  };

  const isAdmin = role === "admin";
  const isStaff = role === "staff";

  const inputStyle: React.CSSProperties = {
    width: "100%",
    padding: "10px 14px",
    border: "1px solid rgba(0,0,0,0.10)",
    borderRadius: 10,
    font: `400 0.875rem/1 ${fb}`,
    color: t1,
    outline: "none",
    boxSizing: "border-box",
    background: "#FFFFFF",
  };

  return (
    <>
      <style>{`
        @keyframes fadeUp { from { opacity:0; transform:translateY(10px); } to { opacity:1; transform:translateY(0); } }
        .pago-row:hover { background: #FAFBFD !important; }
      `}</style>

      <div style={{ display: "flex", flexDirection: "column", gap: 18 }}>

        {/* Header */}
        <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", flexWrap: "wrap", gap: 12 }}>
          <div>
            {!isMobile && <p style={{ font: `500 0.72rem/1 ${fb}`, color: t3, textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: 6 }}>Finanzas</p>}
            <h1 style={{ font: `800 ${isMobile ? "1.5rem" : "2rem"}/1 ${fd}`, color: t1, letterSpacing: "-0.02em" }}>Pagos</h1>
            {!isMobile && <p style={{ font: `400 0.875rem/1.4 ${fb}`, color: t2, marginTop: 4 }}>
              {isAdmin ? "Gestión completa de ingresos y cuentas del gimnasio." : isStaff ? "Validá transferencias y registrá pagos." : "Registrá tu pago y seguí el estado."}
            </p>}
          </div>
          {(isAdmin || isStaff) && (
            <button
              onClick={() => setNewPagoOpen(true)}
              style={{ display: "flex", alignItems: "center", gap: 6, background: ORANGE, color: "white", border: "none", padding: "10px 20px", borderRadius: 12, font: `700 0.875rem/1 ${fd}`, cursor: "pointer", boxShadow: "0 4px 14px rgba(249,115,22,0.25)" }}
              onMouseEnter={e => (e.currentTarget.style.opacity = "0.9")}
              onMouseLeave={e => (e.currentTarget.style.opacity = "1")}
            >
              <Plus size={15} /> Registrar Pago
            </button>
          )}
          {role === "student" && (
            <button
              onClick={() => setNewPagoOpen(true)}
              style={{ display: "flex", alignItems: "center", gap: 6, background: ORANGE, color: "white", border: "none", padding: "10px 20px", borderRadius: 12, font: `700 0.875rem/1 ${fd}`, cursor: "pointer", boxShadow: "0 4px 14px rgba(249,115,22,0.25)" }}
              onMouseEnter={e => (e.currentTarget.style.opacity = "0.9")}
              onMouseLeave={e => (e.currentTarget.style.opacity = "1")}
            >
              <Upload size={15} /> Subir Comprobante
            </button>
          )}
        </div>

        {/* KPI row */}
        <div style={{ display: "grid", gridTemplateColumns: isMobile ? "1fr 1fr" : "repeat(3, 1fr)", gap: isMobile ? 10 : 14 }}>
          {[
            { label: "Ingresos del Mes",           value: loading ? "—" : fmtARS(totalMes),           icon: <TrendingUp size={16} color="white" />, sub: `${validados.length} pagos validados` },
            { label: "Transferencias Pendientes",  value: loading ? "—" : String(pendientes.length),  icon: <Clock size={16} color="white" />,      sub: pendientes.length > 0 ? "Requieren validación" : "Todo al día ✓", warn: pendientes.length > 0 },
            { label: "Cuentas Activas",            value: loading ? "—" : String(cuentas.length),     icon: <CreditCard size={16} color="white" />, sub: "CBU / Alias / MP" },
          ].map(s => (
            <div key={s.label} style={{ ...card, padding: "16px 18px", border: `1px solid ${s.warn ? "rgba(217,119,6,0.25)" : "rgba(0,0,0,0.05)"}` }}>
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 10 }}>
                <span style={{ font: `500 0.72rem/1 ${fb}`, color: t3, textTransform: "uppercase", letterSpacing: "0.06em" }}>{s.label}</span>
                <div style={{ width: 30, height: 30, borderRadius: 8, background: "#151515", display: "flex", alignItems: "center", justifyContent: "center" }}>{s.icon}</div>
              </div>
              <p style={{ font: `800 1.8rem/1 ${fd}`, color: s.warn ? "#D97706" : t1, marginBottom: 4 }}>{s.value}</p>
              <p style={{ font: `400 0.72rem/1 ${fb}`, color: s.warn ? "#D97706" : t3 }}>{s.sub}</p>
            </div>
          ))}
        </div>

        {/* Tabs */}
        <div style={{ display: "flex", gap: 2, borderBottom: "1px solid rgba(0,0,0,0.07)", paddingBottom: 0, overflowX: isMobile ? "auto" : undefined }}>
          {([
            { key: "resumen",    label: "Resumen" },
            { key: "pendientes", label: `Pendientes${pendientes.length > 0 ? ` (${pendientes.length})` : ""}` },
            { key: "historial",  label: "Historial" },
            ...(isAdmin ? [{ key: "cuentas", label: "Cuentas" }] : []),
          ] as { key: string; label: string }[]).map(t => (
            <button
              key={t.key}
              onClick={() => setTab(t.key as typeof tab)}
              style={{
                padding: "10px 18px",
                background: "none",
                border: "none",
                borderBottom: tab === t.key ? `2px solid ${ORANGE}` : "2px solid transparent",
                font: `${tab === t.key ? 700 : 500} 0.85rem/1 ${fb}`,
                color: tab === t.key ? ORANGE : t2,
                cursor: "pointer",
                transition: "all 0.14s",
                marginBottom: -1,
              }}
            >
              {t.label}
            </button>
          ))}
        </div>

        {/* ── TAB: RESUMEN ── */}
        {tab === "resumen" && (
          <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
            <div style={{ display: "grid", gridTemplateColumns: isMobile ? "1fr 1fr" : "repeat(4, 1fr)", gap: isMobile ? 10 : 14 }}>
              {(["efectivo", "transferencia", "mercadopago", "debito"] as Method[]).map(m => {
                const meta  = METHOD_META[m];
                const total = byMethod(m);
                const pct   = Math.round((total / maxMethod) * 100);
                const count = validados.filter(p => p.method === m).length;
                return (
                  <div key={m} style={{ ...card, padding: "18px 20px" }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 14 }}>
                      <div style={{ width: 34, height: 34, borderRadius: 9, background: meta.bg, display: "flex", alignItems: "center", justifyContent: "center", color: meta.color }}>
                        {meta.icon}
                      </div>
                      <span style={{ font: `600 0.82rem/1 ${fd}`, color: t1 }}>{meta.label}</span>
                    </div>
                    <p style={{ font: `800 1.6rem/1 ${fd}`, color: t1, marginBottom: 3 }}>{fmtARS(total)}</p>
                    <p style={{ font: `400 0.72rem/1 ${fb}`, color: t3 }}>{count} pago{count !== 1 ? "s" : ""} validado{count !== 1 ? "s" : ""}</p>
                    <ProgressBar pct={pct} color={meta.color} />
                  </div>
                );
              })}
            </div>

            {/* Últimos pagos */}
            <div style={{ ...card, padding: 0, overflow: "hidden" }}>
              <div style={{ padding: "16px 20px", borderBottom: "1px solid rgba(0,0,0,0.06)" }}>
                <span style={{ font: `700 0.95rem/1 ${fd}`, color: t1 }}>Últimos pagos registrados</span>
              </div>
              {loading ? (
                <p style={{ padding: "32px 20px", font: `400 0.8rem/1 ${fb}`, color: t3, textAlign: "center" }}>Cargando...</p>
              ) : pagos.slice(0, 5).length === 0 ? (
                <p style={{ padding: "40px 20px", font: `400 0.8rem/1 ${fb}`, color: t3, textAlign: "center" }}>No hay pagos registrados aún.</p>
              ) : pagos.slice(0, 5).map((p, i) => (
                <div key={p.id} className="pago-row" style={{ display: "flex", alignItems: "center", gap: 12, padding: "12px 20px", borderBottom: i < 4 ? "1px solid rgba(0,0,0,0.04)" : "none", transition: "background 0.12s" }}>
                  <div style={{ width: 32, height: 32, borderRadius: 9, background: "#F4F5F9", display: "flex", alignItems: "center", justifyContent: "center", font: `700 0.65rem/1 ${fd}`, color: ORANGE, flexShrink: 0 }}>
                    {initials(p.alumnos?.full_name ?? "?")}
                  </div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <p style={{ font: `600 0.82rem/1 ${fd}`, color: t1, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{p.alumnos?.full_name ?? "—"}</p>
                    <p style={{ font: `400 0.7rem/1 ${fb}`, color: t3, marginTop: 2 }}>{p.date}</p>
                  </div>
                  <Chip meta={CONCEPTO_META[p.concepto ?? "membresia"]} />
                  <Chip meta={METHOD_META[p.method ?? "efectivo"]} />
                  <Chip meta={STATUS_META[p.status ?? "validado"]} />
                  <span style={{ font: `700 0.88rem/1 ${fd}`, color: t1, minWidth: 80, textAlign: "right" }}>{fmtARS(p.amount)}</span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* ── TAB: PENDIENTES ── */}
        {tab === "pendientes" && (
          <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
            {pendientes.length === 0 ? (
              <div style={{ ...card, padding: "48px 28px", textAlign: "center" }}>
                <CheckCircle size={40} color={GREEN} style={{ margin: "0 auto 14px" }} />
                <p style={{ font: `700 1rem/1 ${fd}`, color: t1 }}>Sin pendientes</p>
                <p style={{ font: `400 0.8rem/1.5 ${fb}`, color: t2, marginTop: 6 }}>Todas las transferencias están validadas.</p>
              </div>
            ) : pendientes.map((p, idx) => {
              const isValidating = validating.has(p.id);
              return (
                <div key={p.id} style={{ ...card, padding: "18px 20px", border: "1px solid rgba(217,119,6,0.20)", animation: `fadeUp 0.22s ease ${idx * 50}ms both` }}>
                  <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 14, flexWrap: "wrap" }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                      <div style={{ width: 40, height: 40, borderRadius: 11, background: "rgba(217,119,6,0.08)", display: "flex", alignItems: "center", justifyContent: "center", font: `700 0.72rem/1 ${fd}`, color: "#D97706", flexShrink: 0 }}>
                        {initials(p.alumnos?.full_name ?? "?")}
                      </div>
                      <div>
                        <p style={{ font: `700 0.95rem/1 ${fd}`, color: t1 }}>{p.alumnos?.full_name ?? "Alumno"}</p>
                        <p style={{ font: `400 0.72rem/1 ${fb}`, color: t3, marginTop: 3 }}>{p.date} · {METHOD_META[p.method].label}</p>
                        {p.descripcion && <p style={{ font: `500 0.72rem/1 ${fb}`, color: t1, marginTop: 3 }}>{p.descripcion}</p>}
                        {p.notes && <p style={{ font: `400 0.72rem/1 ${fb}`, color: t2, marginTop: 3, fontStyle: "italic" }}>{p.notes}</p>}
                      </div>
                    </div>
                    <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
                      <span style={{ font: `800 1.3rem/1 ${fd}`, color: "#D97706" }}>{fmtARS(p.amount)}</span>
                      {p.comprobante_url && (
                        <a href={p.comprobante_url} target="_blank" rel="noreferrer"
                          style={{ display: "flex", alignItems: "center", gap: 5, padding: "7px 12px", background: "rgba(75,107,251,0.07)", border: "1px solid rgba(75,107,251,0.20)", borderRadius: 9, font: `600 0.72rem/1 ${fb}`, color: BLUE, textDecoration: "none" }}>
                          <Upload size={11} /> Ver comprobante
                        </a>
                      )}
                      {(isAdmin || isStaff) && (
                        <>
                          <button
                            onClick={() => validarPago(p.id)}
                            disabled={isValidating}
                            style={{ display: "flex", alignItems: "center", gap: 5, padding: "8px 16px", background: "rgba(255,106,0,0.08)", border: "1px solid rgba(255,106,0,0.25)", borderRadius: 9, font: `700 0.78rem/1 ${fb}`, color: "#FF6A00", cursor: isValidating ? "wait" : "pointer" }}>
                            <CheckCircle size={13} /> {isValidating ? "Validando..." : "Validar"}
                          </button>
                          <button
                            onClick={() => rechazarPago(p.id)}
                            disabled={isValidating}
                            style={{ display: "flex", alignItems: "center", gap: 5, padding: "8px 12px", background: "rgba(220,38,38,0.06)", border: "1px solid rgba(220,38,38,0.20)", borderRadius: 9, font: `700 0.78rem/1 ${fb}`, color: "#DC2626", cursor: isValidating ? "wait" : "pointer" }}>
                            <XCircle size={13} /> Rechazar
                          </button>
                        </>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {/* ── TAB: HISTORIAL ── */}
        {tab === "historial" && !isMobile && (
          <div style={{ ...card, padding: 0, overflow: "hidden" }}>
            <div style={{ display: "grid", gridTemplateColumns: "2fr 1fr 1fr 1fr 1fr", gap: 12, padding: "12px 20px", borderBottom: "1px solid rgba(0,0,0,0.06)" }}>
              {["Alumno", "Fecha", "Método", "Estado", "Monto"].map(h => (
                <span key={h} style={{ font: `600 0.68rem/1 ${fb}`, color: t3, textTransform: "uppercase", letterSpacing: "0.07em" }}>{h}</span>
              ))}
            </div>
            {loading ? (
              <p style={{ padding: "40px 20px", font: `400 0.8rem/1 ${fb}`, color: t3, textAlign: "center" }}>Cargando...</p>
            ) : pagos.length === 0 ? (
              <p style={{ padding: "48px 20px", font: `400 0.8rem/1 ${fb}`, color: t3, textAlign: "center" }}>No hay pagos registrados.</p>
            ) : pagos.map((p, idx) => (
              <div key={p.id} className="pago-row" style={{ display: "grid", gridTemplateColumns: "2fr 1fr 1fr 1fr 1fr", gap: 12, padding: "11px 20px", borderBottom: idx < pagos.length - 1 ? "1px solid rgba(0,0,0,0.04)" : "none", transition: "background 0.12s", alignItems: "center" }}>
                <div style={{ display: "flex", alignItems: "center", gap: 9 }}>
                  <div style={{ width: 28, height: 28, borderRadius: 7, background: "#F4F5F9", display: "flex", alignItems: "center", justifyContent: "center", font: `700 0.6rem/1 ${fd}`, color: ORANGE, flexShrink: 0 }}>
                    {initials(p.alumnos?.full_name ?? "?")}
                  </div>
                  <span style={{ font: `500 0.8rem/1 ${fd}`, color: t1, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{p.alumnos?.full_name ?? "—"}</span>
                </div>
                <span style={{ font: `400 0.78rem/1 ${fb}`, color: t2 }}>{p.date}</span>
                <Chip meta={CONCEPTO_META[p.concepto ?? "membresia"]} />
                <Chip meta={METHOD_META[p.method ?? "efectivo"]} />
                <Chip meta={STATUS_META[p.status ?? "validado"]} />
                <span style={{ font: `700 0.88rem/1 ${fd}`, color: t1, textAlign: "right" }}>{fmtARS(p.amount)}</span>
              </div>
            ))}
          </div>
        )}

        {tab === "historial" && isMobile && (
          <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            {loading ? (
              <p style={{ padding: "40px 20px", font: `400 0.8rem/1 ${fb}`, color: t3, textAlign: "center" }}>Cargando...</p>
            ) : pagos.length === 0 ? (
              <p style={{ padding: "48px 20px", font: `400 0.8rem/1 ${fb}`, color: t3, textAlign: "center" }}>No hay pagos registrados.</p>
            ) : pagos.map((p, idx) => (
              <div key={p.id} style={{ ...card, padding: "14px 16px", animation: `fadeUp 0.2s ease ${idx * 30}ms both` }}>
                <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 10 }}>
                  <div style={{ width: 36, height: 36, borderRadius: 10, background: "#F4F5F9", display: "flex", alignItems: "center", justifyContent: "center", font: `700 0.65rem/1 ${fd}`, color: ORANGE, flexShrink: 0 }}>
                    {initials(p.alumnos?.full_name ?? "?")}
                  </div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <p style={{ font: `600 0.85rem/1 ${fd}`, color: t1, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{p.alumnos?.full_name ?? "—"}</p>
                    <p style={{ font: `400 0.7rem/1 ${fb}`, color: t3, marginTop: 2 }}>{p.date}</p>
                  </div>
                  <span style={{ font: `700 0.9rem/1 ${fd}`, color: t1 }}>{fmtARS(p.amount)}</span>
                </div>
                <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                  <Chip meta={CONCEPTO_META[p.concepto ?? "membresia"]} />
                  <Chip meta={METHOD_META[p.method ?? "efectivo"]} />
                  <Chip meta={STATUS_META[p.status ?? "validado"]} />
                </div>
              </div>
            ))}
          </div>
        )}

        {/* ── TAB: CUENTAS ── */}
        {tab === "cuentas" && isAdmin && (
          <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
            {cuentas.length === 0 ? (
              /* ── Estado vacío ── */
              <div style={{ ...card, padding: "52px 28px", display: "flex", flexDirection: "column", alignItems: "center", gap: 16, textAlign: "center" as const }}>
                <div style={{ width: 52, height: 52, borderRadius: 14, background: "rgba(249,115,22,0.07)", display: "flex", alignItems: "center", justifyContent: "center" }}>
                  <CreditCard size={24} color={ORANGE} />
                </div>
                <div>
                  <p style={{ font: `700 1rem/1 ${fd}`, color: t1, marginBottom: 8 }}>Sin métodos de cobro</p>
                  <p style={{ font: `400 0.82rem/1.5 ${fb}`, color: t2, maxWidth: 320 }}>
                    Configurá tus métodos de cobro para que tus alumnos sepan dónde pagar.
                  </p>
                </div>
                <a
                  href="/dashboard/ajustes"
                  style={{ display: "inline-flex", alignItems: "center", gap: 7, padding: "11px 22px", borderRadius: 12, background: ORANGE, color: "white", font: `700 0.875rem/1 ${fd}`, textDecoration: "none", boxShadow: "0 4px 14px rgba(249,115,22,0.28)", transition: "opacity 0.14s" }}
                  onMouseEnter={e => (e.currentTarget.style.opacity = "0.88")}
                  onMouseLeave={e => (e.currentTarget.style.opacity = "1")}
                >
                  <Settings size={14} /> Ir a Ajustes
                </a>
              </div>
            ) : (
              /* ── Estado activo: tarjetas read-only ── */
              <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                {cuentas.map((c, idx) => (
                  <div key={c.id} style={{ ...card, padding: "18px 20px", animation: `fadeUp 0.22s ease ${idx * 50}ms both` }}>
                    <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 14 }}>
                      <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                        <div style={{ width: 38, height: 38, borderRadius: 10, background: "rgba(249,115,22,0.07)", display: "flex", alignItems: "center", justifyContent: "center", color: ORANGE, flexShrink: 0 }}>
                          {c.tipo === "mercadopago" ? <Smartphone size={17} /> : <Building2 size={17} />}
                        </div>
                        <div>
                          <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 3 }}>
                            <span style={{ font: `700 0.9rem/1 ${fd}`, color: t1 }}>{c.valor}</span>
                            <span style={{ font: `600 0.62rem/1 ${fb}`, color: ORANGE, background: "rgba(249,115,22,0.08)", padding: "2px 8px", borderRadius: 9999, textTransform: "uppercase" as const }}>
                              {c.tipo === "alias" ? "Alias" : c.tipo === "cbu" ? "CBU" : "Mercado Pago"}
                            </span>
                          </div>
                          <p style={{ font: `400 0.72rem/1 ${fb}`, color: t3 }}>
                            {[c.titular, c.banco].filter(Boolean).join(" · ") || "Sin titular registrado"}
                          </p>
                        </div>
                      </div>
                      <a
                        href="/dashboard/ajustes"
                        style={{ flexShrink: 0, display: "flex", alignItems: "center", gap: 5, padding: "6px 12px", borderRadius: 8, border: "1px solid rgba(0,0,0,0.10)", background: "white", color: t2, font: `600 0.72rem/1 ${fb}`, textDecoration: "none", transition: "all 0.12s" }}
                        onMouseEnter={e => { e.currentTarget.style.background = "#F4F5F9"; e.currentTarget.style.color = t1; }}
                        onMouseLeave={e => { e.currentTarget.style.background = "white"; e.currentTarget.style.color = t2; }}
                      >
                        <Settings size={11} /> Editar en Ajustes
                      </a>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

      </div>

      {/* ── MODAL: Registrar pago ── */}
      {newPagoOpen && (
        <div
          onClick={closePagoModal}
          style={{ position: "fixed", inset: 0, zIndex: 100, background: "rgba(0,0,0,0.40)", backdropFilter: "blur(6px)", WebkitBackdropFilter: "blur(6px)", display: "flex", alignItems: isMobile ? "flex-end" : "center", justifyContent: "center", padding: isMobile ? 0 : 20, paddingBottom: isMobile ? "calc(64px + env(safe-area-inset-bottom, 0px))" : undefined }}
        >
          <div
            onClick={e => e.stopPropagation()}
            style={{ background: "#FFFFFF", borderRadius: isMobile ? "20px 20px 0 0" : 20, boxShadow: "0 24px 60px rgba(0,0,0,0.18), 0 0 0 1px rgba(0,0,0,0.06)", width: "100%", maxWidth: isMobile ? "100%" : 460, maxHeight: isMobile ? "calc(90vh - 64px)" : undefined, overflowY: "auto" }}
          >
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "22px 24px 0" }}>
              <div>
                <h2 style={{ font: `800 1.2rem/1 ${fd}`, color: t1 }}>
                  {role === "student" ? "Subir comprobante" : "Registrar pago"}
                </h2>
                <p style={{ font: `400 0.8rem/1.4 ${fb}`, color: t3, marginTop: 4 }}>
                  {role === "student" ? "Adjuntá tu comprobante de transferencia." : "Registrá un pago manual del alumno."}
                </p>
              </div>
              <button onClick={closePagoModal} style={{ background: "#F0F2F8", border: "none", borderRadius: "50%", width: 32, height: 32, display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer", color: t2 }}>
                <X size={16} />
              </button>
            </div>

            <div style={{ padding: "20px 24px 24px", display: "flex", flexDirection: "column", gap: 14 }}>

              {/* Concepto */}
              <div>
                <label style={{ display: "block", font: `600 0.78rem/1 ${fb}`, color: t2, marginBottom: 8 }}>Concepto</label>
                <div style={{ display: "flex", gap: 6 }}>
                  {(["membresia", "clase", "producto"] as Concepto[]).map(c => (
                    <button key={c} onClick={() => { setPagoConcepto(c); setPagoDescripcion(""); }}
                      style={{ flex: 1, padding: "8px 4px", borderRadius: 10, border: `1.5px solid ${pagoConcepto === c ? CONCEPTO_META[c].color : "rgba(0,0,0,0.09)"}`, background: pagoConcepto === c ? CONCEPTO_META[c].bg : "transparent", color: pagoConcepto === c ? CONCEPTO_META[c].color : t3, font: `600 0.72rem/1 ${fb}`, cursor: "pointer", transition: "all 0.15s" }}>
                      {CONCEPTO_META[c].label}
                    </button>
                  ))}
                </div>
              </div>

              {/* Descripción — para clase o producto */}
              {pagoConcepto !== "membresia" && (
                <div>
                  <label style={{ display: "block", font: `600 0.78rem/1 ${fb}`, color: t2, marginBottom: 6 }}>
                    {pagoConcepto === "clase" ? "Nombre de la clase / evento *" : "Nombre del producto *"}
                  </label>
                  <input type="text" value={pagoDescripcion} onChange={e => setPagoDescripcion(e.target.value)}
                    placeholder={pagoConcepto === "clase" ? "Ej: Clase de spinning especial" : "Ej: Proteína Whey 1kg"}
                    style={{ ...inputStyle }} />
                </div>
              )}

              {/* Combobox alumno — solo admin/staff */}
              {role !== "student" && (
                <div ref={alumnoRef} style={{ position: "relative" }}>
                  <label style={{ display: "block", font: `600 0.78rem/1 ${fb}`, color: t2, marginBottom: 6 }}>Alumno *</label>
                  <input
                    type="text"
                    value={selectedAlumno ? selectedAlumno.full_name : alumnoSearch}
                    onChange={e => {
                      setAlumnoSearch(e.target.value);
                      setSelectedAlumno(null);
                      setShowAlumnoList(true);
                    }}
                    onFocus={() => setShowAlumnoList(true)}
                    placeholder="Buscar alumno..."
                    style={{ ...inputStyle, paddingRight: selectedAlumno ? 36 : 14 }}
                  />
                  {selectedAlumno && (
                    <button
                      onClick={() => { setSelectedAlumno(null); setAlumnoSearch(""); setShowAlumnoList(false); }}
                      style={{ position: "absolute", right: 10, top: "calc(50% + 10px)", transform: "translateY(-50%)", background: "none", border: "none", cursor: "pointer", color: t3, display: "flex", alignItems: "center" }}
                    >
                      <X size={14} />
                    </button>
                  )}
                  {showAlumnoList && !selectedAlumno && (
                    <div style={{ position: "absolute", top: "calc(100% + 4px)", left: 0, right: 0, background: "white", border: "1px solid rgba(0,0,0,0.10)", borderRadius: 12, boxShadow: "0 8px 24px rgba(0,0,0,0.10)", zIndex: 10, maxHeight: 200, overflowY: "auto" as const }}>
                      {alumnos
                        .filter(a => a.full_name.toLowerCase().includes(alumnoSearch.toLowerCase()))
                        .slice(0, 12)
                        .map(a => (
                          <button
                            key={a.id}
                            onMouseDown={() => { setSelectedAlumno(a); setAlumnoSearch(""); setShowAlumnoList(false); }}
                            style={{ width: "100%", display: "flex", alignItems: "center", gap: 10, padding: "10px 14px", background: "none", border: "none", cursor: "pointer", textAlign: "left" as const, transition: "background 0.1s" }}
                            onMouseEnter={e => (e.currentTarget.style.background = "#F9FAFB")}
                            onMouseLeave={e => (e.currentTarget.style.background = "none")}
                          >
                            <div style={{ width: 28, height: 28, borderRadius: 7, background: "#F4F5F9", display: "flex", alignItems: "center", justifyContent: "center", font: `700 0.58rem/1 ${fd}`, color: ORANGE, flexShrink: 0 }}>
                              {initials(a.full_name)}
                            </div>
                            <span style={{ font: `500 0.85rem/1 ${fd}`, color: t1 }}>{a.full_name}</span>
                          </button>
                        ))
                      }
                      {alumnos.filter(a => a.full_name.toLowerCase().includes(alumnoSearch.toLowerCase())).length === 0 && (
                        <p style={{ padding: "14px", font: `400 0.8rem/1 ${fb}`, color: t3, textAlign: "center" as const }}>Sin resultados</p>
                      )}
                    </div>
                  )}
                </div>
              )}

              {/* Método */}
              <div>
                <label style={{ display: "block", font: `600 0.78rem/1 ${fb}`, color: t2, marginBottom: 8 }}>Método de pago</label>
                <select
                  value={pagoMethod}
                  onChange={e => setPagoMethod(e.target.value as Method)}
                  style={{ ...inputStyle, appearance: "none", WebkitAppearance: "none", backgroundImage: "url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='12' viewBox='0 0 24 24' fill='none' stroke='%239CA3AF' stroke-width='2'%3E%3Cpath d='M6 9l6 6 6-6'/%3E%3C/svg%3E\")", backgroundRepeat: "no-repeat", backgroundPosition: "right 12px center", paddingRight: 36, cursor: "pointer", color: METHOD_META[pagoMethod].color, fontWeight: 600 }}
                >
                  {(["efectivo", "transferencia", "mercadopago", "debito"] as Method[]).map(m => (
                    <option key={m} value={m}>{METHOD_META[m].label}</option>
                  ))}
                </select>
              </div>

              {/* Monto */}
              <div>
                <label style={{ display: "block", font: `600 0.78rem/1 ${fb}`, color: t2, marginBottom: 6 }}>Monto (ARS) *</label>
                <div style={{ position: "relative" }}>
                  <span style={{ position: "absolute", left: 12, top: "50%", transform: "translateY(-50%)", font: `700 1rem/1 ${fd}`, color: t2 }}>$</span>
                  <input type="number" value={pagoMonto} onChange={e => setPagoMonto(e.target.value)} placeholder="0"
                    style={{ ...inputStyle, paddingLeft: 28, font: `700 1.1rem/1 ${fd}` }} />
                </div>
              </div>

              {/* Comprobante */}
              {pagoMethod === "transferencia" && (
                <div>
                  <label style={{ display: "block", font: `600 0.78rem/1 ${fb}`, color: t2, marginBottom: 6 }}>Comprobante</label>
                  <input ref={fileRef} type="file" accept="image/*,.pdf" style={{ display: "none" }} onChange={e => setComproFile(e.target.files?.[0] ?? null)} />
                  <button onClick={() => fileRef.current?.click()}
                    style={{ width: "100%", padding: "12px", borderRadius: 10, border: `1px dashed ${comproFile ? "rgba(255,106,0,0.40)" : "rgba(0,0,0,0.15)"}`, background: comproFile ? "rgba(255,106,0,0.05)" : "#FAFBFD", color: comproFile ? "#FF6A00" : t3, font: `500 0.82rem/1 ${fb}`, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", gap: 7 }}>
                    <Upload size={14} />
                    {comproFile ? comproFile.name : "Subir imagen o PDF"}
                  </button>
                  <p style={{ font: `400 0.7rem/1 ${fb}`, color: "#9CA3AF", marginTop: 4 }}>
                    JPG, PNG, WebP, GIF o PDF · máx. 10 MB
                  </p>
                  <p style={{ font: `400 0.7rem/1 ${fb}`, color: t3, marginTop: 3 }}>
                    Quedará en estado <strong style={{ color: "#D97706" }}>Pendiente</strong> hasta que el staff valide.
                  </p>
                </div>
              )}

              {/* Notas */}
              <div>
                <label style={{ display: "block", font: `600 0.78rem/1 ${fb}`, color: t2, marginBottom: 6 }}>Notas (opcional)</label>
                <textarea value={pagoNotes} onChange={e => setPagoNotes(e.target.value)}
                  placeholder="Ej: Pago mes de mayo..." rows={2}
                  style={{ ...inputStyle, resize: "none", lineHeight: "1.5" }} />
              </div>

              {/* Cuentas del gym */}
              {pagoMethod === "transferencia" && cuentas.length > 0 && (
                <div style={{ padding: "12px 14px", background: "rgba(75,107,251,0.05)", border: "1px solid rgba(75,107,251,0.15)", borderRadius: 10 }}>
                  <p style={{ font: `600 0.72rem/1 ${fb}`, color: BLUE, marginBottom: 8 }}>Transferí a una de estas cuentas:</p>
                  <div style={{ display: "flex", flexDirection: "column", gap: 5 }}>
                    {cuentas.map(c => (
                      <div key={c.id} style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                        <span style={{ font: `500 0.78rem/1 ${fb}`, color: t1 }}>{c.valor}</span>
                        <span style={{ font: `400 0.68rem/1 ${fb}`, color: t3 }}>{c.titular ?? c.banco ?? ""}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              <button onClick={submitPago} disabled={uploading}
                style={{ padding: "12px", borderRadius: 12, border: "none", background: uploading ? "rgba(249,115,22,0.50)" : ORANGE, color: "white", font: `700 0.9rem/1 ${fd}`, cursor: uploading ? "wait" : "pointer", boxShadow: "0 4px 14px rgba(249,115,22,0.25)" }}>
                {uploading ? "Registrando..." : pagoMethod === "transferencia" ? "Enviar comprobante" : "Confirmar pago"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Toast */}
      {toast && (
        <div style={{ position: "fixed", bottom: isMobile ? 90 : 28, right: 28, zIndex: 99, padding: "12px 20px", borderRadius: 12, background: toast.type === "ok" ? "#FF6A00" : "#DC2626", color: "white", font: `600 0.85rem/1 ${fb}`, boxShadow: "0 8px 28px rgba(0,0,0,0.20)", animation: "fadeUp 0.2s ease both" }}>
          {toast.msg}
        </div>
      )}
    </>
  );
}
