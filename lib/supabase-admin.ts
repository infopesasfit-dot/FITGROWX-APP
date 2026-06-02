import { createClient, SupabaseClient } from "@supabase/supabase-js";
// TODO: Replace with Database types once SUPABASE_ACCESS_TOKEN is available
// import type { Database } from "@/types/database";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
let cachedAdminClient: SupabaseClient<any> | null = null;

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function getSupabaseAdminClient(): SupabaseClient<any> {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!url) {
    throw new Error("Missing NEXT_PUBLIC_SUPABASE_URL");
  }

  if (!serviceRoleKey) {
    throw new Error("Missing SUPABASE_SERVICE_ROLE_KEY");
  }

  if (!cachedAdminClient) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    cachedAdminClient = createClient<any>(url, serviceRoleKey);
  }

  return cachedAdminClient;
}
