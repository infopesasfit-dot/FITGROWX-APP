import { getSupabaseAdminClient } from "@/lib/supabase-admin";

export type ActivityType =
  | "creado"
  | "pago"
  | "plan_cambiado"
  | "wa_enviado"
  | "congelado"
  | "descongelado"
  | "editado"
  | "eliminado"
  | "check_in"
  | "membresia_asignada";

export async function logAlumnoActivity(
  alumnoId: string,
  gymId: string,
  type: ActivityType,
  description: string,
  actor?: string,
  metadata?: Record<string, unknown>,
): Promise<void> {
  try {
    const supabase = getSupabaseAdminClient();
    await supabase.from("alumno_activity_log").insert({
      alumno_id: alumnoId,
      gym_id: gymId,
      type,
      description,
      actor: actor ?? "sistema",
      metadata: metadata ?? null,
    });
  } catch { /* non-fatal */ }
}
