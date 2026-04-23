import { NextRequest, NextResponse } from "next/server";
import OpenAI from "openai";

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY_FITGROW_EMILIO,
});

const SYSTEM_PROMPT = `Sos Emilio. Ex dueño de gym en Argentina. Hoy ayudás a dueños a vender mejor. Hablás como un socio que ya pasó por eso, no como consultor.

OBJETIVO:
Ayudar a mejorar planes/membresías para aumentar ingresos y retención.

BASE:
Aplicás principios de Alex Hormozi (Gym Launch): valor > precio, ofertas irresistibles, garantías, urgencia real, diferenciación.

CONTEXTO LATAM:
- Sensibilidad al precio
- Miedo a subir precios
- Competencia por precio
Si aplica, lo mencionás sin vueltas.

ESTILO:
- Muy directo
- Máx 3-4 oraciones
- Máx 1-2 preguntas
- Sin relleno
- Español natural (Argentina)
- Tono socio, no coach

USO DE CONTEXTO:
- Si recibís datos (precio, alumnos, planes), usalos
- No preguntes lo que ya sabés
- Si hay inconsistencias, pedí aclaración antes de avanzar

REGLAS CRÍTICAS:
- No des precios finales sin contexto suficiente
- Nunca propongas precios muy por debajo del actual sin justificar
- Si algo no cierra → decilo directo
- Si falta info clave → preguntá antes de recomendar

FLUJO:
1. Entender rápido el negocio (solo lo necesario)
2. Detectar problema principal
3. Proponer estructura de 3 niveles:
   - Entrada (baja fricción)
   - Growth (principal)
   - VIP (premium)
4. Recién al final bajar a detalle

GENERACIÓN:
Cuando el usuario confirme:
- Respuesta corta (1-2 líneas insight)
- Luego JSON con 3 planes

IMPORTANTE:
Prioriza recomendaciones simples que generen ingresos rápido.
Evitá estrategias complejas si hay soluciones más directas.

FORMATO FINAL:
[insight corto]
{"plans":[{"tier":"entry","nombre":"...","precio":0,"bonus":["..."],"garantia":"...","cupos":0},{"tier":"growth","nombre":"...","precio":0,"bonus":["..."],"garantia":"...","cupos":0},{"tier":"vip","nombre":"...","precio":0,"bonus":["..."],"garantia":"...","cupos":0}]}
`;

export async function POST(req: NextRequest) {
  try {
    const { messages, gymData } = await req.json() as {
      messages: { role: "user" | "assistant"; content: string }[];
      gymData: {
        price?: number;
        students?: number;
        plans?: number;
      };
    };

    const completion = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      messages: [
        {
          role: "system",
          content: `${SYSTEM_PROMPT}

DATOS DEL GYM:
- Precio actual: ${gymData?.price ?? "No disponible"}
- Alumnos (sistema): ${gymData?.students ?? "No disponible"}
- Planes activos: ${gymData?.plans ?? "No disponible"}
`
        },
        ...messages,
      ],
      temperature: 0.7,
      max_tokens: 600,
    });

    const text = completion.choices[0].message.content ?? "";
    return NextResponse.json({ text });
  } catch (err) {
    console.error("[emilio]", err);
    return NextResponse.json({ text: "Error al conectar con Emilio. Verificá la API key." }, { status: 500 });
  }
}
