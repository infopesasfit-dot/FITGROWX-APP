import type { Metadata } from "next";
import { notFound } from "next/navigation";
import Link from "next/link";
import { ArrowLeft, ArrowRight, CheckCircle2 } from "lucide-react";
import { LandingHeader } from "@/components/landing-header";
import {
  vaultResources,
  getVaultCategory,
  getVaultResource,
  getResourcesByCategory,
} from "@/app/(dashboard)/dashboard/boveda/data";

type Props = { params: Promise<{ categoria: string; slug: string }> };

export async function generateStaticParams() {
  return vaultResources.map((r) => ({ categoria: r.category, slug: r.slug }));
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug, categoria } = await params;
  const res = getVaultResource(slug);
  if (!res) return {};
  const url = `https://fitgrowx.com/recursos/${categoria}/${slug}`;
  return {
    title: `${res.title} | FitGrowX`,
    description: res.description,
    alternates: { canonical: url },
    openGraph: {
      title: res.title,
      description: res.description,
      url,
      siteName: "FitGrowX",
      type: "article",
    },
  };
}

export default async function RecursoDetailPage({ params }: Props) {
  const { slug, categoria } = await params;
  const resource = getVaultResource(slug);
  if (!resource) notFound();

  const cat = getVaultCategory(categoria);
  const related = getResourcesByCategory(categoria).filter((r) => r.slug !== slug).slice(0, 3);

  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "Article",
    headline: resource.title,
    description: resource.description,
    author: { "@type": "Organization", name: "FitGrowX" },
    publisher: {
      "@type": "Organization",
      name: "FitGrowX",
      url: "https://fitgrowx.com",
      logo: { "@type": "ImageObject", url: "https://fitgrowx.com/logo.png" },
    },
    url: `https://fitgrowx.com/recursos/${categoria}/${slug}`,
    mainEntityOfPage: `https://fitgrowx.com/recursos/${categoria}/${slug}`,
  };

  return (
    <main className="min-h-screen bg-[#050505] text-white antialiased font-sans">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />
      <LandingHeader actionType="link" actionLabel="Prueba gratis" actionHref="/start" />

      {/* Header */}
      <section className="relative overflow-hidden px-5 pb-10 pt-28 sm:px-8 lg:px-12 lg:pt-32">
        <div
          className="pointer-events-none absolute inset-0"
          style={{
            background:
              "radial-gradient(circle at 16% 20%, rgba(59,130,246,0.14) 0%, transparent 34%), linear-gradient(180deg, rgba(7,11,23,0.94) 0%, rgba(5,5,5,1) 80%)",
          }}
        />
        <div className="relative mx-auto max-w-3xl">
          <nav className="mb-6 flex items-center gap-2 text-[0.78rem] text-white/35">
            <Link href="/recursos" className="hover:text-white/60 transition-colors">
              <ArrowLeft className="inline h-3.5 w-3.5 mr-1" />
              Recursos
            </Link>
            {cat && (
              <>
                <span>/</span>
                <Link
                  href={`/recursos/${categoria}`}
                  className="hover:text-white/60 transition-colors"
                >
                  {cat.title}
                </Link>
              </>
            )}
          </nav>

          <div className="mb-3 flex items-center gap-2">
            <span className="rounded-full bg-white/[0.06] px-2.5 py-1 text-[10px] text-white/40">
              {resource.format}
            </span>
            <span className="text-[10px] text-white/30">{resource.readTime}</span>
          </div>

          <h1 className="text-balance text-[2.2rem] font-semibold leading-[0.97] tracking-[-0.06em] text-white sm:text-[3rem]">
            {resource.title}
          </h1>

          <p className="mt-5 max-w-2xl text-[15px] leading-7 text-white/50">{resource.intro}</p>

          <div className="mt-6 rounded-xl border border-[#FF6A00]/20 bg-[#FF6A00]/[0.06] px-5 py-4">
            <p className="text-[0.82rem] leading-6 text-white/60">
              <span className="font-semibold text-[#FF9B57]">Objetivo:</span>{" "}
              {resource.objective}{" "}
              <span className="ml-2 font-semibold text-[#FF9B57]">Resultado esperado:</span>{" "}
              {resource.outcome}
            </p>
          </div>
        </div>
      </section>

      {/* Steps */}
      <section className="mx-auto max-w-3xl px-5 pb-10 sm:px-8 lg:px-12">
        <p className="mb-5 text-[11px] font-semibold uppercase tracking-[0.18em] text-white/30">
          Paso a paso
        </p>
        <div className="space-y-4">
          {resource.steps.map((step, i) => (
            <div
              key={step}
              className="flex gap-4 rounded-2xl border border-white/[0.07] bg-white/[0.03] p-5"
            >
              <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-[#FF6A00]/10 text-[0.86rem] font-bold text-[#FF9B57]">
                {i + 1}
              </div>
              <p className="mt-1 text-[0.88rem] leading-6 text-white/65">{step}</p>
            </div>
          ))}
        </div>
      </section>

      {/* Bullets */}
      <section className="mx-auto max-w-3xl px-5 pb-10 sm:px-8 lg:px-12">
        <p className="mb-5 text-[11px] font-semibold uppercase tracking-[0.18em] text-white/30">
          Notas rápidas
        </p>
        <div className="space-y-3">
          {resource.bullets.map((item) => (
            <div
              key={item}
              className="flex gap-3 rounded-2xl border border-white/[0.07] bg-white/[0.03] p-4"
            >
              <CheckCircle2 className="h-4 w-4 shrink-0 mt-0.5 text-[#FF9B57]" />
              <p className="text-[0.85rem] leading-6 text-white/60">{item}</p>
            </div>
          ))}
        </div>
      </section>

      {/* Related resources */}
      {related.length > 0 && (
        <section className="mx-auto max-w-3xl px-5 pb-10 sm:px-8 lg:px-12">
          <p className="mb-5 text-[11px] font-semibold uppercase tracking-[0.18em] text-white/30">
            Recursos relacionados
          </p>
          <div className="space-y-3">
            {related.map((r) => (
              <Link
                key={r.slug}
                href={`/recursos/${categoria}/${r.slug}`}
                className="group flex items-center justify-between rounded-2xl border border-white/[0.07] bg-white/[0.03] p-4 transition-all hover:border-white/[0.14] hover:bg-white/[0.06]"
              >
                <div>
                  <p className="text-[0.86rem] font-semibold text-white">{r.title}</p>
                  <p className="mt-0.5 text-[0.76rem] text-white/35">{r.format} · {r.readTime}</p>
                </div>
                <ArrowRight className="h-4 w-4 shrink-0 text-white/25 transition-colors group-hover:text-[#7CC2FF]" />
              </Link>
            ))}
          </div>
        </section>
      )}

      {/* CTA */}
      <section className="border-t border-white/[0.06] bg-white/[0.02] px-5 py-16 text-center sm:px-8">
        <h2 className="text-xl font-semibold tracking-[-0.03em] text-white sm:text-2xl">
          Gestioná tu gimnasio con FitGrowX
        </h2>
        <p className="mx-auto mt-3 max-w-md text-[14px] leading-6 text-white/40">
          WhatsApp automático, cobros, QR, app del alumno, clases y rutinas desde un solo lugar.
        </p>
        <Link
          href="/start"
          className="mt-6 inline-flex items-center gap-2 rounded-xl bg-[#FF6A00] px-7 py-3.5 text-[0.9rem] font-semibold text-white transition-opacity hover:opacity-90"
        >
          Empezar gratis <ArrowRight className="h-4 w-4" />
        </Link>
      </section>
    </main>
  );
}
