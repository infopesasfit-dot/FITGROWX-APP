import { NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase-server";
import { getSupabaseAdminClient } from "@/lib/supabase-admin";
import { applyRateLimit } from "@/lib/request-security";

export async function GET() {
  const supabase = await createSupabaseServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "No autorizado." }, { status: 401 });

  const limit = await applyRateLimit({ namespace: "export", identifier: user.id, windowMs: 60_000, maxAttempts: 5 });
  if (!limit.allowed) return NextResponse.json({ error: "Demasiadas exportaciones. Esperá 1 minuto." }, { status: 429 });

  const admin = getSupabaseAdminClient();

  const { data: profile } = await admin
    .from("profiles")
    .select("gym_id, role")
    .eq("id", user.id)
    .maybeSingle();

  if (!profile?.gym_id || !["admin", "platform_owner"].includes(profile.role ?? "")) {
    return NextResponse.json({ error: "Acceso denegado." }, { status: 403 });
  }

  const gymId = profile.gym_id;

  const [
    { data: gymSettings },
    { data: alumnos },
    { data: pagos },
    { data: planes },
    { data: prospectos },
    { data: egresos },
  ] = await Promise.all([
    admin.from("gym_settings").select("gym_name, owner_name, email, whatsapp, slug").eq("gym_id", gymId).maybeSingle(),
    admin.from("alumnos").select("id, full_name, phone, email, status, next_expiration_date, created_at").eq("gym_id", gymId).is("deleted_at", null).order("full_name"),
    admin.from("pagos").select("id, alumno_id, amount, method, status, date, concepto").eq("gym_id", gymId).order("date", { ascending: false }),
    admin.from("planes").select("id, nombre, precio, periodo, duracion_dias").eq("gym_id", gymId),
    admin.from("prospectos").select("id, full_name, phone, email, status, created_at").eq("gym_id", gymId).order("created_at", { ascending: false }),
    admin.from("egresos").select("id, monto, concepto, fecha, categoria").eq("gym_id", gymId).order("fecha", { ascending: false }),
  ]);

  const payload = {
    exported_at: new Date().toISOString(),
    gym: gymSettings,
    alumnos: alumnos ?? [],
    pagos: pagos ?? [],
    planes: planes ?? [],
    prospectos: prospectos ?? [],
    egresos: egresos ?? [],
  };

  const filename = `fitgrowx-datos-${new Date().toISOString().slice(0, 10)}.json`;

  return new NextResponse(JSON.stringify(payload, null, 2), {
    headers: {
      "Content-Type": "application/json",
      "Content-Disposition": `attachment; filename="${filename}"`,
    },
  });
}
