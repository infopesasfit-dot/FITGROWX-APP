import { sanitizeError } from "@/lib/api-error";
import { NextRequest, NextResponse } from "next/server";
import { getValidAlumnoToken } from "@/lib/alumno-token";
import { getSupabaseAdminClient } from "@/lib/supabase-admin";
import { getTodayDate } from "@/lib/date-utils";
import { applyAlumnoRateLimit } from "@/lib/alumno-rate-limit";
import { logAlumnoAction } from "@/lib/alumno-logging";
import { reservarClaseAlumnoSchema } from "@/lib/schemas";
import { requireAlumnoActionAllowed } from "@/lib/alumno-action-guard";

const supabase = getSupabaseAdminClient();

function getWeekRange(dateStr: string) {
  const date = new Date(`${dateStr}T12:00:00`);
  const day = date.getDay();
  const diffToMonday = day === 0 ? -6 : 1 - day;
  const start = new Date(date);
  start.setDate(date.getDate() + diffToMonday);
  const end = new Date(start);
  end.setDate(start.getDate() + 6);
  return {
    from: start.toISOString().slice(0, 10),
    to: end.toISOString().slice(0, 10),
  };
}

export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => null);
  const parsed = reservarClaseAlumnoSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0]?.message ?? "Parámetros inválidos." }, { status: 400 });
  }
  const { clase_id, fecha } = parsed.data;
  if (fecha < getTodayDate()) return NextResponse.json({ error: "No podés reservar clases pasadas." }, { status: 400 });

  const access = await requireAlumnoActionAllowed(req);
  if ("response" in access) return access.response;
  const { tokenRow } = access;

  const rateLimit = await applyAlumnoRateLimit(req, tokenRow.alumno_id, { windowMs: 60 * 1000, maxAttempts: 20 });
  if (!rateLimit.allowed) return rateLimit.response!;

  const { data: clase } = await supabase.from("gym_classes").select("max_capacity, class_name, gym_id, day_of_week").eq("id", clase_id).single();
  if (!clase) return NextResponse.json({ error: "Clase no encontrada." }, { status: 404 });
  if (clase.gym_id !== tokenRow.gym_id) return NextResponse.json({ error: "Clase inválida para este gimnasio." }, { status: 403 });

  const fechaDate = new Date(`${fecha}T12:00:00`);
  const fechaDayOfWeek = fechaDate.getDay();
  if (fechaDayOfWeek !== clase.day_of_week) {
    const dayNames = ["domingo", "lunes", "martes", "miércoles", "jueves", "viernes", "sábado"];
    return NextResponse.json({
      error: `Esta clase es los ${dayNames[clase.day_of_week]}, no podés reservarla para un ${dayNames[fechaDayOfWeek]}.`
    }, { status: 400 });
  }

  const { data: alumno } = await supabase
    .from("alumnos")
    .select("plan_id, status, next_expiration_date, planes!plan_id(access_type, classes_per_week)")
    .eq("id", tokenRow.alumno_id)
    .eq("gym_id", tokenRow.gym_id)
    .is("deleted_at", null)
    .maybeSingle();

  const planes = alumno?.planes;
  const plan = Array.isArray(planes) ? planes?.[0] : planes;
  if (!plan) return NextResponse.json({ error: "El alumno no tiene un plan asignado." }, { status: 422 });

  if (alumno!.status !== "activo") {
    return NextResponse.json({ error: "Tu membresía no está activa. Regularizá tu situación para reservar." }, { status: 403 });
  }
  if (alumno!.next_expiration_date && alumno!.next_expiration_date < getTodayDate()) {
    return NextResponse.json({ error: "Tu membresía está vencida. Renová tu plan para reservar." }, { status: 403 });
  }

  const accessType = typeof plan?.access_type === "string" ? plan.access_type : "libre";
  const classesPerWeek = typeof plan?.classes_per_week === "number" ? plan.classes_per_week : null;

  if (accessType === "clases_por_semana" && classesPerWeek && classesPerWeek > 0) {
    const { from, to } = getWeekRange(fecha);
    const { count: weeklyCount } = await supabase
      .from("reservas")
      .select("id", { count: "exact", head: true })
      .eq("gym_id", tokenRow.gym_id)
      .eq("alumno_id", tokenRow.alumno_id)
      .in("estado", ["confirmada", "cancelada_tarde"])
      .gte("fecha", from)
      .lte("fecha", to);

    if ((weeklyCount ?? 0) >= classesPerWeek) {
      return NextResponse.json({ error: `Tu plan permite ${classesPerWeek} clase${classesPerWeek === 1 ? "" : "s"} por semana.` }, { status: 409 });
    }
  }

  const { count } = await supabase.from("reservas").select("id", { count: "exact", head: true }).eq("clase_id", clase_id).eq("fecha", fecha).eq("estado", "confirmada");
  if ((count ?? 0) >= clase.max_capacity) return NextResponse.json({ error: "La clase ya está completa para esa fecha." }, { status: 409 });

  const { data: cancellation } = await supabase
    .from("class_cancellations")
    .select("id, motivo")
    .eq("clase_id", clase_id)
    .eq("fecha", fecha)
    .maybeSingle();

  if (cancellation) {
    return NextResponse.json({
      error: `Esta clase está cancelada para esa fecha${cancellation.motivo ? `: ${cancellation.motivo}` : "."}`
    }, { status: 409 });
  }

  const { error } = await supabase.from("reservas").insert({ gym_id: tokenRow.gym_id, alumno_id: tokenRow.alumno_id, clase_id, fecha, estado: "confirmada" }).select();
  if (error) {
    await logAlumnoAction({ alumno_id: tokenRow.alumno_id, gym_id: tokenRow.gym_id, action: "reserva_created", status: "error", error_msg: error.message });
    if (error.code === "23505") return NextResponse.json({ error: "Ya tenés una reserva para esa clase y fecha." }, { status: 409 });
    if (error.code === "P0001" && error.message.includes("CAPACITY_EXCEEDED"))
      return NextResponse.json({ error: "La clase ya está completa para esa fecha." }, { status: 409 });
    return NextResponse.json({ error: sanitizeError(error) }, { status: 500 });
  }

  await logAlumnoAction({ alumno_id: tokenRow.alumno_id, gym_id: tokenRow.gym_id, action: "reserva_created", status: "success", details: { clase_id, fecha } });
  return NextResponse.json({ ok: true });
}

