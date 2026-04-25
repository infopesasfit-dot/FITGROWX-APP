"use client";

import { motion } from "framer-motion";

type LogoStyle = "mono" | "bold" | "condensed" | "light" | "serif" | "wide";

const GYMS: { name: string; tag: string; style: LogoStyle; members?: string }[] = [
  { name: "BLACK IRON",      tag: "Gym",      style: "bold",      members: "340 socios" },
  { name: "Temple Box",      tag: "CrossFit", style: "condensed", members: "180 socios" },
  { name: "TITAN",           tag: "CF Box",   style: "wide",      members: "220 socios" },
  { name: "Forge",           tag: "CrossFit", style: "serif",     members: "95 socios"  },
  { name: "IRON REPUBLIC",   tag: "Gym",      style: "mono",      members: "410 socios" },
  { name: "Norte Box",       tag: "CrossFit", style: "light",     members: "130 socios" },
  { name: "ELITE PERFORM",   tag: "Gym",      style: "bold",      members: "280 socios" },
  { name: "BarBell Society", tag: "Gym",      style: "condensed", members: "160 socios" },
  { name: "ALPHA BOX",       tag: "CrossFit", style: "wide",      members: "200 socios" },
  { name: "Urban Muscle",    tag: "Gym",      style: "serif",     members: "315 socios" },
  { name: "STRONGHOLD",      tag: "CF Box",   style: "mono",      members: "140 socios" },
  { name: "Peak Training",   tag: "Gym",      style: "light",     members: "190 socios" },
];

const STYLE_MAP: Record<LogoStyle, React.CSSProperties> = {
  bold:      { fontWeight: 900, letterSpacing: "-0.04em" },
  condensed: { fontWeight: 700, letterSpacing: "0.08em"  },
  mono:      { fontWeight: 600, letterSpacing: "0.12em", fontFamily: "monospace" },
  light:     { fontWeight: 300, letterSpacing: "0.06em"  },
  serif:     { fontWeight: 600, letterSpacing: "-0.02em", fontStyle: "italic" },
  wide:      { fontWeight: 800, letterSpacing: "0.18em"  },
};

const TAG_COLORS: Record<string, string> = {
  "Gym":      "rgba(255,106,0,0.15)",
  "CrossFit": "rgba(59,130,246,0.15)",
  "CF Box":   "rgba(59,130,246,0.15)",
};

const TAG_TEXT: Record<string, string> = {
  "Gym":      "#FF8C40",
  "CrossFit": "#60A5FA",
  "CF Box":   "#60A5FA",
};

function GymCard({ name, tag, style, members }: { name: string; tag: string; style: LogoStyle; members?: string }) {
  return (
    <div
      className="group relative flex shrink-0 items-center gap-4 rounded-2xl px-5 py-4 transition-all duration-300 hover:bg-white/[0.04]"
      style={{
        border: "1px solid rgba(255,255,255,0.055)",
        background: "rgba(255,255,255,0.018)",
        backdropFilter: "blur(8px)",
        marginBottom: "10px",
      }}
    >
      {/* Left accent line */}
      <span
        className="absolute left-0 top-[20%] h-[60%] w-[2px] rounded-full opacity-0 transition-opacity duration-300 group-hover:opacity-100"
        style={{ background: "linear-gradient(180deg, transparent, #FF6A00, transparent)" }}
      />

      <div className="flex flex-col gap-1 min-w-0">
        <span
          className="text-[13px] leading-none text-white/70 transition-colors duration-300 group-hover:text-white/95 truncate"
          style={STYLE_MAP[style]}
        >
          {name}
        </span>
        {members && (
          <span className="text-[10px] text-white/25 font-light tracking-wide">
            {members}
          </span>
        )}
      </div>

      <span
        className="ml-auto shrink-0 rounded-full px-2.5 py-0.5 text-[9px] font-semibold uppercase tracking-[0.14em] transition-colors duration-300"
        style={{
          background: TAG_COLORS[tag] ?? "rgba(255,255,255,0.07)",
          color: TAG_TEXT[tag] ?? "rgba(255,255,255,0.4)",
        }}
      >
        {tag}
      </span>
    </div>
  );
}

function VerticalTrack({ items, reverse = false }: { items: typeof GYMS; reverse?: boolean }) {
  const tripled = [...items, ...items, ...items];
  const animation = reverse
    ? { y: ["-33.33%", "0%"] }
    : { y: ["0%", "-33.33%"] };

  return (
    <div className="relative overflow-hidden" style={{ height: 480 }}>
      {/* Top fade */}
      <div
        className="pointer-events-none absolute inset-x-0 top-0 z-10 h-20"
        style={{ background: "linear-gradient(180deg, #050505 0%, transparent 100%)" }}
      />
      {/* Bottom fade */}
      <div
        className="pointer-events-none absolute inset-x-0 bottom-0 z-10 h-20"
        style={{ background: "linear-gradient(0deg, #050505 0%, transparent 100%)" }}
      />

      <motion.div
        animate={animation}
        transition={{ duration: reverse ? 30 : 24, ease: "linear", repeat: Infinity }}
        className="flex flex-col px-1"
      >
        {tripled.map((g, i) => (
          <GymCard key={`${g.name}-${i}`} {...g} />
        ))}
      </motion.div>
    </div>
  );
}

