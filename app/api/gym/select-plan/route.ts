import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY ?? process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

export async function POST(req: NextRequest) {
  const { gym_id, plan_type } = await req.json();

  if (!gym_id || !["gestion", "crecimiento", "full_marca"].includes(plan_type)) {
    return NextResponse.json({ error: "Datos inválidos." }, { status: 400 });
  }

  const { error } = await supabase
    .from("gyms")
    .update({ plan_type })
    .eq("id", gym_id);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({ ok: true });
}
