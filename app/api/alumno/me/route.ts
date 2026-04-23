import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export async function GET(req: NextRequest) {
  const alumno_id = new URL(req.url).searchParams.get("alumno_id");
  if (!alumno_id) return NextResponse.json({ error: "alumno_id requerido." }, { status: 400 });

  const token = req.headers.get("authorization")?.replace("Bearer ", "");
  if (!token) return NextResponse.json({ error: "No autorizado." }, { status: 401 });

  // Verificar que el token existe en alumno_tokens y corresponde al alumno_id solicitado
  const { data: tokenRow, error: tokenError } = await supabase
    .from("alumno_tokens")
    .select("alumno_id, expires_at")
    .eq("token", token)
    .single();

  if (tokenError || !tokenRow) return NextResponse.json({ error: "Token inválido." }, { status: 401 });
  if (new Date(tokenRow.expires_at) < new Date()) return NextResponse.json({ error: "Token expirado." }, { status: 401 });
  if (tokenRow.alumno_id !== alumno_id) return NextResponse.json({ error: "Acceso denegado." }, { status: 403 });

  const { data, error } = await supabase
    .from("alumnos")
    .select("id, dni, gym_id, full_name, status, next_expiration_date, planes!plan_id(nombre)")
    .eq("id", alumno_id)
    .single();

  if (error || !data) return NextResponse.json({ error: "Alumno no encontrado." }, { status: 404 });

  return NextResponse.json({
    alumno_id:  data.id,
    dni:        data.dni ?? null,
    gym_id:     data.gym_id,
    full_name:  data.full_name,
    status:     data.status,
    plan:       (data.planes as { nombre: string } | null)?.nombre ?? null,
    expiration: data.next_expiration_date ?? null,
  });
}
