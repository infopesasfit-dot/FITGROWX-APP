import { sanitizeError } from "@/lib/api-error";
import { NextRequest, NextResponse } from "next/server";
import { getValidAlumnoToken } from "@/lib/alumno-token";
import { getSupabaseAdminClient } from "@/lib/supabase-admin";

const BUCKET = "progreso-fotos";
const SIGNED_URL_TTL = 60 * 60 * 6; // 6 hours

const supabase = getSupabaseAdminClient();

export async function GET(req: NextRequest) {
  const tokenRow = await getValidAlumnoToken(req);
  if (!tokenRow) return NextResponse.json({ error: "No autorizado." }, { status: 401 });

  const { searchParams } = new URL(req.url);
  const alumno_id = searchParams.get("alumno_id");
  if (!alumno_id) return NextResponse.json({ error: "alumno_id requerido." }, { status: 400 });
  if (tokenRow.alumno_id !== alumno_id) return NextResponse.json({ error: "Acceso denegado." }, { status: 403 });

  const { data: rows, error } = await supabase
    .from("progreso_fotos")
    .select("id, storage_path, fecha, notas, privada, created_at")
    .eq("alumno_id", alumno_id)
    .order("fecha", { ascending: false })
    .limit(60);

  if (error) return NextResponse.json({ error: sanitizeError(error) }, { status: 500 });
  if (!rows?.length) return NextResponse.json({ fotos: [] });

  const fotos = await Promise.all(
    rows.map(async (row) => {
      const { data } = await supabase.storage
        .from(BUCKET)
        .createSignedUrl(row.storage_path, SIGNED_URL_TTL);
      return { id: row.id, foto_url: data?.signedUrl ?? null, fecha: row.fecha, notas: row.notas, privada: row.privada ?? true };
    })
  );

  return NextResponse.json({ fotos: fotos.filter(f => f.foto_url) });
}

export async function POST(req: NextRequest) {
  const tokenRow = await getValidAlumnoToken(req);
  if (!tokenRow) return NextResponse.json({ error: "No autorizado." }, { status: 401 });

  let formData: FormData;
  try { formData = await req.formData(); }
  catch { return NextResponse.json({ error: "Formato inválido." }, { status: 400 }); }

  const file     = formData.get("file")     as File   | null;
  const alumno_id = formData.get("alumno_id") as string | null;
  const gym_id    = formData.get("gym_id")    as string | null;
  const fecha     = (formData.get("fecha")  as string | null) ?? new Date().toISOString().slice(0, 10);
  const notas     = (formData.get("notas")  as string | null) ?? null;
  const privada   = formData.get("privada") !== "false"; // default true

  if (!file || !alumno_id || !gym_id) return NextResponse.json({ error: "Parámetros faltantes." }, { status: 400 });
  if (file.size > 1_500_000) return NextResponse.json({ error: "La imagen pesa más de 1.5 MB. Intentá con una foto más chica." }, { status: 413 });
  if (tokenRow.alumno_id !== alumno_id || tokenRow.gym_id !== gym_id) {
    return NextResponse.json({ error: "Acceso denegado." }, { status: 403 });
  }

  const ext = file.type.includes("png") ? "png" : file.type.includes("webp") ? "webp" : "jpg";
  const storagePath = `${gym_id}/${alumno_id}/${Date.now()}.${ext}`;
  const bytes = await file.arrayBuffer();

  const { error: storageError } = await supabase.storage
    .from(BUCKET)
    .upload(storagePath, bytes, { contentType: file.type, upsert: false });

  if (storageError) return NextResponse.json({ error: storageError.message }, { status: 500 });

  const { data: row, error: dbError } = await supabase
    .from("progreso_fotos")
    .insert({ alumno_id, gym_id, storage_path: storagePath, fecha, notas, privada })
    .select("id, fecha, notas, privada")
    .single();

  if (dbError) {
    await supabase.storage.from(BUCKET).remove([storagePath]);
    return NextResponse.json({ error: dbError.message }, { status: 500 });
  }

  const { data: signed } = await supabase.storage.from(BUCKET).createSignedUrl(storagePath, SIGNED_URL_TTL);

  return NextResponse.json({ ok: true, foto: { id: row.id, foto_url: signed?.signedUrl ?? null, fecha: row.fecha, notas: row.notas, privada: row.privada } });
}

export async function PATCH(req: NextRequest) {
  const tokenRow = await getValidAlumnoToken(req);
  if (!tokenRow) return NextResponse.json({ error: "No autorizado." }, { status: 401 });

  const { foto_id, alumno_id, privada } = await req.json();
  if (!foto_id || !alumno_id || typeof privada !== "boolean") {
    return NextResponse.json({ error: "Parámetros faltantes." }, { status: 400 });
  }
  if (tokenRow.alumno_id !== alumno_id) return NextResponse.json({ error: "Acceso denegado." }, { status: 403 });

  // Verify ownership before update
  const { data: existing } = await supabase
    .from("progreso_fotos")
    .select("id")
    .eq("id", foto_id)
    .eq("alumno_id", alumno_id)
    .maybeSingle();

  if (!existing) return NextResponse.json({ error: "Foto no encontrada." }, { status: 404 });

  const { error } = await supabase
    .from("progreso_fotos")
    .update({ privada })
    .eq("id", foto_id);

  if (error) return NextResponse.json({ error: sanitizeError(error) }, { status: 500 });
  return NextResponse.json({ ok: true });
}
