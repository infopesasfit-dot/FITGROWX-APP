import { NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase-server";
import { getSupabaseAdminClient } from "@/lib/supabase-admin";
import { randomUUID, createHash } from "crypto";

const admin = getSupabaseAdminClient();

function sha256hex(input: string): string {
  return createHash("sha256").update(input).digest("hex");
}

async function getGymId(): Promise<string | null> {
  const supabase = await createSupabaseServerClient();
  const { data: { user }, error } = await supabase.auth.getUser();
  if (error || !user) return null;
  const { data: profile } = await admin
    .from("profiles")
    .select("gym_id, role")
    .eq("id", user.id)
    .maybeSingle();
  if (!profile?.gym_id || profile.role !== "admin") return null;
  return profile.gym_id;
}

export async function GET() {
  const gymId = await getGymId();
  if (!gymId) return NextResponse.json({ ok: false, error: "No autorizado." }, { status: 401 });

  const { data: settings } = await admin
    .from("gym_settings")
    .select("api_key, api_key_last_used_at")
    .eq("gym_id", gymId)
    .maybeSingle();

  // No key yet — generate, hash, store, return raw once
  if (!settings?.api_key) {
    const rawKey = randomUUID();
    await admin
      .from("gym_settings")
      .update({ api_key: sha256hex(rawKey) })
      .eq("gym_id", gymId);
    return NextResponse.json({ ok: true, api_key: rawKey });
  }

  // Key exists — never recoverable again
  return NextResponse.json({
    ok: true,
    api_key: null,
    api_key_last_used_at: settings.api_key_last_used_at ?? null,
  });
}

export async function DELETE() {
  const gymId = await getGymId();
  if (!gymId) return NextResponse.json({ ok: false, error: "No autorizado." }, { status: 401 });

  const rawKey = randomUUID();
  await admin
    .from("gym_settings")
    .update({ api_key: sha256hex(rawKey), api_key_last_used_at: null })
    .eq("gym_id", gymId);

  return NextResponse.json({ ok: true, api_key: rawKey });
}
