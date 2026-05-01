import { NextResponse } from "next/server";

export async function POST() {
  return NextResponse.json(
    {
      text: "Este flujo fue reemplazado. Si necesitás ayuda con tus planes, usá soporte con ChatGPT desde el sistema.",
    },
    { status: 410 },
  );
}
