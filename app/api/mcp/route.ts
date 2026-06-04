import { NextRequest } from "next/server";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { WebStandardStreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/webStandardStreamableHttp.js";
import { getSupabaseAdminClient } from "@/lib/supabase-admin";
import { sendWa } from "@/lib/wa";
import { normalizePhone } from "@/lib/phone";
import { createHash, timingSafeEqual } from "crypto";
import { applyRateLimit } from "@/lib/request-security";
import { z } from "zod";

function sha256hex(input: string): string {
  return createHash("sha256").update(input).digest("hex");
}

const WRITE_TOOLS = new Set([
  "send_whatsapp",
  "send_bulk_whatsapp",
  "update_alumno_status",
  "assign_rutina",
  "create_payment_link",
]);

type McpContent = { content: [{ type: "text"; text: string }] };

async function rlGuard(gymId: string, toolName: string): Promise<McpContent | null> {
  const isWrite = WRITE_TOOLS.has(toolName);
  const rl = await applyRateLimit({
    namespace: isWrite ? "mcp:write" : "mcp:read",
    identifier: `${gymId}:${toolName}`,
    windowMs: 60_000,
    maxAttempts: isWrite ? 5 : 30,
  });
  if (!rl.allowed) {
    return { content: [{ type: "text" as const, text: JSON.stringify({ ok: false, error: "Rate limit exceeded" }) }] };
  }
  return null;
}

const sb = getSupabaseAdminClient();
const APP_URL = (process.env.NEXT_PUBLIC_APP_URL ?? "https://app.fitgrowx.com").replace(/\/$/, "");

async function getGymIdFromApiKey(req: Request): Promise<string | null> {
  const auth = req.headers.get("authorization") ?? "";
  const token = auth.startsWith("Bearer ") ? auth.slice(7).trim() : null;
  if (!token) return null;

  const tokenHash = sha256hex(token);

  const { data } = await sb
    .from("gym_settings")
    .select("gym_id, api_key")
    .eq("api_key", tokenHash)
    .maybeSingle();

  if (!data?.api_key) return null;

  const stored = Buffer.from(data.api_key, "hex");
  const computed = Buffer.from(tokenHash, "hex");
  if (stored.length !== computed.length || !timingSafeEqual(stored, computed)) return null;

  // Fire-and-forget: record last usage
  sb.from("gym_settings")
    .update({ api_key_last_used_at: new Date().toISOString() })
    .eq("gym_id", data.gym_id)
    .then(() => {});

  return data.gym_id;
}

function buildServer(gymId: string): McpServer {
  const server = new McpServer({
    name: "FitGrowX",
    version: "1.0.0",
  });

  // ── LECTURA ──────────────────────────────────────────────────────────────

  server.tool(
    "get_gym_summary",
    "Resumen general del gym: alumnos activos, MRR, alumnos por vencer en 7 días y última asistencia registrada.",
    {},
    async () => {
      const denied = await rlGuard(gymId, "get_gym_summary");
      if (denied) return denied;
      const today = new Date().toISOString().slice(0, 10);
      const in7 = new Date(Date.now() + 7 * 864e5).toISOString().slice(0, 10);

      const [
        { data: activos },
        { data: expiring },
        { data: lastCheckin },
        { data: planes },
        { data: settings },
      ] = await Promise.all([
        sb.from("alumnos").select("id, plan_id").eq("gym_id", gymId).eq("status", "active").is("deleted_at", null).eq("is_demo", false),
        sb.from("alumnos").select("id").eq("gym_id", gymId).eq("status", "active").is("deleted_at", null).eq("is_demo", false).lte("next_expiration_date", in7).gte("next_expiration_date", today),
        sb.from("asistencias").select("fecha").eq("gym_id", gymId).order("fecha", { ascending: false }).limit(1).maybeSingle(),
        sb.from("planes").select("id, precio").eq("gym_id", gymId).eq("active", true),
        sb.from("gym_settings").select("gym_name").eq("gym_id", gymId).maybeSingle(),
      ]);

      const planesMap = new Map((planes ?? []).map((p: { id: string; precio: number }) => [p.id, p.precio]));
      const mrr = (activos ?? []).reduce((sum: number, a: { plan_id: string | null }) => {
        return sum + (a.plan_id ? (planesMap.get(a.plan_id) ?? 0) : 0);
      }, 0);

      return {
        content: [{
          type: "text" as const,
          text: JSON.stringify({
            ok: true,
            data: {
              gym_name: settings?.gym_name ?? "—",
              alumnos_activos: activos?.length ?? 0,
              mrr,
              alumnos_por_vencer_7d: expiring?.length ?? 0,
              ultima_asistencia: lastCheckin?.fecha ?? null,
            },
          }),
        }],
      };
    },
  );

  server.tool(
    "list_alumnos",
    "Lista alumnos del gym con filtros opcionales.",
    {
      status: z.enum(["active", "expired", "blocked"]).optional().describe("Filtrar por estado"),
      search: z.string().optional().describe("Buscar por nombre o DNI"),
      limit: z.number().int().min(1).max(100).default(20).describe("Máximo de resultados (default 20)"),
    },
    async ({ status, search, limit }) => {
      const denied = await rlGuard(gymId, "list_alumnos");
      if (denied) return denied;
      let query = sb
        .from("alumnos")
        .select("id, full_name, dni, phone, status, next_expiration_date, planes!plan_id(nombre, precio)")
        .eq("gym_id", gymId)
        .is("deleted_at", null)
        .eq("is_demo", false)
        .order("full_name")
        .limit(limit ?? 20);

      if (status) query = query.eq("status", status);
      if (search) query = query.or(`full_name.ilike.%${search}%,dni.ilike.%${search}%`);

      const { data, error } = await query;
      return {
        content: [{
          type: "text" as const,
          text: JSON.stringify({ ok: !error, data: data ?? [], error: error?.message }),
        }],
      };
    },
  );

  server.tool(
    "get_alumno",
    "Datos completos de un alumno. Buscá por id, nombre o DNI.",
    {
      alumno_id: z.string().optional().describe("UUID del alumno"),
      search: z.string().optional().describe("Nombre o DNI del alumno"),
    },
    async ({ alumno_id, search }) => {
      const denied = await rlGuard(gymId, "get_alumno");
      if (denied) return denied;
      if (!alumno_id && !search) {
        return { content: [{ type: "text" as const, text: JSON.stringify({ ok: false, error: "Necesitás alumno_id o search." }) }] };
      }

      let query = sb
        .from("alumnos")
        .select("id, full_name, dni, phone, status, next_expiration_date, deuda_pendiente, frozen_since, pausa_hasta, plan_id, planes!plan_id(nombre, precio, duracion_dias)")
        .eq("gym_id", gymId)
        .is("deleted_at", null)
        .eq("is_demo", false);

      if (alumno_id) {
        query = query.eq("id", alumno_id);
      } else if (search) {
        query = query.or(`full_name.ilike.%${search}%,dni.ilike.%${search}%`);
      }

      const { data, error } = await query.limit(5);
      return {
        content: [{
          type: "text" as const,
          text: JSON.stringify({ ok: !error, data: data ?? [], error: error?.message }),
        }],
      };
    },
  );

  server.tool(
    "list_expiring",
    "Alumnos que vencen en los próximos N días.",
    {
      days: z.number().int().min(1).max(90).default(7).describe("Días hacia adelante (default 7)"),
    },
    async ({ days }) => {
      const denied = await rlGuard(gymId, "list_expiring");
      if (denied) return denied;
      const today = new Date().toISOString().slice(0, 10);
      const future = new Date(Date.now() + (days ?? 7) * 864e5).toISOString().slice(0, 10);

      const { data, error } = await sb
        .from("alumnos")
        .select("id, full_name, phone, next_expiration_date, planes!plan_id(nombre, precio)")
        .eq("gym_id", gymId)
        .eq("status", "active")
        .is("deleted_at", null)
        .eq("is_demo", false)
        .gte("next_expiration_date", today)
        .lte("next_expiration_date", future)
        .order("next_expiration_date");

      return {
        content: [{
          type: "text" as const,
          text: JSON.stringify({ ok: !error, data: data ?? [], error: error?.message }),
        }],
      };
    },
  );

  server.tool(
    "list_clases",
    "Clases disponibles del gym con horarios y capacidad máxima.",
    {},
    async () => {
      const denied = await rlGuard(gymId, "list_clases");
      if (denied) return denied;
      const { data, error } = await sb
        .from("gym_classes")
        .select("id, class_name, day_of_week, start_time, max_capacity")
        .eq("gym_id", gymId)
        .order("day_of_week")
        .order("start_time");

      const days = ["Domingo", "Lunes", "Martes", "Miércoles", "Jueves", "Viernes", "Sábado"];
      const enriched = (data ?? []).map((c: { id: string; class_name: string; day_of_week: number; start_time: string; max_capacity: number }) => ({
        ...c,
        day_name: days[c.day_of_week] ?? `Día ${c.day_of_week}`,
      }));

      return {
        content: [{
          type: "text" as const,
          text: JSON.stringify({ ok: !error, data: enriched, error: error?.message }),
        }],
      };
    },
  );

  server.tool(
    "get_payments_summary",
    "Resumen de pagos del mes actual: cobrado, pendiente y vencido.",
    {},
    async () => {
      const denied = await rlGuard(gymId, "get_payments_summary");
      if (denied) return denied;
      const now = new Date();
      const firstDay = new Date(now.getFullYear(), now.getMonth(), 1).toISOString().slice(0, 10);
      const lastDay = new Date(now.getFullYear(), now.getMonth() + 1, 0).toISOString().slice(0, 10);

      const { data, error } = await sb
        .from("pagos")
        .select("amount, status, date")
        .eq("gym_id", gymId)
        .gte("date", firstDay)
        .lte("date", lastDay);

      if (error) {
        return { content: [{ type: "text" as const, text: JSON.stringify({ ok: false, error: error.message }) }] };
      }

      const summary = (data ?? []).reduce(
        (acc: { cobrado: number; pendiente: number; vencido: number }, p: { amount: number; status: string }) => {
          if (p.status === "validado") acc.cobrado += p.amount;
          else if (p.status === "pendiente") acc.pendiente += p.amount;
          else if (p.status === "vencido") acc.vencido += p.amount;
          return acc;
        },
        { cobrado: 0, pendiente: 0, vencido: 0 },
      );

      return {
        content: [{
          type: "text" as const,
          text: JSON.stringify({ ok: true, data: { mes: `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`, ...summary } }),
        }],
      };
    },
  );

  // ── ESCRITURA ─────────────────────────────────────────────────────────────

  server.tool(
    "send_whatsapp",
    "Envía un mensaje de WhatsApp a un alumno.",
    {
      alumno_id: z.string().uuid().describe("UUID del alumno"),
      mensaje: z.string().min(1).max(4000).describe("Mensaje a enviar"),
    },
    async ({ alumno_id, mensaje }) => {
      const denied = await rlGuard(gymId, "send_whatsapp");
      if (denied) return denied;
      const { data: alumno } = await sb
        .from("alumnos")
        .select("full_name, phone")
        .eq("id", alumno_id)
        .eq("gym_id", gymId)
        .is("deleted_at", null)
        .maybeSingle();

      if (!alumno) return { content: [{ type: "text" as const, text: JSON.stringify({ ok: false, error: "Alumno no encontrado." }) }] };
      if (!alumno.phone) return { content: [{ type: "text" as const, text: JSON.stringify({ ok: false, error: "El alumno no tiene teléfono." }) }] };

      const result = await sendWa(gymId, normalizePhone(alumno.phone), mensaje, { route: "mcp/send_whatsapp" });
      return {
        content: [{
          type: "text" as const,
          text: JSON.stringify({ ok: result.ok, message: result.ok ? `Mensaje enviado a ${alumno.full_name}.` : "Error al enviar el mensaje." }),
        }],
      };
    },
  );

  server.tool(
    "create_payment_link",
    "Genera un link de pago para que el alumno pague su membresía.",
    {
      alumno_id: z.string().uuid().describe("UUID del alumno"),
      monto: z.number().positive().describe("Monto en la moneda local"),
      descripcion: z.string().optional().describe("Descripción del pago"),
    },
    async ({ alumno_id, monto, descripcion }) => {
      const denied = await rlGuard(gymId, "create_payment_link");
      if (denied) return denied;
      const { data: alumno } = await sb
        .from("alumnos")
        .select("full_name, phone, plan_id")
        .eq("id", alumno_id)
        .eq("gym_id", gymId)
        .is("deleted_at", null)
        .maybeSingle();

      if (!alumno) return { content: [{ type: "text" as const, text: JSON.stringify({ ok: false, error: "Alumno no encontrado." }) }] };

      const { randomUUID } = await import("crypto");
      const rawToken = randomUUID();
      const tokenHash = createHash("sha256").update(rawToken).digest("hex");
      const expiresAt = new Date(Date.now() + 30 * 24 * 3600 * 1000).toISOString();

      const { error } = await sb.from("alumno_tokens").insert({
        alumno_id,
        gym_id: gymId,
        token: tokenHash,
        expires_at: expiresAt,
        type: "pago",
      });

      if (error) return { content: [{ type: "text" as const, text: JSON.stringify({ ok: false, error: error.message }) }] };

      const url = `${APP_URL}/pagar/${rawToken}?monto=${monto}${descripcion ? `&desc=${encodeURIComponent(descripcion)}` : ""}`;
      return {
        content: [{
          type: "text" as const,
          text: JSON.stringify({ ok: true, data: { link: url, alumno: alumno.full_name, monto, descripcion } }),
        }],
      };
    },
  );

  server.tool(
    "update_alumno_status",
    "Cambia el estado de un alumno (active, expired, blocked).",
    {
      alumno_id: z.string().uuid().describe("UUID del alumno"),
      status: z.enum(["active", "expired", "blocked"]).describe("Nuevo estado"),
      motivo: z.string().optional().describe("Motivo del cambio (se guarda en notas internas)"),
    },
    async ({ alumno_id, status, motivo }) => {
      const denied = await rlGuard(gymId, "update_alumno_status");
      if (denied) return denied;
      const { data: alumno } = await sb
        .from("alumnos")
        .select("full_name, status")
        .eq("id", alumno_id)
        .eq("gym_id", gymId)
        .is("deleted_at", null)
        .maybeSingle();

      if (!alumno) return { content: [{ type: "text" as const, text: JSON.stringify({ ok: false, error: "Alumno no encontrado." }) }] };

      const updatePayload: Record<string, unknown> = { status };
      if (motivo) updatePayload.notas = motivo;

      const { error } = await sb
        .from("alumnos")
        .update(updatePayload)
        .eq("id", alumno_id)
        .eq("gym_id", gymId);

      return {
        content: [{
          type: "text" as const,
          text: JSON.stringify({
            ok: !error,
            message: error ? error.message : `${alumno.full_name}: estado cambiado de ${alumno.status} → ${status}.`,
          }),
        }],
      };
    },
  );

  server.tool(
    "assign_rutina",
    "Asigna o actualiza la rutina de un alumno.",
    {
      alumno_id: z.string().uuid().describe("UUID del alumno"),
      nombre: z.string().min(1).describe("Nombre de la rutina"),
      ejercicios: z.array(z.record(z.string(), z.unknown())).describe("Lista de ejercicios con sets, reps, peso, etc."),
      notas: z.string().optional().describe("Notas adicionales para el alumno"),
    },
    async ({ alumno_id, nombre, ejercicios, notas }) => {
      const denied = await rlGuard(gymId, "assign_rutina");
      if (denied) return denied;
      const { data: alumno } = await sb
        .from("alumnos")
        .select("full_name")
        .eq("id", alumno_id)
        .eq("gym_id", gymId)
        .is("deleted_at", null)
        .maybeSingle();

      if (!alumno) return { content: [{ type: "text" as const, text: JSON.stringify({ ok: false, error: "Alumno no encontrado." }) }] };

      const { error } = await sb.from("rutinas").upsert(
        { gym_id: gymId, alumno_id, nombre, ejercicios, notas: notas ?? null, updated_at: new Date().toISOString() },
        { onConflict: "alumno_id" },
      );

      return {
        content: [{
          type: "text" as const,
          text: JSON.stringify({
            ok: !error,
            message: error ? error.message : `Rutina "${nombre}" asignada a ${alumno.full_name}.`,
          }),
        }],
      };
    },
  );

  server.tool(
    "send_bulk_whatsapp",
    "Envía un mensaje de WhatsApp a un grupo de alumnos. Máximo 50 por llamada.",
    {
      filter: z.enum(["expiring_7d", "expired", "inactive_30d"]).describe(
        "expiring_7d: vencen en 7 días · expired: vencidos · inactive_30d: sin asistencia en 30 días",
      ),
      mensaje: z.string().min(1).max(4000).describe("Mensaje a enviar (podés usar {nombre} y {gym})"),
    },
    async ({ filter, mensaje }) => {
      const denied = await rlGuard(gymId, "send_bulk_whatsapp");
      if (denied) return denied;
      const { data: gymSettings } = await sb
        .from("gym_settings")
        .select("gym_name")
        .eq("gym_id", gymId)
        .maybeSingle();

      const gymName = gymSettings?.gym_name ?? "el gym";

      let alumnos: { id: string; full_name: string; phone: string | null }[] = [];

      if (filter === "expiring_7d") {
        const today = new Date().toISOString().slice(0, 10);
        const in7 = new Date(Date.now() + 7 * 864e5).toISOString().slice(0, 10);
        const { data } = await sb
          .from("alumnos")
          .select("id, full_name, phone")
          .eq("gym_id", gymId)
          .eq("status", "active")
          .is("deleted_at", null)
          .eq("is_demo", false)
          .gte("next_expiration_date", today)
          .lte("next_expiration_date", in7);
        alumnos = data ?? [];
      } else if (filter === "expired") {
        const { data } = await sb
          .from("alumnos")
          .select("id, full_name, phone")
          .eq("gym_id", gymId)
          .eq("status", "expired")
          .is("deleted_at", null)
          .eq("is_demo", false);
        alumnos = data ?? [];
      } else if (filter === "inactive_30d") {
        const cutoff = new Date(Date.now() - 30 * 864e5).toISOString().slice(0, 10);
        const { data: activeAlumnos } = await sb
          .from("alumnos")
          .select("id, full_name, phone")
          .eq("gym_id", gymId)
          .eq("status", "active")
          .is("deleted_at", null)
          .eq("is_demo", false);

        if (activeAlumnos && activeAlumnos.length > 0) {
          const ids = activeAlumnos.map((a: { id: string }) => a.id);
          const { data: recent } = await sb
            .from("asistencias")
            .select("alumno_id")
            .eq("gym_id", gymId)
            .gte("fecha", cutoff)
            .in("alumno_id", ids);

          const recentSet = new Set((recent ?? []).map((r: { alumno_id: string }) => r.alumno_id));
          alumnos = activeAlumnos.filter((a: { id: string }) => !recentSet.has(a.id));
        }
      }

      const MAX = 50;
      const targets = alumnos.filter((a) => a.phone).slice(0, MAX);

      if (targets.length === 0) {
        return { content: [{ type: "text" as const, text: JSON.stringify({ ok: true, sent: 0, message: "No hay alumnos en ese grupo o ninguno tiene teléfono." }) }] };
      }

      let sent = 0;
      let failed = 0;
      for (const alumno of targets) {
        const msg = mensaje
          .replace(/{nombre}/g, alumno.full_name)
          .replace(/{gym}/g, gymName);
        const res = await sendWa(gymId, normalizePhone(alumno.phone!), msg, { route: "mcp/send_bulk_whatsapp" });
        if (res.ok) sent++;
        else failed++;
      }

      return {
        content: [{
          type: "text" as const,
          text: JSON.stringify({
            ok: true,
            data: { sent, failed, total: targets.length, capped: alumnos.filter((a) => a.phone).length > MAX },
            message: `Mensajes enviados: ${sent}/${targets.length}.`,
          }),
        }],
      };
    },
  );

  return server;
}

async function handleMcp(req: NextRequest): Promise<Response> {
  const gymId = await getGymIdFromApiKey(req);
  if (!gymId) {
    return new Response(JSON.stringify({ error: "API key inválida o ausente." }), {
      status: 401,
      headers: { "Content-Type": "application/json" },
    });
  }

  const server = buildServer(gymId);
  const transport = new WebStandardStreamableHTTPServerTransport({
    sessionIdGenerator: undefined,
    enableJsonResponse: true,
  });

  await server.connect(transport);

  try {
    return await transport.handleRequest(req);
  } finally {
    await server.close();
  }
}

export const GET = handleMcp;
export const POST = handleMcp;
export const DELETE = handleMcp;
