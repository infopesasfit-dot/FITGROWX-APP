import { supabase } from "@/lib/supabase";

const PROFILE_TTL = 5 * 60 * 1000;  // 5 min
const DATA_TTL    = 2 * 60 * 1000;  // 2 min

export interface GymProfile {
  gymId:  string;
  role:   string;
  userId: string;
}

interface CacheEntry<T> { data: T; ts: number }

let profileEntry: CacheEntry<GymProfile> | null = null;
const pageCache = new Map<string, CacheEntry<unknown>>();

export async function getCachedProfile(): Promise<GymProfile | null> {
  if (profileEntry && Date.now() - profileEntry.ts < PROFILE_TTL) {
    return profileEntry.data;
  }
  const { data: { session } } = await supabase.auth.getSession();
  if (!session) return null;
  const { data: profile } = await supabase
    .from("profiles").select("gym_id, role").eq("id", session.user.id).single();
  if (!profile) return null;
  profileEntry = {
    data: { gymId: profile.gym_id, role: profile.role ?? "admin", userId: session.user.id },
    ts: Date.now(),
  };
  return profileEntry.data;
}

export function invalidateProfile() {
  profileEntry = null;
}

export function getPageCache<T>(key: string): T | null {
  const entry = pageCache.get(key) as CacheEntry<T> | undefined;
  if (!entry || Date.now() - entry.ts > DATA_TTL) return null;
  return entry.data;
}

export function setPageCache<T>(key: string, data: T): void {
  pageCache.set(key, { data, ts: Date.now() });
}

export function invalidatePageCache(key: string): void {
  pageCache.delete(key);
}
