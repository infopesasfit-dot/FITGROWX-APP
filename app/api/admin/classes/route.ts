import { sanitizeError } from "@/lib/api-error";
import { NextRequest, NextResponse } from "next/server";
import { createSupabaseServerClient , requireUser } from "@/lib/supabase-server";
import { getSupabaseAdminClient } from "@/lib/supabase-admin";
import { createClassesSchema, patchClassSchema, parseBody } from "@/lib/schemas";

type AuthorizedProfile = {
  id: string;
  gym_id: string | null;
  role: "platform_owner" | "admin" | "staff" | string | null;
  full_name?: string | null;
  email?: string | null;
};

type AuthorizedGymProfile = Omit<AuthorizedProfile, "gym_id"> & {
  gym_id: string;
};

const admin = getSupabaseAdminClient();

async function getAuthorizedProfile(): Promise<AuthorizedGymProfile | null> {
  const supabase = await createSupabaseServerClient();
  const user = await requireUser();
  if (!user) return null;

  const { data: profile } = await admin
    .from("profiles")
    .select("id, gym_id, role, full_name, email")
    .eq("id", user.id)
    .maybeSingle<AuthorizedProfile>();

  if (!profile || !profile.gym_id || !["admin", "staff", "platform_owner"].includes(profile.role ?? "")) {
    return null;
  }

  return profile as AuthorizedGymProfile;
}

function actorName(profile: AuthorizedProfile) {
  return (
    (typeof profile.full_name === "string" && profile.full_name.trim()) ||
    (typeof profile.email === "string" && profile.email.split("@")[0]?.trim()) ||
    "Alguien del equipo"
  );
}

async function insertAuditNotification(gymId: string, title: string, body: string) {
  await admin.from("notifications").insert([{
    gym_id: gymId,
    type: "class_audit",
    title,
    body,
  }]);
}

export async function POST(req: NextRequest) {
  try {
    const profile = await getAuthorizedProfile();
    if (!profile) return NextResponse.json({ error: "No autorizado." }, { status: 401 });

    const raw = await req.json();
    const parsed = parseBody(createClassesSchema, raw);
    if (!parsed.ok) return NextResponse.json({ error: parsed.error }, { status: parsed.status });

    const safeRows = parsed.data.rows.map((row) => ({ ...row, gym_id: profile.gym_id }));
    const { error } = await admin.from("gym_classes").insert(safeRows);
    if (error) {
      console.error("[classes POST] insert error:", JSON.stringify(error));
      return NextResponse.json({ error: sanitizeError(error) }, { status: 500 });
    }

    const firstRow = safeRows[0];
    const className =
      typeof firstRow === "object" &&
      firstRow !== null &&
      "class_name" in firstRow &&
      typeof firstRow.class_name === "string"
        ? firstRow.class_name
        : "Clase";
    try {
      await insertAuditNotification(
        profile.gym_id,
        safeRows.length > 1 ? `Clases creadas: ${className}` : `Clase creada: ${className}`,
        safeRows.length > 1
          ? `${actorName(profile)} creó ${safeRows.length} clases nuevas de ${className}.`
          : `${actorName(profile)} creó la clase ${className}.`,
      );
    } catch (notifErr) {
      console.error("[classes POST] notification error:", notifErr);
    }

    return NextResponse.json({ ok: true });
  } catch (e) {
    console.error("[classes POST] unexpected error:", e);
    return NextResponse.json({ error: sanitizeError(e) }, { status: 500 });
  }
}

export async function PATCH(req: NextRequest) {
  const profile = await getAuthorizedProfile();
  if (!profile) return NextResponse.json({ error: "No autorizado." }, { status: 401 });

  const raw = await req.json();
  const parsed = parseBody(patchClassSchema, raw);
  if (!parsed.ok) return NextResponse.json({ error: parsed.error }, { status: parsed.status });
  const { id, payload } = parsed.data;

  const { data: currentClass } = await admin
    .from("gym_classes")
    .select("id, gym_id, class_name")
    .eq("id", id)
    .maybeSingle<{ id: string; gym_id: string; class_name: string }>();

  if (!currentClass || currentClass.gym_id !== profile.gym_id) {
    return NextResponse.json({ error: "Acceso denegado." }, { status: 403 });
  }

  const { error } = await admin
    .from("gym_classes")
    .update(payload)
    .eq("id", id)
    .eq("gym_id", profile.gym_id);

  if (error) return NextResponse.json({ error: sanitizeError(error) }, { status: 500 });

  const className = typeof payload.class_name === "string" ? payload.class_name : currentClass.class_name;
  await insertAuditNotification(
    profile.gym_id,
    `Clase editada: ${className}`,
    `${actorName(profile)} modificó la clase ${className}.`,
  );

  return NextResponse.json({ ok: true });
}

export async function DELETE(req: NextRequest) {
  const profile = await getAuthorizedProfile();
  if (!profile) return NextResponse.json({ error: "No autorizado." }, { status: 401 });

  const { id } = await req.json() as { id?: string };
  if (!id) return NextResponse.json({ error: "Datos inválidos." }, { status: 400 });

  const { data: currentClass } = await admin
    .from("gym_classes")
    .select("id, gym_id, class_name")
    .eq("id", id)
    .maybeSingle<{ id: string; gym_id: string; class_name: string }>();

  if (!currentClass || currentClass.gym_id !== profile.gym_id) {
    return NextResponse.json({ error: "Acceso denegado." }, { status: 403 });
  }

  const { error } = await admin
    .from("gym_classes")
    .delete()
    .eq("id", id)
    .eq("gym_id", profile.gym_id);

  if (error) return NextResponse.json({ error: sanitizeError(error) }, { status: 500 });

  await insertAuditNotification(
    profile.gym_id,
    `Clase eliminada: ${currentClass.class_name}`,
    `${actorName(profile)} eliminó la clase ${currentClass.class_name}.`,
  );

  return NextResponse.json({ ok: true });
}
