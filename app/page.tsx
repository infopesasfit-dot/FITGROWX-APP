import Image from "next/image";
import Link from "next/link";
import { BentoBackground } from "@/components/bento-background";
import { HeroSection } from "@/components/hero-section";
import { BenefitsSection } from "@/components/benefits-section";
import { DemoSection } from "@/components/demo-section";
import { PricingSection } from "@/components/pricing-section";
import { LandingHeader } from "@/components/landing-header";
import { LogosSection } from "@/components/logos-section";
import { FITGROWX_PLANS, formatArs } from "@/lib/fitgrowx-plans";
import { LandingWhatsApp } from "@/components/landing-whatsapp";
import { CookieBanner } from "@/components/cookie-banner";

const plans = FITGROWX_PLANS.map((plan) => ({
  name: plan.name,
  price: `$${formatArs(plan.priceMonthly)}`,
  period: "ARS / mes",
  badge: plan.badge,
  featured: plan.highlight,
  studentLimit: plan.studentLimit,
  description: plan.description,
  features: plan.features,
}));

export default function Home() {
  return (
    <main className="relative isolate min-h-screen font-sans text-white antialiased bg-[#050505]">
      {/* CAPA DE TEXTURA (GRAIN) GLOBAL */}
      <div className="fixed inset-0 z-[99] pointer-events-none opacity-[0.035] mix-blend-overlay">
        <svg className="h-full w-full">
          <filter id="noise">
            <feTurbulence type="fractalNoise" baseFrequency="0.8" numOctaves="4" stitchTiles="stitch" />
          </filter>
          <rect width="100%" height="100%" filter="url(#noise)" />
        </svg>
      </div>

      <BentoBackground />

      <LandingHeader actionType="link" actionLabel="Prueba gratis" actionHref="/start" />

      <div className="relative z-10">
        <HeroSection />

        {/* SECCIÓN LOGOS / SOCIAL PROOF */}
        <LogosSection />

        {/* SECCIÓN BENEFICIOS */}
        <div id="beneficios" className="relative z-10 scroll-mt-24 overflow-hidden">
          {/* Mancha Azul Flotante */}
          <div
            className="pointer-events-none absolute top-[20%] -left-[10%] h-[700px] w-[130%] opacity-50 mix-blend-screen -z-10"
            style={{
              background: "radial-gradient(ellipse at 15% 45%, rgba(30,80,240,0.22) 0%, rgba(10,40,180,0.08) 35%, transparent 60%)",
              filter: "blur(110px)",
              transform: "rotate(-5deg)",
            }}
          />
          <BenefitsSection />
        </div>

        {/* SECCIÓN DEMO */}
        <div className="relative z-20 pt-12 pb-8 lg:pt-24 lg:pb-16">
          {/* Luz naranja focal */}
          <div
            className="pointer-events-none absolute top-[10%] left-1/2 -translate-x-1/2 h-[500px] w-[600px] opacity-[0.13] -z-10"
            style={{
              background: "radial-gradient(circle at center, #FF6A00 0%, transparent 70%)",
              filter: "blur(100px)",
            }}
          />
          <DemoSection />
        </div>

        {/* SECCIÓN PLANES (MANTENIDA) */}
        <section id="planes" className="scroll-mt-24 relative overflow-hidden py-20 lg:py-28">
          <div className="absolute inset-0 -z-10 overflow-hidden">
            <div 
              className="absolute top-[20%] -left-[10%] h-[700px] w-[700px] rounded-full opacity-[0.06]"
              style={{
                background: "radial-gradient(circle, #FF6A00 0%, transparent 70%)",
                filter: "blur(120px)",
              }}
            />
          </div>

          <PricingSection plans={plans} />
        </section>

        <LandingWhatsApp />

        <CookieBanner />

        <footer className="mx-auto max-w-7xl px-6 py-12 lg:px-10 border-t border-white/[0.03]">
          <div className="flex flex-col items-center gap-6 sm:flex-row sm:justify-between">
            <Image src="/images/logo-fondo-oscuro.png" alt="FitGrowX" width={500} height={150} className="h-8 w-auto object-contain opacity-30" unoptimized />
            <div className="flex flex-wrap items-center justify-center gap-x-5 gap-y-2 text-[11px] font-light text-white/22 uppercase tracking-[0.16em]">
              <Link href="/terminos" className="hover:text-white/50 transition-colors">Términos y Condiciones</Link>
              <span className="text-white/10">·</span>
              <Link href="/privacidad" className="hover:text-white/50 transition-colors">Política de Privacidad</Link>
            </div>
            <p className="text-[11px] font-light text-white/20 uppercase tracking-[0.16em]">
              © {new Date().getFullYear()} FitGrowX
            </p>
          </div>
        </footer>
      </div>
    </main>
  );
}
