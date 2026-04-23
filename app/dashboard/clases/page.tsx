"use client";

import { useState, useEffect, useCallback } from "react";
import { createPortal } from "react-dom";
import { Calendar, Plus, X, Clock, Users, ChevronDown, ChevronUp, Trash2, Edit2, Star } from "lucide-react";
import { supabase } from "@/lib/supabase";
import { getPagoAlumnoSummary } from "@/lib/supabase-relations";

const fd = "var(--font-inter, 'Inter', sans-serif)";
const t1 = "#1A1D23";
const t2 = "#6B7280";
const card = { background: "#FFFFFF", border: "1px solid rgba(0,0,0,0.05)", borderRadius: 14, boxShadow: "0 2px 8px rgba(0,0,0,0.06), 0 0 1px rgba(0,0,0,0.04)" };

const DAYS = ["Domingo", "Lunes", "Martes", "Miércoles", "Jueves", "Viernes", "Sábado"];
const DAYS_SHORT = ["Dom", "Lun", "Mar", "Mié", "Jue", "Vie", "Sáb"];

interface GymClass {
  id: string;
  class_name: string;
  day_of_week: number;
  start_time: string;
  max_capacity: number;
  event_type: "regular" | "especial";
  notes: string | null;
  coach_name: string | null;
  reservas_count?: number;
}

interface Reserva {
  id: string;
  fecha: string;
  alumnos: { full_name: string; phone: string | null } | null;
}


interface FormState {
  class_name: string;
  day_of_week: string;
  days_of_week: number[];
  start_time: string;
  max_capacity: string;
  event_type: "regular" | "especial";
  notes: string;
  coach_name: string;
}

const EMPTY_FORM: FormState = {
  class_name: "",
  day_of_week: "1",
  days_of_week: [1],
  start_time: "08:00",
  max_capacity: "20",
  event_type: "regular",
  notes: "",
  coach_name: "",
};

function mapReservaRow(row: unknown): Reserva {
  const r = row as { id: string; fecha: string; alumnos: unknown };
  return {
    id: r.id,
    fecha: r.fecha,
    alumnos: getPagoAlumnoSummary(r.alumnos),
  };
}

