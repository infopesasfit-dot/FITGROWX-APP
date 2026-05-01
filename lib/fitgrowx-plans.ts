export type FitgrowxPlanKey = "crecimiento";

export interface FitgrowxPlanDefinition {
  key: FitgrowxPlanKey;
  name: string;
  tagline: string;
  description: string;
  highlight: boolean;
  badge: string | null;
  studentLimit: string;
  ctaLabel: string;
  priceMonthly: number;
  priceAnnual: number;
  features: string[];
}

export const FITGROWX_PLANS: FitgrowxPlanDefinition[] = [
  {
    key: "crecimiento",
    name: "FitGrowX Anual",
    tagline: "Captación, retención y operación en un solo sistema.",
    description: "Unificá WhatsApp, alumnos, cobros, landing, clases y seguimiento en una sola membresía anual con 20% OFF por pago anticipado.",
    highlight: true,
    badge: "20% OFF anual",
    studentLimit: "Alumnos ilimitados",
    ctaLabel: "Elegir plan anual",
    priceMonthly: 65000,
    priceAnnual: 52000,
    features: [
      "Alumnos ilimitados",
      "Landing propia conectada a prospectos",
      "Automatizaciones por WhatsApp para captar y retener",
      "Cobros, asistencias y clases en un solo panel",
      "App del alumno con check-in, rutinas y reservas",
      "Branding del gym incluido",
      "Reportes y métricas operativas",
    ],
  },
];

export function formatArs(value: number) {
  return value.toLocaleString("es-AR", { maximumFractionDigits: 0 });
}
