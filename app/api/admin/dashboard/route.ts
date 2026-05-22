import { NextRequest, NextResponse } from "next/server";
import { createSupabaseServerClient , requireUser } from "@/lib/supabase-server";
import { getSupabaseAdminClient } from "@/lib/supabase-admin";
import { getTodayDate } from "@/lib/date-utils";
import { calculateSnapshot } from "@/lib/dashboard-calculations";

type DateFilter = "hoy" | "semana" | "mes";

type AuthorizedProfile = {
  gym_id: string | null;
  role: "admin" | "staff" | "platform_owner" | string | null;
  full_name: string | null;
};

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

export async function GET(req: NextRequest) {
  const supabase = await createSupabaseServerClient();
  const admin = getSupabaseAdminClient();
  const user = await requireUser();
  if (!user) {
    return NextResponse.json({ ok: false, error: "No autenticado." }, { status: 401 });
  }

  const fromParam = req.nextUrl.searchParams.get("from");
  const toParam   = req.nextUrl.searchParams.get("to");
  const filterParam = req.nextUrl.searchParams.get("filter");
  let from: string, to: string;
  if (fromParam && toParam) {
    from = fromParam; to = toParam;
  } else {
    const filter: DateFilter = filterParam === "hoy" || filterParam === "semana" || filterParam === "mes" ? filterParam : "mes";
    ({ from, to } = getDateRange(filter));
  }

  const { data: profile } = await admin
    .from("profiles")
    .select("gym_id, role, full_name")
    .eq("id", user.id)
    .maybeSingle<AuthorizedProfile>();

  if (!profile?.gym_id || !["admin", "staff", "platform_owner"].includes(profile.role ?? "")) {
    return NextResponse.json({ ok: false, error: "No autorizado." }, { status: 403 });
  }

  const gymId = profile.gym_id;
  const today = new Date();
  const todayStr = getTodayDate();

  // thisMonthFrom/To se derivan del filtro seleccionado, no de hoy.
  // Así el calendario filtra correctamente todos los datos del dashboard.
  const selectedStart = fromParam ? new Date(fromParam + "T00:00:00") : startOfMonth(today);
  const thisMonthFrom = isoDate(startOfMonth(selectedStart));
  const thisMonthTo   = isoDate(endOfMonth(selectedStart));
  const isCurrentMonth = thisMonthFrom === isoDate(startOfMonth(today));
  const currentMonthKey = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, "0")}`;
  const SNAPSHOT_TTL_MS = 10 * 60 * 1000;

  // ── Fast path: serve from pre-computed snapshot ──────────────────────────
  if (isCurrentMonth && !fromParam) {
    const { data: snapRow } = await admin
      .from("dashboard_snapshots")
      .select("payload, computed_at")
      .eq("gym_id", gymId)
      .eq("month_key", currentMonthKey)
      .maybeSingle();

    if (snapRow && Date.now() - new Date(snapRow.computed_at).getTime() < SNAPSHOT_TTL_MS) {
      const [{ count: asistHoy }, { data: liveSettings }] = await Promise.all([
        admin.from("asistencias").select("id", { count: "exact", head: true })
          .eq("gym_id", gymId).eq("fecha", todayStr),
        admin.from("gym_settings").select("wa_status").eq("gym_id", gymId).maybeSingle(),
      ]);
      const payload = snapRow.payload as Record<string, unknown>;
      const snap    = payload.snapshot as Record<string, unknown>;
      return NextResponse.json({
        ...payload,
        fetchedAt: new Date().toISOString(),
        waStatus:  (liveSettings?.wa_status ?? "unknown") as "active" | "disconnected" | "qr" | "unknown",
        snapshot:  { ...snap, asistHoy: asistHoy ?? 0 },
      });
    }
  }
  // ─────────────────────────────────────────────────────────────────────────

  const { snapshot, meta } = await calculateSnapshot(
    admin,
    gymId,
    from,
    to,
    today,
    todayStr,
    fromParam,
    { ownerName: profile.full_name ?? undefined }
  );

  const responseBody = {
    ok: true,
    ownerName: meta.ownerName.split(" ")[0],
    gymName: meta.gymName,
    fetchedAt: new Date().toISOString(),
    lastCronRun: meta.lastCronRun ?? null,
    waStatus: meta.waStatus,
    snapshot,
  };

  // ── Save snapshot for fast path on next load ─────────────────────────────
  if (isCurrentMonth && !fromParam) {
    void admin.from("dashboard_snapshots").upsert(
      { gym_id: gymId, month_key: currentMonthKey, payload: responseBody, computed_at: new Date().toISOString() },
      { onConflict: "gym_id,month_key" },
    );
  }
  // ─────────────────────────────────────────────────────────────────────────

  return NextResponse.json(responseBody);
}
