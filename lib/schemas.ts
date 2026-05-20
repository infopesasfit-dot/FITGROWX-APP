import { z } from "zod";

// ─── Límites de caracteres ────────────────────────────────────────────────────
export const LIMITS = {
  name:         100,
  email:        255,
  phone:         30,
  dni:           20,
  slug:          60,
  class_name:    80,
  coach_name:   100,
  plan_nombre:   80,
  egreso_titulo:120,
  gym_name:     100,
  instagram:    200,
  payment_info: 500,
  features:    1000,
  notes:       2000,
  ejercicio:    100,
  rutina_nombre: 80,
  password_max: 128,
  subject:      200,
  lead_name:    100,
  clase_nombre:  80,
} as const;

// ─── Campos reutilizables ─────────────────────────────────────────────────────
const nameField  = z.string().min(1, "El nombre es obligatorio.").max(LIMITS.name,  `Máximo ${LIMITS.name} caracteres.`).transform(s => s.trim());
const emailField = z.string().email("Email inválido.").max(LIMITS.email, `Máximo ${LIMITS.email} caracteres.`).transform(s => s.trim().toLowerCase());
const phoneField = z.string().max(LIMITS.phone, `Máximo ${LIMITS.phone} caracteres.`).nullable().optional().transform(s => s?.trim() || null);
const uuidField  = z.string().uuid("ID inválido.");
const dateField  = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Fecha inválida (YYYY-MM-DD).").nullable().optional();

// ─── Admin: alumnos ───────────────────────────────────────────────────────────
export const createAlumnoSchema = z.object({
  full_name:            nameField,
  dni:                  z.string().max(LIMITS.dni).nullable().optional().transform(s => s?.trim() || null),
  phone:                phoneField,
  email:                emailField.nullable().optional().transform(s => s?.trim().toLowerCase() || null),
  plan_id:              uuidField.nullable().optional(),
  status:               z.enum(["activo", "vencido", "congelado", "inactivo"]).default("activo"),
  next_expiration_date: dateField,
  last_payment_date:    dateField,
});

export type CreateAlumnoInput = z.infer<typeof createAlumnoSchema>;

