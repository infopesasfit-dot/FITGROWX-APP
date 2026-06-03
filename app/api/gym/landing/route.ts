import { NextRequest, NextResponse } from "next/server";
import { getSupabaseAdminClient } from "@/lib/supabase-admin";

// Public landing data for /gym/[slug]. Served via service-role with an explicit
// column whitelist because gym_settings is owner-only RLS (it holds
// mp_access_token / api_key). Anon clients can't read the table directly, so the
// public landing fetches the safe subset from here. Never add secret columns.
export async function GET(req: NextRequest) {
  const slug = new URL(req.url).searchParams.get("slug");
  if (!slug) return NextResponse.json({ error: "slug requerido." }, { status: 400 });

  const sb = getSupabaseAdminClient();
  const { data } = await sb
    .from("gym_settings")
    .select(
      "gym_id, gym_name, logo_url, accent_color, landing_title, landing_subtitle, landing_desc, landing_cta_text, landing_template, landing_benefits",
    )
    .eq("slug", slug)
    .maybeSingle();

  if (!data) return NextResponse.json({ error: "Gimnasio no encontrado." }, { status: 404 });

  return NextResponse.json(data, {
    headers: { "Cache-Control": "public, max-age=60, stale-while-revalidate=300" },
  });
}
