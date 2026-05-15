import { SupabaseClient } from "@supabase/supabase-js";

export function toBaseSlug(name: string): string {
  return name
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")   // strip accents: á→a, ñ→n, etc.
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 40) || "gym";
}

/** Returns a slug that doesn't exist yet in gym_settings.slug. */
export async function generateUniqueSlug(
  supabase: SupabaseClient,
  gymName: string,
  excludeGymId?: string,
): Promise<string> {
  const base = toBaseSlug(gymName);
  let candidate = base;
  let n = 2;
  for (;;) {
    let q = supabase.from("gym_settings").select("gym_id").eq("slug", candidate);
    if (excludeGymId) q = q.neq("gym_id", excludeGymId);
    const { data } = await q.maybeSingle();
    if (!data) return candidate;
    candidate = `${base}-${n++}`;
  }
}
