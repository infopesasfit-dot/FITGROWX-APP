import { z } from "zod";

// Login/Auth
export const loginSchema = z.object({
  email: z.string().email("Email inválido"),
  dni: z.string().regex(/^\d{7,8}$/, "DNI debe tener 7-8 dígitos"),
  password: z.string().min(6, "Contraseña debe tener al menos 6 caracteres"),
});

export type LoginInput = z.infer<typeof loginSchema>;

// Photo upload
export const photoUploadSchema = z.object({
  file: z
    .instanceof(File)
    .refine((file) => file.size <= 10 * 1024 * 1024, "Foto no puede superar 10MB")
    .refine(
      (file) => ["image/jpeg", "image/png", "image/webp"].includes(file.type),
      "Solo JPEG, PNG o WebP permitidos"
    ),
  notes: z.string().max(500, "Notas máximo 500 caracteres").optional(),
  private: z.boolean().default(true),
});

export type PhotoUploadInput = z.infer<typeof photoUploadSchema>;

// Weight/kg tracking
export const weightSchema = z.object({
  exercise: z.string().min(1, "Ejercicio requerido"),
  weight: z.number().positive("Peso debe ser positivo").max(500, "Peso muy alto"),
  notes: z.string().max(200).optional(),
});

export type WeightInput = z.infer<typeof weightSchema>;

// Measurements
export const measurementSchema = z.object({
  peso_kg: z.number().positive("Peso debe ser positivo"),
  grasa_pct: z.number().min(0).max(100).optional(),
  cintura_cm: z.number().positive().optional(),
});

export type MeasurementInput = z.infer<typeof measurementSchema>;

// Reservation
export const reservationSchema = z.object({
  clase_id: z.string().min(1, "Clase requerida"),
  fecha: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Formato de fecha inválido"),
});

export type ReservationInput = z.infer<typeof reservationSchema>;

// Payment
export const paymentSchema = z.object({
  alumno_id: z.string().min(1),
  gym_id: z.string().min(1),
});

export type PaymentInput = z.infer<typeof paymentSchema>;

// Plan/Membership
export const planSchema = z.object({
  plan_id: z.string().min(1, "Plan requerido"),
  billingCycle: z.enum(["monthly", "quarterly", "annual"]),
});

export type PlanInput = z.infer<typeof planSchema>;

// Workout completion
export const workoutCompletionSchema = z.object({
  rutina_id: z.string().min(1),
  duration_minutes: z.number().positive().max(1440),
  notes: z.string().max(500).optional(),
});

export type WorkoutCompletionInput = z.infer<typeof workoutCompletionSchema>;
