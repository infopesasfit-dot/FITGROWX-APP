import { NextRequest, NextResponse } from "next/server";
import { getTodayDate } from "@/lib/date-utils";
import { getSupabaseAdminClient } from "@/lib/supabase-admin";
import { createSupabaseServerClient } from "@/lib/supabase-server";

type AdminProfile = {
  gym_id: string | null;
  role: "admin" | "staff" | string | null;
};

type AsistenciaMonthRow = {
  fecha: string;
  hora: string | null;
};

type AsistenciaTodayRow = {
  alumno_id: string;
  hora: string | null;
};

export async function GET(req: NextRequest) {
  const supabaseAdmin = getSupabaseAdminClient();
  const supabase = await createSupabaseServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ ok: false }, { status: 401 });

  const gym_id = new URL(req.url).searchParams.get("gym_id") ?? user.id;

  const { data: profile } = await supabaseAdmin
    .from("profiles")
    .select("gym_id, role")
    .eq("id", user.id)
    .maybeSingle<AdminProfile>();

  const profileRow = profile as AdminProfile | null;
  const profileRole = profileRow?.role ?? null;
  if (!profileRow || !profileRole || !["admin", "staff"].includes(profileRole)) {
    return NextResponse.json({ ok: false, error: "No autorizado." }, { status: 403 });
  }

  const resolvedGymId = profileRow.gym_id ?? gym_id;

  const today = getTodayDate();
  const monthStart = `${today.slice(0, 7)}-01`;

  // Fetch all this month's asistencias
  const [{ data: monthly }, { data: todayRows }] = await Promise.all([
    supabaseAdmin
      .from("asistencias")
      .select("fecha, hora")
      .eq("gym_id", resolvedGymId)
      .gte("fecha", monthStart)
      .lte("fecha", today),
    supabaseAdmin
      .from("asistencias")
      .select("alumno_id, hora")
      .eq("gym_id", resolvedGymId)
      .eq("fecha", today),
  ]);
  const monthlyRows = (monthly ?? []) as AsistenciaMonthRow[];
  const todayAsistencias = (todayRows ?? []) as AsistenciaTodayRow[];

  // Build daily counts map
  const dailyMap: Record<string, number> = {};
  const hourlyCounts: number[] = Array(24).fill(0);

  for (const row of monthlyRows) {
    dailyMap[row.fecha] = (dailyMap[row.fecha] ?? 0) + 1;
    if (row.hora) {
      const h = parseInt(row.hora.slice(0, 2), 10);
      if (!isNaN(h)) hourlyCounts[h]++;
    }
  }

  // Build ordered daily array for the month so far
  const dailyCounts: { fecha: string; count: number }[] = [];
  const start = new Date(monthStart);
  const end = new Date(today);
  for (let d = new Date(start); d <= end; d.setDate(d.getDate() + 1)) {
    const key = d.toISOString().slice(0, 10);
    dailyCounts.push({ fecha: key, count: dailyMap[key] ?? 0 });
  }

  const todayCount = todayAsistencias.length;
  const totalMonth = monthlyRows.length;

  // Weekly avg (last 7 days)
  const last7 = dailyCounts.slice(-7);
  const weeklyAvg = last7.length > 0
    ? Math.round(last7.reduce((s, d) => s + d.count, 0) / last7.length)
    : 0;

  return NextResponse.json({ dailyCounts, hourlyCounts, todayCount, totalMonth, weeklyAvg });
}
