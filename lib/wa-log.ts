import type { SupabaseClient } from "@supabase/supabase-js";

export interface WaLogEntry {
  gym_id: string;
  tipo: string;
  alumno_id?: string | null;
  alumno_name?: string | null;
  status?: "sent" | "blocked" | "failed";
  latency_ms?: number;
  motor_status_code?: number;
  motor_error?: string;
}

export function logWASend(
  supabase: SupabaseClient,
  gymId: string,
  tipo: string,
  alumnoId?: string | null,
  alumnoName?: string | null,
): void {
  void supabase
    .from("wa_mensajes_log")
    .insert({
      gym_id:      gymId,
      tipo,
      sent_at:     new Date().toISOString(),
      alumno_id:   alumnoId  ?? null,
      alumno_name: alumnoName ?? null,
    });
}

export function logWASendWithMetrics(
  supabase: SupabaseClient,
  entry: WaLogEntry,
): void {
  void supabase.from("wa_mensajes_log").insert({
    gym_id: entry.gym_id,
    tipo: entry.tipo,
    sent_at: new Date().toISOString(),
    alumno_id: entry.alumno_id ?? null,
    alumno_name: entry.alumno_name ?? null,
    status: entry.status ?? "sent",
    latency_ms: entry.latency_ms ?? null,
    motor_status_code: entry.motor_status_code ?? null,
    motor_error: entry.motor_error ?? null,
  });
}
