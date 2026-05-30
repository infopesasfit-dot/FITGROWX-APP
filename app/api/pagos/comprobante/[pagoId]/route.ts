import { NextRequest, NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase-server";
import { getSupabaseAdminClient } from "@/lib/supabase-admin";

const sb = getSupabaseAdminClient();
const TTL = 10 * 60; // 10 minutes

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ pagoId: string }> }
) {
  const { pagoId } = await params;

  // Auth check
  const supabase = await createSupabaseServerClient();
  const { data: { user }, error: authError } = await supabase.auth.getUser();

  if (authError || !user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  // Get user's gym
  const { data: profile } = await sb
    .from("profiles")
    .select("gym_id")
    .eq("id", user.id)
    .single();

  if (!profile?.gym_id) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  // Verify pago ownership
  const { data: pago, error: pagoError } = await sb
    .from("pagos")
    .select("id, gym_id, comprobante_path")
    .eq("id", pagoId)
    .single();

  if (pagoError || !pago) {
    return NextResponse.json({ error: "Pago not found" }, { status: 404 });
  }

  if (pago.gym_id !== profile.gym_id) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  if (!pago.comprobante_path) {
    return NextResponse.json({ error: "No comprobante" }, { status: 404 });
  }

  // Generate signed URL
  const { data, error } = await sb.storage
    .from("comprobantes")
    .createSignedUrl(pago.comprobante_path, TTL);

  if (error || !data) {
    return NextResponse.json(
      { error: error?.message ?? "Failed to generate URL" },
      { status: 500 }
    );
  }

  return NextResponse.json({ url: data.signedUrl });
}
