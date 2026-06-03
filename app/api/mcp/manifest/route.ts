import { NextResponse } from "next/server";

const TOOLS = [
  {
    name: "get_gym_summary",
    description: "Resumen general del gym: alumnos activos, MRR estimado, alumnos por vencer en 7 días y última asistencia registrada.",
    parameters: {},
  },
  {
    name: "list_alumnos",
    description: "Lista alumnos con filtros opcionales por estado (active/expired/blocked), búsqueda por nombre o DNI, y límite de resultados.",
    parameters: { status: "string (opcional)", search: "string (opcional)", limit: "number (default 20)" },
  },
  {
    name: "get_alumno",
    description: "Datos completos de un alumno buscando por id UUID o por nombre/DNI.",
    parameters: { alumno_id: "string UUID (opcional)", search: "string (opcional)" },
  },
  {
    name: "list_expiring",
    description: "Alumnos activos cuya membresía vence en los próximos N días.",
    parameters: { days: "number (default 7, max 90)" },
  },
  {
    name: "list_clases",
    description: "Clases disponibles del gym con nombre, día de la semana, horario y capacidad máxima.",
    parameters: {},
  },
  {
    name: "get_payments_summary",
    description: "Resumen de pagos del mes actual: total cobrado, pendiente y vencido.",
    parameters: {},
  },
  {
    name: "send_whatsapp",
    description: "Envía un mensaje de WhatsApp a un alumno específico.",
    parameters: { alumno_id: "string UUID", mensaje: "string (max 4000 chars)" },
  },
  {
    name: "create_payment_link",
    description: "Genera un link de pago personalizado para que el alumno pague su membresía.",
    parameters: { alumno_id: "string UUID", monto: "number", descripcion: "string (opcional)" },
  },
  {
    name: "update_alumno_status",
    description: "Cambia el estado de un alumno a active, expired o blocked.",
    parameters: { alumno_id: "string UUID", status: "active | expired | blocked", motivo: "string (opcional)" },
  },
  {
    name: "assign_rutina",
    description: "Asigna o actualiza la rutina de entrenamiento de un alumno.",
    parameters: { alumno_id: "string UUID", nombre: "string", ejercicios: "array", notas: "string (opcional)" },
  },
  {
    name: "send_bulk_whatsapp",
    description: "Envía un mensaje de WhatsApp a un grupo de alumnos filtrado. Máximo 50 por llamada. Soporta {nombre} y {gym} en el mensaje.",
    parameters: { filter: "expiring_7d | expired | inactive_30d", mensaje: "string (max 4000 chars)" },
  },
];

export async function GET() {
  return NextResponse.json({
    name: "FitGrowX",
    description: "Gestión completa de gimnasios: alumnos, cobros, WhatsApp, clases y rutinas.",
    version: "1.0.0",
    transport: "Streamable HTTP (MCP 2025-03-26)",
    endpoint: "/api/mcp",
    tools: TOOLS,
    auth: {
      type: "bearer",
      description: "API key del gym desde Ajustes → Conexiones → API & Agentes IA",
      header: "Authorization: Bearer <api_key>",
    },
  });
}
