import { NextRequest, NextResponse } from "next/server";
import { getValidAlumnoToken } from "@/lib/alumno-token";
import { getSupabaseAdminClient } from "@/lib/supabase-admin";
import { sanitizeError } from "@/lib/api-error";

const supabase = getSupabaseAdminClient();

export async function GET(req: NextRequest) {
  const tokenRow = await getValidAlumnoToken(req);
  if (!tokenRow) return NextResponse.json({ error: "No autorizado." }, { status: 401 });

  // alumno_id comes exclusively from the validated cookie token — never from query params
  const { data, error } = await supabase
    .from("workout_sessions")
    .select("id, fecha, rutina_nombre, completada, series_log, created_at")
    .eq("alumno_id", tokenRow.alumno_id)
    .order("fecha", { ascending: false })
    .limit(20);

  if (error) return NextResponse.json({ error: sanitizeError(error) }, { status: 500 });
  return NextResponse.json({ sessions: data ?? [] });
}
