import { NextRequest, NextResponse } from "next/server";
import { getValidAlumnoToken, type AlumnoTokenRow } from "@/lib/alumno-token";
import { getGymPlanStatus } from "@/lib/gym-plan-status";
import { getSupabaseAdminClient } from "@/lib/supabase-admin";

type Options = {
  allowDemo?: boolean;
  checkGym?: boolean;
};

export async function assertAlumnoActionAllowed(
  tokenRow: AlumnoTokenRow,
  options: Options = {},
): Promise<NextResponse | null> {
  const { allowDemo = false, checkGym = true } = options;

  if (checkGym) {
    const plan = await getGymPlanStatus(tokenRow.gym_id);
    if (plan.is_blocked) {
      return NextResponse.json({
        error: "Este gimnasio no está disponible temporalmente. Contactá a tu profesor.",
        gym_blocked: true,
      }, { status: 403 });
    }
  }

  const supabase = getSupabaseAdminClient();
  const { data: alumno } = await supabase
    .from("alumnos")
    .select("id, is_demo")
    .eq("id", tokenRow.alumno_id)
    .eq("gym_id", tokenRow.gym_id)
    .is("deleted_at", null)
    .maybeSingle();

  if (!alumno) {
    return NextResponse.json({ error: "Alumno no encontrado." }, { status: 404 });
  }

  if (!allowDemo && alumno.is_demo) {
    return NextResponse.json({
      error: "Modo preview: esta acción no está habilitada.",
      preview_blocked: true,
    }, { status: 403 });
  }

  return null;
}

export async function requireAlumnoActionAllowed(
  req: NextRequest,
  options: Options = {},
): Promise<{ tokenRow: AlumnoTokenRow } | { response: NextResponse }> {
  const tokenRow = await getValidAlumnoToken(req);
  if (!tokenRow) return { response: NextResponse.json({ error: "No autorizado." }, { status: 401 }) };

  const blocked = await assertAlumnoActionAllowed(tokenRow, options);
  if (blocked) return { response: blocked };

  return { tokenRow };
}
