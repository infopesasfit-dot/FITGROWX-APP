import { NextRequest, NextResponse } from "next/server";
import { GoogleGenerativeAI } from "@google/generative-ai";

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY!);
const model = genAI.getGenerativeModel({ model: "gemini-2.0-flash" });

export async function POST(req: NextRequest) {
  try {
    const { planes, cpl, roas } = await req.json() as {
      planes?: string;
      cpl?: number;
      roas?: string;
    };

    const prompt = `Actuá como especialista en marketing para gimnasios en Argentina.

Datos del gym:
- Planes activos: ${planes ?? "anual"}
- CPL actual: $${cpl ?? 242}
- ROAS: ${roas ?? "3.8x"}

Generá exactamente 3 textos cortos para anuncios de Instagram. Cada texto máximo 3 líneas. Sin hashtags. Sin emojis. Español argentino natural. Muy directos.

Estilos:
1. "Persuasivo": beneficio emocional de vida, transformación
2. "Directo": propuesta de valor concreta, qué ganás
3. "Urgencia": escasez real, tiempo limitado, acción ahora

Respondé SOLO con este JSON sin ningún texto extra ni markdown:
{"copies":[{"estilo":"Persuasivo","texto":"..."},{"estilo":"Directo","texto":"..."},{"estilo":"Urgencia","texto":"..."}]}`;

    const result = await model.generateContent(prompt);
    const raw = result.response.text();
    const cleaned = raw.replace(/```json|```/g, "").trim();
    const match = cleaned.match(/\{[\s\S]*\}/);
    const json = match ? JSON.parse(match[0]) : { copies: [] };
    return NextResponse.json(json);
  } catch (err) {
    console.error("[chatgpt-ads]", err);
    return NextResponse.json({ copies: [] }, { status: 500 });
  }
}
