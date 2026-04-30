"use client";

import { motion, type Variants } from "framer-motion";
import { BrainCircuit, Coins, ScanLine, TrendingUp, Users } from "lucide-react";

const EASE: [number, number, number, number] = [0.16, 1, 0.3, 1];

const headingVariant: Variants = {
  hidden: { opacity: 0, y: 24 },
  visible: { opacity: 1, y: 0, transition: { duration: 0.8, ease: EASE } },
};

const containerVariant: Variants = {
  hidden: {},
  visible: { transition: { staggerChildren: 0.1, delayChildren: 0.12 } },
};

const cardVariant: Variants = {
  hidden: { opacity: 0, y: 26, filter: "blur(8px)" },
  visible: { opacity: 1, y: 0, filter: "blur(0px)", transition: { duration: 0.75, ease: EASE } },
};

const outcomes = [
  {
    title: "Más retención",
    description: "Seguimiento automático para que menos alumnos se enfríen.",
    metric: "Menos fugas",
    icon: Users,
    tone: "from-[#1E5EF0]/16 via-[#174BFF]/8 to-transparent",
    borderGlow: "rgba(30,94,240,0.65)",
  },
  {
    title: "Más conversión",
    description: "Los leads entran, avanzan y convierten con menos fricción.",
    metric: "Más cierres",
    icon: TrendingUp,
    tone: "from-[#FF6A00]/18 via-[#FF6A00]/10 to-transparent",
    borderGlow: "rgba(255,106,0,0.68)",
  },
  {
    title: "Menos fricción",
    description: "QR, NFC, DNI, clases y rutina en un mismo flujo.",
    metric: "Operación simple",
    icon: ScanLine,
    tone: "from-[#6D4BFF]/16 via-[#2C63FF]/8 to-transparent",
    borderGlow: "rgba(109,75,255,0.62)",
  },
  {
    title: "Más control",
    description: "Cobros, prospectos y operación visibles en un solo panel.",
    metric: "Negocio visible",
    icon: Coins,
    tone: "from-[#123A9A]/18 via-[#1E5EF0]/10 to-transparent",
    borderGlow: "rgba(23,75,255,0.62)",
  },
];

const signals = [
  "Leads entrando",
  "Seguimiento automático",
  "Check-in ordenado",
  "Cobros visibles",
];

