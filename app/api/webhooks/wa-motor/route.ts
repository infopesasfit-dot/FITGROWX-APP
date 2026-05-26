import { NextRequest, NextResponse } from "next/server";
import { getSupabaseAdminClient } from "@/lib/supabase-admin";

const sb = getSupabaseAdminClient();
const WEBHOOK_SECRET = process.env.WA_MOTOR_WEBHOOK_SECRET || "";

export async function POST(req: NextRequest) {
  try {
    // Verify webhook secret
    const secret = req.headers.get("x-webhook-secret");
    if (!secret || secret !== WEBHOOK_SECRET) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await req.json();
    const { event, session, phone, reason, meta } = body;

    if (!event || !session || !phone) {
      return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
    }

    // Store event
    await sb.from("wa_motor_events").insert({
      event_type: event,
      session,
      phone,
      reason: reason || null,
      meta: meta || null,
    });

    // Handle specific events
    if (event === "block_detected") {
      // Update contact cooldown
      const { data: contact } = await sb
        .from("wa_contact_metrics")
        .select("blocked_count")
        .eq("phone", phone)
        .maybeSingle();

      if (contact) {
        await sb
          .from("wa_contact_metrics")
          .update({
            blocked_count: (contact.blocked_count || 0) + 1,
            last_blocked_at: new Date().toISOString(),
            cooldown_until: new Date(Date.now() + 24 * 3600000).toISOString(),
          })
          .eq("phone", phone);
      }
    }

    if (event === "invalid_phone") {
      // Mark phone as invalid in all alumnos
      await sb
        .from("alumnos")
        .update({
          phone_is_invalid: true,
          phone_invalid_at: new Date().toISOString(),
        })
        .eq("phone", phone)
        .is("deleted_at", null);
    }

    if (event === "rate_limited") {
      // Extract gym from meta if available
      if (meta?.gym_id) {
        // Log rate limit event for visibility
        console.warn(`[WA Motor] Rate limit detected for gym: ${meta.gym_id}`);
      }
    }

    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error("[WA Webhook Error]", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
