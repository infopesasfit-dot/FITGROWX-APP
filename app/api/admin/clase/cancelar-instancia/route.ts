import { NextRequest, NextResponse } from "next/server";
import { createSupabaseServerClient , requireUser } from "@/lib/supabase-server";
import { getSupabaseAdminClient } from "@/lib/supabase-admin";
import { sendWa } from "@/lib/wa";
import { normalizePhone } from "@/lib/phone";
import { createAlumnoNotification } from "@/lib/alumno-notif";
import { sendPushNotification, PushTemplates } from "@/lib/alumno-push-send";
import { requireGymNotBlocked } from "@/lib/require-gym-not-blocked";

const admin = getSupabaseAdminClient();

async function getAuthorizedProfile() {
  const supabase = await createSupabaseServerClient();
  const user = await requireUser();
  if (!user) return null;

  const { data: profile } = await admin
    .from("profiles")
    .select("id, gym_id, role")
    .eq("id", user.id)
    .maybeSingle<{ id: string; gym_id: string | null; role: string | null }>();

  if (!profile?.gym_id || !["admin", "staff", "platform_owner"].includes(profile.role ?? "")) {
    return null;
  }
  return profile as { id: string; gym_id: string; role: string };
}

function buildCreditLine(accessType: string | null, classesPerWeek: number | null): string {
  if (accessType === "clases_por_semana" && classesPerWeek) {
    return `Tu clase de esta semana fue devuelta a tu cuenta (seguís teniendo ${classesPerWeek} disponible${classesPerWeek === 1 ? "" : "s"}).`;
  }
  return "Tu reserva fue liberada sin cargo.";
}

export async function POST(req: NextRequest) {
  const profile = await getAuthorizedProfile();
  if (!profile) return NextResponse.json({ error: "No autorizado." }, { status: 401 });

  if (profile.role !== "platform_owner") {
    const blocked = await requireGymNotBlocked(profile.gym_id);
    if (blocked) return blocked;
  }

  const body = await req.json();
  const { clase_id, fecha, motivo } = body as { clase_id?: string; fecha?: string; motivo?: string };
  if (!clase_id || !fecha) return NextResponse.json({ error: "Parámetros faltantes." }, { status: 400 });

  // Verify class belongs to this gym
  const { data: clase } = await admin
    .from("gym_classes")
    .select("id, class_name, start_time, gym_id")
    .eq("id", clase_id)
    .eq("gym_id", profile.gym_id)
    .single();
  if (!clase) return NextResponse.json({ error: "Clase no encontrada." }, { status: 404 });

  // Insert cancellation record (UNIQUE constraint prevents double-cancel)
  const { error: insErr } = await admin
    .from("class_cancellations")
    .insert({ gym_id: profile.gym_id, clase_id, fecha, motivo: motivo ?? null, cancelled_by: profile.id });
  if (insErr) {
    if (insErr.code === "23505") return NextResponse.json({ error: "Esta instancia ya fue cancelada." }, { status: 409 });
    return NextResponse.json({ error: insErr.message }, { status: 500 });
  }

  // Fetch ALL affected reservations: both confirmada and cancelada_tarde
  // Include alumno plan info to tailor the credit-return message
  const { data: reservas } = await admin
    .from("reservas")
    .select(`
      alumno_id,
      estado,
      alumnos!alumno_id(
        full_name,
        phone,
        planes!plan_id(access_type, classes_per_week)
      )
    `)
    .eq("clase_id", clase_id)
    .eq("fecha", fecha)
    .eq("gym_id", profile.gym_id)
    .in("estado", ["confirmada", "cancelada_tarde"]);

  // Move all affected reservations to clase_cancelada_gym — does NOT count against weekly quota
  if ((reservas ?? []).length > 0) {
    await admin
      .from("reservas")
      .update({ estado: "clase_cancelada_gym" })
      .eq("clase_id", clase_id)
      .eq("fecha", fecha)
      .eq("gym_id", profile.gym_id)
      .in("estado", ["confirmada", "cancelada_tarde"]);
  }

  // Send WA to each affected alumno
  const fechaLabel = new Date(`${fecha}T12:00:00`).toLocaleDateString("es-AR", {
    weekday: "long", day: "numeric", month: "long",
  });
  const hora = clase.start_time.slice(0, 5);
  const motivoLine = motivo ? `\n_Motivo: ${motivo}_` : "";
  const notifiedCount = { ok: 0, fail: 0 };

  const notifications = (reservas ?? []).map(async (r) => {
    const alumno = Array.isArray(r.alumnos) ? r.alumnos[0] : r.alumnos;
    const alumno_id = r.alumno_id;
    const phone = (alumno as { phone?: string | null })?.phone;
    if (!phone) { notifiedCount.fail++; return; }

    const plan = (() => {
      const p = (alumno as { planes?: unknown })?.planes;
      const raw = Array.isArray(p) ? p[0] : p;
      return raw as { access_type?: string | null; classes_per_week?: number | null } | null;
    })();

    const nombre = (alumno as { full_name?: string | null })?.full_name?.split(" ")[0] ?? "";
    const creditLine = buildCreditLine(plan?.access_type ?? null, plan?.classes_per_week ?? null);

    const msg = [
      `Hola ${nombre}! 😔`,
      ``,
      `Te avisamos que la clase *${clase.class_name}* del ${fechaLabel} a las *${hora}h* fue cancelada por el gimnasio.${motivoLine}`,
      ``,
      `✅ ${creditLine}`,
      ``,
      `¡Disculpas por las molestias! Nos vemos en la próxima. 💪`,
    ].join("\n");

    // Send WhatsApp notification
    // sendWa retorna { ok: boolean, ... } — usar .ok, NO el objeto.
    const sent = await sendWa(
      profile.gym_id,
      normalizePhone(phone),
      msg,
      { route: "admin/clase/cancelar-instancia" },
    );
    sent.ok ? notifiedCount.ok++ : notifiedCount.fail++;

    // Send in-app notification
    void createAlumnoNotification(admin, {
      alumno_id,
      gym_id: profile.gym_id,
      type: "clase_cancelada",
      title: "Clase cancelada 😔",
      body: `${clase.class_name} del ${fechaLabel} a las ${hora}h fue cancelada.${motivoLine ? ` ${motivoLine}` : ""}`,
      link: "/alumno/panel?tab=calendario",
    });

    // Send push notification
    void sendPushNotification(
      admin,
      alumno_id,
      PushTemplates.classCancelled(clase.class_name, fechaLabel, hora)
    );
  });

  await Promise.allSettled(notifications);

  return NextResponse.json({
    ok: true,
    cancelled_reservas: (reservas ?? []).length,
    notified: notifiedCount.ok,
    notify_failed: notifiedCount.fail,
  });
}
