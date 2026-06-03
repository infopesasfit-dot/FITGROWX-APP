import { FAQ_ITEMS } from "@/lib/guide-content";

const SITE_URL = "https://fitgrowx.com";
const CANONICAL_DESCRIPTION =
  "FitGrowX es un software de gestión y crecimiento para gimnasios en LATAM que centraliza alumnos, cobros, WhatsApp, QR, staff, clases y app del alumno.";

// Preguntas orientadas a SEO/GEO que complementan las del producto (FAQ_ITEMS).
const SEO_FAQ_ITEMS = [
  {
    question: "¿Cuánto cuesta un software para gimnasios en Argentina?",
    answer:
      "FitGrowX arranca desde $35.000 ARS por mes e incluye gestión de alumnos, cobros, automatización por WhatsApp, check-in con QR, staff, clases y la app del alumno. No cobramos por alumno, así que el precio no crece a medida que sumás más gente al gimnasio.",
  },
  {
    question: "¿Cómo automatizar los cobros de membresía en un gimnasio?",
    answer:
      "Con FitGrowX cada alumno tiene su vencimiento cargado y el sistema envía recordatorios de pago por WhatsApp con un link de cobro de MercadoPago. Cuando el alumno paga, la membresía se renueva sola y queda registrada, sin que tengas que perseguir a nadie ni anotar pagos a mano.",
  },
  {
    question: "¿Qué ventajas tiene usar software en vez de Excel para un gimnasio?",
    answer:
      "A diferencia de un Excel, FitGrowX cobra solo, avisa vencimientos por WhatsApp, controla el acceso con QR, le da una app a cada alumno y te muestra métricas reales de ingresos, asistencia y retención. El Excel no te avisa cuando alguien deja de venir ni cobra por vos; FitGrowX sí.",
  },
  {
    question: "¿FitGrowX funciona con MercadoPago?",
    answer:
      "Sí. FitGrowX se integra con MercadoPago para generar links de cobro y procesar pagos de membresías. Cuando el alumno paga, la membresía se acredita y renueva automáticamente dentro del sistema.",
  },
  {
    question: "¿Los alumnos tienen app propia?",
    answer:
      "Sí. Cada alumno tiene su propia app con el logo y los colores de tu gimnasio. Desde ahí ingresa con QR, reserva clases, sigue la rutina que le asignó el coach, anota sus marcas y consulta su historial de asistencia.",
  },
  {
    question: "¿FitGrowX funciona en México, Colombia y Chile?",
    answer:
      "Sí. FitGrowX está pensado para gimnasios de toda LATAM y funciona en México, Colombia, Chile, Uruguay y Argentina, entre otros países. La automatización por WhatsApp, el cobro de membresías y la app del alumno funcionan igual en cada mercado.",
  },
];

function JsonLd({ data }: { data: object }) {
  return (
    <script
      type="application/ld+json"
      dangerouslySetInnerHTML={{ __html: JSON.stringify(data) }}
    />
  );
}

export function SoftwareApplicationJsonLd() {
  const data = {
    "@context": "https://schema.org",
    "@type": "SoftwareApplication",
    name: "FitGrowX",
    applicationCategory: "BusinessApplication",
    operatingSystem: "Web",
    url: SITE_URL,
    description: CANONICAL_DESCRIPTION,
    offers: {
      "@type": "Offer",
      price: "35000",
      priceCurrency: "ARS",
      priceSpecification: {
        "@type": "UnitPriceSpecification",
        price: "35000",
        priceCurrency: "ARS",
        unitText: "MONTH",
      },
    },
  };
  return <JsonLd data={data} />;
}

export function OrganizationJsonLd() {
  const data = {
    "@context": "https://schema.org",
    "@type": "Organization",
    name: "FitGrowX",
    url: SITE_URL,
    logo: `${SITE_URL}/images/logo-512x512.png`,
    description: CANONICAL_DESCRIPTION,
    sameAs: [
      "https://www.instagram.com/fitgrowx",
      "https://www.facebook.com/fitgrowx",
    ],
  };
  return <JsonLd data={data} />;
}

export function FaqJsonLd() {
  const items = [...FAQ_ITEMS, ...SEO_FAQ_ITEMS];
  const data = {
    "@context": "https://schema.org",
    "@type": "FAQPage",
    mainEntity: items.map((item) => ({
      "@type": "Question",
      name: item.question,
      acceptedAnswer: {
        "@type": "Answer",
        text: item.answer,
      },
    })),
  };
  return <JsonLd data={data} />;
}
