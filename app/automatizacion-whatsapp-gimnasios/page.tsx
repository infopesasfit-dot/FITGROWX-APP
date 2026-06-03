import type { Metadata } from "next";
import Link from "next/link";
import { ArrowRight, MessageCircle } from "lucide-react";
import { LandingHeader } from "@/components/landing-header";

export const metadata: Metadata = {
  title: "Automatización de WhatsApp para gimnasios | FitGrowX",
  description:
    "Qué mensajes podés automatizar en tu gimnasio por WhatsApp: vencimientos, alumnos inactivos, cumpleaños, bienvenidas y leads. Cómo funciona en FitGrowX.",
  alternates: { canonical: "https://fitgrowx.com/automatizacion-whatsapp-gimnasios" },
  openGraph: {
    title: "Automatización de WhatsApp para gimnasios | FitGrowX",
    description:
      "Automatizá vencimientos, seguimiento de ausentes, cumpleaños y leads por WhatsApp desde FitGrowX. Sin enviar un mensaje a mano.",
    url: "https://fitgrowx.com/automatizacion-whatsapp-gimnasios",
    siteName: "FitGrowX",
    type: "article",
  },
};

const AUTOMATIONS = [
  {
    title: "Recordatorio de vencimiento",
    when: "3 días antes y el día del vencimiento",
    msg: "\"Hola, Juan. Tu membresía vence el viernes. Podés renovar con este link 👉 [link MercadoPago]\"",
    benefit: "El alumno paga antes de vencer. Vos no tenés que acordarte ni escribir nada.",
  },
  {
    title: "Seguimiento de alumnos inactivos",
    when: "Cuando un alumno no viene 7 días seguidos",
    msg: "\"¡Te extrañamos por acá! ¿Todo bien? Si querés volver, te recomiendo el miércoles a las 19hs.\"",
    benefit: "Intervenís antes de que el alumno ya decidió irse. El timing lo hace todo.",
  },
  {
    title: "Bienvenida al alumno nuevo",
    when: "El día que se carga al alumno en el sistema",
    msg: "\"Bienvenido/a a [nombre del gimnasio]. Tu acceso ya está activo. Podés descargar tu app acá 👇\"",
    benefit: "El alumno llega orientado, con acceso y sin preguntar todo de cero al staff.",
  },
  {
    title: "Felicitación de cumpleaños",
    when: "El día del cumpleaños del alumno",
    msg: "\"¡Feliz cumple! Hoy te esperamos con un pequeño regalo en el gym 🎉\"",
    benefit: "Crea vínculo sin esfuerzo. Un mensaje automático que se siente humano.",
  },
  {
    title: "Aviso de membresía vencida",
    when: "Si la membresía ya venció y no renovó",
    msg: "\"Tu acceso está pausado. Podés reactivarlo con este link y volver mañana mismo.\"",
    benefit: "Recuperás alumnos que se quedaron sin membresía antes de que se olviden de renovar.",
  },
  {
    title: "Respuesta automática a leads",
    when: "Cuando un prospecto escribe por primera vez",
    msg: "\"Hola, soy del equipo de [gym]. ¿Buscás bajar grasa, ganar fuerza o volver a entrenar? Te mando opciones en un momento.\"",
    benefit: "Respondés en menos de 5 minutos aunque el dueño esté en clase o durmiendo.",
  },
];

const articleJsonLd = {
  "@context": "https://schema.org",
  "@type": "Article",
  headline: "Automatización de WhatsApp para gimnasios | FitGrowX",
  description:
    "Qué mensajes podés automatizar en tu gimnasio por WhatsApp y cómo funciona en FitGrowX.",
  author: { "@type": "Organization", name: "FitGrowX" },
  publisher: {
    "@type": "Organization",
    name: "FitGrowX",
    url: "https://fitgrowx.com",
  },
  url: "https://fitgrowx.com/automatizacion-whatsapp-gimnasios",
  mainEntityOfPage: "https://fitgrowx.com/automatizacion-whatsapp-gimnasios",
};

