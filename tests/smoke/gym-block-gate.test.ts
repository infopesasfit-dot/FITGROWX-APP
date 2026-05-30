import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";
import { createSupabaseChain, createSupabaseAdminMock } from "../mocks/supabase";

// ── Mocks compartidos ─────────────────────────────────────────────────────────
const mockAdmin = createSupabaseAdminMock();

vi.mock("@/lib/supabase-admin", () => ({
  getSupabaseAdminClient: () => mockAdmin,
}));

vi.mock("@/lib/supabase-server", () => ({
  createSupabaseServerClient: vi.fn(async () => ({})),
  requireUser: vi.fn(async () => ({ id: "admin-user-id" })),
}));

// Filas de gym que producen cada estado en getGymPlanStatus (misma fuente de verdad)
const BLOCKED_GYM = { plan_type: "starter", trial_expires_at: null, is_subscription_active: false, subscription_expires_at: "2020-01-01T00:00:00.000Z" };
const ACTIVE_GYM  = { plan_type: "starter", trial_expires_at: null, is_subscription_active: true,  subscription_expires_at: "2999-01-01T00:00:00.000Z" };

function wireGym(gymRow: object, opts: { role?: string } = {}) {
  const role = opts.role ?? "admin";
  mockAdmin.from.mockImplementation((table: string) => {
    if (table === "profiles") return createSupabaseChain({ data: { gym_id: "gym-1", role } });
    if (table === "gyms")     return createSupabaseChain({ data: gymRow });
    if (table === "alumnos")  return createSupabaseChain({ data: null }); // 404 si pasa el gate
    return createSupabaseChain({ data: null });
  });
}

function freezeReq() {
  return new NextRequest("https://fitgrowx.com/api/admin/alumnos/freeze", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ alumno_id: "a-1", dias: 7 }),
  });
}

describe("requireGymNotBlocked (helper)", () => {
  beforeEach(() => vi.clearAllMocks());

  it("gym bloqueado → 403 + gym_blocked", async () => {
    mockAdmin.from.mockImplementation((t: string) =>
      t === "gyms" ? createSupabaseChain({ data: BLOCKED_GYM }) : createSupabaseChain({ data: null }));
    const { requireGymNotBlocked } = await import("@/lib/require-gym-not-blocked");
    const res = await requireGymNotBlocked("gym-1");
    expect(res).not.toBeNull();
    expect(res!.status).toBe(403);
    expect((await res!.json()).gym_blocked).toBe(true);
  });

  it("gym activo → null (deja pasar)", async () => {
    mockAdmin.from.mockImplementation((t: string) =>
      t === "gyms" ? createSupabaseChain({ data: ACTIVE_GYM }) : createSupabaseChain({ data: null }));
    const { requireGymNotBlocked } = await import("@/lib/require-gym-not-blocked");
    expect(await requireGymNotBlocked("gym-1")).toBeNull();
  });
});

describe("Gate de bloqueo en endpoint de escritura (freeze)", () => {
  beforeEach(() => vi.clearAllMocks());

  it("gym bloqueado → 403 antes de operar", async () => {
    wireGym(BLOCKED_GYM);
    const { POST } = await import("@/app/api/admin/alumnos/freeze/route");
    const res = await POST(freezeReq());
    expect(res.status).toBe(403);
    expect((await res.json()).gym_blocked).toBe(true);
  });

  it("gym activo → pasa el gate (no 403)", async () => {
    wireGym(ACTIVE_GYM);
    const { POST } = await import("@/app/api/admin/alumnos/freeze/route");
    const res = await POST(freezeReq());
    expect(res.status).not.toBe(403); // 404: alumno inexistente, pero superó el gate
  });
});
