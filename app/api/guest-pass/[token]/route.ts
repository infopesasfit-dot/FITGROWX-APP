import { NextRequest, NextResponse } from "next/server";
import { getSupabaseAdminClient } from "@/lib/supabase-admin";

const sb = getSupabaseAdminClient();

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ token: string }> }
) {
  const { token } = await params;

  const { data: pass } = await sb
    .from("guest_passes")
    .select("gym_id, alumno_id, status, expires_at, code, lead_name")
    .eq("token", token)
    .maybeSingle();

  if (!pass) return NextResponse.json({ error: "Pase inválido" }, { status: 404 });
  if (new Date(pass.expires_at) < new Date()) return NextResponse.json({ error: "Pase vencido" }, { status: 410 });
  if (pass.status === "used") return NextResponse.json({ error: "Pase ya utilizado" }, { status: 409 });

  const [{ data: alumno }, { data: settings }] = await Promise.all([
    sb.from("alumnos").select("full_name").eq("id", pass.alumno_id).eq("is_demo", false).maybeSingle(),
    sb.from("gym_settings").select("gym_name, accent_color, whatsapp").eq("gym_id", pass.gym_id).maybeSingle(),
  ]);
  if (!alumno) return NextResponse.json({ error: "Pase inválido" }, { status: 404 });

  // If already claimed, return success state directly (same browser re-open)
  const gymWhatsapp = (settings as { whatsapp?: string | null } | null)?.whatsapp ?? null;

  if (pass.status === "claimed") {
    return NextResponse.json({
      status:       "claimed",
      code:         pass.code,
      gymName:      settings?.gym_name ?? "el gym",
      accentColor:  settings?.accent_color ?? "#F97316",
      expiresAt:    pass.expires_at,
      gymWhatsapp,
    });
  }

  return NextResponse.json({
    status:       "pending",
    gymName:      settings?.gym_name ?? "el gym",
    alumnoName:   (alumno?.full_name ?? "Tu amigo").split(" ")[0],
    accentColor:  settings?.accent_color ?? "#F97316",
    expiresAt:    pass.expires_at,
    gymWhatsapp,
  });
}
