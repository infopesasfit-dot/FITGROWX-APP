import { NextRequest, NextResponse } from "next/server";
import { getSupabaseAdminClient } from "@/lib/supabase-admin";

const supabase = getSupabaseAdminClient();

export async function POST(req: NextRequest) {
  const { token } = await req.json();
  if (!token) return NextResponse.json({ error: "Token requerido." }, { status: 400 });

  // Consume the token and extend its expiry to 30 days so it works as a session token
  const thirtyDays = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString();
  const { data: tokenRow, error } = await supabase
    .from("alumno_tokens")
    .update({ used_at: new Date().toISOString(), expires_at: thirtyDays })
    .eq("token", token)
    .is("used_at", null)
    .gt("expires_at", new Date().toISOString())
    .select("id, alumno_id, gym_id")
    .single();

  if (error || !tokenRow) return NextResponse.json({ error: "Enlace inválido, expirado o ya utilizado." }, { status: 401 });

  const { data: alumno } = await supabase
    .from("alumnos")
    .select("id, dni, full_name, phone, status, plan_id, next_expiration_date, planes!plan_id(nombre, accent_color, precio)")
    .eq("id", tokenRow.alumno_id)
    .single();

  return NextResponse.json({ ok: true, alumno, gym_id: tokenRow.gym_id });
}
