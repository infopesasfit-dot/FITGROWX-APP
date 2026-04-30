"use client";

import { motion, type Variants } from "framer-motion";
import { ArrowRight, ChevronRight } from "lucide-react";

const EASE: [number, number, number, number] = [0.16, 1, 0.3, 1];
const SPRING_FAST = { stiffness: 400, damping: 25 };

const fadeUp = (delay = 0): Variants => ({
  hidden: { opacity: 0, y: 22 },
  visible: { opacity: 1, y: 0, transition: { duration: 0.78, ease: EASE, delay } },
});

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
        scale: 1.02,
        boxShadow:
          "inset 0 1px 0 rgba(255,255,255,0.34), " +
          "inset 0 -1px 0 rgba(0,0,0,0.22), " +
          "0 12px 36px rgba(255,96,0,0.35), " +
          "0 4px 10px rgba(255,96,0,0.22)",
      }}
      whileTap={{ scale: 0.98 }}
      transition={SPRING_FAST}
    >
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
      whileHover={{ scale: 1.015, background: "rgba(255,255,255,0.075)" }}
      whileTap={{ scale: 0.985 }}
      transition={SPRING_FAST}
    >
      <span
        className="pointer-events-none absolute inset-x-0 top-0 h-px rounded-full"
        style={{ background: "linear-gradient(90deg, transparent, rgba(255,255,255,0.18), transparent)" }}
      />
      Ver cómo se ve
      <ArrowRight className="h-4 w-4 opacity-35 transition-all duration-200 group-hover:translate-x-0.5 group-hover:opacity-60" />
    </motion.a>
  );
}

export function HeroSection() {
  return (
    <section className="relative w-full overflow-hidden pb-24 pt-20 text-center lg:pb-32 lg:pt-32">
      <div
        className="pointer-events-none absolute inset-0"
        style={{
          background:
            "linear-gradient(140deg, rgba(12,28,100,0.92) 0%, rgba(5,5,12,0.82) 42%, #000000 100%)",
        }}
      />
      <div
        className="pointer-events-none absolute -left-16 -top-24 h-[34rem] w-[34rem] rounded-full opacity-[0.24]"
        style={{
          background:
            "radial-gradient(circle, rgba(25,70,210,0.82) 0%, rgba(10,40,140,0.16) 48%, transparent 74%)",
          filter: "blur(90px)",
        }}
      />
      <div
        className="pointer-events-none absolute left-1/2 top-[18%] h-[24rem] w-[42rem] -translate-x-1/2 opacity-[0.2]"
        style={{
          background:
            "radial-gradient(ellipse 60% 55% at 50% 50%, rgba(215,70,5,0.55) 0%, rgba(185,50,0,0.16) 42%, transparent 74%)",
          filter: "blur(78px)",
        }}
      />
      <div
        className="pointer-events-none absolute inset-0 opacity-[0.05]"
        style={{
          backgroundImage:
            "linear-gradient(rgba(255,255,255,0.05) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.05) 1px, transparent 1px)",
          backgroundSize: "56px 56px",
        }}
      />
      <div
        className="pointer-events-none absolute inset-0"
        style={{
          background:
            "radial-gradient(ellipse 120% 110% at 50% 50%, transparent 46%, rgba(0,0,0,0.55) 100%)",
        }}
      />

      <div className="relative mx-auto max-w-5xl px-6 lg:px-10">
        <motion.div variants={fadeUp(0)} initial={false} animate="visible">
          <span className="inline-flex items-center gap-2.5 rounded-full border border-white/[0.08] bg-white/[0.04] px-4 py-2 text-[10px] font-semibold uppercase tracking-[0.22em] text-white/40 backdrop-blur-sm">
            <span className="h-1.5 w-1.5 rounded-full bg-[#FF6A00]" />
            Automatiza captación, retención y operación
          </span>
        </motion.div>

        <motion.h1
          className="relative z-10 mx-auto mt-10 max-w-4xl text-[2.2rem] font-semibold leading-[1.05] tracking-[-0.055em] sm:text-[3.4rem] lg:text-[4.8rem]"
          variants={fadeUp(0.12)}
          initial={false}
          animate="visible"
        >
          <span
            className="bg-clip-text text-transparent"
            style={{
              backgroundImage: "linear-gradient(180deg, #f3f4f8 8%, #8a8a98 100%)",
            }}
          >
            Todo lo que hoy te da vueltas en la cabeza
          </span>
          <span
            className="ml-2 bg-clip-text text-transparent"
            style={{
              backgroundImage: "linear-gradient(95deg, #ff9a4a 0%, #fb5c0a 60%, #d94000 100%)",
            }}
          >
            entra en un solo lugar.
          </span>
        </motion.h1>

        <motion.p
          className="mx-auto mt-8 max-w-2xl text-base font-light leading-relaxed tracking-tight text-white/40 lg:text-lg"
          variants={fadeUp(0.24)}
          initial={false}
          animate="visible"
        >
          FitGrowX centraliza al dueño, al staff y al alumno en un mismo sistema.
          <br className="hidden md:block" />
          <span className="font-medium text-white/70">
            Automatiza WhatsApp para captar y retener, ordena cobros, clases, rutinas y le da a cada rol su propio panel.
          </span>
        </motion.p>

        <motion.div
          className="mt-10 flex flex-col items-center justify-center gap-3 sm:flex-row"
          variants={fadeUp(0.34)}
          initial={false}
          animate="visible"
        >
          <PrimaryButton />
          <GhostButton />
        </motion.div>

        <motion.div
          className="mt-8 flex flex-wrap items-center justify-center gap-3 text-[11px] uppercase tracking-[0.15em] text-white/26"
          variants={fadeUp(0.4)}
          initial={false}
          animate="visible"
        >
          <span className="rounded-full border border-white/[0.08] bg-white/[0.03] px-4 py-2">15 días gratis</span>
          <span className="rounded-full border border-white/[0.08] bg-white/[0.03] px-4 py-2">Sin tarjeta</span>
          <span className="rounded-full border border-white/[0.08] bg-white/[0.03] px-4 py-2">Setup simple</span>
        </motion.div>
      </div>
    </section>
  );
}
