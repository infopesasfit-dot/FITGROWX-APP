import { NextRequest, NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase-server";
import { getSupabaseAdminClient } from "@/lib/supabase-admin";

export async function POST(req: NextRequest) {
  const { alumno_id } = await req.json();
  if (!alumno_id) return NextResponse.json({ error: "alumno_id requerido" }, { status: 400 });

  // A) Validar sesión activa
  const supabase = await createSupabaseServerClient();
  const { data: { user }, error: authError } = await supabase.auth.getUser();
  if (!user || authError) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }

  // B) Validar rol (owner/admin)
  const { data: profile, error: profileError } = await supabase
    .from("profiles")
    .select("gym_id, role")
    .eq("id", user.id)
    .single();

  if (profileError || !profile) {
    console.error("[invalidate-tokens] profile error:", profileError?.message);
    return NextResponse.json({ error: "Usuario no encontrado" }, { status: 404 });
  }

  if (!["owner", "admin"].includes(profile.role)) {
    return NextResponse.json({ error: "Permiso denegado" }, { status: 403 });
  }

  // C) Validar ownership cross-tenant
  const { data: alumno, error: alumnoError } = await supabase
    .from("alumnos")
    .select("gym_id")
    .eq("id", alumno_id)
    .is("deleted_at", null)
    .single();

  if (alumnoError || !alumno) {
    console.error("[invalidate-tokens] alumno error:", alumnoError?.message);
    return NextResponse.json({ error: "Alumno no encontrado" }, { status: 404 });
  }

  if (alumno.gym_id !== profile.gym_id) {
    return NextResponse.json({ error: "Acceso denegado a este alumno" }, { status: 403 });
  }

  // D) Ejecutar invalidate con service_role (solo el UPDATE)
  const adminSupabase = getSupabaseAdminClient();
  const { error } = await adminSupabase
    .from("alumno_tokens")
    .update({ expires_at: new Date().toISOString() })
    .eq("alumno_id", alumno_id)
    .gt("expires_at", new Date().toISOString());

  if (error) {
    console.error("[invalidate-tokens]", error.message);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}
