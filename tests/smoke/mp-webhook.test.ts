import { describe, it, expect, vi, beforeEach } from "vitest";
import { createHmac } from "crypto";
import { NextRequest } from "next/server";
import { createSupabaseAdminMock } from "../mocks/supabase";

// ── Mocks ─────────────────────────────────────────────────────────────────────

vi.mock("@/lib/supabase-admin", () => ({
  getSupabaseAdminClient: () => createSupabaseAdminMock(),
}));

vi.stubGlobal("fetch", vi.fn().mockResolvedValue({
  ok: true,
  json: async () => ({ id: "pay-1", status: "pending", external_reference: null }),
}));

// ── Mocks controlables para tests del handler de pago anual ──────────────────

const sbMock = vi.hoisted(() => {
  const tableQueues: Record<string, Array<{ data: any }>> = {};
  const capturedGymUpdatePayloads: Array<{ table: string; payload: any }> = [];

  function enqueue(table: string, response: { data: any }) {
    if (!tableQueues[table]) tableQueues[table] = [];
    tableQueues[table].push(response);
  }

  function reset() {
    for (const k of Object.keys(tableQueues)) delete tableQueues[k];
    capturedGymUpdatePayloads.length = 0;
  }

  function makeChain(table: string): any {
    return {
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      insert: vi.fn().mockReturnThis(),
      upsert: vi.fn().mockReturnThis(),
      update: vi.fn().mockImplementation((payload: any) => {
        capturedGymUpdatePayloads.push({ table, payload });
        return { eq: vi.fn().mockResolvedValue({ error: null }) };
      }),
      maybeSingle: vi.fn().mockImplementation(() => {
        const item = (tableQueues[table] ?? []).shift() ?? { data: null };
        return Promise.resolve(item);
      }),
      single: vi.fn().mockResolvedValue({ data: null }),
    };
  }

  return {
    enqueue,
    reset,
    capturedGymUpdatePayloads,
    mockClient: {
      from: (table: string) => makeChain(table),
      auth: { admin: { getUserById: vi.fn().mockResolvedValue({ data: { user: null } }) } },
    },
  };
});

vi.mock("@supabase/supabase-js", () => ({
  createClient: () => sbMock.mockClient,
}));

vi.mock("@/lib/mp-timeout", () => ({
  fetchMpWithTimeout: vi.fn(),
}));

vi.mock("@/lib/wa", () => ({
  sendWa: vi.fn().mockResolvedValue({ ok: true }),
}));

// ── Helpers ───────────────────────────────────────────────────────────────────

const SECRET = "test-webhook-secret";

function buildSignedRequest(body: object, dataId = "0") {
  const requestId = "req-test-1";
  const ts = String(Date.now());
  const template = `id:${dataId};request-id:${requestId};ts:${ts}`;
  const sig = createHmac("sha256", SECRET).update(template).digest("hex");

  return new NextRequest(
    `https://fitgrowx.com/api/mp/webhook?data.id=${dataId}`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-signature":  `ts=${ts};v1=${sig}`,
        "x-request-id": requestId,
      },
      body: JSON.stringify(body),
    }
  );
}

// ── Tests ─────────────────────────────────────────────────────────────────────

describe("Smoke: MP webhook", () => {
  beforeEach(() => vi.clearAllMocks());

  it("firma inválida → 401", async () => {
    const req = new NextRequest("https://fitgrowx.com/api/mp/webhook?data.id=1", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-signature":  "ts=123;v1=firmafalsa",
        "x-request-id": "req-1",
      },
      body: JSON.stringify({ type: "test" }),
    });

    const { POST } = await import("@/app/api/mp/webhook/route");
    const res = await POST(req);

    expect(res.status).toBe(401);
  });

  it("firma válida + evento desconocido → 200 OK", async () => {
    const req = buildSignedRequest({ type: "test_event" });

    const { POST } = await import("@/app/api/mp/webhook/route");
    const res = await POST(req);
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.ok).toBe(true);
  });

  it("firma válida + body vacío → 200 OK (no explota)", async () => {
    const requestId = "req-2";
    const ts = String(Date.now());
    const dataId = "0";
    const template = `id:${dataId};request-id:${requestId};ts:${ts}`;
    const sig = createHmac("sha256", SECRET).update(template).digest("hex");

    const req = new NextRequest(
      `https://fitgrowx.com/api/mp/webhook?data.id=${dataId}`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-signature":  `ts=${ts};v1=${sig}`,
          "x-request-id": requestId,
        },
        body: "not-json",
      }
    );

    const { POST } = await import("@/app/api/mp/webhook/route");
    const res = await POST(req);

    expect(res.status).toBe(200);
  });

  it("GET de health check del webhook → 200", async () => {
    const { GET } = await import("@/app/api/mp/webhook/route");
    const res = await GET();

    expect(res.status).toBe(200);
  });
});

