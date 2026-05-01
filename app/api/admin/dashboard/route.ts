import { NextRequest, NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase-server";
import { getSupabaseAdminClient } from "@/lib/supabase-admin";
import { getPlanNombre, getRelationRecord } from "@/lib/supabase-relations";
import { getTodayDate } from "@/lib/date-utils";

type DateFilter = "hoy" | "semana" | "mes";

type AuthorizedProfile = {
  gym_id: string | null;
  role: "admin" | "staff" | "platform_owner" | string | null;
  full_name: string | null;
};

type CreatedAtRow = { created_at: string };
type EgresoMontoRow = { monto: number | null };
type PlanPrecioRow = { planes: unknown };
type PlanNombreRow = { planes: unknown };
type ProspectoRow = { created_at: string };
type PagoMetricRow = { amount: number; date: string; status: string | null; concepto: string | null; alumno_id: string | null };
type EgresoMetricRow = { monto: number | null; fecha: string; categoria: string | null };
type AlumnoMetricRow = { id: string; full_name: string; phone: string | null; status: string | null; created_at: string; next_expiration_date: string | null };
type ReservaMetricRow = { clase_id: string; fecha: string; estado: string | null };
type AsistenciaMetricRow = { alumno_id: string; fecha: string; hora: string | null };
type GymClassMetricRow = { id: string; day_of_week: number; max_capacity: number; event_type: "regular" | "especial" | null; event_date: string | null };
type GymSettingsRow = { gym_name: string | null; owner_name: string | null };
type GymRow = { name: string | null; owner_name: string | null };

function startOfMonth(date = new Date()) {
  return new Date(date.getFullYear(), date.getMonth(), 1);
}

function endOfMonth(date = new Date()) {
  return new Date(date.getFullYear(), date.getMonth() + 1, 0);
}

function isoDate(date: Date) {
  return date.toISOString().slice(0, 10);
}

function getDateRange(filter: DateFilter) {
  const today = new Date();
  const to = isoDate(today);
  if (filter === "hoy") return { from: to, to };
  if (filter === "semana") {
    const d = new Date(today);
    d.setDate(d.getDate() - d.getDay() + (d.getDay() === 0 ? -6 : 1));
    return { from: isoDate(d), to };
  }
  return { from: `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, "0")}-01`, to };
}

function normalizePhone(raw: string | null | undefined) {
  return String(raw ?? "").replace(/\D/g, "");
}

function isWithin(dateStr: string | null | undefined, from: string, to: string) {
  if (!dateStr) return false;
  return dateStr >= from && dateStr <= to;
}

function countWeekdayInMonth(year: number, monthIndex: number, dayOfWeek: number) {
  const daysInMonth = new Date(year, monthIndex + 1, 0).getDate();
  let count = 0;
  for (let day = 1; day <= daysInMonth; day += 1) {
    if (new Date(year, monthIndex, day).getDay() === dayOfWeek) count += 1;
  }
  return count;
}

function averageMonthsFromCreated(rows: AlumnoMetricRow[]) {
  if (rows.length === 0) return 0;
  const now = Date.now();
  const months = rows.map((row) => {
    const diffMs = Math.max(0, now - new Date(row.created_at).getTime());
    return diffMs / (1000 * 60 * 60 * 24 * 30.4375);
  });
  return months.reduce((sum, value) => sum + value, 0) / months.length;
}

export async function GET(req: NextRequest) {
  const supabase = await createSupabaseServerClient();
  const admin = getSupabaseAdminClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ ok: false, error: "No autenticado." }, { status: 401 });
  }

  const filterParam = req.nextUrl.searchParams.get("filter");
  const filter: DateFilter = filterParam === "hoy" || filterParam === "semana" || filterParam === "mes" ? filterParam : "mes";

  const { data: profile } = await admin
    .from("profiles")
    .select("gym_id, role, full_name")
    .eq("id", user.id)
    .maybeSingle<AuthorizedProfile>();

  if (!profile?.gym_id || !["admin", "staff", "platform_owner"].includes(profile.role ?? "")) {
    return NextResponse.json({ ok: false, error: "No autorizado." }, { status: 403 });
  }

  const gymId = profile.gym_id;
  const { from, to } = getDateRange(filter);
  const today = new Date();
  const todayStr = getTodayDate();
  const thirtyDaysAgo = new Date(today);
  thirtyDaysAgo.setDate(today.getDate() - 30);
  const thirtyStr = isoDate(thirtyDaysAgo);
  const nowMonthStart = startOfMonth(today);
  const nowMonthEnd = endOfMonth(today);
  const prevMonthDate = new Date(today.getFullYear(), today.getMonth() - 1, 1);
  const prevMonthStart = startOfMonth(prevMonthDate);
  const prevMonthEnd = endOfMonth(prevMonthDate);
  const thisMonthFrom = isoDate(nowMonthStart);
  const thisMonthTo = isoDate(nowMonthEnd);
  const prevMonthFrom = isoDate(prevMonthStart);
  const prevMonthTo = isoDate(prevMonthEnd);
  const recentInactiveCutoff = new Date(today);
  recentInactiveCutoff.setDate(today.getDate() - 7);
  const recentInactiveCutoffStr = isoDate(recentInactiveCutoff);
  const expiration72h = new Date(today);
  expiration72h.setHours(0, 0, 0, 0);
  expiration72h.setDate(expiration72h.getDate() + 3);
  const expiration72hStr = isoDate(expiration72h);
  const oldestMonthKey = `${today.getFullYear()}-${String(today.getMonth() - 3).padStart(2, "0")}-01`;

  const [
    { count: total },
    { count: activos },
    { data: todasCreatedAt, error: createdError },
    { data: egresosData, error: egresosError },
    { data: recientesData, error: recientesError },
    { data: activosConPlan, error: activosPlanError },
    { data: activosConNombrePlan, error: activosPlanNombreError },
    { count: prospectosPendientes, error: prospectosCountError },
    { data: gymSettings, error: settingsError },
    { data: gymRow, error: gymError },
    { data: prospectosRows, error: prospectRowsError },
    { data: pagosMetricRows, error: pagosError },
    { data: egresosMetricRows, error: egresosMetricError },
    { data: alumnosMetricRows, error: alumnosError },
    { data: reservasMetricRows, error: reservasError },
    { data: monthlyAssistRows, error: monthlyAssistError },
    { data: recentAssistRows, error: recentAssistError },
    { data: gymClassesMetricRows, error: classesError },
  ] = await Promise.all([
    admin.from("alumnos").select("id", { count: "exact", head: true }).eq("gym_id", gymId),
    admin.from("alumnos").select("id", { count: "exact", head: true }).eq("gym_id", gymId).eq("status", "activo"),
    admin.from("alumnos").select("created_at").eq("gym_id", gymId).gte("created_at", oldestMonthKey),
    admin.from("egresos").select("monto").eq("gym_id", gymId).gte("fecha", from).lte("fecha", to),
    admin.from("alumnos").select("id, full_name, created_at").eq("gym_id", gymId).order("created_at", { ascending: false }).limit(4),
    admin.from("alumnos").select("planes!plan_id(precio)").eq("gym_id", gymId).eq("status", "activo"),
    admin.from("alumnos").select("planes!plan_id(nombre)").eq("gym_id", gymId).eq("status", "activo"),
    admin.from("prospectos").select("id", { count: "exact", head: true }).eq("gym_id", gymId).eq("status", "pendiente"),
    admin.from("gym_settings").select("gym_name, owner_name").eq("gym_id", gymId).maybeSingle<GymSettingsRow>(),
    admin.from("gyms").select("name, owner_name").eq("id", gymId).maybeSingle<GymRow>(),
    admin.from("prospectos").select("created_at").eq("gym_id", gymId).gte("created_at", prevMonthFrom).lte("created_at", thisMonthTo),
    admin.from("pagos").select("amount, date, status, concepto, alumno_id").eq("gym_id", gymId).gte("date", prevMonthFrom).lte("date", thisMonthTo),
    admin.from("egresos").select("monto, fecha, categoria").eq("gym_id", gymId).gte("fecha", prevMonthFrom).lte("fecha", thisMonthTo),
    admin.from("alumnos").select("id, full_name, phone, status, created_at, next_expiration_date").eq("gym_id", gymId),
    admin.from("reservas").select("clase_id, fecha, estado").eq("gym_id", gymId).gte("fecha", prevMonthFrom).lte("fecha", thisMonthTo),
    admin.from("asistencias").select("alumno_id, fecha, hora").eq("gym_id", gymId).gte("fecha", thisMonthFrom).lte("fecha", todayStr),
    admin.from("asistencias").select("alumno_id, fecha, hora").eq("gym_id", gymId).gte("fecha", thirtyStr).lte("fecha", todayStr),
    admin.from("gym_classes").select("id, day_of_week, max_capacity, event_type, event_date").eq("gym_id", gymId),
  ]);

  const anyError =
    createdError || egresosError || recientesError || activosPlanError || activosPlanNombreError || prospectosCountError ||
    settingsError || gymError || prospectRowsError || pagosError || egresosMetricError || alumnosError || reservasError ||
    monthlyAssistError || recentAssistError || classesError;

  if (anyError) {
    return NextResponse.json({
      ok: false,
      error: anyError.message ?? "No se pudo cargar el dashboard.",
      gym_id: gymId,
    }, { status: 500 });
  }

  const ownerDisplayRaw =
    profile.full_name?.trim() ||
    gymSettings?.owner_name?.trim() ||
    gymRow?.owner_name?.trim() ||
    (user.user_metadata?.full_name as string | undefined)?.trim() ||
    (user.user_metadata?.name as string | undefined)?.trim() ||
    user.email?.split("@")[0] ||
    "dueño";
  const gymDisplay =
    gymSettings?.gym_name?.trim() ||
    gymRow?.name?.trim() ||
    "tu gym";

  const proyectado = (activosConPlan ?? []).reduce((sum, row) => {
    const plan = getRelationRecord((row as PlanPrecioRow).planes);
    return sum + (typeof plan?.precio === "number" ? plan.precio : 0);
  }, 0);

  const captMap: Record<string, number> = {};
  (todasCreatedAt ?? []).forEach((row) => {
    const m = (row as CreatedAtRow).created_at.slice(0, 7);
    captMap[m] = (captMap[m] || 0) + 1;
  });

  const monthKeys = Array.from({ length: 5 }, (_, i) => {
    const d = new Date(today.getFullYear(), today.getMonth() - (4 - i), 1);
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
  });
  const captacion5 = monthKeys.map((key) => captMap[key] || 0);

  const planMap: Record<string, number> = {};
  (activosConNombrePlan ?? []).forEach((row) => {
    const nombre = getPlanNombre((row as PlanNombreRow).planes) ?? "Sin plan";
    planMap[nombre] = (planMap[nombre] || 0) + 1;
  });
  const planDist = Object.entries(planMap).sort((a, b) => b[1] - a[1]).map(([nombre, count]) => ({ nombre, count }));

  const prospectRows = (prospectosRows ?? []) as ProspectoRow[];
  const pagoRows = ((pagosMetricRows ?? []) as PagoMetricRow[]).filter((row) => row.status === "validado");
  const egresoRows = (egresosMetricRows ?? []) as EgresoMetricRow[];
  const alumnoRows = (alumnosMetricRows ?? []) as AlumnoMetricRow[];
  const reservaRows = ((reservasMetricRows ?? []) as ReservaMetricRow[]).filter((row) => row.estado === "confirmada");
  const monthlyAsistenciaRows = (monthlyAssistRows ?? []) as AsistenciaMetricRow[];
  const asistenciaRows = (recentAssistRows ?? []) as AsistenciaMetricRow[];
  const classRows = (gymClassesMetricRows ?? []) as GymClassMetricRow[];

  const dailyMap: Record<string, number> = {};
  const hourlyCounts = Array(24).fill(0);
  for (const row of monthlyAsistenciaRows) {
    dailyMap[row.fecha] = (dailyMap[row.fecha] ?? 0) + 1;
    if (row.hora) {
      const hour = parseInt(row.hora.slice(0, 2), 10);
      if (!Number.isNaN(hour)) hourlyCounts[hour] += 1;
    }
  }

  const dailyCounts: { fecha: string; count: number }[] = [];
  for (let d = new Date(nowMonthStart); d <= today; d.setDate(d.getDate() + 1)) {
    const key = isoDate(d);
    dailyCounts.push({ fecha: key, count: dailyMap[key] ?? 0 });
  }

  const leadPhonesThisMonth = new Set<string>();
  const leadPhonesPrevMonth = new Set<string>();

  const leadCountCurrent = prospectRows.filter((row) => isWithin(row.created_at.slice(0, 10), thisMonthFrom, thisMonthTo)).length;
  const leadCountPrevious = prospectRows.filter((row) => isWithin(row.created_at.slice(0, 10), prevMonthFrom, prevMonthTo)).length;
  const trialCountCurrent = leadPhonesThisMonth.size;
  const trialCountPrevious = leadPhonesPrevMonth.size;

  const normalizedActivePhonesCurrent = new Set(
    alumnoRows.filter((row) => row.status === "activo" && isWithin(row.created_at.slice(0, 10), thisMonthFrom, thisMonthTo)).map((row) => normalizePhone(row.phone)).filter(Boolean),
  );
  const normalizedActivePhonesPrevious = new Set(
    alumnoRows.filter((row) => row.status === "activo" && isWithin(row.created_at.slice(0, 10), prevMonthFrom, prevMonthTo)).map((row) => normalizePhone(row.phone)).filter(Boolean),
  );

  const trialToMemberCurrentCount = Array.from(leadPhonesThisMonth).filter((phone) => normalizedActivePhonesCurrent.has(phone)).length;
  const trialToMemberPreviousCount = Array.from(leadPhonesPrevMonth).filter((phone) => normalizedActivePhonesPrevious.has(phone)).length;

  const marketingCurrent = egresoRows.filter((row) => row.categoria === "Marketing" && isWithin(row.fecha, thisMonthFrom, thisMonthTo)).reduce((sum, row) => sum + (row.monto ?? 0), 0);
  const marketingPrevious = egresoRows.filter((row) => row.categoria === "Marketing" && isWithin(row.fecha, prevMonthFrom, prevMonthTo)).reduce((sum, row) => sum + (row.monto ?? 0), 0);

  const newMembersCurrent = alumnoRows.filter((row) => isWithin(row.created_at.slice(0, 10), thisMonthFrom, thisMonthTo)).length;
  const newMembersPrevious = alumnoRows.filter((row) => isWithin(row.created_at.slice(0, 10), prevMonthFrom, prevMonthTo)).length;

  const churnedCurrent = alumnoRows.filter((row) => ["vencido", "inactivo"].includes(row.status ?? "") && isWithin(row.next_expiration_date, thisMonthFrom, thisMonthTo)).length;
  const churnedPrevious = alumnoRows.filter((row) => ["vencido", "inactivo"].includes(row.status ?? "") && isWithin(row.next_expiration_date, prevMonthFrom, prevMonthTo)).length;
  const activeBaseCurrent = Math.max(activos ?? 0, 1);
  const activeBasePrevious = Math.max((activos ?? 0) + churnedCurrent - newMembersCurrent, 1);

  const renewedMembersCurrent = new Set(
    pagoRows.filter((row) => row.concepto === "membresia" && isWithin(row.date, thisMonthFrom, thisMonthTo) && row.alumno_id).map((row) => row.alumno_id as string),
  ).size;
  const renewedMembersPrevious = new Set(
    pagoRows.filter((row) => row.concepto === "membresia" && isWithin(row.date, prevMonthFrom, prevMonthTo) && row.alumno_id).map((row) => row.alumno_id as string),
  ).size;

  const retentionDenominatorCurrent = renewedMembersCurrent + churnedCurrent;
  const retentionDenominatorPrevious = renewedMembersPrevious + churnedPrevious;

  const currentRevenue = pagoRows.filter((row) => isWithin(row.date, thisMonthFrom, thisMonthTo)).reduce((sum, row) => sum + row.amount, 0);
  const previousRevenue = pagoRows.filter((row) => isWithin(row.date, prevMonthFrom, prevMonthTo)).reduce((sum, row) => sum + row.amount, 0);
  const currentActiveCount = activos ?? 0;
  const arpuCurrent = currentActiveCount > 0 ? currentRevenue / currentActiveCount : 0;
  const previousActiveCount = Math.max((activos ?? 0) + churnedCurrent - newMembersCurrent, 0);
  const arpuPrevious = previousActiveCount > 0 ? previousRevenue / previousActiveCount : 0;
  const avgTenureMonths = averageMonthsFromCreated(alumnoRows);
  const ltvCurrent = arpuCurrent * avgTenureMonths;
  const ltvPrevious = arpuPrevious * avgTenureMonths;

  const buildOccupancy = (rangeStart: Date) => {
    const year = rangeStart.getFullYear();
    const month = rangeStart.getMonth();
    const monthFrom = isoDate(startOfMonth(rangeStart));
    const monthTo = isoDate(endOfMonth(rangeStart));
    const confirmedReservations = reservaRows.filter((row) => isWithin(row.fecha, monthFrom, monthTo)).length;
    const totalCapacity = classRows.reduce((sum, row) => {
      if ((row.event_type ?? "regular") === "especial") {
        return sum + (isWithin(row.event_date, monthFrom, monthTo) ? row.max_capacity : 0);
      }
      return sum + countWeekdayInMonth(year, month, row.day_of_week) * row.max_capacity;
    }, 0);
    return totalCapacity > 0 ? (confirmedReservations / totalCapacity) * 100 : 0;
  };

  const occupancyCurrent = buildOccupancy(today);
  const occupancyPrevious = buildOccupancy(prevMonthDate);

  const lastAttendanceMap: Record<string, string> = {};
  for (const row of asistenciaRows) {
    if (!lastAttendanceMap[row.alumno_id] || row.fecha > lastAttendanceMap[row.alumno_id]) {
      lastAttendanceMap[row.alumno_id] = row.fecha;
    }
  }

  const inactiveRows = alumnoRows.filter((row) => {
    if (row.status !== "activo") return false;
    if (row.next_expiration_date && row.next_expiration_date < todayStr) return false;
    const lastAttendance = lastAttendanceMap[row.id];
    return !lastAttendance || lastAttendance < recentInactiveCutoffStr;
  });

  const upcomingExpirations = alumnoRows
    .filter((row) => row.status === "activo" && isWithin(row.next_expiration_date, todayStr, expiration72hStr))
    .sort((a, b) => (a.next_expiration_date ?? "").localeCompare(b.next_expiration_date ?? ""))
    .slice(0, 6)
    .map((row) => ({ id: row.id, full_name: row.full_name, next_expiration_date: row.next_expiration_date }));

  const leadToTrialCurrent = leadCountCurrent > 0 ? (trialCountCurrent / leadCountCurrent) * 100 : 0;
  const leadToTrialPrevious = leadCountPrevious > 0 ? (trialCountPrevious / leadCountPrevious) * 100 : 0;
  const trialToMemberCurrent = trialCountCurrent > 0 ? (trialToMemberCurrentCount / trialCountCurrent) * 100 : 0;
  const trialToMemberPrevious = trialCountPrevious > 0 ? (trialToMemberPreviousCount / trialCountPrevious) * 100 : 0;
  const cacCurrent = newMembersCurrent > 0 ? marketingCurrent / newMembersCurrent : 0;
  const cacPrevious = newMembersPrevious > 0 ? marketingPrevious / newMembersPrevious : 0;
  const churnRateCurrent = activeBaseCurrent > 0 ? (churnedCurrent / activeBaseCurrent) * 100 : 0;
  const churnRatePrevious = activeBasePrevious > 0 ? (churnedPrevious / activeBasePrevious) * 100 : 0;
  const retentionCurrent = retentionDenominatorCurrent > 0 ? (renewedMembersCurrent / retentionDenominatorCurrent) * 100 : 0;
  const retentionPrevious = retentionDenominatorPrevious > 0 ? (renewedMembersPrevious / retentionDenominatorPrevious) * 100 : 0;

  return NextResponse.json({
    ok: true,
    ownerName: ownerDisplayRaw.split(" ")[0],
    gymName: gymDisplay,
    snapshot: {
      activosCount: activos ?? 0,
      totalCount: total ?? 0,
      ingresoProyectado: proyectado,
      gastosTotal: (egresosData ?? []).reduce((sum, row) => sum + ((row as EgresoMontoRow).monto ?? 0), 0),
      recientes: recientesData ?? [],
      captacion5,
      planDist,
      prospectos: prospectosPendientes ?? 0,
      asistDiarias: dailyCounts.slice(-14),
      asistHoras: hourlyCounts,
      asistHoy: monthlyAsistenciaRows.filter((row) => row.fecha === todayStr).length,
      metrics: [
        { key: "leads", label: "Leads Totales", section: "Embudo", tooltip: "Consultas nuevas que entraron este mes.", value: leadCountCurrent, previous: leadCountPrevious, format: "number", accent: "orange" },
        { key: "lead_trial", label: "Lead-to-Trial", section: "Embudo", tooltip: "Qué porcentaje de consultas llegó a reservar una prueba.", value: leadToTrialCurrent, previous: leadToTrialPrevious, format: "percent", accent: "soft" },
        { key: "trial_member", label: "Trial-to-Member", section: "Embudo", tooltip: "Qué porcentaje de pruebas terminó en socio activo.", value: trialToMemberCurrent, previous: trialToMemberPrevious, format: "percent", accent: "soft" },
        { key: "cac", label: "CAC", section: "Embudo", tooltip: "Cuánto costó conseguir cada socio nuevo este mes.", value: cacCurrent, previous: cacPrevious, format: "currency", accent: "ink" },
        { key: "churn", label: "Churn Rate", section: "Fidelización", tooltip: "Porcentaje de socios que se cayeron este mes.", value: churnRateCurrent, previous: churnRatePrevious, format: "percent", accent: "orange" },
        { key: "retention", label: "Retention Rate", section: "Fidelización", tooltip: "Qué parte de los socios que estaban por renovar siguió activa.", value: retentionCurrent, previous: retentionPrevious, format: "percent", accent: "soft" },
        { key: "ltv", label: "LTV", section: "Fidelización", tooltip: "Valor estimado que deja un alumno durante su permanencia.", value: ltvCurrent, previous: ltvPrevious, format: "currency", accent: "ink" },
        { key: "arpu", label: "ARPU", section: "Eficiencia", tooltip: "Ingreso promedio por alumno activo este mes.", value: arpuCurrent, previous: arpuPrevious, format: "currency", accent: "soft" },
        { key: "ocupacion", label: "Ocupación por Clase", section: "Eficiencia", tooltip: "Reserva confirmada sobre cupo disponible del mes.", value: occupancyCurrent, previous: occupancyPrevious, format: "percent", accent: "orange" },
        { key: "m2", label: "Ingreso/m²", section: "Eficiencia", tooltip: "Facturación total dividida por metros del local. Lo activamos cuando cargues la superficie.", value: null, previous: null, format: "currency", accent: "ink" },
      ],
      alerts: {
        inactiveCount: inactiveRows.length,
        inactiveNames: inactiveRows.slice(0, 6).map((row) => row.full_name),
        upcomingExpirations,
      },
    },
  });
}
