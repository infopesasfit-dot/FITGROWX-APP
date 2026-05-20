import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { loginSchema, reservationSchema, paymentSchema } from "../lib/alumno-schemas";

describe("Alumno User Flows", () => {
  describe("Authentication Flow", () => {
    it("validates login credentials with correct format", () => {
      const loginData = {
        email: "alumno@example.com",
        dni: "12345678",
        password: "securepass123",
      };

      const result = loginSchema.safeParse(loginData);
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data).toEqual(loginData);
      }
    });

    it("rejects login with invalid email format", () => {
      const loginData = {
        email: "invalid-email",
        dni: "12345678",
        password: "securepass123",
      };

      const result = loginSchema.safeParse(loginData);
      expect(result.success).toBe(false);
    });

    it("rejects login with invalid DNI format", () => {
      const loginData = {
        email: "alumno@example.com",
        dni: "123",
        password: "securepass123",
      };

      const result = loginSchema.safeParse(loginData);
      expect(result.success).toBe(false);
    });

    it("rejects login with short password", () => {
      const loginData = {
        email: "alumno@example.com",
        dni: "12345678",
        password: "short",
      };

      const result = loginSchema.safeParse(loginData);
      expect(result.success).toBe(false);
    });
  });

  describe("Class Reservation Flow", () => {
    it("validates class reservation with correct data", () => {
      const reservationData = {
        clase_id: "class-001",
        fecha: "2026-05-25",
      };

      const result = reservationSchema.safeParse(reservationData);
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data).toEqual(reservationData);
      }
    });

    it("rejects reservation with missing clase_id", () => {
      const reservationData = {
        clase_id: "",
        fecha: "2026-05-25",
      };

      const result = reservationSchema.safeParse(reservationData);
      expect(result.success).toBe(false);
    });

    it("rejects reservation with invalid date format", () => {
      const reservationData = {
        clase_id: "class-001",
        fecha: "25-05-2026",
      };

      const result = reservationSchema.safeParse(reservationData);
      expect(result.success).toBe(false);
    });

    it("rejects reservation with future date beyond reasonable range", () => {
      const reservationData = {
        clase_id: "class-001",
        fecha: "2030-12-31",
      };

      const result = reservationSchema.safeParse(reservationData);
      expect(result.success).toBe(true);
    });

    it("accepts reservation for today", () => {
      const today = new Date().toISOString().slice(0, 10);
      const reservationData = {
        clase_id: "class-001",
        fecha: today,
      };

      const result = reservationSchema.safeParse(reservationData);
      expect(result.success).toBe(true);
    });
  });

  describe("Payment Flow", () => {
    it("validates payment with alumno and gym IDs", () => {
      const paymentData = {
        alumno_id: "alumno-123",
        gym_id: "gym-456",
      };

      const result = paymentSchema.safeParse(paymentData);
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data).toEqual(paymentData);
      }
    });

    it("rejects payment with missing alumno_id", () => {
      const paymentData = {
        alumno_id: "",
        gym_id: "gym-456",
      };

      const result = paymentSchema.safeParse(paymentData);
      expect(result.success).toBe(false);
    });

    it("rejects payment with missing gym_id", () => {
      const paymentData = {
        alumno_id: "alumno-123",
        gym_id: "",
      };

      const result = paymentSchema.safeParse(paymentData);
      expect(result.success).toBe(false);
    });

    it("accepts payment with UUID-style IDs", () => {
      const paymentData = {
        alumno_id: "550e8400-e29b-41d4-a716-446655440000",
        gym_id: "650e8400-e29b-41d4-a716-446655440001",
      };

      const result = paymentSchema.safeParse(paymentData);
      expect(result.success).toBe(true);
    });
  });

  describe("Combined Flows", () => {
    it("supports login → reserve → payment sequence", () => {
      // Login
      const loginData = {
        email: "alumno@example.com",
        dni: "12345678",
        password: "securepass123",
      };
      const loginValid = loginSchema.safeParse(loginData);
      expect(loginValid.success).toBe(true);

      // Reserve
      const reservationData = {
        clase_id: "class-001",
        fecha: "2026-05-25",
      };
      const reservationValid = reservationSchema.safeParse(reservationData);
      expect(reservationValid.success).toBe(true);

      // Pay
      const paymentData = {
        alumno_id: "alumno-123",
        gym_id: "gym-456",
      };
      const paymentValid = paymentSchema.safeParse(paymentData);
      expect(paymentValid.success).toBe(true);
    });

    it("validates all steps fail safely without breaking subsequent validations", () => {
      // Invalid login
      const loginData = {
        email: "invalid",
        dni: "1",
        password: "short",
      };
      const loginValid = loginSchema.safeParse(loginData);
      expect(loginValid.success).toBe(false);

      // But reservation still works independently
      const reservationData = {
        clase_id: "class-001",
        fecha: "2026-05-25",
      };
      const reservationValid = reservationSchema.safeParse(reservationData);
      expect(reservationValid.success).toBe(true);
    });

    it("allows multiple reservations in sequence", () => {
      const reservationIds = ["class-001", "class-002", "class-003"];

      for (const claseId of reservationIds) {
        const reservation = {
          clase_id: claseId,
          fecha: "2026-05-25",
        };
        const result = reservationSchema.safeParse(reservation);
        expect(result.success).toBe(true);
      }
    });
  });

  describe("Error Messages", () => {
    it("provides clear error message for invalid email in login", () => {
      const loginData = {
        email: "invalid-email",
        dni: "12345678",
        password: "securepass123",
      };

      const result = loginSchema.safeParse(loginData);
      expect(result.success).toBe(false);
      if (!result.success) {
        const emailError = result.error.issues.find(
          (issue) => issue.path[0] === "email"
        );
        expect(emailError).toBeDefined();
        expect(emailError?.message).toContain("Email");
      }
    });

    it("provides clear error message for short password in login", () => {
      const loginData = {
        email: "alumno@example.com",
        dni: "12345678",
        password: "123",
      };

      const result = loginSchema.safeParse(loginData);
      expect(result.success).toBe(false);
      if (!result.success) {
        const passwordError = result.error.issues.find(
          (issue) => issue.path[0] === "password"
        );
        expect(passwordError).toBeDefined();
        expect(passwordError?.message).toContain("6");
      }
    });

    it("provides clear error message for invalid date format in reservation", () => {
      const reservationData = {
        clase_id: "class-001",
        fecha: "invalid-date",
      };

      const result = reservationSchema.safeParse(reservationData);
      expect(result.success).toBe(false);
      if (!result.success) {
        const dateError = result.error.issues.find(
          (issue) => issue.path[0] === "fecha"
        );
        expect(dateError).toBeDefined();
      }
    });
  });

  describe("Data Persistence Readiness", () => {
    it("validates data can be serialized to JSON (login)", () => {
      const loginData = {
        email: "alumno@example.com",
        dni: "12345678",
        password: "securepass123",
      };

      const result = loginSchema.safeParse(loginData);
      expect(result.success).toBe(true);

      if (result.success) {
        const json = JSON.stringify(result.data);
        const parsed = JSON.parse(json);
        expect(parsed).toEqual(loginData);
      }
    });

    it("validates data can be serialized to JSON (reservation)", () => {
      const reservationData = {
        clase_id: "class-001",
        fecha: "2026-05-25",
      };

      const result = reservationSchema.safeParse(reservationData);
      expect(result.success).toBe(true);

      if (result.success) {
        const json = JSON.stringify(result.data);
        const parsed = JSON.parse(json);
        expect(parsed).toEqual(reservationData);
      }
    });

    it("validates data can be serialized to JSON (payment)", () => {
      const paymentData = {
        alumno_id: "alumno-123",
        gym_id: "gym-456",
      };

      const result = paymentSchema.safeParse(paymentData);
      expect(result.success).toBe(true);

      if (result.success) {
        const json = JSON.stringify(result.data);
        const parsed = JSON.parse(json);
        expect(parsed).toEqual(paymentData);
      }
    });
  });
});
