import { SupabaseClient } from "@supabase/supabase-js";
import { getPlanNombre, getRelationRecord } from "@/lib/supabase-relations";

// ── Types ──────────────────────────────────────────────────────────────────
export type ProspectoRow = { created_at: string; phone: string | null; clase_gratis_date: string | null };
export type PagoMetricRow = { amount: number; date: string; status: string | null; concepto: string | null; alumno_id: string | null };
export type EgresoMetricRow = { monto: number | null; fecha: string; categoria: string | null };
export type AlumnoMetricRow = { id: string; full_name: string; phone: string | null; status: string | null; created_at: string; next_expiration_date: string | null; planes: unknown };
export type ReservaMetricRow = { fecha: string; estado: string | null };
export type AsistenciaMetricRow = { alumno_id: string; fecha: string; hora: string | null };
export type GymClassMetricRow = { day_of_week: number; max_capacity: number; event_type: "regular" | "especial" | null; event_date: string | null };
export type GymSettingsRow = { gym_name: string | null; owner_name: string | null; wa_status: string | null };
export type GymRow = { name: string | null; owner_name: string | null };

export type DashboardSnapshot = {
  activosCount: number;
  totalCount: number;
  altasMes: number;
  bajasMes: number;
  variacionNeta: number;
  ingresoProyectado: number;
  proyeccionProximoMes: number;
  renovacionesPendientes: number;
  mensajesAutoEnviados: number;
  renovacionesCount: number;
  recuperadosCount: number;
  recuperadosRevenue: number;
  recaudadoEsteMes: number;
  deudaTotal: number;
  morososCount: number;
  gastosTotal: number;
  recientes: { id: string; full_name: string; created_at: string }[];
  captacion5: number[];
  ingresos5: number[];
  gastos5: number[];
  planDist: { nombre: string; count: number }[];
  prospectos: number;
  asistDiarias: { fecha: string; count: number }[];
  asistHoras: number[];
  asistHoy: number;
  asistPromedioDiario: number;
  metrics: Array<{
    key: string;
    label: string;
    section: string;
    tooltip: string;
    value: number;
    previous: number;
    format: string;
    accent: string;
  }>;
  alerts: {
    inactiveCount: number;
    inactiveNames: string[];
    upcomingExpirations: { id: string; full_name: string; next_expiration_date: string | null }[];
  };
};

// ── Helpers ────────────────────────────────────────────────────────────────
function startOfMonth(date = new Date()) {
  return new Date(date.getFullYear(), date.getMonth(), 1);
}

function endOfMonth(date = new Date()) {
  return new Date(date.getFullYear(), date.getMonth() + 1, 0);
}

