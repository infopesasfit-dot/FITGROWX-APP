import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";

// ── Session mutable para el test de 401 ───────────────────────────────────────
let mockSessionData: object = { session: { user: { id: "admin-user-id" } } };

// ── Mocks ─────────────────────────────────────────────────────────────────────

const mockAdmin = { from: vi.fn() };

vi.mock("@/lib/supabase-admin", () => ({
  getSupabaseAdminClient: () => mockAdmin,
}));

vi.mock("@/lib/supabase-server", () => ({
  createSupabaseServerClient: vi.fn(async () => ({
    auth: { getSession: async () => ({ data: mockSessionData }) },
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

function makeChain(resolved: object) {
  const c: Record<string, ReturnType<typeof vi.fn>> = {};
  ["select","eq","is","maybeSingle","single","insert","update"].forEach(m => {
    c[m] = vi.fn().mockReturnValue(c);
  });
  c.maybeSingle.mockResolvedValue(resolved);
  c.single.mockResolvedValue(resolved);
  return c;
}

// ── Tests ─────────────────────────────────────────────────────────────────────

describe("Smoke: crear alumno", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockSessionData = { session: { user: { id: "admin-user-id" } } };
  });

  it("crea alumno con datos válidos → 200 + id", async () => {
    const profileChain = makeChain({ data: { gym_id: "gym-123", role: "admin" } });
    const gymsChain    = makeChain({ data: { plan_type: "ilimitado" } });

    // plan "ilimitado" → limit=null → count check se saltea → primera llamada es INSERT
    const alumnoData = { id: "nuevo-id", full_name: "Juan Pérez", dni: null, phone: null, email: null, plan_id: null, status: "activo", next_expiration_date: null };
    const insertChain = {
      insert: vi.fn().mockReturnValue({
        select: vi.fn().mockReturnValue({
          single: vi.fn().mockResolvedValue({ data: alumnoData, error: null }),
        }),
      }),
    };

    mockAdmin.from.mockImplementation((table: string) => {
      if (table === "profiles") return profileChain;
      if (table === "gyms")     return gymsChain;
      if (table === "alumnos")  return insertChain;
      return makeChain({ data: null });
    });

    const { POST } = await import("@/app/api/admin/alumnos/route");
    const res  = await POST(makeRequest({ full_name: "Juan Pérez", status: "activo" }));
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.ok).toBe(true);
    expect(body.alumno).toMatchObject({ id: "nuevo-id", full_name: "Juan Pérez" });
  });

  it("rechaza sin full_name → 400", async () => {
    mockAdmin.from.mockImplementation((table: string) => {
      if (table === "profiles") return makeChain({ data: { gym_id: "gym-123", role: "admin" } });
      if (table === "gyms")     return makeChain({ data: { plan_type: "ilimitado" } });
      if (table === "alumnos") {
        const c = { select: vi.fn(), eq: vi.fn(), is: vi.fn() };
        c.select.mockReturnValue(c); c.eq.mockReturnValue(c);
        c.is.mockResolvedValue({ count: 0 });
        return c;
      }
      return makeChain({ data: null });
    });

    const { POST } = await import("@/app/api/admin/alumnos/route");
    const res  = await POST(makeRequest({ status: "activo" }));
    const body = await res.json();

    expect(res.status).toBe(400);
    expect(body.ok).toBe(false);
  });

  it("rechaza si no está autenticado → 401", async () => {
    mockSessionData = { session: null };

    const { POST } = await import("@/app/api/admin/alumnos/route");
    const res = await POST(makeRequest({ full_name: "Test" }));

    expect(res.status).toBe(401);
  });
});
