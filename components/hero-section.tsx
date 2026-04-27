"use client";

import {
  motion,
  useMotionValue,
  useSpring,
  useTransform,
  type MotionValue,
  type Variants,
} from "framer-motion";
import { ArrowRight, ChevronRight } from "lucide-react";
import { useCallback, useId, useRef } from "react";

// ─────────────────────────────────────────────────────────────────
// Config
// ─────────────────────────────────────────────────────────────────
const EASE: [number, number, number, number] = [0.16, 1, 0.3, 1];
const SPRING_FAST  = { stiffness: 400, damping: 25 };
const SPRING_SLOW  = { stiffness: 14, damping: 30, mass: 1.4 };

const WHITE_WORDS  = "Cobrando tarde, persiguiendo alumnos y perdiendo leads".split(" ");
const ORANGE_WORDS = "no se crece.".split(" ");
const TOTAL_WORDS  = WHITE_WORDS.length + ORANGE_WORDS.length;

// ─────────────────────────────────────────────────────────────────
// Variants
// ─────────────────────────────────────────────────────────────────
const headlineContainer: Variants = {
  hidden: {},
  visible: { transition: { staggerChildren: 0.055, delayChildren: 0.22 } },
};

const wordVariant: Variants = {
  hidden:   { opacity: 0, y: 22, filter: "blur(6px)" },
  visible:  { opacity: 1, y: 0,  filter: "blur(0px)", transition: { duration: 0.7, ease: EASE } },
};

function fadeUp(delay: number): Variants {
  return {
    hidden:  { opacity: 0, y: 20 },
    visible: { opacity: 1, y: 0, transition: { duration: 0.8, ease: EASE, delay } },
  };
}

// ─────────────────────────────────────────────────────────────────
// Floating particles
// ─────────────────────────────────────────────────────────────────
const PARTICLES = [
  { x: "18%",  delay: 0,    dur: 9,   size: 2.5, opacity: 0.55 },
  { x: "42%",  delay: 1.8,  dur: 11,  size: 1.8, opacity: 0.40 },
  { x: "67%",  delay: 0.6,  dur: 8.5, size: 3,   opacity: 0.50 },
  { x: "81%",  delay: 3.2,  dur: 13,  size: 1.5, opacity: 0.35 },
  { x: "30%",  delay: 5.0,  dur: 10,  size: 2,   opacity: 0.45 },
  { x: "55%",  delay: 2.4,  dur: 12,  size: 2.2, opacity: 0.38 },
];

