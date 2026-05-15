import { sanitizeError } from "@/lib/api-error";
import { NextRequest, NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase-server";
import { getSupabaseAdminClient } from "@/lib/supabase-admin";
import { getTodayDate } from "@/lib/date-utils";

const admin = getSupabaseAdminClient();

async function getAdminGymId(req: NextRequest): Promise<string | null> {
  const supabase = await createSupabaseServerClient();
  const { data: { session } } = await supabase.auth.getSession();
  if (!session?.user) return null;
  const { data: profile } = await admin
    .from("profiles")
    .select("gym_id, role")
    .eq("id", session.user.id)
    .maybeSingle();
  if (!profile?.gym_id || !["admin", "staff"].includes(profile.role ?? "")) return null;
  return profile.gym_id;
}

// POST /api/admin/alumnos/freeze  { alumno_id, dias }
export async function POST(req: NextRequest) {
  const gymId = await getAdminGymId(req);
  if (!gymId) return NextResponse.json({ error: "No autorizado." }, { status: 401 });

  const body = await req.json() as { alumno_id?: string; dias?: number };
  const { alumno_id, dias } = body;
  if (!alumno_id || !dias || dias < 1 || dias > 365) {
    return NextResponse.json({ error: "alumno_id y dias (1-365) son requeridos." }, { status: 400 });
  }

  const { data: alumno, error: fetchErr } = await admin
    .from("alumnos")
    .select("id, status, gym_id")
    .eq("id", alumno_id)
    .eq("gym_id", gymId)
    .maybeSingle();

  if (fetchErr || !alumno) return NextResponse.json({ error: "Alumno no encontrado." }, { status: 404 });
  if (alumno.status === "pausado") return NextResponse.json({ error: "El alumno ya está congelado." }, { status: 409 });

  const today = getTodayDate();
  const pausaHasta = new Date(`${today}T12:00:00`);
  pausaHasta.setDate(pausaHasta.getDate() + dias);
  const pausaHastaStr = `${pausaHasta.getFullYear()}-${String(pausaHasta.getMonth() + 1).padStart(2, "0")}-${String(pausaHasta.getDate()).padStart(2, "0")}`;

  const { error } = await admin
    .from("alumnos")
    .update({ status: "pausado", frozen_since: today, pausa_hasta: pausaHastaStr })
    .eq("id", alumno_id);

  if (error) return NextResponse.json({ error: sanitizeError(error) }, { status: 500 });
  return NextResponse.json({ ok: true, frozen_since: today, pausa_hasta: pausaHastaStr });
}

// DELETE /api/admin/alumnos/freeze  { alumno_id }
export async function DELETE(req: NextRequest) {
  const gymId = await getAdminGymId(req);
  if (!gymId) return NextResponse.json({ error: "No autorizado." }, { status: 401 });

  const body = await req.json() as { alumno_id?: string };
  const { alumno_id } = body;
  if (!alumno_id) return NextResponse.json({ error: "alumno_id es requerido." }, { status: 400 });

  const { data: alumno, error: fetchErr } = await admin
    .from("alumnos")
    .select("id, status, gym_id, frozen_since, next_expiration_date")
    .eq("id", alumno_id)
    .eq("gym_id", gymId)
    .maybeSingle();

  if (fetchErr || !alumno) return NextResponse.json({ error: "Alumno no encontrado." }, { status: 404 });
  if (alumno.status !== "pausado") return NextResponse.json({ error: "El alumno no está congelado." }, { status: 409 });

  const today = getTodayDate();
  const frozenSince = alumno.frozen_since ?? today;
  const diasCongelados = Math.max(
    0,
    Math.round((new Date(`${today}T12:00:00`).getTime() - new Date(`${frozenSince}T12:00:00`).getTime()) / 86_400_000),
  );

  let newExpiration = alumno.next_expiration_date ?? null;
  if (newExpiration && diasCongelados > 0) {
    const d = new Date(`${newExpiration}T12:00:00`);
    d.setDate(d.getDate() + diasCongelados);
    newExpiration = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
  }

  const { error } = await admin
    .from("alumnos")
    .update({
      status: "activo",
      frozen_since: null,
      pausa_hasta: null,
      ...(newExpiration ? { next_expiration_date: newExpiration } : {}),
    })
    .eq("id", alumno_id);

  if (error) return NextResponse.json({ error: sanitizeError(error) }, { status: 500 });
  return NextResponse.json({ ok: true, dias_congelados: diasCongelados, next_expiration_date: newExpiration });
}
