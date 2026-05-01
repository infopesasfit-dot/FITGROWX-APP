function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function firstRelationItem(input: unknown): Record<string, unknown> | null {
  if (Array.isArray(input)) {
    const first = input[0];
    return isRecord(first) ? first : null;
  }

  return isRecord(input) ? input : null;
}

function getNullableString(value: unknown): string | null {
  return typeof value === "string" ? value : null;
}

function getBoolean(value: unknown): boolean {
  return value === true;
}

export function getRelationRecord(input: unknown): Record<string, unknown> | null {
  return firstRelationItem(input);
}

export function getPlanNombre(input: unknown): string | null {
  const relation = firstRelationItem(input);
  return typeof relation?.nombre === "string" ? relation.nombre : null;
}

export function getPlanPeriodo(input: unknown): string | null {
  const relation = firstRelationItem(input);
  return typeof relation?.periodo === "string" ? relation.periodo : null;
}

export function getPlanDurationDays(input: unknown): number | null {
  const relation = firstRelationItem(input);
  return typeof relation?.duracion_dias === "number" ? relation.duracion_dias : null;
}

export function getGymSettingsSummary(
  input: unknown,
): { gym_name: string | null; whatsapp: string | null } | null {
  const relation = firstRelationItem(input);
  if (!relation) return null;

  return {
    gym_name: getNullableString(relation.gym_name),
    whatsapp: getNullableString(relation.whatsapp),
  };
}

export function getGymSummary(
  input: unknown,
): {
  trial_expires_at: string | null;
  is_subscription_active: boolean;
  plan_type: string | null;
  gym_status: string | null;
  trial_start_date: string | null;
} | null {
  const relation = firstRelationItem(input);
  if (!relation) return null;

  return {
    trial_expires_at: getNullableString(relation.trial_expires_at),
    is_subscription_active: getBoolean(relation.is_subscription_active),
    plan_type: getNullableString(relation.plan_type),
    gym_status: getNullableString(relation.gym_status),
    trial_start_date: getNullableString(relation.trial_start_date),
  };
}

export function getPagoAlumnoSummary(
  input: unknown,
): { full_name: string; phone: string | null } | null {
  const relation = firstRelationItem(input);
  if (!relation || typeof relation.full_name !== "string") return null;

  return {
    full_name: relation.full_name,
    phone: getNullableString(relation.phone),
  };
}

export function getVaultCategorySummary(
  input: unknown,
): { slug: string; title: string; description: string | null } | null {
  const relation = firstRelationItem(input);
  if (!relation || typeof relation.slug !== "string" || typeof relation.title !== "string") {
    return null;
  }

  return {
    slug: relation.slug,
    title: relation.title,
    description: getNullableString(relation.description),
  };
}