function FloatingParticles() {
  return (
    <div className="pointer-events-none absolute inset-0 overflow-hidden">
      {PARTICLES.map((p, i) => (
        <motion.span
          key={i}
          className="absolute bottom-0 rounded-full"
          style={{
            left: p.x,
            width: p.size,
            height: p.size,
            background: `radial-gradient(circle, rgba(255,130,30,${p.opacity}) 0%, transparent 70%)`,
          }}
          animate={{
            y: [0, -360],
            x: [0, Math.sin(i) * 40],
            opacity: [0, p.opacity, p.opacity * 0.8, 0],
            scale: [1, 0.7, 0.4],
          }}
          transition={{
            duration: p.dur,
            delay: p.delay,
            repeat: Infinity,
            ease: "easeOut",
          }}
        />
      ))}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────
// Grain overlay (SVG feTurbulence noise)
// ─────────────────────────────────────────────────────────────────
function GrainOverlay({ filterId }: { filterId: string }) {
  return (
    <svg
      aria-hidden="true"
      className="pointer-events-none absolute inset-0 h-full w-full"
      style={{ opacity: 0.22, mixBlendMode: "soft-light" }}
      xmlns="http://www.w3.org/2000/svg"
    >
      <filter id={filterId} x="0%" y="0%" width="100%" height="100%">
        <feTurbulence
          type="fractalNoise"
          baseFrequency="0.68 0.68"
          numOctaves="4"
          stitchTiles="stitch"
          result="noise"
        />
        <feColorMatrix type="saturate" values="0" in="noise" result="grayNoise" />
        <feBlend in="SourceGraphic" in2="grayNoise" mode="overlay" />
      </filter>
      <rect width="100%" height="100%" filter={`url(#${filterId})`} />
    </svg>
  );
}

// ─────────────────────────────────────────────────────────────────
// Atmospheric background blobs
// ─────────────────────────────────────────────────────────────────
function AtmosphericBackground({
  orangeX, orangeY, blueX, blueY, filterId,
}: {
  orangeX: MotionValue<number>;
  orangeY: MotionValue<number>;
  blueX: MotionValue<number>;
  blueY: MotionValue<number>;
  filterId: string;
}) {
  return (
    <div className="pointer-events-none absolute inset-0 overflow-hidden">
      {/* Base deep gradient: cold-blue top-left → pure black bottom-right */}
      <div
        className="absolute inset-0"
        style={{
          background:
            "linear-gradient(140deg, rgba(12,28,100,0.92) 0%, rgba(5,5,12,0.8) 42%, #000000 100%)",
        }}
      />

      {/* Orange-burnt center blob */}
      <motion.div
        className="absolute hero-orange-orbit"
        style={{
          x: orangeX,
          y: orangeY,
          left: "46%",
          top: "44%",
          width: 900,
          height: 700,
          translateX: "-50%",
          translateY: "-50%",
          background:
            "radial-gradient(ellipse 55% 50% at 50% 50%, rgba(215,70,5,0.55) 0%, rgba(185,50,0,0.22) 42%, transparent 72%)",
          filter: "blur(72px)",
        }}
      />

      {/* Secondary warm accent — upper-center fade */}
      <motion.div
        className="absolute hero-orange-orbit"
        style={{
          x: orangeX,
          y: orangeY,
          left: "52%",
          top: "18%",
          width: 560,
          height: 420,
          translateX: "-50%",
          translateY: "0%",
          background:
            "radial-gradient(ellipse 60% 55% at 50% 50%, rgba(240,100,10,0.18) 0%, transparent 68%)",
          filter: "blur(90px)",
        }}
      />

      {/* Cold-blue blob — top-left corner */}
      <motion.div
        className="absolute"
        style={{
          x: blueX,
          y: blueY,
          left: "-8%",
          top: "-14%",
          width: 680,
          height: 560,
          background:
            "radial-gradient(ellipse 60% 55% at 40% 40%, rgba(25,70,210,0.38) 0%, rgba(10,40,140,0.14) 52%, transparent 78%)",
          filter: "blur(100px)",
        }}
      />

      {/* SVG grain texture */}
      <GrainOverlay filterId={filterId} />

      {/* Vignette: subtle dark edges for depth */}
      <div
        className="absolute inset-0"
        style={{
          background:
            "radial-gradient(ellipse 120% 110% at 50% 50%, transparent 46%, rgba(0,0,0,0.55) 100%)",
        }}
      />
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────
// Buttons
// ─────────────────────────────────────────────────────────────────
function PrimaryButton() {
  return (
    <motion.a
      href="/start"
      className="group relative inline-flex items-center justify-center gap-2 overflow-hidden rounded-full px-8 py-[0.9rem] text-sm font-semibold text-white"
      style={{
        background: "linear-gradient(180deg, #ff7a1a 0%, #ff6000 55%, #e05000 100%)",
        boxShadow:
          "inset 0 1px 0 rgba(255,255,255,0.30), " +
          "inset 0 -1px 0 rgba(0,0,0,0.18), " +
          "0 6px 28px rgba(255,96,0,0.28), " +
          "0 2px 8px rgba(255,96,0,0.18)",
      }}
      whileHover={{
        scale: 1.025,
        boxShadow:
          "inset 0 1px 0 rgba(255,255,255,0.34), " +
          "inset 0 -1px 0 rgba(0,0,0,0.22), " +
          "0 12px 36px rgba(255,96,0,0.35), " +
          "0 4px 10px rgba(255,96,0,0.22)",
      }}
      whileTap={{ scale: 0.975 }}
      transition={SPRING_FAST}
    >
      {/* Top-highlight micro-border */}
      <span className="pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-white/30 to-transparent" />
      Empezar prueba gratis
      <ChevronRight className="h-4 w-4 transition-transform duration-200 group-hover:translate-x-0.5" />
    </motion.a>
  );
}

function GhostButton() {
  return (
    <motion.a
      href="#demo"
      className="group inline-flex items-center justify-center gap-2 rounded-full px-8 py-[0.9rem] text-sm font-medium text-white/55 backdrop-blur-md transition-colors duration-300 hover:text-white/80"
      style={{
        background: "rgba(255,255,255,0.045)",
        border: "1px solid rgba(255,255,255,0.10)",
        boxShadow:
          "inset 0 1px 0 rgba(255,255,255,0.07), " +
          "inset 0 -1px 0 rgba(0,0,0,0.12)",
      }}
      whileHover={{
        scale: 1.015,
        background: "rgba(255,255,255,0.075)",
      }}
      whileTap={{ scale: 0.985 }}
      transition={SPRING_FAST}
    >
      {/* Top-highlight micro-border */}
      <span
        className="pointer-events-none absolute inset-x-0 top-0 h-px rounded-full"
        style={{ background: "linear-gradient(90deg, transparent, rgba(255,255,255,0.18), transparent)" }}
      />
      Ver cómo se ve
      <ArrowRight className="h-4 w-4 opacity-35 transition-all duration-200 group-hover:translate-x-0.5 group-hover:opacity-60" />
    </motion.a>
  );
}

// ─────────────────────────────────────────────────────────────────
// Main
// ─────────────────────────────────────────────────────────────────
export function HeroSection() {
  const sectionRef = useRef<HTMLElement>(null);
  const filterId   = useId().replace(/:/g, "");

  const rawX = useMotionValue(50);
  const rawY = useMotionValue(48);
  const springX = useSpring(rawX, SPRING_SLOW);
  const springY = useSpring(rawY, SPRING_SLOW);

  // Parallax offsets — blobs move in opposite directions for depth
  const orangeX = useTransform(springX, [0, 100], [-22, 22]);
  const orangeY = useTransform(springY, [0, 100], [-14, 14]);
  const blueX   = useTransform(springX, [0, 100], [16, -16]);
  const blueY   = useTransform(springY, [0, 100], [10, -10]);

  const onMouseMove = useCallback(
    (e: React.MouseEvent<HTMLElement>) => {
      const rect = sectionRef.current?.getBoundingClientRect();
      if (!rect) return;
      rawX.set(((e.clientX - rect.left) / rect.width) * 100);
      rawY.set(((e.clientY - rect.top) / rect.height) * 100);
    },
    [rawX, rawY],
  );

  const subtitleDelay = 0.22 + TOTAL_WORDS * 0.055 + 0.10;
  const ctaDelay      = subtitleDelay + 0.20;

  return (
    <section
      ref={sectionRef}
      onMouseMove={onMouseMove}
      className="relative w-full overflow-hidden pb-28 pt-20 text-center lg:pb-36 lg:pt-32"
    >
      <AtmosphericBackground
        orangeX={orangeX}
        orangeY={orangeY}
        blueX={blueX}
        blueY={blueY}
        filterId={`grain-${filterId}`}
      />

      <FloatingParticles />

      <div className="relative mx-auto max-w-5xl px-6 lg:px-10">
        {/* Badge — flota sutilmente */}
        <motion.div
          className="hero-badge-float"
          variants={fadeUp(0)}
          initial={false}
          animate="visible"
        >
          <span className="inline-flex items-center gap-2.5 rounded-full border border-white/[0.08] bg-white/[0.04] px-4 py-2 text-[10px] font-semibold uppercase tracking-[0.22em] text-white/40 backdrop-blur-sm">
            <span className="h-1.5 w-1.5 rounded-full bg-[#FF6A00]" />
            Sistema para gimnasios y centros de entrenamiento
          </span>
        </motion.div>

        {/* Glow naranja animado detrás del título */}
        <div className="pointer-events-none absolute left-1/2 -translate-x-1/2" style={{ top: 56, width: "min(760px, 100%)", height: 200, zIndex: 0 }}>
          <motion.div
            className="title-glow absolute inset-0"
            style={{
              background: "radial-gradient(ellipse 60% 75% at 50% 55%, rgba(255,90,5,0.32) 0%, rgba(255,65,0,0.14) 46%, transparent 74%)",
              filter: "blur(52px)",
              mixBlendMode: "screen",
            }}
            animate={{
              x: ["0%", "18%", "-12%", "8%", "0%"],
              scaleX: [1, 1.18, 0.88, 1.08, 1],
              opacity: [0.7, 1, 0.75, 0.95, 0.7],
            }}
            transition={{ duration: 10, ease: "easeInOut", repeat: Infinity, repeatType: "mirror" }}
          />
          {/* Segundo blob más pequeño — movimiento contrario */}
          <motion.div
            className="absolute inset-0"
            style={{
              background: "radial-gradient(ellipse 40% 50% at 50% 50%, rgba(255,140,20,0.18) 0%, transparent 65%)",
              filter: "blur(36px)",
              mixBlendMode: "screen",
            }}
            animate={{
              x: ["0%", "-16%", "12%", "-6%", "0%"],
              scaleY: [1, 1.3, 0.85, 1.1, 1],
              opacity: [0.5, 0.8, 0.55, 0.75, 0.5],
            }}
            transition={{ duration: 13, ease: "easeInOut", repeat: Infinity, repeatType: "mirror", delay: 1.5 }}
          />
        </div>

        {/* Headline — word-by-word stagger */}
        <motion.h1
          style={{ position: "relative", zIndex: 1 }}
          className="mx-auto mt-10 max-w-4xl text-[2rem] font-semibold leading-[1.15] tracking-[-0.04em] sm:text-5xl lg:text-[4.5rem]"
          variants={headlineContainer}
          initial={false}
          animate="visible"
        >
          {WHITE_WORDS.map((word, i) => (
            <motion.span
              key={i}
              variants={wordVariant}
              className="mr-[0.26em] inline-block"
              style={{
                backgroundImage: "linear-gradient(180deg, #f0f0f0 15%, #7a7a8a 100%)",
                WebkitBackgroundClip: "text",
                WebkitTextFillColor: "transparent",
                backgroundClip: "text",
              }}
            >
              {word}
            </motion.span>
          ))}
          {ORANGE_WORDS.map((word, i) => (
            <motion.span
              key={`o${i}`}
              variants={wordVariant}
              className="mr-[0.22em] inline-block"
              style={{
                backgroundImage: "linear-gradient(95deg, #ff9a4a 0%, #fb5c0a 60%, #d94000 100%)",
                WebkitBackgroundClip: "text",
                WebkitTextFillColor: "transparent",
                backgroundClip: "text",
              }}
            >
              {word}
            </motion.span>
          ))}
        </motion.h1>

        {/* Subtitle */}
        <motion.p
          className="mx-auto mt-8 max-w-2xl text-base lg:text-lg font-light leading-relaxed text-white/40 tracking-tight"
          variants={fadeUp(subtitleDelay)}
          initial={false}
          animate="visible"
        >
          FitGrowX ordena cobros, seguimiento y captación para que{" "}
          <br className="hidden md:block" />
          <span className="text-white/70 font-medium">recuperes el control total de tu negocio y actives una operación mucho más predecible.</span>
        </motion.p>

        {/* CTAs */}
        <motion.div
          className="mt-10 flex flex-col items-center justify-center gap-3 sm:flex-row"
          variants={fadeUp(ctaDelay)}
          initial={false}
          animate="visible"
        >
          <PrimaryButton />
          <GhostButton />
        </motion.div>

        <motion.div
          className="mt-5 flex flex-wrap items-center justify-center gap-2 text-[11px] font-medium tracking-[0.05em] text-white/35"
          variants={fadeUp(ctaDelay + 0.08)}
          initial={false}
          animate="visible"
        >
          <span className="rounded-full border border-white/10 bg-white/[0.03] px-3 py-1.5">15 días gratis</span>
          <span className="rounded-full border border-white/10 bg-white/[0.03] px-3 py-1.5">Sin tarjeta</span>
          <span className="rounded-full border border-white/10 bg-white/[0.03] px-3 py-1.5">Setup simple</span>
        </motion.div>

        <motion.div
          className="mt-4 flex items-center justify-center"
          variants={fadeUp(ctaDelay + 0.14)}
          initial={false}
          animate="visible"
        >
          <a
            href="/start?login=1"
            className="group inline-flex items-center gap-1.5 text-[12px] font-medium text-white/35 transition-colors duration-200 hover:text-white/65"
          >
            ¿Ya tenés cuenta?
            <span className="underline underline-offset-2 decoration-white/20 group-hover:decoration-white/50 transition-colors duration-200">
              Iniciar sesión
            </span>
            <ArrowRight className="h-3 w-3 opacity-50 transition-transform duration-200 group-hover:translate-x-0.5" />
          </a>
        </motion.div>
      </div>
    </section>
  );
}
