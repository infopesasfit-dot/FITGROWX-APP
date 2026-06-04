import { NextRequest, NextResponse } from "next/server";
import { getSupabaseAdminClient } from "@/lib/supabase-admin";
import { createSupabaseServerClient } from "@/lib/supabase-server";
import { sendWa } from "@/lib/wa";
import { logger } from "@/lib/logger";

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
    const { error } = await sb.from("reseller_audit_log").insert(entry);
    if (error) console.error("Reseller audit log failed:", error.message);
  } catch (error) {
    console.error("Reseller audit log failed:", error);
  }
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
  const actor = await assertPlatformOwner();
  if (!actor) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const { id, status } = await req.json();
  if (!id || !["approved", "rejected", "pending"].includes(status)) {
    return NextResponse.json({ error: "id y status requeridos" }, { status: 400 });
  }

  const { data: before } = await sb
    .from("reseller_applications")
    .select("id, name, whatsapp, status, reseller_id")
    .eq("id", id)
    .maybeSingle();
  if (!before) return NextResponse.json({ error: "Postulación no encontrada" }, { status: 404 });

  const { data: after, error } = await sb
    .from("reseller_applications")
    .update({ status })
    .eq("id", id)
    .select("id, name, whatsapp, status, reseller_id")
    .single();
if (error) {
  void logger.error("db error", { route: "/platform/resellers/applications", meta: { error } });
  return NextResponse.json({ error: "Error interno. Intente nuevamente." }, { status: 500 });
  }

  await writeResellerAuditLog({
    actor_id: actor.id,
    entity_type: "application",
    entity_id: id,
    action: status === "approved" ? "approve" : status === "rejected" ? "reject" : "update",
    before,
    after,
  });

  // Notify applicant via WA if approved/rejected
  {
    const app = after;
    if (app?.whatsapp) {
      const msg = status === "approved"
        ? `🎉 *¡Felicitaciones ${app.name}!*\n\nTu postulación como reseller de FitGrowX fue *aprobada*.\n\nPronto te enviamos tu link personalizado y los próximos pasos. ¡Bienvenido/a a la red! 🚀`
        : `Hola ${app.name}, revisamos tu postulación como reseller de FitGrowX y por ahora no podemos avanzar. ¡Gracias por el interés! Si cambia algo, no dudes en volver a escribirnos.`;
      void sendWa("fitgrowx-platform", app.whatsapp, msg, { route: "resellers/applications" });
    }
  }

  return NextResponse.json({ ok: true });
}
