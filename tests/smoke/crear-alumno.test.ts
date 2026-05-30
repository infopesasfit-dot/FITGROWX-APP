import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";
import { createSupabaseChain, createSupabaseAdminMock } from "../mocks/supabase";

// ── Auth mutable para el test de 401 ─────────────────────────────────────────
let mockUserData: { user: { id: string } | null } = { user: { id: "admin-user-id" } };
let mockAuthError: object | null = null;

// ── Mocks ─────────────────────────────────────────────────────────────────────

const mockAdmin = createSupabaseAdminMock();

vi.mock("@/lib/supabase-admin", () => ({
  getSupabaseAdminClient: () => mockAdmin,
}));

vi.mock("@/lib/supabase-server", () => ({
  createSupabaseServerClient: vi.fn(async () => ({
    auth: { getUser: async () => ({ data: mockUserData, error: mockAuthError }) },
  })),
}));

// ── Helpers ───────────────────────────────────────────────────────────────────

function makeRequest(body: object) {
  return new NextRequest("https://fitgrowx.com/api/admin/alumnos", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

// ── Tests ─────────────────────────────────────────────────────────────────────

describe("Smoke: crear alumno", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockUserData  = { user: { id: "admin-user-id" } };
    mockAuthError = null;
  });

  it("crea alumno con datos válidos → 200 + id", async () => {
    const profileChain = createSupabaseChain({ data: { gym_id: "gym-123", role: "admin" } });
    const gymsChain    = createSupabaseChain({ data: { plan_type: "ilimitado" } });

    const alumnoData = { id: "nuevo-id", full_name: "Juan Pérez", dni: null, phone: null, email: null, plan_id: null, status: "activo", next_expiration_date: null };

    // Crea un nuevo chain cada vez que se llama from("alumnos")
    // para que cada query tenga su propio estado
    const createAlumnosChain = () => createSupabaseChain((state) => {
      if (state.lastSelectOptions?.count === "exact") {
        return { count: null };
      }
      if (state.methodSequence.includes("insert")) {
        return { data: alumnoData, error: null };
      }
      return { data: null };
    });

    mockAdmin.from.mockImplementation((table: string) => {
      if (table === "profiles") return profileChain;
      if (table === "gyms")     return gymsChain;
      if (table === "alumnos")  return createAlumnosChain();
      return createSupabaseChain({ data: null });
    });

    const { POST } = await import("@/app/api/admin/alumnos/route");
    const res  = await POST(makeRequest({ full_name: "Juan Pérez", dni: "12345678", status: "activo" }));
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.ok).toBe(true);
    expect(body.alumno).toMatchObject({ id: "nuevo-id", full_name: "Juan Pérez" });
  });

  it("rechaza sin full_name → 400", async () => {
    mockAdmin.from.mockImplementation((table: string) => {
      if (table === "profiles") return createSupabaseChain({ data: { gym_id: "gym-123", role: "admin" } });
      if (table === "gyms")     return createSupabaseChain({ data: { plan_type: "ilimitado" } });
      if (table === "alumnos") return createSupabaseChain({ count: 0 });
      return createSupabaseChain({ data: null });
    });

    const { POST } = await import("@/app/api/admin/alumnos/route");
    const res  = await POST(makeRequest({ status: "activo" }));
    const body = await res.json();

    expect(res.status).toBe(400);
    expect(body.ok).toBe(false);
  });

  it("rechaza si no está autenticado → 401", async () => {
    mockUserData  = { user: null };
    mockAuthError = { message: "Not authenticated" };

    const { POST } = await import("@/app/api/admin/alumnos/route");
    const res = await POST(makeRequest({ full_name: "Test" }));

    expect(res.status).toBe(401);
  });
});
