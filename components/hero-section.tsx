"use client";

import { ArrowRight, ChevronRight } from "lucide-react";

const FM   = "var(--font-mono,'JetBrains Mono',monospace)";
const FSG  = "var(--font-space,'Space Grotesk',sans-serif)";

const getFadeUpStyle = (delay: number): React.CSSProperties => ({
  animation: `fadeUp 0.78s cubic-bezier(0.16, 1, 0.3, 1) ${delay}s both`,
});

function PrimaryButton() {
  return (
    <a
      href="/start"
      className="group relative inline-flex items-center justify-center gap-2 overflow-hidden rounded-full px-8 py-[0.9rem] text-sm font-semibold text-white transition-all duration-300 ease-out hover:scale-[1.02] active:scale-[0.98]"
      style={{
        fontFamily: FM,
        background: "linear-gradient(180deg, #ff7a1a 0%, #ff6000 55%, #e05000 100%)",
        boxShadow:
          "inset 0 1px 0 rgba(255,255,255,0.30), " +
          "inset 0 -1px 0 rgba(0,0,0,0.18), " +
          "0 6px 28px rgba(255,96,0,0.28), " +
          "0 2px 8px rgba(255,96,0,0.18)",
      }}
    >
      <span className="pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-white/30 to-transparent" />
      Probar 30 días gratis
      <ChevronRight className="h-4 w-4 transition-transform duration-200 group-hover:translate-x-0.5" />
    </a>
  );
}

function GhostButton() {
  return (
    <a
      href="#demo"
      className="group inline-flex items-center justify-center gap-2 rounded-full px-8 py-[0.9rem] text-sm font-medium text-white/55 backdrop-blur-md transition-all duration-300 hover:text-white/80 hover:scale-[1.015] active:scale-[0.985]"
      style={{
        fontFamily: FM,
        background: "rgba(255,255,255,0.045)",
        border: "1px solid rgba(255,255,255,0.10)",
        boxShadow:
          "inset 0 1px 0 rgba(255,255,255,0.07), " +
          "inset 0 -1px 0 rgba(0,0,0,0.12)",
      }}
      onMouseEnter={(e) => {
        e.currentTarget.style.background = "rgba(255,255,255,0.075)";
      }}
      onMouseLeave={(e) => {
        e.currentTarget.style.background = "rgba(255,255,255,0.045)";
      }}
    >
      <span
        className="pointer-events-none absolute inset-x-0 top-0 h-px rounded-full"
        style={{ background: "linear-gradient(90deg, transparent, rgba(255,255,255,0.18), transparent)" }}
      />
      Ver cómo funciona
      <ArrowRight className="h-4 w-4 opacity-35 transition-all duration-200 group-hover:translate-x-0.5 group-hover:opacity-60" />
    </a>
  );
}

export function HeroSection() {
  return (
    <>
      <style>{`
        @keyframes fadeUp {
          from { opacity: 0; transform: translateY(22px); }
          to   { opacity: 1; transform: translateY(0); }
        }
      `}</style>

      <section
        className="relative w-full overflow-hidden pb-24 pt-20 text-center lg:pb-32 lg:pt-32"
        style={{ backgroundColor: "#070b14" }}
      >
        {/* Grilla horizontal fina */}
        <div
          className="pointer-events-none absolute inset-0"
          style={{
            backgroundImage: "linear-gradient(rgba(255,255,255,0.035) 1px, transparent 1px)",
            backgroundSize: "100% 56px",
          }}
        />

        <div className="relative mx-auto max-w-5xl px-6 lg:px-10">

          {/* Eyebrow — JetBrains Mono */}
          <div style={getFadeUpStyle(0)}>
            <span
              className="inline-flex items-center gap-2.5 rounded-full border border-white/[0.08] bg-white/[0.04] px-4 py-2 text-[10px] font-semibold uppercase tracking-[0.12em] text-white/40"
              style={{ fontFamily: FM }}
            >
              <span className="h-1.5 w-1.5 rounded-full bg-[#FF6A00]" />
              Retención en piloto automático
            </span>
          </div>

          {/* H1 — Space Grotesk 700 */}
          <h1
            className="relative z-10 mx-auto mt-10 max-w-4xl text-[2.6rem] leading-[1.02] tracking-[-0.04em] sm:text-[3.8rem] lg:text-[5.4rem]"
            style={{ ...getFadeUpStyle(0.12), fontFamily: FSG, fontWeight: 700 }}
          >
            <span
              className="bg-clip-text text-transparent"
              style={{ backgroundImage: "linear-gradient(180deg, #f3f4f8 8%, #8a8a98 100%)" }}
            >
              Cero bajas
            </span>
            <span
              className="ml-3 bg-clip-text text-transparent"
              style={{ backgroundImage: "linear-gradient(95deg, #ff9a4a 0%, #fb5c0a 60%, #d94000 100%)" }}
            >
              por sorpresa.
            </span>
          </h1>

          {/* Cuerpo — Inter */}
          <p
            className="mx-auto mt-8 max-w-2xl text-base font-light leading-relaxed tracking-tight text-white/40 lg:text-lg"
            style={getFadeUpStyle(0.24)}
          >
            FitGrowX detecta qué socios están por dejar tu gimnasio y los reactiva por WhatsApp.{" "}
            <span className="font-medium text-white/70">
              Automático, todos los días, sin que tengas que estar encima.
            </span>
          </p>

          {/* CTAs */}
          <div
            className="mt-10 flex flex-col items-center justify-center gap-3 sm:flex-row"
            style={getFadeUpStyle(0.34)}
          >
            <PrimaryButton />
            <GhostButton />
          </div>

          {/* Trust row — JetBrains Mono */}
          <div
            className="mt-8 flex flex-wrap items-center justify-center gap-3 text-[11px] uppercase tracking-[0.1em] text-white/26"
            style={{ ...getFadeUpStyle(0.4), fontFamily: FM }}
          >
            <span className="rounded-full border border-white/[0.08] bg-white/[0.03] px-4 py-2">Sin tarjeta</span>
            <span className="rounded-full border border-white/[0.08] bg-white/[0.03] px-4 py-2">Activás en un día</span>
            <span className="rounded-full border border-white/[0.08] bg-white/[0.03] px-4 py-2">Cancelás cuando quieras</span>
          </div>

        </div>
      </section>
    </>
  );
}
