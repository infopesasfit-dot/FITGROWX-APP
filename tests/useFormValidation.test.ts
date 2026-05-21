import { describe, it, expect } from "vitest";
import { renderHook, act } from "@testing-library/react";
import { z } from "zod";
import { useFormValidation } from "../hooks/useFormValidation";

describe("useFormValidation", () => {
  const testSchema = z.object({
    email: z.string().email("Email inválido"),
    password: z.string().min(6, "Mínimo 6 caracteres"),
    age: z.number().min(18, "Debe ser mayor de 18"),
  });

  it("initializes with empty errors and isValid true", () => {
    const { result } = renderHook(() => useFormValidation(testSchema));

    expect(result.current.errors).toEqual({});
    expect(result.current.isValid).toBe(true);
    expect(result.current.isDirty).toBe(false);
  });

  it("validates correct data", () => {
    const { result } = renderHook(() => useFormValidation(testSchema));

    let isValid: boolean;
    act(() => {
      isValid = result.current.validate({
        email: "test@example.com",
        password: "password123",
        age: 25,
      });
    });

    expect(isValid!).toBe(true);
    expect(result.current.errors).toEqual({});
    expect(result.current.isValid).toBe(true);
    expect(result.current.isDirty).toBe(true);
  });

  it("captures validation errors", () => {
    const { result } = renderHook(() => useFormValidation(testSchema));

    let isValid: boolean;
    act(() => {
      isValid = result.current.validate({
        email: "invalid-email",
        password: "123",
        age: 17,
      });
    });

    expect(isValid!).toBe(false);
    expect(result.current.isValid).toBe(false);
    expect(result.current.isDirty).toBe(true);
    expect(result.current.errors.email).toBe("Email inválido");
    expect(result.current.errors.password).toBe("Mínimo 6 caracteres");
    expect(result.current.errors.age).toBe("Debe ser mayor de 18");
  });

  it("validates individual fields with single-field schemas", () => {
    const singleFieldSchema = z.object({
      email: z.string().email("Email inválido"),
    });

    const { result } = renderHook(() => useFormValidation(singleFieldSchema));

    let emailError: string | null = null;
    act(() => {
      emailError = result.current.validateField("email", "invalid");
    });

    expect(emailError).toBe("Email inválido");
  });

  it("returns null for valid field validation", () => {
    const singleFieldSchema = z.object({
      email: z.string().email("Email inválido"),
    });

    const { result } = renderHook(() => useFormValidation(singleFieldSchema));

    let error: string | null = null;
    act(() => {
      error = result.current.validateField("email", "valid@example.com");
    });

    expect(error).toBeNull();
  });

  it("resets state with reset()", () => {
    const { result } = renderHook(() => useFormValidation(testSchema));

    act(() => {
      result.current.validate({ email: "bad", password: "1", age: 5 });
    });

    expect(result.current.isDirty).toBe(true);
    expect(Object.keys(result.current.errors).length).toBeGreaterThan(0);

    act(() => {
      result.current.reset();
    });

    expect(result.current.errors).toEqual({});
    expect(result.current.isValid).toBe(true);
    expect(result.current.isDirty).toBe(false);
  });

  it("allows manual error setting with setError()", () => {
    const { result } = renderHook(() => useFormValidation(testSchema));

    act(() => {
      result.current.setError("email", "Custom error message");
    });

    expect(result.current.errors.email).toBe("Custom error message");
    expect(result.current.isValid).toBe(false);
  });

  it("merges errors when setting multiple fields", () => {
    const { result } = renderHook(() => useFormValidation(testSchema));

    act(() => {
      result.current.setError("email", "Email error");
    });

    act(() => {
      result.current.setError("password", "Password error");
    });

    expect(result.current.errors.email).toBe("Email error");
    expect(result.current.errors.password).toBe("Password error");
  });

  it("handles nested object validation", () => {
    const nestedSchema = z.object({
      user: z.object({
        name: z.string().min(2),
        email: z.string().email(),
      }),
    });

    const { result } = renderHook(() => useFormValidation(nestedSchema));

    let isValid = false;
    act(() => {
      isValid = result.current.validate({
        user: {
          name: "A",
          email: "invalid",
        },
      });
    });

    expect(isValid).toBe(false);
    expect(result.current.errors["user.name"]).toBeTruthy();
    expect(result.current.errors["user.email"]).toBeTruthy();
  });

  it("preserves existing errors when setting new ones", () => {
    const { result } = renderHook(() => useFormValidation(testSchema));

    act(() => {
      result.current.validate({
        email: "invalid",
        password: "valid123",
        age: 25,
      });
    });

    expect(Object.keys(result.current.errors).length).toBe(1);
    expect(result.current.errors.email).toBeDefined();

    act(() => {
      result.current.setError("password", "Additional error");
    });

    expect(Object.keys(result.current.errors).length).toBe(2);
    expect(result.current.errors.email).toBeDefined();
    expect(result.current.errors.password).toBe("Additional error");
  });
});
