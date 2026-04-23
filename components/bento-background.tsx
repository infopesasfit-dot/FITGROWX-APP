"use client";

const GRAIN_SVG =
  "url(\"data:image/svg+xml,%3Csvg viewBox='0 0 256 256' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.80' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)'/%3E%3C/svg%3E\")";

export function BentoBackground() {
  return (
    <div className="pointer-events-none fixed inset-0 z-0 overflow-hidden bg-[#050505]">

      {/* Grid con mask radial — desvanece hacia los bordes */}
      <div
        className="absolute inset-0"
        style={{
          backgroundImage:
            "linear-gradient(rgba(255,106,0,0.07) 1px, transparent 1px), linear-gradient(90deg, rgba(255,106,0,0.07) 1px, transparent 1px)",
          backgroundSize: "70px 70px",
          maskImage:
            "radial-gradient(ellipse 85% 75% at 50% 42%, black 15%, rgba(0,0,0,0.55) 55%, transparent 82%)",
          WebkitMaskImage:
            "radial-gradient(ellipse 85% 75% at 50% 42%, black 15%, rgba(0,0,0,0.55) 55%, transparent 82%)",
        }}
      />

      {/* Film grain — sobre todo */}
      <div
        className="fixed inset-0 mix-blend-soft-light"
        style={{
          backgroundImage: GRAIN_SVG,
          backgroundRepeat: "repeat",
          backgroundSize: "200px 200px",
          opacity: 0.12,
        }}
      />

    </div>
  );
}
