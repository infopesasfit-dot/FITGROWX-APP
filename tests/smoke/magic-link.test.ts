import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";
import { createSupabaseChain, createSupabaseAdminMock } from "../mocks/supabase";

// ── Mocks ─────────────────────────────────────────────────────────────────────

const mockAdmin = createSupabaseAdminMock();

vi.mock("@/lib/supabase-admin", () => ({
  getSupabaseAdminClient: () => mockAdmin,
}));

vi.mock("@/lib/request-security", () => ({
  applyRateLimit:       async () => ({ allowed: true }),
  getClientIp:          () => "127.0.0.1",
  normalizeIdentifier:  (x: string) => x,
}));

// Silenciar el fetch al WA motor
vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ ok: true }));

// ── Helpers ───────────────────────────────────────────────────────────────────

function makeRequest(dni: string) {
  return new NextRequest("https://fitgrowx.com/api/alumno/request-access", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ dni }),
  });
}

// ── Tests ─────────────────────────────────────────────────────────────────────

describe("Smoke: magic link (request-access)", () => {
  beforeEach(() => vi.clearAllMocks());

  it("DNI válido con alumno registrado → 200 + ok:true", async () => {
    mockAdmin.from.mockImplementation((table: string) => {
      if (table === "alumnos")
        return createSupabaseChain({ data: { id: "alu-1", gym_id: "gym-1", full_name: "Ana García", phone: "5491100000000" }, error: null });
      if (table === "alumno_tokens")
        return createSupabaseChain({ data: { id: "tok-1" }, error: null });
      if (table === "gym_settings")
        return createSupabaseChain({ data: { gym_name: "Iron Gym", magiclink_msg: null, slug: "iron-gym" } });
      if (table === "gyms")
        return createSupabaseChain({ data: { name: "Iron Gym" } });
      return createSupabaseChain({ data: null });
    });

    const { POST } = await import("@/app/api/alumno/request-access/route");
    const res = await POST(makeRequest("12345678"));
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.ok).toBe(true);
  });

  it("DNI de alumno no registrado → sigue respondiendo 200 (no expone si existe)", async () => {
    mockAdmin.from.mockImplementation(() =>
      createSupabaseChain({ data: null, error: { message: "No rows found" } })
    );

    const { POST } = await import("@/app/api/alumno/request-access/route");
    const res = await POST(makeRequest("99999999"));
    const body = await res.json();

    // Respuesta ambigua intencional — no revela si el DNI existe
    expect(res.status).toBe(200);
    expect(body.ok).toBe(true);
  });

  it("DNI vacío → 400", async () => {
    const { POST } = await import("@/app/api/alumno/request-access/route");
    const res = await POST(makeRequest(""));

    expect(res.status).toBe(400);
  });

  it("DNI demasiado corto → 400", async () => {
    const { POST } = await import("@/app/api/alumno/request-access/route");
    const res = await POST(makeRequest("123"));

    expect(res.status).toBe(400);
  });
});
