import { cache } from "react";
import { BookOpen, FolderOpen } from "lucide-react";
import { createSupabaseServerClient } from "@/lib/supabase-server";
import { getRelationRecord, getVaultCategorySummary } from "@/lib/supabase-relations";
import {
  getResourcesByCategory,
  getVaultCategory,
  getVaultResource,
  vaultCategories as staticCategories,
  vaultResources as staticResources,
  type VaultCategory as StaticCategory,
  type VaultResource as StaticResource,
} from "./data";

export type VaultCategoryView = StaticCategory;
export type VaultResourceView = StaticResource;

type DbCategoryRow = {
  id: string;
  slug: string;
  title: string;
  description: string | null;
  is_active: boolean;
};

type DbResourceRow = {
  id: string;
  slug: string;
  category_id: string | null;
  title: string;
  description: string | null;
  format: string | null;
  read_time_minutes: number | null;
  status: string;
  objective: string | null;
  outcome: string | null;
  content: unknown;
  meta: unknown;
  updated_at: string;
  vault_categories: unknown;
};

function getCategoryIcon(slug: string) {
  return getVaultCategory(slug)?.icon ?? FolderOpen;
}

function getCategoryBadge(slug: string) {
  return getVaultCategory(slug)?.badge ?? "Biblioteca";
}

function getResourceIcon(resourceSlug: string, categorySlug: string) {
  return getVaultResource(resourceSlug)?.icon ?? getCategoryIcon(categorySlug) ?? BookOpen;
}

function parseContentParts(
  content: unknown,
  fallback?: StaticResource,
): Pick<VaultResourceView, "intro" | "steps" | "bullets"> {
  let intro = fallback?.intro ?? "";
  let steps = fallback?.steps ?? [];
  let bullets = fallback?.bullets ?? [];

  if (Array.isArray(content)) {
    const objectItems = content.filter(
      (item): item is Record<string, unknown> => !!item && typeof item === "object",
    );
    const stringItems = content.filter((item): item is string => typeof item === "string");

    const introItem = objectItems.find((item) =>
      ["intro", "paragraph", "summary"].includes(String(item.type ?? "")),
    );
    if (introItem && typeof introItem.content === "string" && introItem.content.trim()) {
      intro = introItem.content.trim();
    } else if (!intro && stringItems.length > 0) {
      intro = stringItems[0];
    }

    const stepItems = objectItems
      .filter((item) => ["step", "steps"].includes(String(item.type ?? "")))
      .flatMap((item) => {
        if (Array.isArray(item.items)) {
          return item.items.filter((entry): entry is string => typeof entry === "string");
        }
        if (typeof item.content === "string") {
          return [item.content];
        }
        return [];
      });

    const bulletItems = objectItems
      .filter((item) => ["bullet", "bullets", "note", "notes"].includes(String(item.type ?? "")))
      .flatMap((item) => {
        if (Array.isArray(item.items)) {
          return item.items.filter((entry): entry is string => typeof entry === "string");
        }
        if (typeof item.content === "string") {
          return [item.content];
        }
        return [];
      });

    if (stepItems.length > 0) {
      steps = stepItems;
    } else if (!steps.length && stringItems.length > 1) {
      steps = stringItems.slice(1);
    }

    if (bulletItems.length > 0) {
      bullets = bulletItems;
    }
  } else if (content && typeof content === "object") {
    const data = content as {
      intro?: unknown;
      steps?: unknown;
      bullets?: unknown;
    };
    if (typeof data.intro === "string" && data.intro.trim()) {
      intro = data.intro.trim();
    }
    if (Array.isArray(data.steps)) {
      steps = data.steps.filter((entry): entry is string => typeof entry === "string");
    }
    if (Array.isArray(data.bullets)) {
      bullets = data.bullets.filter((entry): entry is string => typeof entry === "string");
    }
  }

  return {
    intro,
    steps,
    bullets,
  };
}

function mapDbCategory(row: DbCategoryRow): VaultCategoryView {
  const fallback = getVaultCategory(row.slug);
  return {
    slug: row.slug,
    title: row.title,
    description: row.description ?? fallback?.description ?? "",
    badge: fallback?.badge ?? getCategoryBadge(row.slug),
    icon: fallback?.icon ?? getCategoryIcon(row.slug),
  };
}

function mapDbResource(row: DbResourceRow): VaultResourceView {
  const relatedCategory = getVaultCategorySummary(row.vault_categories);
  const categorySlug = relatedCategory?.slug ?? getVaultResource(row.slug)?.category ?? "tutoriales-fitgrowx";
  const fallback = getVaultResource(row.slug);
  const contentParts = parseContentParts(row.content, fallback);

  return {
    slug: row.slug,
    category: categorySlug,
    title: row.title,
    description: row.description ?? fallback?.description ?? "",
    tags:
      fallback?.tags ??
      (Array.isArray((row.meta as { tags?: unknown } | null)?.tags)
        ? ((row.meta as { tags?: unknown }).tags as unknown[]).filter(
            (tag): tag is string => typeof tag === "string",
          )
        : []),
    cta: fallback?.cta ?? "Abrir recurso",
    format: row.format ?? fallback?.format ?? "Recurso",
    readTime: row.read_time_minutes ? `${row.read_time_minutes} min` : fallback?.readTime ?? "5 min",
    objective: row.objective ?? fallback?.objective ?? "Aplicar una mejora concreta dentro de tu operación.",
    outcome: row.outcome ?? fallback?.outcome ?? "Más claridad para ejecutar el proceso con tu equipo.",
    icon: fallback?.icon ?? getResourceIcon(row.slug, categorySlug),
    intro: contentParts.intro || row.description || fallback?.intro || "",
    steps:
      contentParts.steps.length > 0
        ? contentParts.steps
        : fallback?.steps ?? ["Completa este recurso desde el CMS para sumar el paso a paso."],
    bullets:
      contentParts.bullets.length > 0
        ? contentParts.bullets
        : fallback?.bullets ?? ["Puedes enriquecer este recurso desde /platform cuando quieras."],
  };
}

