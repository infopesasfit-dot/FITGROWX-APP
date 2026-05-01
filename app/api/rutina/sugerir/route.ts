import { NextRequest, NextResponse } from "next/server";
import OpenAI from "openai";

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY_FITGROWX });

export async function POST(req: NextRequest) {
  const { objetivo, alumno_name, notas, tipo, modalidad, time_cap } = await req.json();

  const notasExtra = notas?.trim() ? `\nIndicaciones adicionales del coach: "${notas}"` : "";

  if (tipo === "wod") {
    const mod = modalidad ?? "AMRAP";
    const cap = time_cap ?? "15";
    const prompt = `Eres un coach de CrossFit experto. Generá un WOD de CrossFit en formato ${mod} de ${cap} minutos para ${alumno_name ?? "el atleta"}.${notasExtra}

Devolvé SOLO un JSON válido con esta estructura exacta (sin markdown, sin texto extra):
{
  "nombre": "Nombre del WOD",
  "modalidad": "${mod}",
  "time_cap": "${cap}",
  "movimientos": [
    { "nombre": "Thruster", "reps": "21" },
    { "nombre": "Pull-up", "reps": "15" }
  ]
}

Reglas:
- Entre 3 y 6 movimientos funcionales
- Reps en formato string (puede ser "21-15-9", "10 cal", "400m", "AMRAP", etc.)
- Movimientos típicos de CrossFit: Thruster, Wall Ball, Box Jump, Burpee, Clean, Snatch, Pull-up, Row, Double Under, etc.
- Nombre del WOD en español o hero WOD en inglés si aplica
- El tiempo total debe ser coherente con la modalidad y los movimientos`;

    try {
      const completion = await openai.chat.completions.create({
        model: "gpt-4o-mini",
        messages: [{ role: "user", content: prompt }],
        temperature: 0.8,
        max_completion_tokens: 500,
      });
      const raw = completion.choices[0]?.message?.content ?? "";
      const cleaned = raw.replace(/```json|```/g, "").trim();
      const parsed = JSON.parse(cleaned);
      return NextResponse.json({ ok: true, tipo: "wod", nombre: parsed.nombre, modalidad: parsed.modalidad, time_cap: parsed.time_cap, movimientos: parsed.movimientos });
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      console.error("[rutina/sugerir wod]", msg);
      return NextResponse.json({ ok: false, error: `Error al generar el WOD: ${msg}` }, { status: 500 });
    }
  }

  if (!objetivo) return NextResponse.json({ error: "Objetivo requerido." }, { status: 400 });

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
      max_completion_tokens: 800,
    });
    const raw = completion.choices[0]?.message?.content ?? "";
    const cleaned = raw.replace(/```json|```/g, "").trim();
    const parsed = JSON.parse(cleaned);
    return NextResponse.json({ ok: true, nombre: parsed.nombre, ejercicios: parsed.ejercicios });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error("[rutina/sugerir]", msg);
    return NextResponse.json({ ok: false, error: `Error al generar la rutina: ${msg}` }, { status: 500 });
  }
}
