/**
 * Mappers between UI/Form camelCase and API/DB snake_case
 * Schemas are defined in snake_case; these mappers help UI code use camelCase
 */

// Lead form (camelCase) → API schema (snake_case)
export function leadFormToSchema(input: {
  gymId: string;
  name: string;
  email: string;
  phone?: string | null;
  turnstileToken?: string;
}) {
  return {
    gym_id: input.gymId,
    name: input.name,
    email: input.email,
    phone: input.phone ?? null,
    turnstile_token: input.turnstileToken,
  };
}

// Booking form (camelCase) → API schema (snake_case)
export function bookingFormToSchema(input: {
  classId: string;
  leadName: string;
  leadPhone: string;
  gymId: string;
  turnstileToken?: string;
}) {
  return {
    class_id: input.classId,
    lead_name: input.leadName,
    lead_phone: input.leadPhone,
    gym_id: input.gymId,
    turnstile_token: input.turnstileToken,
  };
}
