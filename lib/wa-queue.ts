import { getSupabaseAdminClient } from "@/lib/supabase-admin";

const DELAY_MIN_MS = 35_000;
const DELAY_MAX_MS = 65_000;

function randDelay(): number {
  return Math.floor(Math.random() * (DELAY_MAX_MS - DELAY_MIN_MS + 1)) + DELAY_MIN_MS;
}

export interface WAQueueItem {
  gymId: string;
  phone: string;
  message: string;
  dedupKey?: string;
}

/**
 * Encola mensajes bulk con stagger de 35–65 s por gym.
 * El dedup_key evita duplicados si el cron se dispara dos veces.
 */
export async function enqueueWABulk(messages: WAQueueItem[]): Promise<void> {
  if (!messages.length) return;
  const supabase = getSupabaseAdminClient();
  const now = Date.now();

  // Offset independiente por gym para no mezclar relojes entre gyms
  const gymOffset = new Map<string, number>();

  const rows = messages.map(msg => {
    const offset = gymOffset.get(msg.gymId) ?? 0;
    gymOffset.set(msg.gymId, offset + randDelay());
    return {
      gym_id:       msg.gymId,
      phone:        msg.phone,
      message:      msg.message,
      priority:     "bulk",
      scheduled_at: new Date(now + offset).toISOString(),
      ...(msg.dedupKey ? { dedup_key: msg.dedupKey } : {}),
    };
  });

  // ignoreDuplicates: si el dedup_key ya existe, no explota
  const { error } = await supabase
    .from("wa_queue")
    .upsert(rows, { onConflict: "dedup_key", ignoreDuplicates: true });
  if (error) console.error("[wa-queue] upsert error:", error.message);
}
