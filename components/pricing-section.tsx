"use client";

import { useState } from "react";
import Link from "next/link";
import { motion, type Variants } from "framer-motion";
import { ArrowRight, CheckCircle2 } from "lucide-react";

const EASE: [number, number, number, number] = [0.16, 1, 0.3, 1];

const headVariant: Variants = {
  hidden: { opacity: 0, y: 28 },
  visible: { opacity: 1, y: 0, transition: { duration: 0.8, ease: EASE } },
};

const cardVariant: Variants = {
  hidden: { opacity: 0, y: 40, filter: "blur(8px)" },
  visible: { opacity: 1, y: 0, filter: "blur(0px)", transition: { duration: 0.75, ease: EASE, delay: 0.12 } },
};

function fmt(n: number) {
  return n.toLocaleString("es-AR", { maximumFractionDigits: 0 });
}

interface Plan {
  name: string;
  priceMonthly: number;
  priceAnnual: number;
  annualTotal: number;
  savings: number;
  badge: string | null;
  featured?: boolean;
  description: string;
  features: string[];
}

export function PricingSection({ plans }: { plans: Plan[] }) {
  const plan = plans[0];
  const [billing, setBilling] = useState<"mensual" | "anual">("mensual");

  if (!plan) return null;

  const price = billing === "mensual" ? plan.priceMonthly : plan.priceAnnual;

  return (
    <div className="mx-auto max-w-7xl px-6 lg:px-10">
      {/* Heading */}
      <motion.div
        className="mx-auto max-w-3xl text-center mb-10 lg:mb-14"
        variants={headVariant}
        initial={false}
        animate="visible"
      >
        <h2 className="text-[10px] font-semibold uppercase tracking-[0.25em] text-[#FF8C3A] mb-4">Membresía</h2>
        <p className="text-3xl sm:text-4xl lg:text-5xl font-extralight tracking-[-0.05em] text-white leading-[1.08]">
          Una sola membresía para que{" "}
          <span className="italic font-normal text-[#FF8C3A]">todo el gym</span> funcione mejor.
        </p>
        <p className="mt-5 text-sm sm:text-[15px] font-light text-white/45">
          Probás 15 días gratis, sin tarjeta. Después elegís cómo seguir.
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

      {/* Single plan card — centered like "Pro" card */}
      <motion.div
        className="mx-auto max-w-md"
        variants={cardVariant}
        initial={false}
        animate="visible"
      >
        <article
          className="relative overflow-hidden rounded-3xl p-7 sm:p-8"
          style={{
            background: "linear-gradient(160deg, #111118 0%, #0c0c12 100%)",
            border: "1px solid rgba(255,106,0,0.28)",
            boxShadow: "0 0 0 1px rgba(255,106,0,0.08), 0 24px 64px rgba(0,0,0,0.5), 0 0 80px rgba(255,96,0,0.10)",
          }}
        >
          {/* Glow top-left */}
          <div
            className="absolute -top-16 -left-16 w-52 h-52 rounded-full pointer-events-none"
            style={{ background: "radial-gradient(circle, rgba(255,106,0,0.18) 0%, transparent 70%)" }}
          />

          <div className="relative z-10">
            {/* Name + description */}
            <p className="text-lg font-semibold text-white tracking-tight">FitGrowX</p>
            <p className="mt-2 text-sm font-light leading-relaxed text-white/50">
              {plan.description}
            </p>

            {/* Price row */}
            <div className="mt-6 flex items-center gap-3">
              <span className="text-5xl font-extralight tracking-[-0.06em] text-white">
                ${fmt(price)}
              </span>
              <div className="flex flex-col gap-1">
                <span className="text-xs font-medium text-white/30 uppercase tracking-widest">/mes</span>
                {billing === "anual" && (
                  <span
                    className="rounded-full px-2 py-0.5 text-[11px] font-bold"
                    style={{ background: "rgba(249,115,22,0.15)", color: "#F97316" }}
                  >
                    −20%
                  </span>
                )}
              </div>
            </div>

            {billing === "anual" ? (
              <p className="mt-2 text-xs font-light text-white/35">
                Facturado como ${fmt(plan.annualTotal)} ARS/año · ahorrás ${fmt(plan.savings)}
              </p>
            ) : (
              <p className="mt-2 text-xs font-light text-white/30">
                Pasá a anual y ahorrás{" "}
                <span className="text-[#FF8C3A]/80">${fmt(plan.savings)} ARS</span> por año
              </p>
            )}

            <div className="mt-6 h-px bg-white/[0.07]" />

            {/* Features */}
            <p className="mt-6 text-[11px] font-semibold uppercase tracking-[0.18em] text-white/32">
              Qué incluye
            </p>
            <ul className="mt-4 flex flex-col gap-3">
              {plan.features.map((feature) => (
                <li key={feature} className="flex items-start gap-3">
                  <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-[#FF8C3A]" />
                  <span className="text-sm font-light leading-relaxed text-white/62">{feature}</span>
                </li>
              ))}
            </ul>

            {/* CTA */}
            <Link
              href="/start"
              className="group relative mt-8 inline-flex w-full items-center justify-center gap-3 overflow-hidden rounded-2xl px-7 py-3.5 text-sm font-semibold text-white transition-all duration-300 hover:scale-[1.01] active:scale-[0.98]"
              style={{
                background: "linear-gradient(180deg, #ff7a1a 0%, #ff6000 58%, #de4f00 100%)",
                boxShadow: "inset 0 1px 0 rgba(255,255,255,0.22), 0 8px 28px rgba(255,96,0,0.30)",
              }}
            >
              <span className="pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-white/25 to-transparent" />
              <span className="relative z-10">Empezar prueba gratis</span>
              <ArrowRight className="relative z-10 h-4 w-4 transition-transform duration-200 group-hover:translate-x-1" />
            </Link>

            <p className="mt-3 text-center text-[11px] tracking-wide text-white/22">
              Sin tarjeta para probar
              {billing === "anual" ? " · Pago anual al activar" : " · Cancelá cuando quieras"}
            </p>
          </div>
        </article>
      </motion.div>
    </div>
  );
}
