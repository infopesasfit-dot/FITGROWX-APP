import { NextRequest, NextResponse } from "next/server";
export async function POST(req: NextRequest) {
  const { default: OpenAI } = await import("openai");
  const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY_FITGROWX });
  try {
    const { planes, cpl, roas } = await req.json() as {
      planes?: string;
      cpl?: number;
      roas?: string;
    };

    const prompt = `Sos Emilio. Experto en marketing para gimnasios en Argentina.

Datos del gym:
- Planes activos: ${planes ?? "mensual, trimestral, anual"}
- CPL actual: $${cpl ?? 242}
- ROAS: ${roas ?? "3.8x"}

Generá exactamente 3 textos cortos para anuncios de Instagram. Cada texto máximo 3 líneas. Sin hashtags. Sin emojis. Español argentino natural. Muy directos.

Estilos:
1. "Persuasivo": beneficio emocional de vida, transformación
2. "Directo": propuesta de valor concreta, qué ganás
3. "Urgencia": escasez real, tiempo limitado, acción ahora

Respondé SOLO con este JSON sin ningún texto extra:
{"copies":[{"estilo":"Persuasivo","texto":"..."},{"estilo":"Directo","texto":"..."},{"estilo":"Urgencia","texto":"..."}]}`;

    const completion = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      messages: [{ role: "user", content: prompt }],
      temperature: 0.88,
      max_tokens: 450,
    });

    const raw = completion.choices[0].message.content ?? "{}";
    const match = raw.match(/\{[\s\S]*\}/);
    const json = match ? JSON.parse(match[0]) : { copies: [] };
    return NextResponse.json(json);
  } catch (err) {
    console.error("[emilio-ads]", err);
    return NextResponse.json({ copies: [] }, { status: 500 });
  }
}
