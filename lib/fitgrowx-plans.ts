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
  priceAnnual: number;
  annualTotal: number;
  savings: number;
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
    priceAnnual: 28000,
    annualTotal: 336000,
    savings: 84000,
    features: [
      "Avisos automáticos por WhatsApp cuando vence una cuota",
      "Cobrás y tomás asistencia desde el mismo lugar",
      "Sabés qué socios van a vencer esa semana",
      "El alumno entra con QR y ve su estado desde el celu",
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
    priceAnnual: 52000,
    annualTotal: 624000,
    savings: 156000,
    features: [
      "Avisos automáticos por WhatsApp cuando vence una cuota — sin que te acuerdes",
      "Cada lead de Instagram llega solo a tu lista, sin copiar ni pegar",
      "El alumno entra con QR, ve sus rutinas y reserva desde el celu",
      "Cobrás, tomás asistencia y gestionás clases desde el mismo lugar",
      "Sabés el lunes cuántos socios van a vencer ese viernes",
      "La app y la landing llevan el nombre y colores de tu gym",
      "Socios ilimitados, sin restricciones",
    ],
  },
];

export function formatArs(value: number) {
  return value.toLocaleString("es-AR", { maximumFractionDigits: 0 });
}
