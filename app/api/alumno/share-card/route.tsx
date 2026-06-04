import { ImageResponse } from "next/og";
import { createHmac } from "crypto";
import { getSupabaseAdminClient } from "@/lib/supabase-admin";

export const runtime = "nodejs";

const HITOS: Record<string, { emoji: string; num: string; unit: string; phrase: string; accent: string }> = {
  asist_10:  { emoji: "🔥", num: "10",  unit: "CLASES",  phrase: "¡Arrancaste con todo!",          accent: "#F97316" },
  asist_30:  { emoji: "💪", num: "30",  unit: "CLASES",  phrase: "La constancia ya se nota",        accent: "#EF4444" },
  asist_50:  { emoji: "⚡", num: "50",  unit: "CLASES",  phrase: "Mitad de camino. Sin parar.",     accent: "#8B5CF6" },
  asist_100: { emoji: "🏆", num: "100", unit: "CLASES",  phrase: "100 razones para seguir",         accent: "#F59E0B" },
  asist_200: { emoji: "👑", num: "200", unit: "CLASES",  phrase: "Esto ya es un estilo de vida",    accent: "#EC4899" },
  dias_30:   { emoji: "📅", num: "1",   unit: "MES",     phrase: "El primer mes es el más difícil", accent: "#10B981" },
  dias_90:   { emoji: "🎯", num: "3",   unit: "MESES",   phrase: "¡3 meses de pura constancia!",   accent: "#06B6D4" },
  dias_180:  { emoji: "🌟", num: "6",   unit: "MESES",   phrase: "6 meses. Eso no es casualidad",  accent: "#A855F7" },
  dias_365:  { emoji: "🦁", num: "1",   unit: "AÑO",     phrase: "Un año entero. Sos un ejemplo",  accent: "#F59E0B" },
};

