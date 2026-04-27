import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { createSupabaseServerClient } from "@/lib/supabase-server";

const MP_ACCESS_TOKEN = process.env.MP_ACCESS_TOKEN!;

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
);

export async function POST(req: NextRequest) {
  const { gym_id } = await req.json();
  if (!gym_id) return NextResponse.json({ error: "gym_id requerido." }, { status: 400 });

  const supabase = await createSupabaseServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "No autorizado." }, { status: 401 });

  const { data: profile } = await supabase.from("profiles").select("gym_id").eq("id", user.id).single();
  if (profile?.gym_id !== gym_id) return NextResponse.json({ error: "Acceso denegado." }, { status: 403 });

  // Obtener preapproval_id del gym
  const { data: gym } = await supabaseAdmin
    .from("gyms")
    .select("mp_preapproval_id")
    .eq("id", gym_id)
    .maybeSingle();

  if (!gym?.mp_preapproval_id) {
    return NextResponse.json({ error: "No hay suscripción activa en MP." }, { status: 404 });
  }

  // Cancelar en MP
  const mpRes = await fetch(
    `https://api.mercadopago.com/preapproval/${gym.mp_preapproval_id}`,
    {
      method: "PUT",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${MP_ACCESS_TOKEN}`,
      },
      body: JSON.stringify({ status: "cancelled" }),
    }
  );

  if (!mpRes.ok) {
    const err = await mpRes.json().catch(() => ({}));
    console.error("MP cancel error:", err);
    return NextResponse.json({ error: "No se pudo cancelar en MP." }, { status: mpRes.status });
  }

  const { error: dbErr } = await supabaseAdmin
    .from("gyms")
    .update({ is_subscription_active: false, mp_preapproval_id: null })
    .eq("id", gym_id);
  if (dbErr) console.error("cancel-subscription: DB update failed:", dbErr.message);

  return NextResponse.json({ ok: true });
}
