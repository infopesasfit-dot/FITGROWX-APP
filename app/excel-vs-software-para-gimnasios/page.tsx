import type { Metadata } from "next";
import Link from "next/link";
import { ArrowRight, X, CheckCircle2 } from "lucide-react";
import { LandingHeader } from "@/components/landing-header";

export const metadata: Metadata = {
  title: "Excel vs software para gimnasios: cuándo conviene cambiar | FitGrowX",
  description:
    "Comparativa real entre Excel y un software específico para gimnasios. Los 5 problemas de gestionar un gym con planillas y cuándo conviene dar el salto.",
  alternates: { canonical: "https://fitgrowx.com/excel-vs-software-para-gimnasios" },
  openGraph: {
    title: "Excel vs software para gimnasios | FitGrowX",
    description:
      "Los 5 problemas de gestionar un gimnasio con Excel y por qué un software específico cambia la operación.",
    url: "https://fitgrowx.com/excel-vs-software-para-gimnasios",
    siteName: "FitGrowX",
    type: "article",
  },
};

const EXCEL_PROBLEMS = [
  {
    title: "No cobra solo",
    desc: "Con Excel tenés que recordar quién debe, avisar por WhatsApp a mano, esperar transferencia y anotar el pago. Con FitGrowX el sistema avisa, genera el link y registra el pago automáticamente.",
  },
  {
    title: "No controla el acceso",
    desc: "El Excel no sabe si el alumno con membresía vencida entró o no. Con un software específico, el QR del alumno valida en tiempo real y deniega el acceso si la membresía está vencida.",
  },
  {
    title: "No avisa cuando alguien deja de venir",
    desc: "En Excel no hay alertas de ausencia. En FitGrowX, si un alumno no viene 7 días seguidos, el sistema lo detecta y le manda un mensaje automático antes de que cancele.",
  },
  {
    title: "No escala sin desorden",
    desc: "Con 20 alumnos el Excel es manejable. Con 100 se convierte en un caos de hojas, errores y actualizaciones manuales. Un software crece sin agregar trabajo.",
  },
  {
    title: "No da datos útiles",
    desc: "Excel muestra lo que cargaste, no lo que pasó. Un software de gimnasio te dice tasa de retención, ocupación por clase, alumnos en riesgo y evolución de ingresos en tiempo real.",
  },
];

const COMPARISON = [
  { feature: "Control de pagos y vencimientos", excel: false, software: true },
  { feature: "Cobros automáticos con MercadoPago", excel: false, software: true },
  { feature: "Avisos de vencimiento por WhatsApp", excel: false, software: true },
  { feature: "Control de acceso con QR", excel: false, software: true },
  { feature: "App del alumno con rutinas y clases", excel: false, software: true },
  { feature: "Seguimiento de alumnos ausentes", excel: false, software: true },
  { feature: "Reportes de retención e ingresos", excel: false, software: true },
  { feature: "Costo inicial", excel: true, software: true },
  { feature: "Funciona sin internet", excel: true, software: false },
];

const articleJsonLd = {
  "@context": "https://schema.org",
  "@type": "Article",
  headline: "Excel vs software para gimnasios: cuándo conviene cambiar",
  description:
    "Comparativa entre Excel y software específico para la gestión de gimnasios en LATAM.",
  author: { "@type": "Organization", name: "FitGrowX" },
  publisher: {
    "@type": "Organization",
    name: "FitGrowX",
    url: "https://fitgrowx.com",
  },
  url: "https://fitgrowx.com/excel-vs-software-para-gimnasios",
  mainEntityOfPage: "https://fitgrowx.com/excel-vs-software-para-gimnasios",
};

