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
