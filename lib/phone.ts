/**
 * Normalizes a phone number to E.164 digits (no +) for WhatsApp.
 * - Argentine numbers (54xx): ensures the 9 mobile prefix is present.
 * - International numbers with a non-54 country code: returned as-is (digits only).
 * - Short Argentine locals (10 digits): prefixed with 549.
 */
export function normalizePhone(raw: string): string {
  const p = raw.replace(/\D/g, "");
  // Already E.164 with a non-Argentine country code → pass through
  if (p.length > 11 && !p.startsWith("54")) return p;
  // Argentine normalizations
  if (p.startsWith("549") && p.length === 13) return p;
  if (p.startsWith("54")  && p.length === 12) return "549" + p.slice(2);
  if (p.startsWith("9")   && p.length === 11) return "54" + p;
  if (p.startsWith("0")   && p.length === 11) return "549" + p.slice(1);
  if (p.length === 10) return "549" + p;
  return p;
}
