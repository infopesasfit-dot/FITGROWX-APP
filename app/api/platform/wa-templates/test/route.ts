import { NextRequest, NextResponse } from "next/server";
import { getSupabaseAdminClient } from "@/lib/supabase-admin";
import { createSupabaseServerClient } from "@/lib/supabase-server";
import { sendWa } from "@/lib/wa";

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

  const digits = phone.replace(/\D/g, "");
  const normalizedPhone = digits.startsWith("549") ? digits : digits.startsWith("54") ? "549" + digits.slice(2) : "549" + digits;
  const preview = fill(body ?? "", { nombre: "Nombre", dias: "2" });

  const ok = await sendWa("fitgrowx-platform", normalizedPhone, `[TEST — ${key}]\n\n${preview}`, { route: "wa-templates/test", timeout: 10_000 });
  if (!ok) return NextResponse.json({ error: "No se pudo enviar. Verificá que el QR esté conectado." }, { status: 500 });
  return NextResponse.json({ ok: true });
}
