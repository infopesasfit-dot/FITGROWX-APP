"use client";

import { useState, useEffect, useCallback } from "react";
import { createPortal } from "react-dom";
import { Search, Plus, Users, UserCheck, UserX, TrendingUp, CreditCard, MoreVertical, X, User, Phone, CalendarDays, Mail, Sparkles, Clock, Trash2, CheckCircle } from "lucide-react";

import { supabase } from "@/lib/supabase";
import { getCachedProfile, getPageCache, setPageCache } from "@/lib/gym-cache";

const fd = "var(--font-inter, 'Inter', sans-serif)";
const fb = "var(--font-inter, 'Inter', sans-serif)";
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
  accent_color: string | null;
}

interface Alumno {
  id: string;
  dni: string | null;
  full_name: string;
  phone: string | null;
  plan_id: string | null;
  planes: { nombre: string; accent_color: string | null; precio: number } | null;
  status: Status;
  next_expiration_date: string | null;
}

const STATUS_STYLE: Record<Status, { color: string; bg: string; label: string }> = {
  activo:    { color: "#FF6A00", bg: "rgba(255,106,0,0.08)",   label: "Activo" },
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


const defaultExpiry = () => { const d = new Date(); d.setDate(d.getDate() + 30); return d.toISOString().slice(0, 10); };
const statusFromDate = (dateStr: string | null): Status => {
  if (!dateStr) return "activo";
  return new Date(dateStr) < new Date(new Date().toISOString().slice(0, 10)) ? "vencido" : "activo";
};

const EMPTY_FORM = { full_name: "", dni: "", phone: "", email: "", plan_id: "", fecha_inicio: defaultExpiry() };

export default function AlumnosPage() {
  const [isMobile,        setIsMobile]        = useState(false);
  const [alumnos,         setAlumnos]         = useState<Alumno[]>([]);
  const [loading,         setLoading]         = useState(true);
  const [search,          setSearch]          = useState("");
  const [filtro,          setFiltro]          = useState("todos");
  const [modalOpen,       setModalOpen]       = useState(false);
  const [form,            setForm]            = useState(EMPTY_FORM);
  const [saving,          setSaving]          = useState(false);
  const [formError,       setFormError]       = useState<string | null>(null);
  const [planes,          setPlanes]          = useState<PlanOption[]>([]);
  const [planesLoading,   setPlanesLoading]   = useState(false);
  const [totalCount,      setTotalCount]      = useState(0);
  const [menuOpenId,      setMenuOpenId]      = useState<string | null>(null);
  const [menuPos,         setMenuPos]         = useState<{ top: number; right: number } | null>(null);
  const [editModalOpen,   setEditModalOpen]   = useState(false);
  const [editForm,        setEditForm]        = useState({ id: "", full_name: "", phone: "", plan_id: "", next_expiration_date: "" });
  const [editSaving,      setEditSaving]      = useState(false);
  const [editError,       setEditError]       = useState<string | null>(null);
  const [pagoModalOpen,   setPagoModalOpen]   = useState(false);
  const [pagoTarget,      setPagoTarget]      = useState<Alumno | null>(null);
  const [pagoMonto,       setPagoMonto]       = useState("");
  const [pagoSaving,      setPagoSaving]      = useState(false);
  const [pagoError,       setPagoError]       = useState<string | null>(null);
  const [toast,           setToast]           = useState<string | null>(null);
  const [rutinaModalOpen,  setRutinaModalOpen]  = useState(false);
  const [rutinaTarget,     setRutinaTarget]     = useState<Alumno | null>(null);
  const [rutinaNombre,     setRutinaNombre]     = useState("Mi Rutina");
  const [rutinaEjercicios, setRutinaEjercicios] = useState<{ nombre: string; series: number; repeticiones: number; peso_sugerido: string; descanso: string }[]>([]);
  const [rutinaSaving,     setRutinaSaving]     = useState(false);
  const [rutinaError,      setRutinaError]      = useState<string | null>(null);
  const [objetivo,         setObjetivo]         = useState("Hipertrofia");
  const [notas,            setNotas]            = useState("");
  const [aiLoading,        setAiLoading]        = useState(false);
  const [publicado,        setPublicado]        = useState(false);
  const [rutinatipo,       setRutinatipo]       = useState<"gym" | "wod">("gym");
  const [wodModalidad,     setWodModalidad]     = useState("AMRAP");
  const [wodTimeCap,       setWodTimeCap]       = useState("15");
  const [wodMovimientos,   setWodMovimientos]   = useState<{ nombre: string; reps: string }[]>([]);
  const [gymId,            setGymId]            = useState<string | null>(null);

  // ── Fetch alumnos ─────────────────────────────────────────────────
  const fetchAlumnos = useCallback(async (background = false) => {
    const profile = await getCachedProfile();
    if (!profile) { setLoading(false); return; }
    setGymId(profile.gymId);

    if (!background) {
      const cached = getPageCache<Alumno[]>(`alumnos_${profile.gymId}`);
      if (cached) { setAlumnos(cached); setTotalCount(cached.length); setLoading(false); }
      else setLoading(true);
    }

    const [{ data }, { count }] = await Promise.all([
      supabase
        .from("alumnos")
        .select("id, dni, full_name, phone, plan_id, status, next_expiration_date, planes!plan_id(nombre, accent_color, precio)")
        .eq("gym_id", profile.gymId)
        .order("full_name"),
      supabase
        .from("alumnos")
        .select("id", { count: "exact", head: true })
        .eq("gym_id", profile.gymId),
    ]);

    const rows = (data as unknown as Alumno[]) ?? [];
    setAlumnos(rows);
    setTotalCount(count ?? 0);
    setPageCache(`alumnos_${profile.gymId}`, rows);
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
    setModalOpen(true);

    setPlanesLoading(true);
    if (!gymId) { setPlanesLoading(false); return; }

    const { data } = await supabase
      .from("planes")
      .select("id, nombre, precio, periodo, accent_color")
      .eq("gym_id", gymId)
      .order("created_at");

    const list = (data as PlanOption[]) ?? [];
    setPlanes(list);
    setPlanesLoading(false);

    if (list.length > 0) {
      setForm(f => ({ ...f, plan_id: list[0].id }));
    }
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
    if (!form.email.trim()) { setFormError("El email es obligatorio."); return; }
    if (!form.phone.trim()) { setFormError("El teléfono es obligatorio."); return; }
    setSaving(true);
    setFormError(null);

    if (!gymId) { setFormError("Sesión expirada."); setSaving(false); return; }

    const { data: newAlumno, error } = await supabase.from("alumnos").insert([{
      gym_id:              gymId,
      full_name:           form.full_name.trim(),
      dni:                 form.dni.trim(),
      phone:               normalizePhone(form.phone.trim()),
      email:               form.email.trim() || null,
      plan_id:             form.plan_id || null,
      status:              statusFromDate(form.fecha_inicio || null),
      last_payment_date:   new Date().toISOString().slice(0, 10),
      next_expiration_date: form.fecha_inicio || null,
    }]).select("id").single();

    if (error) {
      setFormError(error.code === "23505" ? "Ya existe un alumno con ese DNI en este gimnasio." : error.message);
      setSaving(false);
      return;
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

    // Bienvenida por WhatsApp con link a /alumno/login
    if (newAlumno?.id && form.phone.trim()) {
      fetch("/api/alumno/send-welcome", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ alumno_id: newAlumno.id }),
      }).catch(() => {});
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
  const openPagoModal = (a: Alumno) => {
    setPagoTarget(a);
    setPagoMonto(String(a.planes?.precio ?? ""));
    setPagoError(null);
    setPagoModalOpen(true);
  };

  const handlePagoSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!pagoTarget) return;
    const monto = parseFloat(pagoMonto);
    if (isNaN(monto) || monto <= 0) { setPagoError("Ingresá un monto válido."); return; }

    setPagoSaving(true);
    setPagoError(null);

    if (!gymId) { setPagoError("Sesión expirada."); setPagoSaving(false); return; }

    const today = new Date();
    const todayStr = today.toISOString().slice(0, 10);

    const base = pagoTarget.next_expiration_date
      ? new Date(Math.max(today.getTime(), new Date(pagoTarget.next_expiration_date).getTime()))
      : today;
    const newExpiry = new Date(base);
    newExpiry.setDate(newExpiry.getDate() + 30);
    const newExpiryStr = newExpiry.toISOString().slice(0, 10);

    const [{ error: pagoErr }, { error: alumnoErr }] = await Promise.all([
      supabase.from("pagos").insert([{
        gym_id:    gymId,
        alumno_id: pagoTarget.id,
        amount:    monto,
        date:      todayStr,
      }]),
      supabase.from("alumnos").update({
        status:              "activo" as Status,
        last_payment_date:   todayStr,
        next_expiration_date: newExpiryStr,
      }).eq("id", pagoTarget.id),
    ]);

    if (pagoErr || alumnoErr) { setPagoError((pagoErr ?? alumnoErr)!.message); setPagoSaving(false); return; }

    // Notificación: pago registrado
    fetch("/api/notifications", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        gym_id: gymId,
        type: "new_payment",
        title: `Pago recibido: ${pagoTarget.full_name}`,
        body: `$${monto.toLocaleString("es-AR")}`,
      }),
    }).catch(() => {});

    if (pagoTarget.phone) {
      const digits = pagoTarget.phone.replace(/\D/g, "");
      let e164 = digits;
      if (!e164.startsWith("54")) e164 = "54" + e164;
      if (e164.startsWith("54") && !e164.startsWith("549")) e164 = "549" + e164.slice(2);
      const msgBody = `¡Hola ${pagoTarget.full_name}! 💪 Confirmamos tu pago de $${monto.toLocaleString("es-AR")}. Tu membresía de FitGrowX está activa.`;
      fetch("/api/whatsapp/send", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ gym_id: gymId, phone: e164, message: msgBody }),
      }).catch(err => console.warn("[WA Motor] Error al enviar confirmación de pago:", err));
    }

    setPagoSaving(false);
    setPagoModalOpen(false);
    setPagoTarget(null);
    setToast("¡Pago registrado con éxito!");
    fetchAlumnos();
  };

  // ── Rutina ────────────────────────────────────────────────────────
  const EMPTY_EJ  = { nombre: "", series: 3, repeticiones: 10, peso_sugerido: "", descanso: "60s" };
  const EMPTY_MOV = { nombre: "", reps: "" };

  const openRutinaModal = async (a: Alumno) => {
    setRutinaTarget(a);
    setRutinaNombre("Mi Rutina");
    setRutinaEjercicios([{ ...EMPTY_EJ }]);
    setWodMovimientos([{ ...EMPTY_MOV }]);
    setRutinaError(null);
    setNotas("");
    setObjetivo("Hipertrofia");
    setRutinatipo("gym");
    setWodModalidad("AMRAP");
    setWodTimeCap("15");
    setPublicado(false);
    setRutinaModalOpen(true);
    const { data } = await supabase.from("rutinas").select("nombre, ejercicios, notas").eq("alumno_id", a.id).maybeSingle();
    if (data) {
      setRutinaNombre(data.nombre);
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const ejercicios = data.ejercicios as any[];
      if (ejercicios?.[0]?._meta) {
        const meta = ejercicios[0];
        setRutinatipo("wod");
        setWodModalidad(meta.modalidad ?? "AMRAP");
        setWodTimeCap(meta.time_cap ?? "15");
        setWodMovimientos(ejercicios.slice(1).map((e: { nombre?: string; reps?: string }) => ({ nombre: e.nombre ?? "", reps: e.reps ?? "" })));
      } else {
        setRutinatipo("gym");
        setRutinaEjercicios(ejercicios.map(e => ({ ...EMPTY_EJ, ...e })));
      }
      setNotas(data.notas ?? "");
    }
  };

  const handleRutinaSave = async () => {
    if (!rutinaTarget) return;
    setRutinaError(null);

    let ejerciciosToSave: object[];
    if (rutinatipo === "wod") {
      const validMov = wodMovimientos.filter(m => m.nombre.trim());
      if (validMov.length === 0) { setRutinaError("Agregá al menos un movimiento."); return; }
      ejerciciosToSave = [{ _meta: true, modalidad: wodModalidad, time_cap: wodTimeCap }, ...validMov];
    } else {
      const valid = rutinaEjercicios.filter(ej => ej.nombre.trim());
      if (valid.length === 0) { setRutinaError("Agregá al menos un ejercicio."); return; }
      ejerciciosToSave = valid;
    }

    setRutinaSaving(true);
    if (!gymId) { setRutinaError("Sesión expirada."); setRutinaSaving(false); return; }
    const res = await fetch("/api/alumno/rutina", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ gym_id: gymId, alumno_id: rutinaTarget.id, nombre: rutinaNombre.trim(), ejercicios: ejerciciosToSave, notas: notas.trim() || null }),
    });
    const d = await res.json();
    if (!res.ok || d.error) { setRutinaError(d.error ?? "Error al guardar."); setRutinaSaving(false); return; }
    setRutinaSaving(false);
    setPublicado(true);
    setTimeout(() => {
      setRutinaModalOpen(false);
      setPublicado(false);
      setToast(`✓ ${rutinatipo === "wod" ? "WOD" : "Rutina"} publicado para ${rutinaTarget.full_name}`);
    }, 1600);
  };

  const handleAISugerir = async () => {
    if (!rutinaTarget || aiLoading) return;
    setAiLoading(true);
    setRutinaError(null);
    try {
      const body = rutinatipo === "wod"
        ? { tipo: "wod", modalidad: wodModalidad, time_cap: wodTimeCap, alumno_name: rutinaTarget.full_name, notas }
        : { objetivo, alumno_name: rutinaTarget.full_name, notas };
      const res = await fetch("/api/rutina/sugerir", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const d = await res.json();
      if (rutinatipo === "wod") {
        if (d.movimientos) {
          setWodMovimientos(d.movimientos.map((m: { nombre: string; reps: string }) => ({ nombre: m.nombre ?? "", reps: m.reps ?? "" })));
          setRutinaNombre(d.nombre ?? `WOD ${wodModalidad}`);
          setWodModalidad(d.modalidad ?? wodModalidad);
          setWodTimeCap(d.time_cap ?? wodTimeCap);
        } else {
          setRutinaError(d.error ?? "Error al generar el WOD.");
        }
      } else {
        if (d.ejercicios) {
          setRutinaEjercicios(d.ejercicios.map((e: { nombre: string; series: number; repeticiones: number; peso_sugerido: string; descanso: string }) => ({ ...EMPTY_EJ, ...e })));
          setRutinaNombre(d.nombre ?? `${objetivo} — ${rutinaTarget.full_name.split(" ")[0]}`);
        } else {
          setRutinaError(d.error ?? "Error al generar la rutina.");
        }
      }
    } catch {
      setRutinaError("Error de red. Intentá de nuevo.");
    }
    setAiLoading(false);
  };

  // ── Pausar / Reanudar ─────────────────────────────────────────────
  const handlePausar = async (id: string) => {
    const { error } = await supabase.from("alumnos").update({ status: "pausado" as Status }).eq("id", id);
    if (!error) fetchAlumnos();
  };

  const handleReanudar = async (id: string) => {
    const { error } = await supabase.from("alumnos").update({ status: "activo" as Status }).eq("id", id);
    if (!error) fetchAlumnos();
  };

  // ── Eliminar Alumno ───────────────────────────────────────────────
  const handleEliminar = async (id: string, name: string) => {
    if (!confirm(`¿Eliminar a ${name}? Esta acción no se puede deshacer.`)) return;
    const { error } = await supabase.from("alumnos").delete().eq("id", id);
    if (!error) fetchAlumnos();
  };

  // ── Editar Alumno ─────────────────────────────────────────────────
  const openEditModal = async (a: Alumno) => {
    setEditForm({ id: a.id, full_name: a.full_name, phone: a.phone ?? "", plan_id: a.plan_id ?? "", next_expiration_date: a.next_expiration_date ?? "" });
    setEditError(null);
    setEditModalOpen(true);
    if (planes.length === 0 && gymId) {
      setPlanesLoading(true);
      const { data } = await supabase.from("planes").select("id, nombre, precio, periodo, accent_color").eq("gym_id", gymId).order("created_at");
      setPlanes((data as PlanOption[]) ?? []);
      setPlanesLoading(false);
    }
  };

  const handleEditSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setEditSaving(true);
    setEditError(null);
    const { error } = await supabase.from("alumnos").update({
      full_name:            editForm.full_name.trim(),
      phone:                normalizePhone(editForm.phone.trim()),
      plan_id:              editForm.plan_id || null,
      next_expiration_date: editForm.next_expiration_date || null,
      status:               statusFromDate(editForm.next_expiration_date || null),
    }).eq("id", editForm.id);
    if (error) { setEditError(error.message); setEditSaving(false); return; }
    setEditModalOpen(false);
    setEditSaving(false);
    fetchAlumnos();
  };

  // ── Derived state ─────────────────────────────────────────────────
  const lista = alumnos.filter(a => {
    const q = search.toLowerCase();
    return (
      (a.full_name.toLowerCase().includes(q) ||
       (a.planes?.nombre ?? "").toLowerCase().includes(q) ||
       (a.phone ?? "").toLowerCase().includes(q) ||
       (a.dni ?? "").toLowerCase().includes(q)) &&
      (filtro === "todos" || a.status === filtro)
    );
  });

  const activos    = alumnos.filter(a => a.status === "activo").length;
  const vencidos   = alumnos.filter(a => a.status === "vencido").length;
  const pendientes = alumnos.filter(a => a.status === "pendiente").length;

  return (
    <>
    <div style={{ display: "flex", flexDirection: "column", gap: 18 }}>

      {/* Header */}
      <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 12 }}>
        <div>
          <p style={{ font: `500 0.72rem/1 ${fb}`, color: t3, textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: 6 }}>Gestión</p>
          <h1 style={{ font: `800 ${isMobile ? "1.5rem" : "2rem"}/1 ${fd}`, color: t1, letterSpacing: "-0.02em" }}>Alumnos</h1>
          {!isMobile && <p style={{ font: `400 0.875rem/1.4 ${fb}`, color: t2, marginTop: 4 }}>Administra y monitorea a todos los miembros.</p>}
        </div>
        <button
          onClick={openModal}
          style={{ flexShrink: 0, display: "flex", alignItems: "center", gap: 6, background: "#F97316", color: "white", border: "none", padding: isMobile ? "10px 16px" : "10px 20px", borderRadius: 12, font: `700 0.875rem/1 ${fd}`, cursor: "pointer", boxShadow: "0 4px 14px rgba(249,115,22,0.25)" }}
        >
          <Plus size={15} />{isMobile ? "Nuevo" : "Nuevo Alumno"}
        </button>
      </div>

      {/* KPI row */}
      <div style={{ display: "grid", gridTemplateColumns: isMobile ? "1fr 1fr" : "repeat(4, 1fr)", gap: isMobile ? 10 : 14 }}>
        {[
          { label: "Total",      value: totalCount, icon: <Users      size={16} color="white" />, sub: "registrados" },
          { label: "Activos",    value: activos,    icon: <UserCheck  size={16} color="white" />, sub: "en regla" },
          { label: "Vencidos",   value: vencidos,   icon: <UserX      size={16} color="white" />, sub: "sin renovar" },
          { label: "Pendientes", value: pendientes, icon: <TrendingUp size={16} color="white" />, sub: "por confirmar" },
        ].map(s => (
          <div key={s.label} style={{ ...card, padding: "16px 18px", transition: "box-shadow 0.2s, transform 0.2s" }}
            onMouseEnter={e => { (e.currentTarget as HTMLDivElement).style.boxShadow = "0 8px 28px rgba(0,0,0,0.10)"; (e.currentTarget as HTMLDivElement).style.transform = "translateY(-2px)"; }}
            onMouseLeave={e => { (e.currentTarget as HTMLDivElement).style.boxShadow = card.boxShadow; (e.currentTarget as HTMLDivElement).style.transform = "none"; }}
          >
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 10 }}>
              <span style={{ font: `500 0.72rem/1 ${fb}`, color: t3, textTransform: "uppercase", letterSpacing: "0.06em" }}>{s.label}</span>
              <div style={{ width: 30, height: 30, borderRadius: 8, background: "#2C2C2E", display: "flex", alignItems: "center", justifyContent: "center" }}>{s.icon}</div>
            </div>
            <p style={{ font: `800 1.8rem/1 ${fd}`, color: t1, marginBottom: 4 }}>{loading ? "—" : s.value}</p>
            <p style={{ font: `400 0.72rem/1 ${fb}`, color: t3 }}>{s.sub}</p>
          </div>
        ))}
      </div>

      {/* Search + Filters */}
      <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
        <div style={{ position: "relative" }}>
          <Search size={14} style={{ position: "absolute", left: 12, top: "50%", transform: "translateY(-50%)", color: t3 }} />
          <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Buscar alumno o plan..."
            style={{ width: "100%", padding: "10px 14px 10px 32px", background: "white", border: "1px solid rgba(0,0,0,0.08)", borderRadius: 12, font: `400 0.85rem/1 ${fb}`, color: t1, outline: "none", boxSizing: "border-box" as const }} />
        </div>
        <div style={{ display: "flex", gap: 6, overflowX: "auto", paddingBottom: 2 }}>
          {[["todos","Todos"],["activo","Activo"],["vencido","Vencido"],["pendiente","Pendiente"]].map(([val, lbl]) => (
            <button key={val} onClick={() => setFiltro(val)} style={{ flexShrink: 0, padding: "7px 16px", borderRadius: 9999, border: "none", font: `600 0.78rem/1 ${fb}`, cursor: "pointer", transition: "all 0.14s", background: filtro === val ? "#1A1D23" : "white", color: filtro === val ? "white" : t2, boxShadow: filtro === val ? "none" : "0 1px 4px rgba(0,0,0,0.08)" }}>{lbl}</button>
          ))}
        </div>
      </div>

      {/* Table card — desktop */}
      {!isMobile && (
        <div style={{ ...card, padding: 0, overflow: "hidden" }}>
          <table style={{ width: "100%", borderCollapse: "collapse" }}>
            <thead>
              <tr style={{ borderBottom: "1px solid rgba(0,0,0,0.06)" }}>
                {["Alumno", "DNI", "Plan", "Estado", "Vence", "Teléfono", "Acciones"].map(h => (
                  <th key={h} style={{ padding: "10px 20px", textAlign: "left", font: `600 0.7rem/1 ${fb}`, color: t3, textTransform: "uppercase", letterSpacing: "0.07em" }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr><td colSpan={7} style={{ padding: "40px", textAlign: "center", font: `400 0.875rem/1 ${fb}`, color: t3 }}>Cargando alumnos...</td></tr>
              ) : lista.length === 0 ? (
                <tr><td colSpan={7} style={{ padding: "48px", textAlign: "center", font: `400 0.875rem/1.5 ${fb}`, color: t3 }}>
                  {alumnos.length === 0 ? "No hay alumnos registrados aún." : "No se encontraron alumnos con ese filtro."}
                </td></tr>
              ) : lista.map((a, i) => {
                const planNombre = a.planes?.nombre ?? "—";
                const planColor  = a.planes?.accent_color ?? t2;
                const planBg     = a.planes?.accent_color ? `${a.planes.accent_color}18` : "#F0F2F8";
                const isPausado  = a.status === "pausado";
                return (
                  <tr key={a.id} style={{ borderBottom: i < lista.length - 1 ? "1px solid rgba(0,0,0,0.04)" : "none", ...(isPausado ? { opacity: 0.65, background: "#F5F5F7" } : {}) }}
                    onMouseEnter={e => (e.currentTarget.style.background = isPausado ? "#EFEFEF" : "#FAFBFD")}
                    onMouseLeave={e => (e.currentTarget.style.background = isPausado ? "#F5F5F7" : "transparent")}
                  >
                    <td style={{ padding: "13px 20px" }}>
                      <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                        <div style={{ width: 34, height: 34, borderRadius: "50%", background: "#2C2C2E", display: "flex", alignItems: "center", justifyContent: "center", font: `700 0.65rem/1 ${fd}`, color: "white", flexShrink: 0 }}>{initials(a.full_name)}</div>
                        <span style={{ font: `600 0.875rem/1 ${fd}`, color: t1 }}>{a.full_name}</span>
                      </div>
                    </td>
                    <td style={{ padding: "13px 20px", font: `500 0.83rem/1 ${fb}`, color: t2 }}>{a.dni ?? <span style={{ color: t3 }}>—</span>}</td>
                    <td style={{ padding: "13px 20px" }}><span style={{ font: `600 0.75rem/1 ${fb}`, color: planColor, background: planBg, padding: "4px 10px", borderRadius: 9999 }}>{planNombre}</span></td>
                    <td style={{ padding: "13px 20px" }}><span style={{ font: `600 0.72rem/1 ${fb}`, color: STATUS_STYLE[a.status].color, background: STATUS_STYLE[a.status].bg, padding: "4px 10px", borderRadius: 9999 }}>{STATUS_STYLE[a.status].label}</span></td>
                    <td style={{ padding: "13px 20px", font: `400 0.83rem/1 ${fb}`, color: t2 }}>{a.next_expiration_date ?? "—"}</td>
                    <td style={{ padding: "13px 20px", font: `400 0.83rem/1 ${fb}`, color: t2 }}>{a.phone ?? <span style={{ color: t3 }}>—</span>}</td>
                    <td style={{ padding: "13px 20px" }}>
                      <div style={{ display: "flex", alignItems: "center", gap: 2 }}>
                        <button disabled={!a.phone} onClick={() => a.phone && openWhatsApp(a.phone, a.full_name)} style={{ background: "none", border: "none", cursor: a.phone ? "pointer" : "default", color: a.phone ? "#25D366" : t3, width: 30, height: 30, borderRadius: "50%", display: "flex", alignItems: "center", justifyContent: "center", opacity: a.phone ? 1 : 0.35 }}>
                          <svg width={18} height={18} viewBox="0 0 24 24" fill="currentColor"><path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347z"/><path d="M12 0C5.373 0 0 5.373 0 12c0 2.124.558 4.118 1.535 5.845L.057 23.5l5.828-1.528A11.945 11.945 0 0012 24c6.627 0 12-5.373 12-12S18.627 0 12 0zm0 21.882a9.877 9.877 0 01-5.032-1.374l-.36-.214-3.733.979.995-3.638-.235-.374A9.863 9.863 0 012.118 12C2.118 6.534 6.534 2.118 12 2.118S21.882 6.534 21.882 12 17.466 21.882 12 21.882z"/></svg>
                        </button>
                        <button onClick={() => openPagoModal(a)} style={{ background: "none", border: "none", cursor: "pointer", color: t3, width: 30, height: 30, borderRadius: "50%", display: "flex", alignItems: "center", justifyContent: "center" }}><CreditCard size={18} /></button>
                        <button onClick={e => { e.stopPropagation(); if (menuOpenId === a.id) { setMenuOpenId(null); setMenuPos(null); return; } const rect = (e.currentTarget as HTMLButtonElement).getBoundingClientRect(); setMenuPos({ top: rect.bottom + 4, right: window.innerWidth - rect.right }); setMenuOpenId(a.id); }} style={{ background: "none", border: "none", cursor: "pointer", color: t3, width: 30, height: 30, borderRadius: "50%", display: "flex", alignItems: "center", justifyContent: "center" }}><MoreVertical size={18} /></button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "12px 20px", borderTop: "1px solid rgba(0,0,0,0.06)" }}>
            <span style={{ font: `400 0.78rem/1 ${fb}`, color: t3 }}>{loading ? "Cargando..." : `Mostrando ${lista.length} de ${totalCount} alumnos`}</span>
            <button style={{ font: `500 0.78rem/1 ${fb}`, color: "#4B6BFB", background: "none", border: "none", cursor: "pointer" }}>Exportar lista →</button>
          </div>
        </div>
      )}

      {/* Card list — mobile */}
      {isMobile && (
        <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
          {loading ? (
            <p style={{ textAlign: "center", font: `400 0.85rem/1 ${fb}`, color: t3, padding: "32px 0" }}>Cargando...</p>
          ) : lista.length === 0 ? (
            <p style={{ textAlign: "center", font: `400 0.85rem/1.5 ${fb}`, color: t3, padding: "40px 0" }}>{alumnos.length === 0 ? "No hay alumnos aún." : "Sin resultados."}</p>
          ) : lista.map(a => {
            const planNombre = a.planes?.nombre ?? "—";
            const planColor  = a.planes?.accent_color ?? t2;
            const planBg     = a.planes?.accent_color ? `${a.planes.accent_color}18` : "#F0F2F8";
            return (
              <div key={a.id} style={{ background: "white", borderRadius: 18, padding: "14px 16px", boxShadow: "0 2px 12px rgba(0,0,0,0.06)", border: "1px solid rgba(0,0,0,0.05)" }}>
                <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 12 }}>
                  <div style={{ width: 40, height: 40, borderRadius: 12, background: "#1A1D23", display: "flex", alignItems: "center", justifyContent: "center", font: `700 0.7rem/1 ${fd}`, color: "white", flexShrink: 0 }}>{initials(a.full_name)}</div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <p style={{ font: `700 0.9rem/1 ${fd}`, color: t1, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{a.full_name}</p>
                    <p style={{ font: `400 0.7rem/1 ${fb}`, color: t3, marginTop: 3 }}>DNI: {a.dni ?? "—"}</p>
                  </div>
                  <span style={{ font: `600 0.68rem/1 ${fb}`, color: STATUS_STYLE[a.status].color, background: STATUS_STYLE[a.status].bg, padding: "4px 10px", borderRadius: 9999, flexShrink: 0 }}>{STATUS_STYLE[a.status].label}</span>
                </div>
                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                    <span style={{ font: `600 0.68rem/1 ${fb}`, color: planColor, background: planBg, padding: "3px 9px", borderRadius: 9999 }}>{planNombre}</span>
                    {a.next_expiration_date && <span style={{ font: `400 0.68rem/1 ${fb}`, color: t3 }}>Vence {a.next_expiration_date}</span>}
                  </div>
                  <div style={{ display: "flex", gap: 6 }}>
                    {a.phone && (
                      <button onClick={() => openWhatsApp(a.phone!, a.full_name)} style={{ width: 32, height: 32, borderRadius: 9, background: "rgba(37,211,102,0.10)", border: "none", display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer", color: "#25D366" }}>
                        <svg width={15} height={15} viewBox="0 0 24 24" fill="currentColor"><path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347z"/><path d="M12 0C5.373 0 0 5.373 0 12c0 2.124.558 4.118 1.535 5.845L.057 23.5l5.828-1.528A11.945 11.945 0 0012 24c6.627 0 12-5.373 12-12S18.627 0 12 0zm0 21.882a9.877 9.877 0 01-5.032-1.374l-.36-.214-3.733.979.995-3.638-.235-.374A9.863 9.863 0 012.118 12C2.118 6.534 6.534 2.118 12 2.118S21.882 6.534 21.882 12 17.466 21.882 12 21.882z"/></svg>
                      </button>
                    )}
                    <button onClick={() => openPagoModal(a)} style={{ width: 32, height: 32, borderRadius: 9, background: "rgba(75,107,251,0.08)", border: "none", display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer", color: "#4B6BFB" }}><CreditCard size={14} /></button>
                    <button onClick={e => { e.stopPropagation(); if (menuOpenId === a.id) { setMenuOpenId(null); setMenuPos(null); return; } const rect = (e.currentTarget as HTMLButtonElement).getBoundingClientRect(); setMenuPos({ top: rect.bottom + 4, right: window.innerWidth - rect.right }); setMenuOpenId(a.id); }} style={{ width: 32, height: 32, borderRadius: 9, background: "#F4F5F9", border: "none", display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer", color: t3 }}><MoreVertical size={14} /></button>
                  </div>
                </div>
              </div>
            );
          })}
          <p style={{ textAlign: "center", font: `400 0.72rem/1 ${fb}`, color: t3, paddingTop: 4 }}>{lista.length} de {totalCount} alumnos</p>
        </div>
      )}
    </div>

    {/* ── Modal: Nuevo Alumno ── */}
    {modalOpen && (
      <div
        onClick={() => setModalOpen(false)}
        style={{
          position: "fixed", inset: 0, zIndex: 100,
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
              <p style={{ font: `400 0.78rem/1 ${fb}`, color: t3, marginTop: 4 }}>Completá los datos para registrar al miembro.</p>
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
          <form onSubmit={handleSubmit} style={{ padding: "20px 24px 24px", display: "flex", flexDirection: "column", gap: 16 }}>

            {/* Nombre */}
            <div>
              <label style={{ display: "block", font: `500 0.78rem/1 ${fb}`, color: t1, marginBottom: 6 }}>Nombre completo *</label>
              <div style={{ position: "relative" }}>
                <User size={14} style={{ position: "absolute", left: 13, top: "50%", transform: "translateY(-50%)", color: t3, pointerEvents: "none" }} />
                <input
                  required
                  value={form.full_name}
                  onChange={e => setForm(f => ({ ...f, full_name: e.target.value }))}
                  placeholder="Ej: Carlos Mendez"
                  style={{ width: "100%", padding: "11px 14px 11px 36px", background: "#F9FAFB", border: "1px solid rgba(0,0,0,0.09)", borderRadius: 10, font: `400 0.875rem/1 ${fb}`, color: t1, outline: "none", boxSizing: "border-box" as const, transition: "border-color 0.14s" }}
                  onFocus={e => (e.currentTarget.style.borderColor = "#F97316")}
                  onBlur={e => (e.currentTarget.style.borderColor = "rgba(0,0,0,0.09)")}
                />
              </div>
            </div>

            {/* DNI */}
            <div>
              <label style={{ display: "block", font: `500 0.78rem/1 ${fb}`, color: t1, marginBottom: 6 }}>DNI *</label>
              <div style={{ position: "relative" }}>
                <input
                  required
                  value={form.dni}
                  onChange={e => setForm(f => ({ ...f, dni: e.target.value.replace(/\D/g, "") }))}
                  placeholder="Ej: 40123456"
                  maxLength={9}
                  style={{ width: "100%", padding: "11px 14px", background: "#F9FAFB", border: "1px solid rgba(0,0,0,0.09)", borderRadius: 10, font: `400 0.875rem/1 ${fb}`, color: t1, outline: "none", boxSizing: "border-box" as const, transition: "border-color 0.14s" }}
                  onFocus={e => (e.currentTarget.style.borderColor = "#F97316")}
                  onBlur={e => (e.currentTarget.style.borderColor = "rgba(0,0,0,0.09)")}
                />
              </div>
            </div>

            {/* Email */}
            <div>
              <label style={{ display: "block", font: `500 0.78rem/1 ${fb}`, color: t1, marginBottom: 6 }}>Email *</label>
              <div style={{ position: "relative" }}>
                <Mail size={14} style={{ position: "absolute", left: 13, top: "50%", transform: "translateY(-50%)", color: t3, pointerEvents: "none" }} />
                <input
                  required
                  type="email"
                  value={form.email}
                  onChange={e => setForm(f => ({ ...f, email: e.target.value }))}
                  placeholder="carlos@email.com"
                  style={{ width: "100%", padding: "11px 14px 11px 36px", background: "#F9FAFB", border: "1px solid rgba(0,0,0,0.09)", borderRadius: 10, font: `400 0.875rem/1 ${fb}`, color: t1, outline: "none", boxSizing: "border-box" as const, transition: "border-color 0.14s" }}
                  onFocus={e => (e.currentTarget.style.borderColor = "#F97316")}
                  onBlur={e => (e.currentTarget.style.borderColor = "rgba(0,0,0,0.09)")}
                />
              </div>
            </div>

            {/* Teléfono */}
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
                  style={{ width: "100%", padding: "11px 36px 11px 36px", background: "#F9FAFB", border: "1px solid rgba(0,0,0,0.09)", borderRadius: 10, font: `400 0.875rem/1 ${fb}`, color: t1, outline: "none", boxSizing: "border-box" as const, transition: "border-color 0.14s" }}
                  onFocus={e => (e.currentTarget.style.borderColor = "#25D366")}
                  onBlur={e => (e.currentTarget.style.borderColor = "rgba(0,0,0,0.09)")}
                />
              </div>
              <p style={{ font: `400 0.7rem/1 ${fb}`, color: t3, marginTop: 5 }}>Formato internacional sin + ni espacios. n8n lo usará para automatizaciones.</p>
            </div>

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

    {/* ── Portal: More Actions dropdown ── */}
    {menuOpenId && menuPos && typeof document !== "undefined" && createPortal(
      (() => {
        const target = alumnos.find(a => a.id === menuOpenId);
        if (!target) return null;
        return (
          <div onClick={e => e.stopPropagation()} style={{ position: "fixed", top: menuPos.top, right: menuPos.right, zIndex: 9999, background: "#FFFFFF", border: "1px solid rgba(0,0,0,0.08)", borderRadius: 10, boxShadow: "0 8px 24px rgba(0,0,0,0.12)", minWidth: 178, overflow: "hidden" }}>
            {[
              { label: "Asignar Rutina", color: "#1E50F0", action: () => { openRutinaModal(target); setMenuOpenId(null); setMenuPos(null); } },
              { label: "Editar Datos", color: t1, action: () => { openEditModal(target); setMenuOpenId(null); setMenuPos(null); } },
              target.status === "pausado"
                ? { label: "Reanudar Membresía", color: "#FF6A00", action: () => { handleReanudar(target.id); setMenuOpenId(null); setMenuPos(null); } }
                : { label: "Pausar Membresía",   color: "#64748B", action: () => { handlePausar(target.id);   setMenuOpenId(null); setMenuPos(null); } },
              { label: "Eliminar Alumno", color: "#DC2626", action: () => { handleEliminar(target.id, target.full_name); setMenuOpenId(null); setMenuPos(null); } },
            ].map(item => (
              <button key={item.label} onClick={item.action}
                style={{ display: "block", width: "100%", textAlign: "left", padding: "10px 14px", background: "none", border: "none", font: `500 0.825rem/1 ${fb}`, color: item.color, cursor: "pointer" }}
                onMouseEnter={e => (e.currentTarget.style.background = "#F9FAFB")}
                onMouseLeave={e => (e.currentTarget.style.background = "none")}
              >{item.label}</button>
            ))}
          </div>
        );
      })(),
      document.body
    )}

    {/* ── Modal: Editar Alumno ── */}
    {editModalOpen && (
      <div onClick={() => setEditModalOpen(false)} style={{ position: "fixed", inset: 0, zIndex: 100, background: "rgba(0,0,0,0.40)", backdropFilter: "blur(6px)", WebkitBackdropFilter: "blur(6px)", display: "flex", alignItems: isMobile ? "flex-end" : "center", justifyContent: "center", padding: isMobile ? 0 : 20, paddingBottom: isMobile ? "calc(64px + env(safe-area-inset-bottom, 0px))" : undefined }}>
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
    {/* ── Modal: Registrar Pago ── */}
    {pagoModalOpen && pagoTarget && (
      <div style={{ position: "fixed", inset: 0, zIndex: 100, background: "rgba(0,0,0,0.40)", backdropFilter: "blur(6px)", WebkitBackdropFilter: "blur(6px)", display: "flex", alignItems: isMobile ? "flex-end" : "center", justifyContent: "center", padding: isMobile ? 0 : 20, paddingBottom: isMobile ? "calc(64px + env(safe-area-inset-bottom, 0px))" : undefined }}>
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
            <div style={{ background: "rgba(75,107,251,0.06)", border: "1px solid rgba(75,107,251,0.14)", borderRadius: 10, padding: "10px 14px", font: `400 0.78rem/1.5 ${fb}`, color: "#4B6BFB" }}>
              Esto marcará al alumno como <strong>Activo</strong> y extenderá su vencimiento 30 días.
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
                  <p style={{ font: `300 0.6rem/1 ${fd}`, color: "rgba(255,255,255,0.45)", letterSpacing: "0.18em", textTransform: "uppercase", marginBottom: 5 }}>Rutina para</p>
                  <h2 style={{ font: `800 1.2rem/1.1 ${fd}`, color: "white", letterSpacing: "-0.025em" }}>{rutinaTarget.full_name}</h2>
                </div>
              </div>
              <button onClick={() => setRutinaModalOpen(false)} style={{ width: 32, height: 32, borderRadius: "50%", background: "rgba(255,255,255,0.1)", border: "none", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", color: "rgba(255,255,255,0.6)", flexShrink: 0, marginTop: 2 }}>
                <X size={15} />
              </button>
            </div>

            {/* Tipo toggle */}
            <div style={{ marginTop: 16, position: "relative", zIndex: 1 }}>
              <div style={{ display: "flex", gap: 6, background: "rgba(255,255,255,0.05)", borderRadius: 10, padding: 4 }}>
                {(["gym", "wod"] as const).map(t => (
                  <button
                    key={t}
                    onClick={() => setRutinatipo(t)}
                    style={{
                      flex: 1, padding: "8px 0", borderRadius: 8, border: "none", cursor: "pointer", transition: "all 0.15s",
                      background: rutinatipo === t ? "white" : "transparent",
                      color: rutinatipo === t ? "#111318" : "rgba(255,255,255,0.4)",
                      font: `700 0.78rem/1 ${fd}`,
                      boxShadow: rutinatipo === t ? "0 1px 4px rgba(0,0,0,0.2)" : "none",
                    }}
                  >
                    {t === "gym" ? "🏋️ Gym" : "⚡ WOD CrossFit"}
                  </button>
                ))}
              </div>
            </div>

            {/* Gym: objetivo chips */}
            {rutinatipo === "gym" && (
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

            {/* WOD: modalidad + time cap */}
            {rutinatipo === "wod" && (
              <div style={{ marginTop: 14, position: "relative", zIndex: 1 }}>
                <p style={{ font: `500 0.65rem/1 ${fd}`, color: "rgba(255,255,255,0.4)", letterSpacing: "0.12em", textTransform: "uppercase", marginBottom: 8 }}>Modalidad</p>
                <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginBottom: 12 }}>
                  {["AMRAP", "For Time", "EMOM", "Chipper"].map(m => (
                    <button
                      key={m}
                      onClick={() => setWodModalidad(m)}
                      style={{
                        padding: "6px 14px", borderRadius: 9999, border: `1px solid ${wodModalidad === m ? "rgba(99,102,241,0.5)" : "rgba(255,255,255,0.1)"}`,
                        background: wodModalidad === m ? "rgba(99,102,241,0.14)" : "rgba(255,255,255,0.04)",
                        color: wodModalidad === m ? "#818cf8" : "rgba(255,255,255,0.4)",
                        font: `${wodModalidad === m ? "700" : "400"} 0.72rem/1 ${fd}`, cursor: "pointer", transition: "all 0.15s",
                      }}
                    >{m}</button>
                  ))}
                </div>
                <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                  <p style={{ font: `500 0.65rem/1 ${fd}`, color: "rgba(255,255,255,0.4)", letterSpacing: "0.12em", textTransform: "uppercase", flexShrink: 0 }}>Time Cap</p>
                  <input
                    type="number" min={1} max={90}
                    value={wodTimeCap}
                    onChange={e => setWodTimeCap(e.target.value)}
                    style={{ width: 60, padding: "5px 10px", background: "rgba(255,255,255,0.07)", border: "1px solid rgba(255,255,255,0.12)", borderRadius: 8, font: `600 0.85rem/1 ${fd}`, color: "white", outline: "none", textAlign: "center" }}
                  />
                  <span style={{ font: `400 0.72rem/1 ${fd}`, color: "rgba(255,255,255,0.3)" }}>min</span>
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
                : <><Sparkles size={16} /> {rutinatipo === "wod" ? "Generar WOD con IA" : "Sugerir con IA"}</>
              }
            </button>
          </div>

          {/* ── Body (scrollable) ── */}
          <div style={{ flex: 1, overflowY: "auto", padding: "20px 24px" }}>

            {/* Nombre de la rutina */}
            <div style={{ marginBottom: 20 }}>
              <label style={{ display: "block", font: `500 0.72rem/1 ${fb}`, color: t2, marginBottom: 6, textTransform: "uppercase", letterSpacing: "0.07em" }}>Nombre de la rutina</label>
              <input
                value={rutinaNombre}
                onChange={e => setRutinaNombre(e.target.value)}
                placeholder="Ej: Hipertrofia Upper Body"
                style={{ width: "100%", padding: "10px 14px", background: "white", border: "1px solid rgba(0,0,0,0.1)", borderRadius: 10, font: `600 0.9rem/1 ${fd}`, color: t1, outline: "none", boxSizing: "border-box" }}
                onFocus={e => (e.currentTarget.style.borderColor = "#F97316")}
                onBlur={e => (e.currentTarget.style.borderColor = "rgba(0,0,0,0.1)")}
              />
            </div>

            {/* Gym: tabla de ejercicios */}
            {rutinatipo === "gym" && (
              <div style={{ marginBottom: 20 }}>
                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 10 }}>
                  <label style={{ font: `600 0.72rem/1 ${fd}`, color: t1, textTransform: "uppercase", letterSpacing: "0.07em" }}>Ejercicios ({rutinaEjercicios.length})</label>
                </div>
                <div style={{ display: "grid", gridTemplateColumns: "2fr 52px 52px 72px 64px 32px", gap: 6, padding: "0 8px", marginBottom: 6 }}>
                  {["Ejercicio", "Series", "Reps", "Carga", "Descanso", ""].map(h => (
                    <span key={h} style={{ font: `600 0.62rem/1 ${fb}`, color: t3, textTransform: "uppercase", letterSpacing: "0.06em" }}>{h}</span>
                  ))}
                </div>
                <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                  {rutinaEjercicios.map((ej, i) => (
                    <div key={i} style={{ display: "grid", gridTemplateColumns: "2fr 52px 52px 72px 64px 32px", gap: 6, alignItems: "center", background: "white", border: "1px solid rgba(0,0,0,0.07)", borderRadius: 10, padding: "8px 8px" }}>
                      <input
                        placeholder="Nombre del ejercicio"
                        value={ej.nombre}
                        onChange={e => setRutinaEjercicios(prev => prev.map((x, j) => j === i ? { ...x, nombre: e.target.value } : x))}
                        style={{ padding: "7px 10px", background: "#F9FAFB", border: "1px solid rgba(0,0,0,0.07)", borderRadius: 8, font: `500 0.82rem/1 ${fb}`, color: t1, outline: "none", width: "100%", boxSizing: "border-box" }}
                        onFocus={e => (e.currentTarget.style.borderColor = "#F97316")}
                        onBlur={e => (e.currentTarget.style.borderColor = "rgba(0,0,0,0.07)")}
                      />
                      {(["series", "repeticiones"] as const).map(key => (
                        <input
                          key={key}
                          type="number"
                          min={1}
                          value={ej[key]}
                          onChange={e => setRutinaEjercicios(prev => prev.map((x, j) => j === i ? { ...x, [key]: Number(e.target.value) } : x))}
                          style={{ padding: "7px 6px", background: "#F9FAFB", border: "1px solid rgba(0,0,0,0.07)", borderRadius: 8, font: `500 0.82rem/1 ${fb}`, color: t1, outline: "none", width: "100%", boxSizing: "border-box", textAlign: "center" }}
                          onFocus={e => (e.currentTarget.style.borderColor = "#F97316")}
                          onBlur={e => (e.currentTarget.style.borderColor = "rgba(0,0,0,0.07)")}
                        />
                      ))}
                      <input
                        placeholder="20kg"
                        value={ej.peso_sugerido}
                        onChange={e => setRutinaEjercicios(prev => prev.map((x, j) => j === i ? { ...x, peso_sugerido: e.target.value } : x))}
                        style={{ padding: "7px 6px", background: "#F9FAFB", border: "1px solid rgba(0,0,0,0.07)", borderRadius: 8, font: `500 0.82rem/1 ${fb}`, color: t1, outline: "none", width: "100%", boxSizing: "border-box", textAlign: "center" }}
                        onFocus={e => (e.currentTarget.style.borderColor = "#F97316")}
                        onBlur={e => (e.currentTarget.style.borderColor = "rgba(0,0,0,0.07)")}
                      />
                      <div style={{ position: "relative" }}>
                        <Clock size={11} style={{ position: "absolute", left: 7, top: "50%", transform: "translateY(-50%)", color: t3, pointerEvents: "none" }} />
                        <input
                          placeholder="60s"
                          value={ej.descanso}
                          onChange={e => setRutinaEjercicios(prev => prev.map((x, j) => j === i ? { ...x, descanso: e.target.value } : x))}
                          style={{ padding: "7px 6px 7px 20px", background: "#F9FAFB", border: "1px solid rgba(0,0,0,0.07)", borderRadius: 8, font: `500 0.82rem/1 ${fb}`, color: t1, outline: "none", width: "100%", boxSizing: "border-box" }}
                          onFocus={e => (e.currentTarget.style.borderColor = "#F97316")}
                          onBlur={e => (e.currentTarget.style.borderColor = "rgba(0,0,0,0.07)")}
                        />
                      </div>
                      <button
                        onClick={() => setRutinaEjercicios(prev => prev.filter((_, j) => j !== i))}
                        style={{ width: 32, height: 32, borderRadius: 8, background: "none", border: "1px solid rgba(220,38,38,0.12)", cursor: "pointer", color: "#EF4444", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0, transition: "all 0.15s" }}
                        onMouseEnter={e => { e.currentTarget.style.background = "rgba(220,38,38,0.07)"; }}
                        onMouseLeave={e => { e.currentTarget.style.background = "none"; }}
                      >
                        <Trash2 size={13} />
                      </button>
                    </div>
                  ))}
                </div>
                <button
                  onClick={() => setRutinaEjercicios(prev => [...prev, { ...EMPTY_EJ }])}
                  style={{ marginTop: 8, display: "flex", alignItems: "center", gap: 6, padding: "8px 14px", background: "none", border: "1px dashed rgba(249,115,22,0.2)", borderRadius: 9, font: `600 0.78rem/1 ${fd}`, color: "#F97316", cursor: "pointer", width: "100%", justifyContent: "center", transition: "all 0.15s" }}
                  onMouseEnter={e => { e.currentTarget.style.background = "rgba(249,115,22,0.04)"; }}
                  onMouseLeave={e => { e.currentTarget.style.background = "none"; }}
                >
                  <Plus size={13} /> Agregar ejercicio
                </button>
              </div>
            )}

            {/* WOD: lista de movimientos */}
            {rutinatipo === "wod" && (
              <div style={{ marginBottom: 20 }}>
                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 10 }}>
                  <label style={{ font: `600 0.72rem/1 ${fd}`, color: t1, textTransform: "uppercase", letterSpacing: "0.07em" }}>Movimientos ({wodMovimientos.length})</label>
                  <div style={{ display: "flex", gap: 6, alignItems: "center" }}>
                    <span style={{ padding: "3px 10px", borderRadius: 9999, background: "rgba(99,102,241,0.1)", border: "1px solid rgba(99,102,241,0.2)", font: `700 0.68rem/1 ${fd}`, color: "#818cf8" }}>{wodModalidad}</span>
                    <span style={{ font: `400 0.68rem/1 ${fd}`, color: t3 }}>{wodTimeCap} min</span>
                  </div>
                </div>
                <div style={{ display: "grid", gridTemplateColumns: "2fr 90px 32px", gap: 6, padding: "0 8px", marginBottom: 6 }}>
                  {["Movimiento", "Reps / Dist", ""].map(h => (
                    <span key={h} style={{ font: `600 0.62rem/1 ${fb}`, color: t3, textTransform: "uppercase", letterSpacing: "0.06em" }}>{h}</span>
                  ))}
                </div>
                <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                  {wodMovimientos.map((m, i) => (
                    <div key={i} style={{ display: "grid", gridTemplateColumns: "2fr 90px 32px", gap: 6, alignItems: "center", background: "white", border: "1px solid rgba(0,0,0,0.07)", borderRadius: 10, padding: "8px 8px" }}>
                      <input
                        placeholder="Ej: Thruster"
                        value={m.nombre}
                        onChange={e => setWodMovimientos(prev => prev.map((x, j) => j === i ? { ...x, nombre: e.target.value } : x))}
                        style={{ padding: "7px 10px", background: "#F9FAFB", border: "1px solid rgba(0,0,0,0.07)", borderRadius: 8, font: `500 0.82rem/1 ${fb}`, color: t1, outline: "none", width: "100%", boxSizing: "border-box" }}
                        onFocus={e => (e.currentTarget.style.borderColor = "#6366f1")}
                        onBlur={e => (e.currentTarget.style.borderColor = "rgba(0,0,0,0.07)")}
                      />
                      <input
                        placeholder="21-15-9"
                        value={m.reps}
                        onChange={e => setWodMovimientos(prev => prev.map((x, j) => j === i ? { ...x, reps: e.target.value } : x))}
                        style={{ padding: "7px 8px", background: "#F9FAFB", border: "1px solid rgba(0,0,0,0.07)", borderRadius: 8, font: `500 0.82rem/1 ${fb}`, color: t1, outline: "none", width: "100%", boxSizing: "border-box", textAlign: "center" }}
                        onFocus={e => (e.currentTarget.style.borderColor = "#6366f1")}
                        onBlur={e => (e.currentTarget.style.borderColor = "rgba(0,0,0,0.07)")}
                      />
                      <button
                        onClick={() => setWodMovimientos(prev => prev.filter((_, j) => j !== i))}
                        style={{ width: 32, height: 32, borderRadius: 8, background: "none", border: "1px solid rgba(220,38,38,0.12)", cursor: "pointer", color: "#EF4444", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0, transition: "all 0.15s" }}
                        onMouseEnter={e => { e.currentTarget.style.background = "rgba(220,38,38,0.07)"; }}
                        onMouseLeave={e => { e.currentTarget.style.background = "none"; }}
                      >
                        <Trash2 size={13} />
                      </button>
                    </div>
                  ))}
                </div>
                <button
                  onClick={() => setWodMovimientos(prev => [...prev, { ...EMPTY_MOV }])}
                  style={{ marginTop: 8, display: "flex", alignItems: "center", gap: 6, padding: "8px 14px", background: "none", border: "1px dashed rgba(99,102,241,0.25)", borderRadius: 9, font: `600 0.78rem/1 ${fd}`, color: "#818cf8", cursor: "pointer", width: "100%", justifyContent: "center", transition: "all 0.15s" }}
                  onMouseEnter={e => { e.currentTarget.style.background = "rgba(99,102,241,0.04)"; }}
                  onMouseLeave={e => { e.currentTarget.style.background = "none"; }}
                >
                  <Plus size={13} /> Agregar movimiento
                </button>
              </div>
            )}

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
                {rutinaSaving ? "Publicando..." : rutinatipo === "wod" ? "Publicar WOD" : "Publicar Rutina"}
              </button>
            )}
          </div>
        </div>
      </>,
      document.body
    )}

    {/* ── Toast ── */}
    {toast && (
      <div style={{ position: "fixed", bottom: 28, left: "50%", transform: "translateX(-50%)", zIndex: 10000, background: "#FF6A00", color: "white", padding: "12px 22px", borderRadius: 12, font: `600 0.875rem/1 ${fb}`, boxShadow: "0 8px 24px rgba(0,0,0,0.18)", pointerEvents: "none", whiteSpace: "nowrap" }}>
        {toast}
      </div>
    )}
    </>
  );
}
