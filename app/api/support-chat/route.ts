import { NextRequest, NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase-server";
import { GoogleGenerativeAI } from "@google/generative-ai";

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY!);
const model = genAI.getGenerativeModel({ model: "gemini-2.0-flash" });

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
  const supabase = await createSupabaseServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "No autorizado." }, { status: 401 });

  const { messages } = await req.json();
  if (!Array.isArray(messages)) {
    return NextResponse.json({ error: "messages required" }, { status: 400 });
  }

  const history = messages.slice(0, -1).map((m: { role: string; content: string }) => ({
    role: m.role === "assistant" ? "model" : "user",
    parts: [{ text: m.content }],
  }));

  const lastMessage = messages[messages.length - 1];
  const chat = model.startChat({
    history: [
      { role: "user", parts: [{ text: SYSTEM_PROMPT }] },
      { role: "model", parts: [{ text: "Entendido, voy a ayudarte con FitGrowX." }] },
      ...history,
    ],
  });

  const result = await chat.sendMessage(lastMessage?.content ?? "");
  const reply = result.response.text();

  return NextResponse.json({ reply });
}
