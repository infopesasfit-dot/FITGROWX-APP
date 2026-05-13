import { NextRequest, NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase-server";
import { getSupabaseAdminClient } from "@/lib/supabase-admin";

const sb = getSupabaseAdminClient();

function validateCuit(raw: string): boolean {
  const digits = raw.replace(/\D/g, "");
  if (digits.length !== 11) return false;
  const weights = [5, 4, 3, 2, 7, 6, 5, 4, 3, 2];
  const sum = weights.reduce((acc, w, i) => acc + w * Number(digits[i]), 0);
  const mod = sum % 11;
  const verifier = mod === 0 ? 0 : 11 - mod;
  return verifier === Number(digits[10]);
}

export async function PATCH(req: NextRequest) {
  const supabase = await createSupabaseServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { data: reseller } = await sb
    .from("resellers")
    .select("id")
    .eq("user_id", user.id)
    .eq("status", "active")
    .maybeSingle();
  if (!reseller) return NextResponse.json({ error: "Not a reseller" }, { status: 403 });

  const { cuit, fiscal_condition, payout_info } = await req.json();

  const update: Record<string, string> = {};

  if (cuit !== undefined) {
    const clean = cuit.replace(/\D/g, "");
    if (!validateCuit(clean)) return NextResponse.json({ error: "CUIT inválido" }, { status: 400 });
    update.cuit = `${clean.slice(0, 2)}-${clean.slice(2, 10)}-${clean.slice(10)}`;
  }
  if (fiscal_condition !== undefined) {
    if (!["monotributo", "responsable_inscripto", "pendiente"].includes(fiscal_condition)) {
      return NextResponse.json({ error: "Condición fiscal inválida" }, { status: 400 });
    }
    update.fiscal_condition = fiscal_condition;
  }
  if (payout_info !== undefined) update.payout_info = payout_info.trim();

  if (!Object.keys(update).length) return NextResponse.json({ ok: true });

  await sb.from("resellers").update(update).eq("id", reseller.id);
  return NextResponse.json({ ok: true });
}
