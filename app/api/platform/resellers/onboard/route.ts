import { NextRequest, NextResponse } from "next/server";
import { getSupabaseAdminClient } from "@/lib/supabase-admin";
import { createSupabaseServerClient } from "@/lib/supabase-server";
import { sendWa } from "@/lib/wa";
import { logger } from "@/lib/logger";
import { sanitizeAuditState } from "@/lib/platform-audit";

const sb = getSupabaseAdminClient();

async function assertPlatformOwner() {
  const sbUser = await createSupabaseServerClient();
  const { data: { user } } = await sbUser.auth.getUser();
  if (!user) return null;
  const { data: profile } = await sb.from("profiles").select("role").eq("id", user.id).maybeSingle();
  return profile?.role === "platform_owner" ? user : null;
}

async function writeResellerAuditLog(entry: {
  actor_id: string | null;
  entity_type: "reseller" | "application";
  entity_id: string;
  action: "approve" | "reject" | "update" | "soft_delete" | "category_change" | "create";
  before: Record<string, unknown> | null;
  after: Record<string, unknown> | null;
  notes?: string;
}) {
  try {
    const { error } = await sb.from("reseller_audit_log").insert({
      ...entry,
      before: entry.before ? (sanitizeAuditState(entry.before) as Record<string, unknown>) : entry.before,
      after:  entry.after  ? (sanitizeAuditState(entry.after)  as Record<string, unknown>) : entry.after,
    });
    if (error) console.error("Reseller audit log failed:", error.message);
  } catch (error) {
    console.error("Reseller audit log failed:", error);
  }
}

function toSlug(name: string) {
  return name.toLowerCase()
    .normalize("NFD").replace(/[̀-ͯ]/g, "")
    .replace(/\s+/g, "")
    .replace(/[^a-z0-9]/g, "")
    .slice(0, 30);
}

