export type FitgrowxPlanKey = "starter" | "crecimiento";

export interface FitgrowxPlanDefinition {
  key: FitgrowxPlanKey;
  name: string;
  tagline: string;
  description: string;
  highlight: boolean;
  badge: string | null;
  studentLimit: string;
  studentLimitCount: number | null;
  ctaLabel: string;
  priceMonthly: number;
  priceAnnual: number;   // display price per month on annual plan (same as monthly for 10+2)
  annualTotal: number;   // total one-time charge = priceMonthly × 10
  savings: number;       // 2 free months = priceMonthly × 2
  features: string[];
}

export const FITGROWX_PLANS: FitgrowxPlanDefinition[] = [
  {
    key: "starter",
    name: "Starter",
    tagline: "Para gyms que están arrancando o que aún son pequeños.",
    description: "Lo esencial para no perder cobros ni socios, hasta 60 alumnos.",
    highlight: false,
    badge: null,
    studentLimit: "Hasta 60 alumnos",
    studentLimitCount: 60,
    ctaLabel: "Empezar gratis",
    priceMonthly: 35000,
    priceAnnual: 35000,
    annualTotal: 350000,
    savings: 70000,
    features: [
      "Avisos automáticos por WhatsApp cuando vence una cuota",
      "Cobrás y tomás asistencia desde el mismo lugar",
      "Sabés qué socios van a vencer esa semana",
      "El alumno tiene su propia app: entra con QR, ve su estado y su historial",
      "Panel separado para el dueño y acceso de staff con permisos limitados",
      "Hasta 60 alumnos activos",
    ],
  },
  {
    key: "crecimiento",
    name: "Pro",
    tagline: "Captación, retención y operación en un solo sistema.",
    description: "Todo lo que un gym necesita para no perder socios: seguimiento automático, cobros, clases y una app con tu marca.",
    highlight: true,
    badge: "Más popular",
    studentLimit: "Alumnos ilimitados",
    studentLimitCount: null,
    ctaLabel: "Empezar gratis",
    priceMonthly: 65000,
    priceAnnual: 65000,
    annualTotal: 650000,
    savings: 130000,
    features: [
      "Avisos automáticos por WhatsApp cuando vence una cuota — sin que te acuerdes",
      "Cada lead de Instagram llega solo a tu lista, sin copiar ni pegar",
      "El alumno tiene su propia app con tu logo: entra con QR, reserva clases y sigue sus rutinas",
      "Cobrás, tomás asistencia y gestionás clases desde el mismo lugar",
      "Sabés el lunes cuántos socios van a vencer ese viernes",
      "La app y la landing llevan el nombre, logo y colores de tu gym",
      "Panel del dueño separado del staff — cada uno ve solo lo que necesita",
      "Socios ilimitados, sin restricciones",
    ],
  },
];

export function formatArs(value: number) {
  return value.toLocaleString("es-AR", { maximumFractionDigits: 0 });
}
