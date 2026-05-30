import { NextRequest, NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase-server";
import { getSupabaseAdminClient } from "@/lib/supabase-admin";
import { getGymPlanStatus } from "@/lib/gym-plan-status";
import { z } from "zod";

const admin = getSupabaseAdminClient();

const rowSchema = z.object({
  full_name: z.string().min(2).max(120),
  phone: z.string().max(40).nullable().optional(),
  dni: z.string().regex(/^\d{6,9}$/).nullable().optional(),
});

const bodySchema = z.object({
  rows: z.array(rowSchema).min(1).max(500),
});

export async function POST(req: NextRequest) {
  const supabase = await createSupabaseServerClient();
  const { data: { user }, error: authError } = await supabase.auth.getUser();
  if (authError || !user) return NextResponse.json({ ok: false, error: "No autenticado." }, { status: 401 });

  const { data: profile } = await admin
    .from("profiles")
    .select("gym_id, role")
    .eq("id", user.id)
    .maybeSingle();

  if (!profile?.gym_id || !["admin", "staff"].includes(profile.role ?? "")) {
    return NextResponse.json({ ok: false, error: "No autorizado." }, { status: 403 });
  }

  const gymId = profile.gym_id;

  const body = await req.json().catch(() => null);
  const parsed = bodySchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ ok: false, error: parsed.error.issues[0]?.message ?? "Datos inválidos." }, { status: 400 });
  }

  const { rows } = parsed.data;

  // Verificar plan
  const plan = await getGymPlanStatus(gymId);
  if (plan.is_blocked) {
    return NextResponse.json({ ok: false, error: plan.message }, { status: 422 });
  }

  // Verificar límite teniendo en cuenta el batch a importar
  if (plan.alumno_limit !== null) {
    const { count } = await admin
      .from("alumnos")
      .select("id", { count: "exact", head: true })
      .eq("gym_id", gymId)
      .is("deleted_at", null);
    const currentCount = count ?? 0;
    if (currentCount + rows.length > plan.alumno_limit) {
      const disponibles = Math.max(0, plan.alumno_limit - currentCount);
      return NextResponse.json({
        ok: false,
        error: `Tu plan permite hasta ${plan.alumno_limit} alumnos. Tenés ${currentCount} y solo podés importar ${disponibles} más. Suscribite a Pro para importar todos.`,
      }, { status: 422 });
    }
  }

  // Detectar teléfonos ya existentes en el gym (para aviso, no para bloqueo)
  const phones = rows.map(r => r.phone).filter((p): p is string => !!p);
  let existingPhones: string[] = [];
  if (phones.length > 0) {
    const { data: existing } = await admin
      .from("alumnos")
      .select("phone")
      .eq("gym_id", gymId)
      .is("deleted_at", null)
      .in("phone", phones);
    existingPhones = (existing ?? []).map(e => e.phone).filter((p): p is string => !!p);
  }

  // Insertar en chunks de 50
  const inserted: { id: string; full_name: string; phone: string | null }[] = [];
  const CHUNK = 50;
  for (let i = 0; i < rows.length; i += CHUNK) {
    const slice = rows.slice(i, i + CHUNK).map(r => ({
      gym_id: gymId,
      full_name: r.full_name,
      phone: r.phone ?? null,
      dni: r.dni ?? null,
      status: "activo" as const,
    }));
    const { data, error } = await admin
      .from("alumnos")
      .insert(slice)
      .select("id, full_name, phone");
    if (error) {
      return NextResponse.json({
        ok: false,
        error: error.code === "23505"
          ? "Hay alumnos con DNI duplicado en el archivo o ya existen."
          : `Error al insertar: ${error.message}`,
        inserted_count: inserted.length,
      }, { status: 400 });
    }
    if (data) inserted.push(...data);
  }

  return NextResponse.json({
    ok: true,
    inserted_count: inserted.length,
    inserted,
    duplicate_phones: existingPhones,
  });
}
