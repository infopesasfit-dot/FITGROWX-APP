export interface RecenteAlumno {
  id: string;
  full_name: string;
  created_at: string;
}

export interface PlanDist {
  nombre: string;
  count: number;
}

export interface DashboardMetric {
  key: string;
  label: string;
  section: "Embudo" | "Fidelización" | "Eficiencia";
  tooltip: string;
  value: number | null;
  previous: number | null;
  format: "number" | "percent" | "currency" | "months";
  accent: "orange" | "ink" | "soft";
}

export interface DashboardAlerts {
  inactiveCount: number;
  inactiveNames: string[];
  upcomingExpirations: { id: string; full_name: string; next_expiration_date: string | null }[];
}

export interface SetupFlags {
  alumnos: boolean;
  planes: boolean;
  landing: boolean;
  whatsapp: boolean;
  pagos: boolean;
}

export interface DashboardSnapshot {
  activosCount: number;
  totalCount: number;
  ingresoProyectado: number;
  proyeccionProximoMes: number;
  renovacionesPendientes: number;
  renovacionesCount: number;
  mensajesAutoEnviados: number;
  recuperadosCount: number;
  recuperadosRevenue: number;
  recaudadoEsteMes: number;
  deudaTotal: number;
  morososCount: number;
  gastosTotal: number;
  recientes: RecenteAlumno[];
  captacion5: number[];
  ingresos5: number[];
  gastos5: number[];
  planDist: PlanDist[];
  prospectos: number;
  asistDiarias: { fecha: string; count: number }[];
  asistHoras: number[];
  asistHoy: number;
  asistPromedioDiario: number;
  metrics: DashboardMetric[];
  alerts: DashboardAlerts;
}
