import { sanitizeError } from "@/lib/api-error";
import { NextRequest, NextResponse } from "next/server";
import { getValidAlumnoToken } from "@/lib/alumno-token";
import { getSupabaseAdminClient } from "@/lib/supabase-admin";

const supabase = getSupabaseAdminClient();

export async function POST(req: NextRequest) {
  const tokenRow = await getValidAlumnoToken(req);
  if (!tokenRow) return NextResponse.json({ error: "No autorizado." }, { status: 401 });

  const { alumno_id, gym_id, fecha, rutina_nombre, series_log, completada, offline } = await req.json();
  if (!alumno_id || !gym_id || !fecha) return NextResponse.json({ error: "Parámetros faltantes." }, { status: 400 });
  if (tokenRow.alumno_id !== alumno_id || tokenRow.gym_id !== gym_id) {
    return NextResponse.json({ error: "Acceso denegado." }, { status: 403 });
  }

  const { error } = await supabase.from("workout_sessions").upsert(
    { alumno_id, gym_id, fecha, rutina_nombre, series_log: series_log ?? {}, completada: !!completada, offline: !!offline },
    { onConflict: "alumno_id,fecha" }
  );
  if (error) return NextResponse.json({ error: sanitizeError(error) }, { status: 500 });
  return NextResponse.json({ ok: true });
}

export async function GET(req: NextRequest) {
  const tokenRow = await getValidAlumnoToken(req);
  if (!tokenRow) return NextResponse.json({ error: "No autorizado." }, { status: 401 });

  const { searchParams } = new URL(req.url);
  const alumno_id = searchParams.get("alumno_id");
  if (!alumno_id) return NextResponse.json({ error: "alumno_id requerido." }, { status: 400 });
  if (tokenRow.alumno_id !== alumno_id) return NextResponse.json({ error: "Acceso denegado." }, { status: 403 });

  const fecha = searchParams.get("fecha");
  const query = supabase
    .from("workout_sessions")
    .select("id, fecha, rutina_nombre, series_log, completada, offline, created_at")
    .eq("alumno_id", alumno_id);
  if (fecha) query.eq("fecha", fecha);

  const { data, error } = await query.order("fecha", { ascending: false }).limit(30);
  if (error) return NextResponse.json({ error: sanitizeError(error) }, { status: 500 });
  return NextResponse.json({ sessions: data ?? [] });
}
