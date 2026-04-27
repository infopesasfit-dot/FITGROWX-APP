"use client";

import { useState } from "react";
import Link from "next/link";
import { motion, AnimatePresence, type Variants } from "framer-motion";
import { ArrowRight, CheckCircle2, ChevronDown } from "lucide-react";

const EASE: [number, number, number, number] = [0.16, 1, 0.3, 1];

const headVariant: Variants = {
  hidden:  { opacity: 0, y: 28 },
  visible: { opacity: 1, y: 0, transition: { duration: 0.8, ease: EASE } },
};

const container: Variants = {
  hidden: {},
  visible: { transition: { staggerChildren: 0.12, delayChildren: 0.15 } },
};

const cardVariant: Variants = {
  hidden:  { opacity: 0, y: 40, filter: "blur(8px)" },
  visible: { opacity: 1, y: 0,  filter: "blur(0px)", transition: { duration: 0.75, ease: EASE } },
};

const ctaVariant: Variants = {
  hidden:  { opacity: 0, y: 20 },
  visible: { opacity: 1, y: 0, transition: { duration: 0.7, ease: EASE, delay: 0.55 } },
};

interface Plan {
  name: string;
  price: string;
  period: string;
  badge: string | null;
  featured?: boolean;
  studentLimit: string;
  description: string;
  features: string[];
}

