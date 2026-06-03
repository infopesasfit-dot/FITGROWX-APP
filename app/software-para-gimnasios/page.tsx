import type { Metadata } from "next";
import Link from "next/link";
import { ArrowRight, CheckCircle2 } from "lucide-react";
import { LandingHeader } from "@/components/landing-header";

export const metadata: Metadata = {
  title: "Software para gimnasios en LATAM | FitGrowX",
  description:
    "FitGrowX es el software de gestión para gimnasios en LATAM que une alumnos, cobros, WhatsApp automático, check-in QR, app del alumno, clases y rutinas desde un solo lugar. Desde $35.000/mes.",
  alternates: { canonical: "https://fitgrowx.com/software-para-gimnasios" },
  openGraph: {
    title: "Software para gimnasios en LATAM | FitGrowX",
    description:
      "Gestión de alumnos, cobros automáticos, WhatsApp, QR, clases y rutinas para gimnasios en Argentina, México, Colombia y toda LATAM.",
    url: "https://fitgrowx.com/software-para-gimnasios",
    siteName: "FitGrowX",
    type: "website",
  },
};

const FEATURES = [
  {
    title: "WhatsApp automático",
    desc: "Recordatorios de vencimiento, seguimiento de ausentes, bienvenida a nuevos alumnos y recuperación de inactivos sin enviar un mensaje a mano.",
  },
  {
    title: "Cobros con MercadoPago",
    desc: "Links de pago automáticos por WhatsApp. Cuando el alumno paga, la membresía se renueva sola sin intervención del staff.",
  },
  {
    title: "Check-in con QR",
    desc: "Cada alumno tiene un QR personal en su app. El control de acceso funciona solo: molinete, puerta o registro manual desde el scanner.",
  },
  {
    title: "App del alumno",
    desc: "Panel personalizado con el logo del gimnasio. El alumno ve su rutina, reserva clases, registra pesos y consulta su historial de asistencia.",
  },
  {
    title: "Clases y reservas",
    desc: "Agenda de clases con cupos, reservas online y lista de espera. El alumno reserva desde su app; el staff ve la ocupación en tiempo real.",
  },
  {
    title: "Rutinas personalizadas",
    desc: "Creá y asigná rutinas por objetivo, nivel o plan. El alumno sigue el plan desde su app y el coach ve el progreso registrado.",
  },
];

const FAQ = [
  {
    q: "¿Cuánto cuesta un software para gimnasios en LATAM?",
    a: "FitGrowX arranca desde $35.000 ARS por mes e incluye gestión de alumnos, cobros automáticos, WhatsApp, QR, clases y la app del alumno. El precio no sube por cantidad de alumnos.",
  },
  {
    q: "¿FitGrowX funciona en México, Colombia y Chile?",
    a: "Sí. FitGrowX funciona en cualquier país de LATAM. La automatización por WhatsApp, los cobros y la app del alumno operan igual en México, Colombia, Chile, Uruguay y Argentina.",
  },
  {
    q: "¿Necesito saber programar para usar FitGrowX?",
    a: "No. FitGrowX está pensado para dueños de gimnasios, no para desarrolladores. Podés cargar alumnos, configurar automatizaciones y activar cobros en menos de una hora.",
  },
  {
    q: "¿Cómo funciona la automatización de WhatsApp?",
    a: "Conectás tu número de WhatsApp a FitGrowX y el sistema envía los mensajes automáticamente: vencimientos, ausentes, cumpleaños, bienvenidas y cobros. Vos definís cuándo y qué se envía.",
  },
  {
    q: "¿Puedo probar FitGrowX gratis?",
    a: "Sí. FitGrowX ofrece un período de prueba sin tarjeta de crédito. Podés explorar todas las funciones con tus propios alumnos antes de decidir.",
  },
  {
    q: "¿FitGrowX reemplaza a Excel?",
    a: "Sí. FitGrowX hace todo lo que hacés en Excel (alumnos, pagos, asistencias) pero también cobra solo, avisa vencimientos, controla acceso y le da una app a cada alumno. Excel no hace ninguna de esas cosas.",
  },
];

