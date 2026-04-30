import { NextRequest, NextResponse } from "next/server";
import { getValidAlumnoToken } from "@/lib/alumno-token";
import { getSupabaseAdminClient } from "@/lib/supabase-admin";
import { getTodayDate } from "@/lib/date-utils";

const supabase = getSupabaseAdminClient();

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const alumno_id = searchParams.get("alumno_id");
  const gym_id = searchParams.get("gym_id");
  const includeTraining = searchParams.get("include") === "training";

  if (!alumno_id || !gym_id) {
    return NextResponse.json({ error: "Parámetros faltantes." }, { status: 400 });
  }

  const tokenRow = await getValidAlumnoToken(req);
  if (!tokenRow) return NextResponse.json({ error: "No autorizado." }, { status: 401 });
  if (tokenRow.alumno_id !== alumno_id || tokenRow.gym_id !== gym_id) {
    return NextResponse.json({ error: "Acceso denegado." }, { status: 403 });
  }

  const today = new Date();
  const dates = Array.from({ length: 7 }, (_, i) => {
    const d = new Date(today);
    d.setDate(d.getDate() + i);
    return d.toISOString().slice(0, 10);
  });

  const todayStr = getTodayDate();
  const monthStart = `${todayStr.slice(0, 7)}-01`;

  const baseQueries = await Promise.all([
    supabase
      .from("gym_classes")
      .select("id, class_name, day_of_week, start_time, max_capacity, event_type, notes, coach_name")
      .eq("gym_id", gym_id)
      .order("day_of_week")
      .order("start_time"),
    supabase
      .from("reservas")
      .select("clase_id, fecha")
      .eq("alumno_id", alumno_id)
      .eq("estado", "confirmada"),
    supabase
      .from("reservas")
      .select("clase_id, fecha")
      .eq("gym_id", gym_id)
      .eq("estado", "confirmada")
      .in("fecha", dates),
    supabase.from("gym_settings").select("gym_name, logo_url, accent_color").eq("gym_id", gym_id).single(),
    supabase.from("gyms").select("plan_type").eq("id", gym_id).single(),
    supabase
      .from("asistencias")
      .select("fecha")
      .eq("alumno_id", alumno_id)
      .gte("fecha", monthStart)
      .lte("fecha", todayStr)
      .order("fecha", { ascending: true }),
  ]);

  const [clasesRes, reservasRes, countsRes, settingsRes, gymRes, asistRes] = baseQueries;

  const counts_map: Record<string, number> = {};
  countsRes.data?.forEach((r: { clase_id: string; fecha: string }) => {
    const key = `${r.clase_id}|${r.fecha}`;
    counts_map[key] = (counts_map[key] ?? 0) + 1;
  });

  const fechas = (asistRes.data ?? []).map((r: { fecha: string }) => r.fecha);

  if (!includeTraining) {
    return NextResponse.json({
      clases: clasesRes.data ?? [],
      reservas: reservasRes.data ?? [],
      counts_map,
      gym_info: {
        gym_name: settingsRes.data?.gym_name ?? null,
        logo_url: settingsRes.data?.logo_url ?? null,
        accent_color: settingsRes.data?.accent_color ?? null,
        plan_type: gymRes.data?.plan_type ?? null,
      },
      asistencias: {
        fechas,
        count: fechas.length,
      },
    });
  }

  const [rutinaRes, pesosRes] = await Promise.all([
    supabase.from("rutinas").select("nombre, ejercicios, updated_at").eq("alumno_id", alumno_id).single(),
    supabase.from("progreso_pesos").select("id, ejercicio, peso, fecha, notas").eq("alumno_id", alumno_id).order("fecha", { ascending: false }).limit(50),
  ]);

  return NextResponse.json({
    clases: clasesRes.data ?? [],
    reservas: reservasRes.data ?? [],
    counts_map,
    gym_info: {
      gym_name: settingsRes.data?.gym_name ?? null,
      logo_url: settingsRes.data?.logo_url ?? null,
      accent_color: settingsRes.data?.accent_color ?? null,
      plan_type: gymRes.data?.plan_type ?? null,
    },
    asistencias: {
      fechas,
      count: fechas.length,
    },
    rutina: rutinaRes.data ?? null,
    pesos: pesosRes.data ?? [],
  });
}
