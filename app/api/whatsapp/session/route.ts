import { NextRequest, NextResponse } from "next/server";

/** DELETE /api/whatsapp/session?gym_id=... — limpia ghost sessions antes de pedir un QR nuevo */
export async function DELETE(req: NextRequest) {
  const gymId = req.nextUrl.searchParams.get("gym_id");
  if (!gymId) return NextResponse.json({ error: "gym_id requerido" }, { status: 400 });

  const baseUrl = process.env.WA_MOTOR_URL;
  if (!baseUrl) return NextResponse.json({ ok: false, reason: "WA_MOTOR_URL not configured" });

  const headers: Record<string, string> = {};
  if (process.env.WA_MOTOR_API_KEY) headers["x-api-key"] = process.env.WA_MOTOR_API_KEY;

  try {
    // Fire-and-forget: si la sesión no existe el motor devuelve 404, lo ignoramos
    await fetch(`${baseUrl}/session/${gymId}`, { method: "DELETE", headers });
  } catch {
    // No es fatal — continuar igual
  }
  return NextResponse.json({ ok: true });
}
