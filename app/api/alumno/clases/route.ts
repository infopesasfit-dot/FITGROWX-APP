import { NextRequest, NextResponse } from "next/server";
import { getValidAlumnoToken } from "@/lib/alumno-token";
import { getSupabaseAdminClient } from "@/lib/supabase-admin";

const supabase = getSupabaseAdminClient();

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const alumno_id = searchParams.get("alumno_id");
  const gym_id    = searchParams.get("gym_id");

  if (!alumno_id || !gym_id) return NextResponse.json({ error: "Parámetros faltantes." }, { status: 400 });
  const tokenRow = await getValidAlumnoToken(req);
  if (!tokenRow) return NextResponse.json({ error: "No autorizado." }, { status: 401 });
  if (tokenRow.alumno_id !== alumno_id || tokenRow.gym_id !== gym_id) {
    return NextResponse.json({ error: "Acceso denegado." }, { status: 403 });
  }

  const today = new Date();
  const dates = Array.from({ length: 7 }, (_, i) => {
    const d = new Date(today); d.setDate(d.getDate() + i);
    return d.toISOString().slice(0, 10);
  });

  const [{ data: clases }, { data: reservas }, { data: counts }] = await Promise.all([
    supabase.from("gym_classes").select("id, class_name, day_of_week, start_time, max_capacity, event_type, notes, coach_name").eq("gym_id", gym_id).order("day_of_week").order("start_time"),
    supabase.from("reservas").select("clase_id, fecha").eq("alumno_id", alumno_id).eq("estado", "confirmada"),
    supabase.from("reservas").select("clase_id, fecha").eq("gym_id", gym_id).eq("estado", "confirmada").in("fecha", dates),
  ]);

  const counts_map: Record<string, number> = {};
  counts?.forEach(r => {
    const key = `${r.clase_id}|${r.fecha}`;
    counts_map[key] = (counts_map[key] ?? 0) + 1;
  });

  return NextResponse.json({ clases: clases ?? [], reservas: reservas ?? [], counts_map });
}
