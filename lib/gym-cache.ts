import { supabase } from "@/lib/supabase";

const PROFILE_TTL = 5 * 60 * 1000;  // 5 min
const DATA_TTL    = 2 * 60 * 1000;  // 2 min

export interface GymProfile {
  gymId:  string;
  role:   string;
  userId: string;
}

export interface ImpersonatedGym {
  gym_id:   string;
  gym_name: string;
}

export function getImpersonatedGym(): ImpersonatedGym | null {
  try {
    const raw = localStorage.getItem("fitgrowx_as_gym");
    if (!raw) return null;
    return JSON.parse(raw) as ImpersonatedGym;
  } catch { return null; }
}

export function setImpersonatedGym(data: ImpersonatedGym): void {
  localStorage.setItem("fitgrowx_as_gym", JSON.stringify(data));
  profileEntry = null;
}

export function clearImpersonation(): void {
  localStorage.removeItem("fitgrowx_as_gym");
  profileEntry = null;
}

interface CacheEntry<T> { data: T; ts: number }

let profileEntry: CacheEntry<GymProfile> | null = null;
const pageCache = new Map<string, CacheEntry<unknown>>();

export async function getCachedProfile(): Promise<GymProfile | null> {
  const { data: { session } } = await supabase.auth.getSession();
  if (!session) return null;
  if (
    profileEntry &&
    profileEntry.data.userId === session.user.id &&
    Date.now() - profileEntry.ts < PROFILE_TTL
  ) {
    return profileEntry.data;
  }
  const { data: profile } = await supabase
    .from("profiles").select("gym_id, role").eq("id", session.user.id).single();
  if (!profile) return null;

  let gymId = profile.gym_id;
  if (profile.role === "platform_owner") {
    const imp = getImpersonatedGym();
    if (imp) gymId = imp.gym_id;
  }

  profileEntry = {
    data: { gymId, role: profile.role ?? "admin", userId: session.user.id },
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
