"use client";

import { motion } from "framer-motion";

// ─────────────────────────────────────────────────────────────────
// Gym brands — text logos con estilos tipográficos únicos
// ─────────────────────────────────────────────────────────────────
type LogoStyle = "mono" | "bold" | "condensed" | "light" | "serif" | "wide";

const GYMS: { name: string; tag: string; style: LogoStyle }[] = [
  { name: "BLACK IRON",      tag: "Gym",      style: "bold"      },
  { name: "Temple Box",      tag: "CrossFit", style: "condensed" },
  { name: "TITAN",           tag: "CF Box",   style: "wide"      },
  { name: "Forge",           tag: "CrossFit", style: "serif"     },
  { name: "IRON REPUBLIC",   tag: "Gym",      style: "mono"      },
  { name: "Norte Box",       tag: "CrossFit", style: "light"     },
  { name: "ELITE PERFORM",   tag: "Gym",      style: "bold"      },
  { name: "BarBell Society", tag: "Gym",      style: "condensed" },
  { name: "ALPHA BOX",       tag: "CrossFit", style: "wide"      },
  { name: "Urban Muscle",    tag: "Gym",      style: "serif"     },
  { name: "STRONGHOLD",      tag: "CF Box",   style: "mono"      },
  { name: "Peak Training",   tag: "Gym",      style: "light"     },
];

const STYLE_MAP: Record<LogoStyle, React.CSSProperties> = {
  bold:      { fontWeight: 900, letterSpacing: "-0.04em", fontStyle: "normal"  },
  condensed: { fontWeight: 700, letterSpacing: "0.08em",  fontStyle: "normal"  },
  mono:      { fontWeight: 600, letterSpacing: "0.12em",  fontFamily: "monospace" },
  light:     { fontWeight: 300, letterSpacing: "0.06em",  fontStyle: "normal"  },
  serif:     { fontWeight: 600, letterSpacing: "-0.02em", fontStyle: "italic"  },
  wide:      { fontWeight: 800, letterSpacing: "0.18em",  fontStyle: "normal"  },
};

function LogoCard({ name, tag, style }: { name: string; tag: string; style: LogoStyle }) {
  return (
    <div
      className="group mx-3 flex shrink-0 flex-col items-center justify-center gap-1 rounded-2xl border border-white/[0.05] bg-white/[0.025] px-6 py-4 transition-all duration-300 hover:border-white/[0.10] hover:bg-white/[0.045]"
      style={{ minWidth: 156, backdropFilter: "blur(6px)" }}
    >
      <span
        className="text-sm leading-none text-white/55 transition-colors duration-300 group-hover:text-white/80"
        style={STYLE_MAP[style]}
      >
        {name}
      </span>
      <span className="text-[9px] font-medium uppercase tracking-[0.18em] text-white/22 transition-colors duration-300 group-hover:text-white/40">
        {tag}
      </span>
    </div>
  );
}

function MarqueeRow({ items, reverse = false }: { items: typeof GYMS; reverse?: boolean }) {
  const doubled = [...items, ...items];
  return (
    <div className="marquee-outer overflow-hidden">
      <div className={reverse ? "marquee-track-reverse" : "marquee-track"}>
        {doubled.map((g, i) => (
          <LogoCard key={`${g.name}-${i}`} {...g} />
        ))}
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────
// Main
// ─────────────────────────────────────────────────────────────────
export function LogosSection() {
  return (
    <section className="relative overflow-hidden py-16 lg:py-24">
      {/* Separador top */}
      <div
        className="pointer-events-none absolute inset-x-0 top-0 h-px"
        style={{
          background:
            "linear-gradient(90deg, transparent 5%, rgba(255,255,255,0.06) 30%, rgba(255,255,255,0.10) 50%, rgba(255,255,255,0.06) 70%, transparent 95%)",
        }}
      />

      {/* Luz ambiental naranja difusa */}
      <div
        className="pointer-events-none absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 h-[300px] w-[600px] -z-10 opacity-[0.07]"
        style={{
          background: "radial-gradient(ellipse at center, #FF6A00 0%, transparent 70%)",
          filter: "blur(80px)",
        }}
      />

      <div className="mx-auto max-w-5xl px-6 text-center">
        {/* Eyebrow */}
        <motion.p
          className="mb-2 text-[10px] font-semibold uppercase tracking-[0.22em] text-white/28"
          initial={{ opacity: 0, y: 10 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.6 }}
        >
          Ya confían en FitGrowX
        </motion.p>

        {/* Headline */}
        <motion.h2
          className="text-xl font-semibold tracking-[-0.04em] text-white/60 sm:text-2xl"
          initial={{ opacity: 0, y: 12 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.6, delay: 0.08 }}
        >
          Gimnasios y boxes que ya{" "}
          <span
            style={{
              backgroundImage: "linear-gradient(95deg, #ff9a4a 0%, #fb5c0a 65%)",
              WebkitBackgroundClip: "text",
              WebkitTextFillColor: "transparent",
              backgroundClip: "text",
            }}
          >
            crecen con orden
          </span>
        </motion.h2>
      </div>

      {/* Marquee rows */}
      <motion.div
        className="mt-10 flex flex-col gap-3"
        initial={{ opacity: 0 }}
        whileInView={{ opacity: 1 }}
        viewport={{ once: true }}
        transition={{ duration: 0.8, delay: 0.2 }}
      >
        <MarqueeRow items={GYMS} />
        <MarqueeRow items={[...GYMS].reverse()} reverse />
      </motion.div>

      {/* Fade lateral — desktop */}
      <div
        className="pointer-events-none absolute inset-y-0 left-0 w-24 lg:w-40"
        style={{ background: "linear-gradient(90deg, #050505 0%, transparent 100%)" }}
      />
      <div
        className="pointer-events-none absolute inset-y-0 right-0 w-24 lg:w-40"
        style={{ background: "linear-gradient(270deg, #050505 0%, transparent 100%)" }}
      />

      {/* Separador bottom */}
      <div
        className="pointer-events-none absolute inset-x-0 bottom-0 h-px"
        style={{
          background:
            "linear-gradient(90deg, transparent 5%, rgba(255,255,255,0.06) 30%, rgba(255,255,255,0.10) 50%, rgba(255,255,255,0.06) 70%, transparent 95%)",
        }}
      />
    </section>
  );
}
