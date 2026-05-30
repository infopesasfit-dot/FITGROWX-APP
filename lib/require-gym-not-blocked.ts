import { NextResponse } from "next/server";
import { getGymPlanStatus } from "@/lib/gym-plan-status";

/**
 * Gate de escritura server-side. Devuelve una respuesta 403 si el gym está
 * bloqueado por impago/vencimiento, usando la MISMA fuente de verdad que el
 * resto de la app: getGymPlanStatus().is_blocked. Devuelve null si puede operar.
 *
 * Reglas de uso:
 *  - Llamar SOLO tras resolver el gym_id del usuario autenticado.
 *  - NO invocar para role "platform_owner" (soporte interno / impersonación).
 *  - NO usar en endpoints de la allowlist de facturación/salida (planes,
 *    suscripción, create/cancel preference, export CSV/Excel, baja de gym),
 *    que deben seguir funcionando con el gym bloqueado.
 */
export async function requireGymNotBlocked(gymId: string): Promise<NextResponse | null> {
  const plan = await getGymPlanStatus(gymId);
  if (plan.is_blocked) {
    return NextResponse.json(
      {
        ok: false,
        gym_blocked: true,
        error: plan.message || "Tu suscripción venció. Renová para seguir usando FitGrowX.",
      },
      { status: 403 },
    );
  }
  return null;
}
