import type { Metadata } from "next";
import Link from "next/link";
import { ArrowRight, BookOpen } from "lucide-react";
import { LandingHeader } from "@/components/landing-header";
import { vaultCategories, vaultResources } from "@/app/(dashboard)/dashboard/boveda/data";

export const metadata: Metadata = {
  title: "Recursos para gimnasios | Guías, scripts y playbooks — FitGrowX",
  description:
    "Biblioteca gratuita de recursos para dueños de gimnasios en LATAM: scripts de ventas, checklists operativos, playbooks de retención y tutoriales de FitGrowX.",
  alternates: { canonical: "https://fitgrowx.com/recursos" },
  openGraph: {
    title: "Recursos para gimnasios | FitGrowX",
    description:
      "Scripts, playbooks, checklists y guías para vender más, retener alumnos y ordenar la operación de tu gimnasio.",
    url: "https://fitgrowx.com/recursos",
    siteName: "FitGrowX",
    type: "website",
  },
};

export default function RecursosPage() {
  const featured = vaultResources.slice(0, 6);

  return (
    <main className="min-h-screen bg-[#050505] text-white antialiased font-sans">
      <LandingHeader actionType="link" actionLabel="Prueba gratis" actionHref="/start" />

      {/* Hero */}
      <section className="relative overflow-hidden px-5 pb-10 pt-28 sm:px-8 lg:px-12 lg:pt-32">
        <div
          className="pointer-events-none absolute inset-0"
          style={{
            background:
              "radial-gradient(circle at 16% 20%, rgba(59,130,246,0.18) 0%, transparent 34%), radial-gradient(circle at 82% 18%, rgba(255,106,0,0.12) 0%, transparent 30%), linear-gradient(180deg, rgba(7,11,23,0.94) 0%, rgba(5,5,5,1) 80%)",
          }}
        />
        <div className="relative mx-auto max-w-5xl text-center">
          <div className="mb-4 inline-flex items-center gap-2 rounded-full border border-[#60A5FA]/16 bg-white/[0.06] px-3 py-1.5 backdrop-blur-xl">
            <BookOpen className="h-3.5 w-3.5 text-[#7CC2FF]" />
            <span className="text-[10px] font-semibold uppercase tracking-[0.2em] text-[#9CCEFF]">
              Biblioteca gratuita
            </span>
          </div>
          <h1 className="text-balance text-[2.6rem] font-semibold leading-[0.95] tracking-[-0.07em] text-white sm:text-[3.5rem] lg:text-[5rem]">
            Recursos para
            <span className="ml-2 bg-gradient-to-r from-[#2C63FF] via-[#174BFF] to-[#FF6A00] bg-clip-text font-serif text-[0.88em] italic font-light text-transparent [text-shadow:0_0_26px_rgba(23,75,255,0.16)]">
              gimnasios
            </span>
          </h1>
          <p className="mx-auto mt-5 max-w-2xl text-balance text-[15px] leading-7 text-white/50 sm:text-lg">
            Scripts de ventas, checklists operativos, playbooks de retención y tutoriales de
            FitGrowX. Todo gratis, todo práctico.
          </p>
        </div>
      </section>

      {/* Categories */}
      <section className="mx-auto max-w-6xl px-5 pb-8 sm:px-8 lg:px-12">
        <p className="mb-5 text-[11px] font-semibold uppercase tracking-[0.18em] text-white/30">
          Categorías
        </p>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {vaultCategories.map((cat) => (
            <Link
              key={cat.slug}
              href={`/recursos/${cat.slug}`}
              className="group rounded-2xl border border-white/[0.07] bg-white/[0.03] p-5 transition-all hover:border-white/[0.14] hover:bg-white/[0.06]"
            >
              <span className="mb-1 inline-block rounded-full bg-[#FF6A00]/10 px-2.5 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-[#FF9B57]">
                {cat.badge}
              </span>
              <h2 className="mt-2 text-[0.95rem] font-semibold leading-snug text-white">
                {cat.title}
              </h2>
              <p className="mt-1.5 text-[0.78rem] leading-relaxed text-white/45">
                {cat.description}
              </p>
              <div className="mt-4 flex items-center gap-1 text-[0.78rem] font-semibold text-[#7CC2FF] opacity-0 transition-opacity group-hover:opacity-100">
                Ver recursos <ArrowRight className="h-3.5 w-3.5" />
              </div>
            </Link>
          ))}
        </div>
      </section>

      {/* Featured resources */}
      <section className="mx-auto max-w-6xl px-5 pb-16 sm:px-8 lg:px-12">
        <p className="mb-5 text-[11px] font-semibold uppercase tracking-[0.18em] text-white/30">
          Recursos destacados
        </p>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {featured.map((res) => {
            const cat = vaultCategories.find((c) => c.slug === res.category);
            return (
              <Link
                key={res.slug}
                href={`/recursos/${res.category}/${res.slug}`}
                className="group rounded-2xl border border-white/[0.07] bg-white/[0.03] p-5 transition-all hover:border-white/[0.14] hover:bg-white/[0.06]"
              >
                <div className="mb-3 flex items-center gap-2">
                  <span className="rounded-full bg-white/[0.06] px-2 py-0.5 text-[10px] text-white/40">
                    {res.format}
                  </span>
                  <span className="text-[10px] text-white/30">{res.readTime}</span>
                </div>
                <h3 className="text-[0.9rem] font-semibold leading-snug text-white">
                  {res.title}
                </h3>
                <p className="mt-1.5 text-[0.78rem] leading-relaxed text-white/45 line-clamp-2">
                  {res.description}
                </p>
                {cat && (
                  <p className="mt-3 text-[0.72rem] text-white/30">{cat.title}</p>
                )}
                <div className="mt-3 flex items-center gap-1 text-[0.78rem] font-semibold text-[#7CC2FF] opacity-0 transition-opacity group-hover:opacity-100">
                  Leer recurso <ArrowRight className="h-3.5 w-3.5" />
                </div>
              </Link>
            );
          })}
        </div>
      </section>

      {/* CTA */}
      <section className="border-t border-white/[0.06] bg-white/[0.02] px-5 py-16 text-center sm:px-8">
        <p className="mb-2 text-[11px] font-semibold uppercase tracking-[0.18em] text-white/30">
          FitGrowX
        </p>
        <h2 className="mx-auto max-w-xl text-balance text-2xl font-semibold tracking-[-0.04em] text-white sm:text-3xl">
          Gestioná tu gimnasio con el sistema que une todo
        </h2>
        <p className="mx-auto mt-4 max-w-lg text-[15px] leading-7 text-white/45">
          WhatsApp automático, cobros, QR, app del alumno, clases y rutinas desde un solo lugar.
        </p>
        <Link
          href="/start"
          className="mt-8 inline-flex items-center gap-2 rounded-xl bg-[#FF6A00] px-7 py-3.5 text-[0.9rem] font-semibold text-white transition-opacity hover:opacity-90"
        >
          Empezar gratis <ArrowRight className="h-4 w-4" />
        </Link>
      </section>
    </main>
  );
}
