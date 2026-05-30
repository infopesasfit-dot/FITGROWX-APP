import { NextRequest, NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase-server";
import { getSupabaseAdminClient } from "@/lib/supabase-admin";
import { applyRateLimit } from "@/lib/request-security";

type AlumnoRow = { id?: any; full_name?: any; phone?: any; email?: any; status?: any; planes?: any; next_expiration_date?: any; created_at?: any };
type PagoRow = { id?: any; date?: any; alumnos?: any; alumno_id?: any; amount?: any; method?: any; status?: any; concepto?: any };
type AsistenciaRow = { id?: any; alumnos?: any; alumno_id?: any; fecha?: any };
type RutinaRow = { id?: any; alumnos?: any; alumno_id?: any; nombre?: any; ejercicios?: any; updated_at?: any };
type PlanRow = { nombre?: string; precio?: number; periodo?: string; duracion_dias?: string };
type ProspectoRow = { full_name?: string; phone?: string; email?: string; status?: string; created_at?: string };
type EgresoRow = { fecha?: string; concepto?: string; categoria?: string; monto?: number };

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
    const { Workbook } = await import("exceljs");
    const wb = new Workbook();
    const dateStr = new Date().toISOString().slice(0, 10);

    function addSheet(name: string, rows: Record<string, unknown>[]) {
      const ws = wb.addWorksheet(name);
      ws.columns = Object.keys(rows[0]).map((k) => ({ header: k, key: k, width: 22 }));
      ws.addRows(rows);
    }

    // ── Alumnos ──────────────────────────────────────────────────────────────
    const alumnosRows = (alumnos ?? []).map((a: AlumnoRow) => ({
      Nombre: a.full_name ?? "",
      Teléfono: a.phone ?? "",
      Email: a.email ?? "",
      Estado: a.status ?? "",
      Plan: a.planes?.[0]?.nombre ?? "",
      Vencimiento: a.next_expiration_date ?? "",
      "Fecha de alta": a.created_at ? a.created_at.slice(0, 10) : "",
    }));
    addSheet("Alumnos", alumnosRows.length ? alumnosRows : [{ Nombre: "", Teléfono: "", Email: "", Estado: "", Plan: "", Vencimiento: "", "Fecha de alta": "" }]);

    // ── Pagos ─────────────────────────────────────────────────────────────────
    const pagosRows = (pagos ?? []).map((p: PagoRow) => ({
      Fecha: p.date ?? "",
      Alumno: p.alumnos?.full_name ?? p.alumno_id ?? "",
      Monto: p.amount ?? 0,
      Método: p.method ?? "",
      Estado: p.status ?? "",
      Concepto: p.concepto ?? "",
    }));
    addSheet("Pagos", pagosRows.length ? pagosRows : [{ Fecha: "", Alumno: "", Monto: 0, Método: "", Estado: "", Concepto: "" }]);

    // ── Asistencias ───────────────────────────────────────────────────────────
    const asistenciasRows = (asistencias ?? []).map((a: AsistenciaRow) => ({
      Alumno: a.alumnos?.full_name ?? a.alumno_id ?? "",
      Fecha: a.fecha ?? "",
    }));
    addSheet("Asistencias", asistenciasRows.length ? asistenciasRows : [{ Alumno: "", Fecha: "" }]);

    // ── Rutinas ───────────────────────────────────────────────────────────────
    const rutinasRows = (rutinas ?? []).map((r: RutinaRow) => ({
      Alumno: r.alumnos?.full_name ?? r.alumno_id ?? "",
      "Nombre rutina": r.nombre ?? "",
      Ejercicios: Array.isArray(r.ejercicios) ? r.ejercicios.map((e: Record<string, unknown>) => (e.nombre as string | undefined) ?? (e.name as string | undefined) ?? JSON.stringify(e)).join(", ") : JSON.stringify(r.ejercicios ?? []),
      "Última actualización": r.updated_at ? r.updated_at.slice(0, 10) : "",
    }));
    addSheet("Rutinas", rutinasRows.length ? rutinasRows : [{ Alumno: "", "Nombre rutina": "", Ejercicios: "", "Última actualización": "" }]);

    // ── Planes ────────────────────────────────────────────────────────────────
    const planesRows = (planes ?? []).map((p: PlanRow) => ({
      Nombre: p.nombre ?? "",
      Precio: p.precio ?? 0,
      Período: p.periodo ?? "",
      "Duración (días)": p.duracion_dias ?? "",
    }));
    addSheet("Planes", planesRows.length ? planesRows : [{ Nombre: "", Precio: 0, Período: "", "Duración (días)": "" }]);

    // ── Prospectos ────────────────────────────────────────────────────────────
    const prospectosRows = (prospectos ?? []).map((p: ProspectoRow) => ({
      Nombre: p.full_name ?? "",
      Teléfono: p.phone ?? "",
      Email: p.email ?? "",
      Estado: p.status ?? "",
      Fecha: p.created_at ? p.created_at.slice(0, 10) : "",
    }));
    addSheet("Prospectos", prospectosRows.length ? prospectosRows : [{ Nombre: "", Teléfono: "", Email: "", Estado: "", Fecha: "" }]);

    // ── Egresos ───────────────────────────────────────────────────────────────
    const egresosRows = (egresos ?? []).map((e: EgresoRow) => ({
      Fecha: e.fecha ?? "",
      Concepto: e.concepto ?? "",
      Categoría: e.categoria ?? "",
      Monto: e.monto ?? 0,
    }));
    addSheet("Egresos", egresosRows.length ? egresosRows : [{ Fecha: "", Concepto: "", Categoría: "", Monto: 0 }]);

    const buffer = Buffer.from(await wb.xlsx.writeBuffer());
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
