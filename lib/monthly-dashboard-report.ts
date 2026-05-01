import { getSupabaseAdminClient } from "@/lib/supabase-admin";

type ProspectoRow = { created_at: string };
type PagoMetricRow = { amount: number; date: string; status: string | null; concepto: string | null; alumno_id: string | null };
type EgresoMetricRow = { monto: number | null; fecha: string; categoria: string | null };
type AlumnoMetricRow = { id: string; full_name: string; phone: string | null; status: string | null; created_at: string; next_expiration_date: string | null };
type ReservaMetricRow = { lead_phone: string | null; fecha: string; estado: string | null };
type AsistenciaMetricRow = { alumno_id: string; fecha: string };
type GymClassMetricRow = { day_of_week: number; max_capacity: number; event_type: "regular" | "especial" | null; event_date: string | null };

export type MonthlyDashboardReport = {
  gymName: string;
  monthLabel: string;
  leads: number;
  leadToTrial: number;
  trialToMember: number;
  revenue: number;
  marketingSpend: number;
  cac: number;
  churnRate: number;
  retentionRate: number;
  arpu: number;
  ltv: number;
  occupancy: number;
  inactiveCount: number;
  upcomingExpirations: number;
  deltaRevenue: number | null;
  deltaLeads: number | null;
};

function isoDate(date: Date) {
  return date.toISOString().slice(0, 10);
}

function startOfMonth(date = new Date()) {
  return new Date(date.getFullYear(), date.getMonth(), 1);
}

function endOfMonth(date = new Date()) {
  return new Date(date.getFullYear(), date.getMonth() + 1, 0);
}

function normalizePhone(raw: string | null | undefined) {
  return String(raw ?? "").replace(/\D/g, "");
}

function isWithin(dateStr: string | null | undefined, from: string, to: string) {
  if (!dateStr) return false;
  return dateStr >= from && dateStr <= to;
}

