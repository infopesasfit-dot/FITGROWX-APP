"use client";

import { useState, useEffect, useCallback } from "react";

const wsKey  = (id: string, date: string) => `fitgrowx_ws_${id}_${date}`;
const kgqKey = (id: string) => `fitgrowx_kgq_${id}`;
const today  = () => new Date().toISOString().slice(0, 10);

interface SeriesState { completadas: number; total: number; kg_usado: number | null; }

interface WorkoutSession {
  rutina_nombre: string;
  series_log:    Record<string, SeriesState>;
  completada:    boolean;
  offline:       boolean;
  inicio:        string;
}

interface KgQueueItem { alumno_id: string; gym_id: string; ejercicio: string; peso: number; }

function readLS<T>(key: string): T | null {
  try { const r = localStorage.getItem(key); return r ? JSON.parse(r) : null; } catch { return null; }
}
function writeLS(key: string, val: unknown) { try { localStorage.setItem(key, JSON.stringify(val)); } catch {} }

export function useWorkoutSession(alumnoId: string | null, gymId: string | null, token: string | null) {
  const fecha = today();
  const key   = alumnoId ? wsKey(alumnoId, fecha) : null;

  const [workoutSession, setWorkoutSession] = useState<WorkoutSession | null>(null);
  const [wsSyncing,      setWsSyncing]      = useState(false);

  useEffect(() => {
    if (!key) return;
    const saved = readLS<WorkoutSession>(key);
    if (saved) setWorkoutSession(saved);
  }, [key]);

  const saveLocal = useCallback((s: WorkoutSession) => {
    if (key) writeLS(key, s);
    setWorkoutSession(s);
  }, [key]);

  const initSession = useCallback((rutina_nombre: string, ejercicios: { nombre: string; series: number }[]) => {
    if (!key) return;
    const existing = readLS<WorkoutSession>(key);
    if (existing) { setWorkoutSession(existing); return; }
    const series_log: Record<string, SeriesState> = {};
    ejercicios.forEach(e => { series_log[e.nombre] = { completadas: 0, total: e.series, kg_usado: null }; });
    saveLocal({ rutina_nombre, series_log, completada: false, offline: false, inicio: new Date().toISOString() });
  }, [key, saveLocal]);

  const markSerie = useCallback((ejercicio: string, idx: number) => {
    setWorkoutSession(prev => {
      if (!prev) return prev;
      const cur = prev.series_log[ejercicio];
      if (!cur) return prev;
      const completadas = idx < cur.completadas ? idx : idx + 1;
      const next = { ...prev, series_log: { ...prev.series_log, [ejercicio]: { ...cur, completadas } } };
      if (key) writeLS(key, next);
      return next;
    });
  }, [key]);

  const setSerieKg = useCallback((ejercicio: string, kg: number) => {
    setWorkoutSession(prev => {
      if (!prev) return prev;
      const cur = prev.series_log[ejercicio];
      if (!cur) return prev;
      const next = { ...prev, series_log: { ...prev.series_log, [ejercicio]: { ...cur, kg_usado: kg } } };
      if (key) writeLS(key, next);
      return next;
    });
  }, [key]);

  const syncToServer = useCallback(async (s: WorkoutSession): Promise<boolean> => {
    if (!alumnoId || !gymId) return false;
    try {
      const res = await fetch("/api/alumno/workout-log", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ alumno_id: alumnoId, gym_id: gymId, fecha, rutina_nombre: s.rutina_nombre, series_log: s.series_log, completada: s.completada, offline: s.offline }),
      });
      return res.ok;
    } catch { return false; }
  }, [alumnoId, gymId, fecha]);

  const finalizeWorkout = useCallback(async (): Promise<boolean> => {
    if (!workoutSession || !key) return false;
    const online  = navigator.onLine;
    const updated: WorkoutSession = { ...workoutSession, completada: true, offline: !online };
    saveLocal(updated);
    if (!online) return false;
    setWsSyncing(true);
    const ok = await syncToServer(updated);
    setWsSyncing(false);
    return ok;
  }, [workoutSession, key, saveLocal, syncToServer]);

  const flushWorkoutSession = useCallback(async () => {
    if (!key) return;
    const s = readLS<WorkoutSession>(key);
    if (!s) return;
    const ok = await syncToServer(s);
    if (ok && s.offline) {
      const patched = { ...s, offline: false };
      writeLS(key, patched);
      setWorkoutSession(patched);
    }
  }, [key, syncToServer]);

  const enqueueKg = useCallback((item: KgQueueItem) => {
    if (!alumnoId) return;
    const q: KgQueueItem[] = readLS(kgqKey(alumnoId)) ?? [];
    q.push(item);
    writeLS(kgqKey(alumnoId), q);
  }, [alumnoId]);

  const flushKgQueue = useCallback(async () => {
    if (!alumnoId) return;
    const qk  = kgqKey(alumnoId);
    const q: KgQueueItem[] = readLS(qk) ?? [];
    if (!q.length) return;
    const ok: number[] = [];
    for (let i = 0; i < q.length; i++) {
      const item = q[i];
      try {
        const res = await fetch("/api/alumno/pesos", {
          method: "POST",
          credentials: "include",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ alumno_id: item.alumno_id, gym_id: item.gym_id, ejercicio: item.ejercicio, peso: item.peso, notas: null }),
        });
        if (res.ok) ok.push(i);
      } catch {}
    }
    writeLS(qk, q.filter((_, i) => !ok.includes(i)));
  }, [alumnoId]);

  return { workoutSession, wsSyncing, initSession, markSerie, setSerieKg, finalizeWorkout, flushWorkoutSession, enqueueKg, flushKgQueue };
}