export default function AutomatizacionWhatsappPage() {
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
              "radial-gradient(circle at 16% 18%, rgba(34,197,94,0.1) 0%, transparent 32%), radial-gradient(circle at 80% 20%, rgba(255,106,0,0.1) 0%, transparent 28%), linear-gradient(180deg, rgba(7,11,23,0.94) 0%, rgba(5,5,5,1) 80%)",
          }}
        />
        <div className="relative mx-auto max-w-3xl">
          <div className="mb-4 inline-flex items-center gap-2 rounded-full border border-[#60A5FA]/14 bg-white/[0.05] px-3 py-1.5">
            <MessageCircle className="h-3.5 w-3.5 text-[#4ADE80]" />
            <span className="text-[10px] font-semibold uppercase tracking-[0.2em] text-[#9CCEFF]">
              WhatsApp · Gimnasios · LATAM
            </span>
          </div>
          <h1 className="text-balance text-[2.4rem] font-semibold leading-[0.95] tracking-[-0.06em] text-white sm:text-[3.2rem]">
            Automatización de WhatsApp{" "}
            <span className="bg-gradient-to-r from-[#2C63FF] via-[#174BFF] to-[#FF6A00] bg-clip-text font-serif text-[0.92em] italic font-light text-transparent">
              para gimnasios
            </span>
          </h1>
          <p className="mt-5 max-w-2xl text-[15px] leading-7 text-white/50">
            La mayoría de los mensajes que hoy mandás a mano en tu gimnasio pueden enviarse solos.
            Vencimientos, ausentes, bienvenidas, cumpleaños y leads. Así funciona en FitGrowX.
          </p>
        </div>
      </section>

      {/* How it works */}
      <section className="mx-auto max-w-3xl px-5 pb-6 sm:px-8 lg:px-12">
        <p className="mb-5 text-[11px] font-semibold uppercase tracking-[0.18em] text-white/30">
          Cómo funciona en FitGrowX
        </p>
        <div className="space-y-3">
          {[
            "Conectás tu número de WhatsApp desde Ajustes → Conexiones. El proceso toma menos de 2 minutos.",
            "FitGrowX monitorea el estado de cada alumno: membresía, asistencia, vencimiento y cumpleaños.",
            "Cuando una condición se cumple (ejemplo: 3 días para vencer), el sistema envía el mensaje automáticamente.",
            "El mensaje sale desde tu número de WhatsApp, con el nombre del alumno y el link de cobro o acción correspondiente.",
            "Vos ves el historial de mensajes enviados y podés ajustar qué se manda y cuándo.",
          ].map((step, i) => (
            <div key={step} className="flex gap-3 rounded-2xl border border-white/[0.07] bg-white/[0.03] p-4">
              <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-[#FF6A00]/10 text-[0.8rem] font-bold text-[#FF9B57]">
                {i + 1}
              </div>
              <p className="mt-0.5 text-[0.84rem] leading-6 text-white/55">{step}</p>
            </div>
          ))}
        </div>
      </section>

      {/* Automations */}
      <section className="mx-auto max-w-3xl px-5 pb-14 pt-6 sm:px-8 lg:px-12">
        <p className="mb-5 text-[11px] font-semibold uppercase tracking-[0.18em] text-white/30">
          Mensajes que podés automatizar
        </p>
        <div className="space-y-4">
          {AUTOMATIONS.map((auto) => (
            <div
              key={auto.title}
              className="rounded-2xl border border-white/[0.07] bg-white/[0.03] p-6"
            >
              <div className="mb-1 flex items-center gap-2">
                <MessageCircle className="h-4 w-4 text-[#4ADE80]/70" />
                <p className="text-[0.9rem] font-semibold text-white">{auto.title}</p>
              </div>
              <p className="mb-3 text-[0.74rem] text-white/30">{auto.when}</p>
              <div className="mb-3 rounded-xl bg-white/[0.04] px-4 py-3 text-[0.82rem] italic leading-6 text-white/50">
                {auto.msg}
              </div>
              <p className="text-[0.8rem] leading-5 text-[#FF9B57]/80">{auto.benefit}</p>
            </div>
          ))}
        </div>
      </section>

      {/* What you don't need to do */}
      <section className="border-t border-white/[0.05] bg-white/[0.02] px-5 py-12 sm:px-8 lg:px-12">
        <div className="mx-auto max-w-3xl">
          <p className="mb-4 text-[11px] font-semibold uppercase tracking-[0.18em] text-white/30">
            Qué dejás de hacer a mano
          </p>
          <div className="grid gap-3 sm:grid-cols-2">
            {[
              "Recordar quién vence esta semana",
              "Avisar por WhatsApp de pago uno por uno",
              "Buscar alumnos que no vinieron en días",
              "Escribir felicitaciones de cumpleaños",
              "Responder leads a las 11pm",
              "Copiar links de cobro en cada conversación",
            ].map((item) => (
              <div key={item} className="flex items-center gap-2 text-[0.84rem] text-white/50">
                <span className="h-1.5 w-1.5 rounded-full bg-[#FF9B57]/60" />
                {item}
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
            href="/excel-vs-software-para-gimnasios"
            className="text-[0.82rem] text-white/40 underline underline-offset-2 hover:text-white/70"
          >
            Excel vs software para gimnasios
          </Link>
          <Link
            href="/recursos"
            className="text-[0.82rem] text-white/40 underline underline-offset-2 hover:text-white/70"
          >
            Recursos y guías para gimnasios
          </Link>
          <Link
            href="/guia"
            className="text-[0.82rem] text-white/40 underline underline-offset-2 hover:text-white/70"
          >
            Guía de configuración
          </Link>
        </div>
      </section>

      {/* CTA */}
      <section className="border-t border-white/[0.06] px-5 py-16 text-center sm:px-8">
        <h2 className="text-2xl font-semibold tracking-[-0.04em] text-white sm:text-3xl">
          Activá WhatsApp automático en tu gimnasio
        </h2>
        <p className="mx-auto mt-4 max-w-lg text-[15px] leading-7 text-white/40">
          Probá FitGrowX gratis. Conectás WhatsApp en 2 minutos y los mensajes empiezan a salir
          solos.
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
