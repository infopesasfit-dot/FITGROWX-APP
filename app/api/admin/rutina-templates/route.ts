import { NextRequest, NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase-server";
import { getSupabaseAdminClient } from "@/lib/supabase-admin";
import { z } from "zod";

const supabase = getSupabaseAdminClient();

async function getCallerGymId(): Promise<string | null> {
  const client = await createSupabaseServerClient();
  const { data: { user } } = await client.auth.getUser();
  if (!user) return null;
  const { data } = await supabase.from("profiles").select("gym_id, role").eq("id", user.id).maybeSingle<{ gym_id: string | null; role: string | null }>();
  if (!data?.gym_id || !["admin", "staff"].includes(data.role ?? "")) return null;
  return data.gym_id;
}

export async function GET() {
  const gymId = await getCallerGymId();
  if (!gymId) return NextResponse.json({ error: "No autorizado." }, { status: 401 });
  const { data, error } = await supabase
    .from("rutina_templates")
    .select("id, nombre, objetivo, rutinatipo, ejercicios, notas, created_at")
    .eq("gym_id", gymId)
    .order("created_at", { ascending: false });
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ templates: data });
}

const TemplateSchema = z.object({
  nombre:     z.string().min(1),
  objetivo:   z.string().optional().nullable(),
  rutinatipo: z.enum(["gym", "wod"]).default("gym"),
  ejercicios: z.array(z.unknown()).default([]),
  notas:      z.string().optional().nullable(),
});

export async function POST(req: NextRequest) {
  const gymId = await getCallerGymId();
  if (!gymId) return NextResponse.json({ error: "No autorizado." }, { status: 401 });
  const body = await req.json();
  const parsed = TemplateSchema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: parsed.error.message }, { status: 400 });
  const { data, error } = await supabase
    .from("rutina_templates")
    .insert({ ...parsed.data, gym_id: gymId })
    .select()
    .single();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ template: data });
}
