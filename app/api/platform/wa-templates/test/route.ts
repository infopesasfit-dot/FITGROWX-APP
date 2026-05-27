import { NextRequest, NextResponse } from "next/server";
import { getSupabaseAdminClient } from "@/lib/supabase-admin";
import { createSupabaseServerClient } from "@/lib/supabase-server";
import { sendWa } from "@/lib/wa";
import { applyRateLimit } from "@/lib/request-security";

const sb = getSupabaseAdminClient();

const MAX_BODY_CHARS = 1_000;
// 3 tests per minute per platform_owner user
const RATE_WINDOW_MS  = 60_000;
const RATE_MAX        = 3;

async function authorize() {
  const sbUser = await createSupabaseServerClient();
  const { data: { user } } = await sbUser.auth.getUser();
  if (!user) return null;
  const { data: profile } = await sb.from("profiles").select("role").eq("id", user.id).maybeSingle();
  return profile?.role === "platform_owner" ? user : null;
}

function fill(template: string, vars: Record<string, string>) {
  return Object.entries(vars).reduce(
    (s, [k, v]) => s.replace(new RegExp(`\\{${k}\\}`, "gi"), v),
    template,
  );
}

export async function POST(req: NextRequest) {
  const user = await authorize();
  if (!user) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  // Rate limit: 3 tests/min keyed to the authenticated user
  const rl = await applyRateLimit({
    namespace:   "wa-template-test",
    identifier:  user.id,
    windowMs:    RATE_WINDOW_MS,
    maxAttempts: RATE_MAX,
  });
  if (!rl.allowed) {
    return NextResponse.json(
      { error: `Límite alcanzado: máximo ${RATE_MAX} tests por minuto. Intentá en unos segundos.` },
      { status: 429 },
    );
  }

  const { key, phone, body } = await req.json();
  if (!key || !phone?.trim()) return NextResponse.json({ error: "key y phone requeridos" }, { status: 400 });

  // Hard body-size limit
  if (typeof body === "string" && body.length > MAX_BODY_CHARS) {
    return NextResponse.json(
      { error: `El cuerpo del template supera el máximo de ${MAX_BODY_CHARS} caracteres.` },
      { status: 400 },
    );
  }

  const digits = phone.replace(/\D/g, "");
  const normalizedPhone = digits.startsWith("549") ? digits : digits.startsWith("54") ? "549" + digits.slice(2) : "549" + digits;
  const preview = fill(body ?? "", { nombre: "Nombre", dias: "2" });

  // sendWa retorna { ok: boolean, ... } — usar .ok, NO el objeto.
  const ok = await sendWa("fitgrowx-platform", normalizedPhone, `[TEST — ${key}]\n\n${preview}`, { route: "wa-templates/test", timeout: 10_000 });

  // Log every test attempt regardless of outcome
  console.log(
    `[wa-template-test] user=${user.id} key=${key} phone=${normalizedPhone} bodyLen=${(body ?? "").length} ok=${ok.ok} remaining=${rl.remaining}`,
  );

  if (!ok.ok) return NextResponse.json({ error: "No se pudo enviar. Verificá que el QR esté conectado." }, { status: 500 });
  return NextResponse.json({ ok: true, remaining: rl.remaining });
}
