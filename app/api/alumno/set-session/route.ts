import { NextRequest, NextResponse } from "next/server";
import { createHash } from "crypto";
import { getSupabaseAdminClient } from "@/lib/supabase-admin";
import { getPlanNombre } from "@/lib/supabase-relations";
import { setAlumnoSessionCookie } from "@/lib/alumno-session";
import { logAlumnoAction, getClientIpFromRequest } from "@/lib/alumno-logging";

const supabase = getSupabaseAdminClient();

export async function POST(req: NextRequest) {
  const { token } = await req.json();
  const ip = await getClientIpFromRequest(req);
  if (!token) return NextResponse.json({ error: "Token requerido." }, { status: 400 });

  const tokenHash  = createHash("sha256").update(String(token)).digest("hex");
  const now        = new Date().toISOString();
  const thirtyDays = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString();

  const { data: tokenRow, error } = await supabase
    .from("alumno_tokens")
    .select("id, alumno_id, gym_id")
    .eq("token", tokenHash)
    .gt("expires_at", now)
    .single();

  if (error || !tokenRow) {
    console.warn("[auth] login_failed", { reason: "Invalid token", ip });
    return NextResponse.json({ error: "Enlace inválido o expirado." }, { status: 401 });
  }

  // Token válido. Extendemos expires_at a 30 días desde este uso.
  // No marcamos used_at — el link puede reutilizarse mientras no expire.
  const { error: updateError } = await supabase
    .from("alumno_tokens")
    .update({ expires_at: thirtyDays })
    .eq("id", tokenRow.id);

  if (updateError) {
    console.warn("[auth] login_failed", { reason: "DB update failed", ip });
    return NextResponse.json({ error: "Error al procesar el ingreso." }, { status: 500 });
  }

  const { data: alumno } = await supabase
    .from("alumnos")
    .select("id, dni, full_name, phone, status, plan_id, next_expiration_date, planes!plan_id(nombre, accent_color, precio)")
    .eq("id", tokenRow.alumno_id)
    .is("deleted_at", null)
    .single();

  await logAlumnoAction({
    alumno_id: tokenRow.alumno_id,
    gym_id: tokenRow.gym_id,
    action: "login_success",
    status: "success",
    ip_address: ip,
  });

  const res = NextResponse.json({
    ok: true,
    alumno: {
      alumno_id: alumno?.id,
      gym_id: tokenRow.gym_id,
      full_name: alumno?.full_name,
      status: alumno?.status,
      plan: getPlanNombre(alumno?.planes),
      expiration: alumno?.next_expiration_date ?? null,
      dni: alumno?.dni ?? null,
    },
  });

  return setAlumnoSessionCookie(res, token);
}
