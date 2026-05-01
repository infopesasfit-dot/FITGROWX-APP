import { NextRequest, NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase-server";
import { getSupabaseAdminClient } from "@/lib/supabase-admin";
import { sendMonthlyDashboardReport } from "@/lib/monthly-dashboard-report-delivery";

type AuthorizedProfile = {
  id: string;
  gym_id: string | null;
  role: "platform_owner" | "admin" | "staff" | string | null;
};

export async function POST(req: NextRequest) {
  const supabase = await createSupabaseServerClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ ok: false, error: "No autorizado." }, { status: 401 });
  }

  const admin = getSupabaseAdminClient();
  const { data: profile } = await admin
    .from("profiles")
    .select("id, gym_id, role")
    .eq("id", user.id)
    .maybeSingle<AuthorizedProfile>();

  if (!profile || !profile.gym_id || !["admin", "platform_owner"].includes(profile.role ?? "")) {
    return NextResponse.json({ ok: false, error: "Acceso denegado." }, { status: 403 });
  }

  const body = await req.json().catch(() => ({}));
  const month = typeof body.month === "string" ? body.month : null;
  const reportMonthDate = month ? new Date(`${month}-01T12:00:00`) : new Date(new Date().getFullYear(), new Date().getMonth() - 1, 1);
  if (Number.isNaN(reportMonthDate.getTime())) {
    return NextResponse.json({ ok: false, error: "Formato de mes inválido. Usá YYYY-MM." }, { status: 400 });
  }

  const { data: gymSettings } = await admin
    .from("gym_settings")
    .select("email")
    .eq("gym_id", profile.gym_id)
    .maybeSingle<{ email: string | null }>();

  const email = (gymSettings?.email ?? user.email ?? "").trim();
  if (!email) {
    return NextResponse.json({ ok: false, error: "No hay email configurado para enviar el reporte." }, { status: 400 });
  }

  try {
    const result = await sendMonthlyDashboardReport({
      gymId: profile.gym_id,
      email,
      reportMonthDate,
    });

    return NextResponse.json({
      ok: true,
      alreadySent: result.alreadySent,
      reportMonth: result.reportMonth,
      email,
      message: result.alreadySent
        ? "Ese reporte ya fue enviado anteriormente."
        : `Reporte enviado a ${email}.`,
    });
  } catch (error) {
    return NextResponse.json({
      ok: false,
      error: error instanceof Error ? error.message : "No se pudo enviar el reporte.",
    }, { status: 500 });
  }
}
