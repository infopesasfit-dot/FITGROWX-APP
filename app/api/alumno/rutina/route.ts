import { NextRequest, NextResponse } from "next/server";
import { getValidAlumnoToken } from "@/lib/alumno-token";
import { createSupabaseServerClient } from "@/lib/supabase-server";
import { getSupabaseAdminClient } from "@/lib/supabase-admin";

type StaffProfile = { gym_id: string | null; role: string | null };

const supabase = getSupabaseAdminClient();

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const alumno_id = searchParams.get("alumno_id");
  if (!alumno_id) return NextResponse.json({ error: "alumno_id requerido." }, { status: 400 });
  const tokenRow = await getValidAlumnoToken(req);
  if (!tokenRow) return NextResponse.json({ error: "No autorizado." }, { status: 401 });
  if (tokenRow.alumno_id !== alumno_id) return NextResponse.json({ error: "Acceso denegado." }, { status: 403 });

  const { data } = await supabase.from("rutinas").select("nombre, ejercicios, updated_at").eq("alumno_id", alumno_id).single();
  return NextResponse.json({ rutina: data ?? null });
}

export async function POST(req: NextRequest) {
  const { alumno_id, gym_id, nombre, ejercicios, notas } = await req.json();
  if (!alumno_id || !gym_id) return NextResponse.json({ error: "Parámetros faltantes." }, { status: 400 });
  const tokenRow = await getValidAlumnoToken(req);

  if (!tokenRow) {
    const supabaseServer = await createSupabaseServerClient();
    const { data: { user } } = await supabaseServer.auth.getUser();
    if (!user) {
      return NextResponse.json({ error: "No autorizado." }, { status: 401 });
    }

    const { data: ownerProfile } = await supabase
      .from("profiles")
      .select("gym_id, role")
      .eq("id", user.id)
      .maybeSingle<StaffProfile>();

    if (!ownerProfile || !["admin", "staff"].includes(ownerProfile.role ?? "") || ownerProfile.gym_id !== gym_id) {
      return NextResponse.json({ error: "No autorizado." }, { status: 401 });
    }
  } else if (tokenRow.alumno_id !== alumno_id || tokenRow.gym_id !== gym_id) {
    return NextResponse.json({ error: "Acceso denegado." }, { status: 403 });
  }

  const { error } = await supabase.from("rutinas").upsert(
    { alumno_id, gym_id, nombre: nombre ?? "Mi Rutina", ejercicios: ejercicios ?? [], notas: notas ?? null, updated_at: new Date().toISOString() },
    { onConflict: "alumno_id" }
  );

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