function mapDbCategoryRow(input: unknown): DbCategoryRow | null {
  const row = getRelationRecord(input);
  if (
    !row ||
    typeof row.id !== "string" ||
    typeof row.slug !== "string" ||
    typeof row.title !== "string" ||
    typeof row.is_active !== "boolean"
  ) {
    return null;
  }

  return {
    id: row.id,
    slug: row.slug,
    title: row.title,
    description: typeof row.description === "string" ? row.description : null,
    is_active: row.is_active,
  };
}

function mapDbResourceRow(input: unknown): DbResourceRow | null {
  const row = getRelationRecord(input);
  if (
    !row ||
    typeof row.id !== "string" ||
    typeof row.slug !== "string" ||
    typeof row.title !== "string" ||
    typeof row.status !== "string" ||
    typeof row.updated_at !== "string"
  ) {
    return null;
  }

  return {
    id: row.id,
    slug: row.slug,
    category_id: typeof row.category_id === "string" ? row.category_id : null,
    title: row.title,
    description: typeof row.description === "string" ? row.description : null,
    format: typeof row.format === "string" ? row.format : null,
    read_time_minutes: typeof row.read_time_minutes === "number" ? row.read_time_minutes : null,
    status: row.status,
    objective: typeof row.objective === "string" ? row.objective : null,
    outcome: typeof row.outcome === "string" ? row.outcome : null,
    content: row.content,
    meta: row.meta,
    updated_at: row.updated_at,
    vault_categories: row.vault_categories,
  };
}

const getDbVaultData = cache(async () => {
  try {
    const supabase = await createSupabaseServerClient();
    const [{ data: categoryRows, error: categoryError }, { data: resourceRows, error: resourceError }] =
      await Promise.all([
        supabase
          .from("vault_categories")
          .select("id, slug, title, description, is_active")
          .eq("is_active", true)
          .order("sort_order", { ascending: true }),
        supabase
          .from("vault_resources")
          .select(
            "id, slug, title, description, format, read_time_minutes, status, objective, outcome, content, meta, updated_at, category_id, vault_categories(slug, title, description)",
          )
          .eq("status", "published")
          .order("updated_at", { ascending: false }),
      ]);

    if (categoryError || resourceError) {
      return { categories: [] as VaultCategoryView[], resources: [] as VaultResourceView[] };
    }

    return {
      categories: (categoryRows ?? [])
        .map((row) => mapDbCategoryRow(row))
        .filter((row): row is DbCategoryRow => row !== null)
        .map((row) => mapDbCategory(row)),
      resources: (resourceRows ?? [])
        .map((row) => mapDbResourceRow(row))
        .filter((row): row is DbResourceRow => row !== null)
        .map((row) => mapDbResource(row)),
    };
  } catch {
    return { categories: [] as VaultCategoryView[], resources: [] as VaultResourceView[] };
  }
});

function mergeBySlug<T extends { slug: string }>(primary: T[], fallback: T[]) {
  const merged = new Map<string, T>();
  primary.forEach((item) => merged.set(item.slug, item));
  fallback.forEach((item) => {
    if (!merged.has(item.slug)) {
      merged.set(item.slug, item);
    }
  });
  return Array.from(merged.values());
}

export const getVaultContent = cache(async () => {
  const dbData = await getDbVaultData();
  return {
    categories: mergeBySlug(dbData.categories, staticCategories),
    resources: mergeBySlug(dbData.resources, staticResources),
  };
});

export async function getVaultHomeData() {
  return getVaultContent();
}

export async function getVaultCategoryPageData(slug: string) {
  const { categories, resources } = await getVaultContent();
  const category = categories.find((item) => item.slug === slug) ?? getVaultCategory(slug);
  const categoryResources = resources.filter((item) => item.category === slug);

  return {
    category: category ?? null,
    resources: categoryResources.length > 0 ? categoryResources : getResourcesByCategory(slug),
  };
}

export async function getVaultResourcePageData(slug: string) {
  const { categories, resources } = await getVaultContent();
  const resource = resources.find((item) => item.slug === slug) ?? getVaultResource(slug);
  const category =
    categories.find((item) => item.slug === resource?.category) ??
    (resource ? getVaultCategory(resource.category) : undefined);

  return {
    resource: resource ?? null,
    category: category ?? null,
  };
}
