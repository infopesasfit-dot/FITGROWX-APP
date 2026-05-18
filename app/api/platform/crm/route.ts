import { NextRequest, NextResponse } from "next/server";
import { getSupabaseAdminClient } from "@/lib/supabase-admin";
import { createSupabaseServerClient } from "@/lib/supabase-server";
import { sendWa } from "@/lib/wa";
import { applyRateLimit } from "@/lib/request-security";

const sb = getSupabaseAdminClient();

async function assertPlatformOwner() {
  const sbUser = await createSupabaseServerClient();
  const { data: { user } } = await sbUser.auth.getUser();
  if (!user) return null;
  const { data: profile } = await sb.from("profiles").select("role").eq("id", user.id).maybeSingle();
  return profile?.role === "platform_owner" ? user : null;
}

function fill(template: string, vars: Record<string, string>) {
  return Object.entries(vars).reduce(
    (s, [k, v]) => s.replace(new RegExp(`\\{${k}\\}`, "gi"), v),
    template,
  );
}

// POST /api/platform/crm
// Actions: send-wa | mark-contacted | set-followup
export async function POST(req: NextRequest) {
  const user = await assertPlatformOwner();
  if (!user) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const body = await req.json().catch(() => null);
  const { action } = body ?? {};

  // ── send-wa ─────────────────────────────────────────────────────────────────
  if (action === "send-wa") {
    const rl = await applyRateLimit({
      namespace:   "platform-crm-send-wa",
      identifier:  user.id,
      windowMs:    60_000,
      maxAttempts: 10,
    });
    if (!rl.allowed) return NextResponse.json({ error: "Límite de envíos alcanzado. Esperá un minuto." }, { status: 429 });

    const { account_id, phone, template_key, template_body, nombre } = body;
    if (!phone?.trim() || !template_body?.trim()) {
      return NextResponse.json({ error: "phone y template_body requeridos." }, { status: 400 });
    }
    if (template_body.length > 1500) {
      return NextResponse.json({ error: "Mensaje demasiado largo (máx 1500 chars)." }, { status: 400 });
    }

    const digits = String(phone).replace(/\D/g, "");
    const normalizedPhone = digits.startsWith("549") ? digits : digits.startsWith("54") ? "549" + digits.slice(2) : "549" + digits;
    const message = fill(template_body, { nombre: nombre ?? "Nombre", dias: "2" });

    const ok = await sendWa("fitgrowx-platform", normalizedPhone, message, { route: `platform-crm/${template_key ?? "manual"}` });

    if (ok && account_id) {
      Promise.resolve(
        sb.from("platform_accounts")
          .update({ last_contact_at: new Date().toISOString() })
          .eq("id", account_id),
      ).catch(() => {});
    }

    console.log(`[platform-crm/send-wa] user=${user.id} account=${account_id ?? "lead"} tpl=${template_key} phone=${normalizedPhone} ok=${ok}`);
    if (!ok) return NextResponse.json({ error: "No se pudo enviar. Verificá que el WA de plataforma esté conectado." }, { status: 500 });
    return NextResponse.json({ ok: true });
  }

  // ── mark-contacted ───────────────────────────────────────────────────────────
  if (action === "mark-contacted") {
    const { account_id, lead_id } = body;
    const now = new Date().toISOString();

    if (account_id) {
      const { error } = await sb.from("platform_accounts")
        .update({ last_contact_at: now, status: "trial_active" })
        .eq("id", account_id)
        .not("status", "in", '("converted","churned")');
      if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    } else if (lead_id) {
      const { error } = await sb.from("platform_leads")
        .update({ status: "contacted", last_contact_at: now })
        .eq("id", lead_id)
        .eq("status", "new");
      if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    } else {
      return NextResponse.json({ error: "account_id o lead_id requerido." }, { status: 400 });
    }

    return NextResponse.json({ ok: true });
  }

  // ── set-followup ─────────────────────────────────────────────────────────────
  if (action === "set-followup") {
    const { account_id, days } = body;
    if (!account_id) return NextResponse.json({ error: "account_id requerido." }, { status: 400 });
    const daysNum = Number(days);
    if (!Number.isFinite(daysNum) || daysNum < 1 || daysNum > 90) {
      return NextResponse.json({ error: "days debe ser entre 1 y 90." }, { status: 400 });
    }

    const followUp = new Date(Date.now() + daysNum * 86_400_000).toISOString();
    const { error } = await sb.from("platform_accounts").update({ next_follow_up_at: followUp }).eq("id", account_id);
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ ok: true, next_follow_up_at: followUp });
  }

  return NextResponse.json({ error: "action inválida." }, { status: 400 });
}
