import { NextRequest, NextResponse } from "next/server";
import { getTodayDate } from "@/lib/date-utils";
import { getValidAlumnoToken } from "@/lib/alumno-token";
import { getSupabaseAdminClient } from "@/lib/supabase-admin";

export async function GET(req: NextRequest) {
  const supabase = getSupabaseAdminClient();
  const alumno_id = new URL(req.url).searchParams.get("alumno_id");
  if (!alumno_id) return NextResponse.json({ fechas: [], count: 0 }, { status: 400 });

  const tokenRow = await getValidAlumnoToken(req);
  if (!tokenRow) return NextResponse.json({ error: "No autorizado." }, { status: 401 });
  if (tokenRow.alumno_id !== alumno_id) return NextResponse.json({ error: "Acceso denegado." }, { status: 403 });

  const today = getTodayDate();
  const monthStart = `${today.slice(0, 7)}-01`;

  const { data } = await supabase
    .from("asistencias")
    .select("fecha")
    .eq("alumno_id", alumno_id)
    .gte("fecha", monthStart)
    .lte("fecha", today)
    .order("fecha", { ascending: true });

  const fechas = (data ?? []).map((r: { fecha: string }) => r.fecha);
  return NextResponse.json({ fechas, count: fechas.length });
}
