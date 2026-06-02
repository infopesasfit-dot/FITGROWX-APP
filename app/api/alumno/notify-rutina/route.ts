import { NextRequest, NextResponse } from "next/server";
import { getSupabaseAdminClient } from "@/lib/supabase-admin";
import { createSupabaseServerClient } from "@/lib/supabase-server";
import { normalizePhone } from "@/lib/phone";
import { sendWa } from "@/lib/wa";
import { ensureGymBranding } from "@/lib/messaging-helpers";
import { createAlumnoNotification } from "@/lib/alumno-notif";
import { requireGymNotBlocked } from "@/lib/require-gym-not-blocked";

const supabase = getSupabaseAdminClient();

const DEFAULT_MSG =
  "Hola {nombre} 👋\nTu coach de {gym} te asignó una rutina nueva.\nEntrá a la app desde tus accesos guardados para verla.";

export async function POST(req: NextRequest) {
  const sessionClient = await createSupabaseServerClient();
  const { data: { user } } = await sessionClient.auth.getUser();
  if (!user) return NextResponse.json({ ok: false }, { status: 401 });

  const { data: callerProfile } = await supabase
    .from("profiles")
    .select("gym_id, role")
    .eq("id", user.id)
    .maybeSingle();

  if (!callerProfile?.gym_id || !["admin", "staff"].includes(callerProfile.role ?? "")) {
    return NextResponse.json({ ok: false }, { status: 403 });
  }

  const blocked = await requireGymNotBlocked(callerProfile.gym_id);
  if (blocked) return blocked;

  const { alumno_id } = await req.json();
  if (!alumno_id) return NextResponse.json({ ok: false }, { status: 400 });

  const { data: alumno } = await supabase
    .from("alumnos")
    .select("id, gym_id, full_name, phone")
    .eq("id", alumno_id)
    .eq("gym_id", callerProfile.gym_id)
    .is("deleted_at", null)
    .single();

  if (!alumno?.phone) return NextResponse.json({ ok: true });

  const { data: settings } = await supabase
    .from("gym_settings")
    .select("gym_name")
    .eq("gym_id", alumno.gym_id)
    .maybeSingle();

  const { data: gym } = await supabase
    .from("gyms")
    .select("name")
    .eq("id", alumno.gym_id)
    .maybeSingle();

  const gymName = settings?.gym_name || gym?.name || "tu gimnasio";
  const template = ensureGymBranding(DEFAULT_MSG, gymName);
  const msg = template
    .replace(/\{nombre\}/gi, alumno.full_name.split(" ")[0])
    .replace(/\{gym\}/gi, gymName);

  void sendWa(alumno.gym_id, normalizePhone(alumno.phone), msg, { route: "alumno/notify-rutina" });
  void createAlumnoNotification(supabase, {
    alumno_id: alumno.id,
    gym_id:    alumno.gym_id,
    type:      "rutina_asignada",
    title:     "Nueva rutina asignada",
    body:      "Tu entrenador te asignó una nueva rutina. ¡A entrenar!",
  });

  return NextResponse.json({ ok: true });
}
