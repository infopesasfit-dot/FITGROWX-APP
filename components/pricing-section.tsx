"use client";

import { useState } from "react";
import Link from "next/link";
import { motion, type Variants } from "framer-motion";
import { ArrowRight, CheckCircle2 } from "lucide-react";
import { type FitgrowxPlanDefinition } from "@/lib/fitgrowx-plans";

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

function PlanCard({
  plan,
  billing,
  delay = 0,
}: {
  plan: FitgrowxPlanDefinition;
  billing: "mensual" | "anual";
  delay?: number;
}) {
  const price = billing === "mensual" ? plan.priceMonthly : plan.priceAnnual;
  const isFeatured = plan.highlight;

  return (
    <motion.article
      className="relative overflow-hidden rounded-3xl p-7 sm:p-8 flex flex-col"
      initial={{ opacity: 0, y: 20 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, amount: 0.2 }}
      transition={{ duration: 0.75, ease: EASE, delay }}
      style={
        isFeatured
          ? {
              background:
                "linear-gradient(160deg, rgba(255,255,255,0.04) 0%, rgba(0,0,0,0.72) 60%, rgba(0,0,0,0.88) 100%)",
              border: "1px solid rgba(255,106,0,0.55)",
              boxShadow: [
                "0 0 0 1px rgba(255,106,0,0.12)",
                "0 2px 0 rgba(255,255,255,0.06) inset",
                "0 32px 80px rgba(0,0,0,0.80)",
                "0 8px 32px rgba(0,0,0,0.60)",
                "0 0 120px rgba(255,96,0,0.14)",
              ].join(", "),
              backdropFilter: "blur(28px) saturate(1.4)",
              WebkitBackdropFilter: "blur(28px) saturate(1.4)",
            }
          : {
              background:
                "linear-gradient(160deg, rgba(255,255,255,0.025) 0%, rgba(0,0,0,0.55) 100%)",
              border: "1px solid rgba(255,255,255,0.08)",
              boxShadow: "0 8px 32px rgba(0,0,0,0.50)",
              backdropFilter: "blur(20px) saturate(1.2)",
              WebkitBackdropFilter: "blur(20px) saturate(1.2)",
            }
      }
    >
      {/* Grain overlay */}
      <div
        className="absolute inset-0 pointer-events-none mix-blend-soft-light rounded-3xl"
        style={{ backgroundImage: GRAIN, backgroundSize: "180px 180px", opacity: 0.18 }}
      />
      {/* Top-edge highlight */}
      <div
        className="absolute inset-x-0 top-0 h-px pointer-events-none"
        style={{
          background: isFeatured
            ? "linear-gradient(90deg, transparent 0%, rgba(255,255,255,0.14) 40%, rgba(255,255,255,0.14) 60%, transparent 100%)"
            : "linear-gradient(90deg, transparent 0%, rgba(255,255,255,0.07) 50%, transparent 100%)",
        }}
      />

      <div className="relative z-10 flex flex-col flex-1">
        {/* Badge */}
        {plan.badge && (
          <div className="mb-3 self-start">
            <span
              className="rounded-full px-3 py-1 text-[10px] font-bold uppercase tracking-wide"
              style={{ background: "rgba(255,106,0,0.18)", color: "#FF8C3A" }}
            >
              {plan.badge}
            </span>
          </div>
        )}

        <p className="text-lg font-semibold text-white tracking-tight">{plan.name}</p>
        <p className="mt-1.5 text-sm font-light leading-relaxed text-white/50">{plan.description}</p>

        {/* ROI anchor — only on Pro */}
        {isFeatured && (
          <div
            className="mt-5 flex items-start gap-2.5 rounded-xl px-4 py-3"
            style={{ background: "rgba(255,106,0,0.07)", border: "1px solid rgba(255,106,0,0.18)" }}
          >
            <span className="mt-0.5 text-base leading-none">💡</span>
            <p className="text-[12px] font-light leading-relaxed text-white/55">
              Con retener{" "}
              <span className="font-semibold text-[#FF8C3A]">3 socios</span>
              {" "}que de otro modo se irían, ya se paga solo.
            </p>
          </div>
        )}

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

        {/* Student limit pill */}
        <div className="mt-3">
          <span
            className="text-[11px] font-medium"
            style={{ color: isFeatured ? "#FF8C3A" : "rgba(255,255,255,0.35)" }}
          >
            {plan.studentLimit}
          </span>
        </div>

        <div className="mt-5 h-px bg-white/[0.07]" />

        {/* Features */}
        <p className="mt-5 text-[11px] font-semibold uppercase tracking-[0.18em] text-white/32">Lo que resuelve</p>
        <ul className="mt-4 flex flex-col gap-3 flex-1">
          {plan.features.map((feature) => (
            <li key={feature} className="flex items-start gap-3">
              <CheckCircle2
                className="mt-0.5 h-4 w-4 shrink-0"
                style={{ color: isFeatured ? "#FF8C3A" : "rgba(255,255,255,0.35)" }}
              />
              <span className="text-sm font-light leading-relaxed text-white/62">{feature}</span>
            </li>
          ))}
        </ul>

        {/* CTA */}
        <Link
          href="/start"
          className="group relative mt-8 inline-flex w-full items-center justify-center gap-3 overflow-hidden rounded-2xl px-7 py-3.5 text-sm font-semibold text-white transition-all duration-300 hover:scale-[1.01] active:scale-[0.98]"
          style={
            isFeatured
              ? {
                  background: "linear-gradient(180deg, #ff7a1a 0%, #ff6000 58%, #de4f00 100%)",
                  boxShadow: "inset 0 1px 0 rgba(255,255,255,0.22), 0 8px 28px rgba(255,96,0,0.32)",
                }
              : {
                  background: "rgba(255,255,255,0.06)",
                  border: "1px solid rgba(255,255,255,0.12)",
                  boxShadow: "inset 0 1px 0 rgba(255,255,255,0.06)",
                }
          }
        >
          <span className="pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-white/25 to-transparent" />
          <span className="relative z-10">Empezar prueba gratis</span>
          <ArrowRight className="relative z-10 h-4 w-4 transition-transform duration-200 group-hover:translate-x-1" />
        </Link>

        <p className="mt-3 text-center text-[11px] tracking-wide text-white/22">
          Sin tarjeta para probar{billing === "anual" ? " · Pago anual al activar" : " · Cancelá cuando quieras"}
        </p>
      </div>
    </motion.article>
  );
}

export function PricingSection({ plans }: { plans: FitgrowxPlanDefinition[] }) {
  const [billing, setBilling] = useState<"mensual" | "anual">("mensual");

  if (!plans.length) return null;

  const savings = plans[plans.length - 1]?.savings ?? 0;

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
          Probás 30 días gratis, sin tarjeta. Después elegís cómo seguir.
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

      {/* Two-card grid */}
      <div className="mx-auto grid max-w-3xl grid-cols-1 gap-4 sm:grid-cols-2 sm:items-start">
        {plans.map((plan, i) => (
          <PlanCard key={plan.key} plan={plan} billing={billing} delay={i * 0.08} />
        ))}
      </div>
    </div>
  );
}
