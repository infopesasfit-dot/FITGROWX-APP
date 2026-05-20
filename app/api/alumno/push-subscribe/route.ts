import { cookies } from "next/headers";
import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { alumno_id, subscription } = body;

    if (!alumno_id || !subscription) {
      return Response.json({ error: "Missing fields" }, { status: 400 });
    }

    // Store push subscription
    const { error } = await supabase.from("push_subscriptions").upsert(
      {
        alumno_id,
        endpoint: subscription.endpoint,
        p256dh: subscription.keys.p256dh,
        auth: subscription.keys.auth,
        updated_at: new Date().toISOString(),
      },
      { onConflict: "alumno_id" }
    );

    if (error) {
      console.error("[push-subscribe]", error);
      return Response.json({ error: "Failed to subscribe" }, { status: 500 });
    }

    return Response.json({ ok: true });
  } catch (err) {
    console.error("[push-subscribe]", err);
    return Response.json({ error: "Server error" }, { status: 500 });
  }
}
