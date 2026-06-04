import { NextRequest, NextResponse } from "next/server";
import { timingSafeEqual } from "crypto";
import { getSupabaseAdminClient } from "@/lib/supabase-admin";
import { Resend } from "resend";
import { applyRateLimit, getClientIp } from "@/lib/request-security";
import { z } from "zod";
import { logger } from "@/lib/logger";

const blastSchema = z.object({
  subject: z.string().min(1, "subject requerido.").max(200),
  html:    z.string().max(200_000).optional(),
  text:    z.string().max(200_000).optional(),
  filter:  z.enum(["active", "trial", "all"]).optional(),
}).refine((d) => d.html || d.text, { message: "html o text son requeridos." });

function isAdminAuthorized(req: NextRequest): boolean {
  const bearer   = req.headers.get("authorization")?.replace("Bearer ", "") ?? "";
  const expected = process.env.FITGROWX_ADMIN_SECRET ?? "";
  if (!bearer || !expected) return false;
  try {
    const a = Buffer.from(bearer);
    const b = Buffer.from(expected);
    return a.length === b.length && timingSafeEqual(a, b);
  } catch { return false; }
}

const ADMIN_EMAIL = process.env.FITGROWX_OWNER_EMAIL ?? "elianafrancoanahi@gmail.com";

export async function POST(req: NextRequest) {
  if (!isAdminAuthorized(req)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const ip = getClientIp(req);
  const limit = await applyRateLimit({ namespace: "email-blast", identifier: ip, windowMs: 3_600_000, maxAttempts: 3 });
  if (!limit.allowed) return NextResponse.json({ error: "Rate limit exceeded." }, { status: 429 });

  const raw = await req.json().catch(() => null);
  const parsed = blastSchema.safeParse(raw);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0]?.message ?? "Datos inválidos." }, { status: 400 });
  }
  const { subject, html, text, filter } = parsed.data;

  const resend = new Resend(process.env.RESEND_API_KEY!);

  const supabase = getSupabaseAdminClient();

  // Fetch all gym owners from auth.users (joined via profiles → gyms)
  const { data: profiles, error: profilesErr } = await supabase
    .from("profiles")
    .select("id, gym_id, gyms(gym_status, is_subscription_active, plan_type)")
    .eq("role", "admin");

  if (profilesErr) {
    void logger.error("db error fetching profiles", { route: "/api/admin/email-blast", meta: { profilesErr } });
    return NextResponse.json({ error: "Error interno. Intente nuevamente." }, { status: 500 });
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

  // Fetch all auth users in one batch call, then filter to our targets
  const { data: { users } } = await supabase.auth.admin.listUsers({ perPage: 1000 });
  const userIdSet = new Set(userIds);
  const emails = users
    .filter(u => userIdSet.has(u.id) && u.email)
    .map(u => u.email!);

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
  if (!isAdminAuthorized(req)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const supabase = getSupabaseAdminClient();

  const { count } = await supabase
    .from("profiles")
    .select("*", { count: "exact", head: true })
    .eq("role", "admin");

  return NextResponse.json({ adminEmail: ADMIN_EMAIL, totalGyms: count ?? 0, status: "ready" });
}
