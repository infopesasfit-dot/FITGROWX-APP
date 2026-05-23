import { NextRequest, NextResponse } from "next/server";
import { randomUUID } from "crypto";
import { createSupabaseServerClient } from "@/lib/supabase-server";
import { getSupabaseAdminClient } from "@/lib/supabase-admin";

const sb = getSupabaseAdminClient();
const MAX_SIZE = 10 * 1024 * 1024; // 10 MB

const MAGIC_BYTES = {
  "image/jpeg": [0xff, 0xd8, 0xff],
  "image/png": [0x89, 0x50, 0x4e, 0x47],
  "image/webp": [0x52, 0x49, 0x46, 0x46, 0x00, 0x00, 0x00, 0x00, 0x57, 0x45, 0x42, 0x50],
  "image/gif": [0x47, 0x49, 0x46],
  "application/pdf": [0x25, 0x50, 0x44, 0x46],
};

type MimeType = keyof typeof MAGIC_BYTES;

function matchesMagicBytes(buffer: Uint8Array, mimeType: MimeType): boolean {
  const bytes = MAGIC_BYTES[mimeType];
  if (!bytes) return false;
  return bytes.every((byte, idx) => buffer[idx] === byte);
}

async function getMimeFromMagicBytes(buffer: Uint8Array): Promise<MimeType | null> {
  for (const [mime] of Object.entries(MAGIC_BYTES)) {
    if (matchesMagicBytes(buffer, mime as MimeType)) {
      return mime as MimeType;
    }
  }
  return null;
}

export async function POST(req: NextRequest) {
  // Auth check via session cookie
  const supabase = await createSupabaseServerClient();
  const { data: { session } } = await supabase.auth.getSession();

  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  // Role check
  const { data: profile } = await sb
    .from("profiles")
    .select("role, gym_id")
    .eq("id", session.user.id)
    .single();

  if (!profile || !["staff", "admin"].includes(profile.role)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  // Parse form data
  const formData = await req.formData();
  const file = formData.get("file") as File;
  const pago_id = formData.get("pago_id") as string;
  const gym_id = formData.get("gym_id") as string;

  if (!file || !pago_id || !gym_id) {
    return NextResponse.json(
      { error: "File, pago_id, and gym_id required" },
      { status: 400 }
    );
  }

  // Ownership check
  if (gym_id !== profile.gym_id) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  // Pago ownership check
  const { data: pago, error: pagoError } = await sb
    .from("pagos")
    .select("id, gym_id")
    .eq("id", pago_id)
    .single();

  if (pagoError || !pago || pago.gym_id !== gym_id) {
    return NextResponse.json(
      { error: "Pago not found or not owned" },
      { status: 404 }
    );
  }

  // Size check
  if (file.size > MAX_SIZE) {
    return NextResponse.json(
      { error: "File too large (max 10 MB)" },
      { status: 400 }
    );
  }

  // MIME check via magic bytes
  const buffer = new Uint8Array(await file.arrayBuffer());
  const detectedMime = await getMimeFromMagicBytes(buffer);

  const allowedMimes: MimeType[] = [
    "image/jpeg",
    "image/png",
    "image/webp",
    "image/gif",
    "application/pdf",
  ];

  if (!detectedMime || !allowedMimes.includes(detectedMime)) {
    return NextResponse.json(
      { error: "Invalid file type" },
      { status: 400 }
    );
  }

  // Generate safe filename
  const ext = detectedMime === "image/jpeg" ? "jpg" :
              detectedMime === "image/png" ? "png" :
              detectedMime === "image/webp" ? "webp" :
              detectedMime === "image/gif" ? "gif" :
              "pdf";

  const uuid = randomUUID();
  const path = `${gym_id}/${uuid}.${ext}`;

  // Upload with service role
  const blob = new Blob([buffer], { type: detectedMime });
  const { error: uploadError } = await sb.storage
    .from("comprobantes")
    .upload(path, blob, { cacheControl: "3600" });

  if (uploadError) {
    return NextResponse.json(
      { error: uploadError.message },
      { status: 500 }
    );
  }

  // Update pago with path
  const { error: updateError } = await sb
    .from("pagos")
    .update({ comprobante_path: path })
    .eq("id", pago_id);

  if (updateError) {
    // Cleanup failed upload
    await sb.storage.from("comprobantes").remove([path]);
    return NextResponse.json(
      { error: updateError.message },
      { status: 500 }
    );
  }

  return NextResponse.json({ path });
}
