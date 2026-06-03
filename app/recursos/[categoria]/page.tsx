import type { Metadata } from "next";
import { notFound } from "next/navigation";
import Link from "next/link";
import { ArrowLeft, ArrowRight } from "lucide-react";
import { LandingHeader } from "@/components/landing-header";
import {
  vaultCategories,
  getVaultCategory,
  getResourcesByCategory,
} from "@/app/(dashboard)/dashboard/boveda/data";

type Props = { params: Promise<{ categoria: string }> };

export async function generateStaticParams() {
  return vaultCategories.map((c) => ({ categoria: c.slug }));
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { categoria } = await params;
  const cat = getVaultCategory(categoria);
  if (!cat) return {};
  return {
    title: `${cat.title} — Recursos para gimnasios | FitGrowX`,
    description: cat.description,
    alternates: { canonical: `https://fitgrowx.com/recursos/${categoria}` },
    openGraph: {
      title: `${cat.title} | FitGrowX`,
      description: cat.description,
      url: `https://fitgrowx.com/recursos/${categoria}`,
      siteName: "FitGrowX",
      type: "website",
    },
  };
}

export default async function RecursosCategoriaPage({ params }: Props) {
  const { categoria } = await params;
  const cat = getVaultCategory(categoria);
  if (!cat) notFound();

  const resources = getResourcesByCategory(categoria);

  return (
    <main className="min-h-screen bg-[#050505] text-white antialiased font-sans">
      <LandingHeader actionType="link" actionLabel="Prueba gratis" actionHref="/start" />

      <section className="relative overflow-hidden px-5 pb-10 pt-28 sm:px-8 lg:px-12 lg:pt-32">
        <div
          className="pointer-events-none absolute inset-0"
          style={{
            background:
              "radial-gradient(circle at 16% 20%, rgba(59,130,246,0.14) 0%, transparent 34%), linear-gradient(180deg, rgba(7,11,23,0.94) 0%, rgba(5,5,5,1) 80%)",
          }}
        />
        <div className="relative mx-auto max-w-5xl">
          <Link
            href="/recursos"
            className="mb-6 inline-flex items-center gap-1.5 text-[0.8rem] font-medium text-white/40 transition-colors hover:text-white/70"
          >
            <ArrowLeft className="h-3.5 w-3.5" />
            Todos los recursos
          </Link>
          <span className="mb-3 block w-fit rounded-full bg-[#FF6A00]/10 px-2.5 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-[#FF9B57]">
            {cat.badge}
          </span>
          <h1 className="text-balance text-[2.4rem] font-semibold leading-[0.95] tracking-[-0.06em] text-white sm:text-[3.2rem]">
            {cat.title}
          </h1>
          <p className="mt-4 max-w-2xl text-[15px] leading-7 text-white/45">
            {cat.description}
          </p>
        </div>
      </section>

      <section className="mx-auto max-w-5xl px-5 pb-16 sm:px-8 lg:px-12">
        <div className="grid gap-4 sm:grid-cols-2">
          {resources.map((res) => (
            <Link
              key={res.slug}
              href={`/recursos/${categoria}/${res.slug}`}
              className="group rounded-2xl border border-white/[0.07] bg-white/[0.03] p-6 transition-all hover:border-white/[0.14] hover:bg-white/[0.06]"
            >
              <div className="mb-3 flex items-center gap-2">
                <span className="rounded-full bg-white/[0.06] px-2 py-0.5 text-[10px] text-white/40">
                  {res.format}
                </span>
                <span className="text-[10px] text-white/30">{res.readTime}</span>
              </div>
              <h2 className="text-[0.95rem] font-semibold leading-snug text-white">{res.title}</h2>
              <p className="mt-2 text-[0.8rem] leading-relaxed text-white/45">{res.description}</p>
              <div className="mt-4 flex flex-wrap gap-1.5">
                {res.tags.map((tag) => (
                  <span
                    key={tag}
                    className="rounded-full bg-white/[0.05] px-2 py-0.5 text-[10px] text-white/35"
                  >
                    {tag}
                  </span>
                ))}
              </div>
              <div className="mt-4 flex items-center gap-1 text-[0.78rem] font-semibold text-[#7CC2FF] opacity-0 transition-opacity group-hover:opacity-100">
                Leer recurso <ArrowRight className="h-3.5 w-3.5" />
              </div>
            </Link>
          ))}
        </div>

        {/* Cross-links to other categories */}
        <div className="mt-12 border-t border-white/[0.06] pt-10">
          <p className="mb-4 text-[11px] font-semibold uppercase tracking-[0.18em] text-white/30">
            Otras categorías
          </p>
          <div className="flex flex-wrap gap-3">
            {vaultCategories
              .filter((c) => c.slug !== categoria)
              .map((c) => (
                <Link
                  key={c.slug}
                  href={`/recursos/${c.slug}`}
                  className="rounded-full border border-white/[0.08] bg-white/[0.03] px-4 py-2 text-[0.8rem] font-medium text-white/50 transition-all hover:border-white/[0.16] hover:text-white/80"
                >
                  {c.title}
                </Link>
              ))}
          </div>
        </div>
      </section>

      <section className="border-t border-white/[0.06] bg-white/[0.02] px-5 py-14 text-center sm:px-8">
        <h2 className="text-xl font-semibold tracking-[-0.03em] text-white sm:text-2xl">
          Gestioná tu gimnasio con FitGrowX
        </h2>
        <p className="mx-auto mt-3 max-w-md text-[14px] leading-6 text-white/40">
          WhatsApp automático, cobros, QR, app del alumno, clases y rutinas.
        </p>
        <Link
          href="/start"
          className="mt-6 inline-flex items-center gap-2 rounded-xl bg-[#FF6A00] px-6 py-3 text-[0.86rem] font-semibold text-white transition-opacity hover:opacity-90"
        >
          Empezar gratis <ArrowRight className="h-4 w-4" />
        </Link>
      </section>
    </main>
  );
}
