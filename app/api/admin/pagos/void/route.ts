import { NextRequest, NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase-server";
import { getSupabaseAdminClient } from "@/lib/supabase-admin";

const admin = getSupabaseAdminClient();

function statusFromDate(d: string | null): string {
  if (!d) return "vencido";
  return d >= new Date().toISOString().slice(0, 10) ? "activo" : "vencido";
}

export async function POST(req: NextRequest) {
  const supabase = await createSupabaseServerClient();
  const { data: { session } } = await supabase.auth.getSession();
  if (!session?.user) return NextResponse.json({ ok: false, error: "No autenticado." }, { status: 401 });

  const { data: profile } = await admin
    .from("profiles")
    .select("gym_id, role")
    .eq("id", session.user.id)
    .maybeSingle();

  if (!profile?.gym_id || profile.role !== "admin")
    return NextResponse.json({ ok: false, error: "Solo administradores pueden anular pagos." }, { status: 403 });

  const { pago_id } = await req.json() as { pago_id?: string };
  if (!pago_id) return NextResponse.json({ ok: false, error: "pago_id requerido." }, { status: 400 });

  // Fetch the pago to void
  const { data: pago } = await admin
    .from("pagos")
    .select("id, gym_id, alumno_id, amount, date, concepto, status, resulting_expiry")
    .eq("id", pago_id)
    .maybeSingle();

  if (!pago || pago.gym_id !== profile.gym_id)
    return NextResponse.json({ ok: false, error: "Pago no encontrado." }, { status: 404 });

  if (pago.status === "anulado")
    return NextResponse.json({ ok: false, error: "Este pago ya fue anulado." }, { status: 422 });

  if (pago.status === "pendiente")
    return NextResponse.json({ ok: false, error: "Usá 'Rechazar' para pagos pendientes." }, { status: 422 });

  // Mark as anulado
  const { error: voidErr } = await admin
    .from("pagos")
    .update({ status: "anulado" })
    .eq("id", pago_id);

  if (voidErr) return NextResponse.json({ ok: false, error: voidErr.message }, { status: 500 });

  // If not a membresia payment, no expiry rollback needed
  if (pago.concepto !== "membresia") {
    return NextResponse.json({ ok: true, new_expiry: null });
  }

  // ── Recalculate expiry from remaining validado membresia payments ──────────

  // Strategy A: MAX(resulting_expiry) from remaining validado cuota payments
  const { data: remaining } = await admin
    .from("pagos")
    .select("resulting_expiry, date")
    .eq("alumno_id", pago.alumno_id)
    .eq("status", "validado")
    .eq("concepto", "membresia")
    .neq("id", pago_id)
    .order("resulting_expiry", { ascending: false })
    .limit(1);

  let newExpiry: string | null = null;
  let newLastPayment: string | null = null;

  if (remaining && remaining.length > 0) {
    const best = remaining[0] as { resulting_expiry: string | null; date: string };
    if (best.resulting_expiry) {
      // Strategy A: have stored expiry
      newExpiry = best.resulting_expiry;
      newLastPayment = best.date;
    } else {
      // Strategy B fallback: MAX(date) + current plan duration
      const { data: alumno } = await admin
        .from("alumnos")
        .select("plan_id, planes(duracion_dias)")
        .eq("id", pago.alumno_id)
        .maybeSingle();

      const duracion = (alumno?.planes as { duracion_dias?: number } | null)?.duracion_dias ?? 30;
      const d = new Date(`${best.date}T12:00:00`);
      d.setDate(d.getDate() + duracion);
      newExpiry = d.toISOString().slice(0, 10);
      newLastPayment = best.date;
    }
  }
  // If no remaining validado membresia payments: newExpiry = null (expired)

  const { error: updateErr } = await admin
    .from("alumnos")
    .update({
      next_expiration_date: newExpiry,
      status: statusFromDate(newExpiry),
      ...(newLastPayment ? { last_payment_date: newLastPayment } : {}),
    })
    .eq("id", pago.alumno_id);

  if (updateErr) return NextResponse.json({ ok: false, error: updateErr.message }, { status: 500 });

  // Activity log
  await admin.from("alumno_activity_log").insert({
    alumno_id: pago.alumno_id,
    gym_id: profile.gym_id,
    type: "pago",
    description: `Pago $${Number(pago.amount).toLocaleString("es-AR")} anulado. Vencimiento recalculado → ${newExpiry ?? "sin membresía activa"}`,
    actor: "admin",
    metadata: { voided_pago_id: pago_id, new_expiry: newExpiry },
  }).then(() => {});

  return NextResponse.json({ ok: true, new_expiry: newExpiry });
}
