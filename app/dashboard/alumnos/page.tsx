"use client";

import { useState, useEffect, useCallback, useDeferredValue } from "react";
import { createPortal } from "react-dom";
import { Search, Plus, Users, TrendingUp, DollarSign, MoreVertical, X, User, Phone, CalendarDays, Mail, Sparkles, Trash2, CheckCircle, ClipboardCheck, Star, Download, ChevronDown, FileSpreadsheet, History } from "lucide-react";
import { Tooltip } from "@/components/tooltip";
import { supabase } from "@/lib/supabase";
import { getCachedProfile, getPageCache, setPageCache, invalidateDashboardCache } from "@/lib/gym-cache";
import { CsvAlumnosImportContent } from "@/app/dashboard/components/CsvAlumnosImportContent";
import SensitiveConfirm from "@/app/dashboard/components/SensitiveConfirm";
import { EJERCICIOS } from "@/lib/ejercicios";
import { usePagoModal } from "@/hooks/usePagoModal";
import { useRutinaModal } from "@/hooks/useRutinaModal";
import { addMonths } from "@/lib/date-utils";
import { useBrandConfirm } from "@/components/brand-confirm";

const fd = "var(--font-inter, 'Inter', sans-serif)";
const fb = "var(--font-inter, 'Inter', sans-serif)";
const fm = "var(--font-mono, 'JetBrains Mono', monospace)";
const t1 = "#1A1D23";
const t2 = "#6B7280";
const t3 = "#9CA3AF";
const card = { background: "#FFFFFF", border: "1px solid rgba(0,0,0,0.05)", borderRadius: 14, boxShadow: "0 2px 8px rgba(0,0,0,0.06), 0 0 1px rgba(0,0,0,0.04)" };

type Status = "activo" | "vencido" | "pendiente" | "pausado";

interface PlanOption {
  id: string;
  nombre: string;
  precio: number;
  periodo: string;
  duracion_dias: number;
  accent_color: string | null;
}

interface PromoOption {
  id: string;
  nombre: string;
  discount_type: "monto" | "porcentaje";
  discount_value: number;
  note: string | null;
}

interface Alumno {
  id: string;
  dni: string | null;
  full_name: string;
  phone: string | null;
  plan_id: string | null;
  planes: { nombre: string; accent_color: string | null; precio: number; duracion_dias: number } | null;
  status: Status;
  next_expiration_date: string | null;
  frozen_since: string | null;
  pausa_hasta: string | null;
  deuda_pendiente: number;
}


interface ActivityLog {
  id: string;
  type: string;
  description: string;
  actor: string | null;
  metadata: Record<string, unknown> | null;
  created_at: string;
}

interface ProgresoData {
  pesos:    { ejercicio: string; peso: number; fecha: string }[];
  medidas:  { peso_kg: number; grasa_pct: number | null; fecha: string }[];
  sessions: { id: string; fecha: string; rutina_nombre: string | null; completada: boolean }[];
  fotos:    { id: string; foto_url: string; fecha: string }[];
}

const STATUS_STYLE: Record<Status, { color: string; bg: string; label: string }> = {
  activo:    { color: "#16A34A", bg: "rgba(22,163,74,0.08)",   label: "Activo" },
  vencido:   { color: "#DC2626", bg: "rgba(220,38,38,0.08)",   label: "Vencido" },
  pendiente: { color: "#D97706", bg: "rgba(217,119,6,0.08)",   label: "Pendiente" },
  pausado:   { color: "#64748B", bg: "rgba(100,116,139,0.08)", label: "Pausado" },
};

function initials(full_name: string) {
  return full_name.split(" ").slice(0, 2).map(w => w[0]).join("").toUpperCase();
}

function openWhatsApp(phone: string, full_name: string) {
  const clean = phone.replace(/\D/g, "");
  const text  = encodeURIComponent(`Hola ${full_name}, te escribimos desde el gym. ¿Cómo estás? 💪`);
  window.open(`https://wa.me/${clean}?text=${text}`, "_blank");
}

// A valid phone must have at least 10 digits after stripping formatting
function isValidPhone(phone: string | null): boolean {
  if (!phone) return false;
  const digits = phone.replace(/\D/g, "");
  return digits.length >= 10;
}


const defaultExpiry = () => { const d = new Date(); d.setDate(d.getDate() + 30); return d.toISOString().slice(0, 10); };
const statusFromDate = (dateStr: string | null): Status => {
  if (!dateStr) return "activo";
  return new Date(dateStr) < new Date(new Date().toISOString().slice(0, 10)) ? "vencido" : "activo";
};

// ── Search helpers ────────────────────────────────────────────────
function norm(s: string) {
  return s.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "");
}
function lev(a: string, b: string): number {
  const m = a.length, n = b.length;
  const row = Array.from({ length: n + 1 }, (_, i) => i);
  for (let i = 1; i <= m; i++) {
    let prev = i - 1; row[0] = i;
    for (let j = 1; j <= n; j++) {
      const tmp = row[j];
      row[j] = a[i-1] === b[j-1] ? prev : 1 + Math.min(prev, row[j], row[j-1]);
      prev = tmp;
    }
  }
  return row[n];
}
// Matches if query is a substring of target OR each query word fuzzy-matches a word in target
function fuzzyMatch(query: string, target: string): boolean {
  const q = norm(query), t = norm(target);
  if (t.includes(q)) return true;
  if (q.length < 3) return false;
  const tol = q.length <= 5 ? 1 : 2;
  return q.split(/\s+/).every(qw => t.split(/\s+/).some(tw => lev(qw, tw) <= tol));
}

const EMPTY_FORM = { full_name: "", dni: "", phone: "", email: "", plan_id: "", fecha_inicio: defaultExpiry(), fecha_nacimiento: "", wa_consent: true };

