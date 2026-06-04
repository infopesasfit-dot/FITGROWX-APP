import { NextRequest, NextResponse } from "next/server";
import { getValidAlumnoToken } from "@/lib/alumno-token";
import { getSupabaseAdminClient } from "@/lib/supabase-admin";

const supabase = getSupabaseAdminClient();

function anonName(fullName: string, isMe: boolean): string {
  if (isMe) return fullName.split(" ").slice(0, 2).join(" ");
  const parts = fullName.trim().split(/\s+/);
  const first = parts[0] ?? "?";
  const lastInitial = parts[1]?.[0] ? `${parts[1][0]}.` : "";
  return lastInitial ? `${first} ${lastInitial}` : first;
}

export async function GET(req: NextRequest) {
  const tokenRow = await getValidAlumnoToken(req);
  if (!tokenRow) return NextResponse.json({ error: "No autorizado." }, { status: 401 });

  const alumno_id = tokenRow.alumno_id;
  const gym_id = tokenRow.gym_id;

  const { data: requester } = await supabase
    .from("alumnos")
    .select("is_demo")
    .eq("id", alumno_id)
    .eq("gym_id", gym_id)
    .maybeSingle();
  if (requester?.is_demo) return NextResponse.json({ top: [], myPos: 0, myEntry: null });

  const monthStart = new Date();
  monthStart.setDate(1);
  const monthStartStr = monthStart.toISOString().slice(0, 10);

  // Contar asistencias del mes por alumno en este gym
  const { data: rows } = await supabase
    .from("asistencias")
    .select("alumno_id")
    .eq("gym_id", gym_id)
    .gte("fecha", monthStartStr);

  // Agregar en memoria (PostgREST no soporta GROUP BY)
  const countMap: Record<string, number> = {};
  for (const r of rows ?? []) {
    countMap[r.alumno_id] = (countMap[r.alumno_id] ?? 0) + 1;
  }

  const sorted = Object.entries(countMap)
    .sort((a, b) => b[1] - a[1]);

  const top10Ids = sorted.slice(0, 10).map(([id]) => id);
  const myPos    = sorted.findIndex(([id]) => id === alumno_id) + 1; // 1-indexed, 0 = not in list

  // Incluir al alumno si no está en top 10
  const idsToFetch = top10Ids.includes(alumno_id) ? top10Ids : [...top10Ids, alumno_id];

  const { data: alumnos } = await supabase
    .from("alumnos")
    .select("id, full_name")
    .in("id", idsToFetch)
    .eq("is_demo", false)
    .is("deleted_at", null);

  const nameMap: Record<string, string> = {};
  for (const a of alumnos ?? []) nameMap[a.id] = a.full_name;

  const top = sorted.filter(([id]) => Boolean(nameMap[id])).slice(0, 10).map(([id, count], i) => ({
    pos:   i + 1,
    name:  anonName(nameMap[id] ?? "?", id === alumno_id),
    count,
    isMe:  id === alumno_id,
  }));

  const myEntry = myPos > 0 ? {
    pos:   myPos,
    name:  anonName(nameMap[alumno_id] ?? "Vos", true),
    count: countMap[alumno_id] ?? 0,
    isMe:  true,
  } : null;

  return NextResponse.json({ top, myPos, myEntry });
}
