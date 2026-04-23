export type FitgrowxPlanKey = "gestion" | "crecimiento" | "full_marca";

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
    key: "gestion",
    name: "Plan Gestión",
    tagline: "Dejá atrás las planillas. Para siempre.",
    description: "Ordená cobros, alumnos, asistencia y automatizaciones desde un solo lugar, sin depender de Excel ni recordatorios manuales.",
    highlight: false,
    badge: null,
    studentLimit: "Hasta 50 alumnos",
    ctaLabel: "Empezar con Gestión",
    priceMonthly: 49000,
    priceAnnual: 39200,
    features: [
      "Hasta 50 alumnos",
      "Membresías con vencimiento automático",
      "Registro y validación de pagos",
      "Egresos y métricas financieras",
      "Escáner QR de asistencia",
      "Integración WhatsApp",
      "Automatizaciones y seguimiento",
    ],
  },
  {
    key: "crecimiento",
    name: "Plan Crecimiento",
    tagline: "Tu gym capta alumnos solo, mientras vos entrenás.",
    description: "Sumá captación activa 24/7, prospectos ordenados y campañas que convierten consultas en alumnos sin perseguir cada lead a mano.",
    highlight: true,
    badge: "Más elegido",
    studentLimit: "Hasta 200 alumnos",
    ctaLabel: "Empezar con Crecimiento",
    priceMonthly: 65000,
    priceAnnual: 52000,
    features: [
      "Hasta 200 alumnos",
      "Todo lo del Plan Gestión",
      "Landing de captación propia",
      "Gestión de prospectos e interesados",
      "Campañas de WhatsApp automáticas",
      "Publicidad integrada",
      "Métricas de conversión",
    ],
  },
  {
    key: "full_marca",
    name: "Plan Full Marca",
    tagline: "Tu gym, tu identidad. Ni rastro de FitGrowX.",
    description: "Llevá la experiencia completa a tu marca: logo, colores, nombre y panel del alumno con presencia 100% propia desde el primer día.",
    highlight: false,
    badge: "15 días gratis",
    studentLimit: "Alumnos ilimitados",
    ctaLabel: "Empezar con Full Marca",
    priceMonthly: 85000,
    priceAnnual: 68000,
    features: [
      "Alumnos ilimitados",
      "Todo lo del Plan Crecimiento",
      "Logo y nombre propio en toda la UI",
      "Panel del alumno 100% con tu marca",
      "Sin ninguna mención a FitGrowX",
      "Dominio personalizado propio",
    ],
  },
];

export function formatArs(value: number) {
  return value.toLocaleString("es-AR", { maximumFractionDigits: 0 });
}