export function OutcomesSection() {
  return (
    <section id="impacto" className="relative overflow-hidden py-18 lg:py-28">
      <div
        className="pointer-events-none absolute left-[-10%] top-[8%] h-[540px] w-[540px] rounded-full opacity-[0.16]"
        style={{
          background: "radial-gradient(circle, rgba(25,75,255,0.9) 0%, rgba(25,75,255,0.1) 42%, transparent 72%)",
          filter: "blur(120px)",
        }}
      />
      <div
        className="pointer-events-none absolute right-[-10%] top-[16%] h-[500px] w-[500px] rounded-full opacity-[0.12]"
        style={{
          background: "radial-gradient(circle, rgba(255,106,0,0.85) 0%, rgba(255,106,0,0.08) 40%, transparent 72%)",
          filter: "blur(120px)",
        }}
      />
      <div
        className="pointer-events-none absolute inset-0 opacity-[0.08]"
        style={{
          backgroundImage:
            "linear-gradient(rgba(255,255,255,0.04) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.04) 1px, transparent 1px)",
          backgroundSize: "58px 58px",
        }}
      />

      <div className="mx-auto grid max-w-7xl gap-8 px-6 lg:grid-cols-[0.82fr_1.18fr] lg:items-start lg:gap-10 lg:px-10">
        <motion.div variants={headingVariant} initial={false} animate="visible" className="relative z-10">
          <div className="inline-flex items-center gap-2 rounded-full border border-[#1E5EF0]/20 bg-white/[0.04] px-4 py-1.5">
            <span className="h-1.5 w-1.5 rounded-full bg-[#FF6A00]" />
            <span className="text-[10px] font-black uppercase tracking-[0.28em] text-[#8AB3FF]">Impacto real</span>
          </div>

          <h2 className="mt-6 max-w-xl text-[2rem] font-semibold leading-[1.04] tracking-[-0.055em] text-white sm:text-[2.6rem] lg:text-[3.5rem]">
            Cuando todo entra
            <br />
            en un solo sistema,
            <span className="block bg-gradient-to-r from-white via-white/92 to-white/46 bg-clip-text text-transparent">
              el gym empieza a moverse distinto.
            </span>
          </h2>

          <p className="mt-5 max-w-md text-[0.95rem] leading-7 text-white/44">
            Captación, retención, cobros y operación conectados para que el gym crezca con menos fricción.
          </p>
        </motion.div>

        <motion.div
          variants={containerVariant}
          initial={false}
          animate="visible"
          className="relative grid gap-4 md:grid-cols-2"
        >
          {outcomes.map((item) => (
            <motion.article
              key={item.title}
              variants={cardVariant}
              className={`group relative overflow-hidden rounded-[1.7rem] border border-white/[0.07] bg-gradient-to-br ${item.tone} bg-white/[0.035] p-5 backdrop-blur-2xl`}
              style={{
                boxShadow:
                  "inset 0 1px 0 rgba(255,255,255,0.05), inset 0 -1px 0 rgba(0,0,0,0.2), 0 16px 38px rgba(0,0,0,0.26)",
              }}
            >
              <motion.div
                aria-hidden="true"
                className="pointer-events-none absolute inset-0 rounded-[1.7rem] p-px"
                animate={{ rotate: 360 }}
                transition={{ duration: 10, ease: "linear", repeat: Infinity }}
                style={{
                  background: `conic-gradient(from 0deg, transparent 0deg, transparent 215deg, ${item.borderGlow} 280deg, transparent 340deg, transparent 360deg)`,
                  WebkitMask:
                    "linear-gradient(#fff 0 0) content-box, linear-gradient(#fff 0 0)",
                  WebkitMaskComposite: "xor",
                  maskComposite: "exclude",
                }}
              />
              <div className="pointer-events-none absolute right-0 top-0 h-24 w-24 bg-white/[0.03] blur-3xl transition-opacity duration-300 group-hover:opacity-100" />
              <div className="relative z-10">
                <div className="mb-5 inline-flex h-11 w-11 items-center justify-center rounded-2xl border border-white/[0.08] bg-black/18">
                  <item.icon className="h-5 w-5 text-white/86" />
                </div>
                <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-white/34">{item.metric}</p>
                <h3 className="mt-2 text-[1.35rem] font-semibold tracking-[-0.04em] text-white">{item.title}</h3>
                <p className="mt-2.5 max-w-[24ch] text-[13px] leading-5 text-white/56">{item.description}</p>
              </div>
            </motion.article>
          ))}

          <motion.div
            variants={cardVariant}
            className="relative overflow-hidden rounded-[1.9rem] border border-[#1E5EF0]/12 bg-[linear-gradient(145deg,rgba(16,24,45,0.96),rgba(8,10,16,0.96))] p-5 md:col-span-2"
            style={{
              boxShadow:
                "inset 0 1px 0 rgba(255,255,255,0.05), inset 0 -1px 0 rgba(0,0,0,0.2), 0 22px 48px rgba(0,0,0,0.28)",
            }}
          >
            <motion.div
              aria-hidden="true"
              className="pointer-events-none absolute inset-0 rounded-[1.9rem] p-px"
              animate={{ rotate: 360 }}
              transition={{ duration: 13, ease: "linear", repeat: Infinity }}
              style={{
                background:
                  "conic-gradient(from 0deg, transparent 0deg, transparent 220deg, rgba(30,94,240,0.62) 286deg, rgba(255,106,0,0.58) 320deg, transparent 350deg, transparent 360deg)",
                WebkitMask:
                  "linear-gradient(#fff 0 0) content-box, linear-gradient(#fff 0 0)",
                WebkitMaskComposite: "xor",
                maskComposite: "exclude",
              }}
            />
            <div className="mb-4 flex items-center justify-between">
              <div>
                <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-[#8AB3FF]">Señales del sistema</p>
                <p className="mt-1 text-[13px] text-white/54">Lo que el sistema empieza a mover solo.</p>
              </div>
              <div className="flex h-10 w-10 items-center justify-center rounded-2xl border border-white/[0.08] bg-white/[0.04]">
                <BrainCircuit className="h-5 w-5 text-[#8AB3FF]" />
              </div>
            </div>

            <div className="grid gap-2.5 sm:grid-cols-2">
              {signals.map((signal, index) => (
                <motion.div
                  key={signal}
                  initial={{ opacity: 0.55 }}
                  animate={{ opacity: [0.55, 1, 0.55] }}
                  transition={{ duration: 4.6, repeat: Infinity, delay: index * 0.35, ease: "easeInOut" }}
                  className="flex items-center gap-3 rounded-[1.05rem] border border-white/[0.06] bg-white/[0.03] px-4 py-2.5"
                >
                  <span className="h-2 w-2 rounded-full bg-[#FF6A00] shadow-[0_0_12px_rgba(255,106,0,0.55)]" />
                  <p className="text-[12.5px] leading-5 text-white/72">{signal}</p>
                </motion.div>
              ))}
            </div>
          </motion.div>
        </motion.div>
      </div>
    </section>
  );
}
