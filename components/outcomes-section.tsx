"use client";

import { motion, type Variants } from "framer-motion";

const EASE: [number, number, number, number] = [0.16, 1, 0.3, 1];
const FM = "var(--font-mono,'JetBrains Mono',monospace)";

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

const stats = [
  {
    value: "98%",
    label: "Retención",
    desc: "El sistema cuida a tu gente.",
    tone: "from-[#1E5EF0]/16 via-[#174BFF]/8 to-transparent",
    border: "rgba(30,94,240,0.18)",
  },
  {
    value: "24/7",
    label: "Tu negocio corre solo.",
    desc: "",
    tone: "from-[#FF6A00]/18 via-[#FF6A00]/10 to-transparent",
    border: "rgba(255,106,0,0.20)",
  },
  {
    value: "1 clic",
    label: "Migración",
    desc: "200 alumnos cargados al instante.",
    tone: "from-[#6D4BFF]/16 via-[#2C63FF]/8 to-transparent",
    border: "rgba(109,75,255,0.18)",
  },
  {
    value: "0%",
    label: "Fricción",
    desc: "Cobrás sin pedir por favor.",
    tone: "from-[#123A9A]/18 via-[#1E5EF0]/10 to-transparent",
    border: "rgba(23,75,255,0.18)",
  },
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
        <motion.div variants={headingVariant} initial="hidden" whileInView="visible" viewport={{ once: true, amount: 0.4 }} className="relative z-10">
          <h2 className="max-w-xs text-[2.4rem] font-semibold leading-[1.06] tracking-[-0.055em] text-white sm:text-[2.8rem] lg:text-[3.6rem]">
            Menos caos.{" "}
            <span className="block bg-gradient-to-r from-white via-white/92 to-white/46 bg-clip-text text-transparent">
              Más negocio.
            </span>
          </h2>
        </motion.div>

        <motion.div
          variants={containerVariant}
          initial="hidden"
          whileInView="visible"
          viewport={{ once: true, amount: 0.2 }}
          className="grid gap-4 md:grid-cols-2"
        >
          {stats.map((item) => (
            <motion.article
              key={item.value}
              variants={cardVariant}
              className={`relative overflow-hidden rounded-[1.7rem] border bg-gradient-to-br ${item.tone} bg-white/[0.035] p-6 backdrop-blur-2xl`}
              style={{
                borderColor: item.border,
                boxShadow: "inset 0 1px 0 rgba(255,255,255,0.05), inset 0 -1px 0 rgba(0,0,0,0.2), 0 16px 38px rgba(0,0,0,0.26)",
              }}
            >
              <div className="relative z-10">
                <p
                  className="text-[2.6rem] font-bold leading-none tracking-[-0.04em] text-white"
                  style={{ fontFamily: FM }}
                >
                  {item.value}
                </p>
                <p className="mt-3 text-[0.95rem] font-semibold tracking-[-0.02em] text-white/90">
                  {item.label}
                </p>
                {item.desc && (
                  <p className="mt-1 text-[13px] leading-5 text-white/46">{item.desc}</p>
                )}
              </div>
            </motion.article>
          ))}
        </motion.div>
      </div>
    </section>
  );
}
