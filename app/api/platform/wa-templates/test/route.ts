import { NextRequest, NextResponse } from "next/server";
import { getSupabaseAdminClient } from "@/lib/supabase-admin";
import { createSupabaseServerClient } from "@/lib/supabase-server";

const sb = getSupabaseAdminClient();

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
  if (!await authorize()) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const { key, phone, body } = await req.json();
  if (!key || !phone?.trim()) return NextResponse.json({ error: "key y phone requeridos" }, { status: 400 });

  const motorUrl = process.env.WA_MOTOR_URL;
  if (!motorUrl) return NextResponse.json({ error: "WA_MOTOR_URL no configurado" }, { status: 500 });

  const digits = phone.replace(/\D/g, "");
  const normalizedPhone = digits.startsWith("549") ? digits : digits.startsWith("54") ? "549" + digits.slice(2) : "549" + digits;

  const preview = fill(body ?? "", { nombre: "Nombre", dias: "2" });

  const res = await fetch(`${motorUrl}/send/fitgrowx-platform`, {
    method: "POST",
    headers: { "Content-Type": "application/json", "x-api-key": process.env.WA_MOTOR_API_KEY ?? "" },
    body: JSON.stringify({ phone: normalizedPhone, message: `[TEST — ${key}]\n\n${preview}` }),
    signal: AbortSignal.timeout(10_000),
  }).catch(() => null);

  if (!res?.ok) return NextResponse.json({ error: "No se pudo enviar. Verificá que el QR esté conectado." }, { status: 500 });
  return NextResponse.json({ ok: true });
}