export default function AlumnosPage() {
  const confirm = useBrandConfirm();
  const [isMobile,        setIsMobile]        = useState(false);
  const [role,            setRole]            = useState<"admin" | "staff">("admin");
  const [alumnos,         setAlumnos]         = useState<Alumno[]>([]);
  const [loading,         setLoading]         = useState(true);
  const [search,          setSearch]          = useState("");
  const [filtro,          setFiltro]          = useState("todos");
  const [modalOpen,       setModalOpen]       = useState(false);
  const [csvImportOpen,   setCsvImportOpen]   = useState(false);
  const [addMenuOpen,     setAddMenuOpen]     = useState(false);
  const [form,            setForm]            = useState(EMPTY_FORM);
  const [saving,          setSaving]          = useState(false);
  const [formError,       setFormError]       = useState<string | null>(null);
  const [showDetails,     setShowDetails]     = useState(false);
  const [planes,          setPlanes]          = useState<PlanOption[]>([]);
  const [promos,          setPromos]          = useState<PromoOption[]>([]);
  const [planesLoading,   setPlanesLoading]   = useState(false);
  const [totalCount,      setTotalCount]      = useState(0);
  const [menuOpenId,      setMenuOpenId]      = useState<string | null>(null);
  const [menuPos,         setMenuPos]         = useState<{ top: number; right: number; openUp?: boolean } | null>(null);
  const [editModalOpen,   setEditModalOpen]   = useState(false);
  const [editForm,           setEditForm]           = useState({ id: "", full_name: "", phone: "", plan_id: "", next_expiration_date: "" });
  const [editSaving,         setEditSaving]         = useState(false);
  const [editError,          setEditError]          = useState<string | null>(null);
  const [editOriginalPlanId, setEditOriginalPlanId] = useState<string>("");
  const [planChangePolicy,   setPlanChangePolicy]   = useState<"now" | "at_expiry">("at_expiry");
  const [toast, setToast] = useState<string | null>(null);
  const [freezeTarget,    setFreezeTarget]    = useState<Alumno | null>(null);
  const [freezeDias,      setFreezeDias]      = useState("15");
  const [freezeSaving,    setFreezeSaving]    = useState(false);
  const [gymId, setGymId] = useState<string | null>(null);
  const [gymPlanType,      setGymPlanType]      = useState<string>("crecimiento");
  const [ultimaMap,        setUltimaMap]        = useState<Record<string, string>>({});
  const [checkinTarget,    setCheckinTarget]    = useState<Alumno | null>(null);
  const [checkinDate,      setCheckinDate]      = useState("");
  const [checkinSaving,    setCheckinSaving]    = useState(false);
  const [checkinResult,    setCheckinResult]    = useState<string | null>(null);
  const [exportMenuOpen,   setExportMenuOpen]   = useState(false);
  const [exportConfirm,    setExportConfirm]    = useState<null | (() => void)>(null);
  const [membresiaTarget,  setMembresiaTarget]  = useState<Alumno | null>(null);
  const [membresiaPlanId,  setMembresiaPlanId]  = useState("");
  const [membresiaFecha,   setMembresiaFecha]   = useState(defaultExpiry());
  const [membresiaSaving,  setMembresiaSaving]  = useState(false);
  const [membresiaError,   setMembresiaError]   = useState<string | null>(null);
  const [selectedIds,      setSelectedIds]      = useState<Set<string>>(new Set());
  const [bulkMembresiaOpen, setBulkMembresiaOpen] = useState(false);
  const [bulkMembresiaIds, setBulkMembresiaIds] = useState<string[]>([]);
  const [reactivarTarget,   setReactivarTarget]   = useState<Alumno | null>(null);
  const [reactivarPlanId,   setReactivarPlanId]   = useState("");
  const [reactivarFechaInicio, setReactivarFechaInicio] = useState("");
  const [reactivarSaldarDeuda, setReactivarSaldarDeuda] = useState(false);
  const [reactivarSaving,   setReactivarSaving]   = useState(false);
  const [reactivarError,    setReactivarError]    = useState<string | null>(null);
  const [dupTarget,           setDupTarget]           = useState<{ id: string; full_name: string; phone: string | null; status: string; next_expiration_date: string | null; planes: { nombre: string; accent_color: string | null } | null; matchedBy: "phone" | "dni" } | null>(null);
  const [fichaTarget,         setFichaTarget]         = useState<Alumno | null>(null);
  const [fichaLogs,           setFichaLogs]           = useState<ActivityLog[]>([]);
  const [fichaLoading,        setFichaLoading]        = useState(false);
  const [fichaTab,            setFichaTab]            = useState<"historial" | "progreso">("historial");
  const [fichaProgreso,       setFichaProgreso]       = useState<ProgresoData | null>(null);
  const [fichaProgresoLoading, setFichaProgresoLoading] = useState(false);
  const [fichaEjSel,          setFichaEjSel]          = useState<string | null>(null);
  const deferredSearch = useDeferredValue(search);

  const toggleSelect = (id: string) => setSelectedIds(prev => { const n = new Set(prev); n.has(id) ? n.delete(id) : n.add(id); return n; });

  const replaceAlumno = useCallback((id: string, updater: (current: Alumno) => Alumno) => {
    setAlumnos(prev => {
      const next = prev.map(alumno => (alumno.id === id ? updater(alumno) : alumno));
      if (gymId) {
        setPageCache(`alumnos_${gymId}`, next);
      }
      return next;
    });
  }, [gymId]);

  const {
    pagoModalOpen, setPagoModalOpen,
    pagoTarget,
    pagoMonto,         setPagoMonto,
    pagoFecha,         setPagoFecha,
    pagoTipo,          setPagoTipo,
    pagoMetodo,        setPagoMetodo,
    pagoDetalle,       setPagoDetalle,
    pagoDiscountType,  setPagoDiscountType,
    pagoDiscountValue, setPagoDiscountValue,
    pagoDiscountReason,setPagoDiscountReason,
    pagoPromoId,       setPagoPromoId,
    pagoSaving,
    pagoError,
    openPagoModal,
    handlePagoSubmit,
  } = usePagoModal(gymId, replaceAlumno, setToast);

  const {
    rutinaModalOpen, setRutinaModalOpen,
    rutinaTarget,
    rutinaNombre,     setRutinaNombre,
    rutinaEjercicios, setRutinaEjercicios,
    rutinaSaving,
    ejAutoIdx,        setEjAutoIdx,
    rutinaError,
    objetivo,         setObjetivo,
    notas,            setNotas,
    aiLoading,
    publicado,
    rutinatipo,       setRutinatipo,
    wodModalidad,     setWodModalidad,
    wodTimeCap,       setWodTimeCap,
    wodMovimientos,   setWodMovimientos,
    openRutinaModal,
    handleRutinaSave,
    handleAISugerir,
    EMPTY_EJ,
    EMPTY_MOV,
  } = useRutinaModal(gymId, setToast);

  const loadPlanes = useCallback(async (gid: string) => {
    const cacheKey = `planes_${gid}`;
    const cached = getPageCache<PlanOption[]>(cacheKey);
    if (cached) {
      setPlanes(cached);
      return cached;
    }

    setPlanesLoading(true);
    const { data } = await supabase
      .from("planes")
      .select("id, nombre, precio, periodo, duracion_dias, accent_color")
      .eq("gym_id", gid)
      .eq("active", true)
      .order("created_at");

    const list = (data as PlanOption[]) ?? [];
    setPlanes(list);
    setPageCache(cacheKey, list);
    setPlanesLoading(false);
    return list;
  }, []);

  // ── Fetch alumnos ─────────────────────────────────────────────────
  const fetchAlumnos = useCallback(async (background = false) => {
    const profile = await getCachedProfile();
    if (!profile) { setLoading(false); return; }
    setGymId(profile.gymId);
    setRole((profile.role === "staff" ? "staff" : "admin"));

    if (!background) {
      const cached = getPageCache<Alumno[]>(`alumnos_${profile.gymId}`);
      if (cached) { setAlumnos(cached); setTotalCount(cached.length); setLoading(false); }
      else setLoading(true);
    }

    const res = await fetch("/api/admin/alumnos", { cache: "no-store" });
    const payload = await res.json().catch(() => null) as {
      ok?: boolean;
      gym_id?: string;
      role?: string;
      plan_type?: string;
      alumnos?: Alumno[];
      planes?: PlanOption[];
      promos?: PromoOption[];
      ultimaMap?: Record<string, string>;
    } | null;

    if (!res.ok || !payload?.ok) {
      setLoading(false);
      return;
    }

    const rows = payload.alumnos ?? [];
    const nextGymId = payload.gym_id ?? profile.gymId;
    const nextPlanes = payload.planes ?? [];
    const nextPromos = payload.promos ?? [];
    const nextUltimaMap = payload.ultimaMap ?? {};

    setAlumnos(rows);
    setTotalCount(rows.length);
    setPageCache(`alumnos_${nextGymId}`, rows);
    setGymId(nextGymId);
    setRole((payload.role === "staff" ? "staff" : "admin"));
    if (payload.plan_type) setGymPlanType(payload.plan_type);
    setPlanes(nextPlanes);
    setPromos(nextPromos);
    setUltimaMap(nextUltimaMap);
    setPageCache(`planes_${nextGymId}`, nextPlanes);
    setPageCache(`promos_${nextGymId}`, nextPromos);
    setPageCache(`alumnos_ultima_${nextGymId}`, nextUltimaMap);

    setLoading(false);
  }, []);

  useEffect(() => {
    const timer = window.setTimeout(() => { void fetchAlumnos(); }, 0);
    return () => window.clearTimeout(timer);
  }, [fetchAlumnos]);

  useEffect(() => {
    const check = () => setIsMobile(window.innerWidth < 768);
    check();
    window.addEventListener("resize", check);
    return () => window.removeEventListener("resize", check);
  }, []);

  // ── Open modal + fetch planes ─────────────────────────────────────
  const openModal = async () => {
    setForm({ ...EMPTY_FORM, fecha_inicio: defaultExpiry() });
    setFormError(null);
    setShowDetails(false);
    setModalOpen(true);

    if (!gymId) { setPlanesLoading(false); return; }
    await loadPlanes(gymId);
  };

  const openImportModal = () => {
    setAddMenuOpen(false);
    setCsvImportOpen(true);
  };

  // ── Normalize phone to 549XXXXXXXXXX format ───────────────────────
  const normalizePhone = (raw: string): string => {
    const digits = raw.replace(/\D/g, "");
    if (digits.startsWith("549")) return digits;
    if (digits.startsWith("54")) return "549" + digits.slice(2);
    if (digits.startsWith("9")) return "54" + digits;
    return "549" + digits;
  };

  // ── Submit new alumno ─────────────────────────────────────────────
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.dni.trim()) { setFormError("El DNI es obligatorio."); return; }
    if (!form.full_name.trim()) { setFormError("El nombre completo es obligatorio."); return; }
    if (!form.phone.trim()) { setFormError("El teléfono/WhatsApp es obligatorio."); return; }
    setSaving(true);
    setFormError(null);

    if (!gymId) { setFormError("Sesión expirada."); setSaving(false); return; }

    const res = await fetch("/api/admin/alumnos", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        full_name:           form.full_name.trim(),
        dni:                 form.dni.trim() || null,
        phone:               normalizePhone(form.phone.trim()),
        email:               form.email.trim() || null,
        plan_id:             form.plan_id || null,
        status:              statusFromDate(form.fecha_inicio || null),
        last_payment_date:   new Date().toISOString().slice(0, 10),
        next_expiration_date: form.fecha_inicio || null,
        fecha_nacimiento:     form.fecha_nacimiento || null,
      }),
    });
    const result = await res.json();

    if (!res.ok || !result.ok) {
      if (result.duplicate && result.existingAlumno) {
        setDupTarget({ ...result.existingAlumno, matchedBy: result.matchedBy ?? "phone" });
        setSaving(false);
        return;
      }
      setFormError(result.error ?? "No se pudo crear el alumno.");
      setSaving(false);
      return;
    }

    const newAlumno = result.alumno;
    invalidateDashboardCache();

    if (newAlumno?.id && gymId) {
      const planNombre = planes.find(p => p.id === form.plan_id)?.nombre;
      supabase.from("alumno_activity_log").insert({
        alumno_id: newAlumno.id, gym_id: gymId, type: "creado",
        description: `Alumno creado${planNombre ? ` · Plan: ${planNombre}` : ""}`,
        actor: "admin",
      }).then(() => {});
    }

    // Notificación: nuevo alumno registrado
    fetch("/api/notifications", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        gym_id: gymId,
        type: "new_alumno",
        title: `Nuevo alumno: ${form.full_name.trim()}`,
        body: form.phone.trim() ? `Tel: ${form.phone.trim()}` : null,
      }),
    }).catch(() => {});

    // Bienvenida por WhatsApp — solo si el alumno dio consentimiento
    if (newAlumno?.id && form.phone.trim() && form.wa_consent) {
      fetch("/api/alumno/send-welcome", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ alumno_id: newAlumno.id }),
      }).catch(() => {});
    }

    // Mark any matching prospecto (by phone) as converted
    if (gymId && form.phone.trim()) {
      const phone = normalizePhone(form.phone.trim());
      supabase.from("prospectos")
        .update({ clase_gratis_status: "convertido", status: "contactado" })
        .eq("gym_id", gymId)
        .eq("phone", phone)
        .not("clase_gratis_date", "is", null)
        .neq("clase_gratis_status", "convertido")
        .then(() => {});
    }

    setModalOpen(false);
    setForm(EMPTY_FORM);
    setSaving(false);
    fetchAlumnos();
  };

  // ── Close menu on outside click ───────────────────────────────────
  useEffect(() => {
    const close = () => setMenuOpenId(null);
    window.addEventListener("click", close);
    return () => window.removeEventListener("click", close);
  }, []);

  // ── Auto-dismiss toast ────────────────────────────────────────────
  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(null), 3000);
    return () => clearTimeout(t);
  }, [toast]);

  // ── Pago Modal ────────────────────────────────────────────────────
  const today = new Date().toISOString().slice(0, 10);

  const openCheckinModal = (a: Alumno) => {
    setCheckinTarget(a);
    setCheckinDate(today);
    setCheckinResult(null);
    setCheckinSaving(false);
  };

  const handleCheckin = async () => {
    if (!checkinTarget) return;
    setCheckinSaving(true);
    setCheckinResult(null);

    // Optimistic: mark attendance before server confirms
    const prevDate = ultimaMap[checkinTarget.id] ?? null;
    const targetId = checkinTarget.id;
    const targetName = checkinTarget.full_name;
    setUltimaMap(prev => ({ ...prev, [targetId]: checkinDate }));

    const res = await fetch("/api/admin/checkin-manual", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ alumno_id: targetId, fecha: checkinDate }),
    });
    const d = await res.json();
    setCheckinSaving(false);
    if (d.ok) {
      setCheckinResult("ok");
      setToast(`✓ Asistencia de ${targetName} — ${checkinDate}`);
      setTimeout(() => { setCheckinTarget(null); setCheckinResult(null); }, 1200);
    } else {
      // Revert optimistic update
      setUltimaMap(prev => {
        const n = { ...prev };
        if (prevDate === null) delete n[targetId]; else n[targetId] = prevDate;
        return n;
      });
      setCheckinResult(d.error ?? "No se pudo registrar la asistencia.");
    }
  };



  // ── Congelar / Descongelar ────────────────────────────────────────
  const handleCongelar = async () => {
    if (!freezeTarget) return;
    const dias = parseInt(freezeDias);
    if (!dias || dias < 1) return;
    setFreezeSaving(true);
    const res = await fetch("/api/admin/alumnos/freeze", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ alumno_id: freezeTarget.id, dias }),
    });
    const data = await res.json() as { ok?: boolean; frozen_since?: string; pausa_hasta?: string; error?: string };
    setFreezeSaving(false);
    if (!res.ok || !data.ok) { setToast(data.error ?? "Error al congelar."); return; }
    replaceAlumno(freezeTarget.id, (c) => ({
      ...c,
      status: "pausado",
      frozen_since: data.frozen_since ?? null,
      pausa_hasta: data.pausa_hasta ?? null,
    }));
    if (gymId) {
      supabase.from("alumno_activity_log").insert({
        alumno_id: freezeTarget.id, gym_id: gymId, type: "congelado",
        description: `Membresía congelada por ${dias} días`,
        actor: "admin",
      }).then(() => {});
    }
    setFreezeTarget(null);
    setToast(`${freezeTarget.full_name} congelado por ${dias} días. Vencimiento se extenderá al descongelar.`);
  };

  const handleDescongelar = async (alumno: Alumno) => {
    const res = await fetch("/api/admin/alumnos/freeze", {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ alumno_id: alumno.id }),
    });
    const data = await res.json() as { ok?: boolean; dias_congelados?: number; next_expiration_date?: string; error?: string };
    if (!res.ok || !data.ok) { setToast(data.error ?? "Error al descongelar."); return; }
    replaceAlumno(alumno.id, (c) => ({
      ...c,
      status: "activo",
      frozen_since: null,
      pausa_hasta: null,
      next_expiration_date: data.next_expiration_date ?? c.next_expiration_date,
    }));
    if (gymId) {
      supabase.from("alumno_activity_log").insert({
        alumno_id: alumno.id, gym_id: gymId, type: "descongelado",
        description: `Membresía descongelada · +${data.dias_congelados ?? 0} días → ${data.next_expiration_date ?? "sin cambio"}`,
        actor: "admin",
      }).then(() => {});
    }
    setToast(`${alumno.full_name} descongelado. Vencimiento extendido ${data.dias_congelados}d → ${data.next_expiration_date ?? "sin cambio"}.`);
  };

  // ── Eliminar Alumno ───────────────────────────────────────────────
  const handleEliminar = async (id: string, name: string) => {
    if (!await confirm({
      eyebrow: "Eliminar alumno",
      title: `¿Eliminar a ${name}?`,
      message: "Podrás recuperarlo contactando a soporte.",
      confirmLabel: "Eliminar",
      variant: "danger",
    })) return;
    const { error } = await supabase.from("alumnos").update({ deleted_at: new Date().toISOString() }).eq("id", id);
    if (error) {
      setToast(`Error al eliminar: ${error.message}`);
      return;
    }
    if (gymId) {
      supabase.from("alumno_activity_log").insert({
        alumno_id: id, gym_id: gymId, type: "eliminado",
        description: `Alumno eliminado (soft delete)`,
        actor: "admin",
      }).then(() => {});
    }
    setAlumnos(prev => {
      const next = prev.filter(alumno => alumno.id !== id);
      if (gymId) setPageCache(`alumnos_${gymId}`, next);
      return next;
    });
    setTotalCount(prev => Math.max(0, prev - 1));
    setUltimaMap(prev => { const next = { ...prev }; delete next[id]; return next; });
    setToast(`${name} eliminado`);
  };

  const handleBulkEliminar = async () => {
    const ids = [...selectedIds];
    if (ids.length === 0) return;
    if (!await confirm({
      eyebrow: "Eliminar selección",
      title: `¿Eliminar ${ids.length} alumno${ids.length !== 1 ? "s" : ""}?`,
      message: "Podrás recuperarlos contactando a soporte.",
      confirmLabel: "Eliminar",
      variant: "danger",
    })) return;
    const deletedAt = new Date().toISOString();
    const { error } = await supabase.from("alumnos").update({ deleted_at: deletedAt }).in("id", ids);
    if (error) {
      setToast(`Error al eliminar: ${error.message}`);
      return;
    }
    const idsSet = new Set(ids);
    if (gymId) {
      const logs = alumnos
        .filter(alumno => idsSet.has(alumno.id))
        .map(alumno => ({
          alumno_id: alumno.id,
          gym_id: gymId,
          type: "eliminado",
          description: "Alumno eliminado (soft delete)",
          actor: "admin",
        }));
      if (logs.length > 0) supabase.from("alumno_activity_log").insert(logs).then(() => {});
    }
    setAlumnos(prev => {
      const next = prev.filter(alumno => !idsSet.has(alumno.id));
      if (gymId) setPageCache(`alumnos_${gymId}`, next);
      return next;
    });
    setTotalCount(prev => Math.max(0, prev - ids.length));
    setUltimaMap(prev => {
      const next = { ...prev };
      ids.forEach(id => { delete next[id]; });
      return next;
    });
    setSelectedIds(new Set());
    setToast(`${ids.length} alumno${ids.length !== 1 ? "s" : ""} eliminado${ids.length !== 1 ? "s" : ""}`);
  };

  // ── Ficha / historial ────────────────────────────────────────────
  const openFicha = async (alumno: Alumno) => {
    setFichaTarget(alumno);
    setFichaTab("historial");
    setFichaProgreso(null);
    setFichaEjSel(null);
    setFichaLogs([]);
    setFichaLoading(true);
    const { data } = await supabase
      .from("alumno_activity_log")
      .select("id, type, description, actor, metadata, created_at")
      .eq("alumno_id", alumno.id)
      .order("created_at", { ascending: false })
      .limit(60);
    setFichaLogs((data as ActivityLog[]) ?? []);
    setFichaLoading(false);
  };

  const loadFichaProgreso = async (alumnoId: string) => {
    if (fichaProgreso) return;
    setFichaProgresoLoading(true);
    try {
      const res = await fetch(`/api/admin/alumno-progreso?alumno_id=${alumnoId}`);
      if (res.ok) {
        const d: ProgresoData = await res.json();
        setFichaProgreso(d);
        if (d.pesos.length) {
          const firstEj = d.pesos.find(() => true)?.ejercicio ?? null;
          setFichaEjSel(firstEj);
        }
      }
    } catch {}
    setFichaProgresoLoading(false);
  };

  // ── Exportar ──────────────────────────────────────────────────────
  const buildRows = () => lista.map(a => ({
    Nombre:       a.full_name,
    DNI:          a.dni ?? "",
    Teléfono:     a.phone ?? "",
    Plan:         a.planes?.nombre ?? "",
    Estado:       STATUS_STYLE[a.status].label,
    Vencimiento:  a.next_expiration_date ?? "",
    "Últ. asistencia": ultimaMap[a.id] ?? "",
  }));

  const exportCSV = async () => {
    const { default: Papa } = await import("papaparse");
    const csv = Papa.unparse(buildRows());
    const blob = new Blob(["﻿" + csv], { type: "text/csv;charset=utf-8;" });
    const url  = URL.createObjectURL(blob);
    const a    = document.createElement("a");
    a.href = url; a.download = `alumnos_${new Date().toISOString().slice(0,10)}.csv`;
    a.click(); URL.revokeObjectURL(url);
    setExportMenuOpen(false);
  };

  const exportPDF = async () => {
    const { jsPDF } = await import("jspdf");
    const rows = buildRows();
    const cols = Object.keys(rows[0] ?? {});
    const doc = new jsPDF();
    const pageWidth = doc.internal.pageSize.getWidth();
    const pageHeight = doc.internal.pageSize.getHeight();
    const margin = 10;
    let yPos = margin + 10;

    doc.setFontSize(14);
    doc.text("Lista de Alumnos", margin, yPos);
    yPos += 7;
    doc.setFontSize(9);
    doc.setTextColor(119, 119, 119);
    doc.text(`Exportado el ${new Date().toLocaleDateString("es-AR")} · ${rows.length} alumnos`, margin, yPos);
    yPos += 8;
    doc.setTextColor(0, 0, 0);

    const colWidths = cols.map(() => (pageWidth - 2 * margin) / cols.length);
    doc.setFontSize(8);
    doc.setFillColor(26, 29, 35);
    doc.setTextColor(255, 255, 255);

    cols.forEach((col, i) => {
      doc.text(col, margin + colWidths.slice(0, i).reduce((a, b) => a + b, 0) + 1, yPos);
    });
    yPos += 5;

    doc.setTextColor(0, 0, 0);
    rows.forEach((row, rowIdx) => {
      if (yPos > pageHeight - margin) {
        doc.addPage();
        yPos = margin;
      }
      cols.forEach((col, colIdx) => {
        const text = String((row as Record<string, string>)[col] ?? "");
        const x = margin + colWidths.slice(0, colIdx).reduce((a, b) => a + b, 0) + 1;
        if (rowIdx % 2 === 0) {
          doc.setFillColor(249, 249, 249);
          doc.rect(x - 0.5, yPos - 3, colWidths[colIdx], 4, "F");
        }
        doc.text(text.substring(0, 30), x, yPos);
      });
      yPos += 4;
    });

    doc.save(`alumnos_${new Date().toISOString().slice(0, 10)}.pdf`);
    setExportMenuOpen(false);
  };

  // ── Asignar Membresía ─────────────────────────────────────────────
  const openReactivarModal = async (a: Alumno) => {
    setReactivarTarget(a);
    setReactivarPlanId(a.plan_id ?? "");
    setReactivarFechaInicio(
      a.next_expiration_date && a.next_expiration_date > today
        ? a.next_expiration_date
        : today
    );
    setReactivarSaldarDeuda(false);
    setReactivarError(null);
    if (planes.length === 0 && gymId) await loadPlanes(gymId);
  };

  const handleReactivarSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!reactivarTarget) return;
    setReactivarSaving(true);
    setReactivarError(null);
    const plan = planes.find(p => p.id === reactivarPlanId);
    const base = new Date(reactivarFechaInicio + "T12:00:00");
    const MESES: Record<string, number> = { mes: 1, mensual: 1, trimestral: 3, anual: 12, año: 12 };
    const DIAS:  Record<string, number> = { semanal: 7, semana: 7 };
    const periodo = plan?.periodo ?? "mensual";
    let vencimiento: Date;
    if (plan?.duracion_dias && plan.duracion_dias > 0) {
      vencimiento = new Date(base);
      vencimiento.setDate(vencimiento.getDate() + plan.duracion_dias);
    } else if (MESES[periodo]) {
      vencimiento = addMonths(base, MESES[periodo]);
    } else {
      vencimiento = new Date(base);
      vencimiento.setDate(vencimiento.getDate() + (DIAS[periodo] ?? 30));
    }
    const nextExp = `${vencimiento.getFullYear()}-${String(vencimiento.getMonth() + 1).padStart(2, "0")}-${String(vencimiento.getDate()).padStart(2, "0")}`;
    const updates: Record<string, unknown> = {
      plan_id: reactivarPlanId || null,
      status: "activo",
      next_expiration_date: nextExp,
      last_payment_date: reactivarFechaInicio,
    };
    if (reactivarSaldarDeuda) updates.deuda_pendiente = 0;
    const { error } = await supabase.from("alumnos").update(updates).eq("id", reactivarTarget.id);
    setReactivarSaving(false);
    if (error) { setReactivarError("No se pudo reactivar. Intentá de nuevo."); return; }
    if (gymId) {
      supabase.from("alumno_activity_log").insert({
        alumno_id: reactivarTarget.id, gym_id: gymId, type: "reactivado",
        description: `Membresía reactivada → Plan: ${plan?.nombre ?? "sin plan"} · Vence: ${nextExp}${reactivarSaldarDeuda ? " · Deuda saldada" : ""}`,
        actor: "admin",
      }).then(() => {});
    }
    const prev = reactivarTarget;
    replaceAlumno(prev.id, (c) => ({
      ...c,
      plan_id: reactivarPlanId || null,
      planes: plan ? { nombre: plan.nombre, accent_color: plan.accent_color, precio: plan.precio, duracion_dias: plan.duracion_dias } : c.planes,
      status: "activo",
      next_expiration_date: nextExp,
      deuda_pendiente: reactivarSaldarDeuda ? 0 : c.deuda_pendiente,
    }));
    setReactivarTarget(null);
    setToast(`${prev.full_name} reactivado hasta ${nextExp}`);
  };

  const openMembresiaModal = async (a: Alumno) => {
    setMembresiaTarget(a);
    setMembresiaPlanId(a.plan_id ?? "");
    setMembresiaFecha(a.next_expiration_date ?? defaultExpiry());
    setMembresiaError(null);
    if (planes.length === 0 && gymId) await loadPlanes(gymId);
  };

  const openBulkMembresiaModal = async () => {
    const ids = [...selectedIds];
    if (ids.length === 0) return;
    setBulkMembresiaIds(ids);
    setMembresiaPlanId("");
    setMembresiaFecha(defaultExpiry());
    setMembresiaError(null);
    setBulkMembresiaOpen(true);
    if (planes.length === 0 && gymId) await loadPlanes(gymId);
  };

  const handleMembresiaSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!membresiaTarget && !bulkMembresiaOpen) return;
    const ids = bulkMembresiaOpen ? bulkMembresiaIds : [membresiaTarget!.id];
    if (ids.length === 0) return;
    setMembresiaSaving(true);
    setMembresiaError(null);
    const newStatus = membresiaFecha ? statusFromDate(membresiaFecha) : "activo";
    const { error } = await supabase
      .from("alumnos")
      .update({ plan_id: membresiaPlanId || null, next_expiration_date: membresiaFecha || null, status: newStatus })
      .in("id", ids);
    setMembresiaSaving(false);
    if (error) { setMembresiaError(error.message); return; }
    setMembresiaTarget(null);
    setBulkMembresiaOpen(false);
    setBulkMembresiaIds([]);
    setSelectedIds(new Set());
    setToast(`Membresía asignada a ${ids.length} alumno${ids.length !== 1 ? "s" : ""}`);
    setTimeout(() => setToast(null), 3000);
    const selectedPlan = planes.find(plan => plan.id === membresiaPlanId) ?? null;
    ids.forEach(id => replaceAlumno(id, (current) => ({
      ...current,
      plan_id: membresiaPlanId || null,
      next_expiration_date: membresiaFecha || null,
      status: newStatus,
      planes: selectedPlan ? { nombre: selectedPlan.nombre, accent_color: selectedPlan.accent_color, precio: selectedPlan.precio, duracion_dias: selectedPlan.duracion_dias } : null,
    })));
  };

  // ── Editar Alumno ─────────────────────────────────────────────────
  const openEditModal = async (a: Alumno) => {
    setEditForm({ id: a.id, full_name: a.full_name, phone: a.phone ?? "", plan_id: a.plan_id ?? "", next_expiration_date: a.next_expiration_date ?? "" });
    setEditOriginalPlanId(a.plan_id ?? "");
    setPlanChangePolicy("at_expiry");
    setEditError(null);
    setEditModalOpen(true);
    if (planes.length === 0 && gymId) await loadPlanes(gymId);
  };

  const handleEditSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setEditSaving(true);
    setEditError(null);

    const planChanged = !!editForm.plan_id && editForm.plan_id !== editOriginalPlanId;
    let finalExpiry = editForm.next_expiration_date || null;

    if (planChanged && planChangePolicy === "now") {
      const newPlan = planes.find(p => p.id === editForm.plan_id);
      if (newPlan) {
        const base = new Date(); base.setHours(12, 0, 0, 0);
        const PM: Record<string, number> = { mes: 1, mensual: 1, trimestral: 3, anual: 12, año: 12 };
        const PD: Record<string, number> = { semanal: 7, semana: 7 };
        const per = newPlan.periodo ?? "mensual";
        let exp: Date;
        if (newPlan.duracion_dias > 0) {
          exp = new Date(base); exp.setDate(exp.getDate() + newPlan.duracion_dias);
        } else if (PM[per]) {
          exp = addMonths(base, PM[per]);
        } else {
          exp = new Date(base); exp.setDate(exp.getDate() + (PD[per] ?? 30));
        }
        finalExpiry = `${exp.getFullYear()}-${String(exp.getMonth() + 1).padStart(2, "0")}-${String(exp.getDate()).padStart(2, "0")}`;
      }
    }

    const { error } = await supabase.from("alumnos").update({
      full_name:            editForm.full_name.trim(),
      phone:                normalizePhone(editForm.phone.trim()),
      plan_id:              editForm.plan_id || null,
      next_expiration_date: finalExpiry,
      status:               statusFromDate(finalExpiry),
    }).eq("id", editForm.id);
    if (error) { setEditError(error.message); setEditSaving(false); return; }
    setEditModalOpen(false);
    setEditSaving(false);
    if (gymId) {
      const planNombre = planes.find(p => p.id === editForm.plan_id)?.nombre;
      const policyNote = planChanged ? (planChangePolicy === "now" ? " · Aplicado ahora" : " · Aplica al vencer") : "";
      supabase.from("alumno_activity_log").insert({
        alumno_id: editForm.id, gym_id: gymId, type: "editado",
        description: `Datos editados${planNombre ? ` · Plan: ${planNombre}${policyNote}` : ""}`,
        actor: "admin",
      }).then(() => {});
    }
    const selectedPlan = planes.find(plan => plan.id === editForm.plan_id) ?? null;
    replaceAlumno(editForm.id, (current) => ({
      ...current,
      full_name: editForm.full_name.trim(),
      phone: normalizePhone(editForm.phone.trim()),
      plan_id: editForm.plan_id || null,
      next_expiration_date: finalExpiry,
      status: statusFromDate(finalExpiry),
      planes: selectedPlan
        ? {
            nombre: selectedPlan.nombre,
            accent_color: selectedPlan.accent_color,
            precio: selectedPlan.precio,
            duracion_dias: selectedPlan.duracion_dias,
          }
        : current.planes,
    }));
  };

  // ── Derived state ─────────────────────────────────────────────────
  const q = deferredSearch.trim();
  const qDni = q.replace(/\D/g, ""); // strip dots/dashes for DNI comparison
  const lista = alumnos.filter(a => (
    (!q ||
      fuzzyMatch(q, a.full_name) ||
      (a.planes?.nombre ? fuzzyMatch(q, a.planes.nombre) : false) ||
      (a.phone ? (a.phone.includes(q)) : false) ||
      (qDni && a.dni ? a.dni.includes(qDni) : false)
    ) &&
    (filtro === "todos" || a.status === filtro)
  ));

  const menuTarget = menuOpenId ? alumnos.find(a => a.id === menuOpenId) ?? null : null;
  const portalRoot = typeof document !== "undefined" ? document.body : null;

  const handleSendPayLink = async (alumno: Alumno) => {
    if (!alumno.phone) { setToast("El alumno no tiene teléfono cargado."); return; }
    setMenuOpenId(null); setMenuPos(null);
    try {
      const res = await fetch("/api/admin/alumnos/pay-link", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ alumno_id: alumno.id }),
      });
      const data = await res.json();
      if (!res.ok) { setToast(data.error ?? "No se pudo generar el link."); return; }
      setToast(`Link de pago enviado a ${alumno.full_name} por WA ✓`);
    } catch { setToast("Error al enviar el link."); }
  };

  const handleSendWelcome = async (alumno: Alumno) => {
    if (!alumno.phone) { setToast("El alumno no tiene WhatsApp habilitado."); return; }
    setMenuOpenId(null); setMenuPos(null);
    try {
      const res = await fetch("/api/alumno/send-welcome", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ alumno_id: alumno.id }),
      });
      if (!res.ok) { setToast("No se pudo enviar el link de acceso."); return; }
      setToast(`Link de acceso reenviado a ${alumno.full_name} ✓`);
    } catch { setToast("Error al enviar el link de acceso."); }
  };

  return (
    <>
    <div style={{ display: "flex", flexDirection: "column", gap: 18 }}>

      {/* Header */}
      <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 12, flexWrap: isMobile ? "wrap" : "nowrap" }}>
        <div>
          <h1 style={{ font: `800 ${isMobile ? "1.25rem" : "1.9rem"}/1 ${fd}`, color: t1, letterSpacing: "-0.02em" }}>Alumnos</h1>
        </div>
        <div style={{ position: "relative", flexShrink: 0, width: isMobile ? "100%" : undefined }}>
          <button
            onClick={() => setAddMenuOpen((current) => !current)}
            style={{ minHeight: 46, width: isMobile ? "100%" : undefined, justifyContent: "center", display: "flex", alignItems: "center", gap: 8, background: "#F97316", color: "white", border: "none", padding: isMobile ? "10px 16px" : "10px 20px", borderRadius: 12, font: `700 0.875rem/1 ${fd}`, cursor: "pointer", boxShadow: "0 4px 14px rgba(249,115,22,0.25)" }}
          >
            <Plus size={15} />
            {isMobile ? "Nuevo" : "Agregar Alumno"}
            <ChevronDown size={15} />
          </button>
          {addMenuOpen && (
            <>
              <div onClick={() => setAddMenuOpen(false)} style={{ position: "fixed", inset: 0, zIndex: 200 }} />
              <div style={{ position: "absolute", top: "calc(100% + 8px)", right: 0, zIndex: 201, background: "#FFFFFF", border: "1px solid rgba(0,0,0,0.08)", borderRadius: 14, boxShadow: "0 16px 38px rgba(0,0,0,0.14)", minWidth: isMobile ? "100%" : 240, overflow: "hidden" }}>
                {[
                  {
                    label: "Manual",
                    hint: "Cargar un alumno individual",
                    icon: <User size={16} />,
                    action: async () => {
                      setAddMenuOpen(false);
                      await openModal();
                    },
                  },
                  {
                    label: "Importar CSV",
                    hint: "Subir una lista desde archivo",
                    icon: <FileSpreadsheet size={16} />,
                    action: openImportModal,
                  },
                ].map((item) => (
                  <button
                    key={item.label}
                    onClick={() => void item.action()}
                    style={{ width: "100%", display: "grid", gridTemplateColumns: "36px minmax(0, 1fr)", gap: 10, alignItems: "center", textAlign: "left", padding: "12px 14px", background: "none", border: "none", cursor: "pointer" }}
                    onMouseEnter={(e) => { e.currentTarget.style.background = "#F9FAFB"; }}
                    onMouseLeave={(e) => { e.currentTarget.style.background = "transparent"; }}
                  >
                    <span style={{ width: 36, height: 36, borderRadius: 10, background: "rgba(249,115,22,0.1)", color: "#F97316", display: "flex", alignItems: "center", justifyContent: "center" }}>{item.icon}</span>
                    <span style={{ minWidth: 0 }}>
                      <span style={{ display: "block", font: `700 0.85rem/1 ${fd}`, color: t1 }}>{item.label}</span>
                      <span style={{ display: "block", font: `400 0.74rem/1.35 ${fb}`, color: t3, marginTop: 3 }}>{item.hint}</span>
                    </span>
                  </button>
                ))}
              </div>
            </>
          )}
        </div>
      </div>


      {/* Search + Filters */}
      <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
        <div style={{ position: "relative" }}>
          <Search size={14} style={{ position: "absolute", left: 12, top: "50%", transform: "translateY(-50%)", color: t3 }} />
          <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Buscá por nombre, plan o DNI..."
            style={{ width: "100%", minHeight: 46, padding: "10px 14px 10px 32px", background: "white", border: "1px solid rgba(0,0,0,0.08)", borderRadius: 12, font: `400 0.85rem/1 ${fb}`, color: t1, outline: "none", boxSizing: "border-box" as const }} />
        </div>
        <div style={{ display: "flex", gap: 6, overflowX: "auto", paddingBottom: 2 }}>
          {[["todos","Todos"],["activo","Activo"],["vencido","Vencido"],["pendiente","Pendiente"]].map(([val, lbl]) => (
            <button key={val} onClick={() => setFiltro(val)} style={{ flexShrink: 0, minHeight: 40, padding: "7px 16px", borderRadius: 9999, border: "none", font: `600 0.78rem/1 ${fb}`, cursor: "pointer", transition: "all 0.14s", background: filtro === val ? "#1A1D23" : "white", color: filtro === val ? "white" : t2, boxShadow: filtro === val ? "none" : "0 1px 4px rgba(0,0,0,0.08)" }}>{lbl}</button>
          ))}
        </div>
      </div>

      {/* Table card — desktop */}
      {!isMobile && (
        <div style={{ ...card, padding: 0, overflow: "hidden" }}>
          <table style={{ width: "100%", borderCollapse: "collapse" }}>
            <thead>
              <tr style={{ borderBottom: "1px solid rgba(0,0,0,0.06)" }}>
                <th style={{ padding: "8px 8px 8px 16px", width: 32 }}>
                  <input type="checkbox" checked={lista.length > 0 && lista.every(a => selectedIds.has(a.id))} onChange={() => { const all = lista.every(a => selectedIds.has(a.id)); setSelectedIds(all ? new Set() : new Set(lista.map(a => a.id))); }} style={{ width: 15, height: 15, cursor: "pointer", accentColor: "#FF6A00" }} />
                </th>
                {["Alumno", "DNI", "Plan", "Estado", "Vence", "Últ. asistencia", "Acciones"].map(h => (
                  <th key={h} style={{ padding: "8px 16px", textAlign: "left", font: `600 0.68rem/1 ${fb}`, color: t3, textTransform: "uppercase", letterSpacing: "0.07em" }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr><td colSpan={8} style={{ padding: "40px", textAlign: "center", font: `400 0.875rem/1 ${fb}`, color: t3 }}>Cargando alumnos...</td></tr>
              ) : lista.length === 0 && alumnos.length > 0 ? (
                <tr><td colSpan={8} style={{ padding: "48px", textAlign: "center", font: `400 0.875rem/1.5 ${fb}`, color: t3 }}>
                  No se encontraron alumnos con ese filtro.
                </td></tr>
              ) : lista.length === 0 ? (
                <>
                  {/* Ghost rows */}
                  {[
                    { name: "Valentina Gómez", plan: "Full", color: "#6366F1", status: "Activo", statusColor: "#16A34A", statusBg: "rgba(22,163,74,0.08)", date: "2025-08-15" },
                    { name: "Martín Rodríguez", plan: "Básico", color: "#F59E0B", status: "Activo", statusColor: "#16A34A", statusBg: "rgba(22,163,74,0.08)", date: "2025-07-30" },
                    { name: "Sofía Peralta", plan: "VIP", color: "#EC4899", status: "Vencido", statusColor: "#DC2626", statusBg: "rgba(220,38,38,0.08)", date: "2025-06-01" },
                  ].map((g, i) => (
                    <tr key={i} style={{ borderBottom: "1px solid rgba(0,0,0,0.04)", opacity: i === 0 ? 0.55 : i === 1 ? 0.35 : 0.2, filter: "blur(0.5px)", pointerEvents: "none", userSelect: "none" }}>
                      <td style={{ padding: "9px 8px 9px 16px" }}><input type="checkbox" disabled style={{ width: 15, height: 15, accentColor: "#FF6A00" }} /></td>
                      <td style={{ padding: "9px 16px" }}>
                        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                          <div style={{ width: 28, height: 28, borderRadius: "50%", background: "#2C2C2E", display: "flex", alignItems: "center", justifyContent: "center", font: `700 0.6rem/1 ${fd}`, color: "white", flexShrink: 0 }}>{g.name.split(" ").map(w => w[0]).join("")}</div>
                          <span style={{ font: `600 0.84rem/1 ${fd}`, color: t1 }}>{g.name}</span>
                        </div>
                      </td>
                      <td style={{ padding: "9px 16px", font: `500 0.8rem/1 ${fb}`, color: t2 }}>—</td>
                      <td style={{ padding: "9px 16px" }}><span style={{ font: `600 0.72rem/1 ${fb}`, color: g.color, background: `${g.color}18`, padding: "3px 9px", borderRadius: 9999 }}>{g.plan}</span></td>
                      <td style={{ padding: "9px 16px" }}><span style={{ font: `600 0.69rem/1 ${fb}`, color: g.statusColor, background: g.statusBg, padding: "3px 9px", borderRadius: 9999 }}>{g.status}</span></td>
                      <td style={{ padding: "9px 16px", font: `400 0.8rem/1 ${fb}`, color: t2 }}>{g.date}</td>
                      <td style={{ padding: "9px 16px" }}><span style={{ color: t3 }}>—</span></td>
                      <td style={{ padding: "9px 16px" }}></td>
                    </tr>
                  ))}
                  <tr>
                    <td colSpan={8} style={{ padding: "28px 24px", textAlign: "center", borderTop: "2px dashed rgba(255,106,0,0.2)", background: "rgba(255,106,0,0.02)" }}>
                      <p style={{ margin: "0 0 14px", font: `600 0.9rem/1.5 ${fb}`, color: t1 }}>Todavía no tenés alumnos</p>
                      <p style={{ margin: "0 0 16px", font: `400 0.8rem/1.5 ${fb}`, color: t3 }}>Agregá tu primer alumno a mano o importá una lista desde Excel.</p>
                      <button onClick={openModal} style={{ display: "inline-flex", alignItems: "center", gap: 6, background: "linear-gradient(135deg,#FF6A00,#e85d00)", border: "none", borderRadius: 10, padding: "9px 20px", font: `600 0.85rem/1 ${fb}`, color: "#fff", cursor: "pointer", boxShadow: "0 3px 12px rgba(255,106,0,0.35)" }}>
                        <Plus size={14}/> Agregar primer alumno
                      </button>
                    </td>
                  </tr>
                </>
              ) : lista.map((a, i) => {
                const planNombre = a.planes?.nombre ?? "—";
                const planColor  = a.planes?.accent_color ?? t2;
                const planBg     = a.planes?.accent_color ? `${a.planes.accent_color}18` : "#F0F2F8";
                const isPausado  = a.status === "pausado";
                return (
                  <tr key={a.id} style={{ borderBottom: i < lista.length - 1 ? "1px solid rgba(0,0,0,0.04)" : "none", ...(selectedIds.has(a.id) ? { background: "rgba(255,106,0,0.04)" } : isPausado ? { opacity: 0.65, background: "#F5F5F7" } : {}) }}
                    onMouseEnter={e => { if (!selectedIds.has(a.id)) e.currentTarget.style.background = isPausado ? "#EFEFEF" : "#FAFBFD"; }}
                    onMouseLeave={e => { if (!selectedIds.has(a.id)) e.currentTarget.style.background = isPausado ? "#F5F5F7" : "transparent"; }}
                  >
                    <td style={{ padding: "9px 8px 9px 16px" }}>
                      <input type="checkbox" checked={selectedIds.has(a.id)} onChange={() => toggleSelect(a.id)} onClick={e => e.stopPropagation()} style={{ width: 15, height: 15, cursor: "pointer", accentColor: "#FF6A00" }} />
                    </td>
                    <td style={{ padding: "9px 16px" }}>
                      <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                        <div style={{ width: 28, height: 28, borderRadius: "50%", background: "#2C2C2E", display: "flex", alignItems: "center", justifyContent: "center", font: `700 0.6rem/1 ${fd}`, color: "white", flexShrink: 0 }}>{initials(a.full_name)}</div>
                        <div style={{ display: "flex", flexDirection: "column", gap: 2, minWidth: 0 }}>
                          <span style={{ font: `600 0.84rem/1 ${fd}`, color: t1, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis", maxWidth: 180 }}>{a.full_name}</span>
                          {a.deuda_pendiente > 0 && (
                            <span style={{ font: `600 0.62rem/1 ${fb}`, color: "#D97706", background: "rgba(217,119,6,0.1)", padding: "2px 6px", borderRadius: 6, alignSelf: "flex-start", whiteSpace: "nowrap" }}>
                              Debe ${a.deuda_pendiente.toLocaleString("es-AR")}
                            </span>
                          )}
                        </div>
                      </div>
                    </td>
                    <td style={{ padding: "9px 16px", font: `500 0.8rem/1 ${fb}`, color: t2 }}>{a.dni ?? <span style={{ color: t3 }}>—</span>}</td>
                    <td style={{ padding: "9px 16px" }}><span style={{ font: `600 0.72rem/1 ${fb}`, color: planColor, background: planBg, padding: "3px 9px", borderRadius: 9999, whiteSpace: "nowrap" }}>{planNombre}</span></td>
                    <td style={{ padding: "9px 16px" }}><span style={{ font: `600 0.69rem/1 ${fb}`, color: STATUS_STYLE[a.status].color, background: STATUS_STYLE[a.status].bg, padding: "3px 9px", borderRadius: 9999 }}>{STATUS_STYLE[a.status].label}</span></td>
                    <td style={{ padding: "9px 16px", font: `400 0.8rem/1 ${fb}`, color: t2 }}>{a.next_expiration_date ?? "—"}</td>
                    <td style={{ padding: "9px 16px" }}>
                      {(() => {
                        const ua = ultimaMap[a.id];
                        const isToday = ua === today;
                        return ua ? (
                          <span style={{ font: `500 0.75rem/1 ${fb}`, color: isToday ? "#22C55E" : t2, background: isToday ? "rgba(34,197,94,0.08)" : "transparent", padding: isToday ? "3px 8px" : "0", borderRadius: isToday ? 9999 : 0 }}>
                            {isToday ? "Hoy" : ua}
                          </span>
                        ) : <span style={{ color: t3 }}>—</span>;
                      })()}
                    </td>
                    <td style={{ padding: "13px 20px" }}>
                      <div style={{ display: "flex", alignItems: "center", gap: 2 }}>
                        <Tooltip content="Check-in manual">
                          <button onClick={() => openCheckinModal(a)} style={{ background: "none", border: "none", cursor: "pointer", color: t3, width: 30, height: 30, borderRadius: "50%", display: "flex", alignItems: "center", justifyContent: "center" }}
                            onMouseEnter={e => { (e.currentTarget as HTMLButtonElement).style.background = "#F4F5F9"; }}
                            onMouseLeave={e => { (e.currentTarget as HTMLButtonElement).style.background = "none"; }}
                          ><ClipboardCheck size={16} /></button>
                        </Tooltip>
                        {(() => {
                          const hasPhone = Boolean(a.phone);
                          const validPhone = isValidPhone(a.phone);
                          const tooltipMsg = !hasPhone ? "Sin teléfono" : !validPhone ? `Número inválido: "${a.phone}"` : "Enviar WhatsApp";
                          const iconColor = validPhone ? t3 : "#9CA3AF";
                          const iconOpacity = hasPhone && !validPhone ? 0.4 : hasPhone ? 1 : 0.3;
                          return (
                            <Tooltip content={tooltipMsg}>
                              <button
                                disabled={!validPhone}
                                onClick={() => validPhone && a.phone && openWhatsApp(a.phone, a.full_name)}
                                style={{ background: "none", border: hasPhone && !validPhone ? "1px solid rgba(239,68,68,0.3)" : "none", cursor: validPhone ? "pointer" : "default", color: iconColor, width: 30, height: 30, borderRadius: "50%", display: "flex", alignItems: "center", justifyContent: "center", opacity: iconOpacity, position: "relative" }}
                                onMouseEnter={e => { if (validPhone) (e.currentTarget as HTMLButtonElement).style.background = "#F4F5F9"; }}
                                onMouseLeave={e => { (e.currentTarget as HTMLButtonElement).style.background = "none"; }}
                              >
                                <svg width={16} height={16} viewBox="0 0 24 24" fill="currentColor"><path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347z"/><path d="M12 0C5.373 0 0 5.373 0 12c0 2.124.558 4.118 1.535 5.845L.057 23.5l5.828-1.528A11.945 11.945 0 0012 24c6.627 0 12-5.373 12-12S18.627 0 12 0zm0 21.882a9.877 9.877 0 01-5.032-1.374l-.36-.214-3.733.979.995-3.638-.235-.374A9.863 9.863 0 012.118 12C2.118 6.534 6.534 2.118 12 2.118S21.882 6.534 21.882 12 17.466 21.882 12 21.882z"/></svg>
                                {hasPhone && !validPhone && <span style={{ position: "absolute", top: 4, right: 4, width: 7, height: 7, borderRadius: "50%", background: "#EF4444", border: "1.5px solid white" }} />}
                              </button>
                            </Tooltip>
                          );
                        })()}
                        <Tooltip content="Cobrar cuota">
                          <button onClick={() => openPagoModal(a)} style={{ background: "none", border: "none", cursor: "pointer", color: t3, width: 30, height: 30, borderRadius: "50%", display: "flex", alignItems: "center", justifyContent: "center" }}
                            onMouseEnter={e => { (e.currentTarget as HTMLButtonElement).style.background = "#F4F5F9"; }}
                            onMouseLeave={e => { (e.currentTarget as HTMLButtonElement).style.background = "none"; }}
                          ><DollarSign size={16} /></button>
                        </Tooltip>
                        <Tooltip content="Más acciones">
                          <button onClick={e => { e.stopPropagation(); if (menuOpenId === a.id) { setMenuOpenId(null); setMenuPos(null); return; } const rect = (e.currentTarget as HTMLButtonElement).getBoundingClientRect(); setMenuPos({ top: rect.bottom + 4 > window.innerHeight - 180 ? rect.top - 4 : rect.bottom + 4, right: window.innerWidth - rect.right, openUp: rect.bottom + 4 > window.innerHeight - 180 }); setMenuOpenId(a.id); }} style={{ background: "none", border: "none", cursor: "pointer", color: t3, width: 30, height: 30, borderRadius: "50%", display: "flex", alignItems: "center", justifyContent: "center" }}
                            onMouseEnter={e => { (e.currentTarget as HTMLButtonElement).style.background = "#F4F5F9"; }}
                            onMouseLeave={e => { (e.currentTarget as HTMLButtonElement).style.background = "none"; }}
                          ><MoreVertical size={16} /></button>
                        </Tooltip>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "12px 20px", borderTop: "1px solid rgba(0,0,0,0.06)" }}>
            <span style={{ font: `400 0.78rem/1 ${fb}`, color: t3 }}>{loading ? "Cargando..." : `Mostrando ${lista.length} de ${totalCount} alumnos`}</span>
            <div style={{ position: "relative" }}>
              <button onClick={() => setExportMenuOpen(o => !o)}
                style={{ display: "flex", alignItems: "center", gap: 6, font: `500 0.78rem/1 ${fb}`, color: "#4B6BFB", background: "none", border: "1px solid rgba(75,107,251,0.2)", borderRadius: 8, padding: "6px 11px", cursor: "pointer" }}
                onMouseEnter={e => { (e.currentTarget as HTMLButtonElement).style.background = "rgba(75,107,251,0.06)"; }}
                onMouseLeave={e => { (e.currentTarget as HTMLButtonElement).style.background = "none"; }}
              ><Download size={13} /> Exportar</button>
              {exportMenuOpen && (
                <>
                  <div onClick={() => setExportMenuOpen(false)} style={{ position: "fixed", inset: 0, zIndex: 200 }} />
                  <div style={{ position: "absolute", bottom: "calc(100% + 6px)", right: 0, zIndex: 201, background: "#fff", border: "1px solid rgba(0,0,0,0.08)", borderRadius: 10, boxShadow: "0 8px 24px rgba(0,0,0,0.12)", minWidth: 140, overflow: "hidden" }}>
                    {[
                      { label: "Exportar CSV", action: () => { setExportMenuOpen(false); setExportConfirm(() => exportCSV); } },
                      { label: "Exportar PDF", action: () => { setExportMenuOpen(false); setExportConfirm(() => exportPDF); } },
                    ].map(item => (
                      <button key={item.label} onClick={item.action}
                        style={{ display: "block", width: "100%", textAlign: "left", padding: "10px 14px", background: "none", border: "none", font: `500 0.825rem/1 ${fb}`, color: t1, cursor: "pointer" }}
                        onMouseEnter={e => (e.currentTarget.style.background = "#F9FAFB")}
                        onMouseLeave={e => (e.currentTarget.style.background = "none")}
                      >{item.label}</button>
                    ))}
                  </div>
                </>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Card list — mobile */}
      {isMobile && (
        <div style={{ display: "flex", flexDirection: "column", gap: 7 }}>
          {loading ? (
            <p style={{ textAlign: "center", font: `400 0.85rem/1 ${fb}`, color: t3, padding: "32px 0" }}>Cargando...</p>
          ) : lista.length === 0 && alumnos.length > 0 ? (
            <p style={{ textAlign: "center", font: `400 0.85rem/1.5 ${fb}`, color: t3, padding: "40px 0" }}>Sin resultados.</p>
          ) : lista.length === 0 ? (
            <>
              {[
                { name: "Valentina Gómez", plan: "Full", color: "#6366F1", status: "Activo", statusColor: "#16A34A", statusBg: "rgba(22,163,74,0.08)" },
                { name: "Martín Rodríguez", plan: "Básico", color: "#F59E0B", status: "Activo", statusColor: "#16A34A", statusBg: "rgba(22,163,74,0.08)" },
              ].map((g, i) => (
                <div key={i} style={{ background: "white", borderRadius: 14, padding: "10px 12px", boxShadow: "0 1px 6px rgba(0,0,0,0.05)", border: "1px solid rgba(0,0,0,0.05)", opacity: i === 0 ? 0.5 : 0.25, filter: "blur(0.5px)", pointerEvents: "none", userSelect: "none" }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                    <div style={{ width: 34, height: 34, borderRadius: 10, background: "#1A1D23", display: "flex", alignItems: "center", justifyContent: "center", font: `700 0.62rem/1 ${fd}`, color: "white", flexShrink: 0 }}>{g.name.split(" ").map(w => w[0]).join("")}</div>
                    <div style={{ flex: 1 }}>
                      <p style={{ margin: 0, font: `700 0.84rem/1 ${fd}`, color: t1 }}>{g.name}</p>
                      <div style={{ display: "flex", gap: 6, marginTop: 5 }}>
                        <span style={{ font: `600 0.7rem/1 ${fb}`, color: g.color, background: `${g.color}18`, padding: "2px 8px", borderRadius: 9999 }}>{g.plan}</span>
                        <span style={{ font: `600 0.7rem/1 ${fb}`, color: g.statusColor, background: g.statusBg, padding: "2px 8px", borderRadius: 9999 }}>{g.status}</span>
                      </div>
                    </div>
                  </div>
                </div>
              ))}
              <div style={{ marginTop: 8, padding: "24px 20px", textAlign: "center", borderRadius: 14, border: "2px dashed rgba(255,106,0,0.25)", background: "rgba(255,106,0,0.02)" }}>
                <p style={{ margin: "0 0 6px", font: `600 0.9rem/1.4 ${fb}`, color: t1 }}>Todavía no tenés alumnos</p>
                <p style={{ margin: "0 0 14px", font: `400 0.78rem/1.5 ${fb}`, color: t3 }}>Agregá tu primer alumno a mano o importá desde Excel.</p>
                <button onClick={openModal} style={{ display: "inline-flex", alignItems: "center", gap: 6, background: "linear-gradient(135deg,#FF6A00,#e85d00)", border: "none", borderRadius: 10, padding: "9px 18px", font: `600 0.85rem/1 ${fb}`, color: "#fff", cursor: "pointer", boxShadow: "0 3px 12px rgba(255,106,0,0.3)" }}>
                  <Plus size={14}/> Agregar primer alumno
                </button>
              </div>
            </>
          ) : lista.map(a => {
            const planNombre = a.planes?.nombre ?? "—";
            const planColor  = a.planes?.accent_color ?? t2;
            const planBg     = a.planes?.accent_color ? `${a.planes.accent_color}18` : "#F0F2F8";
            const ua = ultimaMap[a.id];
            const isToday = ua === today;
            return (
              <div key={a.id} onClick={() => toggleSelect(a.id)} style={{ background: selectedIds.has(a.id) ? "rgba(255,106,0,0.04)" : "white", borderRadius: 14, padding: "10px 12px", boxShadow: "0 1px 6px rgba(0,0,0,0.05)", border: selectedIds.has(a.id) ? "1px solid rgba(255,106,0,0.25)" : "1px solid rgba(0,0,0,0.05)", cursor: "pointer" }}>
                {/* Row 1: avatar + name/plan + status */}
                <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 8 }}>
                  <input type="checkbox" checked={selectedIds.has(a.id)} onChange={() => toggleSelect(a.id)} onClick={e => e.stopPropagation()} style={{ width: 15, height: 15, cursor: "pointer", accentColor: "#FF6A00", flexShrink: 0 }} />
                  <div style={{ width: 34, height: 34, borderRadius: 10, background: "#1A1D23", display: "flex", alignItems: "center", justifyContent: "center", font: `700 0.62rem/1 ${fd}`, color: "white", flexShrink: 0 }}>{initials(a.full_name)}</div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <p style={{ margin: 0, font: `700 0.84rem/1 ${fd}`, color: t1, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{a.full_name}</p>
                    <div style={{ display: "flex", alignItems: "center", gap: 6, marginTop: 4 }}>
                      <span style={{ font: `600 0.62rem/1 ${fb}`, color: planColor, background: planBg, padding: "2px 7px", borderRadius: 9999, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis", maxWidth: 120 }}>{planNombre}</span>
                      {ua && <span style={{ font: `400 0.62rem/1 ${fb}`, color: isToday ? "#22C55E" : t3, flexShrink: 0 }}>{isToday ? "Hoy ✓" : ua}</span>}
                    </div>
                  </div>
                  <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-end", gap: 3, flexShrink: 0 }}>
                    <span style={{ font: `600 0.62rem/1 ${fb}`, color: STATUS_STYLE[a.status].color, background: STATUS_STYLE[a.status].bg, padding: "3px 8px", borderRadius: 9999 }}>{STATUS_STYLE[a.status].label}</span>
                    {a.deuda_pendiente > 0 && (
                      <span style={{ font: `600 0.58rem/1 ${fb}`, color: "#D97706", background: "rgba(217,119,6,0.1)", padding: "2px 6px", borderRadius: 6, whiteSpace: "nowrap" }}>
                        Debe ${a.deuda_pendiente.toLocaleString("es-AR")}
                      </span>
                    )}
                  </div>
                </div>
                {/* Row 2: action buttons — stopPropagation prevents toggling card selection */}
                <div style={{ display: "grid", gridTemplateColumns: "repeat(5, minmax(0, 1fr))", gap: 6 }}>
                  <button title="Check-in" onClick={e => { e.stopPropagation(); openCheckinModal(a); }} style={{ height: 34, borderRadius: 8, background: "rgba(34,197,94,0.1)", border: "none", display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer", color: "#22C55E" }}><ClipboardCheck size={14} /></button>
                  <button disabled={!a.phone} onClick={e => { e.stopPropagation(); a.phone && openWhatsApp(a.phone, a.full_name); }} style={{ height: 34, borderRadius: 8, background: "rgba(37,211,102,0.10)", border: "none", display: "flex", alignItems: "center", justifyContent: "center", cursor: a.phone ? "pointer" : "default", color: "#25D366", opacity: a.phone ? 1 : 0.3 }}>
                    <svg width={14} height={14} viewBox="0 0 24 24" fill="currentColor"><path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347z"/><path d="M12 0C5.373 0 0 5.373 0 12c0 2.124.558 4.118 1.535 5.845L.057 23.5l5.828-1.528A11.945 11.945 0 0012 24c6.627 0 12-5.373 12-12S18.627 0 12 0zm0 21.882a9.877 9.877 0 01-5.032-1.374l-.36-.214-3.733.979.995-3.638-.235-.374A9.863 9.863 0 012.118 12C2.118 6.534 6.534 2.118 12 2.118S21.882 6.534 21.882 12 17.466 21.882 12 21.882z"/></svg>
                  </button>
                  <button onClick={e => { e.stopPropagation(); openPagoModal(a); }} style={{ height: 34, borderRadius: 8, background: "rgba(75,107,251,0.08)", border: "none", display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer", color: "#4B6BFB" }}><DollarSign size={14} /></button>
                  <button title="Asignar Rutina" onClick={e => { e.stopPropagation(); openRutinaModal(a); }} style={{ height: 34, borderRadius: 8, background: "rgba(124,58,237,0.08)", border: "none", display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer", color: "#7C3AED" }}><Sparkles size={14} /></button>
                  <button onClick={e => { e.stopPropagation(); if (menuOpenId === a.id) { setMenuOpenId(null); setMenuPos(null); return; } const rect = (e.currentTarget as HTMLButtonElement).getBoundingClientRect(); setMenuPos({ top: rect.bottom + 4 > window.innerHeight - 180 ? rect.top - 4 : rect.bottom + 4, right: window.innerWidth - rect.right, openUp: rect.bottom + 4 > window.innerHeight - 180 }); setMenuOpenId(a.id); }} style={{ height: 34, borderRadius: 8, background: "#F4F5F9", border: "none", display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer", color: t3 }}><MoreVertical size={14} /></button>
                </div>
              </div>
            );
          })}
          <p style={{ textAlign: "center", font: `400 0.72rem/1 ${fb}`, color: t3, paddingTop: 4 }}>{lista.length} de {totalCount} alumnos</p>
        </div>
      )}
    </div>

    {/* ── Modal: Check-in manual ── */}
    {checkinTarget && (
      <div onClick={() => setCheckinTarget(null)} style={{ position: "fixed", inset: 0, zIndex: 9010, background: "rgba(0,0,0,0.5)", backdropFilter: "blur(6px)", display: "flex", alignItems: isMobile ? "flex-end" : "center", justifyContent: "center", padding: isMobile ? 0 : 20, paddingBottom: isMobile ? "calc(64px + env(safe-area-inset-bottom, 0px))" : undefined }}>
        <div onClick={e => e.stopPropagation()} style={{ background: "#FFFFFF", borderRadius: isMobile ? "20px 20px 0 0" : 20, padding: "28px 24px", maxWidth: isMobile ? "100%" : 380, width: "100%", boxShadow: "0 24px 60px rgba(0,0,0,0.18)" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 20 }}>
            <div style={{ width: 40, height: 40, borderRadius: 12, background: "rgba(34,197,94,0.1)", display: "flex", alignItems: "center", justifyContent: "center" }}><ClipboardCheck size={18} color="#22C55E" /></div>
            <div>
              <p style={{ font: `700 0.95rem/1 ${fd}`, color: t1 }}>Check-in manual</p>
              <p style={{ font: `400 0.72rem/1 ${fd}`, color: t3, marginTop: 2 }}>{checkinTarget.full_name}</p>
            </div>
          </div>
          <div style={{ marginBottom: 18 }}>
            <label style={{ font: `600 0.72rem/1 ${fd}`, color: t2, display: "block", marginBottom: 6, textTransform: "uppercase", letterSpacing: "0.06em" }}>Fecha</label>
            <input
              type="date"
              value={checkinDate}
              onChange={e => setCheckinDate(e.target.value)}
              style={{ width: "100%", padding: "10px 12px", border: "1px solid rgba(0,0,0,0.12)", borderRadius: 10, font: `400 0.875rem/1 ${fd}`, color: t1, outline: "none", boxSizing: "border-box" }}
            />
          </div>
          {checkinResult && checkinResult !== "ok" && (
            <p style={{ font: `400 0.78rem/1 ${fd}`, color: "#EF4444", marginBottom: 12 }}>{checkinResult}</p>
          )}
          {checkinResult === "ok" && (
            <p style={{ font: `600 0.82rem/1 ${fd}`, color: "#22C55E", marginBottom: 12 }}>Asistencia registrada ✓</p>
          )}
          <div style={{ display: "flex", gap: 10 }}>
            <button onClick={() => setCheckinTarget(null)} style={{ flex: 1, padding: "11px 0", borderRadius: 12, border: "1px solid rgba(0,0,0,0.1)", background: "none", font: `500 0.82rem/1 ${fd}`, color: t3, cursor: "pointer" }}>Cancelar</button>
            <button onClick={handleCheckin} disabled={checkinSaving} style={{ flex: 1, padding: "11px 0", borderRadius: 12, border: "none", background: "#22C55E", font: `700 0.82rem/1 ${fd}`, color: "white", cursor: "pointer", opacity: checkinSaving ? 0.6 : 1 }}>
              {checkinSaving ? "Guardando..." : "Registrar"}
            </button>
          </div>
        </div>
      </div>
    )}

    {/* ── Modal: Nuevo Alumno ── */}
    {modalOpen && (
      <div
        onClick={() => setModalOpen(false)}
        style={{
          position: "fixed", inset: 0, zIndex: 9010,
          background: "rgba(0,0,0,0.40)",
          backdropFilter: "blur(6px)",
          WebkitBackdropFilter: "blur(6px)",
          display: "flex", alignItems: isMobile ? "flex-end" : "center", justifyContent: "center",
          padding: isMobile ? 0 : 20,
          paddingBottom: isMobile ? "calc(64px + env(safe-area-inset-bottom, 0px))" : undefined,
        }}
      >
        <div
          onClick={e => e.stopPropagation()}
          style={{
            background: "#FFFFFF",
            borderRadius: isMobile ? "20px 20px 0 0" : 20,
            boxShadow: "0 24px 60px rgba(0,0,0,0.18), 0 0 0 1px rgba(0,0,0,0.06)",
            width: "100%", maxWidth: isMobile ? "100%" : 480,
            maxHeight: isMobile ? "calc(90vh - 64px)" : undefined,
            overflowY: "auto",
          }}
        >
          {/* Modal header */}
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "22px 24px 18px" }}>
            <div>
              <h2 style={{ font: `800 1.15rem/1 ${fd}`, color: t1, letterSpacing: "-0.01em" }}>Nuevo Alumno</h2>
              <p style={{ font: `400 0.78rem/1 ${fb}`, color: t3, marginTop: 4 }}>DNI, nombre y WhatsApp son los datos clave.</p>
            </div>
            <button
              onClick={() => setModalOpen(false)}
              style={{ width: 32, height: 32, borderRadius: "50%", background: "#F0F2F8", border: "none", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", color: t2, flexShrink: 0 }}
              onMouseEnter={e => { (e.currentTarget as HTMLButtonElement).style.background = "#E4E6EF"; }}
              onMouseLeave={e => { (e.currentTarget as HTMLButtonElement).style.background = "#F0F2F8"; }}
            >
              <X size={16} />
            </button>
          </div>

          <div style={{ height: 1, background: "rgba(0,0,0,0.06)", margin: "0 24px" }} />

          {/* Form */}
          <form onSubmit={handleSubmit} style={{ padding: "20px 24px 24px", display: "flex", flexDirection: "column", gap: 14 }}>

            {/* ── OBLIGATORIO: DNI ── */}
            <div>
              <label style={{ display: "block", font: `500 0.78rem/1 ${fb}`, color: t1, marginBottom: 6 }}>DNI *</label>
              <input
                required
                autoFocus
                value={form.dni}
                onChange={e => setForm(f => ({ ...f, dni: e.target.value.replace(/\D/g, "") }))}
                placeholder="Ej: 40123456"
                maxLength={9}
                style={{ width: "100%", padding: "11px 14px", background: "#F9FAFB", border: "1px solid rgba(0,0,0,0.09)", borderRadius: 10, font: `400 0.875rem/1 ${fb}`, color: t1, outline: "none", boxSizing: "border-box" as const, transition: "border-color 0.14s" }}
                onFocus={e => (e.currentTarget.style.borderColor = "#F97316")}
                onBlur={e => (e.currentTarget.style.borderColor = "rgba(0,0,0,0.09)")}
              />
              <p style={{ font: `400 0.7rem/1.3 ${fb}`, color: t3, marginTop: 6 }}>
                Necesario para que el alumno pueda recuperar acceso a la app.
              </p>
            </div>

            {/* ── OBLIGATORIO: Nombre ── */}
            <div>
              <label style={{ display: "block", font: `500 0.78rem/1 ${fb}`, color: t1, marginBottom: 6 }}>Nombre completo *</label>
              <div style={{ position: "relative" }}>
                <User size={14} style={{ position: "absolute", left: 13, top: "50%", transform: "translateY(-50%)", color: t3, pointerEvents: "none" }} />
                <input
                  required
                  value={form.full_name}
                  onChange={e => setForm(f => ({ ...f, full_name: e.target.value }))}
                  placeholder="Ej: Carlos Mendez"
                  maxLength={100}
                  style={{ width: "100%", padding: "11px 14px 11px 36px", background: "#F9FAFB", border: "1px solid rgba(0,0,0,0.09)", borderRadius: 10, font: `400 0.875rem/1 ${fb}`, color: t1, outline: "none", boxSizing: "border-box" as const, transition: "border-color 0.14s" }}
                  onFocus={e => (e.currentTarget.style.borderColor = "#F97316")}
                  onBlur={e => (e.currentTarget.style.borderColor = "rgba(0,0,0,0.09)")}
                />
              </div>
            </div>

            {/* ── OBLIGATORIO: Teléfono ── */}
            <div>
              <label style={{ display: "block", font: `500 0.78rem/1 ${fb}`, color: t1, marginBottom: 6 }}>
                Teléfono <span style={{ color: "#25D366", fontSize: "0.72rem" }}>· WhatsApp</span> *
              </label>
              <div style={{ position: "relative" }}>
                <Phone size={14} style={{ position: "absolute", left: 13, top: "50%", transform: "translateY(-50%)", color: t3, pointerEvents: "none" }} />
                <svg viewBox="0 0 24 24" fill="#25D366" width="14" height="14"
                  style={{ position: "absolute", right: 13, top: "50%", transform: "translateY(-50%)", pointerEvents: "none", opacity: 0.7 }}>
                  <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/>
                </svg>
                <input
                  required
                  type="tel"
                  value={form.phone}
                  onChange={e => setForm(f => ({ ...f, phone: e.target.value }))}
                  placeholder="5491112345678"
                  maxLength={30}
                  style={{ width: "100%", padding: "11px 36px 11px 36px", background: "#F9FAFB", border: "1px solid rgba(0,0,0,0.09)", borderRadius: 10, font: `400 0.875rem/1 ${fb}`, color: t1, outline: "none", boxSizing: "border-box" as const, transition: "border-color 0.14s" }}
                  onFocus={e => (e.currentTarget.style.borderColor = "#25D366")}
                  onBlur={e => (e.currentTarget.style.borderColor = "rgba(0,0,0,0.09)")}
                />
              </div>
            </div>

            {/* WA consent — aparece al escribir el teléfono */}
            {form.phone.trim() && (
              <label style={{ display: "flex", alignItems: "flex-start", gap: 10, cursor: "pointer" }}>
                <input
                  type="checkbox"
                  checked={form.wa_consent}
                  onChange={e => setForm(f => ({ ...f, wa_consent: e.target.checked }))}
                  style={{ marginTop: 2, flexShrink: 0, accentColor: "#25D366", width: 15, height: 15 }}
                />
                <span style={{ font: `400 0.75rem/1.45 ${fb}`, color: t2 }}>
                  Acepta recibir mensajes de WhatsApp (bienvenida y recordatorios).
                </span>
              </label>
            )}

            {/* ── QUICK ADD: Plan ── */}
            <div>
              <label style={{ display: "block", font: `500 0.78rem/1 ${fb}`, color: t1, marginBottom: 6 }}>
                Plan <span style={{ font: `400 0.72rem/1 ${fb}`, color: t3 }}>(opcional — podés asignarlo después)</span>
              </label>
              {planesLoading ? (
                <div style={{ padding: "11px 14px", background: "#F9FAFB", border: "1px solid rgba(0,0,0,0.09)", borderRadius: 10, font: `400 0.875rem/1 ${fb}`, color: t3 }}>
                  Cargando planes...
                </div>
              ) : (
                <select
                  value={form.plan_id}
                  onChange={e => setForm(f => ({ ...f, plan_id: e.target.value }))}
                  style={{ width: "100%", padding: "11px 14px", background: "#F9FAFB", border: "1px solid rgba(0,0,0,0.09)", borderRadius: 10, font: `400 0.875rem/1 ${fb}`, color: form.plan_id ? t1 : t3, outline: "none", boxSizing: "border-box" as const, cursor: "pointer" }}
                >
                  <option value="">Sin plan — asignar después</option>
                  {planes.map(p => (
                    <option key={p.id} value={p.id}>
                      {p.nombre}{p.precio ? ` · $${p.precio.toLocaleString("es-AR")}` : ""}
                    </option>
                  ))}
                </select>
              )}
            </div>

            {/* ── Toggle: Más detalles ── */}
            <button
              type="button"
              onClick={() => setShowDetails(d => !d)}
              style={{ display: "flex", alignItems: "center", gap: 6, background: "none", border: "none", cursor: "pointer", padding: "2px 0", font: `500 0.78rem/1 ${fb}`, color: t3, textAlign: "left", width: "fit-content" }}
            >
              <span style={{ fontSize: "0.65rem", transition: "transform 0.15s", display: "inline-block", transform: showDetails ? "rotate(90deg)" : "rotate(0deg)" }}>▶</span>
              {showDetails ? "Menos detalles" : "Más detalles"} — fecha de nacimiento, email
            </button>

            {/* ── DETALLES OPCIONALES ── */}
            {showDetails && (
              <>
                <div>
                  <label style={{ display: "block", font: `500 0.78rem/1 ${fb}`, color: t1, marginBottom: 6 }}>Fecha de nacimiento <span style={{ color: t3, fontWeight: 400 }}>(opcional · saludo de cumple)</span></label>
                  <input
                    type="date"
                    value={form.fecha_nacimiento}
                    onChange={e => setForm(f => ({ ...f, fecha_nacimiento: e.target.value }))}
                    style={{ width: "100%", padding: "11px 14px", background: "#F9FAFB", border: "1px solid rgba(0,0,0,0.09)", borderRadius: 10, font: `400 0.875rem/1 ${fb}`, color: t1, outline: "none", boxSizing: "border-box" as const, transition: "border-color 0.14s" }}
                    onFocus={e => (e.currentTarget.style.borderColor = "#F97316")}
                    onBlur={e => (e.currentTarget.style.borderColor = "rgba(0,0,0,0.09)")}
                  />
                </div>

                <div>
                  <label style={{ display: "block", font: `500 0.78rem/1 ${fb}`, color: t1, marginBottom: 6 }}>Email <span style={{ color: t3, fontWeight: 400 }}>(opcional)</span></label>
                  <div style={{ position: "relative" }}>
                    <Mail size={14} style={{ position: "absolute", left: 13, top: "50%", transform: "translateY(-50%)", color: t3, pointerEvents: "none" }} />
                    <input
                      type="email"
                      value={form.email}
                      onChange={e => setForm(f => ({ ...f, email: e.target.value }))}
                      placeholder="carlos@email.com"
                      maxLength={255}
                      style={{ width: "100%", padding: "11px 14px 11px 36px", background: "#F9FAFB", border: "1px solid rgba(0,0,0,0.09)", borderRadius: 10, font: `400 0.875rem/1 ${fb}`, color: t1, outline: "none", boxSizing: "border-box" as const, transition: "border-color 0.14s" }}
                      onFocus={e => (e.currentTarget.style.borderColor = "#F97316")}
                      onBlur={e => (e.currentTarget.style.borderColor = "rgba(0,0,0,0.09)")}
                    />
                  </div>
                </div>
              </>
            )}

            {/* Error */}
            {formError && (
              <div style={{ background: "rgba(220,38,38,0.07)", border: "1px solid rgba(220,38,38,0.18)", borderRadius: 9, padding: "10px 14px", font: `400 0.8rem/1.4 ${fb}`, color: "#DC2626" }}>
                {formError}
              </div>
            )}

            {/* Submit */}
            <button
              type="submit"
              disabled={saving}
              style={{
                width: "100%", padding: "13px",
                background: saving ? "#9CA3AF" : "#F54A38",
                color: "white", border: "none", borderRadius: 12,
                font: `700 0.95rem/1 ${fd}`,
                cursor: saving ? "not-allowed" : "pointer",
                boxShadow: saving ? "none" : "0 4px 16px rgba(245,74,56,0.30)",
                transition: "opacity 0.14s, box-shadow 0.14s",
                marginTop: 4,
                letterSpacing: "0.01em",
              }}
              onMouseEnter={e => { if (!saving) (e.currentTarget.style.opacity = "0.92"); }}
              onMouseLeave={e => (e.currentTarget.style.opacity = "1")}
            >
              {saving ? "Registrando..." : "Registrar Alumno"}
            </button>
          </form>
        </div>
      </div>
    )}

    {csvImportOpen && gymId && (
      <div
        onClick={() => setCsvImportOpen(false)}
        style={{
          position: "fixed", inset: 0, zIndex: 9010,
          background: "rgba(0,0,0,0.40)",
          backdropFilter: "blur(6px)",
          WebkitBackdropFilter: "blur(6px)",
          display: "flex", alignItems: isMobile ? "flex-end" : "center", justifyContent: "center",
          padding: isMobile ? 0 : 20,
          paddingBottom: isMobile ? "calc(64px + env(safe-area-inset-bottom, 0px))" : undefined,
        }}
      >
        <div
          onClick={(e) => e.stopPropagation()}
          style={{
            background: "#FFFFFF",
            borderRadius: isMobile ? "20px 20px 0 0" : 20,
            boxShadow: "0 24px 60px rgba(0,0,0,0.18), 0 0 0 1px rgba(0,0,0,0.06)",
            width: "100%", maxWidth: isMobile ? "100%" : 560,
            maxHeight: isMobile ? "calc(90vh - 64px)" : "88vh",
            overflowY: "auto",
          }}
        >
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "22px 24px 18px" }}>
            <div>
              <h2 style={{ font: `800 1.15rem/1 ${fd}`, color: t1, letterSpacing: "-0.01em" }}>Importar Alumnos</h2>
              <p style={{ font: `400 0.78rem/1.4 ${fb}`, color: t3, marginTop: 4 }}>Subí un CSV para cargar varios alumnos sin salir de esta pantalla.</p>
            </div>
            <button
              onClick={() => setCsvImportOpen(false)}
              style={{ width: 32, height: 32, borderRadius: "50%", background: "#F0F2F8", border: "none", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", color: t2, flexShrink: 0 }}
            >
              <X size={16} />
            </button>
          </div>

          <div style={{ height: 1, background: "rgba(0,0,0,0.06)", margin: "0 24px" }} />

          <div style={{ padding: "20px 24px 24px" }}>
            <CsvAlumnosImportContent
              gymId={gymId}
              gymPlanType={gymPlanType}
              currentAlumnoCount={alumnos.length}
              onImported={async (count) => {
                setCsvImportOpen(false);
                await fetchAlumnos(true);
                setToast(`✓ ${count} alumnos importados`);
                setTimeout(() => setToast(null), 3000);
              }}
              onSecondaryAction={() => setCsvImportOpen(false)}
              secondaryLabel="Cancelar"
              confirmLabel="Importar alumnos"
            />
          </div>
        </div>
      </div>
    )}

    {/* ── Portal: More Actions dropdown ── */}
    {menuTarget && menuPos && portalRoot && createPortal(
      <div onClick={e => e.stopPropagation()} style={{ position: "fixed", ...(menuPos.openUp ? { bottom: window.innerHeight - menuPos.top } : { top: menuPos.top }), right: menuPos.right, zIndex: 9999, background: "#FFFFFF", border: "1px solid rgba(0,0,0,0.08)", borderRadius: 10, boxShadow: "0 8px 24px rgba(0,0,0,0.12)", minWidth: 178, overflow: "hidden" }}>
        {[
          { label: "Ver Historial", isDanger: false, action: () => { openFicha(menuTarget); setMenuOpenId(null); setMenuPos(null); } },
          { label: "Editar Datos", isDanger: false, action: () => { openEditModal(menuTarget); setMenuOpenId(null); setMenuPos(null); } },
          { label: "Reenviar link de acceso", isDanger: false, action: () => { handleSendWelcome(menuTarget); } },
          { label: "Asignar Membresía", isDanger: false, action: () => { openMembresiaModal(menuTarget); setMenuOpenId(null); setMenuPos(null); } },
          ...(["vencido", "pendiente"].includes(menuTarget.status) ? [{ label: "Reactivar", isDanger: false, action: () => { openReactivarModal(menuTarget); setMenuOpenId(null); setMenuPos(null); } }] : []),
          { label: "Asignar Rutina", isDanger: false, action: () => { openRutinaModal(menuTarget); setMenuOpenId(null); setMenuPos(null); } },
          { label: "Enviar link de pago", isDanger: false, action: () => { handleSendPayLink(menuTarget); } },
          menuTarget.status === "pausado"
            ? { label: "Descongelar", isDanger: false, action: () => { handleDescongelar(menuTarget); setMenuOpenId(null); setMenuPos(null); } }
            : { label: "Congelar Membresía", isDanger: false, action: () => { setFreezeTarget(menuTarget); setFreezeDias("15"); setMenuOpenId(null); setMenuPos(null); } },
          { label: "", isDanger: false, isSeparator: true, action: () => {} },
          { label: "Eliminar Alumno", isDanger: true, action: () => { handleEliminar(menuTarget.id, menuTarget.full_name); setMenuOpenId(null); setMenuPos(null); } },
        ].map(item => (
          item.isSeparator ? (
            <div key="separator" style={{ height: 1, background: "#E6E8EC", margin: "6px 0" }} />
          ) : (
          <button key={item.label} onClick={item.action}
            style={{ display: "block", width: "100%", textAlign: "left", padding: "10px 14px", background: "none", border: "none", font: `500 0.825rem/1 ${fb}`, color: item.isDanger ? "#DC2626" : t1, cursor: "pointer" }}
            onMouseEnter={e => (e.currentTarget.style.background = "#FFF4ED", e.currentTarget.style.color = "#F97316")}
            onMouseLeave={e => (e.currentTarget.style.background = "none", e.currentTarget.style.color = item.isDanger ? "#DC2626" : t1)}
          >{item.label}</button>
          )
        ))}
      </div>,
      portalRoot
    )}

    {/* ── Modal: Editar Alumno ── */}
    {editModalOpen && (
      <div onClick={() => setEditModalOpen(false)} style={{ position: "fixed", inset: 0, zIndex: 9010, background: "rgba(0,0,0,0.40)", backdropFilter: "blur(6px)", WebkitBackdropFilter: "blur(6px)", display: "flex", alignItems: isMobile ? "flex-end" : "center", justifyContent: "center", padding: isMobile ? 0 : 20, paddingBottom: isMobile ? "calc(64px + env(safe-area-inset-bottom, 0px))" : undefined }}>
        <div onClick={e => e.stopPropagation()} style={{ background: "#FFFFFF", borderRadius: isMobile ? "20px 20px 0 0" : 20, boxShadow: "0 24px 60px rgba(0,0,0,0.18), 0 0 0 1px rgba(0,0,0,0.06)", width: "100%", maxWidth: isMobile ? "100%" : 480, maxHeight: isMobile ? "calc(90vh - 64px)" : undefined, overflowY: "auto" }}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "22px 24px 18px" }}>
            <div>
              <h2 style={{ font: `800 1.15rem/1 ${fd}`, color: t1, letterSpacing: "-0.01em" }}>Editar Alumno</h2>
              <p style={{ font: `400 0.78rem/1 ${fb}`, color: t3, marginTop: 4 }}>Modificá los datos del miembro.</p>
            </div>
            <button onClick={() => setEditModalOpen(false)} style={{ width: 32, height: 32, borderRadius: "50%", background: "#F0F2F8", border: "none", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", color: t2, flexShrink: 0 }}
              onMouseEnter={e => { (e.currentTarget as HTMLButtonElement).style.background = "#E4E6EF"; }}
              onMouseLeave={e => { (e.currentTarget as HTMLButtonElement).style.background = "#F0F2F8"; }}
            ><X size={16} /></button>
          </div>
          <div style={{ height: 1, background: "rgba(0,0,0,0.06)", margin: "0 24px" }} />
          <form onSubmit={handleEditSave} style={{ padding: "20px 24px 24px", display: "flex", flexDirection: "column", gap: 16 }}>
            <div>
              <label style={{ display: "block", font: `500 0.78rem/1 ${fb}`, color: t1, marginBottom: 6 }}>Nombre completo *</label>
              <div style={{ position: "relative" }}>
                <User size={14} style={{ position: "absolute", left: 13, top: "50%", transform: "translateY(-50%)", color: t3, pointerEvents: "none" }} />
                <input required value={editForm.full_name} onChange={e => setEditForm(f => ({ ...f, full_name: e.target.value }))}
                  maxLength={100}
                  style={{ width: "100%", padding: "11px 14px 11px 36px", background: "#F9FAFB", border: "1px solid rgba(0,0,0,0.09)", borderRadius: 10, font: `400 0.875rem/1 ${fb}`, color: t1, outline: "none", boxSizing: "border-box" as const }}
                  onFocus={e => (e.currentTarget.style.borderColor = "#F97316")}
                  onBlur={e => (e.currentTarget.style.borderColor = "rgba(0,0,0,0.09)")}
                />
              </div>
            </div>
            <div>
              <label style={{ display: "block", font: `500 0.78rem/1 ${fb}`, color: t1, marginBottom: 6 }}>Teléfono <span style={{ color: "#25D366", fontSize: "0.72rem" }}>· WhatsApp</span></label>
              <div style={{ position: "relative" }}>
                <Phone size={14} style={{ position: "absolute", left: 13, top: "50%", transform: "translateY(-50%)", color: t3, pointerEvents: "none" }} />
                <input type="tel" value={editForm.phone} onChange={e => setEditForm(f => ({ ...f, phone: e.target.value }))} placeholder="5491112345678"
                  maxLength={30}
                  style={{ width: "100%", padding: "11px 14px 11px 36px", background: "#F9FAFB", border: "1px solid rgba(0,0,0,0.09)", borderRadius: 10, font: `400 0.875rem/1 ${fb}`, color: t1, outline: "none", boxSizing: "border-box" as const }}
                  onFocus={e => (e.currentTarget.style.borderColor = "#25D366")}
                  onBlur={e => (e.currentTarget.style.borderColor = "rgba(0,0,0,0.09)")}
                />
              </div>
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
              <div>
                <label style={{ display: "block", font: `500 0.78rem/1 ${fb}`, color: t1, marginBottom: 6 }}>Plan</label>
                <div style={{ position: "relative" }}>
                  {planesLoading ? (
                    <div style={{ padding: "11px 14px", background: "#F9FAFB", border: "1px solid rgba(0,0,0,0.09)", borderRadius: 10, font: `400 0.875rem/1 ${fb}`, color: t3 }}>Cargando...</div>
                  ) : (
                    <>
                      <select value={editForm.plan_id} onChange={e => setEditForm(f => ({ ...f, plan_id: e.target.value }))}
                        style={{ width: "100%", padding: "11px 14px", background: "#F9FAFB", border: "1px solid rgba(0,0,0,0.09)", borderRadius: 10, font: `500 0.875rem/1 ${fb}`, color: t1, outline: "none", appearance: "none", cursor: "pointer", boxSizing: "border-box" as const }}
                        onFocus={e => (e.currentTarget.style.borderColor = "#F97316")}
                        onBlur={e => (e.currentTarget.style.borderColor = "rgba(0,0,0,0.09)")}
                      >
                        <option value="">Sin plan</option>
                        {planes.map(p => <option key={p.id} value={p.id}>{p.nombre} — ${p.precio}/{p.periodo}</option>)}
                      </select>
                      <svg viewBox="0 0 20 20" fill={t3} width="14" height="14" style={{ position: "absolute", right: 12, top: "50%", transform: "translateY(-50%)", pointerEvents: "none" }}><path fillRule="evenodd" d="M5.293 7.293a1 1 0 011.414 0L10 10.586l3.293-3.293a1 1 0 111.414 1.414l-4 4a1 1 0 01-1.414 0l-4-4a1 1 0 010-1.414z" clipRule="evenodd" /></svg>
                    </>
                  )}
                </div>
              </div>
              <div>
                <label style={{ display: "block", font: `500 0.78rem/1 ${fb}`, color: t1, marginBottom: 6 }}>Fecha Vencimiento</label>
                <div style={{ position: "relative" }}>
                  <CalendarDays size={14} style={{ position: "absolute", left: 12, top: "50%", transform: "translateY(-50%)", color: t3, pointerEvents: "none" }} />
                  <input type="date" value={editForm.next_expiration_date} onChange={e => setEditForm(f => ({ ...f, next_expiration_date: e.target.value }))}
                    style={{ width: "100%", padding: "11px 14px 11px 34px", background: "#F9FAFB", border: "1px solid rgba(0,0,0,0.09)", borderRadius: 10, font: `400 0.875rem/1 ${fb}`, color: editForm.next_expiration_date ? t1 : t3, outline: "none", boxSizing: "border-box" as const }}
                    onFocus={e => (e.currentTarget.style.borderColor = "#F97316")}
                    onBlur={e => (e.currentTarget.style.borderColor = "rgba(0,0,0,0.09)")}
                  />
                </div>
              </div>
            </div>
            {editForm.plan_id && editForm.plan_id !== editOriginalPlanId && editForm.next_expiration_date && (() => {
              const newPlan = planes.find(p => p.id === editForm.plan_id);
              const previewDate = newPlan ? (() => {
                const base = new Date(); base.setHours(12, 0, 0, 0);
                const PM: Record<string, number> = { mes: 1, mensual: 1, trimestral: 3, anual: 12, año: 12 };
                const PD: Record<string, number> = { semanal: 7, semana: 7 };
                const per = newPlan.periodo ?? "mensual";
                let exp: Date;
                if (newPlan.duracion_dias > 0) { exp = new Date(base); exp.setDate(exp.getDate() + newPlan.duracion_dias); }
                else if (PM[per]) { exp = addMonths(base, PM[per]); }
                else { exp = new Date(base); exp.setDate(exp.getDate() + (PD[per] ?? 30)); }
                return exp.toLocaleDateString("es-AR", { day: "2-digit", month: "2-digit", year: "numeric" });
              })() : "—";
              return (
                <div style={{ background: "rgba(249,115,22,0.06)", border: "1px solid rgba(249,115,22,0.22)", borderRadius: 10, padding: "12px 14px" }}>
                  <p style={{ font: `600 0.78rem/1 ${fb}`, color: "#92400E", marginBottom: 10 }}>¿Cuándo aplicar el plan nuevo?</p>
                  <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                    <label style={{ display: "flex", alignItems: "flex-start", gap: 9, cursor: "pointer" }}>
                      <input type="radio" name="planPolicy" value="at_expiry" checked={planChangePolicy === "at_expiry"} onChange={() => setPlanChangePolicy("at_expiry")} style={{ marginTop: 2, accentColor: "#F97316" }} />
                      <span style={{ font: `400 0.82rem/1.4 ${fb}`, color: t1 }}>Al vencer — la fecha actual se respeta <span style={{ color: t3 }}>({editForm.next_expiration_date})</span></span>
                    </label>
                    <label style={{ display: "flex", alignItems: "flex-start", gap: 9, cursor: "pointer" }}>
                      <input type="radio" name="planPolicy" value="now" checked={planChangePolicy === "now"} onChange={() => setPlanChangePolicy("now")} style={{ marginTop: 2, accentColor: "#F97316" }} />
                      <span style={{ font: `400 0.82rem/1.4 ${fb}`, color: t1 }}>Ahora — nueva fecha calculada <span style={{ color: t3 }}>({previewDate})</span></span>
                    </label>
                  </div>
                </div>
              );
            })()}
            {editError && (
              <div style={{ background: "rgba(220,38,38,0.07)", border: "1px solid rgba(220,38,38,0.18)", borderRadius: 9, padding: "10px 14px", font: `400 0.8rem/1.4 ${fb}`, color: "#DC2626" }}>{editError}</div>
            )}
            <button type="submit" disabled={editSaving}
              style={{ width: "100%", padding: "13px", background: editSaving ? "#9CA3AF" : "#F54A38", color: "white", border: "none", borderRadius: 12, font: `700 0.95rem/1 ${fd}`, cursor: editSaving ? "not-allowed" : "pointer", boxShadow: editSaving ? "none" : "0 4px 16px rgba(245,74,56,0.30)", marginTop: 4 }}
              onMouseEnter={e => { if (!editSaving) (e.currentTarget.style.opacity = "0.92"); }}
              onMouseLeave={e => (e.currentTarget.style.opacity = "1")}
            >{editSaving ? "Guardando..." : "Guardar Cambios"}</button>
          </form>
        </div>
      </div>
    )}
    {/* ── Modal: Asignar Membresía ── */}
    {(membresiaTarget || bulkMembresiaOpen) && (
      <div onClick={() => { setMembresiaTarget(null); setBulkMembresiaOpen(false); setBulkMembresiaIds([]); }} style={{ position: "fixed", inset: 0, zIndex: 9010, background: "rgba(0,0,0,0.40)", backdropFilter: "blur(6px)", WebkitBackdropFilter: "blur(6px)", display: "flex", alignItems: isMobile ? "flex-end" : "center", justifyContent: "center", padding: isMobile ? 0 : 20, paddingBottom: isMobile ? "calc(64px + env(safe-area-inset-bottom, 0px))" : undefined }}>
        <div onClick={e => e.stopPropagation()} style={{ background: "#FFFFFF", borderRadius: isMobile ? "20px 20px 0 0" : 20, boxShadow: "0 24px 60px rgba(0,0,0,0.18), 0 0 0 1px rgba(0,0,0,0.06)", width: "100%", maxWidth: isMobile ? "100%" : 420, overflowY: "auto" }}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "22px 24px 18px" }}>
            <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
              <div style={{ width: 38, height: 38, borderRadius: 11, background: "rgba(255,106,0,0.1)", display: "flex", alignItems: "center", justifyContent: "center" }}>
                <Star size={18} color="#FF6A00" />
              </div>
              <div>
                <h2 style={{ font: `800 1.05rem/1 ${fd}`, color: t1, letterSpacing: "-0.01em" }}>Asignar Membresía</h2>
                <p style={{ font: `400 0.75rem/1 ${fb}`, color: t3, marginTop: 3 }}>
                  {bulkMembresiaOpen ? `${bulkMembresiaIds.length} alumno${bulkMembresiaIds.length !== 1 ? "s" : ""} seleccionado${bulkMembresiaIds.length !== 1 ? "s" : ""}` : membresiaTarget?.full_name}
                </p>
              </div>
            </div>
            <button onClick={() => { setMembresiaTarget(null); setBulkMembresiaOpen(false); setBulkMembresiaIds([]); }} style={{ width: 32, height: 32, borderRadius: "50%", background: "#F0F2F8", border: "none", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", color: t2, flexShrink: 0 }}
              onMouseEnter={e => { (e.currentTarget as HTMLButtonElement).style.background = "#E4E6EF"; }}
              onMouseLeave={e => { (e.currentTarget as HTMLButtonElement).style.background = "#F0F2F8"; }}
            ><X size={16} /></button>
          </div>
          <div style={{ height: 1, background: "rgba(0,0,0,0.06)", margin: "0 24px" }} />
          <form onSubmit={handleMembresiaSubmit} style={{ padding: "20px 24px 24px", display: "flex", flexDirection: "column", gap: 16 }}>
            <div>
              <label style={{ display: "block", font: `500 0.78rem/1 ${fb}`, color: t1, marginBottom: 6 }}>Plan</label>
              <div style={{ position: "relative" }}>
                {planesLoading ? (
                  <div style={{ padding: "11px 14px", background: "#F9FAFB", border: "1px solid rgba(0,0,0,0.09)", borderRadius: 10, font: `400 0.875rem/1 ${fb}`, color: t3 }}>Cargando planes...</div>
                ) : (
                  <>
                    <select value={membresiaPlanId} onChange={e => setMembresiaPlanId(e.target.value)}
                      style={{ width: "100%", padding: "11px 14px", background: "#F9FAFB", border: "1px solid rgba(0,0,0,0.09)", borderRadius: 10, font: `500 0.875rem/1 ${fb}`, color: t1, outline: "none", appearance: "none", cursor: "pointer", boxSizing: "border-box" as const }}
                      onFocus={e => (e.currentTarget.style.borderColor = "#FF6A00")}
                      onBlur={e => (e.currentTarget.style.borderColor = "rgba(0,0,0,0.09)")}
                    >
                      <option value="">Sin plan</option>
                      {planes.map(p => <option key={p.id} value={p.id}>{p.nombre} — ${p.precio}/{p.periodo}</option>)}
                    </select>
                    <svg viewBox="0 0 20 20" fill={t3} width="14" height="14" style={{ position: "absolute", right: 12, top: "50%", transform: "translateY(-50%)", pointerEvents: "none" }}><path fillRule="evenodd" d="M5.293 7.293a1 1 0 011.414 0L10 10.586l3.293-3.293a1 1 0 111.414 1.414l-4 4a1 1 0 01-1.414 0l-4-4a1 1 0 010-1.414z" clipRule="evenodd" /></svg>
                  </>
                )}
              </div>
            </div>
            <div>
              <label style={{ display: "block", font: `500 0.78rem/1 ${fb}`, color: t1, marginBottom: 6 }}>Fecha de vencimiento</label>
              <div style={{ position: "relative" }}>
                <CalendarDays size={14} style={{ position: "absolute", left: 12, top: "50%", transform: "translateY(-50%)", color: t3, pointerEvents: "none" }} />
                <input type="date" value={membresiaFecha} onChange={e => setMembresiaFecha(e.target.value)}
                  style={{ width: "100%", padding: "11px 14px 11px 34px", background: "#F9FAFB", border: "1px solid rgba(0,0,0,0.09)", borderRadius: 10, font: `400 0.875rem/1 ${fb}`, color: membresiaFecha ? t1 : t3, outline: "none", boxSizing: "border-box" as const }}
                  onFocus={e => (e.currentTarget.style.borderColor = "#FF6A00")}
                  onBlur={e => (e.currentTarget.style.borderColor = "rgba(0,0,0,0.09)")}
                />
              </div>
            </div>
            {membresiaError && (
              <div style={{ background: "rgba(220,38,38,0.07)", border: "1px solid rgba(220,38,38,0.18)", borderRadius: 9, padding: "10px 14px", font: `400 0.8rem/1.4 ${fb}`, color: "#DC2626" }}>{membresiaError}</div>
            )}
            <button type="submit" disabled={membresiaSaving}
              style={{ width: "100%", padding: "13px", background: membresiaSaving ? "#9CA3AF" : "#FF6A00", color: "white", border: "none", borderRadius: 12, font: `700 0.95rem/1 ${fd}`, cursor: membresiaSaving ? "not-allowed" : "pointer", boxShadow: membresiaSaving ? "none" : "0 4px 16px rgba(255,106,0,0.28)", marginTop: 4 }}
              onMouseEnter={e => { if (!membresiaSaving) (e.currentTarget.style.opacity = "0.92"); }}
              onMouseLeave={e => (e.currentTarget.style.opacity = "1")}
            >{membresiaSaving ? "Guardando..." : "Asignar Membresía"}</button>
          </form>
        </div>
      </div>
    )}

    {/* ── Modal: Reactivar Alumno ── */}
    {reactivarTarget && (
      <div onClick={() => setReactivarTarget(null)} style={{ position: "fixed", inset: 0, zIndex: 9010, background: "rgba(0,0,0,0.40)", backdropFilter: "blur(6px)", WebkitBackdropFilter: "blur(6px)", display: "flex", alignItems: isMobile ? "flex-end" : "center", justifyContent: "center", padding: isMobile ? 0 : 20, paddingBottom: isMobile ? "calc(64px + env(safe-area-inset-bottom, 0px))" : undefined }}>
        <div onClick={e => e.stopPropagation()} style={{ background: "#FFFFFF", borderRadius: isMobile ? "20px 20px 0 0" : 20, boxShadow: "0 24px 60px rgba(0,0,0,0.18), 0 0 0 1px rgba(0,0,0,0.06)", width: "100%", maxWidth: isMobile ? "100%" : 420, overflowY: "auto" }}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "22px 24px 18px" }}>
            <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
              <div style={{ width: 38, height: 38, borderRadius: 11, background: "rgba(22,163,74,0.1)", display: "flex", alignItems: "center", justifyContent: "center", font: "1.2rem/1 sans-serif" }}>♻️</div>
              <div>
                <h2 style={{ font: `800 1.05rem/1 ${fd}`, color: t1, letterSpacing: "-0.01em" }}>Reactivar Membresía</h2>
                <p style={{ font: `400 0.75rem/1 ${fb}`, color: t3, marginTop: 3 }}>{reactivarTarget.full_name}</p>
              </div>
            </div>
            <button onClick={() => setReactivarTarget(null)} style={{ width: 32, height: 32, borderRadius: "50%", background: "#F0F2F8", border: "none", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", color: t2, flexShrink: 0 }}
              onMouseEnter={e => { (e.currentTarget as HTMLButtonElement).style.background = "#E4E6EF"; }}
              onMouseLeave={e => { (e.currentTarget as HTMLButtonElement).style.background = "#F0F2F8"; }}
            ><X size={16} /></button>
          </div>
          <div style={{ height: 1, background: "rgba(0,0,0,0.06)", margin: "0 24px" }} />
          {reactivarTarget.next_expiration_date && reactivarTarget.next_expiration_date > today && (
            <div style={{ margin: "16px 24px 0", background: "rgba(59,130,246,0.07)", border: "1px solid rgba(59,130,246,0.22)", borderRadius: 10, padding: "12px 14px", display: "flex", gap: 10, alignItems: "flex-start" }}>
              <span style={{ fontSize: "1rem", flexShrink: 0 }}>📅</span>
              <p style={{ font: `400 0.8rem/1.45 ${fb}`, color: "#1D4ED8", margin: 0 }}>
                Se detectó una membresía vigente. El nuevo período se sumará a partir del{" "}
                <strong>{new Date(reactivarTarget.next_expiration_date + "T12:00:00").toLocaleDateString("es-AR", { day: "numeric", month: "long", year: "numeric" })}</strong>.
              </p>
            </div>
          )}
          {reactivarTarget.deuda_pendiente > 0 && (
            <div style={{ margin: "16px 24px 0", background: "rgba(217,119,6,0.07)", border: "1px solid rgba(217,119,6,0.25)", borderRadius: 10, padding: "12px 14px", display: "flex", gap: 10, alignItems: "flex-start" }}>
              <span style={{ fontSize: "1rem", flexShrink: 0 }}>⚠️</span>
              <div>
                <p style={{ font: `600 0.82rem/1.3 ${fb}`, color: "#92400E", margin: 0 }}>
                  Este alumno tiene una deuda pendiente de <strong>${reactivarTarget.deuda_pendiente.toLocaleString("es-AR")}</strong>
                </p>
                <p style={{ font: `400 0.74rem/1.3 ${fb}`, color: "#B45309", margin: "4px 0 0" }}>
                  Podés saldarlo ahora o cobrarlo después desde Registrar Pago.
                </p>
              </div>
            </div>
          )}
          <form onSubmit={handleReactivarSubmit} style={{ padding: "20px 24px 24px", display: "flex", flexDirection: "column", gap: 16 }}>
            <div>
              <label style={{ display: "block", font: `500 0.78rem/1 ${fb}`, color: t1, marginBottom: 6 }}>Plan</label>
              <div style={{ position: "relative" }}>
                {planesLoading ? (
                  <div style={{ padding: "11px 14px", background: "#F9FAFB", border: "1px solid rgba(0,0,0,0.09)", borderRadius: 10, font: `400 0.875rem/1 ${fb}`, color: t3 }}>Cargando planes...</div>
                ) : (
                  <>
                    <select value={reactivarPlanId} onChange={e => setReactivarPlanId(e.target.value)}
                      style={{ width: "100%", padding: "11px 14px", background: "#F9FAFB", border: "1px solid rgba(0,0,0,0.09)", borderRadius: 10, font: `500 0.875rem/1 ${fb}`, color: t1, outline: "none", appearance: "none", cursor: "pointer", boxSizing: "border-box" as const }}
                      onFocus={e => (e.currentTarget.style.borderColor = "#16A34A")}
                      onBlur={e => (e.currentTarget.style.borderColor = "rgba(0,0,0,0.09)")}
                    >
                      <option value="">Sin plan</option>
                      {planes.map(p => <option key={p.id} value={p.id}>{p.nombre} — ${p.precio}/{p.periodo} ({p.duracion_dias}d)</option>)}
                    </select>
                    <svg viewBox="0 0 20 20" fill={t3} width="14" height="14" style={{ position: "absolute", right: 12, top: "50%", transform: "translateY(-50%)", pointerEvents: "none" }}><path fillRule="evenodd" d="M5.293 7.293a1 1 0 011.414 0L10 10.586l3.293-3.293a1 1 0 111.414 1.414l-4 4a1 1 0 01-1.414 0l-4-4a1 1 0 010-1.414z" clipRule="evenodd" /></svg>
                  </>
                )}
              </div>
            </div>
            <div>
              <label style={{ display: "block", font: `500 0.78rem/1 ${fb}`, color: t1, marginBottom: 6 }}>Fecha de inicio <span style={{ font: `400 0.72rem/1 ${fb}`, color: t3 }}>· vencimiento calculado automático</span></label>
              <div style={{ position: "relative" }}>
                <CalendarDays size={14} style={{ position: "absolute", left: 12, top: "50%", transform: "translateY(-50%)", color: t3, pointerEvents: "none" }} />
                <input required type="date" value={reactivarFechaInicio} onChange={e => setReactivarFechaInicio(e.target.value)}
                  style={{ width: "100%", padding: "11px 14px 11px 34px", background: "#F9FAFB", border: "1px solid rgba(0,0,0,0.09)", borderRadius: 10, font: `400 0.875rem/1 ${fb}`, color: reactivarFechaInicio ? t1 : t3, outline: "none", boxSizing: "border-box" as const }}
                  onFocus={e => (e.currentTarget.style.borderColor = "#16A34A")}
                  onBlur={e => (e.currentTarget.style.borderColor = "rgba(0,0,0,0.09)")}
                />
              </div>
              {reactivarPlanId && reactivarFechaInicio && (() => {
                const plan = planes.find(p => p.id === reactivarPlanId);
                if (!plan) return null;
                const base = new Date(reactivarFechaInicio + "T12:00:00");
                const PM: Record<string, number> = { mes: 1, mensual: 1, trimestral: 3, anual: 12, año: 12 };
                const PD: Record<string, number> = { semanal: 7, semana: 7 };
                const per = plan.periodo ?? "mensual";
                let exp: Date;
                if (plan.duracion_dias && plan.duracion_dias > 0) {
                  exp = new Date(base); exp.setDate(exp.getDate() + plan.duracion_dias);
                } else if (PM[per]) {
                  exp = addMonths(base, PM[per]);
                } else {
                  exp = new Date(base); exp.setDate(exp.getDate() + (PD[per] ?? 30));
                }
                return <p style={{ font: `400 0.72rem/1 ${fb}`, color: t3, marginTop: 5 }}>Vence el {exp.toLocaleDateString("es-AR", { day: "numeric", month: "long", year: "numeric" })}</p>;
              })()}
            </div>
            {reactivarTarget.deuda_pendiente > 0 && (
              <label style={{ display: "flex", alignItems: "center", gap: 10, cursor: "pointer" }}>
                <input type="checkbox" checked={reactivarSaldarDeuda} onChange={e => setReactivarSaldarDeuda(e.target.checked)} style={{ width: 16, height: 16, accentColor: "#16A34A", cursor: "pointer" }} />
                <span style={{ font: `500 0.82rem/1.3 ${fb}`, color: t1 }}>
                  Saldar deuda de <strong>${reactivarTarget.deuda_pendiente.toLocaleString("es-AR")}</strong> al reactivar
                </span>
              </label>
            )}
            {reactivarError && (
              <div style={{ background: "rgba(220,38,38,0.07)", border: "1px solid rgba(220,38,38,0.18)", borderRadius: 9, padding: "10px 14px", font: `400 0.8rem/1.4 ${fb}`, color: "#DC2626" }}>{reactivarError}</div>
            )}
            <button type="submit" disabled={reactivarSaving}
              style={{ width: "100%", padding: "13px", background: reactivarSaving ? "#9CA3AF" : "#16A34A", color: "white", border: "none", borderRadius: 12, font: `700 0.95rem/1 ${fd}`, cursor: reactivarSaving ? "not-allowed" : "pointer", boxShadow: reactivarSaving ? "none" : "0 4px 16px rgba(22,163,74,0.28)", marginTop: 4 }}
              onMouseEnter={e => { if (!reactivarSaving) (e.currentTarget.style.opacity = "0.92"); }}
              onMouseLeave={e => (e.currentTarget.style.opacity = "1")}
            >{reactivarSaving ? "Reactivando..." : "Reactivar Membresía"}</button>
          </form>
        </div>
      </div>
    )}

    {/* ── Modal: Registrar Pago ── */}
    {pagoModalOpen && pagoTarget && (
      <div style={{ position: "fixed", inset: 0, zIndex: 9010, background: "rgba(0,0,0,0.40)", backdropFilter: "blur(6px)", WebkitBackdropFilter: "blur(6px)", display: "flex", alignItems: isMobile ? "flex-end" : "center", justifyContent: "center", padding: isMobile ? 0 : 20, paddingBottom: isMobile ? "calc(64px + env(safe-area-inset-bottom, 0px))" : undefined }}>
        <div style={{ background: "#FFFFFF", borderRadius: isMobile ? "20px 20px 0 0" : 20, boxShadow: "0 24px 60px rgba(0,0,0,0.18), 0 0 0 1px rgba(0,0,0,0.06)", width: "100%", maxWidth: isMobile ? "100%" : 400, maxHeight: isMobile ? "calc(90vh - 64px)" : undefined, overflowY: "auto" }}>
          {/* Header */}
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "22px 24px 18px" }}>
            <div>
              <h2 style={{ font: `800 1.15rem/1 ${fd}`, color: t1, letterSpacing: "-0.01em" }}>Registrar Pago</h2>
              <p style={{ font: `400 0.78rem/1 ${fb}`, color: t3, marginTop: 4 }}>{pagoTarget.full_name}</p>
            </div>
            <button onClick={() => setPagoModalOpen(false)} style={{ width: 32, height: 32, borderRadius: "50%", background: "#F0F2F8", border: "none", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", color: t2, flexShrink: 0 }}
              onMouseEnter={e => { (e.currentTarget as HTMLButtonElement).style.background = "#E4E6EF"; }}
              onMouseLeave={e => { (e.currentTarget as HTMLButtonElement).style.background = "#F0F2F8"; }}
            ><X size={16} /></button>
          </div>
          <div style={{ height: 1, background: "rgba(0,0,0,0.06)", margin: "0 24px" }} />
          {/* Form */}
          <form onSubmit={handlePagoSubmit} style={{ padding: "20px 24px 24px", display: "flex", flexDirection: "column", gap: 16 }}>
            <div>
              <label style={{ display: "block", font: `500 0.78rem/1 ${fb}`, color: t1, marginBottom: 8 }}>
                Tipo de cobro
              </label>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
                {([
                  { key: "cuota" as const, label: "Pago de cuota" },
                  { key: "otro" as const, label: "Otro" },
                ]).map((option) => {
                  const active = pagoTipo === option.key;
                  return (
                    <button
                      key={option.key}
                      type="button"
                      onClick={() => setPagoTipo(option.key)}
                      style={{
                        minHeight: 44,
                        borderRadius: 10,
                        border: `1.5px solid ${active ? "#4B6BFB" : "rgba(0,0,0,0.09)"}`,
                        background: active ? "rgba(75,107,251,0.06)" : "#FFFFFF",
                        color: active ? "#4B6BFB" : t2,
                        font: `600 0.82rem/1 ${fd}`,
                        cursor: "pointer",
                      }}
                    >
                      {option.label}
                    </button>
                  );
                })}
              </div>
            </div>
            <div>
              <label style={{ display: "block", font: `500 0.78rem/1 ${fb}`, color: t1, marginBottom: 6 }}>
                Monto <span style={{ font: `400 0.72rem/1 ${fb}`, color: t3 }}>· ARS</span>
              </label>
              <div style={{ position: "relative" }}>
                <span style={{ position: "absolute", left: 14, top: "50%", transform: "translateY(-50%)", font: `500 0.9rem/1 ${fb}`, color: t2, pointerEvents: "none" }}>$</span>
                <input
                  required
                  type="number"
                  min="1"
                  step="any"
                  value={pagoMonto}
                  onChange={e => setPagoMonto(e.target.value)}
                  style={{ width: "100%", padding: "11px 14px 11px 26px", background: "#F9FAFB", border: "1px solid rgba(0,0,0,0.09)", borderRadius: 10, font: `500 0.95rem/1 ${fb}`, color: t1, outline: "none", boxSizing: "border-box" as const, transition: "border-color 0.14s" }}
                  onFocus={e => (e.currentTarget.style.borderColor = "#4B6BFB")}
                  onBlur={e => (e.currentTarget.style.borderColor = "rgba(0,0,0,0.09)")}
                />
              </div>
              {pagoTarget.planes && (
                <p style={{ font: `400 0.7rem/1 ${fb}`, color: t3, marginTop: 5 }}>
                  Plan: {pagoTarget.planes.nombre} — ${pagoTarget.planes.precio}/mes
                </p>
              )}
            </div>
            <div style={{ display: "grid", gap: 10 }}>
              {promos.length > 0 && (
                <div>
                  <label style={{ display: "block", font: `500 0.78rem/1 ${fb}`, color: t1, marginBottom: 6 }}>
                    Promo guardada
                  </label>
                  <select
                    value={pagoPromoId}
                    onChange={(e) => {
                      const promoId = e.target.value;
                      setPagoPromoId(promoId);
                      if (!promoId) {
                        setPagoDiscountType("none");
                        setPagoDiscountValue("");
                        setPagoDiscountReason("");
                        return;
                      }
                      const promo = promos.find((item) => item.id === promoId);
                      if (!promo) return;
                      setPagoDiscountType(promo.discount_type);
                      setPagoDiscountValue(String(promo.discount_value));
                      setPagoDiscountReason(promo.note ?? promo.nombre);
                    }}
                    style={{ width: "100%", padding: "11px 14px", background: "#F9FAFB", border: "1px solid rgba(0,0,0,0.09)", borderRadius: 10, font: `500 0.9rem/1 ${fb}`, color: pagoPromoId ? t1 : t3, outline: "none", boxSizing: "border-box" as const }}
                  >
                    <option value="">Elegir promo…</option>
                    {promos.map((promo) => (
                      <option key={promo.id} value={promo.id}>
                        {promo.nombre}
                      </option>
                    ))}
                  </select>
                  <p style={{ font: `400 0.7rem/1 ${fb}`, color: t3, marginTop: 5 }}>
                    Si elegís una promo, completa automáticamente el descuento y el motivo.
                  </p>
                </div>
              )}
              <div>
                <label style={{ display: "block", font: `500 0.78rem/1 ${fb}`, color: t1, marginBottom: 8 }}>
                  Descuento (opcional)
                </label>
                <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 8 }}>
                  {([
                    { key: "none" as const, label: "Sin desc." },
                    { key: "monto" as const, label: "Por monto" },
                    { key: "porcentaje" as const, label: "Por %" },
                  ]).map((option) => {
                    const active = pagoDiscountType === option.key;
                    return (
                      <button
                        key={option.key}
                        type="button"
                        onClick={() => {
                          setPagoDiscountType(option.key);
                          if (option.key === "none") {
                            setPagoDiscountValue("");
                            setPagoDiscountReason("");
                          }
                        }}
                        style={{
                          minHeight: 42,
                          borderRadius: 10,
                          border: `1.5px solid ${active ? "#4B6BFB" : "rgba(0,0,0,0.09)"}`,
                          background: active ? "rgba(75,107,251,0.06)" : "#FFFFFF",
                          color: active ? "#4B6BFB" : t2,
                          font: `600 0.76rem/1 ${fd}`,
                          cursor: "pointer",
                        }}
                      >
                        {option.label}
                      </button>
                    );
                  })}
                </div>
              </div>
              {pagoDiscountType !== "none" && (
                <>
                  <div>
                    <label style={{ display: "block", font: `500 0.78rem/1 ${fb}`, color: t1, marginBottom: 6 }}>
                      {pagoDiscountType === "monto" ? "Monto a descontar" : "Porcentaje a descontar"}
                    </label>
                    <div style={{ position: "relative" }}>
                      <span style={{ position: "absolute", left: 14, top: "50%", transform: "translateY(-50%)", font: `500 0.9rem/1 ${fb}`, color: t2, pointerEvents: "none" }}>
                        {pagoDiscountType === "monto" ? "$" : "%"}
                      </span>
                      <input
                        type="number"
                        min="0"
                        step="any"
                        value={pagoDiscountValue}
                        onChange={e => setPagoDiscountValue(e.target.value)}
                        placeholder={pagoDiscountType === "monto" ? "0" : "10"}
                        style={{ width: "100%", padding: "11px 14px 11px 26px", background: "#F9FAFB", border: "1px solid rgba(0,0,0,0.09)", borderRadius: 10, font: `500 0.95rem/1 ${fb}`, color: t1, outline: "none", boxSizing: "border-box" as const, transition: "border-color 0.14s" }}
                        onFocus={e => (e.currentTarget.style.borderColor = "#4B6BFB")}
                        onBlur={e => (e.currentTarget.style.borderColor = "rgba(0,0,0,0.09)")}
                      />
                    </div>
                  </div>
                  <div>
                    <label style={{ display: "block", font: `500 0.78rem/1 ${fb}`, color: t1, marginBottom: 6 }}>
                      Motivo del descuento
                    </label>
                    <input
                      value={pagoDiscountReason}
                      onChange={e => setPagoDiscountReason(e.target.value)}
                      placeholder="Ej: Promo 2x1 o referido"
                      style={{ width: "100%", padding: "11px 14px", background: "#F9FAFB", border: "1px solid rgba(0,0,0,0.09)", borderRadius: 10, font: `500 0.9rem/1 ${fb}`, color: t1, outline: "none", boxSizing: "border-box" as const, transition: "border-color 0.14s" }}
                      onFocus={e => (e.currentTarget.style.borderColor = "#4B6BFB")}
                      onBlur={e => (e.currentTarget.style.borderColor = "rgba(0,0,0,0.09)")}
                    />
                  </div>
                  <div style={{ background: "rgba(75,107,251,0.05)", border: "1px solid rgba(75,107,251,0.12)", borderRadius: 10, padding: "10px 14px", font: `400 0.78rem/1.5 ${fb}`, color: "#4B6BFB" }}>
                    Base: <strong>${(parseFloat(pagoMonto || "0") || 0).toLocaleString("es-AR")}</strong>
                    {" · "}
                    Final: <strong>${Math.max(0, (parseFloat(pagoMonto || "0") || 0) - (
                      pagoDiscountType === "monto"
                        ? (parseFloat(pagoDiscountValue || "0") || 0)
                        : ((parseFloat(pagoMonto || "0") || 0) * (parseFloat(pagoDiscountValue || "0") || 0)) / 100
                    )).toLocaleString("es-AR")}</strong>
                  </div>
                </>
              )}
            </div>
            <div>
              <label style={{ display: "block", font: `500 0.78rem/1 ${fb}`, color: t1, marginBottom: 8 }}>Método de pago</label>
              <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 6 }}>
                {[["efectivo","Efectivo"],["transferencia","Transferencia"],["tarjeta_debito","Débito"],["tarjeta_credito","Crédito"],["mercado_pago","Mercado Pago"],["otro","Otro"]].map(([val, lbl]) => (
                  <button key={val} type="button" onClick={() => setPagoMetodo(val)}
                    style={{ padding: "8px 6px", borderRadius: 8, border: `1.5px solid ${pagoMetodo === val ? "#4B6BFB" : "rgba(0,0,0,0.09)"}`, background: pagoMetodo === val ? "rgba(75,107,251,0.08)" : "white", font: `${pagoMetodo === val ? 700 : 500} 0.72rem/1 ${fb}`, color: pagoMetodo === val ? "#4B6BFB" : t2, cursor: "pointer", transition: "all 0.12s" }}>
                    {lbl}
                  </button>
                ))}
              </div>
            </div>
            <div>
              <label style={{ display: "block", font: `500 0.78rem/1 ${fb}`, color: t1, marginBottom: 6 }}>
                Fecha del pago
              </label>
              <input
                required
                type="date"
                value={pagoFecha}
                onChange={e => setPagoFecha(e.target.value)}
                style={{ width: "100%", padding: "11px 14px", background: "#F9FAFB", border: "1px solid rgba(0,0,0,0.09)", borderRadius: 10, font: `500 0.9rem/1 ${fb}`, color: t1, outline: "none", boxSizing: "border-box" as const, transition: "border-color 0.14s" }}
                onFocus={e => (e.currentTarget.style.borderColor = "#4B6BFB")}
                onBlur={e => (e.currentTarget.style.borderColor = "rgba(0,0,0,0.09)")}
              />
              <p style={{ font: `400 0.7rem/1 ${fb}`, color: t3, marginTop: 5 }}>
                Arranca con hoy, pero podés corregirla si estás registrando un pago anterior.
              </p>
            </div>
            <div>
              <label style={{ display: "block", font: `500 0.78rem/1 ${fb}`, color: t1, marginBottom: 6 }}>
                Detalle
              </label>
              <input
                value={pagoDetalle}
                onChange={e => setPagoDetalle(e.target.value)}
                placeholder={pagoTipo === "cuota" ? "Ej: abril, pase familiar, promo..." : "Ej: remera, clase suelta, suplemento..."}
                style={{ width: "100%", padding: "11px 14px", background: "#F9FAFB", border: "1px solid rgba(0,0,0,0.09)", borderRadius: 10, font: `500 0.9rem/1 ${fb}`, color: t1, outline: "none", boxSizing: "border-box" as const, transition: "border-color 0.14s" }}
                onFocus={e => (e.currentTarget.style.borderColor = "#4B6BFB")}
                onBlur={e => (e.currentTarget.style.borderColor = "rgba(0,0,0,0.09)")}
              />
              <p style={{ font: `400 0.7rem/1 ${fb}`, color: t3, marginTop: 5 }}>
                {pagoTipo === "cuota"
                  ? "Opcional. Te sirve para dejar aclarado qué cuota o período corresponde."
                  : "Obligatorio en la práctica para identificar cobros de productos, clases u otros conceptos."}
              </p>
            </div>
            {pagoError && (
              <div style={{ background: "rgba(220,38,38,0.07)", border: "1px solid rgba(220,38,38,0.18)", borderRadius: 9, padding: "10px 14px", font: `400 0.8rem/1.4 ${fb}`, color: "#DC2626" }}>{pagoError}</div>
            )}
            <button type="submit" disabled={pagoSaving}
              style={{ width: "100%", padding: "13px", background: pagoSaving ? "#9CA3AF" : "#FF6A00", color: "white", border: "none", borderRadius: 12, font: `700 0.95rem/1 ${fd}`, cursor: pagoSaving ? "not-allowed" : "pointer", boxShadow: pagoSaving ? "none" : "0 4px 16px rgba(255,106,0,0.25)", transition: "opacity 0.14s", marginTop: 4 }}
              onMouseEnter={e => { if (!pagoSaving) (e.currentTarget.style.opacity = "0.9"); }}
              onMouseLeave={e => (e.currentTarget.style.opacity = "1")}
            >{pagoSaving ? "Registrando..." : "Confirmar Pago"}</button>
          </form>
        </div>
      </div>
    )}

    {/* ── Lateral Drawer: Ficha / Historial ── */}
    {fichaTarget && typeof document !== "undefined" && createPortal(
      <>
        {/* Backdrop */}
        <div
          onClick={() => setFichaTarget(null)}
          style={{ position: "fixed", inset: 0, zIndex: 9000, background: "rgba(0,0,0,0.35)", backdropFilter: "blur(3px)", WebkitBackdropFilter: "blur(3px)", animation: "fadeInBd 0.2s ease" }}
        />
        {/* Panel */}
        <div style={{
          position: "fixed", top: 0, right: 0, bottom: 0, zIndex: 9001,
          width: "min(480px, 96vw)",
          background: "#FAFBFD",
          boxShadow: "-12px 0 48px rgba(0,0,0,0.14), -1px 0 0 rgba(0,0,0,0.06)",
          display: "flex", flexDirection: "column",
          animation: "drawerIn 0.28s cubic-bezier(0.22,1,0.36,1)",
        }}>
          {/* Header */}
          <div style={{ background: "#0D0F12", padding: "22px 24px 18px", flexShrink: 0, position: "relative", overflow: "hidden" }}>
            <svg style={{ position: "absolute", inset: 0, width: "100%", height: "100%", opacity: 0.05, pointerEvents: "none" }}>
              <filter id="grain-ficha"><feTurbulence type="fractalNoise" baseFrequency="0.65" numOctaves="2" stitchTiles="stitch" /><feColorMatrix type="saturate" values="0" /></filter>
              <rect width="100%" height="100%" filter="url(#grain-ficha)" />
            </svg>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", position: "relative", zIndex: 1 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                <div style={{ width: 42, height: 42, borderRadius: "50%", background: "rgba(249,115,22,0.15)", border: "1.5px solid rgba(249,115,22,0.3)", display: "flex", alignItems: "center", justifyContent: "center", font: `800 0.88rem/1 ${fd}`, color: "white", flexShrink: 0 }}>
                  {initials(fichaTarget.full_name)}
                </div>
                <div>
                  <p style={{ font: `300 0.58rem/1 ${fd}`, color: "rgba(255,255,255,0.4)", letterSpacing: "0.16em", textTransform: "uppercase", marginBottom: 4 }}>Historial de actividad</p>
                  <h2 style={{ font: `800 1.1rem/1.1 ${fd}`, color: "white", letterSpacing: "-0.02em" }}>{fichaTarget.full_name}</h2>
                </div>
              </div>
              <button onClick={() => setFichaTarget(null)} style={{ width: 32, height: 32, borderRadius: "50%", background: "rgba(255,255,255,0.1)", border: "none", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", color: "rgba(255,255,255,0.6)", flexShrink: 0 }}>
                <X size={15} />
              </button>
            </div>
            {/* Chips rápidos */}
            <div style={{ display: "flex", gap: 8, marginTop: 14, position: "relative", zIndex: 1, flexWrap: "wrap" }}>
              {[
                { label: fichaTarget.planes?.nombre ?? "Sin plan", color: fichaTarget.planes?.accent_color ?? "#6B7280" },
                { label: STATUS_STYLE[fichaTarget.status].label, color: fichaTarget.status === "activo" ? "#22C55E" : fichaTarget.status === "vencido" ? "#EF4444" : "#94A3B8" },
                ...(fichaTarget.next_expiration_date ? [{ label: `Vence ${fichaTarget.next_expiration_date}`, color: "rgba(255,255,255,0.45)" }] : []),
              ].map(chip => (
                <span key={chip.label} style={{ font: `600 0.65rem/1 ${fb}`, color: chip.color, background: `${chip.color}18`, border: `1px solid ${chip.color}30`, padding: "4px 10px", borderRadius: 9999 }}>{chip.label}</span>
              ))}
            </div>
            {/* Tabs */}
            <div style={{ display: "flex", gap: 4, marginTop: 16, position: "relative", zIndex: 1 }}>
              {(["historial", "progreso"] as const).map(t => (
                <button key={t} onClick={() => { setFichaTab(t); if (t === "progreso") loadFichaProgreso(fichaTarget.id); }}
                  style={{ padding: "6px 14px", borderRadius: 9999, border: "none", font: `600 0.68rem/1 ${fb}`, cursor: "pointer", transition: "all 0.15s", background: fichaTab === t ? "#F97316" : "rgba(255,255,255,0.12)", color: fichaTab === t ? "#fff" : "rgba(255,255,255,0.55)" }}>
                  {t === "historial" ? "Historial" : "Progreso"}
                </button>
              ))}
            </div>
          </div>

          {/* Tab content */}
          <div style={{ flex: 1, overflowY: "auto", padding: "20px 24px" }}>
            {fichaTab === "progreso" ? (
              fichaProgresoLoading ? (
                <div style={{ display: "flex", alignItems: "center", justifyContent: "center", height: 120, gap: 10, color: t3, font: `400 0.85rem/1 ${fb}` }}>
                  <div style={{ width: 18, height: 18, borderRadius: "50%", border: "2px solid #E5E7EB", borderTopColor: "#F97316", animation: "spinAI 0.7s linear infinite" }} />
                  Cargando progreso...
                </div>
              ) : !fichaProgreso ? null : (
                <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>

                  {/* ── Curva de fuerza ── */}
                  {fichaProgreso.pesos.length > 0 && (() => {
                    const map = new Map<string, { peso: number; fecha: string }[]>();
                    [...fichaProgreso.pesos].reverse().forEach(p => {
                      if (!map.has(p.ejercicio)) map.set(p.ejercicio, []);
                      map.get(p.ejercicio)!.push({ peso: p.peso, fecha: p.fecha });
                    });
                    const exercises = [...map.keys()];
                    const selEj  = fichaEjSel ?? exercises[0] ?? null;
                    const ejData = selEj ? (map.get(selEj) ?? []) : [];
                    const vals   = ejData.map(d => d.peso);
                    const pr     = vals.length ? Math.max(...vals) : 0;
                    const delta  = vals.length >= 2 ? +(pr - vals[0]).toFixed(1) : null;
                    const W = 300, H = 50;
                    const sparkline = ejData.length >= 2 ? (() => {
                      const min = Math.min(...vals), max = Math.max(...vals), rng = max - min || 1;
                      const pts = vals.map((v, i) => {
                        const x = ((i / (vals.length - 1)) * W).toFixed(1);
                        const y = (H - ((v - min) / rng) * H * 0.78 - H * 0.1).toFixed(1);
                        return `${x},${y}`;
                      });
                      const ptsStr = pts.join(" ");
                      const prIdx = vals.indexOf(pr);
                      const prPt  = pts[prIdx].split(",");
                      return (
                        <svg viewBox={`0 0 ${W} ${H}`} style={{ width: "100%", height: 50, overflow: "visible" }}>
                          <defs>
                            <linearGradient id="fg-staff" x1="0" y1="0" x2="0" y2="1">
                              <stop offset="0%" stopColor="#F97316" stopOpacity="0.1" />
                              <stop offset="100%" stopColor="#F97316" stopOpacity="0" />
                            </linearGradient>
                          </defs>
                          <path d={`M0,${H} ${ptsStr} ${W},${H} Z`} fill="url(#fg-staff)" />
                          <polyline points={ptsStr} fill="none" stroke="#F97316" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
                          {pts.map((pt, i) => { const [cx, cy] = pt.split(","); return <circle key={i} cx={cx} cy={cy} r="2" fill="#F97316" opacity="0.5" />; })}
                          <circle cx={prPt[0]} cy={prPt[1]} r="4" fill="#F97316" stroke="white" strokeWidth="1.5" />
                        </svg>
                      );
                    })() : (
                      <p style={{ font: `400 0.68rem/1 ${fb}`, color: t3, padding: "10px 0" }}>
                        {ejData.length === 1 ? `1 registro: ${vals[0]} kg (${ejData[0].fecha})` : "Sin cargas para este ejercicio"}
                      </p>
                    );
                    return (
                      <div style={{ ...card, padding: "14px 16px" }}>
                        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 10 }}>
                          <p style={{ font: `600 0.78rem/1 ${fb}`, color: t1 }}>Curva de fuerza</p>
                          {vals.length > 0 && (
                            <div style={{ display: "flex", gap: 6, alignItems: "center" }}>
                              <span style={{ font: `700 0.75rem/1 ${fb}`, color: t1 }}>PR {pr} kg</span>
                              {delta !== null && delta !== 0 && (
                                <span style={{ font: `500 0.62rem/1 ${fb}`, color: delta > 0 ? "#16A34A" : "#DC2626", background: delta > 0 ? "#F0FDF4" : "#FEF2F2", padding: "2px 7px", borderRadius: 99 }}>
                                  {delta > 0 ? "+" : ""}{delta} kg
                                </span>
                              )}
                            </div>
                          )}
                        </div>
                        <div style={{ display: "flex", gap: 5, flexWrap: "wrap", marginBottom: 12 }}>
                          {exercises.map(ej => (
                            <button key={ej} onClick={() => setFichaEjSel(ej)} style={{ padding: "4px 10px", borderRadius: 9999, background: fichaEjSel === ej ? "rgba(249,115,22,0.1)" : "#F3F4F6", border: `1px solid ${fichaEjSel === ej ? "rgba(249,115,22,0.35)" : "transparent"}`, font: `500 0.62rem/1 ${fb}`, color: fichaEjSel === ej ? "#F97316" : t2, cursor: "pointer" }}>
                              {ej}
                            </button>
                          ))}
                        </div>
                        {sparkline}
                        {ejData.length >= 2 && (
                          <div style={{ display: "flex", justifyContent: "space-between", marginTop: 6 }}>
                            <span style={{ font: `400 0.58rem/1 ${fb}`, color: t3 }}>{ejData[0].fecha}</span>
                            <span style={{ font: `400 0.58rem/1 ${fb}`, color: t3 }}>{ejData[ejData.length - 1].fecha}</span>
                          </div>
                        )}
                      </div>
                    );
                  })()}

                  {/* ── Medidas corporales ── */}
                  {fichaProgreso.medidas.length > 0 && (() => {
                    const latest = fichaProgreso.medidas[0];
                    const prev   = fichaProgreso.medidas[1];
                    const diff   = prev ? +(latest.peso_kg - prev.peso_kg).toFixed(1) : null;
                    const vals   = [...fichaProgreso.medidas].reverse().map(m => +m.peso_kg);
                    const W = 300, H = 40;
                    const sparkline = vals.length >= 2 ? (() => {
                      const min = Math.min(...vals), max = Math.max(...vals), rng = max - min || 1;
                      const pts = vals.map((v, i) => `${((i / (vals.length - 1)) * W).toFixed(1)},${(H - ((v - min) / rng) * H * 0.8 - H * 0.1).toFixed(1)}`).join(" ");
                      return (
                        <svg viewBox={`0 0 ${W} ${H}`} style={{ width: "100%", height: 40, overflow: "visible", marginTop: 10 }}>
                          <polyline points={pts} fill="none" stroke="#6366F1" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" opacity="0.7" />
                        </svg>
                      );
                    })() : null;
                    return (
                      <div style={{ ...card, padding: "14px 16px" }}>
                        <p style={{ font: `600 0.78rem/1 ${fb}`, color: t1, marginBottom: 10 }}>Medidas corporales</p>
                        <div style={{ display: "flex", alignItems: "baseline", gap: 8 }}>
                          <span style={{ font: `800 1.8rem/1 ${fd}`, color: t1, letterSpacing: "-0.03em" }}>{latest.peso_kg}</span>
                          <span style={{ font: `500 0.8rem/1 ${fb}`, color: t3 }}>kg</span>
                          {latest.grasa_pct != null && <span style={{ font: `400 0.68rem/1 ${fb}`, color: t3, marginLeft: 4 }}>{latest.grasa_pct}% grasa</span>}
                          {diff !== null && (
                            <span style={{ font: `500 0.68rem/1 ${fb}`, color: diff < 0 ? "#16A34A" : diff > 0 ? "#DC2626" : t3, background: diff < 0 ? "#F0FDF4" : diff > 0 ? "#FEF2F2" : "#F3F4F6", padding: "2px 8px", borderRadius: 99 }}>
                              {diff > 0 ? "+" : ""}{diff} kg
                            </span>
                          )}
                        </div>
                        {sparkline}
                      </div>
                    );
                  })()}

                  {/* ── Sesiones completadas ── */}
                  {fichaProgreso.sessions.length > 0 && (
                    <div style={{ ...card, padding: "14px 16px" }}>
                      <p style={{ font: `600 0.78rem/1 ${fb}`, color: t1, marginBottom: 10 }}>Últimas sesiones</p>
                      <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                        {fichaProgreso.sessions.map(s => (
                          <div key={s.id} style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                            <div>
                              <p style={{ font: `500 0.75rem/1.2 ${fb}`, color: t1 }}>{s.rutina_nombre ?? "Entrenamiento"}</p>
                              <p style={{ font: `400 0.62rem/1 ${fb}`, color: t3, marginTop: 2 }}>{s.fecha}</p>
                            </div>
                            <span style={{ font: `600 0.62rem/1 ${fb}`, color: "#16A34A", background: "#F0FDF4", padding: "3px 8px", borderRadius: 99 }}>✓ Completado</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* ── Fotos compartidas ── */}
                  <div style={{ ...card, padding: "14px 16px" }}>
                    <p style={{ font: `600 0.78rem/1 ${fb}`, color: t1, marginBottom: 10 }}>
                      Fotos de progreso
                      <span style={{ font: `400 0.62rem/1 ${fb}`, color: t3, marginLeft: 6 }}>(solo las que el alumno compartió)</span>
                    </p>
                    {fichaProgreso.fotos.length === 0 ? (
                      <p style={{ font: `400 0.7rem/1.5 ${fb}`, color: t3, textAlign: "center", padding: "12px 0" }}>El alumno no compartió fotos aún.</p>
                    ) : (
                      <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 6 }}>
                        {fichaProgreso.fotos.map(f => (
                          <div key={f.id} style={{ position: "relative", borderRadius: 8, overflow: "hidden", aspectRatio: "1", background: "#F3F4F6" }}>
                            {/* eslint-disable-next-line @next/next/no-img-element */}
                            <img src={f.foto_url} alt={f.fecha} style={{ width: "100%", height: "100%", objectFit: "cover", display: "block" }} loading="lazy" />
                            <span style={{ position: "absolute", bottom: 3, left: 3, font: `400 0.48rem/1 ${fb}`, color: "rgba(255,255,255,0.85)", background: "rgba(0,0,0,0.5)", padding: "2px 4px", borderRadius: 3 }}>{f.fecha}</span>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>

                  {fichaProgreso.pesos.length === 0 && fichaProgreso.medidas.length === 0 && fichaProgreso.sessions.length === 0 && fichaProgreso.fotos.length === 0 && (
                    <div style={{ textAlign: "center", padding: "40px 0", color: t3 }}>
                      <TrendingUp size={28} style={{ opacity: 0.25, marginBottom: 10 }} />
                      <p style={{ font: `500 0.82rem/1.5 ${fb}` }}>Sin datos de progreso todavía.</p>
                      <p style={{ font: `400 0.72rem/1.4 ${fb}`, marginTop: 4 }}>Cuando el alumno registre cargas o medidas, aparecerán acá.</p>
                    </div>
                  )}
                </div>
              )
            ) : fichaLoading ? (
              <div style={{ display: "flex", alignItems: "center", justifyContent: "center", height: 120, gap: 10, color: t3, font: `400 0.85rem/1 ${fb}` }}>
                <div style={{ width: 18, height: 18, borderRadius: "50%", border: "2px solid #E5E7EB", borderTopColor: "#F97316", animation: "spinAI 0.7s linear infinite" }} />
                Cargando historial...
              </div>
            ) : fichaLogs.length === 0 ? (
              <div style={{ textAlign: "center", padding: "48px 0", color: t3 }}>
                <History size={32} style={{ opacity: 0.3, marginBottom: 12 }} />
                <p style={{ font: `500 0.85rem/1.5 ${fb}`, color: t3 }}>Sin actividad registrada todavía.</p>
                <p style={{ font: `400 0.75rem/1.4 ${fb}`, color: t3, marginTop: 4 }}>Los eventos futuros aparecerán aquí.</p>
              </div>
            ) : (
              <div style={{ position: "relative" }}>
                {/* Vertical line */}
                <div style={{ position: "absolute", left: 15, top: 8, bottom: 8, width: 1.5, background: "linear-gradient(to bottom, rgba(249,115,22,0.3), rgba(0,0,0,0.06))", borderRadius: 1 }} />
                <div style={{ display: "flex", flexDirection: "column", gap: 0 }}>
                  {fichaLogs.map((log, i) => {
                    const dt = new Date(log.created_at);
                    const dateStr = dt.toLocaleDateString("es-AR", { day: "2-digit", month: "2-digit", year: "2-digit" });
                    const timeStr = dt.toLocaleTimeString("es-AR", { hour: "2-digit", minute: "2-digit" });
                    const iconMap: Record<string, { icon: string; color: string }> = {
                      creado:           { icon: "✨", color: "#7C3AED" },
                      pago:             { icon: "💰", color: "#16A34A" },
                      plan_cambiado:    { icon: "📋", color: "#2563EB" },
                      membresia_asignada: { icon: "⭐", color: "#F97316" },
                      wa_enviado:       { icon: "💬", color: "#25D366" },
                      congelado:        { icon: "❄️", color: "#64748B" },
                      descongelado:     { icon: "🌡️", color: "#0EA5E9" },
                      editado:          { icon: "✏️", color: "#D97706" },
                      eliminado:        { icon: "🗑️", color: "#DC2626" },
                      check_in:         { icon: "✅", color: "#22C55E" },
                    };
                    const meta = iconMap[log.type] ?? { icon: "•", color: t3 };
                    return (
                      <div key={log.id} style={{ display: "flex", gap: 16, paddingBottom: i < fichaLogs.length - 1 ? 18 : 0 }}>
                        {/* Dot */}
                        <div style={{ flexShrink: 0, width: 30, display: "flex", justifyContent: "center", paddingTop: 2 }}>
                          <div style={{ width: 22, height: 22, borderRadius: "50%", background: "white", border: `1.5px solid ${meta.color}40`, boxShadow: `0 0 0 3px ${meta.color}10`, display: "flex", alignItems: "center", justifyContent: "center", fontSize: "0.7rem", zIndex: 1 }}>
                            {meta.icon}
                          </div>
                        </div>
                        {/* Content */}
                        <div style={{ flex: 1, minWidth: 0, paddingTop: 2 }}>
                          <div style={{ display: "flex", alignItems: "baseline", gap: 6, flexWrap: "wrap" }}>
                            <span style={{ font: `600 0.82rem/1.3 ${fd}`, color: t1 }}>{log.description}</span>
                          </div>
                          <div style={{ display: "flex", gap: 8, marginTop: 3, flexWrap: "wrap", alignItems: "center" }}>
                            <span style={{ font: `500 0.68rem/1 ${fb}`, color: t3 }}>{dateStr} {timeStr}</span>
                            {log.actor && log.actor !== "sistema" && (
                              <span style={{ font: `400 0.65rem/1 ${fb}`, color: t3, background: "#F3F4F6", padding: "2px 7px", borderRadius: 9999 }}>{log.actor}</span>
                            )}
                            {log.actor === "sistema" && (
                              <span style={{ font: `400 0.65rem/1 ${fb}`, color: t3, background: "#F3F4F6", padding: "2px 7px", borderRadius: 9999 }}>automático</span>
                            )}
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
          </div>
        </div>
      </>,
      document.body
    )}

    {/* ── Lateral Drawer: Asignar Rutina ── */}
    {rutinaModalOpen && rutinaTarget && typeof document !== "undefined" && createPortal(
      <>
        <style>{`
          @keyframes drawerIn { from { transform: translateX(100%); } to { transform: translateX(0); } }
          @keyframes fadeInBd { from { opacity: 0; } to { opacity: 1; } }
          @keyframes publishPop { 0%{transform:scale(0.7);opacity:0} 60%{transform:scale(1.08)} 100%{transform:scale(1);opacity:1} }
          @keyframes spinAI { to { transform: rotate(360deg); } }
        `}</style>

        {/* Backdrop */}
        <div
          onClick={() => !publicado && setRutinaModalOpen(false)}
          style={{ position: "fixed", inset: 0, zIndex: 9000, background: "rgba(0,0,0,0.35)", backdropFilter: "blur(3px)", WebkitBackdropFilter: "blur(3px)", animation: "fadeInBd 0.2s ease" }}
        />

        {/* Drawer panel */}
        <div style={{
          position: "fixed", top: 0, right: 0, bottom: 0, zIndex: 9001,
          width: "min(580px, 96vw)",
          background: "#FAFBFD",
          boxShadow: "-12px 0 48px rgba(0,0,0,0.14), -1px 0 0 rgba(0,0,0,0.06)",
          display: "flex", flexDirection: "column",
          animation: "drawerIn 0.28s cubic-bezier(0.22,1,0.36,1)",
        }}>

          {/* ── Header ── */}
          <div style={{
            background: "#0D0F12",
            borderBottom: "1px solid rgba(255,255,255,0.06)",
            padding: "24px 24px 20px",
            position: "relative", overflow: "hidden", flexShrink: 0,
          }}>
            {/* Grain overlay */}
            <svg style={{ position: "absolute", inset: 0, width: "100%", height: "100%", opacity: 0.06, pointerEvents: "none" }}>
              <filter id="grain-rut"><feTurbulence type="fractalNoise" baseFrequency="0.65" numOctaves="2" stitchTiles="stitch" /><feColorMatrix type="saturate" values="0" /></filter>
              <rect width="100%" height="100%" filter="url(#grain-rut)" />
            </svg>

            <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 12, position: "relative", zIndex: 1 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                <div style={{ width: 44, height: 44, borderRadius: "50%", background: "rgba(249,115,22,0.12)", border: "1.5px solid rgba(249,115,22,0.25)", display: "flex", alignItems: "center", justifyContent: "center", font: `800 0.9rem/1 ${fd}`, color: "white", flexShrink: 0 }}>
                  {rutinaTarget.full_name.split(" ").slice(0,2).map(w => w[0]).join("").toUpperCase()}
                </div>
                <div>
                  <p style={{ font: `300 0.6rem/1 ${fd}`, color: "rgba(255,255,255,0.45)", letterSpacing: "0.18em", textTransform: "uppercase", marginBottom: 5 }}>Entrenamiento para</p>
                  <h2 style={{ font: `800 1.2rem/1.1 ${fd}`, color: "white", letterSpacing: "-0.025em" }}>{rutinaTarget.full_name}</h2>
                </div>
              </div>
              <button onClick={() => setRutinaModalOpen(false)} style={{ width: 32, height: 32, borderRadius: "50%", background: "rgba(255,255,255,0.1)", border: "none", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", color: "rgba(255,255,255,0.6)", flexShrink: 0, marginTop: 2 }}>
                <X size={15} />
              </button>
            </div>

            {/* Objetivo chips */}
            {(
              <div style={{ marginTop: 14, position: "relative", zIndex: 1 }}>
                <p style={{ font: `500 0.65rem/1 ${fd}`, color: "rgba(255,255,255,0.4)", letterSpacing: "0.12em", textTransform: "uppercase", marginBottom: 8 }}>Objetivo</p>
                <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                  {["Hipertrofia", "Descenso", "Fuerza", "Resistencia", "Tonificación", "Movilidad"].map(obj => (
                    <button
                      key={obj}
                      onClick={() => setObjetivo(obj)}
                      style={{
                        padding: "6px 14px", borderRadius: 9999, border: `1px solid ${objetivo === obj ? "rgba(249,115,22,0.5)" : "rgba(255,255,255,0.1)"}`,
                        background: objetivo === obj ? "rgba(249,115,22,0.12)" : "rgba(255,255,255,0.04)",
                        color: objetivo === obj ? "#F97316" : "rgba(255,255,255,0.4)",
                        font: `${objetivo === obj ? "700" : "400"} 0.72rem/1 ${fd}`, cursor: "pointer", transition: "all 0.15s",
                      }}
                    >{obj}</button>
                  ))}
                </div>
              </div>
            )}



            {/* AI button */}
            <button
              onClick={handleAISugerir}
              disabled={aiLoading}
              style={{
                marginTop: 16, width: "100%",
                display: "flex", alignItems: "center", justifyContent: "center", gap: 9,
                padding: "12px 20px", borderRadius: 12, border: "none",
                background: aiLoading ? "rgba(249,115,22,0.12)" : "#1C1F26",
                color: aiLoading ? "rgba(255,255,255,0.5)" : "white", font: `700 0.875rem/1 ${fd}`, cursor: aiLoading ? "not-allowed" : "pointer",
                boxShadow: aiLoading ? "none" : "0 4px 16px rgba(0,0,0,0.4)",
                transition: "all 0.2s", position: "relative", zIndex: 1,
                letterSpacing: "0.01em",
              }}
            >
              {aiLoading
                ? <><div style={{ width: 16, height: 16, borderRadius: "50%", border: "2px solid rgba(255,255,255,0.3)", borderTopColor: "white", animation: "spinAI 0.7s linear infinite" }} /> Generando con IA...</>
                : <><Sparkles size={16} /> Generar entrenamiento con IA</>
              }
            </button>
          </div>

          {/* ── Body (scrollable) ── */}
          <div style={{ flex: 1, overflowY: "auto", padding: "20px 24px" }}>

            {/* Nombre de la rutina */}
            <div style={{ marginBottom: 20 }}>
              <label style={{ display: "block", font: `500 0.72rem/1 ${fb}`, color: t2, marginBottom: 6, textTransform: "uppercase", letterSpacing: "0.07em" }}>Nombre del entrenamiento</label>
              <input
                value={rutinaNombre}
                onChange={e => setRutinaNombre(e.target.value)}
                placeholder="Ej: Hipertrofia Upper Body"
                style={{ width: "100%", padding: "10px 14px", background: "white", border: "1px solid rgba(0,0,0,0.1)", borderRadius: 10, font: `600 0.9rem/1 ${fd}`, color: t1, outline: "none", boxSizing: "border-box" }}
                onFocus={e => (e.currentTarget.style.borderColor = "#F97316")}
                onBlur={e => (e.currentTarget.style.borderColor = "rgba(0,0,0,0.1)")}
              />
            </div>

            {/* Gym: cards de ejercicios */}
            {rutinatipo === "gym" && (
              <div style={{ marginBottom: 20 }}>
                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 12 }}>
                  <label style={{ font: `600 0.72rem/1 ${fd}`, color: t1, textTransform: "uppercase", letterSpacing: "0.07em" }}>Ejercicios ({rutinaEjercicios.length})</label>
                </div>
                <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                  {rutinaEjercicios.map((ej, i) => (
                    <div key={i} style={{ background: "white", border: "1px solid rgba(0,0,0,0.07)", borderRadius: 14, padding: "12px 14px", display: "flex", gap: 12, alignItems: "flex-start" }}>
                      {/* Número */}
                      <div style={{ width: 26, height: 26, borderRadius: 8, background: "#F3F4F6", display: "flex", alignItems: "center", justifyContent: "center", font: `700 0.72rem/1 ${fd}`, color: t3, flexShrink: 0, marginTop: 6 }}>
                        {i + 1}
                      </div>
                      {/* Contenido */}
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ position: "relative", marginBottom: 10 }}>
                          <input
                            placeholder="Nombre del ejercicio"
                            value={ej.nombre}
                            onChange={e => setRutinaEjercicios(prev => prev.map((x, j) => j === i ? { ...x, nombre: e.target.value } : x))}
                            style={{ width: "100%", padding: "0 0 6px", background: "transparent", border: "none", borderBottom: "1.5px solid rgba(0,0,0,0.08)", font: `600 0.92rem/1.2 ${fd}`, color: t1, outline: "none", boxSizing: "border-box" }}
                            onFocus={e => { e.currentTarget.style.borderBottomColor = "#F97316"; setEjAutoIdx(i); }}
                            onBlur={e => { e.currentTarget.style.borderBottomColor = "rgba(0,0,0,0.08)"; setTimeout(() => setEjAutoIdx(prev => prev === i ? null : prev), 150); }}
                          />
                          {ejAutoIdx === i && ej.nombre.trim().length >= 1 && (() => {
                            const q = ej.nombre.toLowerCase();
                            const suggestions = EJERCICIOS.filter(e => e.toLowerCase().includes(q)).slice(0, 6);
                            if (!suggestions.length) return null;
                            return (
                              <div style={{ position: "absolute", top: "100%", left: 0, right: 0, background: "white", border: "1px solid rgba(0,0,0,0.1)", borderRadius: 10, boxShadow: "0 4px 16px rgba(0,0,0,0.10)", zIndex: 50, overflow: "hidden" }}>
                                {suggestions.map(s => (
                                  <button
                                    key={s}
                                    type="button"
                                    onMouseDown={() => { setRutinaEjercicios(prev => prev.map((x, j) => j === i ? { ...x, nombre: s } : x)); setEjAutoIdx(null); }}
                                    style={{ width: "100%", textAlign: "left", padding: "8px 12px", background: "none", border: "none", font: `500 0.85rem/1.3 ${fd}`, color: t1, cursor: "pointer" }}
                                    onMouseEnter={e => { e.currentTarget.style.background = "rgba(249,115,22,0.06)"; }}
                                    onMouseLeave={e => { e.currentTarget.style.background = "none"; }}
                                  >
                                    {s}
                                  </button>
                                ))}
                              </div>
                            );
                          })()}
                        </div>
                        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr 1fr", gap: 8 }}>
                          {([
                            { key: "series",       label: "Series",   placeholder: "4",    type: "number" },
                            { key: "repeticiones", label: "Reps",     placeholder: "12",   type: "number" },
                            { key: "peso_sugerido",label: "Carga",    placeholder: "20kg", type: "text"   },
                            { key: "descanso",     label: "Descanso", placeholder: "60s",  type: "text"   },
                          ] as const).map(({ key, label, placeholder, type }) => (
                            <div key={key} style={{ display: "flex", flexDirection: "column", gap: 4 }}>
                              <span style={{ font: `500 0.6rem/1 ${fb}`, color: t3, textTransform: "uppercase", letterSpacing: "0.08em" }}>{label}</span>
                              <input
                                type={type}
                                min={type === "number" ? 1 : undefined}
                                placeholder={placeholder}
                                value={ej[key]}
                                onChange={e => setRutinaEjercicios(prev => prev.map((x, j) => j === i ? { ...x, [key]: type === "number" ? Number(e.target.value) : e.target.value } : x))}
                                style={{ padding: "6px 8px", background: "#F9FAFB", border: "1px solid rgba(0,0,0,0.07)", borderRadius: 8, font: `600 0.82rem/1 ${fb}`, color: "#374151", outline: "none", width: "100%", boxSizing: "border-box", textAlign: "center" }}
                                onFocus={e => (e.currentTarget.style.borderColor = "#F97316")}
                                onBlur={e => (e.currentTarget.style.borderColor = "rgba(0,0,0,0.07)")}
                              />
                            </div>
                          ))}
                        </div>
                      </div>
                      {/* Delete */}
                      <button
                        onClick={() => setRutinaEjercicios(prev => prev.filter((_, j) => j !== i))}
                        style={{ width: 28, height: 28, borderRadius: 8, background: "none", border: "none", cursor: "pointer", color: "#D1D5DB", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0, marginTop: 4, transition: "color 0.15s" }}
                        onMouseEnter={e => { e.currentTarget.style.color = "#EF4444"; }}
                        onMouseLeave={e => { e.currentTarget.style.color = "#D1D5DB"; }}
                      >
                        <Trash2 size={14} />
                      </button>
                    </div>
                  ))}
                </div>
                <button
                  onClick={() => setRutinaEjercicios(prev => [...prev, { ...EMPTY_EJ }])}
                  style={{ marginTop: 8, display: "flex", alignItems: "center", gap: 6, padding: "10px 14px", background: "none", border: "1.5px dashed rgba(249,115,22,0.22)", borderRadius: 12, font: `600 0.78rem/1 ${fd}`, color: "#F97316", cursor: "pointer", width: "100%", justifyContent: "center", transition: "all 0.15s" }}
                  onMouseEnter={e => { e.currentTarget.style.background = "rgba(249,115,22,0.04)"; }}
                  onMouseLeave={e => { e.currentTarget.style.background = "none"; }}
                >
                  <Plus size={13} /> Agregar ejercicio
                </button>
              </div>
            )}

            {/* WOD: lista de movimientos */}
            {/* Notas Pro */}
            <div style={{ marginBottom: 8 }}>
              <label style={{ display: "block", font: `600 0.72rem/1 ${fd}`, color: t1, textTransform: "uppercase", letterSpacing: "0.07em", marginBottom: 6 }}>
                Notas del Coach <span style={{ font: `400 0.65rem/1 ${fb}`, color: t3, textTransform: "none", letterSpacing: 0 }}>· Visibles solo para vos</span>
              </label>
              <textarea
                value={notas}
                onChange={e => setNotas(e.target.value)}
                placeholder="Indicaciones específicas: progresión de cargas, lesiones a considerar, enfoque de la semana..."
                rows={3}
                style={{ width: "100%", padding: "11px 14px", background: "white", border: "1px solid rgba(0,0,0,0.09)", borderRadius: 10, font: `400 0.83rem/1.5 ${fb}`, color: t1, outline: "none", resize: "none", boxSizing: "border-box" }}
                onFocus={e => (e.currentTarget.style.borderColor = "#F97316")}
                onBlur={e => (e.currentTarget.style.borderColor = "rgba(0,0,0,0.09)")}
              />
            </div>

            {rutinaError && (
              <div style={{ background: "rgba(220,38,38,0.07)", border: "1px solid rgba(220,38,38,0.18)", borderRadius: 9, padding: "10px 14px", font: `400 0.8rem/1.4 ${fb}`, color: "#DC2626" }}>{rutinaError}</div>
            )}
          </div>

          {/* ── Footer ── */}
          <div style={{ padding: "16px 24px", borderTop: "1px solid rgba(0,0,0,0.07)", background: "white", flexShrink: 0 }}>
            {publicado ? (
              <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 10, padding: "14px", background: "rgba(255,106,0,0.08)", border: "1px solid rgba(255,106,0,0.2)", borderRadius: 12, animation: "publishPop 0.4s cubic-bezier(0.22,1,0.36,1)" }}>
                <CheckCircle size={20} color="#FF6A00" />
                <span style={{ font: `700 0.9rem/1 ${fd}`, color: "#FF6A00" }}>¡Enviado al Alumno!</span>
              </div>
            ) : (
              <button
                onClick={handleRutinaSave}
                disabled={rutinaSaving}
                style={{
                  width: "100%", padding: "14px",
                  background: rutinaSaving ? "#9CA3AF" : "#111318",
                  color: "white", border: rutinaSaving ? "none" : "1px solid rgba(255,255,255,0.1)", borderRadius: 12,
                  font: `700 1rem/1 ${fd}`, cursor: rutinaSaving ? "not-allowed" : "pointer",
                  boxShadow: rutinaSaving ? "none" : "0 4px 16px rgba(0,0,0,0.4)",
                  letterSpacing: "0.01em", transition: "opacity 0.15s",
                }}
                onMouseEnter={e => { if (!rutinaSaving) e.currentTarget.style.opacity = "0.92"; }}
                onMouseLeave={e => { e.currentTarget.style.opacity = "1"; }}
              >
                {rutinaSaving ? "Publicando..." : "Publicar Entrenamiento"}
              </button>
            )}
          </div>
        </div>
      </>,
      document.body
    )}

    {/* ── Bulk action bar ── */}
    {selectedIds.size > 0 && (
      <div style={{ position: "fixed", bottom: isMobile ? "calc(72px + env(safe-area-inset-bottom, 0px))" : 28, left: "50%", transform: "translateX(-50%)", zIndex: 9000, background: "#1A1D23", borderRadius: 14, padding: "10px 14px", display: "flex", alignItems: "center", gap: 10, boxShadow: "0 8px 32px rgba(0,0,0,0.28)", whiteSpace: "nowrap" }}>
        <span style={{ font: `600 0.8rem/1 ${fd}`, color: "#E2E8F0" }}>{selectedIds.size} seleccionado{selectedIds.size !== 1 ? "s" : ""}</span>
        <div style={{ width: 1, height: 16, background: "rgba(255,255,255,0.12)" }} />
        <button
          onClick={openBulkMembresiaModal}
          style={{ padding: "7px 13px", borderRadius: 9, background: "#FF6A00", border: "none", color: "white", font: `600 0.78rem/1 ${fd}`, cursor: "pointer", display: "flex", alignItems: "center", gap: 5 }}
        ><Star size={12} /> Asignar membresía</button>
        <button
          onClick={handleBulkEliminar}
          style={{ padding: "7px 11px", borderRadius: 9, background: "rgba(220,38,38,0.16)", border: "1px solid rgba(248,113,113,0.35)", color: "#FCA5A5", font: `600 0.78rem/1 ${fd}`, cursor: "pointer", display: "flex", alignItems: "center", gap: 5 }}
        ><Trash2 size={12} /> Eliminar</button>
        <button onClick={() => setSelectedIds(new Set())} style={{ width: 28, height: 28, borderRadius: 7, background: "rgba(255,255,255,0.08)", border: "none", color: "#94A3B8", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center" }}><X size={13} /></button>
      </div>
    )}

    {/* ── Toast ── */}
    {toast && (
      <div style={{ position: "fixed", bottom: isMobile ? "calc(72px + env(safe-area-inset-bottom, 0px))" : "28px", left: isMobile ? "50%" : "28px", transform: isMobile ? "translateX(-50%)" : "none", zIndex: 9500, background: "#FF6A00", color: "white", padding: "12px 22px", borderRadius: 12, font: `600 0.875rem/1 ${fb}`, boxShadow: "0 8px 24px rgba(0,0,0,0.18)", pointerEvents: "none", whiteSpace: "nowrap" }}>
        {toast}
      </div>
    )}

    {/* ── Modal: Alumno duplicado ── */}
    {dupTarget && (
      <div
        onClick={() => setDupTarget(null)}
        style={{ position: "fixed", inset: 0, zIndex: 9020, background: "rgba(0,0,0,0.55)", backdropFilter: "blur(8px)", WebkitBackdropFilter: "blur(8px)", display: "flex", alignItems: isMobile ? "flex-end" : "center", justifyContent: "center", padding: isMobile ? 0 : 20, paddingBottom: isMobile ? "calc(64px + env(safe-area-inset-bottom, 0px))" : undefined }}
      >
        <div
          onClick={e => e.stopPropagation()}
          style={{ background: "#FFFFFF", borderRadius: isMobile ? "20px 20px 0 0" : 20, boxShadow: "0 24px 60px rgba(0,0,0,0.22)", width: "100%", maxWidth: 420, overflow: "hidden" }}
        >
          {/* Header */}
          <div style={{ background: "#FFF7F0", borderBottom: "1px solid rgba(249,115,22,0.15)", padding: "20px 24px 16px", display: "flex", alignItems: "flex-start", gap: 14 }}>
            <div style={{ width: 40, height: 40, borderRadius: "50%", background: "rgba(249,115,22,0.12)", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0, marginTop: 2 }}>
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#F97316" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><path d="M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>
            </div>
            <div style={{ flex: 1 }}>
              <h2 style={{ font: `800 1rem/1 ${fd}`, color: "#1A1D23", margin: 0, letterSpacing: "-0.01em" }}>Alumno ya registrado</h2>
              <p style={{ font: `400 0.78rem/1.4 ${fb}`, color: "#6B7280", margin: "5px 0 0" }}>
                {dupTarget.matchedBy === "phone" ? "Ese número de teléfono" : "Ese DNI"} ya está asociado a otro perfil.
              </p>
            </div>
            <button onClick={() => setDupTarget(null)} style={{ background: "none", border: "none", cursor: "pointer", color: "#9CA3AF", padding: 4, display: "flex", flexShrink: 0 }}><X size={18} /></button>
          </div>

          {/* Existing alumno info */}
          <div style={{ padding: "20px 24px" }}>
            <div style={{ background: "#F9FAFB", border: "1px solid rgba(0,0,0,0.07)", borderRadius: 12, padding: "14px 16px", display: "flex", alignItems: "center", gap: 14 }}>
              <div style={{ width: 42, height: 42, borderRadius: "50%", background: dupTarget.planes?.accent_color ? `${dupTarget.planes.accent_color}20` : "#F0F2F8", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0, font: `700 1rem/1 ${fd}`, color: dupTarget.planes?.accent_color ?? "#6B7280" }}>
                {dupTarget.full_name.charAt(0).toUpperCase()}
              </div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <p style={{ font: `700 0.9rem/1 ${fd}`, color: "#1A1D23", margin: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{dupTarget.full_name}</p>
                <div style={{ display: "flex", alignItems: "center", gap: 8, marginTop: 5, flexWrap: "wrap" }}>
                  {dupTarget.planes && (
                    <span style={{ font: `600 0.65rem/1 ${fb}`, color: dupTarget.planes.accent_color ?? "#6B7280", background: `${dupTarget.planes.accent_color ?? "#6B7280"}18`, padding: "3px 8px", borderRadius: 9999 }}>{dupTarget.planes.nombre}</span>
                  )}
                  <span style={{ font: `500 0.72rem/1 ${fb}`, color: dupTarget.status === "activo" ? "#10B981" : dupTarget.status === "vencido" ? "#EF4444" : "#F59E0B" }}>
                    {dupTarget.status === "activo" ? "Activo" : dupTarget.status === "vencido" ? "Vencido" : "Pendiente"}
                    {dupTarget.next_expiration_date ? ` · vence ${new Date(dupTarget.next_expiration_date + "T00:00:00").toLocaleDateString("es-AR", { day: "numeric", month: "short" })}` : ""}
                  </span>
                </div>
              </div>
            </div>

            <p style={{ font: `400 0.78rem/1.5 ${fb}`, color: "#6B7280", margin: "14px 0 0" }}>
              {dupTarget.status === "vencido"
                ? "Su membresía está vencida. Podés ir al perfil para renovarle el plan directamente."
                : "¿Querés ir al perfil existente en lugar de crear un duplicado?"}
            </p>
          </div>

          {/* Actions */}
          <div style={{ padding: "0 24px 24px", display: "flex", gap: 10 }}>
            <button
              onClick={() => {
                const full = alumnos.find(a => a.id === dupTarget.id);
                setDupTarget(null);
                setModalOpen(false);
                if (full) setFichaTarget(full);
              }}
              style={{ flex: 1, padding: "12px", background: "#FF6A00", color: "white", border: "none", borderRadius: 12, font: `700 0.875rem/1 ${fd}`, cursor: "pointer", boxShadow: "0 4px 14px rgba(255,106,0,0.25)" }}
            >
              Ir al perfil
            </button>
            <button
              onClick={() => setDupTarget(null)}
              style={{ flex: 1, padding: "12px", background: "#F4F5F9", color: "#374151", border: "none", borderRadius: 12, font: `600 0.875rem/1 ${fd}`, cursor: "pointer" }}
            >
              Cancelar
            </button>
          </div>
        </div>
      </div>
    )}

    {exportConfirm && (
      <SensitiveConfirm
        title="Confirmar exportación"
        description="Estás a punto de exportar la base de datos de tus alumnos. Te mandamos un código por WhatsApp para verificar que sos vos."
        onConfirmed={() => { exportConfirm(); setExportConfirm(null); }}
        onCancel={() => setExportConfirm(null)}
      />
    )}

    {/* ── Modal congelar ── */}
    {freezeTarget && (
      <div
        onClick={() => setFreezeTarget(null)}
        style={{ position: "fixed", inset: 0, zIndex: 9010, background: "rgba(0,0,0,0.48)", backdropFilter: "blur(5px)", display: "flex", alignItems: "center", justifyContent: "center", padding: 24 }}
      >
        <div
          onClick={e => e.stopPropagation()}
          style={{ background: "white", borderRadius: 20, padding: "28px 28px 24px", width: "100%", maxWidth: 380, boxShadow: "0 24px 64px rgba(0,0,0,0.18)", position: "relative" }}
        >
          <p style={{ font: `500 0.68rem/1 ${fb}`, color: t3, textTransform: "uppercase" as const, letterSpacing: "0.08em", marginBottom: 4 }}>Congelar membresía</p>
          <h2 style={{ font: `800 1.15rem/1 ${fd}`, color: t1, marginBottom: 6 }}>{freezeTarget.full_name}</h2>
          <p style={{ font: `400 0.8rem/1.5 ${fb}`, color: t2, marginBottom: 20 }}>
            El alumno queda como <strong>pausado</strong>. Al descongelar, su vencimiento se extiende por la cantidad de días que estuvo congelado.
          </p>

          <label style={{ display: "block", font: `500 0.78rem/1 ${fb}`, color: t1, marginBottom: 8 }}>¿Cuántos días?</label>
          <div style={{ display: "flex", gap: 8, marginBottom: 20 }}>
            {[7, 15, 30].map(d => (
              <button
                key={d}
                onClick={() => setFreezeDias(String(d))}
                style={{ flex: 1, padding: "9px", borderRadius: 10, border: "none", font: `600 0.82rem/1 ${fb}`, cursor: "pointer", background: freezeDias === String(d) ? "#1C1C1E" : "#F2F2F7", color: freezeDias === String(d) ? "white" : t2 }}
              >
                {d}d
              </button>
            ))}
            <input
              type="number"
              min={1}
              max={365}
              value={freezeDias}
              onChange={e => setFreezeDias(e.target.value)}
              style={{ width: 70, padding: "9px 10px", borderRadius: 10, border: "1px solid #E5E7EB", font: `600 0.82rem/1 ${fd}`, color: t1, textAlign: "center" as const, outline: "none" }}
            />
          </div>

          <button
            onClick={handleCongelar}
            disabled={freezeSaving || !parseInt(freezeDias)}
            style={{ width: "100%", padding: "12px", borderRadius: 12, border: "none", background: freezeSaving ? "#D1D5DB" : "#1C1C1E", color: "white", font: `700 0.9rem/1 ${fd}`, cursor: freezeSaving ? "wait" : "pointer" }}
          >
            {freezeSaving ? "Congelando..." : `❄️ Congelar ${parseInt(freezeDias) || 0} días`}
          </button>
        </div>
      </div>
    )}
    </>
  );
}
