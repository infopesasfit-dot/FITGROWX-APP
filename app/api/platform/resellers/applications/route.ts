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

export async function GET() {
  if (!await assertPlatformOwner()) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const { data: applications } = await sb
    .from("reseller_applications")
    .select("*")
    .order("created_at", { ascending: false });

  return NextResponse.json({ applications: applications ?? [] });
}

export async function PATCH(req: NextRequest) {
  if (!await assertPlatformOwner()) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const { id, status } = await req.json();
  if (!id || !["approved", "rejected", "pending"].includes(status)) {
    return NextResponse.json({ error: "id y status requeridos" }, { status: 400 });
  }

  await sb.from("reseller_applications").update({ status }).eq("id", id);

  // Notify applicant via WA if approved/rejected
  {
    const { data: app } = await sb.from("reseller_applications").select("name, whatsapp").eq("id", id).maybeSingle();
    if (app?.whatsapp) {
      const msg = status === "approved"
        ? `🎉 *¡Felicitaciones ${app.name}!*\n\nTu postulación como reseller de FitGrowX fue *aprobada*.\n\nPronto te enviamos tu link personalizado y los próximos pasos. ¡Bienvenido/a a la red! 🚀`
        : `Hola ${app.name}, revisamos tu postulación como reseller de FitGrowX y por ahora no podemos avanzar. ¡Gracias por el interés! Si cambia algo, no dudes en volver a escribirnos.`;
      void sendWa("fitgrowx-platform", app.whatsapp, msg, { route: "resellers/applications" });
    }
  }

  return NextResponse.json({ ok: true });
}
