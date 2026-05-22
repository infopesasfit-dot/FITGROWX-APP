import { NextRequest, NextResponse } from "next/server";
import { createSupabaseServerClient, requireUser } from "@/lib/supabase-server";
import { getSupabaseAdminClient } from "@/lib/supabase-admin";

type AuthorizedProfile = {
  gym_id: string | null;
  role: "admin" | "staff" | "platform_owner" | string | null;
};

export async function GET(req: NextRequest) {
  const supabase = await createSupabaseServerClient();
  const admin = getSupabaseAdminClient();
  const user = await requireUser();

  if (!user) {
    return NextResponse.json({ ok: false, error: "No autenticado." }, { status: 401 });
  }

  const { data: profile } = await admin
    .from("profiles")
    .select("gym_id, role")
    .eq("id", user.id)
    .maybeSingle<AuthorizedProfile>();

  if (!profile?.gym_id || profile.role !== "admin") {
    return NextResponse.json({ ok: false, error: "No autorizado." }, { status: 403 });
  }

  const gymId = profile.gym_id;

  // Get gym created_at
  const { data: gym } = await admin
    .from("gyms")
    .select("created_at")
    .eq("id", gymId)
    .maybeSingle();

  if (!gym?.created_at) {
    return NextResponse.json({ ok: true, hasPendingReports: false, mostRecentPending: null, totalPending: 0 });
  }

  // Get all closed months (monthly_reports)
  const { data: closedMonths } = await admin
    .from("monthly_reports")
    .select("year_month")
    .eq("gym_id", gymId);

  const closedSet = new Set(closedMonths?.map(r => r.year_month) ?? []);

  // Calculate pending months: from gym.created_at to month before today
  const createdDate = new Date(gym.created_at);
  const createdMonth = new Date(createdDate.getFullYear(), createdDate.getMonth(), 1);

  const today = new Date();
  const currentYear = today.getFullYear();
  const currentMonth = today.getMonth();

  const pendingMonths: string[] = [];

  // Start from previous month and go backwards
  for (let i = 1; i < 13; i++) {
    const d = new Date(currentYear, currentMonth - i, 1);

    // Stop if before gym creation
    if (d < createdMonth) break;

    const yearMonth = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
    if (!closedSet.has(yearMonth)) {
      pendingMonths.push(yearMonth);
    }
  }

  const hasPendingReports = pendingMonths.length > 0;
  const mostRecentPending = pendingMonths.length > 0 ? pendingMonths[0] : null;

  // If pending reports exist, check if notification was created this month
  if (hasPendingReports) {
    const monthStart = new Date(currentYear, currentMonth, 1).toISOString();
    const { data: existingNotif } = await admin
      .from("notifications")
      .select("id")
      .eq("gym_id", gymId)
      .eq("type", "monthly_close_reminder")
      .gte("created_at", monthStart)
      .maybeSingle();

    // If no notification exists, create one
    if (!existingNotif) {
      const [year, month] = mostRecentPending!.split("-").map(Number);
      const monthNames = ["", "enero", "febrero", "marzo", "abril", "mayo", "junio", "julio", "agosto", "septiembre", "octubre", "noviembre", "diciembre"];
      const monthName = monthNames[month];

      await admin.from("notifications").insert({
        gym_id: gymId,
        type: "monthly_close_reminder",
        title: `Cerrá tu reporte de ${monthName}`,
        body: "Cargá pagos atrasados y confirmá los números del mes.",
        read: false,
      });
    }
  }

  return NextResponse.json({
    ok: true,
    hasPendingReports,
    mostRecentPending,
    totalPending: pendingMonths.length,
  });
}
