import type { SupabaseClient } from "@supabase/supabase-js";

export function logWASend(
  supabase: SupabaseClient,
  gymId: string,
  tipo: string,
): void {
  void supabase
    .from("wa_mensajes_log")
    .insert({ gym_id: gymId, tipo, sent_at: new Date().toISOString() });
}
