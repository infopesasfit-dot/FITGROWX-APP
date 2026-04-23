import { NextRequest, NextResponse } from "next/server";
import OpenAI from "openai";

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY_FITGROW_EMILIO });

export async function POST(req: NextRequest) {
  const { objetivo, alumno_name, notas } = await req.json();
  if (!objetivo) return NextResponse.json({ error: "Objetivo requerido." }, { status: 400 });

  const notasExtra = notas?.trim() ? `\nIndicaciones adicionales del coach: "${notas}"` : "";

  const prompt = `Eres un entrenador personal experto. Creá una rutina de gimnasio para ${alumno_name ?? "el alumno"} con objetivo de ${objetivo}.${notasExtra}

Devolvé SOLO un JSON válido con esta estructura exacta (sin markdown, sin texto extra):
{
  "nombre": "Nombre descriptivo de la rutina",
  "ejercicios": [
    {
      "nombre": "Nombre del ejercicio",
      "series": 4,
      "repeticiones": 12,
      "peso_sugerido": "20kg",
      "descanso": "60s"
    }
  ]
}

Reglas:
- Entre 6 y 8 ejercicios
- Orden lógico (calentamiento → compuesto → aislado)
- descanso en formato "Xs" (ej: "60s", "90s", "120s")
- peso_sugerido en kg o como referencia (ej: "Peso corporal", "15-20kg")
- Nombre de rutina en español, específico para el objetivo`;

  try {
    const completion = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      messages: [{ role: "user", content: prompt }],
      temperature: 0.7,
      max_tokens: 800,
    });

    const raw = completion.choices[0]?.message?.content ?? "";
    const cleaned = raw.replace(/```json|```/g, "").trim();
    const parsed = JSON.parse(cleaned);

    return NextResponse.json({ ok: true, nombre: parsed.nombre, ejercicios: parsed.ejercicios });
  } catch (err) {
    console.error("[rutina/sugerir]", err);
    return NextResponse.json({ ok: false, error: "No se pudo generar la rutina. Intentá de nuevo." }, { status: 500 });
  }
}