function sign(alumnoId: string, hito: string): string {
  const secret = process.env.SHARE_CARD_SECRET ?? "fitgrowx-share-secret";
  return createHmac("sha256", secret).update(`${alumnoId}:${hito}`).digest("hex").slice(0, 16);
}

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const alumnoId = searchParams.get("a") ?? "";
  const hito     = searchParams.get("h") ?? "";
  const sig      = searchParams.get("s") ?? "";

  // Verificar firma
  if (!alumnoId || !hito || sig !== sign(alumnoId, hito)) {
    return new Response("Invalid", { status: 403 });
  }

  const hitoData = HITOS[hito];
  if (!hitoData) return new Response("Unknown hito", { status: 404 });

  // Datos del alumno y gym
  const sb = getSupabaseAdminClient();
  const { data: alumno } = await sb
    .from("alumnos")
    .select("full_name, gym_id")
    .eq("id", alumnoId)
    .eq("is_demo", false)
    .maybeSingle();

  const { data: settings } = alumno?.gym_id
    ? await sb.from("gym_settings").select("gym_name, logo_url, accent_color").eq("gym_id", alumno.gym_id).maybeSingle()
    : { data: null };

  const firstName  = (alumno?.full_name ?? "Campeón").split(" ")[0];
  const gymName    = settings?.gym_name ?? "Tu Gym";
  const gymAccent  = settings?.accent_color ?? hitoData.accent;

  return new ImageResponse(
    (
      <div
        style={{
          width: 1080,
          height: 1080,
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "space-between",
          background: "#080810",
          padding: "72px 80px 52px",
          position: "relative",
          overflow: "hidden",
          fontFamily: "'Inter', system-ui, sans-serif",
        }}
      >
        {/* Gradient blobs — efecto Spotify */}
        <div style={{ position: "absolute", top: -120, left: -120, width: 500, height: 500, borderRadius: "50%", background: `radial-gradient(circle, ${gymAccent}55 0%, transparent 70%)`, display: "flex" }} />
        <div style={{ position: "absolute", bottom: -100, right: -80, width: 420, height: 420, borderRadius: "50%", background: `radial-gradient(circle, ${hitoData.accent}44 0%, transparent 70%)`, display: "flex" }} />
        <div style={{ position: "absolute", top: "40%", right: -60, width: 280, height: 280, borderRadius: "50%", background: "radial-gradient(circle, rgba(255,255,255,0.04) 0%, transparent 70%)", display: "flex" }} />

        {/* Noise overlay — dots grid */}
        <div style={{
          position: "absolute", inset: 0,
          backgroundImage: "radial-gradient(rgba(255,255,255,0.07) 1px, transparent 1px)",
          backgroundSize: "32px 32px",
          display: "flex",
        }} />

        {/* Top: gym name */}
        <div style={{ display: "flex", alignItems: "center", gap: 16, zIndex: 1, width: "100%" }}>
          <div style={{ display: "flex", flexDirection: "column" }}>
            <span style={{ fontSize: 28, fontWeight: 700, color: "rgba(255,255,255,0.35)", letterSpacing: "0.18em", textTransform: "uppercase" }}>
              {gymName}
            </span>
          </div>
          <div style={{ flex: 1, height: 1, background: "rgba(255,255,255,0.08)", display: "flex" }} />
        </div>

        {/* Center: the achievement */}
        <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 0, zIndex: 1, flex: 1, justifyContent: "center" }}>

          {/* Emoji */}
          <div style={{ fontSize: 96, lineHeight: 1, marginBottom: 24, display: "flex" }}>
            {hitoData.emoji}
          </div>

          {/* Big number */}
          <div style={{
            display: "flex",
            fontSize: 220,
            fontWeight: 900,
            letterSpacing: "-0.06em",
            lineHeight: 0.85,
            color: "transparent",
            backgroundImage: `linear-gradient(135deg, ${gymAccent} 0%, ${hitoData.accent} 60%, #ffffff88 100%)`,
            backgroundClip: "text",
            WebkitBackgroundClip: "text",
          }}>
            {hitoData.num}
          </div>

          {/* Unit */}
          <div style={{ fontSize: 38, fontWeight: 800, letterSpacing: "0.28em", color: "rgba(255,255,255,0.5)", marginTop: 12, display: "flex" }}>
            {hitoData.unit}
          </div>

          {/* Name */}
          <div style={{ fontSize: 52, fontWeight: 800, color: "#FFFFFF", marginTop: 36, letterSpacing: "-0.02em", display: "flex" }}>
            {firstName}
          </div>

          {/* Phrase */}
          <div style={{ fontSize: 28, fontWeight: 400, color: "rgba(255,255,255,0.45)", marginTop: 10, letterSpacing: "0.01em", display: "flex" }}>
            {hitoData.phrase}
          </div>
        </div>

        {/* Bottom: branding */}
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", width: "100%", zIndex: 1 }}>
          {/* Left: decorative line */}
          <div style={{ display: "flex", gap: 6, alignItems: "center" }}>
            {[gymAccent, hitoData.accent, "rgba(255,255,255,0.2)"].map((c, i) => (
              <div key={i} style={{ width: i === 0 ? 32 : 8, height: 4, borderRadius: 99, background: c, display: "flex" }} />
            ))}
          </div>

          {/* Right: FitGrowX branding — sutil pero presente */}
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <div style={{ width: 1, height: 20, background: "rgba(255,255,255,0.1)", display: "flex" }} />
            <span style={{ fontSize: 20, fontWeight: 600, color: "rgba(255,255,255,0.22)", letterSpacing: "0.06em" }}>
              FITGROWX
            </span>
          </div>
        </div>
      </div>
    ),
    {
      width: 1080,
      height: 1080,
      headers: {
        "Cache-Control": "public, max-age=86400, s-maxage=86400",
      },
    },
  );
}

export function generateShareUrl(alumnoId: string, hito: string): string {
  const secret = process.env.SHARE_CARD_SECRET ?? "fitgrowx-share-secret";
  const sig = createHmac("sha256", secret).update(`${alumnoId}:${hito}`).digest("hex").slice(0, 16);
  const base = process.env.NEXT_PUBLIC_APP_URL ?? "https://fitgrowx.com";
  return `${base}/api/alumno/share-card?a=${alumnoId}&h=${hito}&s=${sig}`;
}
