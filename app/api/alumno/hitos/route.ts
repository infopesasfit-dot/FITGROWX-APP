import { NextRequest, NextResponse } from "next/server";
import { getValidAlumnoToken } from "@/lib/alumno-token";
import { getSupabaseAdminClient } from "@/lib/supabase-admin";
import { createHmac } from "crypto";

const sb = getSupabaseAdminClient();

const THRESHOLDS: { key: string; type: "asist" | "dias"; value: number }[] = [
  { key: "asist_10",  type: "asist", value: 10  },
  { key: "asist_30",  type: "asist", value: 30  },
  { key: "asist_50",  type: "asist", value: 50  },
  { key: "asist_100", type: "asist", value: 100 },
  { key: "asist_200", type: "asist", value: 200 },
  { key: "dias_30",   type: "dias",  value: 30  },
  { key: "dias_90",   type: "dias",  value: 90  },
  { key: "dias_180",  type: "dias",  value: 180 },
  { key: "dias_365",  type: "dias",  value: 365 },
];

const LABELS: Record<string, string> = {
  asist_10:  "10 clases",    asist_30:  "30 clases",    asist_50: "50 clases",
  asist_100: "100 clases",   asist_200: "200 clases",
  dias_30:   "1 mes activo", dias_90:   "3 meses",      dias_180: "6 meses", dias_365: "1 año",
};

function sign(alumnoId: string, hito: string): string {
  const secret = process.env.SHARE_CARD_SECRET ?? "fitgrowx-share-secret";
  return createHmac("sha256", secret).update(`${alumnoId}:${hito}`).digest("hex").slice(0, 16);
}

// GET — detecta hitos nuevos, los guarda y dispara WA
export async function GET(req: NextRequest) {
  const tokenRow = await getValidAlumnoToken(req);
  if (!tokenRow) return NextResponse.json({ hitos: [] });

  const { alumno_id, gym_id } = tokenRow;

  // Obtener total de asistencias y primera fecha
  const [{ count: totalAsist }, { data: firstAsist }, { data: existing }, { data: alumno }, { data: settings }] =
    await Promise.all([
      sb.from("asistencias").select("id", { count: "exact", head: true }).eq("alumno_id", alumno_id),
      sb.from("asistencias").select("fecha").eq("alumno_id", alumno_id).order("fecha", { ascending: true }).limit(1),
      sb.from("alumno_hitos").select("hito").eq("alumno_id", alumno_id),
      sb.from("alumnos").select("full_name, phone").eq("id", alumno_id).maybeSingle(),
      sb.from("gym_settings").select("gym_name, accent_color, whatsapp").eq("gym_id", gym_id).maybeSingle(),
    ]);

  const reached    = new Set((existing ?? []).map((r: { hito: string }) => r.hito));
  const diasActivo = firstAsist?.[0]?.fecha
    ? Math.floor((Date.now() - new Date(firstAsist[0].fecha).getTime()) / 86_400_000)
    : 0;

  const newHitos: string[] = [];

  for (const t of THRESHOLDS) {
    if (reached.has(t.key)) continue;
    const met = t.type === "asist" ? (totalAsist ?? 0) >= t.value : diasActivo >= t.value;
    if (met) newHitos.push(t.key);
  }

  if (newHitos.length === 0) return NextResponse.json({ hitos: [] });

  // Insertar nuevos hitos
  await sb.from("alumno_hitos").insert(
    newHitos.map(h => ({ alumno_id, gym_id, hito: h }))
  );

  // Disparar WA para cada hito (fire-and-forget)
  const motorUrl  = process.env.WA_MOTOR_URL;
  const appUrl    = process.env.NEXT_PUBLIC_APP_URL ?? "https://fitgrowx.com";
  const phone     = alumno?.phone;
  const firstName = (alumno?.full_name ?? "").split(" ")[0];
  const gymName   = settings?.gym_name ?? "tu gym";

  if (motorUrl && phone) {
    for (const h of newHitos) {
      const cardUrl = `${appUrl}/api/alumno/share-card?a=${alumno_id}&h=${h}&s=${sign(alumno_id, h)}`;
      const label   = LABELS[h] ?? h;
      const message =
        `🏆 *¡${firstName}, llegaste a ${label} en ${gymName}!*\n\n` +
        `🎴 Mirá tu tarjeta de logro:\n${cardUrl}\n\n` +
        `Subíla a tus Stories 📸 ¡A seguir! 💪`;

      fetch(`${motorUrl}/send/${gym_id}`, {
        method: "POST",
        headers: { "Content-Type": "application/json", "x-api-key": process.env.WA_MOTOR_API_KEY ?? "" },
        body: JSON.stringify({ phone, message }),
        signal: AbortSignal.timeout(8000),
      }).then(() =>
        sb.from("alumno_hitos").update({ wa_sent_at: new Date().toISOString() }).eq("alumno_id", alumno_id).eq("hito", h)
      ).catch(() => {});
    }
  }

  // Devolver con URL de la tarjeta
  return NextResponse.json({
    hitos: newHitos.map(h => ({
      key:     h,
      label:   LABELS[h],
      cardUrl: `${appUrl}/api/alumno/share-card?a=${alumno_id}&h=${h}&s=${sign(alumno_id, h)}`,
    })),
  });
}