function isoDate(date: Date) {
  return date.toISOString().slice(0, 10);
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

// ── Main calculation function ──────────────────────────────────────────────
export async function calculateSnapshot(
  admin: SupabaseClient,
  gymId: string,
  from: string,
  to: string,
  today: Date,
  todayStr: string,
  fromParam: string | null,
  options?: { ownerName?: string }
): Promise<{
  snapshot: DashboardSnapshot;
  meta: {
    gymName: string;
    ownerName: string;
    waStatus: "active" | "disconnected" | "qr" | "unknown";
    lastCronRun: { ran_at: string; status: string; summary: string | null } | null;
  };
}> {
  // ── Setup date ranges ──────────────────────────────────────────────────────
  const selectedStart = fromParam ? new Date(fromParam + "T00:00:00") : startOfMonth(today);
  const thisMonthFrom = isoDate(startOfMonth(selectedStart));
  const thisMonthTo   = isoDate(endOfMonth(selectedStart));
  const isCurrentMonth = thisMonthFrom === isoDate(startOfMonth(today));

  const prevMonthDate  = new Date(selectedStart.getFullYear(), selectedStart.getMonth() - 1, 1);
  const prevMonthFrom  = isoDate(startOfMonth(prevMonthDate));
  const prevMonthTo    = isoDate(endOfMonth(prevMonthDate));

  const thirtyDaysAgo = new Date(today);
  thirtyDaysAgo.setDate(today.getDate() - 30);
  const thirtyStr = isoDate(thirtyDaysAgo);

  const recentInactiveCutoff = new Date(today);
  recentInactiveCutoff.setDate(today.getDate() - 7);
  const recentInactiveCutoffStr = isoDate(recentInactiveCutoff);
  const expiration72h = new Date(today);
  expiration72h.setHours(0, 0, 0, 0);
  expiration72h.setDate(expiration72h.getDate() + 3);
  const expiration72hStr = isoDate(expiration72h);
  const oldestMonthKey = isoDate(new Date(selectedStart.getFullYear(), selectedStart.getMonth() - 4, 1));
  const nextMonthDate  = new Date(selectedStart.getFullYear(), selectedStart.getMonth() + 1, 1);
  const nextMonthFrom  = isoDate(startOfMonth(nextMonthDate));
  const nextMonthTo    = isoDate(endOfMonth(nextMonthDate));

  // ── Supabase queries ───────────────────────────────────────────────────────
  const [
    { count: prospectosPendientes, error: prospectosCountError },
    { data: gymSettings, error: settingsError },
    { data: gymRow, error: gymError },
    { data: prospectosRows, error: prospectRowsError },
    { data: pagosMetricRows, error: pagosError },
    { data: egresosMetricRows, error: egresosMetricError },
    { data: alumnosMetricRows, error: alumnosError },
    { data: reservasMetricRows, error: reservasError },
    { data: allAsistRows, error: asistError },
    { data: gymClassesMetricRows, error: classesError },
    { count: mensajesAutoCount, error: mensajesAutoError },
    { count: bajasCount, error: bajasError },
    { data: lastCronRunRows },
  ] = await Promise.all([
    admin.from("prospectos").select("id", { count: "exact", head: true }).eq("gym_id", gymId).eq("status", "pendiente"),
    admin.from("gym_settings").select("gym_name, owner_name, wa_status").eq("gym_id", gymId).maybeSingle<GymSettingsRow>(),
    admin.from("gyms").select("name, owner_name").eq("id", gymId).maybeSingle<GymRow>(),
    admin.from("prospectos").select("created_at, phone, clase_gratis_date").eq("gym_id", gymId).gte("created_at", prevMonthFrom).lte("created_at", thisMonthTo),
    admin.from("pagos").select("amount, date, status, concepto, alumno_id").eq("gym_id", gymId).gte("date", oldestMonthKey).lte("date", thisMonthTo),
    admin.from("egresos").select("monto, fecha, categoria").eq("gym_id", gymId).gte("fecha", oldestMonthKey).lte("fecha", thisMonthTo),
    admin.from("alumnos").select("id, full_name, phone, status, created_at, next_expiration_date, planes!plan_id(precio, nombre)").eq("gym_id", gymId).is("deleted_at", null),
    admin.from("reservas").select("fecha, estado").eq("gym_id", gymId).gte("fecha", prevMonthFrom).lte("fecha", thisMonthTo),
    admin.from("asistencias").select("alumno_id, fecha, hora").eq("gym_id", gymId).gte("fecha", thirtyStr).lte("fecha", todayStr),
    admin.from("gym_classes").select("day_of_week, max_capacity, event_type, event_date").eq("gym_id", gymId),
    admin.from("wa_mensajes_log").select("id", { count: "exact", head: true }).eq("gym_id", gymId).gte("sent_at", `${thisMonthFrom}T00:00:00Z`).lte("sent_at", `${thisMonthTo}T23:59:59Z`),
    admin.from("alumnos").select("id", { count: "exact", head: true }).eq("gym_id", gymId).not("deleted_at", "is", null).gte("deleted_at", `${from}T00:00:00`).lte("deleted_at", `${to}T23:59:59`),
    admin.from("cron_runs").select("ran_at, status, summary").eq("cron_name", "vencimientos").order("ran_at", { ascending: false }).limit(1),
  ]);

  const anyError =
    prospectosCountError || settingsError || gymError ||
    prospectRowsError || pagosError || egresosMetricError || alumnosError || reservasError ||
    asistError || classesError || mensajesAutoError || bajasError;

  if (anyError) {
    throw new Error(anyError?.message ?? "No se pudo cargar el dashboard.");
  }

  // ── Meta information ───────────────────────────────────────────────────────
  const gymDisplay =
    gymSettings?.gym_name?.trim() ||
    gymRow?.name?.trim() ||
    "tu gym";

  // ── Calculations ───────────────────────────────────────────────────────────
  const alumnoRows = (alumnosMetricRows ?? []) as AlumnoMetricRow[];
  const total = alumnoRows.length;
  const isPaidMember = (row: AlumnoMetricRow) =>
    (row.status === "activo" || row.status === "vencido") && row.next_expiration_date != null;

  const activosPlanRows = alumnoRows.filter(r =>
    r.status === "activo" && (r.next_expiration_date == null || r.next_expiration_date >= todayStr)
  );
  const morososRows = alumnoRows.filter(r =>
    r.next_expiration_date != null &&
    r.next_expiration_date < todayStr &&
    r.status !== "pendiente" &&
    getRelationRecord(r.planes) != null
  );

  const proyectado = activosPlanRows.reduce((sum, row) => {
    const plan = getRelationRecord(row.planes);
    return sum + (typeof plan?.precio === "number" ? plan.precio : 0);
  }, 0);

  const proximoMesFiltrados = activosPlanRows.filter(r =>
    r.next_expiration_date != null &&
    r.next_expiration_date >= nextMonthFrom &&
    r.next_expiration_date <= nextMonthTo
  );
  const renovacionesPendientes = proximoMesFiltrados.length;
  const proyeccionProximoMes = proximoMesFiltrados.reduce((sum, row) => {
    const plan = getRelationRecord(row.planes);
    return sum + (typeof plan?.precio === "number" ? plan.precio : 0);
  }, 0);

  const activos = alumnoRows.filter(r =>
    r.status === "activo" &&
    (r.next_expiration_date == null || r.next_expiration_date >= todayStr)
  ).length;
  const recientes = [...alumnoRows]
    .filter(isPaidMember)
    .sort((a, b) => b.created_at.localeCompare(a.created_at))
    .slice(0, 5)
    .map(r => ({ id: r.id, full_name: r.full_name, created_at: r.created_at }));

  const altasMes = alumnoRows.filter(r => {
    if (!r.created_at) return false;
    const dateOnly = r.created_at.slice(0, 10);
    return dateOnly >= from && dateOnly <= to;
  }).length;
  const bajasMes = bajasCount ?? 0;
  const variacionNeta = altasMes - bajasMes;

  const captMap: Record<string, number> = {};
  alumnoRows.filter(row => row.created_at >= oldestMonthKey && isPaidMember(row)).forEach(row => {
    const m = row.created_at.slice(0, 7);
    captMap[m] = (captMap[m] || 0) + 1;
  });

  const monthKeys = Array.from({ length: 5 }, (_, i) => {
    const d = new Date(today.getFullYear(), today.getMonth() - (4 - i), 1);
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
  });
  const captacion5 = monthKeys.map((key) => captMap[key] || 0);

  const planMap: Record<string, number> = {};
  activosPlanRows.forEach(row => {
    const nombre = getPlanNombre(row.planes) ?? "Sin plan";
    planMap[nombre] = (planMap[nombre] || 0) + 1;
  });
  const planDist = Object.entries(planMap).sort((a, b) => b[1] - a[1]).map(([nombre, count]) => ({ nombre, count }));

  const prospectRows = (prospectosRows ?? []) as ProspectoRow[];
  const pagoRows = ((pagosMetricRows ?? []) as PagoMetricRow[]).filter((row) => row.status === "validado");
  const egresoRows = (egresosMetricRows ?? []) as EgresoMetricRow[];

  const ingresos5 = monthKeys.map((key) => pagoRows.filter((r) => r.date?.startsWith(key)).reduce((s, r) => s + r.amount, 0));
  const gastos5   = monthKeys.map((key) => egresoRows.filter((r) => r.fecha?.startsWith(key)).reduce((s, r) => s + (r.monto ?? 0), 0));
  const reservaRows = ((reservasMetricRows ?? []) as ReservaMetricRow[]).filter((row) => row.estado === "confirmada");
  const allAsistencias = (allAsistRows ?? []) as AsistenciaMetricRow[];
  const monthlyAsistenciaRows = allAsistencias.filter(r => r.fecha >= thisMonthFrom);
  const asistenciaRows = allAsistencias;
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
  const asistMonthEnd = isCurrentMonth ? today : new Date(thisMonthTo + "T00:00:00");
  for (let d = new Date(thisMonthFrom + "T00:00:00"); d <= asistMonthEnd; d.setDate(d.getDate() + 1)) {
    const key = isoDate(d);
    dailyCounts.push({ fecha: key, count: dailyMap[key] ?? 0 });
  }

  const leadPhonesThisMonth = new Set<string>();
  const leadPhonesPrevMonth = new Set<string>();

  for (const row of prospectRows) {
    if (!row.clase_gratis_date || !row.phone) continue;
    const p = normalizePhone(row.phone);
    if (!p) continue;
    if (isWithin(row.clase_gratis_date, thisMonthFrom, thisMonthTo)) leadPhonesThisMonth.add(p);
    if (isWithin(row.clase_gratis_date, prevMonthFrom, prevMonthTo)) leadPhonesPrevMonth.add(p);
  }

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

  const newMembersCurrent = alumnoRows.filter((row) => isPaidMember(row) && isWithin(row.created_at.slice(0, 10), thisMonthFrom, thisMonthTo)).length;
  const newMembersPrevious = alumnoRows.filter((row) => isPaidMember(row) && isWithin(row.created_at.slice(0, 10), prevMonthFrom, prevMonthTo)).length;

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

  const morososCount = morososRows.length;
  const deudaTotal = morososRows.reduce((sum, row) => {
    const plan = getRelationRecord(row.planes);
    return sum + (typeof plan?.precio === "number" ? plan.precio : 0);
  }, 0);

  const currentRevenue = pagoRows.filter((row) => isWithin(row.date, thisMonthFrom, thisMonthTo)).reduce((sum, row) => sum + row.amount, 0);
  const previousRevenue = pagoRows.filter((row) => isWithin(row.date, prevMonthFrom, prevMonthTo)).reduce((sum, row) => sum + row.amount, 0);
  const currentActiveCount = activos ?? 0;
  const arpuCurrent = currentActiveCount > 0 ? currentRevenue / currentActiveCount : 0;
  const previousActiveCount = Math.max((activos ?? 0) + churnedCurrent - newMembersCurrent, 0);
  const arpuPrevious = previousActiveCount > 0 ? previousRevenue / previousActiveCount : 0;
  const avgTenureMonths = averageMonthsFromCreated(alumnoRows);
  const ltvCurrent = arpuCurrent * avgTenureMonths;

  const paidThisMonthIds = new Set(
    pagoRows.filter(r => isWithin(r.date, thisMonthFrom, thisMonthTo) && r.concepto === "membresia" && r.alumno_id).map(r => r.alumno_id as string)
  );
  const paidPrevMonthIds = new Set(
    pagoRows.filter(r => isWithin(r.date, prevMonthFrom, prevMonthTo) && r.concepto === "membresia" && r.alumno_id).map(r => r.alumno_id as string)
  );
  const recuperadosCount = alumnoRows.filter(r =>
    paidThisMonthIds.has(r.id) && !paidPrevMonthIds.has(r.id) && r.created_at.slice(0, 10) < prevMonthFrom
  ).length;
  const recuperadosRevenue = arpuCurrent > 0 ? Math.round(recuperadosCount * arpuCurrent) : 0;
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

  const lastCronRun = lastCronRunRows?.[0] as { ran_at: string; status: string; summary: string | null } | undefined;

  const snapshot: DashboardSnapshot = {
    activosCount: activos,
    totalCount: total,
    altasMes,
    bajasMes,
    variacionNeta,
    ingresoProyectado: proyectado,
    proyeccionProximoMes,
    renovacionesPendientes,
    mensajesAutoEnviados: mensajesAutoCount ?? 0,
    renovacionesCount: paidThisMonthIds.size,
    recuperadosCount,
    recuperadosRevenue,
    recaudadoEsteMes: currentRevenue,
    deudaTotal,
    morososCount,
    gastosTotal: egresoRows.filter(r => r.fecha >= from && r.fecha <= to).reduce((sum, r) => sum + (r.monto ?? 0), 0),
    recientes,
    captacion5,
    ingresos5,
    gastos5,
    planDist,
    prospectos: prospectosPendientes ?? 0,
    asistDiarias: dailyCounts.slice(-14),
    asistHoras: hourlyCounts,
    asistHoy: monthlyAsistenciaRows.filter((row) => row.fecha === todayStr).length,
    asistPromedioDiario: (() => {
      const diasConActividad = Object.values(dailyMap).filter(c => c > 0).length;
      if (diasConActividad === 0) return 0;
      const total = monthlyAsistenciaRows.length;
      return Math.round(total / diasConActividad);
    })(),
    metrics: [
      { key: "leads", label: "Consultas recibidas", section: "Embudo", tooltip: "Personas nuevas que preguntaron o se contactaron este mes.", value: leadCountCurrent, previous: leadCountPrevious, format: "number", accent: "orange" },
      { key: "lead_trial", label: "De consulta a prueba", section: "Embudo", tooltip: "De cada 100 personas que consultaron, cuántas llegaron a probar el gym.", value: leadToTrialCurrent, previous: leadToTrialPrevious, format: "percent", accent: "soft" },
      { key: "trial_member", label: "De prueba a socio", section: "Embudo", tooltip: "De cada 100 que probaron, cuántas terminaron siendo socios.", value: trialToMemberCurrent, previous: trialToMemberPrevious, format: "percent", accent: "soft" },
      { key: "cac", label: "Costo por socio nuevo", section: "Embudo", tooltip: "Cuánto te costó (en publicidad u otros gastos) conseguir cada socio nuevo este mes.", value: cacCurrent, previous: cacPrevious, format: "currency", accent: "ink" },
      { key: "churn", label: "Socios que se van", section: "Fidelización", tooltip: "De cada 100 socios, cuántos dejaron de renovar este mes.", value: churnRateCurrent, previous: churnRatePrevious, format: "percent", accent: "orange" },
      { key: "retention", label: "Socios que renuevan", section: "Fidelización", tooltip: "De los socios que estaban por vencer, cuántos siguieron con la membresía.", value: retentionCurrent, previous: retentionPrevious, format: "percent", accent: "soft" },
      { key: "ltv", label: "Valor de un socio", section: "Fidelización", tooltip: "Cuánto genera en promedio un socio durante todo el tiempo que está en tu gym.", value: ltvCurrent, previous: ltvPrevious, format: "currency", accent: "ink" },
      { key: "arpu", label: "Ingreso por socio", section: "Eficiencia", tooltip: "Cuánto generás por cada socio activo este mes.", value: arpuCurrent, previous: arpuPrevious, format: "currency", accent: "soft" },
      { key: "ocupacion", label: "Ocupación de clases", section: "Eficiencia", tooltip: "De todos los lugares disponibles en clases, cuántos se ocuparon este mes.", value: occupancyCurrent, previous: occupancyPrevious, format: "percent", accent: "orange" },
    ],
    alerts: {
      inactiveCount: inactiveRows.length,
      inactiveNames: inactiveRows.slice(0, 6).map((row) => row.full_name),
      upcomingExpirations,
    },
  };

  return {
    snapshot,
    meta: {
      gymName: gymDisplay,
      ownerName: options?.ownerName ?? "dueño",
      waStatus: (gymSettings?.wa_status ?? "unknown") as "active" | "disconnected" | "qr" | "unknown",
      lastCronRun: lastCronRun ?? null,
    },
  };
}
