import Link from "next/link";
import { ArrowRight, HelpCircle } from "lucide-react";
import { LandingHeader } from "@/components/landing-header";
import { FAQ_ITEMS } from "@/lib/guide-content";

export const metadata = {
  title: "FAQ — FitGrowX",
  description: "Preguntas frecuentes sobre automatización por WhatsApp, panel del dueño, staff, alumnos, landing, prospectos y operación en FitGrowX.",
};

export default function FaqPage() {
  return (
    <main className="min-h-screen bg-[#050505] text-white antialiased font-sans">
      <LandingHeader actionType="link" actionLabel="Prueba gratis" actionHref="/start" />

      <section className="relative overflow-hidden px-6 pb-12 pt-28 lg:px-10 lg:pt-32">
        <div
          className="pointer-events-none absolute inset-0"
          style={{
            background:
              "radial-gradient(circle at 20% 24%, rgba(33,96,255,0.16) 0%, transparent 32%), radial-gradient(circle at 82% 14%, rgba(255,106,0,0.14) 0%, transparent 28%)",
          }}
        />

        <div className="relative mx-auto max-w-4xl text-center">
          <div className="mb-6 inline-flex items-center gap-2 rounded-full border border-[#60A5FA]/20 bg-[#60A5FA]/6 px-4 py-1.5">
            <HelpCircle className="h-4 w-4 text-[#7CC2FF]" />
            <span className="text-[11px] font-semibold uppercase tracking-[0.18em] text-[#7CC2FF]">FAQ FitGrowX</span>
          </div>
          <h1 className="text-balance text-4xl font-semibold tracking-[-0.06em] text-white sm:text-5xl lg:text-6xl">
            Preguntas y respuestas
            <span className="ml-2 block bg-gradient-to-r from-[#2C63FF] via-[#174BFF] to-[#FF6A00] bg-clip-text font-serif text-[0.84em] italic font-light text-transparent [text-shadow:0_0_26px_rgba(23,75,255,0.16)] md:inline">
              sin vueltas
            </span>
          </h1>
          <p className="mt-6 text-balance text-[15px] leading-8 text-white/55 sm:text-lg">
            Respuestas claras sobre cómo FitGrowX automatiza WhatsApp, organiza el trabajo del dueño y del staff, y mejora la experiencia del alumno dentro y fuera del gym.
          </p>
        </div>
      </section>

      <section className="mx-auto max-w-4xl px-6 pb-20 lg:px-10">
        <div className="space-y-4">
          {FAQ_ITEMS.map((item, index) => (
            <details
              key={item.question}
              className="group rounded-[1.6rem] border border-white/[0.08] bg-white/[0.03] px-6 py-5 shadow-[0_18px_40px_rgba(0,0,0,0.18)] backdrop-blur-xl open:bg-white/[0.05]"
            >
              <summary className="flex cursor-pointer list-none items-start gap-4 [&::-webkit-details-marker]:hidden">
                <span className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-full border border-[#60A5FA]/18 bg-[#60A5FA]/8 text-[12px] font-bold text-[#7CC2FF]">
                  {index + 1}
                </span>
                <span className="flex-1 text-left text-[1rem] font-semibold tracking-[-0.02em] text-white/90">
                  {item.question}
                </span>
              </summary>
              <p className="pl-12 pt-4 text-[15px] leading-8 text-white/62">{item.answer}</p>
            </details>
          ))}
        </div>

        <div className="mt-12 rounded-[2rem] border border-white/[0.08] bg-[linear-gradient(135deg,rgba(255,255,255,0.04),rgba(255,106,0,0.08))] px-6 py-8 sm:px-8">
          <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-[#FFB67A]">¿Querés profundizar?</p>
          <h2 className="mt-3 text-3xl font-semibold tracking-[-0.05em] text-white">
            La guía completa te muestra el orden correcto para implementarlo.
          </h2>
          <p className="mt-4 max-w-2xl text-[15px] leading-8 text-white/58">
            Si ya resolviste dudas puntuales, la guía paso a paso te ayuda a convertir FitGrowX en una rutina de operación real para tu gimnasio.
          </p>
          <div className="mt-6 flex flex-wrap gap-3">
            <Link
              href="/guia"
              className="inline-flex items-center gap-2 rounded-full bg-[#FF6A00] px-5 py-3 text-sm font-semibold text-white shadow-[0_10px_24px_rgba(255,106,0,0.22)] transition-opacity hover:opacity-90"
            >
              Ir a la guía
              <ArrowRight className="h-4 w-4" />
            </Link>
            <Link
              href="/start"
              className="inline-flex items-center gap-2 rounded-full border border-white/[0.10] bg-white/[0.04] px-5 py-3 text-sm font-semibold text-white/80 transition-colors hover:bg-white/[0.08]"
            >
              Empezar prueba gratis
            </Link>
          </div>
        </div>
      </section>
    </main>
  );
}
