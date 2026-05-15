import { NextRequest, NextResponse } from "next/server";
import { createHash } from "crypto";
import { getSupabaseAdminClient } from "@/lib/supabase-admin";
import { getTodayDate, getCurrentTime } from "@/lib/date-utils";
import { applyRateLimit, getClientIp } from "@/lib/request-security";

const admin = getSupabaseAdminClient();

export async function POST(req: NextRequest) {
  // Rate limit por IP: 60 req/min
  const limit = await applyRateLimit({
    namespace: "molinete:ip",
    identifier: getClientIp(req),
    windowMs: 60_000,
    maxAttempts: 60,
  });
  if (!limit.allowed) {
    return NextResponse.json({ access: "deny", reason: "Demasiados intentos." }, { status: 429 });
  }

  // ── Autenticación por API key ─────────────────────────────────────
  const rawKey = req.headers.get("x-api-key")?.trim();
  if (!rawKey) {
    return NextResponse.json({ access: "deny", reason: "x-api-key requerida." }, { status: 401 });
  }

  const keyHash = createHash("sha256").update(rawKey).digest("hex");

  const { data: keyRow } = await admin
    .from("molinete_api_keys")
    .select("id, gym_id")
    .eq("key_hash", keyHash)
    .is("revoked_at", null)
    .maybeSingle<{ id: string; gym_id: string }>();

  if (!keyRow) {
    return NextResponse.json({ access: "deny", reason: "API key inválida." }, { status: 401 });
  }

  // Actualizar last_used_at sin bloquear la respuesta
  admin
    .from("molinete_api_keys")
    .update({ last_used_at: new Date().toISOString() })
    .eq("id", keyRow.id)
    .then(() => {});

  // ── Parsear QR ────────────────────────────────────────────────────
  const body = await req.json().catch(() => ({})) as Record<string, unknown>;
  const qr = (body.qr as string | undefined)?.trim();

  if (!qr?.startsWith("FITGROWX:")) {
    return NextResponse.json({ access: "deny", reason: "QR inválido. Formato esperado: FITGROWX:ID:{alumno_id}" }, { status: 400 });
  }

  const payload = qr.slice("FITGROWX:".length);
  const byId    = payload.startsWith("ID:");
  const lookup  = byId ? payload.slice(3) : payload;

  if (!lookup) {
    return NextResponse.json({ access: "deny", reason: "QR vacío." }, { status: 400 });
  }

  // ── Buscar alumno ─────────────────────────────────────────────────
  const base = admin
    .from("alumnos")
    .select("id, gym_id, full_name, status, next_expiration_date")
    .eq("gym_id", keyRow.gym_id)
    .is("deleted_at", null);

  const { data: alumno } = await (byId ? base.eq("id", lookup) : base.eq("dni", lookup)).maybeSingle<{
    id: string; gym_id: string; full_name: string; status: string | null; next_expiration_date: string | null;
  }>();

  if (!alumno) {
    return NextResponse.json({
      access: "deny",
      reason: "Alumno no encontrado en este gimnasio.",
    });
  }

  // ── Validar membresía ─────────────────────────────────────────────
  const today     = getTodayDate();
  const isExpired = Boolean(alumno.next_expiration_date && alumno.next_expiration_date < today);
  const isActive  = alumno.status === "activo";

  if (!isActive || isExpired) {
    return NextResponse.json({
      access: "deny",
      reason: isExpired ? "Membresía vencida." : "Membresía inactiva.",
      alumno: { full_name: alumno.full_name, status: alumno.status },
    });
  }

  // ── Registrar asistencia ──────────────────────────────────────────
  const hora = getCurrentTime();

  const { error: insErr } = await admin.from("asistencias").insert({
    gym_id:    alumno.gym_id,
    alumno_id: alumno.id,
    fecha:     today,
    hora,
  } as never);

  // Código 23505 = unique_violation (ya registró hoy) — igual dejamos pasar
  if (insErr && insErr.code !== "23505") {
    return NextResponse.json({ access: "deny", reason: "Error interno al registrar asistencia." }, { status: 500 });
  }

  return NextResponse.json({
    access: "allow",
    already: insErr?.code === "23505",
    alumno: { full_name: alumno.full_name, status: alumno.status },
    hora,
  });
}
