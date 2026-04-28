import { NextRequest } from "next/server";
import { getSupabaseAdminClient } from "@/lib/supabase-admin";

export type AlumnoTokenRow = {
  alumno_id: string;
  gym_id: string;
  expires_at: string;
};

export function getAlumnoBearerToken(req: NextRequest) {
  return req.headers.get("authorization")?.replace("Bearer ", "") ?? null;
}

export async function getValidAlumnoToken(req: NextRequest): Promise<AlumnoTokenRow | null> {
  const supabase = getSupabaseAdminClient();
  const token = getAlumnoBearerToken(req);
  if (!token) return null;

  const { data, error } = await supabase
    .from("alumno_tokens")
    .select("alumno_id, gym_id, expires_at")
    .eq("token", token)
    .single();
  const tokenRow = data as AlumnoTokenRow | null;

  if (error || !tokenRow) return null;
  if (new Date(tokenRow.expires_at) < new Date()) return null;

  return tokenRow;
}
