import { NextRequest, NextResponse } from "next/server";
import { randomBytes, createHash } from "crypto";
import { createSupabaseServerClient , requireUser } from "@/lib/supabase-server";
import { getSupabaseAdminClient } from "@/lib/supabase-admin";
import { requireGymNotBlocked } from "@/lib/require-gym-not-blocked";

type AuthProfile = { gym_id: string | null; role: string | null };

const admin = getSupabaseAdminClient();

async function getGymId(): Promise<{ gymId: string } | { error: NextResponse }> {
  const supabase = await createSupabaseServerClient();
  const user = await requireUser();
  if (!user) return { error: NextResponse.json({ ok: false, error: "No autenticado." }, { status: 401 }) };

  const { data: profile } = await admin
    .from("profiles")
    .select("gym_id, role")
    .eq("id", user.id)
    .maybeSingle<AuthProfile>();

  if (!profile?.gym_id || profile.role !== "admin") {
    return { error: NextResponse.json({ ok: false, error: "Solo el administrador puede gestionar keys de molinete." }, { status: 403 }) };
  }
  return { gymId: profile.gym_id };
}

// GET — listar keys activas
export async function GET() {
  const auth = await getGymId();
  if ("error" in auth) return auth.error;

  const { data } = await admin
    .from("molinete_api_keys")
    .select("id, label, last_used_at, created_at")
    .eq("gym_id", auth.gymId)
    .is("revoked_at", null)
    .order("created_at", { ascending: false });

  return NextResponse.json({ ok: true, keys: data ?? [] });
}

// POST — generar nueva key
export async function POST(req: NextRequest) {
  const auth = await getGymId();
  if ("error" in auth) return auth.error;

  const blocked = await requireGymNotBlocked(auth.gymId);
  if (blocked) return blocked;

  const { label } = await req.json().catch(() => ({})) as { label?: string };

  const rawKey  = `fgx_${randomBytes(24).toString("hex")}`;
  const keyHash = createHash("sha256").update(rawKey).digest("hex");

  const { data, error } = await admin
    .from("molinete_api_keys")
    .insert({ gym_id: auth.gymId, key_hash: keyHash, label: label?.trim() || "Molinete" })
    .select("id, label, created_at")
    .single();

  if (error) {
    return NextResponse.json({ ok: false, error: "No se pudo crear la key." }, { status: 500 });
  }

  // Devuelve el rawKey UNA SOLA VEZ — no se puede recuperar después
  return NextResponse.json({ ok: true, key: rawKey, meta: data });
}

// DELETE — revocar key por id
export async function DELETE(req: NextRequest) {
  const auth = await getGymId();
  if ("error" in auth) return auth.error;

  const blocked = await requireGymNotBlocked(auth.gymId);
  if (blocked) return blocked;

  const { id } = await req.json().catch(() => ({})) as { id?: string };
  if (!id) return NextResponse.json({ ok: false, error: "id requerido." }, { status: 400 });

  const { error } = await admin
    .from("molinete_api_keys")
    .update({ revoked_at: new Date().toISOString() })
    .eq("id", id)
    .eq("gym_id", auth.gymId) // garantiza que solo revoca keys del propio gym
    .is("revoked_at", null);

  if (error) return NextResponse.json({ ok: false, error: "No se pudo revocar." }, { status: 500 });

  return NextResponse.json({ ok: true });
}
