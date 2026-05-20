import { NextRequest } from "next/server";
import { getSupabaseAdminClient } from "@/lib/supabase-admin";

export type AlumnoLogAction =
  | "login_success"
  | "login_failed"
  | "logout"
  | "reserva_created"
  | "reserva_cancelled"
  | "pago_initiated"
  | "pago_completed"
  | "pago_failed"
  | "foto_uploaded"
  | "peso_recorded"
  | "medida_recorded"
  | "session_expired"
  | "unauthorized_access";

interface LogEntry {
  alumno_id?: string;
  gym_id?: string;
  action: AlumnoLogAction;
  details?: Record<string, unknown>;
  status: "success" | "error" | "info";
  error_msg?: string;
  ip_address?: string;
}

const supabase = getSupabaseAdminClient();

export async function logAlumnoAction(entry: LogEntry) {
  try {
    await supabase.from("alumno_activity_logs").insert({
      alumno_id: entry.alumno_id ?? null,
      gym_id: entry.gym_id ?? null,
      action: entry.action,
      details: entry.details ?? null,
      status: entry.status,
      error_msg: entry.error_msg ?? null,
      ip_address: entry.ip_address ?? null,
      created_at: new Date().toISOString(),
    });
  } catch (err) {
    console.error("[alumno-logging]", entry.action, err instanceof Error ? err.message : err);
  }
}

export async function getClientIpFromRequest(req: NextRequest): Promise<string> {
  return (
    req.headers.get("cf-connecting-ip") ||
    req.headers.get("x-forwarded-for")?.split(",")[0] ||
    req.headers.get("x-real-ip") ||
    "unknown"
  );
}

export async function logRequest(req: NextRequest, action: AlumnoLogAction, alumnoId?: string, gymId?: string) {
  const ip = await getClientIpFromRequest(req);
  await logAlumnoAction({
    alumno_id: alumnoId,
    gym_id: gymId,
    action,
    status: "info",
    ip_address: ip,
  });
}
