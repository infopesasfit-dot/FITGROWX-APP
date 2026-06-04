import { NextRequest, NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase-server";
import { getSupabaseAdminClient } from "@/lib/supabase-admin";

const admin  = getSupabaseAdminClient();
const BUCKET = "progreso-fotos";
const TTL    = 60 * 60 * 2; // 2 h

export async function GET(req: NextRequest) {
  const server = await createSupabaseServerClient();
  const { data: { user } } = await server.auth.getUser();
  if (!user) return NextResponse.json({ error: "No autorizado." }, { status: 401 });

  const { data: profile } = await admin
    .from("profiles")
    .select("gym_id, role")
    .eq("id", user.id)
    .maybeSingle<{ gym_id: string | null; role: string | null }>();

  if (!profile?.gym_id || !["admin", "staff"].includes(profile.role ?? "")) {
    return NextResponse.json({ error: "No autorizado." }, { status: 403 });
  }

  const { searchParams } = new URL(req.url);
  const alumno_id = searchParams.get("alumno_id");
  if (!alumno_id) return NextResponse.json({ error: "alumno_id requerido." }, { status: 400 });

  // Verify ownership
  const { data: belongs } = await admin
    .from("alumnos")
    .select("id")
    .eq("id", alumno_id)
    .eq("gym_id", profile.gym_id)
    .eq("is_demo", false)
    .is("deleted_at", null)
    .maybeSingle();
  if (!belongs) return NextResponse.json({ error: "Alumno no encontrado." }, { status: 404 });

  const [pesosRes, medidasRes, sessionsRes, fotosRes] = await Promise.all([
    admin.from("progreso_pesos")
      .select("ejercicio, peso, fecha")
      .eq("alumno_id", alumno_id)
      .order("fecha", { ascending: false })
      .limit(100),
    admin.from("medidas_corporales")
      .select("peso_kg, grasa_pct, fecha")
      .eq("alumno_id", alumno_id)
      .order("fecha", { ascending: false })
      .limit(10),
    admin.from("workout_sessions")
      .select("id, fecha, rutina_nombre, completada")
      .eq("alumno_id", alumno_id)
      .eq("completada", true)
      .order("fecha", { ascending: false })
      .limit(10),
    admin.from("progreso_fotos")
      .select("id, storage_path, fecha")
      .eq("alumno_id", alumno_id)
      .eq("privada", false)
      .order("fecha", { ascending: false })
      .limit(20),
  ]);

  const fotos = await Promise.all(
    (fotosRes.data ?? []).map(async (row) => {
      const { data } = await admin.storage.from(BUCKET).createSignedUrl(row.storage_path, TTL);
      return { id: row.id, foto_url: data?.signedUrl ?? null, fecha: row.fecha };
    })
  );

  return NextResponse.json({
    pesos:    pesosRes.data    ?? [],
    medidas:  medidasRes.data  ?? [],
    sessions: sessionsRes.data ?? [],
    fotos:    fotos.filter(f => f.foto_url),
  });
}