// ─── Admin: classes ───────────────────────────────────────────────────────────
export const classRowSchema = z.object({
  class_name:   z.string().min(1).max(LIMITS.class_name).transform(s => s.trim()),
  day_of_week:  z.number().int().min(0).max(6).optional(),
  start_time:   z.string().regex(/^\d{2}:\d{2}(:\d{2})?$/, "Horario inválido.").optional(),
  end_time:     z.string().regex(/^\d{2}:\d{2}(:\d{2})?$/, "Horario inválido.").optional().nullable(),
  max_capacity: z.number().int().min(1).max(500).optional().nullable(),
  coach_name:   z.string().max(LIMITS.coach_name).optional().nullable().transform(s => s?.trim() || null),
  notes:        z.string().max(LIMITS.notes).optional().nullable().transform(s => s?.trim() || null),
  accent_color: z.string().regex(/^#[0-9a-fA-F]{3,8}$/).optional().nullable(),
  wod_type:     z.string().max(50).optional().nullable(),
  wod_time_cap: z.number().int().min(1).max(180).optional().nullable(),
  wod_content:  z.string().max(LIMITS.notes).optional().nullable().transform(s => s?.trim() || null),
  wod_rounds:   z.number().int().min(1).max(100).optional().nullable(),
}).passthrough();

export const createClassesSchema = z.object({
  rows: z.array(classRowSchema).min(1).max(50),
});

export const patchClassSchema = z.object({
  id:      uuidField,
  payload: classRowSchema.partial(),
});

// ─── Admin: staff ─────────────────────────────────────────────────────────────
export const createStaffSchema = z.object({
  email:     emailField,
  password:  z.string().min(6, "Mínimo 6 caracteres.").max(LIMITS.password_max, `Máximo ${LIMITS.password_max} caracteres.`),
  full_name: z.string().max(LIMITS.name).optional().nullable().transform(s => s?.trim() || null),
});

// ─── Public: leads / prospectos ───────────────────────────────────────────────
export const createLeadSchema = z.object({
  gym_id:          uuidField,
  name:            z.string().min(1).max(LIMITS.lead_name).transform(s => s.trim()),
  email:           emailField,
  phone:           phoneField,
  turnstile_token: z.string().optional(),
});

// ─── Public: reservar clase gratis ───────────────────────────────────────────
export const reservarClaseGratisSchema = z.object({
  gym_id:      uuidField,
  phone:       z.string().min(6).max(LIMITS.phone),
  name:        z.string().max(LIMITS.lead_name).optional().nullable(),
  clase_id:    uuidField.optional().nullable(),
  fecha:       dateField,
  hora:        z.string().regex(/^\d{2}:\d{2}$/).optional().nullable(),
  clase_nombre:z.string().max(LIMITS.clase_nombre).optional().nullable(),
});

// ─── Public: reservar clase ───────────────────────────────────────────────────
export const reservaBookSchema = z.object({
  class_id:        uuidField,
  lead_name:       z.string().min(1).max(LIMITS.lead_name).transform(s => s.trim()),
  lead_phone:      z.string().min(6).max(LIMITS.phone),
  gym_id:          uuidField,
  turnstile_token: z.string().optional(),
});

// ─── Alumno: rutina ───────────────────────────────────────────────────────────
const ejercicioSchema = z.object({
  nombre:   z.string().min(1).max(LIMITS.ejercicio).transform(s => s.trim()),
  series:   z.number().int().min(1).max(99).optional(),
  reps:     z.string().max(30).optional().nullable(),
  peso:     z.number().min(0).max(9999).optional().nullable(),
  notas:    z.string().max(300).optional().nullable(),
}).passthrough();

export const rutinaSchema = z.object({
  nombre:    z.string().min(1).max(LIMITS.rutina_nombre).transform(s => s.trim()),
  ejercicios:z.array(ejercicioSchema).max(100),
});

// ─── Alumno: pesos ────────────────────────────────────────────────────────────
export const pesoEntrySchema = z.object({
  ejercicio: z.string().min(1).max(LIMITS.ejercicio).transform(s => s.trim()),
  peso:      z.number().min(0).max(9999),
  fecha:     dateField,
  notas:     z.string().max(300).optional().nullable(),
});

// ─── Alumno: push subscriptions ────────────────────────────────────────────────
export const pushSubscribeSchema = z.object({
  alumno_id: uuidField,
  subscription: z.object({
    endpoint: z.string().url("Endpoint inválido."),
    keys: z.object({
      p256dh: z.string().min(1, "p256dh requerido."),
      auth: z.string().min(1, "auth requerido."),
    }),
  }),
});

export type PushSubscribeInput = z.infer<typeof pushSubscribeSchema>;

// ─── WhatsApp: send message ───────────────────────────────────────────────────
export const whatsappSendSchema = z.object({
  gym_id: uuidField,
  phone: z.string().min(5, "Teléfono inválido.").max(20, "Teléfono muy largo."),
  message: z.string().min(1, "Mensaje obligatorio.").max(4096, "Mensaje muy largo."),
});

export type WhatsappSendInput = z.infer<typeof whatsappSendSchema>;

// ─── IA: rutina sugerir ────────────────────────────────────────────────────────
export const rutinaSugerirSchema = z.object({
  objetivo: z.string().min(1, "Objetivo requerido.").max(100, "Objetivo muy largo.").optional().nullable(),
  alumno_name: z.string().max(100, "Nombre muy largo.").optional().nullable(),
  notas: z.string().max(500, "Notas muy largas.").optional().nullable(),
  tipo: z.enum(["wod", "rutina"]).optional(),
  modalidad: z.string().max(50).optional().nullable(),
  time_cap: z.string().max(20).optional().nullable(),
});

export type RutinaSugerirInput = z.infer<typeof rutinaSugerirSchema>;

// ─── Helper: parsear y devolver 400 si falla ─────────────────────────────────
export function parseBody<T>(
  schema: z.ZodSchema<T>,
  data: unknown,
): { ok: true; data: T } | { ok: false; error: string; status: 400 } {
  const result = schema.safeParse(data);
  if (!result.success) {
    const issues = result.error.issues;
    const first  = issues[0];
    const msg    = first ? `${first.path.join(".")}: ${first.message}` : "Datos inválidos.";
    return { ok: false, error: msg, status: 400 };
  }
  return { ok: true, data: result.data };
}
