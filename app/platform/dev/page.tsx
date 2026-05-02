"use client";

import { useState } from "react";
import { supabase } from "@/lib/supabase";
import { Play, AlertTriangle, CheckCircle, XCircle, Loader2 } from "lucide-react";

const fd = "'Inter', sans-serif";

type CronDef = {
  id: string;
  label: string;
  desc: string;
  needsGymId?: boolean;
  warning?: string;
};

const CRONS: CronDef[] = [
  {
    id: "vencimientos",
    label: "Recordatorio de vencimiento",
    desc: "Envía WA a alumnos cuya membresía vence según los días configurados por cada gym.",
  },
  {
    id: "ausentes",
    label: "Alumnos ausentes",
    desc: "Envía WA a alumnos que no asistieron en X días (según config del gym). Corre sobre todos los gyms.",
  },
  {
    id: "ausentes-trigger",
    label: "Ausentes — gym específico",
    desc: "Igual al anterior pero solo para el gym_id indicado. Útil para testear sin afectar a todos.",
    needsGymId: true,
  },
  {
    id: "trial-check",
    label: "Trial check",
    desc: "Marca gyms expirados, envía WA de warning a gyms que vencen pronto, desactiva suscripciones canceladas.",
    warning: "Puede cambiar el estado de gyms en la DB.",
  },
  {
    id: "monthly-report",
    label: "Reporte mensual",
    desc: "Envía el resumen mensual por email a cada gym. Usarlo fuera de fin de mes solo para tests.",
    warning: "Envía emails reales a todos los gyms activos.",
  },
  {
    id: "wa-keepalive",
    label: "WA Keepalive",
    desc: "Hace ping al motor de WhatsApp para mantener las sesiones activas.",
  },
];

type LogEntry = {
  cron: string;
  ok: boolean;
  result: unknown;
  ts: string;
};

