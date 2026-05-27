import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { getPlanNombre } from "@/lib/supabase-relations";
import { getValidAlumnoToken } from "@/lib/alumno-token";
import { withApiHandler } from "@/lib/api-error";
import { getGymPlanStatus } from "@/lib/gym-plan-status";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export const GET = withApiHandler(async function GET(req: NextRequest) {
  const tokenRow = await getValidAlumnoToken(req);
  if (!tokenRow) return NextResponse.json({ error: "No autorizado." }, { status: 401 });

  const plan = await getGymPlanStatus(tokenRow.gym_id);
  if (plan.is_blocked) {
    return NextResponse.json({
      error: "Este gimnasio no está disponible temporalmente. Contactá a tu profesor.",
      gym_blocked: true,
    }, { status: 403 });
  }

  const { data, error } = await supabase
    .from("alumnos")
    .select("id, dni, gym_id, full_name, status, next_expiration_date, deuda_pendiente, planes!plan_id(nombre)")
    .eq("id", tokenRow.alumno_id)
    .eq("gym_id", tokenRow.gym_id)
    .is("deleted_at", null)
    .single();

  if (error || !data) return NextResponse.json({ error: "Alumno no encontrado." }, { status: 404 });

  return NextResponse.json({
    alumno_id:  data.id,
    dni:        data.dni ?? null,
    gym_id:     data.gym_id,
    full_name:  data.full_name,
    status:          data.status,
    plan:            getPlanNombre(data.planes),
    expiration:      data.next_expiration_date ?? null,
    deuda_pendiente: data.deuda_pendiente ?? 0,
  });
});
