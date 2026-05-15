import type { SupabaseClient } from "@supabase/supabase-js";

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
