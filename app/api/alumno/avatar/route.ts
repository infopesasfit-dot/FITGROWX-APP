import { NextRequest, NextResponse } from "next/server";
import { getValidAlumnoToken } from "@/lib/alumno-token";
import { getSupabaseAdminClient } from "@/lib/supabase-admin";

const BUCKET = "alumno-avatars";
const SIGNED_URL_TTL = 365 * 24 * 60 * 60;

const supabase = getSupabaseAdminClient();

export async function POST(req: NextRequest) {
  const tokenRow = await getValidAlumnoToken(req);
  if (!tokenRow) return NextResponse.json({ error: "No autorizado." }, { status: 401 });

  let formData: FormData;
  try { formData = await req.formData(); }
  catch { return NextResponse.json({ error: "Formato inválido." }, { status: 400 }); }

  const file = formData.get("file") as File | null;
  if (!file) return NextResponse.json({ error: "No se recibió imagen." }, { status: 400 });

  if (!file.type.startsWith("image/")) {
    return NextResponse.json({ error: "Solo se aceptan imágenes." }, { status: 400 });
  }
  if (file.size > 2_097_152) {
    return NextResponse.json({ error: "La imagen supera 2 MB." }, { status: 413 });
  }

  const ext = file.type.includes("png") ? "png" : file.type.includes("webp") ? "webp" : "jpg";
  const storagePath = `${tokenRow.alumno_id}/avatar.${ext}`;
  const bytes = await file.arrayBuffer();

  // Remove existing avatar files for all extensions before uploading
  await supabase.storage.from(BUCKET).remove([
    `${tokenRow.alumno_id}/avatar.jpg`,
    `${tokenRow.alumno_id}/avatar.png`,
    `${tokenRow.alumno_id}/avatar.webp`,
  ]);

  const { error: storageError } = await supabase.storage
    .from(BUCKET)
    .upload(storagePath, bytes, { contentType: file.type, upsert: true });

  if (storageError) return NextResponse.json({ error: storageError.message }, { status: 500 });

  const { data: signed } = await supabase.storage
    .from(BUCKET)
    .createSignedUrl(storagePath, SIGNED_URL_TTL);

  if (!signed?.signedUrl) return NextResponse.json({ error: "Error al generar URL." }, { status: 500 });

  const { error: dbError } = await supabase
    .from("alumnos")
    .update({ avatar_url: signed.signedUrl })
    .eq("id", tokenRow.alumno_id);

  if (dbError) return NextResponse.json({ error: dbError.message }, { status: 500 });

  return NextResponse.json({ ok: true, avatar_url: signed.signedUrl });
}