export default function ExcelVsSoftwarePage() {
  return (
    <main className="min-h-screen bg-[#050505] text-white antialiased font-sans">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(articleJsonLd) }}
      />
      <LandingHeader actionType="link" actionLabel="Prueba gratis" actionHref="/start" />

      {/* Hero */}
      <section className="relative overflow-hidden px-5 pb-10 pt-28 sm:px-8 lg:px-12 lg:pt-36">
        <div
          className="pointer-events-none absolute inset-0"
          style={{
            background:
              "radial-gradient(circle at 16% 18%, rgba(59,130,246,0.16) 0%, transparent 30%), linear-gradient(180deg, rgba(7,11,23,0.94) 0%, rgba(5,5,5,1) 80%)",
          }}
        />
        <div className="relative mx-auto max-w-3xl">
          <div className="mb-4 inline-flex items-center gap-2 rounded-full border border-[#60A5FA]/14 bg-white/[0.05] px-3 py-1.5">
            <span className="text-[10px] font-semibold uppercase tracking-[0.2em] text-[#9CCEFF]">
              Gestión de gimnasios
            </span>
          </div>
          <h1 className="text-balance text-[2.4rem] font-semibold leading-[0.95] tracking-[-0.06em] text-white sm:text-[3.2rem]">
            Excel vs software para gimnasios:{" "}
            <span className="bg-gradient-to-r from-[#2C63FF] via-[#174BFF] to-[#FF6A00] bg-clip-text font-serif text-[0.92em] italic font-light text-transparent">
              cuándo conviene cambiar
            </span>
          </h1>
          <p className="mt-5 text-[15px] leading-7 text-white/50">
            Excel sirve para empezar. Pero cuando el gimnasio crece, lo que ahorra tiempo en la
            planilla se pierde el doble en trabajo manual: cobros, mensajes, seguimiento y errores
            de registro.
          </p>
        </div>
      </section>

      {/* Comparison table */}
      <section className="mx-auto max-w-3xl px-5 pb-12 sm:px-8 lg:px-12">
        <p className="mb-5 text-[11px] font-semibold uppercase tracking-[0.18em] text-white/30">
          Comparativa directa
        </p>
        <div className="overflow-hidden rounded-2xl border border-white/[0.07]">
          <div className="grid grid-cols-[1fr_100px_100px] border-b border-white/[0.07] bg-white/[0.05] px-5 py-3 text-[0.72rem] font-semibold uppercase tracking-widest text-white/40">
            <span>Función</span>
            <span className="text-center">Excel</span>
            <span className="text-center">Software</span>
          </div>
          {COMPARISON.map((row, i) => (
            <div
              key={row.feature}
              className={`grid grid-cols-[1fr_100px_100px] items-center px-5 py-3.5 text-[0.83rem] ${
                i % 2 === 0 ? "bg-white/[0.02]" : ""
              }`}
            >
              <span className="text-white/65">{row.feature}</span>
              <span className="flex justify-center">
                {row.excel ? (
                  <CheckCircle2 className="h-4 w-4 text-white/30" />
                ) : (
                  <X className="h-4 w-4 text-red-500/60" />
                )}
              </span>
              <span className="flex justify-center">
                {row.software ? (
                  <CheckCircle2 className="h-4 w-4 text-[#FF9B57]" />
                ) : (
                  <X className="h-4 w-4 text-white/25" />
                )}
              </span>
            </div>
          ))}
        </div>
      </section>

      {/* 5 problems */}
      <section className="mx-auto max-w-3xl px-5 pb-14 sm:px-8 lg:px-12">
        <p className="mb-5 text-[11px] font-semibold uppercase tracking-[0.18em] text-white/30">
          Los 5 problemas de gestionar un gimnasio con Excel
        </p>
        <div className="space-y-4">
          {EXCEL_PROBLEMS.map((p, i) => (
            <div
              key={p.title}
              className="flex gap-4 rounded-2xl border border-white/[0.07] bg-white/[0.03] p-5"
            >
              <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-red-500/10 text-[0.82rem] font-bold text-red-400">
                {i + 1}
              </div>
              <div>
                <p className="text-[0.9rem] font-semibold text-white">{p.title}</p>
                <p className="mt-1.5 text-[0.82rem] leading-6 text-white/45">{p.desc}</p>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* Cuándo conviene cambiar */}
      <section className="border-t border-white/[0.05] bg-white/[0.02] px-5 py-12 sm:px-8 lg:px-12">
        <div className="mx-auto max-w-3xl">
          <p className="mb-5 text-[11px] font-semibold uppercase tracking-[0.18em] text-white/30">
            Cuándo conviene hacer el cambio
          </p>
          <div className="space-y-3">
            {[
              "Cuando dedicás más de 2 horas semanales a cobros, mensajes y registros manuales.",
              "Cuando ya perdiste un alumno que se fue sin avisar y nadie lo detectó a tiempo.",
              "Cuando tu staff actualiza datos en distintas planillas y los números no coinciden.",
              "Cuando querés ofrecer reserva online, app o cobro automático pero el Excel no lo soporta.",
              "Cuando tenés más de 40 alumnos activos y el control manual ya no cierra.",
            ].map((item) => (
              <div key={item} className="flex items-start gap-3 rounded-2xl border border-white/[0.07] bg-white/[0.03] px-5 py-4">
                <CheckCircle2 className="h-4 w-4 shrink-0 mt-0.5 text-[#FF9B57]" />
                <p className="text-[0.85rem] leading-6 text-white/60">{item}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Internal links */}
      <section className="border-t border-white/[0.05] bg-white/[0.02] px-5 py-8 sm:px-8">
        <div className="mx-auto flex max-w-3xl flex-wrap items-center justify-center gap-4">
          <Link
            href="/software-para-gimnasios"
            className="text-[0.82rem] text-white/40 underline underline-offset-2 hover:text-white/70"
          >
            Software para gimnasios en LATAM
          </Link>
          <Link
            href="/automatizacion-whatsapp-gimnasios"
            className="text-[0.82rem] text-white/40 underline underline-offset-2 hover:text-white/70"
          >
            Automatización de WhatsApp para gimnasios
          </Link>
          <Link
            href="/recursos"
            className="text-[0.82rem] text-white/40 underline underline-offset-2 hover:text-white/70"
          >
            Recursos y guías para gimnasios
          </Link>
          <Link
            href="/faq"
            className="text-[0.82rem] text-white/40 underline underline-offset-2 hover:text-white/70"
          >
            FAQ FitGrowX
          </Link>
        </div>
      </section>

      {/* CTA */}
      <section className="border-t border-white/[0.06] px-5 py-16 text-center sm:px-8">
        <h2 className="text-2xl font-semibold tracking-[-0.04em] text-white sm:text-3xl">
          Dejá el Excel y probá FitGrowX
        </h2>
        <p className="mx-auto mt-4 max-w-lg text-[15px] leading-7 text-white/40">
          Sin contrato, sin tarjeta. Cargás tus alumnos y el sistema empieza a funcionar solo.
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
