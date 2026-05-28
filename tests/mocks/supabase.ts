import { vi } from "vitest";

/**
 * Crea un objeto chain encadenable que soporta los métodos que usa Supabase:
 * select, eq, is, gte, lt, or, not, limit, order, insert, update, maybeSingle, single, count, delete
 *
 * El resolved puede ser:
 * - Un objeto simple: devuelto por single/maybeSingle
 * - Una función: ejecutada al llamar single/maybeSingle, permite lógica dinámica
 */
export function createSupabaseChain(resolved: any = {}) {
  const chain: Record<string, any> = {};

  // Almacenar estado de la cadena para resolver inteligentemente
  const state = {
    methodSequence: [] as string[],
    lastSelectOptions: null as any,
  };

  // Métodos que retornan la cadena para permitir encadenamiento
  const chainableMethods = [
    "select", "eq", "is", "gte", "lt", "or", "not", "limit", "order",
    "insert", "update", "delete"
  ];

  chainableMethods.forEach(method => {
    chain[method] = vi.fn(function(...args: any[]) {
      state.methodSequence.push(method);
      if (method === "select") {
        state.lastSelectOptions = args[1];
      }
      return chain;
    });
  });

  // Métodos que resuelven con datos
  const resolveData = () => {
    if (typeof resolved === "function") {
      return resolved(state);
    }
    return resolved;
  };

  chain.maybeSingle = vi.fn().mockImplementation(() => Promise.resolve(resolveData()));
  chain.single = vi.fn().mockImplementation(() => Promise.resolve(resolveData()));
  chain.count = vi.fn().mockImplementation(() => Promise.resolve(resolveData()));

  return chain;
}

/**
 * Crea un mock del cliente Supabase admin con el método from() preconfigurado
 */
export function createSupabaseAdminMock() {
  return {
    from: vi.fn((table: string) => createSupabaseChain({ data: null })),
  };
}
