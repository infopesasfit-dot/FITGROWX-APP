import { NextRequest, NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase-server";
import { getSupabaseAdminClient } from "@/lib/supabase-admin";
import { applyRateLimit } from "@/lib/request-security";
import * as XLSX from "xlsx";

export async function GET(req: NextRequest) {
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
  const format = req.nextUrl.searchParams.get("format");

  const [
    { data: gymSettings },
    { data: alumnos },
    { data: pagos },
    { data: planes },
    { data: prospectos },
    { data: egresos },
    { data: rutinas },
    { data: asistencias },
  ] = await Promise.all([
    admin.from("gym_settings").select("gym_name, owner_name, email, whatsapp, slug").eq("gym_id", gymId).maybeSingle(),
    admin.from("alumnos").select("id, full_name, phone, email, status, next_expiration_date, created_at, planes!plan_id(nombre)").eq("gym_id", gymId).is("deleted_at", null).order("full_name"),
    admin.from("pagos").select("id, alumno_id, amount, method, status, date, concepto, alumnos!alumno_id(full_name)").eq("gym_id", gymId).order("date", { ascending: false }),
    admin.from("planes").select("id, nombre, precio, periodo, duracion_dias").eq("gym_id", gymId),
    admin.from("prospectos").select("id, full_name, phone, email, status, created_at").eq("gym_id", gymId).order("created_at", { ascending: false }),
    admin.from("egresos").select("id, monto, concepto, fecha, categoria").eq("gym_id", gymId).order("fecha", { ascending: false }),
    admin.from("rutinas").select("alumno_id, nombre, ejercicios, updated_at, alumnos!alumno_id(full_name)").eq("gym_id", gymId),
    admin.from("asistencias").select("alumno_id, fecha, alumnos!alumno_id(full_name)").eq("gym_id", gymId).order("fecha", { ascending: false }),
  ]);

  if (format === "xlsx") {
    const wb = XLSX.utils.book_new();
    const dateStr = new Date().toISOString().slice(0, 10);

    // ── Alumnos ──────────────────────────────────────────────────────────────
    const alumnosRows = (alumnos ?? []).map((a: any) => ({
      Nombre: a.full_name ?? "",
      Teléfono: a.phone ?? "",
      Email: a.email ?? "",
      Estado: a.status ?? "",
      Plan: (a.planes as any)?.nombre ?? "",
      Vencimiento: a.next_expiration_date ?? "",
      "Fecha de alta": a.created_at ? a.created_at.slice(0, 10) : "",
    }));
    XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(alumnosRows), "Alumnos");

    // ── Pagos ─────────────────────────────────────────────────────────────────
    const pagosRows = (pagos ?? []).map((p: any) => ({
      Fecha: p.date ?? "",
      Alumno: (p.alumnos as any)?.full_name ?? p.alumno_id ?? "",
      Monto: p.amount ?? 0,
      Método: p.method ?? "",
      Estado: p.status ?? "",
      Concepto: p.concepto ?? "",
    }));
    XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(pagosRows), "Pagos");

    // ── Asistencias ───────────────────────────────────────────────────────────
    const asistenciasRows = (asistencias ?? []).map((a: any) => ({
      Alumno: (a.alumnos as any)?.full_name ?? a.alumno_id ?? "",
      Fecha: a.fecha ?? "",
    }));
    XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(asistenciasRows.length ? asistenciasRows : [{ Alumno: "", Fecha: "" }]), "Asistencias");

    // ── Rutinas ───────────────────────────────────────────────────────────────
    const rutinasRows = (rutinas ?? []).map((r: any) => ({
      Alumno: (r.alumnos as any)?.full_name ?? r.alumno_id ?? "",
      "Nombre rutina": r.nombre ?? "",
      Ejercicios: Array.isArray(r.ejercicios) ? r.ejercicios.map((e: any) => e.nombre ?? e.name ?? JSON.stringify(e)).join(", ") : JSON.stringify(r.ejercicios ?? []),
      "Última actualización": r.updated_at ? r.updated_at.slice(0, 10) : "",
    }));
    XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(rutinasRows.length ? rutinasRows : [{ Alumno: "", "Nombre rutina": "", Ejercicios: "", "Última actualización": "" }]), "Rutinas");

    // ── Planes ────────────────────────────────────────────────────────────────
    const planesRows = (planes ?? []).map((p: any) => ({
      Nombre: p.nombre ?? "",
      Precio: p.precio ?? 0,
      Período: p.periodo ?? "",
      "Duración (días)": p.duracion_dias ?? "",
    }));
    XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(planesRows.length ? planesRows : [{ Nombre: "", Precio: 0, Período: "", "Duración (días)": "" }]), "Planes");

    // ── Prospectos ────────────────────────────────────────────────────────────
    const prospectosRows = (prospectos ?? []).map((p: any) => ({
      Nombre: p.full_name ?? "",
      Teléfono: p.phone ?? "",
      Email: p.email ?? "",
      Estado: p.status ?? "",
      Fecha: p.created_at ? p.created_at.slice(0, 10) : "",
    }));
    XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(prospectosRows.length ? prospectosRows : [{ Nombre: "", Teléfono: "", Email: "", Estado: "", Fecha: "" }]), "Prospectos");

    // ── Egresos ───────────────────────────────────────────────────────────────
    const egresosRows = (egresos ?? []).map((e: any) => ({
      Fecha: e.fecha ?? "",
      Concepto: e.concepto ?? "",
      Categoría: e.categoria ?? "",
      Monto: e.monto ?? 0,
    }));
    XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(egresosRows.length ? egresosRows : [{ Fecha: "", Concepto: "", Categoría: "", Monto: 0 }]), "Egresos");

    const buffer = XLSX.write(wb, { type: "buffer", bookType: "xlsx" });
    const filename = `fitgrowx-${gymSettings?.gym_name?.replace(/\s+/g, "-").toLowerCase() ?? "datos"}-${dateStr}.xlsx`;

    return new NextResponse(buffer, {
      headers: {
        "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        "Content-Disposition": `attachment; filename="${filename}"`,
      },
    });
  }

  // ── JSON fallback ─────────────────────────────────────────────────────────
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
