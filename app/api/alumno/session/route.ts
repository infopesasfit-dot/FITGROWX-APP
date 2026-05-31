import { NextRequest, NextResponse } from "next/server";
import { getValidAlumnoToken } from "@/lib/alumno-token";
import { getSupabaseAdminClient } from "@/lib/supabase-admin";
import { getPlanNombre } from "@/lib/supabase-relations";
import { getGymPlanStatus } from "@/lib/gym-plan-status";

const supabase = getSupabaseAdminClient();

export async function GET(req: NextRequest) {
  const tokenRow = await getValidAlumnoToken(req);
  if (!tokenRow) return NextResponse.json({ error: "No autorizado." }, { status: 401 });

  const plan = await getGymPlanStatus(tokenRow.gym_id);
  if (plan.is_blocked) {
    return NextResponse.json({
      error: "Este gimnasio no está disponible temporalmente. Contactá a tu profesor.",
      gym_blocked: true,
    }, { status: 403 });
  }

  const { data: alumno } = await supabase
    .from("alumnos")
    .select("id, dni, full_name, status, plan_id, next_expiration_date, deuda_pendiente, email, phone, avatar_url, planes!plan_id(nombre)")
    .eq("id", tokenRow.alumno_id)
    .eq("gym_id", tokenRow.gym_id)
    .single();

  if (!alumno) return NextResponse.json({ error: "Alumno no encontrado." }, { status: 404 });

  return NextResponse.json({
    alumno_id: alumno.id,
    gym_id: tokenRow.gym_id,
    full_name: alumno.full_name,
    status: alumno.status,
    plan: getPlanNombre(alumno.planes),
    expiration: alumno.next_expiration_date ?? null,
    dni: alumno.dni ?? null,
    deuda_pendiente: alumno.deuda_pendiente ?? 0,
    email: alumno.email ?? null,
    phone: alumno.phone ?? null,
    avatar_url: alumno.avatar_url ?? null,
  });
}
