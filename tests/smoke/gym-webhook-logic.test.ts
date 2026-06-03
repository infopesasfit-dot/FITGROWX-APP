import { describe, it, expect, vi, beforeAll } from "vitest";
import { createSupabaseAdminMock } from "../mocks/supabase";

// Importing the route runs module-level getSupabaseAdminClient(); mock it so the
// import doesn't try to build a real client.
vi.mock("@/lib/supabase-admin", () => ({
  getSupabaseAdminClient: () => createSupabaseAdminMock(),
}));

let mod: typeof import("@/app/api/mp/gym-webhook/route");

beforeAll(async () => {
  // MASTER_SECRET is read at module-eval time → set before the dynamic import.
  process.env.MP_WEBHOOK_SECRET = "test-master-secret-abc123";
  mod = await import("@/app/api/mp/gym-webhook/route");
});

// ── wt token: ahora ES la única auth del gym-webhook (tras quitar x-signature) ──
describe("gym-webhook · verificarTokenWebhook (wt)", () => {
  it("acepta el token generado para el mismo gym", () => {
    const gymId = "gym-aaa";
    const token = mod.generarTokenWebhook(gymId);
    expect(mod.verificarTokenWebhook(gymId, token)).toBe(true);
  });

  it("rechaza un token incorrecto", () => {
    expect(mod.verificarTokenWebhook("gym-aaa", "deadbeefdeadbeefdeadbeefdeadbeef")).toBe(false);
  });

  it("rechaza el token de OTRO gym (es por-gym)", () => {
    const tokenOtro = mod.generarTokenWebhook("gym-bbb");
    expect(mod.verificarTokenWebhook("gym-aaa", tokenOtro)).toBe(false);
  });

  it("rechaza string vacío", () => {
    expect(mod.verificarTokenWebhook("gym-aaa", "")).toBe(false);
  });
});

// ── Matemática de vencimiento de membresía (bug acá = cliente que pagó afuera) ──
describe("gym-webhook · calcularNuevoVencimiento", () => {
  const FUTURE = "2099-01-15"; // base lejana → base = este valor (FUTURE > hoy siempre)

  it("duracion_dias tiene prioridad sobre el periodo", () => {
    // duracion_dias=30 gana aunque periodo sea 'anual'
    expect(mod.calcularNuevoVencimiento(FUTURE, "anual", 30)).toBe("2099-02-14");
  });

  it("mensual = +1 mes", () => {
    expect(mod.calcularNuevoVencimiento(FUTURE, "mensual", null)).toBe("2099-02-15");
  });

  it("trimestral = +3 meses", () => {
    expect(mod.calcularNuevoVencimiento(FUTURE, "trimestral", null)).toBe("2099-04-15");
  });

  it("anual = +12 meses", () => {
    expect(mod.calcularNuevoVencimiento(FUTURE, "anual", null)).toBe("2100-01-15");
  });

  it("semanal = +7 días", () => {
    expect(mod.calcularNuevoVencimiento(FUTURE, "semanal", null)).toBe("2099-01-22");
  });

  it("periodo desconocido cae a +30 días", () => {
    expect(mod.calcularNuevoVencimiento(FUTURE, "loquesea", null)).toBe("2099-02-14");
  });

  it("renueva desde el vencimiento futuro, NO desde hoy (el que paga antes no pierde tiempo)", () => {
    const r = mod.calcularNuevoVencimiento(FUTURE, "mensual", null);
    expect(r > FUTURE).toBe(true);
    expect(r).toBe("2099-02-15");
  });

  it("si está vencido (null) parte de hoy → resultado en el futuro", () => {
    const today = new Date().toISOString().slice(0, 10);
    const r = mod.calcularNuevoVencimiento(null, "mensual", null);
    expect(r > today).toBe(true);
  });
});