export default function DevPage() {
  const [gymId, setGymId] = useState("");
  const [running, setRunning] = useState<string | null>(null);
  const [logs, setLogs] = useState<LogEntry[]>([]);

  async function trigger(cron: CronDef) {
    setRunning(cron.id);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const token = session?.access_token;

      const body: Record<string, string> = { cron: cron.id };
      if (cron.needsGymId) {
        if (!gymId.trim()) { alert("Ingresá un gym_id primero."); return; }
        body.gym_id = gymId.trim();
      }

      const res = await fetch("/api/platform/trigger-cron", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify(body),
      });
      const data = await res.json();
      setLogs(prev => [{
        cron: cron.label,
        ok: res.ok && data.ok,
        result: data.result ?? data,
        ts: new Date().toLocaleTimeString("es-AR"),
      }, ...prev]);
    } catch (e) {
      setLogs(prev => [{ cron: cron.label, ok: false, result: String(e), ts: new Date().toLocaleTimeString("es-AR") }, ...prev]);
    } finally {
      setRunning(null);
    }
  }

  return (
    <div style={{ maxWidth: 780, margin: "0 auto", padding: "32px 20px", fontFamily: fd }}>
      {/* Banner */}
      <div style={{ background: "rgba(234,179,8,0.12)", border: "1px solid rgba(234,179,8,0.35)", borderRadius: 12, padding: "12px 16px", display: "flex", gap: 10, alignItems: "flex-start", marginBottom: 28 }}>
        <AlertTriangle size={16} color="#B45309" style={{ flexShrink: 0, marginTop: 1 }} />
        <p style={{ font: `600 0.8rem/1.45 ${fd}`, color: "#92400E", margin: 0 }}>
          <strong>Solo para testing interno.</strong> Estas acciones ejecutan las automatizaciones reales. Eliminar esta página antes de entregar el sistema a usuarios.
        </p>
      </div>

      <h1 style={{ font: `800 1.4rem/1 ${fd}`, color: "#111827", marginBottom: 4 }}>Dev — Automatizaciones</h1>
      <p style={{ font: `400 0.84rem/1.5 ${fd}`, color: "#6B7280", marginBottom: 28 }}>
        Disparadores manuales para probar cada cron. Los resultados aparecen abajo en tiempo real.
      </p>

      {/* gym_id input */}
      <div style={{ marginBottom: 24 }}>
        <label style={{ font: `600 0.78rem/1 ${fd}`, color: "#374151", display: "block", marginBottom: 6 }}>
          gym_id (para tests de gym específico)
        </label>
        <input
          value={gymId}
          onChange={e => setGymId(e.target.value)}
          placeholder="UUID del gym a testear"
          style={{ width: "100%", padding: "10px 12px", borderRadius: 10, border: "1px solid rgba(0,0,0,0.12)", font: `400 0.875rem/1 ${fd}`, color: "#111827", outline: "none", boxSizing: "border-box", fontFamily: "monospace" }}
        />
      </div>

      {/* Cron cards */}
      <div style={{ display: "grid", gap: 12, marginBottom: 32 }}>
        {CRONS.map(cron => (
          <div key={cron.id} style={{ background: "#FFFFFF", borderRadius: 14, border: "1px solid rgba(0,0,0,0.07)", padding: "16px 18px", display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 16, boxShadow: "0 1px 4px rgba(0,0,0,0.04)" }}>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 4 }}>
                <span style={{ font: `700 0.88rem/1 ${fd}`, color: "#111827" }}>{cron.label}</span>
                {cron.needsGymId && (
                  <span style={{ font: `600 0.65rem/1 ${fd}`, color: "#6366F1", background: "rgba(99,102,241,0.08)", border: "1px solid rgba(99,102,241,0.2)", padding: "2px 7px", borderRadius: 9999 }}>gym_id</span>
                )}
              </div>
              <p style={{ font: `400 0.78rem/1.45 ${fd}`, color: "#6B7280", margin: 0 }}>{cron.desc}</p>
              {cron.warning && (
                <p style={{ font: `600 0.72rem/1.4 ${fd}`, color: "#B45309", marginTop: 6, marginBottom: 0 }}>
                  ⚠ {cron.warning}
                </p>
              )}
            </div>
            <button
              onClick={() => trigger(cron)}
              disabled={running !== null}
              style={{ display: "inline-flex", alignItems: "center", gap: 6, padding: "9px 16px", borderRadius: 10, border: "none", background: running === cron.id ? "#D1D5DB" : "#111827", color: "#FFFFFF", font: `700 0.8rem/1 ${fd}`, cursor: running !== null ? "not-allowed" : "pointer", whiteSpace: "nowrap", flexShrink: 0, transition: "background .15s" }}
            >
              {running === cron.id ? <Loader2 size={13} style={{ animation: "spin 1s linear infinite" }} /> : <Play size={13} />}
              {running === cron.id ? "Corriendo..." : "Ejecutar"}
            </button>
          </div>
        ))}
      </div>

      {/* Log */}
      {logs.length > 0 && (
        <div>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 10 }}>
            <h2 style={{ font: `700 0.88rem/1 ${fd}`, color: "#111827" }}>Log de ejecuciones</h2>
            <button onClick={() => setLogs([])} style={{ font: `600 0.72rem/1 ${fd}`, color: "#9CA3AF", background: "none", border: "none", cursor: "pointer" }}>Limpiar</button>
          </div>
          <div style={{ display: "grid", gap: 8 }}>
            {logs.map((log, i) => (
              <div key={i} style={{ background: "#FFFFFF", borderRadius: 12, border: `1px solid ${log.ok ? "rgba(22,163,74,0.2)" : "rgba(220,38,38,0.2)"}`, padding: "12px 14px" }}>
                <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 8 }}>
                  {log.ok ? <CheckCircle size={14} color="#16A34A" /> : <XCircle size={14} color="#DC2626" />}
                  <span style={{ font: `700 0.8rem/1 ${fd}`, color: "#111827" }}>{log.cron}</span>
                  <span style={{ font: `400 0.72rem/1 ${fd}`, color: "#9CA3AF", marginLeft: "auto" }}>{log.ts}</span>
                </div>
                <pre style={{ font: `400 0.72rem/1.5 'Menlo','Monaco',monospace`, color: "#374151", margin: 0, whiteSpace: "pre-wrap", wordBreak: "break-all", background: "#F8FAFC", borderRadius: 8, padding: "8px 10px", maxHeight: 200, overflowY: "auto" }}>
                  {JSON.stringify(log.result, null, 2)}
                </pre>
              </div>
            ))}
          </div>
        </div>
      )}

      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </div>
  );
}
