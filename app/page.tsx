import Image from "next/image";
import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { BentoBackground } from "@/components/bento-background";
import { HeroSection } from "@/components/hero-section";
import { BenefitsSection } from "@/components/benefits-section";
import { DemoSection } from "@/components/demo-section";
import { PricingSection } from "@/components/pricing-section";

const GESTION_MP_LINK    = process.env.NEXT_PUBLIC_FITGROWX_GESTION_MP_LINK    ?? "#";
const CRECIMIENTO_MP_LINK = process.env.NEXT_PUBLIC_FITGROWX_CRECIMIENTO_MP_LINK ?? "#";
const FULLMARCA_MP_LINK   = process.env.NEXT_PUBLIC_FITGROWX_FULLMARCA_MP_LINK   ?? "#";

const plans = [
  {
    name: "Plan Gestión",
    price: "$49",
    period: "USD / mes",
    label: "Arrancá sin caos",
    paymentLink: GESTION_MP_LINK,
    description: "Dejá atrás las planillas y el \"¿quién me debe?\". Membresías, pagos, asistencia y WhatsApp en un solo lugar. Tu operación, ordenada de una vez.",
    features: [
      "Alumnos ilimitados",
      "Membresías con vencimiento automático",
      "Registro y validación de pagos",
      "Escáner QR de asistencia",
      "Integración WhatsApp",
      "Egresos y métricas financieras",
    ],
  },
  {
    name: "Plan Crecimiento",
    price: "$65",
    period: "USD / mes",
    label: "Más elegido",
    featured: true,
    paymentLink: CRECIMIENTO_MP_LINK,
    description: "Tu gym crece solo mientras vos entrenás. Captá prospectos 24/7 con tu landing propia, convertílos con WhatsApp automatizado y medí cada resultado.",
    features: [
      "Todo lo del Plan Gestión",
      "Landing de captación propia",
      "Gestión de prospectos e interesados",
      "Campañas de WhatsApp automáticas",
      "Publicidad y métricas de conversión",
    ],
  },
  {
    name: "Plan Full Marca",
    price: "$79",
    period: "USD / mes",
    label: "15 días gratis",
    paymentLink: FULLMARCA_MP_LINK,
    description: "Tu gimnasio, tu identidad. Ni rastro de FitGrowX. Tu logo, tu nombre y tus colores en toda la plataforma. Tus alumnos ven TU marca desde el primer segundo.",
    features: [
      "Todo lo del Plan Crecimiento",
      "Logo y nombre propio en toda la UI",
      "Panel del alumno 100% con tu marca",
      "Sin ninguna mención a FitGrowX",
      "Dominio personalizado (próximamente)",
    ],
  },
];

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

      {/* HEADER ORIGINAL */}
      <header className="sticky top-0 z-50 border-b border-white/[0.04] bg-[#050505]/40 backdrop-blur-xl">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-6 py-3 lg:px-10">
          <Link href="/" className="flex items-center gap-3">
            <Image src="/images/logo-fitgrowx.png" alt="FitGrowX" width={150} height={45} className="h-8 w-auto opacity-90" priority />
          </Link>
          <nav className="hidden items-center gap-7 text-[13px] font-normal tracking-[-0.01em] text-white/45 md:flex">
            <a href="#beneficios" className="transition-colors duration-200 hover:text-white/85">Beneficios</a>
            <a href="#demo" className="transition-colors duration-200 hover:text-white/85">Demo</a>
            <a href="#planes" className="transition-colors duration-200 hover:text-white/85">Planes</a>
          </nav>
          <a href="/start" className="inline-flex items-center gap-2 rounded-full border border-white/[0.09] bg-white/[0.03] px-5 py-2 text-[13px] font-semibold tracking-[-0.01em] text-white/80 transition-all duration-200 hover:bg-white/[0.06] hover:text-white/95">
            Prueba gratis <ArrowRight className="h-3.5 w-3.5" />
          </a>
        </div>
      </header>

      <div className="relative z-10">
        <HeroSection />

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

        <footer className="mx-auto max-w-7xl px-6 py-16 lg:px-10 border-t border-white/[0.03]">
          <div className="flex flex-col items-center justify-between gap-6 sm:flex-row text-center text-[11px] font-light text-white/20 uppercase tracking-[0.18em]">
            <Image src="/images/logo-fitgrowx.png" alt="FitGrowX" width={100} height={30} className="opacity-20 grayscale" />
            <p>© {new Date().getFullYear()} FitGrowX. Todos los derechos reservados.</p>
          </div>
        </footer>
      </div>
    </main>
  );
}