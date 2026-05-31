import type { SupabaseClient } from "@supabase/supabase-js";

type AuditEntry = {
  actor_id: string;
  action: string;
  resource_type: string;
  resource_id?: string | null;
  before_state?: Record<string, unknown> | null;
  after_state?: Record<string, unknown> | null;
  meta?: Record<string, unknown> | null;
};

export function logPlatformAudit(sb: SupabaseClient, entry: AuditEntry): void {
  void sb.from("platform_audit_logs").insert(entry);
}
