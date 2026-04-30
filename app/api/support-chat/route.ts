import { NextRequest, NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase-server";

const SYSTEM_PROMPT = `Sos el asistente de soporte de FitGrowX, una plataforma de gestión para gimnasios y boxes en Argentina.

Tu trabajo es ayudar a los usuarios (dueños de gym) a resolver dudas sobre cómo usar la plataforma.

Módulos principales que podés explicar:
- Alumnos: alta, baja, fichas, historial
- Clases: creación, horarios, reservas
- Membresías: planes, asignación, vencimientos
- Pagos y egresos: registro, historial
- Automatizaciones: mensajes automáticos, recordatorios
- Prospectos: seguimiento de leads
- Campañas: publicidad
- Bóveda: recursos y tutoriales
- Ajustes: configuración del gimnasio, logo, datos
- Escáner QR: check-in de alumnos
- Suscripción: planes de FitGrowX

ESTILO:
- Directo y simple
- Máx 3-4 líneas por respuesta
- Español argentino natural
- Si no sabés algo, decís "Escribinos a soporte@fitgrowx.com y te ayudamos"`;

export async function POST(req: NextRequest) {
  const { default: OpenAI } = await import("openai");
  const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY_FITGROWX });

  const supabase = await createSupabaseServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "No autorizado." }, { status: 401 });

  const { messages } = await req.json();
  if (!Array.isArray(messages)) {
    return NextResponse.json({ error: "messages required" }, { status: 400 });
  }

  const completion = await openai.chat.completions.create({
    model: "gpt-4o-mini",
    messages: [{ role: "system", content: SYSTEM_PROMPT }, ...messages],
    max_tokens: 300,
  });

  return NextResponse.json({ reply: completion.choices[0].message.content });
}
