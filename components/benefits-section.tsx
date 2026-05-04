"use client";

import { motion, type Variants } from "framer-motion";
import { MessageCircleMore, CreditCard, ScanLine, LayoutDashboard } from "lucide-react";

const EASE: [number, number, number, number] = [0.16, 1, 0.3, 1];

const stagger: Variants = {
  hidden: {},
  visible: { transition: { staggerChildren: 0.08, delayChildren: 0.05 } },
};
const cardV: Variants = {
  hidden: { opacity: 0, y: 20, filter: "blur(6px)" },
  visible: { opacity: 1, y: 0, filter: "blur(0px)", transition: { duration: 0.72, ease: EASE } },
};

const base: React.CSSProperties = {
  background: "rgba(255,255,255,0.03)",
  border: "1px solid rgba(255,255,255,0.07)",
  backdropFilter: "blur(20px)",
  WebkitBackdropFilter: "blur(20px)",
};

const cells = [
  {
    span: "md:col-span-2",
    icon: MessageCircleMore,
    iconColor: "#FF6A00",
    eyebrow: "WhatsApp Automation",
    headline: "Cada consulta\nse responde sola.",
    sub: "Los leads entran, avanzan y cierran sin que muevas un dedo.",
  },
  {
    span: "md:col-span-1 md:row-span-2",
    icon: LayoutDashboard,
    iconColor: "#818CF8",
    eyebrow: "Panel de control",
    headline: "Todo\nvisible.",
    sub: "Alumnos, cobros y prospectos en una sola superficie.",
    big: "142",
    bigLabel: "alumnos activos",
  },
  {
    span: "md:col-span-1",
    icon: CreditCard,
    iconColor: "#34D399",
    eyebrow: "Cobros",
    headline: "Cobrás sin\npedir por favor.",
    sub: "Vencimientos y recordatorios automáticos.",
  },
  {
    span: "md:col-span-1",
    icon: ScanLine,
    iconColor: "#FF6A00",
    eyebrow: "Check-in",
    headline: "Operación\nsin papel.",
    sub: "QR, asistencia y clases en un solo flujo.",
  },
];

export function BenefitsSection() {
  return (
    <section id="beneficios" className="scroll-mt-24 relative py-20 lg:py-32">
      <div className="mx-auto max-w-7xl px-6 lg:px-10">

        <motion.h2
          className="text-3xl sm:text-4xl lg:text-5xl font-extralight tracking-[-0.05em] text-white leading-[1.08] mb-12 lg:mb-16 max-w-lg"
          initial={{ opacity: 0, y: 18 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, amount: 0.5 }}
          transition={{ duration: 0.75, ease: EASE }}
        >
          Un sistema que trabaja{" "}
          <span className="text-white/35">mientras vos entrenás.</span>
        </motion.h2>

        <motion.div
          className="grid grid-cols-1 md:grid-cols-3 gap-3"
          variants={stagger}
          initial="hidden"
          whileInView="visible"
          viewport={{ once: true, amount: 0.12 }}
        >
          {cells.map((c) => (
            <motion.article
              key={c.eyebrow}
              variants={cardV}
              className={`${c.span} rounded-[1.6rem] p-7 lg:p-8 flex flex-col justify-between min-h-[220px]`}
              style={base}
            >
              {/* Top */}
              <div>
                <div className="flex items-center gap-2 mb-6">
                  <c.icon size={15} style={{ color: c.iconColor }} strokeWidth={1.8} />
                  <span className="text-[10px] font-semibold uppercase tracking-[0.22em] text-white/30">
                    {c.eyebrow}
                  </span>
                </div>

                <h3
                  className="text-[1.55rem] sm:text-[1.75rem] font-light tracking-[-0.04em] text-white leading-[1.1] whitespace-pre-line"
                >
                  {c.headline}
                </h3>
              </div>

              {/* Bottom */}
              <div className="mt-6">
                {c.big && (
                  <p className="text-[3.5rem] font-extralight tracking-[-0.06em] text-white leading-none mb-1"
                    style={{ fontFamily: "var(--font-mono,'JetBrains Mono',monospace)" }}>
                    {c.big}
                    <span className="text-[1rem] text-white/25 ml-2 font-light tracking-normal" style={{ fontFamily: "inherit" }}>
                      {c.bigLabel}
                    </span>
                  </p>
                )}
                <p className="text-[13px] leading-relaxed text-white/35">{c.sub}</p>
              </div>
            </motion.article>
          ))}
        </motion.div>
      </div>
    </section>
  );
}