export function LogosSection() {
  const col1 = GYMS.slice(0, 6);
  const col2 = GYMS.slice(6, 12);
  const col3 = [...GYMS.slice(3, 9)];

  return (
    <section className="relative overflow-hidden py-20 lg:py-28">
      {/* Top separator */}
      <div
        className="pointer-events-none absolute inset-x-0 top-0 h-px"
        style={{
          background: "linear-gradient(90deg, transparent 5%, rgba(255,255,255,0.06) 35%, rgba(255,255,255,0.10) 50%, rgba(255,255,255,0.06) 65%, transparent 95%)",
        }}
      />

      {/* Ambient light */}
      <div
        className="pointer-events-none absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 h-[600px] w-[800px] -z-10 opacity-[0.06]"
        style={{
          background: "radial-gradient(ellipse at center, #FF6A00 0%, #2563EB 50%, transparent 75%)",
          filter: "blur(100px)",
        }}
      />

      <div className="mx-auto max-w-7xl px-6 lg:px-10">
        <div className="grid lg:grid-cols-[1fr_1.1fr] gap-12 lg:gap-20 items-center">

          {/* Left — copy */}
          <motion.div
            initial={{ opacity: 0, x: -24 }}
            whileInView={{ opacity: 1, x: 0 }}
            viewport={{ once: true, margin: "-60px" }}
            transition={{ duration: 0.8, ease: [0.16, 1, 0.3, 1] }}
            className="max-w-sm"
          >
            <div className="mb-5 inline-flex items-center gap-2 rounded-full px-3 py-1" style={{ border: "1px solid rgba(255,106,0,0.18)", background: "rgba(255,106,0,0.06)" }}>
              <span
                className="h-1.5 w-1.5 rounded-full animate-pulse"
                style={{ background: "#FF6A00", boxShadow: "0 0 6px #FF6A00" }}
              />
              <span className="text-[10px] font-bold uppercase tracking-[0.24em] text-[#FF8040]">
                En vivo
              </span>
            </div>

            <h2
              className="text-3xl font-semibold leading-[1.1] tracking-[-0.04em] sm:text-4xl lg:text-[2.6rem]"
              style={{
                backgroundImage: "linear-gradient(170deg, #ffffff 30%, rgba(255,255,255,0.45) 100%)",
                WebkitBackgroundClip: "text",
                WebkitTextFillColor: "transparent",
                backgroundClip: "text",
              }}
            >
              Gimnasios y boxes que ya crecen con orden
            </h2>

            <p className="mt-5 text-[15px] leading-relaxed text-white/38 font-light">
              Desde pequeños boxes hasta gimnasios de 400 socios. Todos gestionados desde un solo panel.
            </p>

            <div className="mt-8 flex flex-wrap gap-5">
              {[
                { value: "60+", label: "Espacios activos" },
                { value: "14k+", label: "Socios gestionados" },
              ].map((stat) => (
                <div key={stat.label} className="flex flex-col gap-1">
                  <span
                    className="text-2xl font-bold tracking-tight"
                    style={{
                      backgroundImage: "linear-gradient(95deg, #ff9a4a 0%, #fb5c0a 65%)",
                      WebkitBackgroundClip: "text",
                      WebkitTextFillColor: "transparent",
                      backgroundClip: "text",
                    }}
                  >
                    {stat.value}
                  </span>
                  <span className="text-[11px] font-medium uppercase tracking-[0.12em] text-white/28">
                    {stat.label}
                  </span>
                </div>
              ))}
            </div>
          </motion.div>

          {/* Right — vertical scrolling columns */}
          <motion.div
            initial={{ opacity: 0 }}
            whileInView={{ opacity: 1 }}
            viewport={{ once: true, margin: "-60px" }}
            transition={{ duration: 1, delay: 0.2 }}
            className="grid grid-cols-2 lg:grid-cols-3 gap-3"
          >
            <VerticalTrack items={col1} />
            <VerticalTrack items={col2} reverse />
            <div className="hidden lg:block">
              <VerticalTrack items={col3} />
            </div>
          </motion.div>

        </div>
      </div>

      {/* Bottom separator */}
      <div
        className="pointer-events-none absolute inset-x-0 bottom-0 h-px"
        style={{
          background: "linear-gradient(90deg, transparent 5%, rgba(255,255,255,0.06) 35%, rgba(255,255,255,0.10) 50%, rgba(255,255,255,0.06) 65%, transparent 95%)",
        }}
      />
    </section>
  );
}
