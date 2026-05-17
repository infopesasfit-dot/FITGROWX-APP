import { NextRequest, NextResponse } from "next/server";
import { getSupabaseAdminClient } from "@/lib/supabase-admin";
import { createSupabaseServerClient } from "@/lib/supabase-server";
import { sendWa } from "@/lib/wa";

const sb = getSupabaseAdminClient();

async function assertPlatformOwner() {
  const sbUser = await createSupabaseServerClient();
  const { data: { user } } = await sbUser.auth.getUser();
  if (!user) return null;
  const { data: profile } = await sb.from("profiles").select("role").eq("id", user.id).maybeSingle();
  return profile?.role === "platform_owner" ? user : null;
}

function toSlug(name: string) {
  return name.toLowerCase()
    .normalize("NFD").replace(/[̀-ͯ]/g, "")
    .replace(/\s+/g, "")
    .replace(/[^a-z0-9]/g, "")
    .slice(0, 30);
}

export async function POST(req: NextRequest) {
  if (!await assertPlatformOwner()) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const { applicationId, name, email, whatsapp, payout_info } = await req.json();

  if (!name?.trim() || !email?.trim()) {
    return NextResponse.json({ error: "Nombre y email requeridos" }, { status: 400 });
  }

  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? "https://fitgrowx.com";
  const redirectTo = `${appUrl}/auth/callback?next=/reseller/portal`;

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
      return NextResponse.json({ error: invErr?.message ?? "Error creando usuario" }, { status: 500 });
    }
    userId = ld.user.id;
    magicLink = ld.properties?.action_link ?? "";
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

  if (rErr) return NextResponse.json({ error: rErr.message }, { status: 500 });

  // --- 4. Mark application approved ---
  if (applicationId) {
    await sb.from("reseller_applications").update({ status: "approved" }).eq("id", applicationId);
  }

  // --- 5. Send WA onboarding ---
  const phone = whatsapp?.replace(/\D/g, "");
  const refLink    = `${appUrl}/start?reseller=${slug}`;
  const portalLink = `${appUrl}/reseller/portal`;

  if (phone) {
    void sendWa(
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
  }

  return NextResponse.json({ reseller, slug, refLink });
}
