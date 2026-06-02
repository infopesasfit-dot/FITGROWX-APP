import { sanitizeError } from "@/lib/api-error";
import { NextRequest, NextResponse } from "next/server";
import { getValidAlumnoToken } from "@/lib/alumno-token";
import { getSupabaseAdminClient } from "@/lib/supabase-admin";
import { applyAlumnoRateLimit } from "@/lib/alumno-rate-limit";

const BUCKET = "progreso-fotos";
const SIGNED_URL_TTL = 60 * 60 * 6; // 6 hours

const supabase = getSupabaseAdminClient();

export async function GET(req: NextRequest) {
  const tokenRow = await getValidAlumnoToken(req);
  if (!tokenRow) return NextResponse.json({ error: "No autorizado." }, { status: 401 });

  const { data: demoRow } = await supabase.from("alumnos").select("is_demo").eq("id", tokenRow.alumno_id).single();
  if (demoRow?.is_demo) return NextResponse.json({ fotos: [] });

  const { data: rows, error } = await supabase
    .from("progreso_fotos")
    .select("id, storage_path, fecha, notas, privada, created_at")
    .eq("alumno_id", tokenRow.alumno_id)
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

  const { data: demoRowPost } = await supabase.from("alumnos").select("is_demo").eq("id", tokenRow.alumno_id).single();
  if (demoRowPost?.is_demo) return NextResponse.json({ error: "No disponible en modo preview" }, { status: 403 });

  let formData: FormData;
  try { formData = await req.formData(); }
  catch { return NextResponse.json({ error: "Formato inválido." }, { status: 400 }); }

  const rateLimit = await applyAlumnoRateLimit(req, tokenRow.alumno_id, { windowMs: 60 * 1000, maxAttempts: 10 });
  if (!rateLimit.allowed) return rateLimit.response!;

  const file     = formData.get("file")     as File   | null;
  const fecha     = (formData.get("fecha")  as string | null) ?? new Date().toISOString().slice(0, 10);
  let notas      = (formData.get("notas")  as string | null) ?? null;
  const privada   = formData.get("privada") !== "false"; // default true

  if (notas && notas.length > 500) notas = notas.slice(0, 500);
  if (notas) notas = notas.trim() || null;

  if (!file) return NextResponse.json({ error: "Parámetros faltantes." }, { status: 400 });
  if (file.size > 1_500_000) return NextResponse.json({ error: "La imagen pesa más de 1.5 MB. Intentá con una foto más chica." }, { status: 413 });

  const allowedMimes = ["image/jpeg", "image/png", "image/webp"];
  if (!allowedMimes.includes(file.type)) {
    return NextResponse.json({ error: "Solo se aceptan imágenes JPG, PNG o WebP." }, { status: 400 });
  }

  const ext = file.type.includes("png") ? "png" : file.type.includes("webp") ? "webp" : "jpg";
  const storagePath = `${tokenRow.gym_id}/${tokenRow.alumno_id}/${Date.now()}.${ext}`;
  const bytes = await file.arrayBuffer();

  const { error: storageError } = await supabase.storage
    .from(BUCKET)
    .upload(storagePath, bytes, { contentType: file.type, upsert: false });

  if (storageError) return NextResponse.json({ error: storageError.message }, { status: 500 });

  const { data: row, error: dbError } = await supabase
    .from("progreso_fotos")
    .insert({ alumno_id: tokenRow.alumno_id, gym_id: tokenRow.gym_id, storage_path: storagePath, fecha, notas, privada })
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

  const { foto_id, privada } = await req.json();
  if (!foto_id || typeof privada !== "boolean") {
    return NextResponse.json({ error: "Parámetros faltantes." }, { status: 400 });
  }

  const rateLimit = await applyAlumnoRateLimit(req, tokenRow.alumno_id, { windowMs: 60 * 1000, maxAttempts: 20 });
  if (!rateLimit.allowed) return rateLimit.response!;

  // Verify ownership before update
  const { data: existing } = await supabase
    .from("progreso_fotos")
    .select("id")
    .eq("id", foto_id)
    .eq("alumno_id", tokenRow.alumno_id)
    .maybeSingle();

  if (!existing) return NextResponse.json({ error: "Foto no encontrada." }, { status: 404 });

  const { error } = await supabase
    .from("progreso_fotos")
    .update({ privada })
    .eq("id", foto_id)
    .eq("alumno_id", tokenRow.alumno_id);

  if (error) return NextResponse.json({ error: sanitizeError(error) }, { status: 500 });
  return NextResponse.json({ ok: true });
}
