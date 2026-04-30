"use client";

import Image from "next/image";
import { useRef, useEffect } from "react";
import {
  motion,
  useMotionValue,
  useTransform,
  useSpring,
  type Variants,
} from "framer-motion";

const EASE: [number, number, number, number] = [0.16, 1, 0.3, 1];

const fadeUp = (delay = 0): Variants => ({
  hidden:  { opacity: 0, y: 32 },
  visible: { opacity: 1, y: 0, transition: { duration: 0.85, ease: EASE, delay } },
});

export function DemoSection() {
  const sectionRef = useRef<HTMLDivElement>(null);
  const copyRef  = useRef<HTMLDivElement>(null);

  // Normalized pointer position (0–1). Default center = 0.5
  const pointerX = useMotionValue(0.5);
  const pointerY = useMotionValue(0.5);

  // ── Dashboard layer: slow & subtle (±5px) ──
  const dashRawX = useTransform(pointerX, [0, 1], [-5, 5]);
  const dashRawY = useTransform(pointerY, [0, 1], [-4, 4]);
  const dashX = useSpring(dashRawX, { stiffness: 70, damping: 22 });
  const dashY = useSpring(dashRawY, { stiffness: 70, damping: 22 });

  // ── Phone tilt (rotateX/Y for 3-D feel) ──
  const phoneTiltXRaw = useTransform(pointerY, [0, 1], [12, -12]);
  const phoneTiltYRaw = useTransform(pointerX, [0, 1], [-12, 12]);
  const phoneTiltX = useSpring(phoneTiltXRaw, { stiffness: 45, damping: 14 });
  const phoneTiltY = useSpring(phoneTiltYRaw, { stiffness: 45, damping: 14 });

  // ── Pointer handlers scoped to the section ──
  useEffect(() => {
    const section = sectionRef.current;
    if (!section) return;
    const currentSection = section;
    let raf = 0;

    function onTouchMove(e: TouchEvent) {
      const touch = e.touches[0];
      const rect = currentSection.getBoundingClientRect();
      pointerX.set((touch.clientX - rect.left) / rect.width);
      pointerY.set((touch.clientY - rect.top) / rect.height);
    }
    function onTouchEnd() {
      pointerX.set(0.5);
      pointerY.set(0.5);
    }

    function onMouseMove(e: MouseEvent) {
      if (raf) cancelAnimationFrame(raf);
      raf = requestAnimationFrame(() => {
        const rect = currentSection.getBoundingClientRect();
        pointerX.set((e.clientX - rect.left) / rect.width);
        pointerY.set((e.clientY - rect.top) / rect.height);
      });
    }

    function onMouseLeave() {
      pointerX.set(0.5);
      pointerY.set(0.5);
    }

    currentSection.addEventListener("touchmove", onTouchMove, { passive: true });
    currentSection.addEventListener("touchend", onTouchEnd);
    currentSection.addEventListener("mousemove", onMouseMove);
    currentSection.addEventListener("mouseleave", onMouseLeave);
    return () => {
      currentSection.removeEventListener("touchmove", onTouchMove);
      currentSection.removeEventListener("touchend", onTouchEnd);
      currentSection.removeEventListener("mousemove", onMouseMove);
      currentSection.removeEventListener("mouseleave", onMouseLeave);
      if (raf) cancelAnimationFrame(raf);
    };
  }, [pointerX, pointerY]);

  return (
    <section
      id="demo"
      ref={sectionRef}
      className="scroll-mt-32 relative overflow-hidden border-y border-white/[0.04]"
    >
      {/* ── Luz azul fría — esquina superior izquierda ── */}
      <div
        className="pointer-events-none absolute -left-20 -top-20 w-[640px]"
        style={{
          background:
            "radial-gradient(ellipse 60% 55% at 15% 15%, rgba(30,80,240,0.26) 0%, rgba(10,40,170,0.10) 48%, transparent 72%)",
          filter: "blur(80px)",
        }}
      />

      {/* ── Grid naranja con mask radial compuesta — sin cortes duros ── */}
      <div
        className="pointer-events-none absolute inset-0"
        style={{
          backgroundImage:
            "linear-gradient(rgba(255,106,0,0.08) 1px, transparent 1px), linear-gradient(90deg, rgba(255,106,0,0.08) 1px, transparent 1px)",
          backgroundSize: "64px 64px",
          maskImage:
            "radial-gradient(ellipse 70% 80% at 68% 52%, black 0%, rgba(0,0,0,0.55) 35%, rgba(0,0,0,0.12) 58%, transparent 76%)",
          WebkitMaskImage:
            "radial-gradient(ellipse 70% 80% at 68% 52%, black 0%, rgba(0,0,0,0.55) 35%, rgba(0,0,0,0.12) 58%, transparent 76%)",
        }}
      />

      {/* ── Halo naranja atmosférico — el dashboard emite calor ── */}
      <div
        className="pointer-events-none absolute"
        style={{
          right: "-6%",
          top: "8%",
          width: "70%",
          height: "88%",
          background:
            "radial-gradient(ellipse 60% 55% at 52% 52%, rgba(220,80,0,0.20) 0%, rgba(160,45,0,0.08) 42%, rgba(90,20,0,0.03) 68%, transparent 85%)",
          filter: "blur(140px)",
        }}
      />

      <div
        className="mx-auto grid max-w-7xl gap-10 px-6 py-14 lg:gap-16 lg:py-32 lg:grid-cols-[0.85fr_1.15fr] lg:items-center lg:px-10"
        style={{
          maskImage:
            "radial-gradient(ellipse 110% 90% at 50% 50%, black 45%, rgba(0,0,0,0.7) 70%, rgba(0,0,0,0.2) 88%, transparent 100%)",
          WebkitMaskImage:
            "radial-gradient(ellipse 110% 90% at 50% 50%, black 45%, rgba(0,0,0,0.7) 70%, rgba(0,0,0,0.2) 88%, transparent 100%)",
        }}
      >

        {/* ── COPY ── */}
        <div ref={copyRef} className="relative z-20">
          <motion.h2
            className="text-3xl font-extralight leading-[1.1] tracking-[-0.05em] sm:text-4xl lg:text-6xl"
            style={{
              backgroundImage:
                "linear-gradient(135deg, #ffffff 0%, #ffe8d6 38%, #ffb87a 68%, #ff8c3a 100%)",
              WebkitBackgroundClip: "text",
              WebkitTextFillColor: "transparent",
              backgroundClip: "text",
            }}
            variants={fadeUp(0)}
            initial={false}
            animate="visible"
          >
            Tu gym,{" "}
            <br />
            <span
              className="font-extralight italic"
              style={{ fontFamily: "var(--font-inter), 'Inter', sans-serif" }}
            >
              en la palma
            </span>{" "}
            de tu mano.
          </motion.h2>

          <motion.p
            className="mt-8 max-w-md text-[1.05rem] font-light leading-[1.85] text-white/40"
            variants={fadeUp(0.18)}
            initial={false}
            animate="visible"
          >
            Interfaz diseñada para la claridad absoluta. Gestioná tu centro
            desde el dashboard profesional o tomá el control total desde tu
            móvil.
          </motion.p>

          {/* Platform badges */}
          <motion.div
            className="mt-10 flex flex-wrap gap-4"
            variants={fadeUp(0.32)}
            initial={false}
            animate="visible"
          >
            <div className="flex items-center gap-2 rounded-full border border-white/10 bg-white/[0.04] px-4 py-2 text-[10px] uppercase tracking-[0.15em] text-white/50">
              <span className="h-1.5 w-1.5 rounded-full bg-blue-500 shadow-[0_0_8px_rgba(59,130,246,0.5)]" />
              Escritorio
            </div>
            <div className="flex items-center gap-2 rounded-full border border-white/10 bg-white/[0.04] px-4 py-2 text-[10px] uppercase tracking-[0.15em] text-white/50">
              <span className="h-1.5 w-1.5 rounded-full bg-orange-500 shadow-[0_0_8px_rgba(255,106,0,0.5)]" />
              Móvil Optimizado
            </div>
          </motion.div>
        </div>

        {/* ── MOCKUPS ── */}
        <motion.div
          className="relative flex justify-center lg:justify-end pb-16 sm:pb-8 lg:pb-0"
          variants={fadeUp(0.12)}
          initial={false}
          animate="visible"
        >
          {/* Halo de calor local */}
          <div
            className="pointer-events-none absolute left-1/2 top-1/2 -z-10 h-[115%] w-[115%] -translate-x-1/2 -translate-y-1/2"
            style={{
              background:
                "radial-gradient(ellipse 65% 60% at 50% 52%, rgba(220,78,0,0.22) 0%, rgba(130,35,0,0.08) 50%, transparent 78%)",
              filter: "blur(90px)",
            }}
          />

          {/* Dashboard — capa lenta */}
          <motion.div
            className="relative z-10 w-full max-w-[680px]"
            style={{ x: dashX, y: dashY }}
          >
            <div
              className="overflow-hidden rounded-[2.2rem] border border-white/[0.08] bg-[#050505] p-2"
              style={{
                boxShadow:
                  "0 0 0 1px rgba(255,106,0,0.07), 0 0 50px rgba(255,106,0,0.14), 0 40px 80px rgba(0,0,0,0.65)",
              }}
            >
              <div className="overflow-hidden rounded-[1.6rem] border border-white/[0.05]">
                <Image
                  src="/images/fitgrowx-dashboard-real-new.png"
                  alt="Dashboard FitGrowX"
                  width={1240}
                  height={760}
                  className="h-auto w-full"
                  priority
                />
              </div>
            </div>
          </motion.div>

          {/* Celular — draggable con tilt 3D */}
          <motion.div
            drag
            dragMomentum={false}
            dragElastic={0.12}
            whileDrag={{ scale: 1.04, cursor: "grabbing" }}
            className="absolute -bottom-10 -left-4 z-30 w-[160px] sm:w-[200px] lg:-left-8 lg:bottom-[-16px] cursor-grab"
            style={{
              rotateX: phoneTiltX,
              rotateY: phoneTiltY,
              transformPerspective: 800,
            }}
          >
            {/* Glow naranja atmosférico detrás del celu */}
            <div className="absolute -inset-4 -z-10 rounded-[4rem] bg-[#FF6A00]/20 blur-3xl opacity-60" />

            {/* Sombra proyectada */}
            <div className="absolute -bottom-6 left-1/2 -z-10 h-14 w-4/5 -translate-x-1/2 rounded-full bg-orange-600/20 blur-2xl" />

            {/* Carcasa */}
            <div
              className="relative rounded-[2.6rem] border-[5px] border-[#181818] bg-[#0a0a0a] p-1"
              style={{
                boxShadow:
                  "0 50px 120px rgba(0,0,0,0.92), " +
                  "0 20px 60px rgba(0,0,0,0.70), " +
                  "0 0 0 1px rgba(255,255,255,0.04), " +
                  "0 0 32px rgba(255,106,0,0.16)",
              }}
            >
              {/* Notch */}
              <div className="absolute left-1/2 top-2.5 h-[14px] w-[52px] -translate-x-1/2 rounded-full bg-[#181818]" />
              <div className="overflow-hidden rounded-[2.2rem] border border-white/[0.04]">
                <Image
                  src="/images/fitgrowx-plataforma-celu.png"
                  alt="App móvil FitGrowX"
                  width={400}
                  height={850}
                  className="w-full"
                />
              </div>
              {/* Reflejo especular que se mueve con el tilt */}
              <div className="pointer-events-none absolute inset-0 z-20 rounded-[2.2rem] bg-gradient-to-tr from-white/[0.07] via-white/[0.03] to-transparent" />
            </div>
          </motion.div>
        </motion.div>

      </div>
    </section>
  );
}