export default function ClasesPage() {
  const [gymId,         setGymId]         = useState<string | null>(null);
  const [clases,        setClases]        = useState<GymClass[]>([]);
  const [loading,       setLoading]       = useState(true);
  const [modalOpen,     setModalOpen]     = useState(false);
  const [form,          setForm]          = useState<FormState>(EMPTY_FORM);
  const [editId,        setEditId]        = useState<string | null>(null);
  const [saving,        setSaving]        = useState(false);
  const [formError,     setFormError]     = useState<string | null>(null);
  const [expandedId,    setExpandedId]    = useState<string | null>(null);
  const [reservas,      setReservas]      = useState<Record<string, Reserva[]>>({});
  const [loadingRes,    setLoadingRes]    = useState<string | null>(null);
  const [todayDow]                        = useState(() => new Date().getDay());
  const [deleteId,      setDeleteId]      = useState<string | null>(null);

  useEffect(() => {
    supabase.auth.getUser().then(({ data: { user } }) => {
      if (user) setGymId(user.id);
    });
  }, []);

  const fetchClases = useCallback(async (gid: string) => {
    setLoading(true);
    const { data } = await supabase
      .from("gym_classes")
      .select("id, class_name, day_of_week, start_time, max_capacity, event_type, notes, coach_name")
      .eq("gym_id", gid)
      .order("day_of_week")
      .order("start_time");
    if (!data) { setLoading(false); return; }

    const today = new Date();
    const dates = Array.from({ length: 7 }, (_, i) => {
      const d = new Date(today);
      d.setDate(d.getDate() + i);
      return d.toISOString().slice(0, 10);
    });

    const { data: resData } = await supabase
      .from("reservas")
      .select("clase_id")
      .eq("gym_id", gid)
      .eq("estado", "confirmada")
      .in("fecha", dates);

    const countMap: Record<string, number> = {};
    resData?.forEach(r => { countMap[r.clase_id] = (countMap[r.clase_id] ?? 0) + 1; });

    setClases(data.map(c => ({ ...c, event_type: (c.event_type ?? "regular") as "regular" | "especial", reservas_count: countMap[c.id] ?? 0 })));
    setLoading(false);
  }, []);

  useEffect(() => {
    if (!gymId) return;
    const timer = window.setTimeout(() => {
      void fetchClases(gymId);
    }, 0);
    return () => window.clearTimeout(timer);
  }, [gymId, fetchClases]);

  const openAdd = () => { setEditId(null); setForm(EMPTY_FORM); setFormError(null); setModalOpen(true); };
  const openEdit = (c: GymClass) => {
    setEditId(c.id);
    setForm({
      class_name: c.class_name,
      day_of_week: String(c.day_of_week),
      days_of_week: [c.day_of_week],
      start_time: c.start_time.slice(0, 5),
      max_capacity: String(c.max_capacity),
      event_type: c.event_type ?? "regular",
      notes: c.notes ?? "",
      coach_name: c.coach_name ?? "",
    });
    setFormError(null);
    setModalOpen(true);
  };

  const handleSave = async () => {
    if (!gymId) return;
    if (!form.class_name.trim()) { setFormError("El nombre es obligatorio."); return; }
    if (!editId && form.days_of_week.length === 0) { setFormError("Seleccioná al menos un día."); return; }
    setSaving(true);
    setFormError(null);

    const basePayload = {
      gym_id: gymId,
      class_name: form.class_name.trim(),
      start_time: form.start_time,
      max_capacity: parseInt(form.max_capacity) || 20,
      event_type: form.event_type,
      notes: form.notes.trim() || null,
      coach_name: form.coach_name.trim() || null,
    };

    if (editId) {
      const { error } = await supabase.from("gym_classes").update(basePayload).eq("id", editId);
      if (error) { setFormError(error.message); setSaving(false); return; }
    } else {
      const rows = form.days_of_week.map(dow => ({ ...basePayload, day_of_week: dow }));
      const { error } = await supabase.from("gym_classes").insert(rows);
      if (error) { setFormError(error.message); setSaving(false); return; }
    }
    setSaving(false);
    setModalOpen(false);
    fetchClases(gymId);
  };

  const handleDelete = async (id: string) => {
    if (!gymId) return;
    await supabase.from("gym_classes").delete().eq("id", id);
    setDeleteId(null);
    setExpandedId(null);
    fetchClases(gymId);
  };

  const toggleExpand = async (id: string) => {
    if (expandedId === id) { setExpandedId(null); return; }
    setExpandedId(id);
    if (reservas[id]) return;
    setLoadingRes(id);
    const today = new Date();
    const dates = Array.from({ length: 7 }, (_, i) => {
      const d = new Date(today); d.setDate(d.getDate() + i);
      return d.toISOString().slice(0, 10);
    });
    const { data } = await supabase
      .from("reservas")
      .select("id, fecha, alumnos(full_name, phone)")
      .eq("clase_id", id)
      .eq("estado", "confirmada")
      .in("fecha", dates)
      .order("fecha");
    setReservas(prev => ({ ...prev, [id]: (data ?? []).map((row) => mapReservaRow(row)) }));
    setLoadingRes(null);
  };

  const toggleDay = (dow: number) => {
    setForm(p => ({
      ...p,
      days_of_week: p.days_of_week.includes(dow)
        ? p.days_of_week.filter(d => d !== dow)
        : [...p.days_of_week, dow],
    }));
  };

  const byDay: Record<number, GymClass[]> = {};
  clases.forEach(c => { if (!byDay[c.day_of_week]) byDay[c.day_of_week] = []; byDay[c.day_of_week].push(c); });

  const totalReservas = clases.reduce((sum, c) => sum + (c.reservas_count ?? 0), 0);
  const clasesHoy = clases.filter(c => c.day_of_week === todayDow).length;

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>

      {/* Header */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
        <div>
          <h1 style={{ font: `800 1.6rem/1 ${fd}`, color: t1, letterSpacing: "-0.035em" }}>Calendario de Clases</h1>
          <p style={{ font: `400 0.85rem/1 ${fd}`, color: t2, marginTop: 4 }}>Gestioná las clases de tu gimnasio</p>
        </div>
        <button
          onClick={openAdd}
          style={{ display: "flex", alignItems: "center", gap: 7, padding: "10px 18px", background: t1, color: "white", border: "none", borderRadius: 10, font: `600 0.85rem/1 ${fd}`, cursor: "pointer" }}
        >
          <Plus size={15} /> Nueva clase
        </button>
      </div>

      {/* KPI cards */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 12 }}>
        {[
          { label: "Clases activas", value: clases.length, icon: Calendar, color: "#4B6BFB" },
          { label: "Clases hoy", value: clasesHoy, icon: Clock, color: "#F97316" },
          { label: "Reservas (7 días)", value: totalReservas, icon: Users, color: "#16A34A" },
        ].map(k => (
          <div key={k.label} style={{ ...card, padding: "16px 18px", display: "flex", alignItems: "center", gap: 12 }}>
            <div style={{ width: 38, height: 38, borderRadius: 10, background: `${k.color}14`, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
              <k.icon size={17} color={k.color} />
            </div>
            <div>
              <p style={{ font: `700 1.4rem/1 ${fd}`, color: t1 }}>{k.value}</p>
              <p style={{ font: `400 0.72rem/1 ${fd}`, color: t2, marginTop: 3 }}>{k.label}</p>
            </div>
          </div>
        ))}
      </div>

      {/* Classes by day */}
      {loading ? (
        <div style={{ textAlign: "center", padding: "60px 0", color: t2, font: `400 0.85rem/1 ${fd}` }}>Cargando...</div>
      ) : clases.length === 0 ? (
        <div style={{ ...card, padding: "52px 28px", textAlign: "center" }}>
          <Calendar size={36} color="#E2E8F0" style={{ margin: "0 auto 16px" }} />
          <p style={{ font: `600 1rem/1 ${fd}`, color: t1, marginBottom: 6 }}>Sin clases configuradas</p>
          <p style={{ font: `400 0.8rem/1 ${fd}`, color: t2, marginBottom: 18 }}>Añadí la primera clase para comenzar.</p>
          <button onClick={openAdd} style={{ padding: "9px 20px", background: t1, color: "white", border: "none", borderRadius: 9, font: `600 0.82rem/1 ${fd}`, cursor: "pointer" }}>
            Agregar clase
          </button>
        </div>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
          {[1, 2, 3, 4, 5, 6, 0].map(dow => {
            const dayClases = byDay[dow];
            if (!dayClases?.length) return null;
            const isToday = dow === todayDow;
            return (
              <div key={dow} style={{ ...card, overflow: "hidden" }}>
                <div style={{ padding: "12px 18px", background: isToday ? "rgba(249,115,22,0.04)" : "#FAFAFA", borderBottom: "1px solid rgba(0,0,0,0.04)", display: "flex", alignItems: "center", gap: 8 }}>
                  <span style={{ font: `700 0.8rem/1 ${fd}`, color: isToday ? "#F97316" : t2, textTransform: "uppercase", letterSpacing: "0.06em" }}>{DAYS[dow]}</span>
                  <span style={{ font: `400 0.72rem/1 ${fd}`, color: "#CBD5E1" }}>{DAYS_SHORT[dow]}</span>
                  {isToday && <span style={{ marginLeft: "auto", font: `600 0.62rem/1 ${fd}`, color: "#F97316", background: "rgba(249,115,22,0.1)", padding: "2px 8px", borderRadius: 9999, letterSpacing: "0.05em" }}>HOY</span>}
                </div>
                <div style={{ padding: "8px 12px", display: "flex", flexDirection: "column", gap: 6 }}>
                  {dayClases.map(c => {
                    const isExp = expandedId === c.id;
                    const res = reservas[c.id] ?? [];
                    const isEspecial = c.event_type === "especial";
                    return (
                      <div key={c.id} style={{ border: `1px solid ${isEspecial ? "rgba(245,158,11,0.2)" : "rgba(0,0,0,0.06)"}`, borderRadius: 10, overflow: "hidden", background: isEspecial ? "rgba(245,158,11,0.02)" : "transparent" }}>
                        <div style={{ padding: "11px 14px", display: "flex", alignItems: "center", gap: 10, background: isExp ? (isEspecial ? "rgba(245,158,11,0.04)" : "#F8FAFF") : "transparent" }}>
                          <div style={{ flex: 1, minWidth: 0 }}>
                            <div style={{ display: "flex", alignItems: "center", gap: 7, marginBottom: 3 }}>
                              <p style={{ font: `600 0.9rem/1 ${fd}`, color: t1 }}>{c.class_name}</p>
                              {isEspecial && (
                                <span style={{ display: "flex", alignItems: "center", gap: 3, font: `700 0.58rem/1 ${fd}`, color: "#D97706", background: "rgba(245,158,11,0.1)", border: "1px solid rgba(245,158,11,0.25)", padding: "2px 7px", borderRadius: 9999, letterSpacing: "0.05em", flexShrink: 0 }}>
                                  <Star size={8} fill="#D97706" /> ESPECIAL
                                </span>
                              )}
                            </div>
                            <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
                              <span style={{ font: `400 0.72rem/1 ${fd}`, color: t2 }}>{c.start_time.slice(0, 5)}h</span>
                              <span style={{ font: `400 0.72rem/1 ${fd}`, color: "#CBD5E1" }}>·</span>
                              <span style={{ font: `400 0.72rem/1 ${fd}`, color: t2 }}>Máx {c.max_capacity}</span>
                              {c.coach_name && (
                                <>
                                  <span style={{ font: `400 0.72rem/1 ${fd}`, color: "#CBD5E1" }}>·</span>
                                  <span style={{ font: `400 0.72rem/1 ${fd}`, color: t2 }}>{c.coach_name}</span>
                                </>
                              )}
                              {(c.reservas_count ?? 0) > 0 && (
                                <>
                                  <span style={{ font: `400 0.72rem/1 ${fd}`, color: "#CBD5E1" }}>·</span>
                                  <span style={{ font: `600 0.72rem/1 ${fd}`, color: "#16A34A" }}>{c.reservas_count} reservas</span>
                                </>
                              )}
                            </div>
                          </div>
                          <button onClick={() => openEdit(c)} style={{ padding: "5px 8px", background: "none", border: "1px solid rgba(0,0,0,0.08)", borderRadius: 7, cursor: "pointer", color: t2, display: "flex", alignItems: "center" }}>
                            <Edit2 size={13} />
                          </button>
                          <button onClick={() => setDeleteId(c.id)} style={{ padding: "5px 8px", background: "none", border: "1px solid rgba(220,38,38,0.15)", borderRadius: 7, cursor: "pointer", color: "#DC2626", display: "flex", alignItems: "center" }}>
                            <Trash2 size={13} />
                          </button>
                          <button onClick={() => toggleExpand(c.id)} style={{ padding: "5px 8px", background: "none", border: "1px solid rgba(0,0,0,0.08)", borderRadius: 7, cursor: "pointer", color: t2, display: "flex", alignItems: "center", gap: 4, font: `500 0.72rem/1 ${fd}` }}>
                            Alumnos {isExp ? <ChevronUp size={12} /> : <ChevronDown size={12} />}
                          </button>
                        </div>
                        {isExp && (
                          <div style={{ borderTop: "1px solid rgba(0,0,0,0.05)", background: "#F8FAFF", padding: "10px 14px" }}>
                            {loadingRes === c.id ? (
                              <p style={{ font: `400 0.75rem/1 ${fd}`, color: t2 }}>Cargando...</p>
                            ) : res.length === 0 ? (
                              <p style={{ font: `400 0.75rem/1.4 ${fd}`, color: "#94A3B8" }}>Sin reservas en los próximos 7 días.</p>
                            ) : (
                              <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                                {res.map(r => (
                                  <div key={r.id} style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                                    <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                                      <div style={{ width: 26, height: 26, borderRadius: "50%", background: "#F97316", display: "flex", alignItems: "center", justifyContent: "center", font: `700 0.6rem/1 ${fd}`, color: "white", flexShrink: 0 }}>
                                        {(r.alumnos?.full_name ?? "?").slice(0, 2).toUpperCase()}
                                      </div>
                                      <span style={{ font: `500 0.82rem/1 ${fd}`, color: t1 }}>{r.alumnos?.full_name ?? "—"}</span>
                                    </div>
                                    <span style={{ font: `400 0.7rem/1 ${fd}`, color: t2 }}>{r.fecha}</span>
                                  </div>
                                ))}
                              </div>
                            )}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Add/Edit Modal */}
      {modalOpen && typeof window !== "undefined" && createPortal(
        <div onClick={() => setModalOpen(false)} style={{ position: "fixed", inset: 0, zIndex: 9999, background: "rgba(0,0,0,0.45)", backdropFilter: "blur(6px)", display: "flex", alignItems: "center", justifyContent: "center", padding: 20 }}>
          <div onClick={e => e.stopPropagation()} style={{ background: "white", borderRadius: 18, padding: "28px 24px", width: "100%", maxWidth: 440, boxShadow: "0 24px 60px rgba(0,0,0,0.18)", maxHeight: "90vh", overflowY: "auto" }}>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 22 }}>
              <h2 style={{ font: `700 1.1rem/1 ${fd}`, color: t1 }}>{editId ? "Editar clase" : "Nueva clase"}</h2>
              <button onClick={() => setModalOpen(false)} style={{ background: "none", border: "none", cursor: "pointer", color: t2, display: "flex" }}><X size={18} /></button>
            </div>

            <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>

              {/* Nombre */}
              <label style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                <span style={{ font: `500 0.75rem/1 ${fd}`, color: t2 }}>Nombre de la clase</span>
                <input
                  value={form.class_name}
                  onChange={e => setForm(p => ({ ...p, class_name: e.target.value }))}
                  placeholder="Box, Zumba, Spinning..."
                  style={{ padding: "10px 12px", border: "1px solid rgba(0,0,0,0.12)", borderRadius: 9, font: `400 0.875rem/1 ${fd}`, color: t1, outline: "none" }}
                />
              </label>

              {/* Tipo de evento */}
              <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                <span style={{ font: `500 0.75rem/1 ${fd}`, color: t2 }}>Tipo de evento</span>
                <div style={{ display: "flex", gap: 8 }}>
                  {(["regular", "especial"] as const).map(et => (
                    <button
                      key={et}
                      type="button"
                      onClick={() => setForm(p => ({ ...p, event_type: et }))}
                      style={{ flex: 1, padding: "9px 0", borderRadius: 9, border: `1.5px solid ${form.event_type === et ? (et === "especial" ? "#D97706" : t1) : "rgba(0,0,0,0.1)"}`, background: form.event_type === et ? (et === "especial" ? "rgba(245,158,11,0.06)" : t1) : "white", color: form.event_type === et ? (et === "especial" ? "#D97706" : "white") : t2, font: `600 0.78rem/1 ${fd}`, cursor: "pointer", transition: "all 0.15s" }}
                    >
                      {et === "regular" ? "Clase Regular" : "⭐ Evento Especial"}
                    </button>
                  ))}
                </div>
              </div>

              {/* Días — multi-select in create, label in edit */}
              {editId ? (
                <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                  <span style={{ font: `500 0.75rem/1 ${fd}`, color: t2 }}>Día</span>
                  <div style={{ padding: "9px 12px", border: "1px solid rgba(0,0,0,0.08)", borderRadius: 9, background: "#FAFAFA", font: `400 0.875rem/1 ${fd}`, color: t1 }}>
                    {DAYS[parseInt(form.day_of_week)]}
                  </div>
                </div>
              ) : (
                <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                  <span style={{ font: `500 0.75rem/1 ${fd}`, color: t2 }}>Días de la semana</span>
                  <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                    {[1, 2, 3, 4, 5, 6, 0].map(dow => {
                      const sel = form.days_of_week.includes(dow);
                      return (
                        <button
                          key={dow}
                          type="button"
                          onClick={() => toggleDay(dow)}
                          style={{ width: 44, height: 44, borderRadius: 10, border: `1.5px solid ${sel ? t1 : "rgba(0,0,0,0.1)"}`, background: sel ? t1 : "white", color: sel ? "white" : t2, font: `${sel ? "700" : "500"} 0.72rem/1 ${fd}`, cursor: "pointer", flexShrink: 0 }}
                        >
                          {DAYS_SHORT[dow]}
                        </button>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* Horario + Capacidad */}
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
                <label style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                  <span style={{ font: `500 0.75rem/1 ${fd}`, color: t2 }}>Horario</span>
                  <input
                    type="time"
                    value={form.start_time}
                    onChange={e => setForm(p => ({ ...p, start_time: e.target.value }))}
                    style={{ padding: "10px 12px", border: "1px solid rgba(0,0,0,0.12)", borderRadius: 9, font: `400 0.875rem/1 ${fd}`, color: t1, outline: "none" }}
                  />
                </label>
                <label style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                  <span style={{ font: `500 0.75rem/1 ${fd}`, color: t2 }}>Cupos disponibles</span>
                  <input
                    type="number"
                    min="1"
                    value={form.max_capacity}
                    onChange={e => setForm(p => ({ ...p, max_capacity: e.target.value }))}
                    style={{ padding: "10px 12px", border: "1px solid rgba(0,0,0,0.12)", borderRadius: 9, font: `400 0.875rem/1 ${fd}`, color: t1, outline: "none" }}
                  />
                </label>
              </div>

              {/* Coach name */}
              <label style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                <span style={{ font: `500 0.75rem/1 ${fd}`, color: t2 }}>Coach (opcional)</span>
                <input
                  value={form.coach_name}
                  onChange={e => setForm(p => ({ ...p, coach_name: e.target.value }))}
                  placeholder="Nombre del coach..."
                  style={{ padding: "10px 12px", border: "1px solid rgba(0,0,0,0.12)", borderRadius: 9, font: `400 0.875rem/1 ${fd}`, color: t1, outline: "none" }}
                />
              </label>

              {/* Notes */}
              <label style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                <span style={{ font: `500 0.75rem/1 ${fd}`, color: t2 }}>Notas (opcional)</span>
                <textarea
                  value={form.notes}
                  onChange={e => setForm(p => ({ ...p, notes: e.target.value }))}
                  placeholder="Descripción o info adicional sobre la clase..."
                  rows={3}
                  style={{ padding: "10px 12px", border: "1px solid rgba(0,0,0,0.12)", borderRadius: 9, font: `400 0.875rem/1.5 ${fd}`, color: t1, outline: "none", resize: "vertical" }}
                />
              </label>

              {formError && <p style={{ font: `400 0.78rem/1 ${fd}`, color: "#DC2626" }}>{formError}</p>}

              <button
                onClick={handleSave}
                disabled={saving}
                style={{ padding: "12px", background: t1, color: "white", border: "none", borderRadius: 10, font: `600 0.875rem/1 ${fd}`, cursor: saving ? "not-allowed" : "pointer", opacity: saving ? 0.7 : 1, marginTop: 4 }}
              >
                {saving ? "Guardando..." : editId ? "Guardar cambios" : `Crear clase${!editId && form.days_of_week.length > 1 ? ` (${form.days_of_week.length} días)` : ""}`}
              </button>
            </div>
          </div>
        </div>,
        document.body
      )}

      {/* Delete confirm */}
      {deleteId && typeof window !== "undefined" && createPortal(
        <div onClick={() => setDeleteId(null)} style={{ position: "fixed", inset: 0, zIndex: 9999, background: "rgba(0,0,0,0.45)", backdropFilter: "blur(6px)", display: "flex", alignItems: "center", justifyContent: "center", padding: 20 }}>
          <div onClick={e => e.stopPropagation()} style={{ background: "white", borderRadius: 18, padding: "28px 24px", width: "100%", maxWidth: 360, boxShadow: "0 24px 60px rgba(0,0,0,0.18)", textAlign: "center" }}>
            <div style={{ width: 48, height: 48, borderRadius: "50%", background: "rgba(220,38,38,0.08)", display: "flex", alignItems: "center", justifyContent: "center", margin: "0 auto 16px" }}>
              <Trash2 size={20} color="#DC2626" />
            </div>
            <h3 style={{ font: `700 1rem/1 ${fd}`, color: t1, marginBottom: 8 }}>Eliminar clase</h3>
            <p style={{ font: `400 0.82rem/1.4 ${fd}`, color: t2, marginBottom: 22 }}>Se borrarán también todas las reservas asociadas. Esta acción no se puede deshacer.</p>
            <div style={{ display: "flex", gap: 10 }}>
              <button onClick={() => setDeleteId(null)} style={{ flex: 1, padding: "10px", background: "none", border: "1px solid rgba(0,0,0,0.1)", borderRadius: 9, font: `500 0.82rem/1 ${fd}`, color: t2, cursor: "pointer" }}>Cancelar</button>
              <button onClick={() => handleDelete(deleteId)} style={{ flex: 1, padding: "10px", background: "#DC2626", border: "none", borderRadius: 9, font: `600 0.82rem/1 ${fd}`, color: "white", cursor: "pointer" }}>Eliminar</button>
            </div>
          </div>
        </div>,
        document.body
      )}
    </div>
  );
}
