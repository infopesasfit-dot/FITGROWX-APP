import { NextRequest, NextResponse } from "next/server";
import { getValidAlumnoToken } from "@/lib/alumno-token";
import { getSupabaseAdminClient } from "@/lib/supabase-admin";
import { pushSubscribeSchema } from "@/lib/schemas";

const supabase = getSupabaseAdminClient();

export async function POST(req: NextRequest) {
  try {
    const tokenRow = await getValidAlumnoToken(req);
    if (!tokenRow) {
      return NextResponse.json({ error: "No autorizado." }, { status: 401 });
    }

    let raw: unknown;
    try {
      raw = await req.json();
    } catch {
      return NextResponse.json({ error: "JSON inválido." }, { status: 400 });
    }

    const parsed = pushSubscribeSchema.safeParse(raw);
    if (!parsed.success) {
      const msg = parsed.error.issues[0]?.message ?? "Datos inválidos.";
      return NextResponse.json({ error: msg }, { status: 400 });
    }

    // Verify ownership: alumno_id from request must match token's alumno_id
    if (parsed.data.alumno_id !== tokenRow.alumno_id) {
      return NextResponse.json({ error: "No autorizado." }, { status: 403 });
    }

    // Store push subscription
    const { error } = await supabase.from("push_subscriptions").upsert(
      {
        alumno_id: tokenRow.alumno_id,
        gym_id: tokenRow.gym_id,
        endpoint: parsed.data.subscription.endpoint,
        p256dh: parsed.data.subscription.keys.p256dh,
        auth: parsed.data.subscription.keys.auth,
        updated_at: new Date().toISOString(),
      },
      { onConflict: "alumno_id" }
    );

    if (error) {
      console.error("[push-subscribe]", error);
      return NextResponse.json({ error: "No se pudo guardar suscripción." }, { status: 500 });
    }

    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error("[push-subscribe]", err);
    return NextResponse.json({ error: "Error del servidor." }, { status: 500 });
  }
}
