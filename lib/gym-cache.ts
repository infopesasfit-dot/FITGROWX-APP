import { supabase } from "@/lib/supabase";

const PROFILE_TTL = 5 * 60 * 1000;
const DATA_TTL    = 2 * 60 * 1000;   // revalidation threshold
const LS_TTL      = 5 * 60 * 1000;   // show stale data up to 5 min
const LS_PFX      = "fgx_";

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

// L1 = in-memory (fast, lost on refresh)
// L2 = localStorage (persists across refreshes, up to 5 min stale)
export function getPageCache<T>(key: string): T | null {
  // L1: in-memory within revalidation window
  const mem = pageCache.get(key) as CacheEntry<T> | undefined;
  if (mem && Date.now() - mem.ts <= DATA_TTL) return mem.data;

  // L2: localStorage — stale-while-revalidate
  try {
    const raw = localStorage.getItem(LS_PFX + key);
    if (!raw) return null;
    const ls = JSON.parse(raw) as CacheEntry<T>;
    if (Date.now() - ls.ts > LS_TTL) {
      localStorage.removeItem(LS_PFX + key);
      return null;
    }
    pageCache.set(key, ls); // promote to L1
    return ls.data;
  } catch { return null; }
}

export function setPageCache<T>(key: string, data: T): void {
  const entry: CacheEntry<T> = { data, ts: Date.now() };
  pageCache.set(key, entry);
  try {
    localStorage.setItem(LS_PFX + key, JSON.stringify(entry));
  } catch { /* storage full / private mode — silent */ }
}

export function invalidatePageCache(key: string): void {
  pageCache.delete(key);
  try { localStorage.removeItem(LS_PFX + key); } catch { /* */ }
}

export function invalidateDashboardCache(): void {
  for (const key of pageCache.keys()) {
    if (key.startsWith("dashboard_")) pageCache.delete(key);
  }
  try {
    Object.keys(localStorage)
      .filter(k => k.startsWith(LS_PFX + "dashboard_"))
      .forEach(k => localStorage.removeItem(k));
  } catch { /* */ }
}

export function invalidateAsistenciasCache(): void {
  for (const key of pageCache.keys()) {
    if (key.startsWith("asistencias_")) pageCache.delete(key);
  }
  try {
    Object.keys(localStorage)
      .filter(k => k.startsWith(LS_PFX + "asistencias_"))
      .forEach(k => localStorage.removeItem(k));
  } catch { /* */ }
}

// ─── Route prefetching ────────────────────────────────────────────────────────

export async function prefetchDashboard(): Promise<void> {
  const profile = await getCachedProfile();
  if (!profile) return;
  const now = new Date();
  const y = now.getFullYear(), m = now.getMonth();
  const from = `${y}-${String(m + 1).padStart(2, "0")}-01`;
  const lastDay = new Date(y, m + 1, 0).getDate();
  const to   = `${y}-${String(m + 1).padStart(2, "0")}-${String(lastDay).padStart(2, "0")}`;
  const key  = `dashboard_${profile.gymId}_${from}`;
  if (getPageCache(key)) return; // still fresh, skip
  const res = await fetch(`/api/admin/dashboard?from=${from}&to=${to}`, { cache: "no-store" }).catch(() => null);
  if (!res?.ok) return;
  const payload = await res.json().catch(() => null);
  if (payload?.ok && payload.snapshot) setPageCache(key, payload.snapshot);
}

const ROUTE_PREFETCH: Partial<Record<string, () => Promise<void>>> = {
  "/dashboard": prefetchDashboard,
};

export function prefetchRoute(href: string): void {
  const fn = ROUTE_PREFETCH[href];
  if (fn) void fn();
}
