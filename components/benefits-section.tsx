"use client";

import { motion, useInView, type Variants } from "framer-motion";
import { MessageCircleMore, Radar, WalletCards, Zap, type LucideIcon } from "lucide-react";
import { useRef } from "react";

const benefits: { title: string; description: string; icon: LucideIcon }[] = [
  {
    title: "Recuperás pagos automáticamente",
    description: "Deudas, vencimientos y recordatorios salen solos para que cobrar no dependa de acordarte.",
    icon: Zap,
  },
  {
    title: "No perdés leads de WhatsApp",
    description: "Cada consulta entra en un flujo ordenado para que el interés no se enfríe ni se pierda.",
    icon: MessageCircleMore,
  },
  {
    title: "Sabés exactamente cómo está tu gym",
    description: "Cobros, alumnos activos y prospectos visibles en una sola superficie clara y accionable.",
    icon: Radar,
  },
];

const EASE: [number, number, number, number] = [0.16, 1, 0.3, 1];

const container: Variants = {
  hidden: {},
  visible: { transition: { staggerChildren: 0.13, delayChildren: 0.06 } },
};

const cardVariant: Variants = {
  hidden: { opacity: 0, y: 36, filter: "blur(8px)" },
  visible: { opacity: 1, y: 0, filter: "blur(0px)", transition: { duration: 0.78, ease: EASE } },
};

const headVariant: Variants = {
  hidden: { opacity: 0, y: 18 },
  visible: { opacity: 1, y: 0, transition: { duration: 0.72, ease: EASE } },
};

export function BenefitsSection() {
  const ref = useRef<HTMLElement>(null);
  const isInView = useInView(ref, { once: true, margin: "-80px" });

  return (
    <section
      ref={ref}
      id="beneficios"
      className="scroll-mt-24 relative pb-16 pt-16 lg:pb-32 lg:pt-32"
    >

      <div className="mx-auto max-w-7xl px-6 lg:px-10">

        {/* Título de sección */}
        <motion.div
          className="flex flex-col items-center mb-10 lg:mb-20"
          variants={headVariant}
          initial="hidden"
          animate={isInView ? "visible" : "hidden"}
        >
          <div className="inline-flex items-center gap-2 rounded-full border border-[#FF6A00]/20 bg-[#FF6A00]/5 px-4 py-1 mb-6">
            <span className="text-[10px] font-black uppercase tracking-[0.3em] text-[#FF6A00]">Beneficios</span>
          </div>
          <h2 className="text-2xl sm:text-3xl lg:text-5xl font-bold tracking-tight text-center bg-gradient-to-b from-white to-white/50 bg-clip-text text-transparent">
            Resultado de negocio, <br /> <span className="text-white">no solo tecnología.</span>
          </h2>
        </motion.div>

        <motion.div
          className="relative grid gap-6 md:grid-cols-3"
          variants={container}
          initial="hidden"
          animate={isInView ? "visible" : "hidden"}
        >
          {benefits.map((b, i) => (
            <motion.article
              key={i}
              variants={cardVariant}
              className="group relative overflow-hidden rounded-[1.5rem] lg:rounded-[2rem] p-6 lg:p-8"
              style={{
                background: "rgba(5,5,5,0.40)",
                backdropFilter: "blur(24px)",
                WebkitBackdropFilter: "blur(24px)",
                border: "1px solid rgba(255,255,255,0.05)",
                boxShadow:
                  "inset 0 1px 0 rgba(255,255,255,0.06), " +
                  "inset 0 -1px 0 rgba(0,0,0,0.22), " +
                  "0 4px 28px rgba(0,0,0,0.32)",
                transition: "border 0.35s ease, box-shadow 0.35s ease",
              }}
              whileHover={{
                boxShadow:
                  "inset 0 1px 0 rgba(255,255,255,0.07), " +
                  "inset 0 -1px 0 rgba(0,0,0,0.22), " +
                  "0 4px 28px rgba(0,0,0,0.32), " +
                  "0 22px 48px rgba(255,106,0,0.10), " +
                  "0 10px 18px rgba(255,106,0,0.05)",
              }}
              transition={{ duration: 0.42 }}
            >
              {/* Hover: orange glow top-right */}
              <div className="absolute -right-10 -top-10 h-32 w-32 bg-[#FF6A00]/10 blur-[50px] transition-opacity opacity-0 group-hover:opacity-100" />

              {/* Hover: orange border overlay */}
              <span
                className="pointer-events-none absolute inset-0 rounded-[2rem] opacity-0 transition-opacity duration-500 group-hover:opacity-100"
                style={{ border: "0.5px solid rgba(255,106,0,0.42)" }}
              />

              {/* Top-highlight micro-border */}
              <span className="pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-white/[0.11] to-transparent" />

              <div className="relative z-10">
                {/* Icon */}
                <div className="mb-6 inline-flex h-12 w-12 items-center justify-center rounded-xl bg-white/[0.05] border border-white/10 group-hover:border-[#FF6A00]/50 transition-colors">
                  <b.icon className="h-6 w-6 text-[#FF6A00]" />
                </div>

                <h3 className="text-xl font-bold text-white mb-4 tracking-tight">{b.title}</h3>
                <p className="text-sm leading-relaxed text-white/40 group-hover:text-white/60 transition-colors">
                  {b.description}
                </p>
              </div>
            </motion.article>
          ))}
        </motion.div>
      </div>
    </section>
  );
}
