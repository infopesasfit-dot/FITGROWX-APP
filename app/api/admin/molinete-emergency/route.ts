import { NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase-server";
import { getSupabaseAdminClient } from "@/lib/supabase-admin";

const admin = getSupabaseAdminClient();

async function getAuth(): Promise<{ gymId: string; userId: string } | null> {
  const supabase = await createSupabaseServerClient();
  const { data: { session } } = await supabase.auth.getSession();
  if (!session?.user) return null;

  const { data: profile } = await admin
    .from("profiles")
    .select("gym_id, role")
    .eq("id", session.user.id)
    .maybeSingle<{ gym_id: string | null; role: string | null }>();

  if (!profile?.gym_id || !["admin", "staff"].includes(profile.role ?? "")) return null;
  return { gymId: profile.gym_id, userId: session.user.id };
}

// POST — admin triggers an emergency open (creates a 45-second token)
export async function POST() {
  const auth = await getAuth();
  if (!auth) return NextResponse.json({ ok: false, error: "No autorizado." }, { status: 401 });

  // Check if gym has any molinete keys configured
  const { data: keys } = await admin
    .from("molinete_api_keys")
    .select("id")
    .eq("gym_id", auth.gymId)
    .is("revoked_at", null)
    .limit(1);

  if (!keys || keys.length === 0) {
    return NextResponse.json({ ok: false, error: "no_molinete", message: "No hay molinete configurado. Generá una API key en Configuración > Equipo para habilitar esta función." }, { status: 400 });
  }

  // Expire any previous unconsumed tokens for this gym to avoid stacking
  await admin
    .from("emergency_opens")
    .update({ consumed_at: new Date().toISOString() })
    .eq("gym_id", auth.gymId)
    .is("consumed_at", null);

  const { data, error } = await admin
    .from("emergency_opens")
    .insert({ gym_id: auth.gymId, created_by: auth.userId })
    .select("id, expires_at")
    .single();

  if (error) return NextResponse.json({ ok: false, error: "Error al crear apertura." }, { status: 500 });

  return NextResponse.json({ ok: true, token_id: data.id, expires_at: data.expires_at });
}

// GET — admin polls to check if token was consumed (so dashboard can confirm door opened)
export async function GET() {
  const auth = await getAuth();
  if (!auth) return NextResponse.json({ ok: false, error: "No autorizado." }, { status: 401 });

  const { data } = await admin
    .from("emergency_opens")
    .select("id, consumed_at, expires_at, created_at")
    .eq("gym_id", auth.gymId)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (!data) return NextResponse.json({ status: "none" });

  const now = Date.now();
  const expired = new Date(data.expires_at).getTime() < now;

  return NextResponse.json({
    status: data.consumed_at ? "consumed" : expired ? "expired" : "pending",
    token_id: data.id,
    expires_at: data.expires_at,
    consumed_at: data.consumed_at,
  });
}
