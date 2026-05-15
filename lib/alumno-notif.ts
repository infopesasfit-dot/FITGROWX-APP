import { SupabaseClient } from "@supabase/supabase-js";

interface NotifPayload {
  alumno_id: string;
  gym_id:    string;
  type:      "cuota_vencimiento" | "rutina_asignada" | "clase_cancelada" | "general";
  title:     string;
  body?:     string;
  link?:     string;
}

export async function createAlumnoNotification(
  supabase: SupabaseClient,
  payload:  NotifPayload
) {
  await supabase.from("alumno_notifications").insert(payload);
}
