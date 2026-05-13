"use client";

import { useState } from "react";
import { supabase } from "@/lib/supabase";

interface Alumno {
  id: string;
  full_name: string;
}

interface Ejercicio {
  nombre: string;
  series: number;
  repeticiones: number;
  peso_sugerido: string;
  descanso: string;
}

interface Movimiento {
  nombre: string;
  reps: string;
}

interface RutinaDraft {
  nombre: string;
  ejercicios: unknown;
  notas: string | null;
}

const EMPTY_EJ:  Ejercicio  = { nombre: "", series: 3, repeticiones: 10, peso_sugerido: "", descanso: "60s" };
const EMPTY_MOV: Movimiento = { nombre: "", reps: "" };

export function useRutinaModal(gymId: string | null, onSuccess: (msg: string) => void) {
  const [rutinaModalOpen,  setRutinaModalOpen]  = useState(false);
  const [rutinaTarget,     setRutinaTarget]     = useState<Alumno | null>(null);
  const [rutinaNombre,     setRutinaNombre]     = useState("Mi Rutina");
  const [rutinaEjercicios, setRutinaEjercicios] = useState<Ejercicio[]>([]);
  const [rutinaSaving,     setRutinaSaving]     = useState(false);
  const [ejAutoIdx,        setEjAutoIdx]        = useState<number | null>(null);
  const [rutinaError,      setRutinaError]      = useState<string | null>(null);
  const [objetivo,         setObjetivo]         = useState("Hipertrofia");
  const [notas,            setNotas]            = useState("");
  const [aiLoading,        setAiLoading]        = useState(false);
  const [publicado,        setPublicado]        = useState(false);
  const [rutinatipo,       setRutinatipo]       = useState<"gym" | "wod">("gym");
  const [wodModalidad,     setWodModalidad]     = useState("AMRAP");
  const [wodTimeCap,       setWodTimeCap]       = useState("15");
  const [wodMovimientos,   setWodMovimientos]   = useState<Movimiento[]>([]);
  const [rutinasCache,     setRutinasCache]     = useState<Record<string, RutinaDraft | null>>({});

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

    let data = rutinasCache[a.id];
    if (data === undefined) {
      const result = await supabase
        .from("rutinas")
        .select("nombre, ejercicios, notas")
        .eq("alumno_id", a.id)
        .maybeSingle();
      data = (result.data as RutinaDraft | null) ?? null;
      setRutinasCache(prev => ({ ...prev, [a.id]: data }));
    }

    if (data) {
      setRutinaNombre(data.nombre);
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const ejercicios = data.ejercicios as any[];
      if (ejercicios?.[0]?._meta) {
        const meta = ejercicios[0];
        setRutinatipo("wod");
        setWodModalidad(meta.modalidad ?? "AMRAP");
        setWodTimeCap(meta.time_cap ?? "15");
        setWodMovimientos(ejercicios.slice(1).map((e: { nombre?: string; reps?: string }) => ({
          nombre: e.nombre ?? "",
          reps:   e.reps   ?? "",
        })));
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
      body: JSON.stringify({
        gym_id:    gymId,
        alumno_id: rutinaTarget.id,
        nombre:    rutinaNombre.trim(),
        ejercicios: ejerciciosToSave,
        notas:     notas.trim() || null,
      }),
    });
    const d = await res.json();
    if (!res.ok || d.error) { setRutinaError(d.error ?? "Error al guardar."); setRutinaSaving(false); return; }

    // Notificar al alumno por WA (fire-and-forget)
    fetch("/api/alumno/notify-rutina", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ alumno_id: rutinaTarget.id }),
    }).catch(() => {});

    setRutinasCache(prev => ({
      ...prev,
      [rutinaTarget.id]: { nombre: rutinaNombre.trim(), ejercicios: ejerciciosToSave, notas: notas.trim() || null },
    }));
    setRutinaSaving(false);
    setPublicado(true);
    setTimeout(() => {
      setRutinaModalOpen(false);
      setPublicado(false);
      onSuccess(`✓ ${rutinatipo === "wod" ? "WOD" : "Rutina"} publicado para ${rutinaTarget.full_name}`);
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
          setRutinaEjercicios(d.ejercicios.map((e: Ejercicio) => ({ ...EMPTY_EJ, ...e })));
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

  return {
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
  };
}
