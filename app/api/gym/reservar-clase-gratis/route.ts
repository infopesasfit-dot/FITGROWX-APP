import { NextRequest, NextResponse } from "next/server";
import { getSupabaseAdminClient } from "@/lib/supabase-admin";
import { applyRateLimit, getClientIp, normalizeIdentifier } from "@/lib/request-security";
import { normalizePhone } from "@/lib/phone";
import { sendWa } from "@/lib/wa";
import { getTodayDate } from "@/lib/date-utils";

const supabase = getSupabaseAdminClient();

async function findProspecto(gym_id: string, phoneNorm: string) {
  const { data } = await supabase
    .from("prospectos")
    .select("id, full_name, phone, clase_gratis_date, clase_gratis_status")
    .eq("gym_id", gym_id)
    .not("phone", "is", null)
    .gte("created_at", new Date(Date.now() - 90 * 24 * 60 * 60 * 1000).toISOString());
  return (data ?? []).find(p => normalizePhone(p.phone) === phoneNorm) ?? null;
}

export async function POST(req: NextRequest) {
  const ip = getClientIp(req);
  const limit = await applyRateLimit({
    namespace: "reservar-clase-gratis:ip",
    identifier: normalizeIdentifier(ip),
    windowMs: 10 * 60 * 1000,
    maxAttempts: 15,
  });
  if (!limit.allowed) {
    return NextResponse.json({ error: "Demasiados intentos. Probá de nuevo en unos minutos." }, { status: 429 });
  }

  const { gym_id, phone, name, clase_id, fecha, hora, clase_nombre } = await req.json();
  if (!gym_id || !phone) {
    return NextResponse.json({ error: "Parámetros faltantes." }, { status: 400 });
  }

  const phoneNorm = normalizePhone(phone);
  let prospecto = await findProspecto(gym_id, phoneNorm);

  // Auto-create prospecto if not found and name provided (self-service "Soy nuevo" flow)
  if (!prospecto) {
    if (!name?.trim()) {
      return NextResponse.json({ error: "No encontramos tu registro. Ingresá tu nombre para continuar." }, { status: 404 });
    }
    const { data: created } = await supabase
      .from("prospectos")
      .insert({ gym_id, full_name: name.trim(), phone: phoneNorm, status: "pendiente", contactos_step: 0 })
      .select("id, full_name, phone, clase_gratis_date, clase_gratis_status")
      .single();
    if (!created) return NextResponse.json({ error: "No se pudo registrar. Intentá de nuevo." }, { status: 500 });
    prospecto = created;
    // In-app notification for gym
    void supabase.from("notifications").insert({
      gym_id,
      type: "new_prospecto",
      title: `Nuevo prospecto: ${name.trim()}`,
      body: phone,
    });
  }

  // Lookup only — no fecha provided
  if (!fecha) {
    return NextResponse.json({ ok: true, nombre: prospecto.full_name.split(" ")[0] });
  }

  if (fecha < getTodayDate()) {
    return NextResponse.json({ error: "No podés reservar en fechas pasadas." }, { status: 400 });
  }

  // Save reservation
  await supabase.from("prospectos").update({
    clase_gratis_date:   fecha,
    clase_gratis_status: "registrado",
    followup_step:       0,
  }).eq("id", prospecto.id);

  const { data: settings } = await supabase
    .from("gym_settings")
    .select("gym_name")
    .eq("gym_id", gym_id)
    .maybeSingle();

  const gymName  = settings?.gym_name ?? "el gym";
  const nombre   = prospecto.full_name.split(" ")[0];
  const fechaFmt = new Date(fecha + "T12:00:00").toLocaleDateString("es-AR", { weekday: "long", day: "numeric", month: "long" });

  // WA confirmation to prospecto
  {
    const horaPart = hora ? ` a las *${hora}*` : "";
    const clasePart = clase_nombre ? ` — *${clase_nombre}*` : "";
    const msg = `✅ ¡Perfecto, ${nombre}! Tu clase de prueba en *${gymName}* queda confirmada para el *${fechaFmt}*${horaPart}${clasePart}.\n\n¡Te esperamos! 💪`;
    void sendWa(gym_id, phoneNorm, msg, { route: "gym/reservar-clase-gratis" });
  }

  // In-app notification for gym
  try {
    const body = `${fechaFmt}${hora ? ` a las ${hora}` : ""}${clase_nombre ? ` — ${clase_nombre}` : ""}`;
    await supabase.from("notifications").insert({
      gym_id,
      type:  "clase_gratis_agendada",
      title: `Clase de prueba agendada: ${prospecto.full_name}`,
      body,
    });
  } catch { /* non-fatal */ }

  return NextResponse.json({ ok: true, nombre });
}
