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

const SENSITIVE_KEYS = new Set([
  "password",
  "token",
  "api_key",
  "mp_access_token",
  "secret",
  "webhook_secret",
  "access_token",
  "refresh_token",
  "phone",
  "telefono",
  "whatsapp",
  "email",
  "dni",
  "document",
  "cuit",
  "cuil",
  "tax_id",
  "payout_info",
  "bank_account",
  "account_number",
  "cbu",
  "alias",
  "cvu",
  "mp_preapproval_id",
]);

const SENSITIVE_KEY_PARTS = [
  "password",
  "token",
  "secret",
  "api_key",
  "access_token",
  "refresh_token",
  "mp_access_token",
  "webhook_secret",
  "email",
  "phone",
  "telefono",
  "whatsapp",
  "dni",
  "document",
  "cuit",
  "cuil",
  "tax_id",
  "payout",
  "bank",
  "account_number",
  "cbu",
  "cvu",
  "preapproval",
];

function normalizeKey(key: string): string {
  return key.replace(/([a-z0-9])([A-Z])/g, "$1_$2").toLowerCase();
}

function isSensitiveKey(key: string): boolean {
  const normalized = normalizeKey(key);
  return SENSITIVE_KEYS.has(normalized) || SENSITIVE_KEY_PARTS.some((part) => normalized.includes(part));
}

export function sanitizeAuditState(obj: unknown): unknown {
  if (obj === null || typeof obj !== "object") return obj;
  if (Array.isArray(obj)) return obj.map(sanitizeAuditState);
  const result: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(obj as Record<string, unknown>)) {
    result[k] = isSensitiveKey(k) ? "[REDACTED]" : sanitizeAuditState(v);
  }
  return result;
}

export function logPlatformAudit(sb: SupabaseClient, entry: AuditEntry): void {
  void sb.from("platform_audit_logs").insert({
    ...entry,
    before_state: entry.before_state
      ? (sanitizeAuditState(entry.before_state) as Record<string, unknown>)
      : entry.before_state,
    after_state: entry.after_state
      ? (sanitizeAuditState(entry.after_state) as Record<string, unknown>)
      : entry.after_state,
  });
}