export async function DELETE(req: NextRequest) {
  const body = await req.json().catch(() => null);
  const parsed = reservarClaseAlumnoSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0]?.message ?? "Parámetros inválidos." }, { status: 400 });
  }
  const { clase_id, fecha } = parsed.data;

  const access = await requireAlumnoActionAllowed(req);
  if ("response" in access) return access.response;
  const { tokenRow } = access;

  const rateLimit = await applyAlumnoRateLimit(req, tokenRow.alumno_id, { windowMs: 60 * 1000, maxAttempts: 20 });
  if (!rateLimit.allowed) return rateLimit.response!;

  const [{ data: claseRow }, { data: settings }] = await Promise.all([
    supabase.from("gym_classes").select("start_time").eq("id", clase_id).single(),
    supabase.from("gym_settings").select("cancel_window_hours").eq("gym_id", tokenRow.gym_id).maybeSingle(),
  ]);

  let estado: "cancelada" | "cancelada_tarde" = "cancelada";
  const windowHours: number | null = settings?.cancel_window_hours ?? null;

  if (claseRow?.start_time && windowHours != null && windowHours > 0) {
    // Build class datetime in ART (UTC-3)
    const claseDatetimeStr = `${fecha}T${claseRow.start_time}-03:00`;
    const claseDatetime = new Date(claseDatetimeStr);
    const nowMs = Date.now();
    const diffHours = (claseDatetime.getTime() - nowMs) / (1000 * 60 * 60);
    if (diffHours < windowHours) {
      estado = "cancelada_tarde";
    }
  }

  const { data: updated, error } = await supabase
    .from("reservas")
    .update({ estado })
    .eq("alumno_id", tokenRow.alumno_id)
    .eq("gym_id", tokenRow.gym_id)
    .eq("clase_id", clase_id)
    .eq("fecha", fecha)
    .eq("estado", "confirmada")
    .select();
  if (error) {
    await logAlumnoAction({ alumno_id: tokenRow.alumno_id, gym_id: tokenRow.gym_id, action: "reserva_cancelled", status: "error", error_msg: error.message });
    return NextResponse.json({ error: sanitizeError(error) }, { status: 500 });
  }

  if (!updated || updated.length === 0) {
    return NextResponse.json({ error: "No se encontró una reserva confirmada para cancelar." }, { status: 404 });
  }

  await logAlumnoAction({ alumno_id: tokenRow.alumno_id, gym_id: tokenRow.gym_id, action: "reserva_cancelled", status: "success", details: { clase_id, fecha, tipo: estado } });

  if (estado === "cancelada_tarde") {
    return NextResponse.json({
      ok: true,
      late_cancel: true,
      message: `Cancelaste fuera del plazo permitido (${windowHours}h antes). La clase se descontará de tu cuota semanal.`,
    });
  }
  return NextResponse.json({ ok: true });
}
