import { NextResponse } from "next/server";
import { createSupabaseServerClient , requireUser } from "@/lib/supabase-server";
import { getSupabaseAdminClient } from "@/lib/supabase-admin";
import { getTodayDate } from "@/lib/date-utils";

const TIPO_LABEL: Record<string, string> = {
  vencimiento:    "Recordatorio de vencimiento",
  inactivo:       "Alerta de inactividad",
  cumple:         "Felicitación de cumpleaños",
  clase_gratis:   "Seguimiento clase gratis",
  nuevo_contacto: "Seguimiento nuevo contacto",
  bienvenida:     "Bienvenida enviada",
};

export async function GET() {
  const supabase = await createSupabaseServerClient();
  const user = await requireUser();
  if (!user) return NextResponse.json({ ok: false }, { status: 401 });

  const admin = getSupabaseAdminClient();
  const { data: profile } = await admin
    .from("profiles")
    .select("gym_id, role")
    .eq("id", user.id)
    .maybeSingle();

  if (!profile?.gym_id || !["admin", "staff", "platform_owner"].includes(profile.role ?? "")) {
    return NextResponse.json({ ok: false }, { status: 403 });
  }

  const gymId = profile.gym_id;
  const todayStr = getTodayDate();
  const todayStart = `${todayStr}T00:00:00Z`;
  const todayEnd   = `${todayStr}T23:59:59Z`;

  const [{ data: waLogs }, { data: pagosHoy }, { data: vencimientosHoy }] = await Promise.all([
    admin.from("wa_mensajes_log")
      .select("id, tipo, alumno_name, sent_at")
      .eq("gym_id", gymId)
      .gte("sent_at", todayStart)
      .lte("sent_at", todayEnd)
      .order("sent_at", { ascending: false })
      .limit(20),
    admin.from("pagos")
      .select("id, amount, date, alumno_id, alumnos!alumno_id(full_name)")
      .eq("gym_id", gymId)
      .eq("date", todayStr)
      .eq("status", "validado")
      .eq("concepto", "membresia")
      .order("created_at", { ascending: false })
      .limit(10),
    admin.from("alumnos")
      .select("id, full_name")
      .eq("gym_id", gymId)
      .eq("next_expiration_date", todayStr)
      .eq("status", "activo")
      .is("deleted_at", null),
  ]);

  // Build unified feed sorted by time descending
  type FeedItem = { ts: string; tipo: "wa" | "pago"; label: string; name: string };
  const feed: FeedItem[] = [];

  for (const row of waLogs ?? []) {
    feed.push({
      ts:    row.sent_at,
      tipo:  "wa",
      label: TIPO_LABEL[row.tipo] ?? "Mensaje enviado",
      name:  row.alumno_name ?? "—",
    });
  }

  const pagosSet = new Set((pagosHoy ?? []).map(p => {
    const nombre = (p.alumnos as unknown as { full_name: string } | null)?.full_name ?? "—";
    feed.push({ ts: `${todayStr}T${new Date().toISOString().slice(11)}`, tipo: "pago", label: "Pago recibido", name: nombre });
    return p.alumno_id as string;
  }));

  feed.sort((a, b) => b.ts.localeCompare(a.ts));

  // Stats for the monitor header
  const msgHoy = (waLogs ?? []).length;
  const vencHoy = (vencimientosHoy ?? []).length;
  const pagosHoyCount = pagosSet.size;

  return NextResponse.json({
    ok: true,
    msgHoy,
    vencHoy,
    pagosHoyCount,
    feed: feed.slice(0, 12),
  });
}
