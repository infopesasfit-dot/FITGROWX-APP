import { describe, it, expect } from "vitest";
import {
  loginSchema,
  photoUploadSchema,
  weightSchema,
  measurementSchema,
  reservationSchema,
  paymentSchema,
  planSchema,
  workoutCompletionSchema,
} from "../lib/alumno-schemas";

describe("alumno-schemas", () => {
  describe("loginSchema", () => {
    it("validates correct login data", () => {
      const data = {
        email: "test@example.com",
        dni: "12345678",
        password: "password123",
      };

      expect(() => loginSchema.parse(data)).not.toThrow();
    });

    it("rejects invalid email", () => {
      const data = {
        email: "invalid-email",
        dni: "12345678",
        password: "password123",
      };

      expect(() => loginSchema.parse(data)).toThrow();
    });

    it("rejects invalid DNI length", () => {
      const data = {
        email: "test@example.com",
        dni: "123",
        password: "password123",
      };

      expect(() => loginSchema.parse(data)).toThrow();
    });

    it("rejects DNI with non-numeric characters", () => {
      const data = {
        email: "test@example.com",
        dni: "1234567a",
        password: "password123",
      };

      expect(() => loginSchema.parse(data)).toThrow();
    });

    it("rejects password shorter than 6 characters", () => {
      const data = {
        email: "test@example.com",
        dni: "12345678",
        password: "12345",
      };

      expect(() => loginSchema.parse(data)).toThrow();
    });

    it("accepts 7-digit DNI", () => {
      const data = {
        email: "test@example.com",
        dni: "1234567",
        password: "password123",
      };

      expect(() => loginSchema.parse(data)).not.toThrow();
    });
  });

  describe("photoUploadSchema", () => {
    it("validates correct photo upload", () => {
      const file = new File(["content"], "photo.jpg", { type: "image/jpeg" });

      const data = {
        file,
        notes: "Foto de perfil",
        private: true,
      };

      expect(() => photoUploadSchema.parse(data)).not.toThrow();
    });

    it("accepts PNG files", () => {
      const file = new File(["content"], "photo.png", { type: "image/png" });

      const data = {
        file,
        notes: "Foto",
        private: false,
      };

      expect(() => photoUploadSchema.parse(data)).not.toThrow();
    });

    it("accepts WebP files", () => {
      const file = new File(["content"], "photo.webp", { type: "image/webp" });

      const data = {
        file,
      };

      expect(() => photoUploadSchema.parse(data)).not.toThrow();
    });

    it("rejects non-image file types", () => {
      const file = new File(["content"], "document.pdf", { type: "application/pdf" });

      const data = {
        file,
      };

      expect(() => photoUploadSchema.parse(data)).toThrow();
    });

    it("rejects files larger than 10MB", () => {
      const largeBuffer = new ArrayBuffer(11 * 1024 * 1024);
      const file = new File([largeBuffer], "large.jpg", { type: "image/jpeg" });

      const data = {
        file,
      };

      expect(() => photoUploadSchema.parse(data)).toThrow();
    });

    it("rejects notes longer than 500 characters", () => {
      const file = new File(["content"], "photo.jpg", { type: "image/jpeg" });

      const data = {
        file,
        notes: "a".repeat(501),
      };

      expect(() => photoUploadSchema.parse(data)).toThrow();
    });

    it("defaults private to true", () => {
      const file = new File(["content"], "photo.jpg", { type: "image/jpeg" });

      const data = photoUploadSchema.parse({
        file,
      });

      expect(data.private).toBe(true);
    });

    it("allows empty notes", () => {
      const file = new File(["content"], "photo.jpg", { type: "image/jpeg" });

      const data = {
        file,
        notes: "",
      };

      expect(() => photoUploadSchema.parse(data)).not.toThrow();
    });
  });

  describe("weightSchema", () => {
    it("validates correct weight data", () => {
      const data = {
        exercise: "Press de pecho",
        weight: 60,
        notes: "Con buena forma",
      };

      expect(() => weightSchema.parse(data)).not.toThrow();
    });

    it("rejects zero weight", () => {
      const data = {
        exercise: "Press de pecho",
        weight: 0,
        notes: "",
      };

      expect(() => weightSchema.parse(data)).toThrow();
    });

    it("rejects negative weight", () => {
      const data = {
        exercise: "Press de pecho",
        weight: -10,
      };

      expect(() => weightSchema.parse(data)).toThrow();
    });

    it("rejects weight exceeding 500kg", () => {
      const data = {
        exercise: "Press de pecho",
        weight: 501,
      };

      expect(() => weightSchema.parse(data)).toThrow();
    });

    it("rejects empty exercise name", () => {
      const data = {
        exercise: "",
        weight: 60,
      };

      expect(() => weightSchema.parse(data)).toThrow();
    });

    it("allows optional notes", () => {
      const data = {
        exercise: "Press de pecho",
        weight: 60,
      };

      expect(() => weightSchema.parse(data)).not.toThrow();
    });
  });

  describe("measurementSchema", () => {
    it("validates correct measurements", () => {
      const data = {
        peso_kg: 75.5,
        grasa_pct: 15,
        cintura_cm: 85,
      };

      expect(() => measurementSchema.parse(data)).not.toThrow();
    });

    it("rejects zero weight", () => {
      const data = {
        peso_kg: 0,
      };

      expect(() => measurementSchema.parse(data)).toThrow();
    });

    it("rejects body fat over 100%", () => {
      const data = {
        peso_kg: 75,
        grasa_pct: 101,
      };

      expect(() => measurementSchema.parse(data)).toThrow();
    });

    it("allows zero body fat", () => {
      const data = {
        peso_kg: 75,
        grasa_pct: 0,
      };

      expect(() => measurementSchema.parse(data)).not.toThrow();
    });

    it("allows optional body fat and waist", () => {
      const data = {
        peso_kg: 75,
      };

      expect(() => measurementSchema.parse(data)).not.toThrow();
    });
  });

  describe("reservationSchema", () => {
    it("validates correct reservation", () => {
      const data = {
        clase_id: "class-123",
        fecha: "2026-05-20",
      };

      expect(() => reservationSchema.parse(data)).not.toThrow();
    });

    it("rejects empty clase_id", () => {
      const data = {
        clase_id: "",
        fecha: "2026-05-20",
      };

      expect(() => reservationSchema.parse(data)).toThrow();
    });

    it("rejects invalid date format", () => {
      const data = {
        clase_id: "class-123",
        fecha: "20-05-2026",
      };

      expect(() => reservationSchema.parse(data)).toThrow();
    });

    it("rejects date without hyphens", () => {
      const data = {
        clase_id: "class-123",
        fecha: "20262605",
      };

      expect(() => reservationSchema.parse(data)).toThrow();
    });
  });

  describe("paymentSchema", () => {
    it("validates correct payment data", () => {
      const data = {
        alumno_id: "alumno-123",
        gym_id: "gym-456",
      };

      expect(() => paymentSchema.parse(data)).not.toThrow();
    });

    it("rejects empty alumno_id", () => {
      const data = {
        alumno_id: "",
        gym_id: "gym-456",
      };

      expect(() => paymentSchema.parse(data)).toThrow();
    });

    it("rejects empty gym_id", () => {
      const data = {
        alumno_id: "alumno-123",
        gym_id: "",
      };

      expect(() => paymentSchema.parse(data)).toThrow();
    });
  });

  describe("planSchema", () => {
    it("validates correct plan data", () => {
      const data = {
        plan_id: "plan-123",
        billingCycle: "monthly",
      };

      expect(() => planSchema.parse(data)).not.toThrow();
    });

    it("accepts quarterly billing cycle", () => {
      const data = {
        plan_id: "plan-123",
        billingCycle: "quarterly",
      };

      expect(() => planSchema.parse(data)).not.toThrow();
    });

    it("accepts annual billing cycle", () => {
      const data = {
        plan_id: "plan-123",
        billingCycle: "annual",
      };

      expect(() => planSchema.parse(data)).not.toThrow();
    });

    it("rejects invalid billing cycle", () => {
      const data = {
        plan_id: "plan-123",
        billingCycle: "weekly",
      };

      expect(() => planSchema.parse(data)).toThrow();
    });

    it("rejects empty plan_id", () => {
      const data = {
        plan_id: "",
        billingCycle: "monthly",
      };

      expect(() => planSchema.parse(data)).toThrow();
    });
  });

  describe("workoutCompletionSchema", () => {
    it("validates correct workout completion", () => {
      const data = {
        rutina_id: "rutina-123",
        duration_minutes: 60,
        notes: "Great workout!",
      };

      expect(() => workoutCompletionSchema.parse(data)).not.toThrow();
    });

    it("rejects zero duration", () => {
      const data = {
        rutina_id: "rutina-123",
        duration_minutes: 0,
      };

      expect(() => workoutCompletionSchema.parse(data)).toThrow();
    });

    it("rejects duration exceeding 1440 minutes (24 hours)", () => {
      const data = {
        rutina_id: "rutina-123",
        duration_minutes: 1441,
      };

      expect(() => workoutCompletionSchema.parse(data)).toThrow();
    });

    it("allows 1440 minutes (24 hours)", () => {
      const data = {
        rutina_id: "rutina-123",
        duration_minutes: 1440,
      };

      expect(() => workoutCompletionSchema.parse(data)).not.toThrow();
    });

    it("rejects notes exceeding 500 characters", () => {
      const data = {
        rutina_id: "rutina-123",
        duration_minutes: 60,
        notes: "a".repeat(501),
      };

      expect(() => workoutCompletionSchema.parse(data)).toThrow();
    });

    it("allows optional notes", () => {
      const data = {
        rutina_id: "rutina-123",
        duration_minutes: 60,
      };

      expect(() => workoutCompletionSchema.parse(data)).not.toThrow();
    });

    it("rejects empty rutina_id", () => {
      const data = {
        rutina_id: "",
        duration_minutes: 60,
      };

      expect(() => workoutCompletionSchema.parse(data)).toThrow();
    });
  });
});
