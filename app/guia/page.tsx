import Link from "next/link";
import { ArrowRight, BookOpenText, CheckCircle2 } from "lucide-react";
import { LandingHeader } from "@/components/landing-header";
import { GUIDE_SECTIONS, FAQ_ITEMS } from "@/lib/guide-content";

export const metadata = {
  title: "Guía paso a paso — FitGrowX",
  description: "Descubrí cómo FitGrowX automatiza captación, retención, cobros, alumnos, staff, clases y landing desde un solo sistema para gimnasios.",
};

export default function GuiaPage() {
  return (
    <main className="min-h-screen bg-[#050505] text-white antialiased font-sans">
      <LandingHeader actionType="link" actionLabel="Prueba gratis" actionHref="/start" />

      <section className="relative overflow-hidden px-5 pb-8 pt-24 sm:px-6 lg:px-10 lg:pb-12 lg:pt-28">
        <div
          className="pointer-events-none absolute inset-0"
          style={{
            background:
              "radial-gradient(circle at 14% 18%, rgba(59,130,246,0.2) 0%, transparent 32%), radial-gradient(circle at 84% 20%, rgba(255,106,0,0.12) 0%, transparent 28%), linear-gradient(180deg, rgba(7,11,23,0.96) 0%, rgba(5,5,5,1) 78%)",
          }}
        />
        <div
          className="pointer-events-none absolute inset-0 opacity-[0.11]"
          style={{
            backgroundImage:
              "linear-gradient(rgba(255,255,255,0.04) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.04) 1px, transparent 1px)",
            backgroundSize: "46px 46px",
          }}
        />
        <div className="pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-[#7CC2FF]/30 to-transparent" />
        <div className="pointer-events-none absolute left-[12%] top-[18%] h-28 w-28 rounded-full border border-[#7CC2FF]/12 bg-[#3B82F6]/8 blur-3xl" />
        <div className="pointer-events-none absolute right-[10%] top-[26%] h-36 w-36 rounded-full border border-[#FF9B57]/10 bg-[#FF6A00]/8 blur-3xl" />
        <div className="pointer-events-none absolute inset-x-0 bottom-0 h-24 bg-gradient-to-b from-transparent to-[#050505]" />

        <div className="relative mx-auto max-w-5xl">
          <div className="relative flex flex-col items-center text-center">
            <div className="mb-4 inline-flex items-center gap-2 rounded-full border border-[#60A5FA]/16 bg-white/[0.06] px-3 py-1.5 shadow-[0_10px_30px_rgba(0,0,0,0.16)] backdrop-blur-xl">
              <BookOpenText className="h-3.5 w-3.5 text-[#7CC2FF]" />
              <span className="text-[10px] font-semibold uppercase tracking-[0.2em] text-[#9CCEFF]">
                Guía FitGrowX
              </span>
            </div>

            <h1 className="max-w-[16ch] text-balance text-[2.5rem] font-semibold leading-[0.94] tracking-[-0.075em] text-white sm:text-[3.4rem] lg:max-w-[14.5ch] lg:text-[4.55rem]">
              <span className="block">Cómo dejar FitGrowX</span>
              <span className="block">
                bien configurado
                <span className="ml-2 inline bg-gradient-to-r from-[#2C63FF] via-[#174BFF] to-[#FF6A00] bg-clip-text font-serif text-[0.78em] italic font-light text-transparent [text-shadow:0_0_26px_rgba(23,75,255,0.16)]">
                  paso a paso
                </span>
              </span>
            </h1>

            <p className="mt-3 max-w-[58rem] text-pretty text-[13.5px] leading-6 text-white/64 sm:text-[14px] sm:leading-7">
              FitGrowX automatiza por WhatsApp la captación y la retención, le da al dueño un panel
              completo del negocio, al staff una operación simple y al alumno una app propia para vivir
              mejor su experiencia dentro del gym.
            </p>

            <div className="mt-5 flex flex-wrap justify-center gap-3">
              <Link
                href="#que-es-fitgrowx"
                className="inline-flex items-center gap-2 rounded-full bg-white px-4 py-2.5 text-[13px] font-semibold text-[#0A0D16] transition-transform duration-200 hover:-translate-y-0.5"
              >
                Empezar guía
                <ArrowRight className="h-3.5 w-3.5" />
              </Link>
              <Link
                href="/faq"
                className="inline-flex items-center gap-2 rounded-full border border-white/[0.12] bg-white/[0.05] px-4 py-2.5 text-[13px] font-semibold text-white/82 transition-colors hover:bg-white/[0.09]"
              >
                Ver preguntas frecuentes
              </Link>
            </div>
          </div>
        </div>
      </section>

      <section className="mx-auto grid max-w-6xl gap-8 px-5 pb-16 sm:px-6 lg:grid-cols-[220px_minmax(0,1fr)] lg:px-10">
        <aside className="lg:sticky lg:top-24 lg:self-start">
          <div className="rounded-[1.35rem] border border-white/[0.08] bg-white/[0.035] p-4 shadow-[0_16px_34px_rgba(0,0,0,0.16)] backdrop-blur-xl">
            <p className="mb-3 text-[10px] font-bold uppercase tracking-[0.24em] text-white/28">Contenido</p>
            <nav className="space-y-1.5">
              {GUIDE_SECTIONS.map((section, index) => (
                <a
                  key={section.id}
                  href={`#${section.id}`}
                  className="group flex items-start gap-2.5 rounded-2xl px-3 py-2 transition-colors duration-200 hover:bg-white/[0.055]"
                >
                  <span className="mt-0.5 text-[11px] font-semibold text-[#7CC2FF]">
                    {String(index + 1).padStart(2, "0")}
                  </span>
                  <span className="text-[12.5px] leading-5 text-white/65 group-hover:text-white/92">
                    {section.title}
                  </span>
                </a>
              ))}
              <a
                href="#faq"
                className="group flex items-start gap-3 rounded-2xl px-3 py-2.5 transition-colors duration-200 hover:bg-white/[0.055]"
              >
                <span className="mt-0.5 text-[11px] font-semibold text-[#FF9B57]">FAQ</span>
                <span className="text-[12.5px] leading-5 text-white/65 group-hover:text-white/92">
                  Preguntas frecuentes
                </span>
              </a>
            </nav>
          </div>
        </aside>

        <div className="space-y-5">
          {GUIDE_SECTIONS.map((section, index) => (
            <section
              key={section.id}
              id={section.id}
              className="scroll-mt-24 rounded-[1.7rem] border border-white/[0.08] bg-white/[0.03] p-5 shadow-[0_18px_42px_rgba(0,0,0,0.16)] backdrop-blur-xl sm:p-6"
            >
              <div className="mb-3 flex items-start gap-3">
                <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-2xl border border-[#3B82F6]/16 bg-[#3B82F6]/10 text-[11px] font-bold text-[#9CCEFF]">
                  {index + 1}
                </div>
                <div>
                  <h2 className="text-[1.42rem] font-semibold tracking-[-0.05em] text-white sm:text-[1.72rem]">
                    {section.title}
                  </h2>
                  <p className="mt-1.5 max-w-2xl text-[13.5px] leading-6 text-white/62 sm:text-[14px] sm:leading-7">
                    {section.intro}
                  </p>
                </div>
              </div>

              <div className="space-y-2">
                {section.bullets.map((bullet) => (
                  <div key={bullet} className="flex items-start gap-2.5">
                    <CheckCircle2 className="mt-0.5 h-3.5 w-3.5 shrink-0 text-[#7CC2FF]" />
                    <p className="max-w-3xl text-[13px] leading-6 text-white/74">{bullet}</p>
                  </div>
                ))}
              </div>

              {section.tip && (
                <div className="mt-3 rounded-[1.15rem] border border-[#60A5FA]/14 bg-[#0E1B34]/56 px-4 py-3">
                  <p className="text-[13px] leading-6 text-white/68">{section.tip}</p>
                </div>
              )}
            </section>
          ))}

          <section
            id="faq"
            className="scroll-mt-24 rounded-[1.7rem] border border-white/[0.08] bg-white/[0.03] p-5 shadow-[0_18px_42px_rgba(0,0,0,0.16)] backdrop-blur-xl sm:p-6"
          >
            <h2 className="text-[1.42rem] font-semibold tracking-[-0.05em] text-white sm:text-[1.72rem]">
              Preguntas frecuentes
            </h2>
            <p className="mt-1.5 max-w-3xl text-[13.5px] leading-6 text-white/60 sm:text-[14px] sm:leading-7">
              Respuestas rápidas para las dudas más comunes cuando querés dejar el sistema bien armado desde el día uno.
            </p>

            <div className="mt-5 space-y-2">
              {FAQ_ITEMS.slice(0, 4).map((item) => (
                <details
                  key={item.question}
                  className="group rounded-[1.05rem] border border-white/[0.06] bg-black/14 px-4 py-3 open:bg-white/[0.05]"
                >
                  <summary className="cursor-pointer list-none text-[13px] font-semibold text-white/88 [&::-webkit-details-marker]:hidden">
                    {item.question}
                  </summary>
                  <p className="mt-2.5 text-[13px] leading-6 text-white/62">{item.answer}</p>
                </details>
              ))}
            </div>
            <div className="mt-4">
              <Link href="/faq" className="text-[12.5px] font-semibold text-[#9CCEFF] transition-opacity hover:opacity-80">
                Ver todas las preguntas frecuentes
              </Link>
            </div>
          </section>

          <section className="rounded-[1.8rem] border border-[#60A5FA]/12 bg-[linear-gradient(135deg,rgba(59,130,246,0.14),rgba(10,14,24,0.88))] px-5 py-6 sm:px-6">
            <h2 className="max-w-2xl text-[1.85rem] font-semibold tracking-[-0.05em] text-white">
              Entender el orden ya te ahorra la mitad del caos.
            </h2>
            <p className="mt-2 max-w-2xl text-[13.5px] leading-6 text-white/62 sm:text-[14px] sm:leading-7">
              Empezá por la base del negocio, seguí con membresías y cobro, y después escalá landing,
              automatizaciones y captación con una operación mucho más prolija.
            </p>
            <div className="mt-4 flex flex-wrap gap-3">
              <Link
                href="/start"
                className="inline-flex items-center gap-2 rounded-full bg-white px-4 py-2.5 text-[13px] font-semibold text-[#0A0D16] transition-transform duration-200 hover:-translate-y-0.5"
              >
                Empezar prueba gratis
                <ArrowRight className="h-3.5 w-3.5" />
              </Link>
              <Link
                href="/faq"
                className="inline-flex items-center gap-2 rounded-full border border-white/[0.10] bg-white/[0.05] px-4 py-2.5 text-[13px] font-semibold text-white/82 transition-colors hover:bg-white/[0.08]"
              >
                Ver FAQ completa
              </Link>
            </div>
          </section>
        </div>
      </section>
    </main>
  );
}
