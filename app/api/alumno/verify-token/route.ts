import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY ?? process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

export async function POST(req: NextRequest) {
  const { token } = await req.json();
  if (!token) return NextResponse.json({ error: "Token requerido." }, { status: 400 });

  const { data: tokenRow, error } = await supabase
    .from("alumno_tokens")
    .select("id, alumno_id, gym_id, expires_at, used_at")
    .eq("token", token)
    .single();

  if (error || !tokenRow) return NextResponse.json({ error: "Enlace inválido o expirado." }, { status: 401 });
  if (tokenRow.used_at) return NextResponse.json({ error: "Este enlace ya fue utilizado." }, { status: 401 });
  if (new Date(tokenRow.expires_at) < new Date()) return NextResponse.json({ error: "El enlace expiró. Solicitá uno nuevo." }, { status: 401 });

  await supabase.from("alumno_tokens").update({ used_at: new Date().toISOString() }).eq("id", tokenRow.id);

  const { data: alumno } = await supabase
    .from("alumnos")
    .select("id, dni, full_name, phone, status, plan_id, next_expiration_date, planes!plan_id(nombre, accent_color, precio)")
    .eq("id", tokenRow.alumno_id)
    .single();

  return NextResponse.json({ ok: true, alumno, gym_id: tokenRow.gym_id });
}
