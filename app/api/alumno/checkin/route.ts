import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY ?? process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

export async function POST(req: NextRequest) {
  const { qr_data } = await req.json();

  // QR format: "FITGROWX:{DNI}"
  if (!qr_data || !qr_data.startsWith("FITGROWX:")) {
    return NextResponse.json({ ok: false, error: "QR inválido." }, { status: 400 });
  }

  const dni = qr_data.slice("FITGROWX:".length).trim();
  if (!dni) return NextResponse.json({ ok: false, error: "QR inválido." }, { status: 400 });

  const { data: alumno, error } = await supabase
    .from("alumnos")
    .select("id, gym_id, full_name, status, phone, planes(nombre, accent_color), next_expiration_date")
    .eq("dni", dni)
    .single();

  if (error || !alumno) {
    return NextResponse.json({ ok: false, error: "Alumno no encontrado." }, { status: 404 });
  }

  const today = new Date().toISOString().slice(0, 10);
  const alumno_id = alumno.id;

  // Check if already checked in today
  const { data: existing } = await supabase
    .from("asistencias")
    .select("id, hora")
    .eq("alumno_id", alumno_id)
    .eq("fecha", today)
    .maybeSingle();

  if (existing) {
    return NextResponse.json({
      ok: true,
      already: true,
      alumno: {
        full_name: alumno.full_name,
        plan: (alumno.planes as { nombre: string } | null)?.nombre ?? null,
        status: alumno.status,
        expiration: alumno.next_expiration_date,
      },
      hora: existing.hora,
    });
  }

  const now = new Date();
  const hora = now.toTimeString().slice(0, 8);

  const { error: insErr } = await supabase.from("asistencias").insert({
    gym_id: alumno.gym_id,
    alumno_id,
    fecha: today,
    hora,
  });

  if (insErr) {
    return NextResponse.json({ ok: false, error: "Error al registrar." }, { status: 500 });
  }

  return NextResponse.json({
    ok: true,
    already: false,
    alumno: {
      full_name: alumno.full_name,
      plan: (alumno.planes as { nombre: string } | null)?.nombre ?? null,
      status: alumno.status,
      expiration: alumno.next_expiration_date,
    },
    hora,
  });
}
