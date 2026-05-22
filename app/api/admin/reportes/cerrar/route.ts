import { NextRequest, NextResponse } from "next/server";
import { createSupabaseServerClient, requireUser } from "@/lib/supabase-server";
import { getSupabaseAdminClient } from "@/lib/supabase-admin";
import { calculateSnapshot } from "@/lib/dashboard-calculations";

type AuthorizedProfile = {
  gym_id: string | null;
  role: "admin" | "staff" | "platform_owner" | string | null;
  full_name: string | null;
};

type RequestBody = {
  year_month?: string;
};

export async function POST(req: NextRequest) {
  const supabase = await createSupabaseServerClient();
  const admin = getSupabaseAdminClient();
  const user = await requireUser();

  if (!user) {
    return NextResponse.json(
      { ok: false, error: "No autenticado." },
      { status: 401 }
    );
  }

  let body: RequestBody;
  try {
    body = (await req.json()) as RequestBody;
  } catch {
    return NextResponse.json(
      { ok: false, error: "Body JSON inválido." },
      { status: 400 }
    );
  }

  const { year_month } = body;

  // Validar formato YYYY-MM
  if (!year_month || !/^\d{4}-\d{2}$/.test(year_month)) {
    return NextResponse.json(
      { ok: false, error: "Formato inválido. Usar YYYY-MM." },
      { status: 400 }
    );
  }

  const [yearStr, monthStr] = year_month.split("-");
  const year = parseInt(yearStr, 10);
  const month = parseInt(monthStr, 10);

  // Validar rango de mes
  if (month < 1 || month > 12) {
    return NextResponse.json(
      { ok: false, error: "Mes fuera de rango (1-12)." },
      { status: 400 }
    );
  }

  // Validar que NO es mes actual ni futuro
  const today = new Date();
  const currentYear = today.getFullYear();
  const currentMonth = today.getMonth() + 1;

  if (year > currentYear || (year === currentYear && month >= currentMonth)) {
    return NextResponse.json(
      { ok: false, error: "No se puede cerrar el mes actual o futuro." },
      { status: 400 }
    );
  }

  // Auth + get profile
  const { data: profile } = await admin
    .from("profiles")
    .select("gym_id, role, full_name")
    .eq("id", user.id)
    .maybeSingle<AuthorizedProfile>();

  if (!profile?.gym_id || profile.role !== "admin") {
    return NextResponse.json(
      { ok: false, error: "No autorizado." },
      { status: 403 }
    );
  }

  const gymId = profile.gym_id;

  // Calcular from/to del mes
  const fromDate = new Date(year, month - 1, 1);
  const toDate = new Date(year, month, 0);

  const isoDate = (date: Date) => date.toISOString().slice(0, 10);
  const from = isoDate(fromDate);
  const to = isoDate(toDate);
  const todayStr = isoDate(today);

  // Llamar calculateSnapshot
  let snapshot;
  try {
    const result = await calculateSnapshot(
      admin,
      gymId,
      from,
      to,
      today,
      todayStr,
      null
    );
    snapshot = result.snapshot;
  } catch (err) {
    return NextResponse.json(
      {
        ok: false,
        error: (err as Error).message ?? "Error calculando snapshot.",
      },
      { status: 500 }
    );
  }

  // INSERT en monthly_reports
  const { data: inserted, error } = await admin
    .from("monthly_reports")
    .insert({
      gym_id: gymId,
      year_month,
      closed_by: user.id,
      snapshot_data: snapshot,
    })
    .select("id, closed_at")
    .maybeSingle();

  // Verificar UNIQUE constraint violation
  if (error) {
    if (error.code === "23505") {
      return NextResponse.json(
        { ok: false, error: `El mes ${year_month} ya está cerrado.` },
        { status: 409 }
      );
    }
    return NextResponse.json(
      { ok: false, error: error.message ?? "Error cerrando mes." },
      { status: 500 }
    );
  }

  return NextResponse.json({
    ok: true,
    message: `Mes ${year_month} cerrado exitosamente.`,
    closed_at: inserted?.closed_at ?? new Date().toISOString(),
    report_id: inserted?.id,
  });
}
