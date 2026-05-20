import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export async function POST(req: Request) {
  try {
    const { alumno_id } = await req.json();

    if (!alumno_id) {
      return Response.json({ error: "Missing alumno_id" }, { status: 400 });
    }

    await supabase.from("push_subscriptions").delete().eq("alumno_id", alumno_id);

    return Response.json({ ok: true });
  } catch (err) {
    console.error("[push-unsubscribe]", err);
    return Response.json({ error: "Server error" }, { status: 500 });
  }
}