function MobileAccordion({ plans }: { plans: Plan[] }) {
  const defaultOpen = plans.findIndex(p => p.featured);
  const [open, setOpen] = useState(defaultOpen >= 0 ? defaultOpen : 0);

  return (
    <div className="flex flex-col gap-3 mb-10">
      {plans.map((plan, i) => {
        const isOpen = open === i;
        return (
          <div
            key={i}
            className={`rounded-2xl border overflow-hidden transition-colors duration-300 ${
              plan.featured
                ? "border-[#FF6A00]/40 bg-white/[0.02]"
                : "border-white/[0.07] bg-transparent"
            }`}
          >
            {/* Header — siempre visible */}
            <button
              onClick={() => setOpen(isOpen ? -1 : i)}
              className="w-full flex items-center justify-between gap-3 px-5 py-4"
            >
              <div className="flex items-center gap-3 min-w-0">
                {plan.featured && plan.badge && (
                  <span className="shrink-0 rounded-full bg-[#FF6A00] px-2.5 py-0.5 text-[9px] font-bold uppercase tracking-widest text-black">
                    {plan.badge}
                  </span>
                )}
                <span className="text-[0.95rem] font-medium text-white/90 truncate">{plan.name}</span>
              </div>
              <div className="flex items-center gap-3 shrink-0">
                <div className="text-right">
                  <span className="text-lg font-extralight tracking-tight text-white">{plan.price}</span>
                  <span className="text-white/30 text-[10px] ml-1">/mes</span>
                </div>
                <ChevronDown
                  size={16}
                  className="text-white/40 transition-transform duration-300"
                  style={{ transform: isOpen ? "rotate(180deg)" : "rotate(0deg)" }}
                />
              </div>
            </button>

            {/* Contenido expandible */}
            <AnimatePresence initial={false}>
              {isOpen && (
                <motion.div
                  key="content"
                  initial={{ height: 0, opacity: 0 }}
                  animate={{ height: "auto", opacity: 1, transition: { duration: 0.35, ease: EASE } }}
                  exit={{ height: 0, opacity: 0, transition: { duration: 0.25, ease: [0.4, 0, 0.6, 1] } }}
                  style={{ overflow: "hidden" }}
                >
                  <div className="px-5 pb-5 pt-1 border-t border-white/[0.06]">
                    <div className="inline-flex items-center rounded-full border border-white/10 bg-white/[0.03] px-3 py-1 text-[10px] font-medium tracking-[0.04em] text-white/50 mb-3">
                      {plan.studentLimit}
                    </div>
                    <p className="text-[0.82rem] font-light leading-relaxed text-white/45 mb-5">
                      {plan.description}
                    </p>
                    <div className="space-y-3">
                      {plan.features.map((feat, idx) => (
                        <div key={idx} className="flex items-start gap-2.5 text-[0.8rem] text-white/40">
                          <CheckCircle2 className="h-3.5 w-3.5 text-[#FF6A00]/60 mt-0.5 shrink-0" />
                          <span className="font-light">{feat}</span>
                        </div>
                      ))}
                    </div>
                    <Link
                      href="/start"
                      className="mt-5 flex items-center justify-center gap-2 w-full rounded-xl py-3 text-[0.82rem] font-semibold transition-all duration-200 active:scale-[0.98]"
                      style={
                        plan.featured
                          ? { background: "linear-gradient(180deg,#ff7a1a 0%,#ff6000 55%,#e05000 100%)", color: "white", boxShadow: "0 4px 16px rgba(255,96,0,0.30)" }
                          : { background: "rgba(255,255,255,0.05)", color: "rgba(255,255,255,0.6)", border: "1px solid rgba(255,255,255,0.08)" }
                      }
                    >
                      Empezar gratis <ArrowRight size={13} />
                    </Link>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        );
      })}
    </div>
  );
}

export function PricingSection({ plans }: { plans: Plan[] }) {
  return (
    <div className="mx-auto max-w-7xl px-6 lg:px-10">
      <motion.div
        className="mx-auto max-w-3xl text-center mb-10 lg:mb-16"
        variants={headVariant}
        initial={false}
        animate="visible"
      >
        <h2 className="text-[10px] font-semibold uppercase tracking-[0.25em] text-[#FF8C3A] mb-4">Membresías</h2>
        <p className="text-3xl sm:text-4xl lg:text-5xl font-extralight tracking-[-0.05em] text-white leading-[1.1]">
          Elegí la potencia de <span className="italic font-normal text-[#FF8C3A]">tu crecimiento</span>.
        </p>
        <p className="mt-5 text-sm sm:text-[15px] font-light text-white/45">
          15 días gratis para probar FitGrowX, sin tarjeta y con activación simple desde el primer ingreso.
        </p>
      </motion.div>

      {/* Mobile: acordeones */}
      <div className="lg:hidden">
        <MobileAccordion plans={plans} />
      </div>

      {/* Desktop: grid original */}
      <motion.div
        className="hidden lg:grid gap-6 lg:grid-cols-3 mb-12 lg:mb-20"
        variants={container}
        initial={false}
        animate="visible"
      >
        {plans.map((plan, i) => (
          <motion.article
            key={i}
            variants={cardVariant}
            className={`relative flex flex-col rounded-[2.5rem] border p-10 transition-all duration-500 backdrop-blur-sm ${
              plan.featured
                ? "border-[#FF6A00]/30 bg-white/[0.02] scale-105 z-10 shadow-[0_0_50px_rgba(255,106,0,0.05)] hover:border-[#FF6A00]/70 hover:shadow-[0_0_60px_rgba(255,106,0,0.12)]"
                : "border-white/[0.06] bg-transparent hover:border-[#FF6A00]/40 hover:shadow-[0_0_40px_rgba(255,106,0,0.06)]"
            }`}
          >
            {plan.featured && plan.badge && (
              <div className="absolute -top-4 left-1/2 -translate-x-1/2 rounded-full bg-[#FF6A00] px-4 py-1 text-[10px] font-bold uppercase tracking-widest text-black shadow-lg">
                {plan.badge}
              </div>
            )}
            <h3 className="text-2xl font-light tracking-tight text-white/90">{plan.name}</h3>
            <div className="mt-6 flex items-baseline gap-1">
              <span className="text-5xl font-extralight tracking-tighter">{plan.price}</span>
              <span className="text-white/30 font-light text-sm">{plan.period}</span>
            </div>
            <div className="mt-4 inline-flex w-fit items-center rounded-full border border-white/10 bg-white/[0.03] px-3 py-1 text-[11px] font-medium tracking-[0.04em] text-white/55">
              {plan.studentLimit}
            </div>
            <p className="mt-6 min-h-[50px] text-[0.95rem] font-light leading-relaxed text-white/50">{plan.description}</p>
            <div className="mt-10 space-y-4">
              {plan.features.map((feat, idx) => (
                <div key={idx} className="flex items-start gap-3 text-[0.85rem] text-white/40">
                  <CheckCircle2 className="h-4 w-4 text-[#FF6A00]/60 mt-0.5 shrink-0" />
                  <span className="font-light tracking-wide">{feat}</span>
                </div>
              ))}
            </div>
          </motion.article>
        ))}
      </motion.div>

      <motion.div
        className="flex flex-col items-center justify-center gap-3 mt-8 lg:mt-16"
        variants={ctaVariant}
        initial={false}
        animate="visible"
      >
        <Link
          href="/start"
          className="group relative inline-flex items-center gap-3 overflow-hidden rounded-full px-7 py-3.5 sm:px-10 sm:py-4 text-sm sm:text-[15px] font-semibold text-white transition-all duration-300 hover:scale-[1.03] active:scale-[0.98]"
          style={{
            background: "linear-gradient(180deg, #ff7a1a 0%, #ff6000 55%, #e05000 100%)",
            boxShadow: "inset 0 1px 0 rgba(255,255,255,0.28), inset 0 -1px 0 rgba(0,0,0,0.18), 0 8px 32px rgba(255,96,0,0.35), 0 2px 8px rgba(255,96,0,0.20)",
          }}
        >
          <span className="pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-white/30 to-transparent" />
          <span className="relative z-10">Empezar prueba gratis</span>
          <ArrowRight className="relative z-10 h-4 w-4 transition-transform duration-200 group-hover:translate-x-1" />
          <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/10 to-transparent -translate-x-full group-hover:translate-x-full transition-transform duration-700" />
        </Link>
        <p className="text-[11px] text-white/25 tracking-wide">Probás 15 días gratis el plan completo · Luego elegís cómo seguir</p>
        <p className="text-[11px] text-white/20 tracking-wide">Sin tarjeta de crédito · Activación en minutos · Cancelás cuando quieras</p>
      </motion.div>
    </div>
  );
}
