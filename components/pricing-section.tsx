"use client";

import { useState } from "react";
import Link from "next/link";
import { motion, type Variants } from "framer-motion";
import { ArrowRight, CheckCircle2 } from "lucide-react";
import { type FitgrowxPlanDefinition } from "@/lib/fitgrowx-plans";

const EASE: [number, number, number, number] = [0.16, 1, 0.3, 1];

const headVariant: Variants = {
  hidden: { opacity: 0, y: 28 },
  visible: { opacity: 1, y: 0, transition: { duration: 0.8, ease: EASE } },
};

function fmt(n: number) {
  return n.toLocaleString("es-AR", { maximumFractionDigits: 0 });
}

const STARTER_FEATURES = [
  "Avisos automáticos por WhatsApp cuando vence una cuota",
  "Cobrás y tomás asistencia desde el mismo lugar",
  "El alumno entra con QR y ve su estado desde el celu",
  "Hasta 60 alumnos activos",
];

const PRO_FEATURES = [
  "Todo lo del Starter, sin límite de alumnos",
  "Leads de Instagram directo a tu lista",
  "App y landing con el nombre y colores de tu gym",
  "Socios en riesgo detectados antes de que se vayan",
];

function PlanCard({
  plan,
  billing,
  features,
  delay,
}: {
  plan: FitgrowxPlanDefinition;
  billing: "mensual" | "anual";
  features: string[];
  delay: number;
}) {
  const price = billing === "mensual" ? plan.priceMonthly : plan.priceAnnual;
  const isFeatured = plan.highlight;

  return (
    <motion.article
      className="relative overflow-hidden rounded-3xl p-7 flex flex-col"
      initial={{ opacity: 0, y: 20 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, amount: 0.2 }}
      transition={{ duration: 0.75, ease: EASE, delay }}
      style={{
        background: "linear-gradient(160deg, rgba(255,255,255,0.035) 0%, rgba(0,0,0,0.70) 100%)",
        border: isFeatured
          ? "1px solid rgba(255,106,0,0.45)"
          : "1px solid rgba(255,255,255,0.09)",
        boxShadow: isFeatured
          ? "0 0 0 1px rgba(255,106,0,0.08), 0 24px 60px rgba(0,0,0,0.65)"
          : "0 24px 60px rgba(0,0,0,0.55)",
      }}
    >
      {/* Top-edge highlight */}
      <div
        className="absolute inset-x-0 top-0 h-px pointer-events-none"
        style={{
          background: isFeatured
            ? "linear-gradient(90deg, transparent, rgba(255,255,255,0.12) 50%, transparent)"
            : "linear-gradient(90deg, transparent, rgba(255,255,255,0.06) 50%, transparent)",
        }}
      />

      <div className="relative z-10 flex flex-col flex-1">
        {/* Badge */}
        {plan.badge ? (
          <span
            className="self-start mb-3 rounded-full px-3 py-1 text-[10px] font-bold uppercase tracking-wide"
            style={{ background: "rgba(255,106,0,0.16)", color: "#FF8C3A" }}
          >
            {plan.badge}
          </span>
        ) : (
          <div className="mb-3 h-[22px]" />
        )}

        <p className="text-base font-semibold text-white tracking-tight">{plan.name}</p>
        <p className="mt-1 text-xs font-light leading-relaxed text-white/45">{plan.studentLimit}</p>

        {/* Price */}
        <div className="mt-5 flex items-baseline gap-2">
          <span className="text-[2.6rem] font-extralight tracking-[-0.06em] text-white leading-none">
            ${fmt(price)}
          </span>
          <span className="text-xs font-medium text-white/30 uppercase tracking-widest">/mes</span>
          {billing === "anual" && (
            <span
              className="rounded-full px-2 py-0.5 text-[10px] font-bold"
              style={{ background: "rgba(249,115,22,0.15)", color: "#F97316" }}
            >
              −20%
            </span>
          )}
        </div>

        {billing === "anual" ? (
          <p className="mt-1.5 text-[11px] font-light text-white/30">
            ${fmt(plan.annualTotal)} ARS/año · ahorrás ${fmt(plan.savings)}
          </p>
        ) : (
          <p className="mt-1.5 text-[11px] font-light text-white/25">
            Anual: ahorrás <span style={{ color: "rgba(255,140,58,0.7)" }}>${fmt(plan.savings)}</span>/año
          </p>
        )}

        <div className="mt-5 h-px bg-white/[0.07]" />

        {/* Features */}
        <ul className="mt-5 flex flex-col gap-2.5 flex-1">
          {features.map((f) => (
            <li key={f} className="flex items-start gap-2.5">
              <CheckCircle2
                className="mt-0.5 h-[15px] w-[15px] shrink-0"
                style={{ color: isFeatured ? "#FF8C3A" : "rgba(255,255,255,0.30)" }}
              />
              <span className="text-[13px] font-light leading-snug text-white/60">{f}</span>
            </li>
          ))}
        </ul>
      </div>
    </motion.article>
  );
}