const jsonLd = {
  "@context": "https://schema.org",
  "@type": "FAQPage",
  mainEntity: FAQ.map(({ q, a }) => ({
    "@type": "Question",
    name: q,
    acceptedAnswer: { "@type": "Answer", text: a },
  })),
};

const softwareJsonLd = {
  "@context": "https://schema.org",
  "@type": "SoftwareApplication",
  name: "FitGrowX",
  applicationCategory: "BusinessApplication",
  operatingSystem: "Web",
  url: "https://fitgrowx.com",
  description:
    "Software de gestión para gimnasios en LATAM que centraliza alumnos, cobros, WhatsApp, QR, clases y la app del alumno.",
  offers: {
    "@type": "Offer",
    price: "35000",
    priceCurrency: "ARS",
    priceSpecification: { "@type": "UnitPriceSpecification", billingDuration: "P1M" },
  },
};

export default function SoftwareParaGimnasiosPage() {
  return (
    <main className="min-h-screen bg-[#050505] text-white antialiased font-sans">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(softwareJsonLd) }}
      />
      <LandingHeader actionType="link" actionLabel="Prueba gratis" actionHref="/start" />

      {/* Hero */}
      <section className="relative overflow-hidden px-5 pb-10 pt-28 sm:px-8 lg:px-12 lg:pt-36">
        <div
          className="pointer-events-none absolute inset-0"
          style={{
            background:
              "radial-gradient(circle at 14% 18%, rgba(59,130,246,0.2) 0%, transparent 32%), radial-gradient(circle at 84% 20%, rgba(255,106,0,0.12) 0%, transparent 28%), linear-gradient(180deg, rgba(7,11,23,0.96) 0%, rgba(5,5,5,1) 78%)",
          }}
        />
        <div className="relative mx-auto max-w-5xl text-center">
          <div className="mb-4 inline-flex items-center gap-2 rounded-full border border-[#60A5FA]/16 bg-white/[0.06] px-3 py-1.5 backdrop-blur-xl">
            <span className="text-[10px] font-semibold uppercase tracking-[0.2em] text-[#9CCEFF]">
              Software para gimnasios · LATAM
            </span>
          </div>
          <h1 className="text-balance text-[2.6rem] font-semibold leading-[0.94] tracking-[-0.075em] text-white sm:text-[3.5rem] lg:text-[5.2rem]">
            Un solo sistema para
            <br />
            <span className="bg-gradient-to-r from-[#2C63FF] via-[#174BFF] to-[#FF6A00] bg-clip-text font-serif text-[0.9em] italic font-light text-transparent [text-shadow:0_0_26px_rgba(23,75,255,0.16)]">
              gestionar tu gimnasio
            </span>
          </h1>
          <p className="mx-auto mt-6 max-w-2xl text-balance text-[15px] leading-7 text-white/50 sm:text-lg">
            FitGrowX centraliza alumnos, cobros, WhatsApp, QR, app del alumno, clases y rutinas.
            Sin planillas, sin perseguir pagos, sin mensajes manuales.
          </p>
          <div className="mt-8 flex flex-wrap items-center justify-center gap-4">
            <Link
              href="/start"
              className="inline-flex items-center gap-2 rounded-xl bg-[#FF6A00] px-7 py-3.5 text-[0.9rem] font-semibold text-white transition-opacity hover:opacity-90"
            >
              Empezar gratis <ArrowRight className="h-4 w-4" />
            </Link>
            <Link
              href="/guia"
              className="inline-flex items-center gap-2 rounded-xl border border-white/[0.1] bg-white/[0.04] px-7 py-3.5 text-[0.9rem] font-medium text-white/70 transition-all hover:border-white/[0.2] hover:text-white"
            >
              Ver cómo funciona
            </Link>
          </div>
          <p className="mt-4 text-[12px] text-white/30">
            Desde $35.000/mes · Sin tarjeta de crédito · Prueba gratis
          </p>
        </div>
      </section>

      {/* Features */}
      <section className="mx-auto max-w-6xl px-5 pb-16 sm:px-8 lg:px-12">
        <p className="mb-5 text-center text-[11px] font-semibold uppercase tracking-[0.18em] text-white/30">
          Funcionalidades principales
        </p>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {FEATURES.map((f) => (
            <div
              key={f.title}
              className="rounded-2xl border border-white/[0.07] bg-white/[0.03] p-6"
            >
              <h2 className="mb-2 text-[0.95rem] font-semibold text-white">{f.title}</h2>
              <p className="text-[0.8rem] leading-6 text-white/45">{f.desc}</p>
            </div>
          ))}
        </div>
      </section>

      {/* Para quién es */}
      <section className="border-t border-white/[0.05] bg-white/[0.02] px-5 py-14 sm:px-8 lg:px-12">
        <div className="mx-auto max-w-4xl">
          <p className="mb-5 text-[11px] font-semibold uppercase tracking-[0.18em] text-white/30">
            Para quién es FitGrowX
          </p>
          <div className="grid gap-3 sm:grid-cols-2">
            {[
              "Dueños de gimnasio que pasan horas persiguiendo pagos por WhatsApp",
              "Gimnasios que pierden alumnos porque no tienen seguimiento automático",
              "Espacios fitness con staff que anota asistencias en papel o Excel",
              "Boxes de CrossFit que necesitan gestión de clases y reservas con cupo",
              "Estudios de pilates y yoga con cobros mensuales y alta rotación",
              "Cualquier gimnasio de LATAM que quiera crecer sin crecer el caos",
            ].map((item) => (
              <div key={item} className="flex items-start gap-3">
                <CheckCircle2 className="h-4 w-4 shrink-0 mt-0.5 text-[#FF9B57]" />
                <p className="text-[0.85rem] leading-6 text-white/55">{item}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* FAQ */}
      <section className="mx-auto max-w-3xl px-5 py-16 sm:px-8 lg:px-12">
        <p className="mb-6 text-[11px] font-semibold uppercase tracking-[0.18em] text-white/30">
          Preguntas frecuentes
        </p>
        <div className="space-y-4">
          {FAQ.map(({ q, a }) => (
            <details
              key={q}
              className="group rounded-2xl border border-white/[0.07] bg-white/[0.03] px-6 py-5 open:bg-white/[0.05]"
            >
              <summary className="cursor-pointer list-none text-[0.9rem] font-semibold text-white">
                {q}
              </summary>
              <p className="mt-3 text-[0.84rem] leading-6 text-white/50">{a}</p>
            </details>
          ))}
        </div>
      </section>

      {/* Internal links */}
      <section className="border-t border-white/[0.05] bg-white/[0.02] px-5 py-10 sm:px-8">
        <div className="mx-auto flex max-w-3xl flex-wrap items-center justify-center gap-4">
          <Link
            href="/excel-vs-software-para-gimnasios"
            className="text-[0.82rem] text-white/40 underline underline-offset-2 hover:text-white/70"
          >
            Excel vs software para gimnasios
          </Link>
          <Link
            href="/automatizacion-whatsapp-gimnasios"
            className="text-[0.82rem] text-white/40 underline underline-offset-2 hover:text-white/70"
          >
            Automatización de WhatsApp para gimnasios
          </Link>
          <Link
            href="/guia"
            className="text-[0.82rem] text-white/40 underline underline-offset-2 hover:text-white/70"
          >
            Guía de configuración
          </Link>
          <Link
            href="/faq"
            className="text-[0.82rem] text-white/40 underline underline-offset-2 hover:text-white/70"
          >
            FAQ completo
          </Link>
        </div>
      </section>

      {/* CTA final */}
      <section className="border-t border-white/[0.06] px-5 py-16 text-center sm:px-8">
        <h2 className="text-2xl font-semibold tracking-[-0.04em] text-white sm:text-3xl">
          Empezá a gestionar tu gimnasio hoy
        </h2>
        <p className="mx-auto mt-4 max-w-lg text-[15px] leading-7 text-white/40">
          Sin contrato, sin tarjeta de crédito. Probá FitGrowX gratis y mirá qué cambia en tu
          operación.
        </p>
        <Link
          href="/start"
          className="mt-8 inline-flex items-center gap-2 rounded-xl bg-[#FF6A00] px-8 py-4 text-[0.95rem] font-semibold text-white transition-opacity hover:opacity-90"
        >
          Empezar gratis <ArrowRight className="h-4 w-4" />
        </Link>
      </section>
    </main>
  );
}
