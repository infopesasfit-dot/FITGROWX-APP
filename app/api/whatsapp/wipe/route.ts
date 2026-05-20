import { NextRequest, NextResponse } from "next/server";

export async function POST(req: NextRequest) {
  const { gymId } = await req.json();

  if (!gymId) {
    return NextResponse.json({ error: "gym_id requerido" }, { status: 400 });
  }

  const motorUrl = process.env.WA_MOTOR_URL;
  const motorKey = process.env.WA_MOTOR_API_KEY;

  if (!motorUrl || !motorKey) {
    return NextResponse.json({ error: "Motor no configurado" }, { status: 500 });
  }

  try {
    const res = await fetch(`${motorUrl}/wipe/${gymId}`, {
      method: "POST",
      headers: { "x-api-key": motorKey },
      signal: AbortSignal.timeout(10000),
    });

    if (!res.ok) {
      const error = await res.text();
      return NextResponse.json(
        { error: `Motor error: ${error}` },
        { status: res.status }
      );
    }

    const data = await res.json();
    return NextResponse.json({ ok: true, message: data.message });
  } catch (error) {
    console.error("[WA Wipe]", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Error desconocido" },
      { status: 502 }
    );
  }
}