// ── Annual payment: monthly preapproval cancel failures ───────────────────────

describe("Annual payment: cancelación mensual al activar anual", () => {
  const SECRET = "test-webhook-secret";

  function buildAnnualPaymentRequest(paymentId: string) {
    const requestId = "req-annual-1";
    const ts = String(Date.now());
    const template = `id:${paymentId};request-id:${requestId};ts:${ts}`;
    const sig = createHmac("sha256", SECRET).update(template).digest("hex");

    return new NextRequest(
      `https://fitgrowx.com/api/mp/webhook?data.id=${paymentId}`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-signature":  `ts=${ts};v1=${sig}`,
          "x-request-id": requestId,
        },
        body: JSON.stringify({ type: "payment", data: { id: paymentId } }),
      },
    );
  }

  beforeEach(() => {
    vi.clearAllMocks();
    sbMock.reset();
    process.env.OWNER_PHONE = "5491100000000";
  });

  it("cancel mensual falla → mp_preapproval_id conservado en DB + alerta WA al platform owner", async () => {
    const monthlyPreapprovalId = "mp-monthly-preapproval-123";
    const annualPaymentId = "pay-annual-1";

    const { fetchMpWithTimeout } = await import("@/lib/mp-timeout") as any;
    const { sendWa } = await import("@/lib/wa") as any;

    // MP: GET payment → aprobado anual
    fetchMpWithTimeout.mockResolvedValueOnce({
      ok: true,
      status: 200,
      data: {
        id: annualPaymentId,
        status: "approved",
        external_reference: `gym-test|crecimiento|annual`,
        transaction_amount: 10000,
        date_approved: new Date().toISOString(),
      },
    });
    // MP: PUT /preapproval/:id → falla la cancelación
    fetchMpWithTimeout.mockResolvedValueOnce({
      ok: false,
      status: 500,
      data: null,
      error: "MP cancel failed",
    });

    // Supabase: idempotency check → aún no procesado
    sbMock.enqueue("mp_webhook_log", { data: null });
    // Supabase: datos actuales del gym → mensual vivo
    sbMock.enqueue("gyms", {
      data: {
        mp_preapproval_id: monthlyPreapprovalId,
        subscription_type: "monthly",
        subscription_expires_at: null,
      },
    });
    // Supabase: gym_settings para WA de confirmación
    sbMock.enqueue("gym_settings", {
      data: { gym_name: "Gym Test", whatsapp: "5491100000000" },
    });

    const { POST } = await import("@/app/api/mp/webhook/route");
    const res = await POST(buildAnnualPaymentRequest(annualPaymentId));
    const body = await res.json();

    // El anual se activa igual
    expect(res.status).toBe(200);
    expect(body.ok).toBe(true);

    // El update de gyms NO debe incluir mp_preapproval_id (preserva el id mensual)
    const gymUpdate = sbMock.capturedGymUpdatePayloads.find((u) => u.table === "gyms");
    expect(gymUpdate).toBeDefined();
    expect(gymUpdate!.payload).not.toHaveProperty("mp_preapproval_id");
    expect(gymUpdate!.payload.subscription_type).toBe("annual");
    expect(gymUpdate!.payload.is_subscription_active).toBe(true);

    // WA enviado dos veces: confirmación al gym + alerta al platform owner
    expect(sendWa).toHaveBeenCalledTimes(2);

    // La alerta va al platform owner vía "fitgrowx-platform", no al gym
    const alertCall = sendWa.mock.calls.find((args: any[]) =>
      typeof args[2] === "string" && args[2].includes("Preapproval mensual sin cancelar"),
    );
    expect(alertCall).toBeDefined();
    expect(alertCall![0]).toBe("fitgrowx-platform");
    expect(alertCall![1]).toBe("5491100000000");
    expect(alertCall![2]).toContain(monthlyPreapprovalId);
    expect(alertCall![2]).toContain("gym-test");
  });
});
