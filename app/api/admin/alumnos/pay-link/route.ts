import { NextRequest, NextResponse } from "next/server";
import { getSupabaseAdminClient } from "@/lib/supabase-admin";
import { createSupabaseServerClient , requireUser } from "@/lib/supabase-server";
import { normalizePhone } from "@/lib/phone";
import { sendWa } from "@/lib/wa";
import { requireGymNotBlocked } from "@/lib/require-gym-not-blocked";
import { createHash } from "crypto";

const sb = getSupabaseAdminClient();
const APP_URL = (process.env.NEXT_PUBLIC_APP_URL ?? "https://app.fitgrowx.com").replace(/\/$/, "");

export async function POST(req: NextRequest) {
  const sbUser = await createSupabaseServerClient();
  const user = await requireUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { data: profile } = await sb.from("profiles").select("gym_id, role").eq("id", user.id).maybeSingle();
  if (!profile?.gym_id || !["admin", "staff"].includes(profile.role ?? ""))
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const blocked = await requireGymNotBlocked(profile.gym_id);
  if (blocked) return blocked;

  const { alumno_id } = await req.json();
  if (!alumno_id) return NextResponse.json({ error: "alumno_id requerido" }, { status: 400 });

  const { data: alumno } = await sb
    .from("alumnos")
    .select("id, full_name, phone, gym_id, plan_id, planes(nombre, precio)")
    .eq("id", alumno_id)
    .eq("gym_id", profile.gym_id)
    .eq("is_demo", false)
    .is("deleted_at", null)
    .maybeSingle();

  if (!alumno) return NextResponse.json({ error: "Alumno no encontrado" }, { status: 404 });
  if (!alumno.phone) return NextResponse.json({ error: "El alumno no tiene teléfono" }, { status: 400 });

  const plan = alumno.planes as unknown as { nombre: string; precio: number } | null;
  if (!plan?.precio) return NextResponse.json({ error: "El alumno no tiene plan con precio asignado" }, { status: 400 });

  const now = new Date();
  const { data: existing } = await sb
    .from("alumno_tokens")
    .select("id")
    .eq("alumno_id", alumno_id)
    .eq("gym_id", profile.gym_id)
    .gt("expires_at", now.toISOString())
    .maybeSingle();

  // Invalidate existing token to prevent hash-reuse bugs
  if (existing) {
    await sb
      .from("alumno_tokens")
      .update({ expires_at: now.toISOString() })
      .eq("id", existing.id);
  }

  // Always generate a fresh token (rawToken for URL, tokenHash for DB)
  const rawToken = crypto.randomUUID();
  const tokenHash = createHash("sha256").update(rawToken).digest("hex");
  await sb.from("alumno_tokens").insert({
    alumno_id,
    gym_id: profile.gym_id,
    token: tokenHash,
    expires_at: new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000).toISOString(),
  });

  let token = rawToken;

  const { data: settings } = await sb
    .from("gym_settings")
    .select("gym_name, mp_access_token, payment_info, slug")
    .eq("gym_id", profile.gym_id)
    .maybeSingle();

  const gymName = settings?.gym_name ?? "el gym";
  const hasMP = !!settings?.mp_access_token;
  const gymParam = settings?.slug ? `&gym=${settings.slug}` : "";
  const link = hasMP
    ? `${APP_URL}/api/alumno/pagar-link?token=${token}`
    : `${APP_URL}/alumno/auth?token=${token}${gymParam}`;

  const precio = plan.precio.toLocaleString("es-AR");
  const msg = hasMP
    ? `💳 *${gymName}* — Link de pago\n\nHola ${alumno.full_name.split(" ")[0]}! Te mandamos tu link para renovar tu membresía *${plan.nombre}* por $${precio}.\n\n👉 ${link}\n\n_Se abre directo en Mercado Pago. Sin registro._`
    : `💳 *${gymName}* — Renovación de membresía\n\nHola ${alumno.full_name.split(" ")[0]}! Tu membresía *${plan.nombre}* es $${precio}.\n\n👉 ${link}\n\n${settings?.payment_info ? `\n💳 Datos de pago:\n${settings.payment_info}` : ""}`;

  // sendWa retorna { ok: boolean, ... } — usar .ok, NO el objeto.
  const waOk = await sendWa(profile.gym_id, normalizePhone(alumno.phone), msg, { route: "admin/pay-link" });
  if (!waOk.ok) return NextResponse.json({ error: "No se pudo enviar el WA. Verificá que esté conectado." }, { status: 500 });

  return NextResponse.json({ ok: true, link });
}
