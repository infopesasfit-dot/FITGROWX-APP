import { NextRequest, NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase-server";
import { getSupabaseAdminClient } from "@/lib/supabase-admin";
import { withApiHandler } from "@/lib/api-error";
import { createAlumnoNotification } from "@/lib/alumno-notif";
import { sendPushNotification, PushTemplates } from "@/lib/alumno-push-send";
import { sendWa } from "@/lib/wa";
import { normalizePhone } from "@/lib/phone";
import { ensureGymBranding } from "@/lib/messaging-helpers";
import { z } from "zod";

const supabase = getSupabaseAdminClient();

const DEFAULT_MSG =
  "Hola {nombre} 👋\nTu coach de {gym} te asignó una rutina nueva.\nEntrá a la app desde tus accesos guardados para verla.";

const Schema = z.object({
  alumno_ids: z.array(z.string().uuid()).min(1),
  rutina: z.object({
    nombre:     z.string().min(1),
    objetivo:   z.string().optional().nullable(),
    rutinatipo: z.enum(["gym", "wod"]).default("gym"),
    ejercicios: z.array(z.unknown()),
    notas:      z.string().optional().nullable(),
  }),
});

async function handlePost(req: NextRequest): Promise<NextResponse> {
  const sessionClient = await createSupabaseServerClient();
  const { data: { user } } = await sessionClient.auth.getUser();
  if (!user) return NextResponse.json({ error: "No autorizado." }, { status: 401 });

  const { data: profile } = await supabase
    .from("profiles")
    .select("gym_id, role")
    .eq("id", user.id)
    .maybeSingle<{ gym_id: string | null; role: string | null }>();

  if (!profile?.gym_id || !["admin", "staff"].includes(profile.role ?? "")) {
    return NextResponse.json({ error: "No autorizado." }, { status: 401 });
  }

  const body = await req.json();
  const parsed = Schema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: parsed.error.message }, { status: 400 });

  const { alumno_ids, rutina } = parsed.data;
  const gym_id = profile.gym_id;
  const now = new Date().toISOString();

  const [{ data: settings }, { data: gym }] = await Promise.all([
    supabase.from("gym_settings").select("gym_name").eq("gym_id", gym_id).maybeSingle<{ gym_name: string }>(),
    supabase.from("gyms").select("name").eq("id", gym_id).maybeSingle<{ name: string }>(),
  ]);
  const gymName = settings?.gym_name || gym?.name || "tu gimnasio";

  let assigned = 0;
  let failed = 0;

  await Promise.all(alumno_ids.map(async (alumno_id) => {
    const { error } = await supabase.from("rutinas").upsert(
      {
        alumno_id,
        gym_id,
        nombre:    rutina.nombre,
        ejercicios: rutina.ejercicios,
        notas:     rutina.notas ?? null,
        updated_at: now,
      },
      { onConflict: "alumno_id" }
    );
    if (error) { failed++; return; }
    assigned++;

    void createAlumnoNotification(supabase, {
      alumno_id,
      gym_id,
      type:  "rutina_asignada",
      title: "Nueva rutina asignada",
      body:  `Tu profe te asignó: ${rutina.nombre}`,
      link:  "/alumno/panel?tab=entrenamiento",
    });

    void sendPushNotification(supabase, alumno_id, PushTemplates.routineAssigned(rutina.nombre));

    const { data: alumno } = await supabase
      .from("alumnos")
      .select("full_name, phone")
      .eq("id", alumno_id)
      .eq("is_demo", false)
      .single<{ full_name: string; phone: string | null }>();

    if (alumno?.phone) {
      const template = ensureGymBranding(DEFAULT_MSG, gymName);
      const msg = template
        .replace(/\{nombre\}/gi, alumno.full_name.split(" ")[0])
        .replace(/\{gym\}/gi, gymName);
      void sendWa(gym_id, normalizePhone(alumno.phone), msg, { route: "admin/rutinas/batch-assign" });
    }
  }));

  return NextResponse.json({ ok: true, assigned, failed });
}

export const POST = withApiHandler(handlePost);
