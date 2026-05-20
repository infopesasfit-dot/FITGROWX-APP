import { NextResponse } from "next/server";
import type { z } from "zod";

export async function parseJson<T extends z.ZodTypeAny>(
  req: Request,
  schema: T,
): Promise<{ ok: true; data: z.infer<T> } | { ok: false; response: Response }> {
  let raw: unknown;
  try {
    raw = await req.json();
  } catch {
    return {
      ok: false,
      response: NextResponse.json({ error: "JSON inválido." }, { status: 400 }),
    };
  }

  const result = schema.safeParse(raw);
  if (!result.success) {
    const msg = result.error.issues[0]?.message ?? "Datos inválidos.";
    return {
      ok: false,
      response: NextResponse.json({ error: msg }, { status: 400 }),
    };
  }

  return { ok: true, data: result.data };
}
