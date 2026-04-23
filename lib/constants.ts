// Realistic mock expenses — used as fallback in egresos/page.tsx until real DB data exists
export const MOCK_GASTOS_TOTAL = 1_820_000; // ARS acumulado del mes

export const MOCK_GASTOS_MES = [
  { id: "g1",  titulo: "Alquiler Abril",              monto: 850_000, categoria: "Alquiler",      fecha: "2026-04-01", gym_id: "mock" },
  { id: "g2",  titulo: "Luz y Gas",                   monto: 120_000, categoria: "Servicios",     fecha: "2026-04-05", gym_id: "mock" },
  { id: "g3",  titulo: "Sueldo Recepcionista",        monto: 280_000, categoria: "Sueldos",       fecha: "2026-04-07", gym_id: "mock" },
  { id: "g4",  titulo: "Sueldo Profesor Funcional",   monto: 320_000, categoria: "Sueldos",       fecha: "2026-04-07", gym_id: "mock" },
  { id: "g5",  titulo: "Instagram Ads Abril",         monto: 75_000,  categoria: "Marketing",     fecha: "2026-04-08", gym_id: "mock" },
  { id: "g6",  titulo: "Mantenimiento Bicicletas",    monto: 45_000,  categoria: "Mantenimiento", fecha: "2026-04-10", gym_id: "mock" },
  { id: "g7",  titulo: "Internet Fibra Óptica",       monto: 28_000,  categoria: "Servicios",     fecha: "2026-04-10", gym_id: "mock" },
  { id: "g8",  titulo: "Colchonetas Nuevas (x10)",    monto: 90_000,  categoria: "Equipamiento",  fecha: "2026-04-12", gym_id: "mock" },
  { id: "g9",  titulo: "Limpieza (mensual)",          monto: 12_000,  categoria: "Otros",         fecha: "2026-04-13", gym_id: "mock" },
] as const;
