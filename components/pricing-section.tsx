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
      <motion.div
        className="mx-auto max-w-3xl text-center mb-10 lg:mb-14"
        variants={headVariant}
        initial={false}
        animate="visible"
      >
        <h2 className="text-[10px] font-semibold uppercase tracking-[0.25em] text-[#FF8C3A] mb-4">Membresía</h2>
        <p className="text-3xl sm:text-4xl lg:text-5xl font-extralight tracking-[-0.05em] text-white leading-[1.08]">
          Una sola membresía para que <span className="italic font-normal text-[#FF8C3A]">todo el gym</span> funcione mejor.
        </p>
        <p className="mt-5 text-sm sm:text-[15px] font-light text-white/45">
          Probás 15 días gratis, sin tarjeta. Después elegís cómo seguir.
        </p>

        {/* Stripe-style billing toggle */}
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
                    background: billing === "anual" ? "rgba(249,115,22,0.12)" : "rgba(255,255,255,0.08)",
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

      <motion.div
        className="mx-auto max-w-4xl"
        variants={cardVariant}
        initial={false}
        animate="visible"
      >
        <article className="relative overflow-hidden rounded-[2.75rem] border border-[#FF6A00]/20 bg-white/[0.03] p-7 sm:p-9 lg:p-12 shadow-[0_0_60px_rgba(255,106,0,0.08)] backdrop-blur-sm">
          <div className="absolute inset-0 opacity-[0.18] pointer-events-none" style={{ background: "radial-gradient(circle at 20% 25%, rgba(255,106,0,0.22), transparent 36%), radial-gradient(circle at 85% 15%, rgba(255,140,58,0.16), transparent 30%)" }} />
          <div
            className="absolute inset-0 opacity-[0.05] pointer-events-none mix-blend-screen"
            style={{
              backgroundImage: "radial-gradient(rgba(255,255,255,0.85) 0.7px, transparent 0.7px)",
              backgroundSize: "8px 8px",
            }}
          />

          <div className="relative z-10 grid gap-8 lg:grid-cols-[1.1fr_0.9fr] lg:items-start">
            {/* Left — plan info + features */}
            <div>
              <h3 className="text-3xl sm:text-[2.6rem] font-light tracking-[-0.05em] text-white">
                FitGrowX
              </h3>
              <p className="mt-4 max-w-2xl text-sm sm:text-[15px] font-light leading-relaxed text-white/55">
                {plan.description}
              </p>
              <div className="mt-8 grid gap-3 sm:grid-cols-2">
                {plan.features.map((feature) => (
                  <div key={feature} className="flex items-start gap-3 rounded-2xl border border-white/[0.06] bg-white/[0.03] px-4 py-3 text-sm text-white/62">
                    <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-[#FF8C3A]" />
                    <span className="font-light leading-relaxed">{feature}</span>
                  </div>
                ))}
              </div>
            </div>

            {/* Right — price + CTA */}
            <div className="rounded-[2rem] border border-white/[0.06] bg-[#0B0B10]/80 p-6 sm:p-7">
              <p className="text-[10px] font-semibold uppercase tracking-[0.22em] text-white/32">
                {billing === "mensual" ? "Precio mensual" : "Precio anual"}
              </p>

              <div className="mt-4 flex items-end gap-2">
                <span className="text-4xl sm:text-5xl font-extralight tracking-[-0.06em] text-white">
                  ${fmt(price)}
                </span>
                <span className="pb-2 text-xs font-medium uppercase tracking-[0.14em] text-white/28">/mes</span>
              </div>

              {billing === "anual" ? (
                <p className="mt-2 text-sm font-light text-white/45">
                  Facturado como <span className="text-white/65">${fmt(plan.annualTotal)} ARS/año</span> · ahorrás ${fmt(plan.savings)}
                </p>
              ) : (
                <p className="mt-2 text-sm font-light text-white/38">
                  Pasá a anual y ahorrás <span className="text-[#FF8C3A]">${fmt(plan.savings)} ARS</span> por año
                </p>
              )}

              <div className="mt-6 rounded-2xl border border-[#FF6A00]/14 bg-[#FF6A00]/8 px-4 py-3 text-sm text-white/70">
                Incluye branding, app del alumno, automatizaciones y gestión completa desde el día uno.
              </div>

              <Link
                href="/start"
                className="group mt-7 inline-flex w-full items-center justify-center gap-3 overflow-hidden rounded-full px-7 py-4 text-sm font-semibold text-white transition-all duration-300 hover:scale-[1.01] active:scale-[0.98]"
                style={{
                  background: "linear-gradient(180deg, #ff7a1a 0%, #ff6000 58%, #de4f00 100%)",
                  boxShadow: "inset 0 1px 0 rgba(255,255,255,0.28), inset 0 -1px 0 rgba(0,0,0,0.18), 0 8px 32px rgba(255,96,0,0.35), 0 2px 8px rgba(255,96,0,0.20)",
                }}
              >
                <span className="pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-white/30 to-transparent" />
                <span className="relative z-10">Empezar prueba gratis</span>
                <ArrowRight className="relative z-10 h-4 w-4 transition-transform duration-200 group-hover:translate-x-1" />
              </Link>

              <p className="mt-4 text-center text-[11px] tracking-wide text-white/22">
                Sin tarjeta para probar
                {billing === "anual" ? " · Pago anual al activar" : " · Cancelá cuando quieras"}
              </p>
            </div>
          </div>
        </article>
      </motion.div>
    </div>
  );
}
