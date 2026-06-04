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

  const { data: alumnos } = await admin
    .from("alumnos")
    .select("full_name, phone, email, dni, status, next_expiration_date, created_at, planes(nombre)")
    .eq("gym_id", profile.gym_id)
    .eq("is_demo", false)
    .is("deleted_at", null)
    .order("full_name");

  const rows = ((alumnos ?? []) as unknown) as {
    full_name: string;
    phone: string | null;
    email: string | null;
    dni: string | null;
    status: string | null;
    next_expiration_date: string | null;
    created_at: string;
    planes: { nombre: string } | null;
  }[];

  const header = ["Nombre", "Teléfono", "Email", "DNI", "Plan", "Estado", "Vencimiento", "Fecha de alta"];
  const escape = (v: string | null | undefined) => {
    const s = String(v ?? "");
    return s.includes(",") || s.includes('"') || s.includes("\n")
      ? `"${s.replace(/"/g, '""')}"`
      : s;
  };

  const lines = [
    header.join(","),
    ...rows.map(a =>
      [
        escape(a.full_name),
        escape(a.phone),
        escape(a.email),
        escape(a.dni),
        escape(a.planes?.nombre),
        escape(a.status),
        escape(a.next_expiration_date?.slice(0, 10)),
        escape(a.created_at?.slice(0, 10)),
      ].join(",")
    ),
  ];

  const csv = lines.join("\r\n");
  const filename = `alumnos-${new Date().toISOString().slice(0, 10)}.csv`;

  return new NextResponse(csv, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="${filename}"`,
    },
  });
}
