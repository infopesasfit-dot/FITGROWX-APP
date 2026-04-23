import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { Resend } from "resend";

const ADMIN_EMAIL = "elianafrancoanahi@gmail.com";

export async function POST(req: NextRequest) {
  // Authorization: only the platform owner can use this
  const authHeader = req.headers.get("authorization");
  const adminKey = process.env.FITGROWX_ADMIN_SECRET;
  if (!adminKey || authHeader !== `Bearer ${adminKey}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { subject, html, text, filter } = await req.json();
  if (!subject || (!html && !text)) {
    return NextResponse.json({ error: "subject y html/text son requeridos" }, { status: 400 });
  }

  const resend = new Resend(process.env.RESEND_API_KEY!);

  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
  );

  // Fetch all gym owners from auth.users (joined via profiles → gyms)
  const { data: profiles, error: profilesErr } = await supabase
    .from("profiles")
    .select("id, gym_id, gyms(gym_status, is_subscription_active, plan_type)")
    .eq("role", "admin");

  if (profilesErr) {
    return NextResponse.json({ error: profilesErr.message }, { status: 500 });
  }

  // Filter gyms if requested (e.g. only active subscriptions)
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let targets: any[] = profiles ?? [];
  if (filter === "active") {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    targets = targets.filter((p: any) => p.gyms?.is_subscription_active === true);
  } else if (filter === "trial") {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    targets = targets.filter((p: any) => p.gyms?.is_subscription_active !== true);
  }

  const userIds = targets.map((p: { id: string }) => p.id);
  if (userIds.length === 0) {
    return NextResponse.json({ sent: 0, message: "No hay destinatarios con ese filtro" });
  }

  // Fetch emails from auth.users via admin API
  const emails: string[] = [];
  for (const uid of userIds) {
    const { data: u } = await supabase.auth.admin.getUserById(uid);
    if (u?.user?.email) emails.push(u.user.email);
  }

  if (emails.length === 0) {
    return NextResponse.json({ sent: 0, message: "No se encontraron emails" });
  }

  // Send in batches of 50 (Resend batch limit)
  let sent = 0;
  const errors: string[] = [];

  for (let i = 0; i < emails.length; i += 50) {
    const batch = emails.slice(i, i + 50);
    const { data, error } = await resend.batch.send(
      batch.map((to) => ({
        from: `FitGrowX <noreply@fitgrowx.com>`,
        to,
        subject,
        html: html ?? undefined,
        text: text ?? undefined,
      })),
    );
    if (error) {
      errors.push(error.message ?? String(error));
    } else {
      sent += data?.data?.length ?? batch.length;
    }
  }

  return NextResponse.json({
    sent,
    total: emails.length,
    errors: errors.length > 0 ? errors : undefined,
  });
}

// GET — quick info endpoint so the admin can verify the route is live
export async function GET(req: NextRequest) {
  const authHeader = req.headers.get("authorization");
  const adminKey = process.env.FITGROWX_ADMIN_SECRET;
  if (!adminKey || authHeader !== `Bearer ${adminKey}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
  );

  const { count } = await supabase
    .from("profiles")
    .select("*", { count: "exact", head: true })
    .eq("role", "admin");

  return NextResponse.json({ adminEmail: ADMIN_EMAIL, totalGyms: count ?? 0, status: "ready" });
}
