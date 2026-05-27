import { getSupabaseAdminClient } from "@/lib/supabase-admin";

export type PlanStatus =
  | "trial_active"        // En trial, dentro del período
  | "trial_grace"         // Trial vencido pero dentro de 3 días de gracia
  | "trial_expired"       // Trial vencido + 3 días pasados → BLOQUEAR
  | "paid_active"         // Suscripción activa (starter o pro)
  | "paid_expired"        // Suscripción venció → BLOQUEAR
  | "unknown";            // No se pudo determinar

export interface PlanInfo {
  status: PlanStatus;
  plan_type: "trial" | "starter" | "crecimiento" | null;
  is_blocked: boolean;
  alumno_limit: number | null;  // null = ilimitado
  days_remaining: number | null;  // días hasta vencimiento (negativo si ya venció)
  message: string;  // Mensaje al admin
}

const GRACE_PERIOD_DAYS = 3;
const STARTER_LIMIT = 60;

export async function getGymPlanStatus(gymId: string): Promise<PlanInfo> {
  const supabase = getSupabaseAdminClient();

  const { data: gym } = await supabase
    .from("gyms")
    .select("plan_type, trial_expires_at, is_subscription_active, subscription_expires_at")
    .eq("id", gymId)
    .maybeSingle();

  if (!gym) {
    return { status: "unknown", plan_type: null, is_blocked: true, alumno_limit: 0, days_remaining: null, message: "Gimnasio no encontrado." };
  }

  const now = new Date();

  // Suscripción paga activa
  if (gym.is_subscription_active && gym.plan_type === "crecimiento") {
    return { status: "paid_active", plan_type: "crecimiento", is_blocked: false, alumno_limit: null, days_remaining: null, message: "Plan Pro activo." };
  }

  if (gym.is_subscription_active && gym.plan_type === "starter") {
    return { status: "paid_active", plan_type: "starter", is_blocked: false, alumno_limit: STARTER_LIMIT, days_remaining: null, message: "Plan Starter activo." };
  }

  // Suscripción vencida
  if (gym.subscription_expires_at && new Date(gym.subscription_expires_at) < now) {
    return { status: "paid_expired", plan_type: gym.plan_type as any, is_blocked: true, alumno_limit: 0, days_remaining: null, message: "Tu suscripción venció. Renová para seguir usando FitGrowX." };
  }

  // Trial
  if (gym.plan_type === "trial" && gym.trial_expires_at) {
    const trialEnd = new Date(gym.trial_expires_at);
    const daysSinceEnd = Math.floor((now.getTime() - trialEnd.getTime()) / (1000 * 60 * 60 * 24));
    const daysRemaining = -daysSinceEnd;

    if (daysSinceEnd < 0) {
      // Trial activo
      return { status: "trial_active", plan_type: "trial", is_blocked: false, alumno_limit: STARTER_LIMIT, days_remaining: daysRemaining, message: `Te quedan ${daysRemaining} días de prueba.` };
    }

    if (daysSinceEnd <= GRACE_PERIOD_DAYS) {
      // Período de gracia
      const graceDaysLeft = GRACE_PERIOD_DAYS - daysSinceEnd;
      return { status: "trial_grace", plan_type: "trial", is_blocked: false, alumno_limit: STARTER_LIMIT, days_remaining: -daysSinceEnd, message: `Tu prueba venció. Te quedan ${graceDaysLeft} días de gracia para suscribirte.` };
    }

    // Trial vencido + gracia agotada
    return { status: "trial_expired", plan_type: "trial", is_blocked: true, alumno_limit: 0, days_remaining: -daysSinceEnd, message: "Tu prueba venció. Suscribite para seguir usando FitGrowX." };
  }

  return { status: "unknown", plan_type: gym.plan_type as any, is_blocked: false, alumno_limit: STARTER_LIMIT, days_remaining: null, message: "Estado de plan desconocido." };
}

export async function canAddAlumno(gymId: string): Promise<{ allowed: boolean; reason?: string }> {
  const plan = await getGymPlanStatus(gymId);

  if (plan.is_blocked) {
    return { allowed: false, reason: plan.message };
  }

  if (plan.alumno_limit === null) {
    return { allowed: true };
  }

  const supabase = getSupabaseAdminClient();
  const { count } = await supabase
    .from("alumnos")
    .select("id", { count: "exact", head: true })
    .eq("gym_id", gymId)
    .is("deleted_at", null);

  const currentCount = count ?? 0;

  if (currentCount >= plan.alumno_limit) {
    return { allowed: false, reason: `Llegaste al límite de ${plan.alumno_limit} alumnos de tu plan. Suscribite a Pro para alumnos ilimitados.` };
  }

  return { allowed: true };
}
