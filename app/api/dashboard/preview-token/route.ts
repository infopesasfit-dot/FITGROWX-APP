import { NextResponse } from "next/server";
import { createHash, randomUUID } from "crypto";
import { createSupabaseServerClient } from "@/lib/supabase-server";
import { getSupabaseAdminClient } from "@/lib/supabase-admin";

const sb = getSupabaseAdminClient();

export async function GET() {
  const supabase = await createSupabaseServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "No autorizado." }, { status: 401 });

  const { data: profile } = await sb
    .from("profiles")
    .select("gym_id, role")
    .eq("id", user.id)
    .maybeSingle();

  if (!profile?.gym_id || !["admin", "staff", "platform_owner"].includes(profile.role ?? "")) {
    return NextResponse.json({ error: "No autorizado." }, { status: 403 });
  }

  const gymId = profile.gym_id;

  // Find or create the demo alumno for this gym
  const { data: existing } = await sb
    .from("alumnos")
    .select("id")
    .eq("gym_id", gymId)
    .eq("is_demo", true)
    .maybeSingle();

  let alumnoId: string;
  if (existing) {
    alumnoId = existing.id;
  } else {
    // Get first active plan if any
    const { data: plan } = await sb
      .from("planes")
      .select("id")
      .eq("gym_id", gymId)
      .eq("active", true)
      .order("created_at")
      .limit(1)
      .maybeSingle();

    const { data: created } = await sb
      .from("alumnos")
      .insert({
        full_name: "Alumno Demo",
        gym_id: gymId,
        is_demo: true,
        status: "activo",
        plan_id: plan?.id ?? null,
      })
      .select("id")
      .single();

    if (!created) return NextResponse.json({ error: "No se pudo crear el alumno demo." }, { status: 500 });
    alumnoId = created.id;
  }

  // Generate token valid for 2 hours
  const rawToken = randomUUID();
  const tokenHash = createHash("sha256").update(rawToken).digest("hex");
  const expiresAt = new Date(Date.now() + 2 * 60 * 60 * 1000).toISOString();

  await sb.from("alumno_tokens").insert({
    alumno_id: alumnoId,
    gym_id: gymId,
    token: tokenHash,
    expires_at: expiresAt,
  });

  const previewUrl = `/alumno/auth?token=${rawToken}&preview=1`;
  return NextResponse.json({ previewUrl });
}
