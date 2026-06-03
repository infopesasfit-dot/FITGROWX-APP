import { describe, it, expect, vi, beforeEach, beforeAll } from "vitest";

// Controllable mock for the platform webhook's supabaseAdmin (created via
// createClient from @supabase/supabase-js at module load).
const sb = vi.hoisted(() => {
  const state: {
    resellerUser: { email: string } | null;
    appByEmail: { email?: string | null; whatsapp?: string | null } | null;
    appByName: { email?: string | null; whatsapp?: string | null } | null;
  } = { resellerUser: null, appByEmail: null, appByName: null };

  const mockClient = {
    auth: {
      admin: {
        getUserById: vi.fn(async () => ({ data: { user: state.resellerUser } })),
      },
    },
    from: (table: string) => {
      const eqCols: string[] = [];
      const chain: any = {
        select: () => chain,
        eq: (col: string) => { eqCols.push(col); return chain; },
        maybeSingle: async () => {
          if (table !== "reseller_applications") return { data: null };
          if (eqCols.includes("name")) return { data: state.appByName };
          return { data: state.appByEmail };
        },
      };
      return chain;
    },
  };

  return { state, mockClient };
});

vi.mock("@supabase/supabase-js", () => ({ createClient: () => sb.mockClient }));
vi.mock("@/lib/wa", () => ({ sendWa: vi.fn().mockResolvedValue({ ok: true }) }));
vi.mock("@/lib/mp/timeout", () => ({ fetchMpWithTimeout: vi.fn() }));

let detectSelfReferral: typeof import("@/app/api/mp/webhook/route")["detectSelfReferral"];

beforeAll(async () => {
  process.env.MP_WEBHOOK_SECRET = "test-secret";
  ({ detectSelfReferral } = await import("@/app/api/mp/webhook/route"));
});

beforeEach(() => {
  sb.state.resellerUser = null;
  sb.state.appByEmail = null;
  sb.state.appByName = null;
  sb.mockClient.auth.admin.getUserById.mockClear();
});

describe("detectSelfReferral", () => {
  it("same user_id → ['same_user'] sin tocar la DB", async () => {
    const r = await detectSelfReferral({ user_id: "u1" }, { id: "r1", user_id: "u1" });
    expect(r).toEqual(["same_user"]);
    expect(sb.mockClient.auth.admin.getUserById).not.toHaveBeenCalled();
  });

  it("gym sin user_id → [] (no se puede evaluar)", async () => {
    expect(await detectSelfReferral({ user_id: null }, { id: "r1", user_id: "u2" })).toEqual([]);
  });

  it("reseller sin user_id → []", async () => {
    expect(await detectSelfReferral({ user_id: "u1" }, { id: "r1", user_id: null })).toEqual([]);
  });

  it("email coincidente (distinto user_id) → ['email']", async () => {
    sb.state.resellerUser = { email: "Dueno@Gym.com" };
    sb.state.appByEmail = { whatsapp: null };
    const r = await detectSelfReferral(
      { user_id: "uG", email: "dueno@gym.com" },
      { id: "r1", user_id: "uR", name: "R" },
    );
    expect(r).toEqual(["email"]);
  });

  it("teléfono coincidente (vía reseller_applications) → ['phone']", async () => {
    sb.state.resellerUser = { email: "reseller@x.com" };
    sb.state.appByEmail = { whatsapp: "+54 9 11 1234-5678" };
    const r = await detectSelfReferral(
      { user_id: "uG", email: null, whatsapp: "5491112345678" },
      { id: "r1", user_id: "uR", name: "R" },
    );
    expect(r).toEqual(["phone"]);
  });

  it("sin coincidencias → []", async () => {
    sb.state.resellerUser = { email: "reseller@x.com" };
    sb.state.appByEmail = { whatsapp: "5490000000000" };
    const r = await detectSelfReferral(
      { user_id: "uG", email: "gym@x.com", whatsapp: "5491112345678" },
      { id: "r1", user_id: "uR", name: "R" },
    );
    expect(r).toEqual([]);
  });
});