export async function POST(req: NextRequest) {
  const actor = await assertPlatformOwner();
  if (!actor) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const { applicationId, name, email, whatsapp, payout_info } = await req.json();

  if (!name?.trim() || !email?.trim()) {
    return NextResponse.json({ error: "Nombre y email requeridos" }, { status: 400 });
  }

  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? "https://fitgrowx.com";
  const redirectTo = `${appUrl}/auth/callback?next=/reseller/portal`;

  let applicationBefore: Record<string, unknown> | null = null;
  if (applicationId) {
    const { data: application } = await sb
      .from("reseller_applications")
      .select("id, name, email, whatsapp, status, reseller_id")
      .eq("id", applicationId)
      .maybeSingle();
    applicationBefore = application ?? null;
    if (application?.reseller_id) {
      const { data: existingReseller } = await sb
        .from("resellers")
        .select("*")
        .eq("id", application.reseller_id)
        .maybeSingle();
      if (existingReseller) {
        const slug = existingReseller.slug;
        return NextResponse.json({
          reseller: existingReseller,
          slug,
          refLink: `${appUrl}/start?reseller=${slug}`,
          waSent: false,
          waBlocked: false,
          reused: true,
        });
      }
    }
  }

  // --- 1. Resolve or create auth user ---
  const { data: { users } } = await sb.auth.admin.listUsers();
  const existing = users?.find(u => u.email?.toLowerCase() === email.trim().toLowerCase());

  let userId: string;
  let magicLink: string;

  if (existing) {
    userId = existing.id;
    const { data: ld } = await sb.auth.admin.generateLink({
      type: "magiclink",
      email: email.trim().toLowerCase(),
      options: { redirectTo },
    });
    magicLink = ld?.properties?.action_link ?? "";
  } else {
    const { data: ld, error: invErr } = await sb.auth.admin.generateLink({
      type: "invite",
      email: email.trim().toLowerCase(),
      options: { redirectTo },
    });
    if (invErr || !ld?.user?.id) {
      void logger.error("auth error creating invite", { route: "/api/platform/resellers/onboard", meta: { invErr } });
      return NextResponse.json({ error: "No se pudo crear el usuario. Intente nuevamente." }, { status: 500 });
    }
    userId = ld.user.id;
    magicLink = ld.properties?.action_link ?? "";
  }

  const { data: existingByUser } = await sb
    .from("resellers")
    .select("*")
    .eq("user_id", userId)
    .maybeSingle();
  if (existingByUser) {
    if (applicationId) {
      const { data: applicationAfter } = await sb
        .from("reseller_applications")
        .update({ status: "approved", reseller_id: existingByUser.id })
        .eq("id", applicationId)
        .select("id, name, email, whatsapp, status, reseller_id")
        .single();
      await writeResellerAuditLog({
        actor_id: actor.id,
        entity_type: "application",
        entity_id: applicationId,
        action: "approve",
        before: applicationBefore,
        after: applicationAfter,
      });
    }
    const slug = existingByUser.slug;
    return NextResponse.json({
      reseller: existingByUser,
      slug,
      refLink: `${appUrl}/start?reseller=${slug}`,
      waSent: false,
      waBlocked: false,
      reused: true,
    });
  }

  // --- 2. Unique slug ---
  let slug = toSlug(name.trim());
  const { data: slugConflict } = await sb.from("resellers").select("id").eq("slug", slug).maybeSingle();
  if (slugConflict) slug = `${slug}${Math.floor(Math.random() * 900) + 100}`;

  // --- 3. Create reseller record ---
  const { data: reseller, error: rErr } = await sb.from("resellers").insert({
    name:           name.trim(),
    slug,
    commission_pct: 20,
    tier:           "standard",
    status:         "active",
    user_id:        userId,
    payout_info:    payout_info?.trim() || null,
  }).select().single();

  if (rErr) {
    if (rErr.code === "23505") {
      const { data: existingAfterConflict } = await sb
        .from("resellers")
        .select("*")
        .eq("user_id", userId)
        .maybeSingle();
      if (existingAfterConflict) {
        if (applicationId) {
          const { data: applicationAfter } = await sb
            .from("reseller_applications")
            .update({ status: "approved", reseller_id: existingAfterConflict.id })
            .eq("id", applicationId)
            .select("id, name, email, whatsapp, status, reseller_id")
            .single();
          await writeResellerAuditLog({
            actor_id: actor.id,
            entity_type: "application",
            entity_id: applicationId,
            action: "approve",
            before: applicationBefore,
            after: applicationAfter,
          });
        }
        return NextResponse.json({
          reseller: existingAfterConflict,
          slug: existingAfterConflict.slug,
          refLink: `${appUrl}/start?reseller=${existingAfterConflict.slug}`,
          waSent: false,
          waBlocked: false,
          reused: true,
        });
      }
    }
    void logger.error("db error in reseller onboard", { route: "/api/platform/resellers/onboard", meta: { rErr } });
    return NextResponse.json({ error: "Error interno. Intente nuevamente." }, { status: 500 });
  }

  await writeResellerAuditLog({
    actor_id: actor.id,
    entity_type: "reseller",
    entity_id: reseller.id,
    action: "create",
    before: null,
    after: {
      id: reseller.id,
      name: reseller.name,
      slug: reseller.slug,
      commission_pct: reseller.commission_pct,
      tier: reseller.tier,
      status: reseller.status,
      user_id: reseller.user_id,
    },
  });

  // --- 4. Mark application approved ---
  if (applicationId) {
    const { data: applicationAfter } = await sb
      .from("reseller_applications")
      .update({ status: "approved", reseller_id: reseller.id })
      .eq("id", applicationId)
      .select("id, name, email, whatsapp, status, reseller_id")
      .single();
    await writeResellerAuditLog({
      actor_id: actor.id,
      entity_type: "application",
      entity_id: applicationId,
      action: "approve",
      before: applicationBefore,
      after: applicationAfter,
    });
  }

  // --- 5. Send WA onboarding ---
  const phone = whatsapp?.replace(/\D/g, "");
  const refLink    = `${appUrl}/start?reseller=${slug}`;
  const portalLink = `${appUrl}/reseller/portal`;

  let waSent = true, waBlocked = false;
  if (phone) {
    const waResult = await sendWa(
      "fitgrowx-platform",
      phone,
      `🎉 *¡Bienvenido/a a la red FitGrowX, ${name.trim().split(" ")[0]}!*\n\n` +
      `Tu cuenta de revendedor está lista. Esto es todo lo que necesitás:\n\n` +
      `🔗 *Tu link de revendedor:*\n${refLink}\n\n` +
      `Compartilo con tus colegas y cada vez que contraten FitGrowX, vos ganás comisión de por vida.\n\n` +
      `📊 *Tu portal de comisiones:*\n${portalLink}\n\n` +
      `Para acceder, hacé click acá 👇\n${magicLink}\n\n` +
      `Cualquier duda respondé este mensaje. ¡A crecer! 💪`,
      { route: "resellers/onboard" },
    );
    waSent = waResult.ok ?? false;
    waBlocked = waResult.blocked ?? false;
  }

  return NextResponse.json({ reseller, slug, refLink, waSent, waBlocked });
}