export function PricingSection({ plans }: { plans: FitgrowxPlanDefinition[] }) {
  const [billing, setBilling] = useState<"mensual" | "anual">("mensual");

  const [starter, pro] = [plans[0], plans[1]];
  if (!starter || !pro) return null;

  return (
    <div className="mx-auto max-w-7xl px-6 lg:px-10">
      {/* Heading */}
      <motion.div
        className="mx-auto max-w-3xl text-center mb-10 lg:mb-14"
        variants={headVariant}
        initial="hidden"
        whileInView="visible"
        viewport={{ once: true, amount: 0.4 }}
      >
        <h2 className="text-[10px] font-semibold uppercase tracking-[0.25em] text-[#FF8C3A] mb-4">Precios</h2>
        <p className="text-3xl sm:text-4xl lg:text-5xl font-extralight tracking-[-0.05em] text-white leading-[1.08]">
          30 días gratis.{" "}
          <span className="italic font-normal text-[#FF8C3A]">Después elegís</span> según tu gym.
        </p>
        <p className="mt-5 text-sm sm:text-[15px] font-light text-white/40">
          Sin tarjeta. El plan lo elegís cuando cargás tus alumnos y ves cuántos son.
        </p>

        {/* Billing toggle */}
        <div className="mt-8 inline-flex items-center gap-1 rounded-full border border-white/10 bg-white/[0.06] p-1">
          {(["mensual", "anual"] as const).map((b) => (
            <button
              key={b}
              onClick={() => setBilling(b)}
              className="relative flex items-center gap-2 rounded-full px-5 py-2 text-sm font-medium transition-all duration-200"
              style={{
                background: billing === b ? "white" : "transparent",
                color: billing === b ? "#0A0A0A" : "rgba(255,255,255,0.45)",
              }}
            >
              {b === "mensual" ? "Mensual" : "Anual"}
              {b === "anual" && (
                <span
                  className="rounded-full px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wide"
                  style={{
                    background: billing === "anual" ? "rgba(249,115,22,0.15)" : "rgba(255,255,255,0.08)",
                    color: billing === "anual" ? "#F97316" : "rgba(255,255,255,0.3)",
                  }}
                >
                  −20%
                </span>
              )}
            </button>
          ))}
        </div>
      </motion.div>

      {/* Cards */}
      <motion.div
        className="mx-auto grid max-w-2xl grid-cols-1 gap-3 sm:grid-cols-2"
        initial={{ opacity: 0, scale: 0.97 }}
        whileInView={{ opacity: 1, scale: 1 }}
        viewport={{ once: true, amount: 0.2 }}
        transition={{ duration: 0.7, ease: EASE, delay: 0.05 }}
      >
        <PlanCard plan={starter} billing={billing} features={STARTER_FEATURES} delay={0} />
        <PlanCard plan={pro} billing={billing} features={PRO_FEATURES} delay={0.07} />
      </motion.div>

      {/* Single CTA below both cards */}
      <motion.div
        className="mt-8 flex flex-col items-center gap-3"
        initial={{ opacity: 0, y: 12 }}
        whileInView={{ opacity: 1, y: 0 }}
        viewport={{ once: true, amount: 0.5 }}
        transition={{ duration: 0.6, ease: EASE, delay: 0.2 }}
      >
        <Link
          href="/start"
          className="group inline-flex items-center gap-3 overflow-hidden rounded-2xl px-8 py-4 text-sm font-semibold text-white transition-all duration-300 hover:scale-[1.02] active:scale-[0.98]"
          style={{
            background: "linear-gradient(180deg, #ff7a1a 0%, #ff6000 58%, #de4f00 100%)",
            boxShadow: "inset 0 1px 0 rgba(255,255,255,0.22), 0 8px 28px rgba(255,96,0,0.30)",
          }}
        >
          <span className="pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-white/25 to-transparent" />
          <span className="relative z-10">Empezar 30 días gratis</span>
          <ArrowRight className="relative z-10 h-4 w-4 transition-transform duration-200 group-hover:translate-x-1" />
        </Link>
        <p className="text-[11px] tracking-wide text-white/22">
          Sin tarjeta · Elegís el plan cuando cargás tus alumnos · Cancelás cuando querés
        </p>
      </motion.div>
    </div>
  );
}
