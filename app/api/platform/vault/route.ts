import { NextRequest, NextResponse } from "next/server";
import { getSupabaseAdminClient } from "@/lib/supabase-admin";
import { createSupabaseServerClient } from "@/lib/supabase-server";
import { logger } from "@/lib/logger";

const sb = getSupabaseAdminClient();

const VALID_RESOURCE_STATUSES = ["draft", "published", "archived"] as const;

function slugify(value: string) {
  return value
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
}

async function assertPlatformOwner() {
  const sbUser = await createSupabaseServerClient();
  const { data: { user } } = await sbUser.auth.getUser();
  if (!user) return null;
  const { data: profile } = await sb.from("profiles").select("role").eq("id", user.id).maybeSingle();
  return profile?.role === "platform_owner" ? user : null;
}

// POST /api/platform/vault
// body: { type: "category", title, description? }
//     | { type: "resource", title, description?, category_id, format?, status?, sort_order? }
export async function POST(req: NextRequest) {
  if (!await assertPlatformOwner()) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const body = await req.json().catch(() => null);
  if (!body?.type) return NextResponse.json({ error: "type requerido." }, { status: 400 });

  if (body.type === "category") {
    const title = String(body.title ?? "").trim();
    if (!title) return NextResponse.json({ error: "title requerido." }, { status: 400 });

    const { count } = await sb
      .from("vault_categories")
      .select("id", { count: "exact", head: true });

    const { data, error } = await sb
      .from("vault_categories")
      .insert({
        title,
        slug: slugify(title),
        description: body.description?.trim() || null,
        sort_order: ((count ?? 0) + 1) * 10,
        is_active: true,
      })
      .select("id, title, slug")
      .single();

if (error) {
    void logger.error("db error", { route: "/platform/vault", meta: { error } });
    return NextResponse.json({ error: "Error interno. Intente nuevamente." }, { status: 500 });
    }
    return NextResponse.json({ ok: true, category: data });
  }

  if (body.type === "resource") {
    const title = String(body.title ?? "").trim();
    const category_id = String(body.category_id ?? "").trim();
    if (!title)       return NextResponse.json({ error: "title requerido." }, { status: 400 });
    if (!category_id) return NextResponse.json({ error: "category_id requerido." }, { status: 400 });

    const status = VALID_RESOURCE_STATUSES.includes(body.status) ? body.status : "draft";

    const { data, error } = await sb
      .from("vault_resources")
      .insert({
        title,
        slug: slugify(title),
        description: body.description?.trim() || null,
        category_id,
        format: body.format?.trim() || null,
        status,
        content: [],
      })
      .select("id, title, slug, status")
      .single();

if (error) {
    void logger.error("db error", { route: "/platform/vault", meta: { error } });
    return NextResponse.json({ error: "Error interno. Intente nuevamente." }, { status: 500 });
    }
    return NextResponse.json({ ok: true, resource: data });
  }

  return NextResponse.json({ error: "type inválido." }, { status: 400 });
}