function metricDelta(current: number | null, previous: number | null) {
  if (current == null || previous == null) return null;
  if (previous === 0) return current === 0 ? 0 : 100;
  return ((current - previous) / previous) * 100;
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

export async function buildMonthlyDashboardReport(gymId: string, targetMonth = new Date()): Promise<MonthlyDashboardReport> {
  const supabase = getSupabaseAdminClient();
  const monthStart = startOfMonth(targetMonth);
  const monthEnd = endOfMonth(targetMonth);
  const prevMonthDate = new Date(targetMonth.getFullYear(), targetMonth.getMonth() - 1, 1);
  const prevMonthStart = startOfMonth(prevMonthDate);
  const prevMonthEnd = endOfMonth(prevMonthDate);

  const monthFrom = isoDate(monthStart);
  const monthTo = isoDate(monthEnd);
  const prevMonthFrom = isoDate(prevMonthStart);
  const prevMonthTo = isoDate(prevMonthEnd);
  const reportMonthLabel = targetMonth.toLocaleDateString("es-AR", { month: "long", year: "numeric" });
  const today = new Date();
  const inactivityCutoff = new Date(today);
  inactivityCutoff.setDate(today.getDate() - 7);
  const inactivityCutoffStr = isoDate(inactivityCutoff);
  const expiration72h = new Date(today);
  expiration72h.setHours(0, 0, 0, 0);
  expiration72h.setDate(expiration72h.getDate() + 3);
  const expiration72hStr = isoDate(expiration72h);
  const attendanceFrom = new Date(today);
  attendanceFrom.setDate(attendanceFrom.getDate() - 30);

  const [
    { data: gymSettings },
    { data: prospectRowsRaw },
    { data: paymentRowsRaw },
    { data: expenseRowsRaw },
    { data: alumnoRowsRaw },
    { data: reservaRowsRaw },
    { data: asistenciaRowsRaw },
    { data: classRowsRaw },
    { count: activeCount },
  ] = await Promise.all([
    supabase.from("gym_settings").select("gym_name").eq("gym_id", gymId).maybeSingle(),
    supabase.from("prospectos").select("created_at").eq("gym_id", gymId).gte("created_at", prevMonthFrom).lte("created_at", monthTo),
    supabase.from("pagos").select("amount, date, status, concepto, alumno_id").eq("gym_id", gymId).gte("date", prevMonthFrom).lte("date", monthTo),
    supabase.from("egresos").select("monto, fecha, categoria").eq("gym_id", gymId).gte("fecha", prevMonthFrom).lte("fecha", monthTo),
    supabase.from("alumnos").select("id, full_name, phone, status, created_at, next_expiration_date").eq("gym_id", gymId),
    supabase.from("reservas").select("lead_phone, fecha, estado").eq("gym_id", gymId).gte("fecha", prevMonthFrom).lte("fecha", monthTo),
    supabase.from("asistencias").select("alumno_id, fecha").eq("gym_id", gymId).gte("fecha", isoDate(attendanceFrom)).lte("fecha", isoDate(today)),
    supabase.from("gym_classes").select("day_of_week, max_capacity, event_type, event_date").eq("gym_id", gymId),
    supabase.from("alumnos").select("id", { count: "exact", head: true }).eq("gym_id", gymId).eq("status", "activo"),
  ]);

  const prospectRows = (prospectRowsRaw ?? []) as ProspectoRow[];
  const paymentRows = ((paymentRowsRaw ?? []) as PagoMetricRow[]).filter((row) => row.status === "validado");
  const expenseRows = (expenseRowsRaw ?? []) as EgresoMetricRow[];
  const alumnoRows = (alumnoRowsRaw ?? []) as AlumnoMetricRow[];
  const reservaRows = ((reservaRowsRaw ?? []) as ReservaMetricRow[]).filter((row) => row.estado === "confirmada");
  const asistenciaRows = (asistenciaRowsRaw ?? []) as AsistenciaMetricRow[];
  const classRows = (classRowsRaw ?? []) as GymClassMetricRow[];

  const leadPhonesMonth = new Set(
    reservaRows
      .filter((row) => isWithin(row.fecha, monthFrom, monthTo))
      .map((row) => normalizePhone(row.lead_phone))
      .filter(Boolean),
  );
  const leads = prospectRows.filter((row) => isWithin(row.created_at.slice(0, 10), monthFrom, monthTo)).length;
  const previousLeads = prospectRows.filter((row) => isWithin(row.created_at.slice(0, 10), prevMonthFrom, prevMonthTo)).length;
  const trialCount = leadPhonesMonth.size;

  const normalizedActivePhonesMonth = new Set(
    alumnoRows
      .filter((row) => row.status === "activo" && isWithin(row.created_at.slice(0, 10), monthFrom, monthTo))
      .map((row) => normalizePhone(row.phone))
      .filter(Boolean),
  );

  const trialToMemberCount = Array.from(leadPhonesMonth).filter((phone) => normalizedActivePhonesMonth.has(phone)).length;
  const leadToTrial = leads > 0 ? (trialCount / leads) * 100 : 0;
  const trialToMember = trialCount > 0 ? (trialToMemberCount / trialCount) * 100 : 0;

  const revenue = paymentRows.filter((row) => isWithin(row.date, monthFrom, monthTo)).reduce((sum, row) => sum + row.amount, 0);
  const previousRevenue = paymentRows.filter((row) => isWithin(row.date, prevMonthFrom, prevMonthTo)).reduce((sum, row) => sum + row.amount, 0);
  const marketingSpend = expenseRows
    .filter((row) => row.categoria === "Marketing" && isWithin(row.fecha, monthFrom, monthTo))
    .reduce((sum, row) => sum + (row.monto ?? 0), 0);

  const newMembers = alumnoRows.filter((row) => isWithin(row.created_at.slice(0, 10), monthFrom, monthTo)).length;
  const churned = alumnoRows.filter((row) => ["vencido", "inactivo"].includes(row.status ?? "") && isWithin(row.next_expiration_date, monthFrom, monthTo)).length;
  const activeBase = Math.max(activeCount ?? 0, 1);
  const renewedMembers = new Set(
    paymentRows.filter((row) => row.concepto === "membresia" && isWithin(row.date, monthFrom, monthTo) && row.alumno_id).map((row) => row.alumno_id as string),
  ).size;
  const retentionDenominator = renewedMembers + churned;

  const arpu = (activeCount ?? 0) > 0 ? revenue / (activeCount ?? 0) : 0;
  const ltv = arpu * averageMonthsFromCreated(alumnoRows);
  const cac = newMembers > 0 ? marketingSpend / newMembers : 0;
  const churnRate = activeBase > 0 ? (churned / activeBase) * 100 : 0;
  const retentionRate = retentionDenominator > 0 ? (renewedMembers / retentionDenominator) * 100 : 0;

  const buildOccupancy = (rangeStart: Date) => {
    const year = rangeStart.getFullYear();
    const month = rangeStart.getMonth();
    const localFrom = isoDate(startOfMonth(rangeStart));
    const localTo = isoDate(endOfMonth(rangeStart));
    const confirmedReservations = reservaRows.filter((row) => isWithin(row.fecha, localFrom, localTo)).length;
    const totalCapacity = classRows.reduce((sum, row) => {
      if ((row.event_type ?? "regular") === "especial") {
        return sum + (isWithin(row.event_date, localFrom, localTo) ? row.max_capacity : 0);
      }
      return sum + countWeekdayInMonth(year, month, row.day_of_week) * row.max_capacity;
    }, 0);
    return totalCapacity > 0 ? (confirmedReservations / totalCapacity) * 100 : 0;
  };

  const lastAttendanceMap: Record<string, string> = {};
  for (const row of asistenciaRows) {
    if (!lastAttendanceMap[row.alumno_id] || row.fecha > lastAttendanceMap[row.alumno_id]) {
      lastAttendanceMap[row.alumno_id] = row.fecha;
    }
  }

  const inactiveCount = alumnoRows.filter((row) => {
    if (row.status !== "activo") return false;
    if (row.next_expiration_date && row.next_expiration_date < isoDate(today)) return false;
    const lastAttendance = lastAttendanceMap[row.id];
    return !lastAttendance || lastAttendance < inactivityCutoffStr;
  }).length;

  const upcomingExpirations = alumnoRows.filter((row) => row.status === "activo" && isWithin(row.next_expiration_date, isoDate(today), expiration72hStr)).length;
  return {
    gymName: typeof gymSettings?.gym_name === "string" && gymSettings.gym_name.trim() ? gymSettings.gym_name.trim() : "tu gym",
    monthLabel: reportMonthLabel,
    leads,
    leadToTrial,
    trialToMember,
    revenue: Math.round(revenue),
    marketingSpend: Math.round(marketingSpend),
    cac,
    churnRate,
    retentionRate,
    arpu,
    ltv,
    occupancy: buildOccupancy(targetMonth),
    inactiveCount,
    upcomingExpirations,
    deltaRevenue: metricDelta(revenue, previousRevenue),
    deltaLeads: metricDelta(leads, previousLeads),
  };
}

export function buildMonthlyReportEmail(report: MonthlyDashboardReport) {
  const money = (value: number) => `$${Math.round(value).toLocaleString("es-AR")}`;
  const pct = (value: number) => `${value.toFixed(1)}%`;

  const text = [
    `Reporte mensual FitGrowX · ${report.gymName}`,
    `Período: ${report.monthLabel}`,
    "",
    `Leads del mes: ${report.leads}`,
    `Lead a prueba: ${pct(report.leadToTrial)}`,
    `Prueba a socio: ${pct(report.trialToMember)}`,
    `Facturación validada: ${money(report.revenue)}`,
    `Ingreso proyectado: ${money(report.revenue)}`,
    `CAC: ${money(report.cac)}`,
    `Churn: ${pct(report.churnRate)}`,
    `Retención: ${pct(report.retentionRate)}`,
    `ARPU: ${money(report.arpu)}`,
    `LTV estimado: ${money(report.ltv)}`,
    `Ocupación clases: ${pct(report.occupancy)}`,
    `Inactivos +7d: ${report.inactiveCount}`,
    `Vencen en 72h: ${report.upcomingExpirations}`,
  ].join("\n");

  const html = `
    <div style="background:#f6f7fb;padding:32px 18px;font-family:Inter,Arial,sans-serif;color:#111827">
      <div style="max-width:640px;margin:0 auto;background:#ffffff;border-radius:24px;padding:28px;border:1px solid rgba(17,24,39,0.08)">
        <div style="margin-bottom:22px">
          <div style="display:inline-block;padding:8px 12px;border-radius:999px;background:#fff2e8;color:#c65808;font-size:12px;font-weight:700;letter-spacing:.08em;text-transform:uppercase">Reporte mensual</div>
          <h1 style="margin:14px 0 6px;font-size:30px;line-height:1;font-weight:800;letter-spacing:-0.04em">Hola, ${report.gymName}</h1>
          <p style="margin:0;color:#667085;font-size:14px;line-height:1.6">Te enviamos el resumen de <strong>${report.monthLabel}</strong> para que veas rápido qué está funcionando y dónde conviene actuar.</p>
        </div>

        <div style="display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:12px;margin-bottom:20px">
          ${[
            ["Leads", String(report.leads)],
            ["Lead a prueba", pct(report.leadToTrial)],
            ["Prueba a socio", pct(report.trialToMember)],
            ["Facturación", money(report.revenue)],
            ["CAC", money(report.cac)],
            ["Retención", pct(report.retentionRate)],
            ["ARPU", money(report.arpu)],
            ["Ocupación", pct(report.occupancy)],
          ].map(([label, value]) => `
            <div style="border-radius:18px;padding:14px 15px;background:#fcfcfd;border:1px solid rgba(17,24,39,0.06)">
              <div style="font-size:11px;color:#98a2b3;text-transform:uppercase;letter-spacing:.08em;font-weight:700;margin-bottom:8px">${label}</div>
              <div style="font-size:24px;line-height:1;font-weight:800;letter-spacing:-0.04em;color:#101828">${value}</div>
            </div>
          `).join("")}
        </div>

        <div style="border-radius:20px;padding:16px 18px;background:linear-gradient(135deg,#ff7a18 0%,#ff9a3d 48%,#e65a00 100%);color:white;margin-bottom:18px">
          <div style="font-size:12px;text-transform:uppercase;letter-spacing:.08em;font-weight:700;opacity:.8;margin-bottom:8px">Alertas a mirar</div>
          <div style="display:flex;gap:18px;flex-wrap:wrap">
            <div><strong style="font-size:24px;line-height:1">${report.inactiveCount}</strong><div style="font-size:13px;opacity:.82;margin-top:4px">inactivos +7 días</div></div>
            <div><strong style="font-size:24px;line-height:1">${report.upcomingExpirations}</strong><div style="font-size:13px;opacity:.82;margin-top:4px">vencen en 72h</div></div>
          </div>
        </div>

        <p style="margin:0;color:#667085;font-size:13px;line-height:1.7">Si querés ver el detalle completo, entrá al dashboard de FitGrowX. Ahí ya te dejamos el aviso dentro del sistema también.</p>
      </div>
    </div>
  `;

  return { html, text };
}
