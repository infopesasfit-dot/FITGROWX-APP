import { NextRequest, NextResponse } from "next/server";
import { getValidAlumnoToken } from "@/lib/alumno-token";
import { createSupabaseServerClient } from "@/lib/supabase-server";
import { getSupabaseAdminClient } from "@/lib/supabase-admin";
import { createAlumnoNotification } from "@/lib/alumno-notif";
import { sendPushNotification, PushTemplates } from "@/lib/alumno-push-send";
import { sanitizeError } from "@/lib/api-error";

type StaffProfile = { gym_id: string | null; role: string | null };

const supabase = getSupabaseAdminClient();

export async function GET(req: NextRequest) {
  const tokenRow = await getValidAlumnoToken(req);
  if (!tokenRow) return NextResponse.json({ error: "No autorizado." }, { status: 401 });

  const { data } = await supabase.from("rutinas").select("nombre, ejercicios, updated_at").eq("alumno_id", tokenRow.alumno_id).single();
  return NextResponse.json({ rutina: data ?? null });
}

export async function POST(req: NextRequest) {
  const body = await req.json();
  const tokenRow = await getValidAlumnoToken(req);

  let alumno_id: string;
  let gym_id: string;
  const { nombre, ejercicios, notas } = body;

  if (!tokenRow) {
    // Staff/admin auth path
    alumno_id = body.alumno_id;
    gym_id = body.gym_id;
    if (!alumno_id || !gym_id) return NextResponse.json({ error: "Parámetros faltantes." }, { status: 400 });

    const supabaseServer = await createSupabaseServerClient();
    const { data: { user } } = await supabaseServer.auth.getUser();
    if (!user) {
      return NextResponse.json({ error: "No autorizado." }, { status: 401 });
    }

    const { data: ownerProfile } = await supabase
      .from("profiles")
      .select("gym_id, role")
      .eq("id", user.id)
      .maybeSingle<StaffProfile>();

    if (!ownerProfile || !["admin", "staff"].includes(ownerProfile.role ?? "") || ownerProfile.gym_id !== gym_id) {
      return NextResponse.json({ error: "No autorizado." }, { status: 401 });
    }
  } else {
    // Alumno auth path - derive identity from token
    alumno_id = tokenRow.alumno_id;
    gym_id = tokenRow.gym_id;
  }

  const { error } = await supabase.from("rutinas").upsert(
    { alumno_id, gym_id, nombre: nombre ?? "Mi Rutina", ejercicios: ejercicios ?? [], notas: notas ?? null, updated_at: new Date().toISOString() },
    { onConflict: "alumno_id" }
  );

  if (error) return NextResponse.json({ error: sanitizeError(error) }, { status: 500 });

  // Notify alumno only when staff/admin assigns (not when alumno edits their own)
  if (!tokenRow) {
    // Send in-app notification
    void createAlumnoNotification(supabase, {
      alumno_id,
      gym_id,
      type:      "rutina_asignada",
      title:     "Nueva rutina asignada",
      body:      nombre ? `Tu profe te asignó: ${nombre}` : "Tu profe actualizó tu rutina de entrenamiento.",
      link:      "/alumno/panel?tab=entrenamiento",
    });

    // Send push notification
    void sendPushNotification(
      supabase,
      alumno_id,
      PushTemplates.routineAssigned(nombre || "tu nueva rutina")
    );
  }

  return NextResponse.json({ ok: true });
}
