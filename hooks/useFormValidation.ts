"use client";

import { useState, useCallback } from "react";
import { ZodSchema } from "zod";

interface ValidationState {
  errors: Record<string, string>;
  isValid: boolean;
  isDirty: boolean;
}

export function useFormValidation<T>(schema: ZodSchema) {
  const [state, setState] = useState<ValidationState>({
    errors: {},
    isValid: true,
    isDirty: false,
  });

  const validate = useCallback(
    (data: any): data is T => {
      try {
        schema.parse(data);
        setState({ errors: {}, isValid: true, isDirty: true });
        return true;
      } catch (err: any) {
        const errors: Record<string, string> = {};

        if (err.issues) {
          for (const issue of err.issues) {
            const path = issue.path.join(".");
            errors[path] = issue.message;
          }
        }

        setState({ errors, isValid: false, isDirty: true });
        return false;
      }
    },
    [schema]
  );

  const validateField = useCallback(
    (field: string, value: any): string | null => {
      try {
        const fieldSchema = schema instanceof Object ? schema : null;
        if (!fieldSchema) return null;

        // Partial validation for single field
        const obj = { [field]: value };
        schema.parse(obj);
        return null;
      } catch (err: any) {
        if (err.issues && err.issues.length > 0) {
          return err.issues[0].message;
        }
        return "Validation error";
      }
    },
    [schema]
  );

  const reset = useCallback(() => {
    setState({ errors: {}, isValid: true, isDirty: false });
  }, []);

  return {
    ...state,
    validate,
    validateField,
    reset,
    setError: (field: string, message: string) =>
      setState((prev) => ({
        ...prev,
        errors: { ...prev.errors, [field]: message },
        isValid: false,
      })),
  };
}
