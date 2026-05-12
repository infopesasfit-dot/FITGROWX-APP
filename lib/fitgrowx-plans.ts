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
    description: "Todo lo que un gym necesita para no perder socios: seguimiento automático, cobros, clases y una app con tu marca.",
    highlight: true,
    badge: "20% OFF anual",
    studentLimit: "Alumnos ilimitados",
    ctaLabel: "Elegir plan anual",
    priceMonthly: 65000,
    priceAnnual: 52000,
    features: [
      "Avisos automáticos por WhatsApp cuando vence una cuota — sin que te acuerdes",
      "Cada lead de Instagram llega solo a tu lista, sin copiar ni pegar",
      "El alumno entra con QR, ve sus rutinas y reserva desde el celu",
      "Cobrás, tomás asistencia y gestionás clases desde el mismo lugar",
      "Sabés el lunes cuántos socios van a vencer ese viernes",
      "La app y la landing llevan el nombre y colores de tu gym",
      "Todos tus socios en un solo lugar, sin límite de cantidad",
    ],
  },
];

export function formatArs(value: number) {
  return value.toLocaleString("es-AR", { maximumFractionDigits: 0 });
}
