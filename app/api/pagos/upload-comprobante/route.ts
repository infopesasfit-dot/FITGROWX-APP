import { NextRequest, NextResponse } from "next/server";
import { randomUUID } from "crypto";
import { createSupabaseServerClient } from "@/lib/supabase-server";
import { getSupabaseAdminClient } from "@/lib/supabase-admin";
import { requireGymNotBlocked } from "@/lib/require-gym-not-blocked";

const sb = getSupabaseAdminClient();
const MAX_SIZE = 10 * 1024 * 1024; // 10 MB

type MimeType = "image/jpeg" | "image/png" | "image/webp" | "image/gif" | "application/pdf";

function getMimeFromMagicBytes(buffer: Uint8Array): MimeType | null {
  // JPEG: FF D8 FF
  if (buffer[0] === 0xff && buffer[1] === 0xd8 && buffer[2] === 0xff) {
    return "image/jpeg";
  }

  // PNG: 89 50 4E 47
  if (buffer[0] === 0x89 && buffer[1] === 0x50 && buffer[2] === 0x4e && buffer[3] === 0x47) {
    return "image/png";
  }

  // WebP: RIFF (0-3) + filesize (4-7) + WEBP (8-11)
  if (
    buffer[0] === 0x52 && buffer[1] === 0x49 && buffer[2] === 0x46 && buffer[3] === 0x46 &&
    buffer[8] === 0x57 && buffer[9] === 0x45 && buffer[10] === 0x42 && buffer[11] === 0x50
  ) {
    return "image/webp";
  }

  // GIF: 47 49 46
  if (buffer[0] === 0x47 && buffer[1] === 0x49 && buffer[2] === 0x46) {
    return "image/gif";
  }

  // PDF: 25 50 44 46 (%PDF)
  if (buffer[0] === 0x25 && buffer[1] === 0x50 && buffer[2] === 0x44 && buffer[3] === 0x46) {
    return "application/pdf";
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

  // Role check and get user's gym
  const { data: profile } = await sb
    .from("profiles")
    .select("role, gym_id")
    .eq("id", session.user.id)
    .single();

  if (!profile || !["staff", "admin"].includes(profile.role) || !profile.gym_id) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const user_gym_id = profile.gym_id;

  const blocked = await requireGymNotBlocked(user_gym_id);
  if (blocked) return blocked;

  // Early size check via Content-Length header — avoids buffering the entire body
  const contentLength = Number(req.headers.get("content-length") ?? "0");
  if (contentLength > MAX_SIZE) {
    return NextResponse.json({ error: "File too large (max 10 MB)" }, { status: 413 });
  }

  // Parse form data (only file and pago_id from client)
  const formData = await req.formData();
  const file = formData.get("file") as File;
  const pago_id = formData.get("pago_id") as string;

  if (!file || !pago_id) {
    return NextResponse.json(
      { error: "File and pago_id required" },
      { status: 400 }
    );
  }

  // Pago ownership check (derive gym_id from pago, not client)
  const { data: pago, error: pagoError } = await sb
    .from("pagos")
    .select("id, gym_id")
    .eq("id", pago_id)
    .single();

  if (pagoError || !pago) {
    return NextResponse.json(
      { error: "Pago not found" },
      { status: 404 }
    );
  }

  // Validate gym_id from pago matches user's gym
  if (pago.gym_id !== user_gym_id) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
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
  const path = `${user_gym_id}/${uuid}.${ext}`;

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
