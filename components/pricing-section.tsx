"use client";

import { useState } from "react";
import Link from "next/link";
import { motion, type Variants } from "framer-motion";
import { ArrowRight, CheckCircle2 } from "lucide-react";

const EASE: [number, number, number, number] = [0.16, 1, 0.3, 1];

const GRAIN =
  "url(\"data:image/svg+xml,%3Csvg viewBox='0 0 256 256' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.80' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)'/%3E%3C/svg%3E\")";

const headVariant: Variants = {
  hidden: { opacity: 0, y: 28 },
  visible: { opacity: 1, y: 0, transition: { duration: 0.8, ease: EASE } },
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
        initial="hidden"
        whileInView="visible"
        viewport={{ once: true, amount: 0.4 }}
      >
        <h2 className="text-[10px] font-semibold uppercase tracking-[0.25em] text-[#FF8C3A] mb-4">Membresía</h2>
        <p className="text-3xl sm:text-4xl lg:text-5xl font-extralight tracking-[-0.05em] text-white leading-[1.08]">
          Una sola membresía para que{" "}
          <span className="italic font-normal text-[#FF8C3A]">todo el gym</span> funcione mejor.
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

      {/* Card + mirror reflection wrapper */}
      <motion.div
        className="mx-auto max-w-md"
        initial={{ opacity: 0, scale: 0.95 }}
        whileInView={{ opacity: 1, scale: 1 }}
        viewport={{ once: true, amount: 0.25 }}
        transition={{ duration: 0.85, ease: EASE, delay: 0.1 }}
      >
        {/* The actual card */}
        <article
          className="relative overflow-hidden rounded-3xl p-7 sm:p-8"
          style={{
            background: "linear-gradient(160deg, rgba(28,28,38,0.92) 0%, rgba(14,14,20,0.96) 100%)",
            border: "1px solid rgba(255,106,0,0.55)",
            boxShadow: [
              "0 0 0 1px rgba(255,106,0,0.12)",
              "0 2px 0 rgba(255,255,255,0.04) inset",
              "0 32px 80px rgba(0,0,0,0.70)",
              "0 8px 32px rgba(0,0,0,0.50)",
              "0 0 120px rgba(255,96,0,0.14)",
            ].join(", "),
            backdropFilter: "blur(20px)",
          }}
        >
          {/* Grain overlay — mirror/glass texture */}
          <div
            className="absolute inset-0 pointer-events-none mix-blend-soft-light rounded-3xl"
            style={{ backgroundImage: GRAIN, backgroundSize: "180px 180px", opacity: 0.18 }}
          />
          {/* Subtle top-edge highlight (mirror sheen) */}
          <div
            className="absolute inset-x-0 top-0 h-px pointer-events-none"
            style={{ background: "linear-gradient(90deg, transparent 0%, rgba(255,255,255,0.14) 40%, rgba(255,255,255,0.14) 60%, transparent 100%)" }}
          />

          <div className="relative z-10">
            <p className="text-lg font-semibold text-white tracking-tight">FitGrowX</p>
            <p className="mt-2 text-sm font-light leading-relaxed text-white/50">{plan.description}</p>

            {/* Price */}
            <div className="mt-6 flex items-center gap-3">
              <span className="text-5xl font-extralight tracking-[-0.06em] text-white">${fmt(price)}</span>
              <div className="flex flex-col gap-1.5">
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
            <p className="mt-6 text-[11px] font-semibold uppercase tracking-[0.18em] text-white/32">Qué incluye</p>
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
                boxShadow: "inset 0 1px 0 rgba(255,255,255,0.22), 0 8px 28px rgba(255,96,0,0.32)",
              }}
            >
              <span className="pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-white/25 to-transparent" />
              <span className="relative z-10">Empezar prueba gratis</span>
              <ArrowRight className="relative z-10 h-4 w-4 transition-transform duration-200 group-hover:translate-x-1" />
            </Link>

            <p className="mt-3 text-center text-[11px] tracking-wide text-white/22">
              Sin tarjeta para probar{billing === "anual" ? " · Pago anual al activar" : " · Cancelá cuando quieras"}
            </p>
          </div>
        </article>

        {/* Mirror reflection */}
        <div
          aria-hidden
          className="relative overflow-hidden rounded-3xl p-7 sm:p-8 pointer-events-none select-none"
          style={{
            transform: "scaleY(-1)",
            marginTop: 2,
            background: "linear-gradient(160deg, rgba(28,28,38,0.92) 0%, rgba(14,14,20,0.96) 100%)",
            border: "1px solid rgba(255,106,0,0.55)",
            maskImage: "linear-gradient(to bottom, rgba(0,0,0,0.28) 0%, transparent 55%)",
            WebkitMaskImage: "linear-gradient(to bottom, rgba(0,0,0,0.28) 0%, transparent 55%)",
            height: 90,
          }}
        >
          {/* Grain on reflection */}
          <div
            className="absolute inset-0 mix-blend-soft-light"
            style={{ backgroundImage: GRAIN, backgroundSize: "180px 180px", opacity: 0.22 }}
          />
          <div
            className="absolute inset-x-0 top-0 h-px"
            style={{ background: "linear-gradient(90deg, transparent 0%, rgba(255,255,255,0.10) 40%, rgba(255,255,255,0.10) 60%, transparent 100%)" }}
          />
        </div>
      </motion.div>
    </div>
  );
}
