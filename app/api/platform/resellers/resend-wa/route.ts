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

export async function POST(req: NextRequest) {
  if (!await assertPlatformOwner()) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const { resellerId } = await req.json();
  if (!resellerId) return NextResponse.json({ error: "resellerId requerido" }, { status: 400 });

  const { data: reseller } = await sb
    .from("resellers")
    .select("id, name, slug, user_id")
    .eq("id", resellerId)
    .maybeSingle();

  if (!reseller) return NextResponse.json({ error: "Reseller no encontrado" }, { status: 404 });

  // Get user email and phone from reseller_applications (if exists)
  const { data: app } = await sb
    .from("reseller_applications")
    .select("whatsapp, email")
    .eq("name", reseller.name)
    .eq("status", "approved")
    .maybeSingle();

  if (!app?.whatsapp) return NextResponse.json({ error: "No hay teléfono registrado" }, { status: 400 });

  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? "https://fitgrowx.com";
  const refLink = `${appUrl}/start?reseller=${reseller.slug}`;
  const portalLink = `${appUrl}/reseller/portal`;

  // Generate magic link for portal access
  let magicLink = "";
  if (reseller.user_id) {
    const { data: ld } = await sb.auth.admin.generateLink({
      type: "magiclink",
      email: app.email,
      options: { redirectTo: `${appUrl}/auth/callback?next=/reseller/portal` },
    });
    magicLink = ld?.properties?.action_link ?? "";
  }

  const result = await sendWa(
    "fitgrowx-platform",
    app.whatsapp.replace(/\D/g, ""),
    `🎉 *¡Bienvenido/a a la red FitGrowX, ${reseller.name.trim().split(" ")[0]}!*\n\n` +
    `Tu cuenta de revendedor está lista. Esto es todo lo que necesitás:\n\n` +
    `🔗 *Tu link de revendedor:*\n${refLink}\n\n` +
    `Compartilo con tus colegas y cada vez que contraten FitGrowX, vos ganás comisión de por vida.\n\n` +
    `📊 *Tu portal de comisiones:*\n${portalLink}\n\n` +
    `Para acceder, hacé click acá 👇\n${magicLink}\n\n` +
    `Cualquier duda respondé este mensaje. ¡A crecer! 💪`,
    { route: "resellers/resend-wa" },
  );

  return NextResponse.json({
    ok: result.ok,
    blocked: result.blocked,
    message: result.ok ? "WA enviado" : result.blocked ? "Número bloqueado" : "Error al enviar",
  });
}
