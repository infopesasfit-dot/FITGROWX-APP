import { NextRequest, NextResponse } from "next/server";

function maskPhone(phone: string) {
  const digits = phone.replace(/\D/g, "");
  if (digits.length <= 4) return digits || "unknown";
  return `${digits.slice(0, 3)}***${digits.slice(-2)}`;
}

export async function POST(req: NextRequest) {
  const { gym_id, phone, message } = await req.json();
  const requestId = crypto.randomUUID().slice(0, 8);
  const endpoint = "/api/whatsapp/send";
  const phoneRef = typeof phone === "string" ? maskPhone(phone) : "unknown";
  const messageLength = typeof message === "string" ? message.length : 0;

  if (!gym_id || !phone || !message) {
    console.warn(`[WA SEND] ${new Date().toISOString()} ${endpoint} error validation request_id=${requestId} gym_id=${gym_id ?? "missing"} phone=${phoneRef}`);
    return NextResponse.json({ error: "gym_id, phone y message son requeridos" }, { status: 400 });
  }

  const baseUrl = process.env.WA_MOTOR_URL;
  if (!baseUrl) {
    console.error(`[WA SEND] ${new Date().toISOString()} ${endpoint} error config request_id=${requestId} gym_id=${gym_id} phone=${phoneRef} reason=WA_MOTOR_URL_missing`);
    return NextResponse.json({ error: "WA_MOTOR_URL not configured" }, { status: 500 });
  }

  const headers: Record<string, string> = {
    "Content-Type": "application/json",
  };

  if (process.env.WA_MOTOR_API_KEY) {
    headers["x-api-key"] = process.env.WA_MOTOR_API_KEY;
  }

  try {
    const motorRes = await fetch(`${baseUrl}/send/${gym_id}`, {
      method: "POST",
      headers,
      body: JSON.stringify({ phone, message }),
      signal: AbortSignal.timeout(8000),
    });

    if (!motorRes.ok) {
      const body = await motorRes.text();
      const reason = body.slice(0, 160).replace(/\s+/g, " ");
      console.error(
        `[WA SEND] ${new Date().toISOString()} ${endpoint} error request_id=${requestId} gym_id=${gym_id} phone=${phoneRef} status=${motorRes.status} msg_len=${messageLength} reason="${reason || "empty_response"}"`,
      );
      return NextResponse.json(
        { error: `WA motor HTTP ${motorRes.status}`, body },
        { status: motorRes.status },
      );
    }

    console.log(
      `[WA SEND] ${new Date().toISOString()} ${endpoint} ok request_id=${requestId} gym_id=${gym_id} phone=${phoneRef} msg_len=${messageLength}`,
    );
    return NextResponse.json({ ok: true });
  } catch (error) {
    const reason = error instanceof Error ? error.message : "WA motor request failed";
    console.error(
      `[WA SEND] ${new Date().toISOString()} ${endpoint} error request_id=${requestId} gym_id=${gym_id} phone=${phoneRef} msg_len=${messageLength} reason="${reason}"`,
    );
    return NextResponse.json(
      { error: reason },
      { status: 502 },
    );
  }
}
