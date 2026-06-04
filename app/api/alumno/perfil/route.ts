import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { requireAlumnoActionAllowed } from "@/lib/alumno-action-guard";
import { getSupabaseAdminClient } from "@/lib/supabase-admin";
import { logger } from "@/lib/logger";

const supabase = getSupabaseAdminClient();

const perfilSchema = z.object({
  full_name: z.string().max(100).regex(/^[^\x00-\x1F\x7F]*$/, "Caracteres inválidos").optional(),
  email: z.string().email("Email inválido").optional(),
  phone: z.string().regex(/^\+[1-9]\d{7,14}$/, "Teléfono debe estar en formato E.164").optional(),
}).strict();

export async function PATCH(req: NextRequest) {
  const access = await requireAlumnoActionAllowed(req);
  if ("response" in access) return access.response;
  const { tokenRow } = access;

  let body: unknown;
  try { body = await req.json(); }
  catch { return NextResponse.json({ error: "Formato inválido." }, { status: 400 }); }

  const parsed = perfilSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0].message }, { status: 400 });
  }

  const update: Record<string, unknown> = {};
  for (const [key, val] of Object.entries(parsed.data)) {
    if (val !== undefined) update[key] = (val as string).trim() || null;
  }

  if (Object.keys(update).length === 0) {
    return NextResponse.json({ error: "Sin campos para actualizar." }, { status: 400 });
  }

  const { error } = await supabase
    .from("alumnos")
    .update(update)
    .eq("id", tokenRow.alumno_id)
    .eq("gym_id", tokenRow.gym_id);

if (error) {
  void logger.error("db error", { route: "/alumno/perfil", meta: { error } });
  return NextResponse.json({ error: "Error interno. Intente nuevamente." }, { status: 500 });
  }
  return NextResponse.json({ ok: true });
}
