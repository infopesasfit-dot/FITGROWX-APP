import { NextRequest, NextResponse } from "next/server";
import { getSupabaseAdminClient } from "@/lib/supabase-admin";
import { createSupabaseServerClient } from "@/lib/supabase-server";
import { logger } from "@/lib/logger";

const VALID_KEYS = new Set(["bienvenida", "trial_vence", "reactivacion", "inactivo_7d", "activacion_d3", "trial_expirado", "primer_pago"]);

async function authorize() {
  const sbUser = await createSupabaseServerClient();
  const { data: { user } } = await sbUser.auth.getUser();
  if (!user) return null;
  const sb = getSupabaseAdminClient();
  const { data: profile } = await sb.from("profiles").select("role").eq("id", user.id).maybeSingle();
  return profile?.role === "platform_owner" ? sb : null;
}

export async function GET() {
  const sb = await authorize();
  if (!sb) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { data } = await sb.from("platform_wa_templates").select("key, body, enabled, updated_at");
  const map: Record<string, { body: string; enabled: boolean }> = {};
  for (const row of data ?? []) map[row.key] = { body: row.body, enabled: row.enabled ?? true };
  return NextResponse.json(map);
}

export async function POST(req: NextRequest) {
  const sb = await authorize();
  if (!sb) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { key, body, enabled } = await req.json();
  if (!key || !VALID_KEYS.has(key)) return NextResponse.json({ error: "key inválido" }, { status: 400 });

  const upsertData: Record<string, unknown> = { key, updated_at: new Date().toISOString() };
  if (typeof body === "string") {
    if (!body.trim()) return NextResponse.json({ error: "El cuerpo de la plantilla no puede estar vacío. Para desactivarla usá el toggle." }, { status: 400 });
    upsertData.body = body.trim();
  }
  if (typeof enabled === "boolean") upsertData.enabled = enabled;

  const { error } = await sb.from("platform_wa_templates").upsert(upsertData, { onConflict: "key" });
if (error) {
  void logger.error("db error", { route: "/platform/wa-templates", meta: { error } });
  return NextResponse.json({ error: "Error interno. Intente nuevamente." }, { status: 500 });
  }
  return NextResponse.json({ ok: true });
}
