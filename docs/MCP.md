# FitGrowX MCP Server

El servidor MCP (Model Context Protocol) de FitGrowX permite que Claude, GPT y otros agentes de IA gestionen tu gimnasio directamente: ver alumnos, enviar WhatsApp, cobrar, asignar rutinas y más.

## Qué es MCP

[Model Context Protocol](https://modelcontextprotocol.io) es el estándar abierto de Anthropic para conectar agentes de IA a herramientas externas. Con el servidor MCP de FitGrowX, Claude puede operar tu gym en lenguaje natural.

---

## Autenticación

1. Abrí FitGrowX → **Ajustes → Conexiones → API & Agentes IA**
2. Copiá tu API key
3. Pasala en cada request como header:

```
Authorization: Bearer <tu_api_key>
```

Para regenerar la clave (invalida la anterior): botón **Regenerar clave** en la misma sección.

---

## Conectar con Claude Desktop

1. Abrí `~/Library/Application Support/Claude/claude_desktop_config.json`
2. Agregá la siguiente configuración:

```json
{
  "mcpServers": {
    "fitgrowx": {
      "url": "https://app.fitgrowx.com/api/mcp",
      "headers": {
        "Authorization": "Bearer <tu_api_key>"
      }
    }
  }
}
```

3. Reiniciá Claude Desktop
4. Probalo: *"Claude, mostrá los alumnos que vencen esta semana"*

---

## Conectar con otros agentes

El endpoint soporta el protocolo **MCP Streamable HTTP** (spec 2025-03-26):

- **URL**: `https://app.fitgrowx.com/api/mcp`
- **Métodos**: `GET`, `POST`, `DELETE`
- **Auth**: `Authorization: Bearer <api_key>`
- **Manifest**: `GET /api/mcp/manifest` — lista de tools con descripción

---

## Tools disponibles

### Lectura

| Tool | Descripción | Ejemplo en lenguaje natural |
|------|-------------|----------------------------|
| `get_gym_summary` | Resumen: alumnos activos, MRR, por vencer, última asistencia | *"Dame un resumen del gym"* |
| `list_alumnos` | Lista alumnos con filtros por estado, nombre/DNI | *"Mostrá todos los alumnos vencidos"* |
| `get_alumno` | Datos completos de un alumno por id o nombre | *"Buscá a Juan Pérez"* |
| `list_expiring` | Alumnos que vencen en N días | *"¿Quién vence esta semana?"* |
| `list_clases` | Clases disponibles con horarios y cupos | *"¿Qué clases hay los lunes?"* |
| `get_payments_summary` | Resumen de pagos del mes (cobrado/pendiente/vencido) | *"¿Cuánto cobré este mes?"* |

### Escritura

| Tool | Descripción | Ejemplo en lenguaje natural |
|------|-------------|----------------------------|
| `send_whatsapp` | Envía WhatsApp a un alumno | *"Mandá un WA a Juan diciéndole que su membresía vence mañana"* |
| `create_payment_link` | Genera link de pago personalizado | *"Generá un link de pago de $5000 para María"* |
| `update_alumno_status` | Cambia estado: active / expired / blocked | *"Bloqueá a Carlos López por deuda"* |
| `assign_rutina` | Asigna o actualiza rutina de entrenamiento | *"Asigná a Pedro una rutina de fuerza con sentadillas y press de banca"* |
| `send_bulk_whatsapp` | WA masivo a un grupo filtrado (máx 50) | *"Mandá un WA a todos los que vencen en 7 días recordándoles que renueven"* |

---

## Referencia de parámetros

### `list_alumnos`
```
status:  "active" | "expired" | "blocked"  (opcional)
search:  string                              (busca por nombre o DNI)
limit:   number, default 20, max 100
```

### `list_expiring`
```
days: number, default 7, max 90
```

### `send_whatsapp`
```
alumno_id: UUID del alumno
mensaje:   string (max 4000 chars)
```

### `create_payment_link`
```
alumno_id:  UUID del alumno
monto:      número positivo (en moneda local)
descripcion: string (opcional)
```

### `update_alumno_status`
```
alumno_id: UUID del alumno
status:    "active" | "expired" | "blocked"
motivo:    string (opcional, se guarda en notas)
```

### `assign_rutina`
```
alumno_id:  UUID del alumno
nombre:     nombre de la rutina
ejercicios: array de ejercicios [{ nombre, series, reps, peso, ... }]
notas:      string (opcional)
```

### `send_bulk_whatsapp`
```
filter:  "expiring_7d"   — activos que vencen en 7 días
         "expired"        — alumnos vencidos
         "inactive_30d"   — activos sin asistencia en 30 días
mensaje: string (max 4000 chars)
         Soporta variables: {nombre}, {gym}
```

> **Límite anti-spam**: `send_bulk_whatsapp` procesa máximo 50 alumnos por llamada.

---

## Ejemplos de conversación con Claude

**Resumen diario:**
> "Claude, dame el resumen del gym y avisame si hay alumnos por vencer hoy."

**Campaña de renovación:**
> "Buscá todos los alumnos que vencen en 7 días y mandales un WA diciéndoles: 'Hola {nombre}, tu membresía en {gym} vence en pocos días. Renová ahora para no perder tu lugar 💪'"

**Gestión individual:**
> "Buscá a María García, generale un link de pago por $6000 y mandáselo por WhatsApp."

**Rutina personalizada:**
> "Asigná a Pedro Sánchez una rutina llamada 'Fuerza A' con sentadilla 4x8, press banca 4x8 y peso muerto 3x5."

---

## Aislamiento multi-tenant

Cada API key está ligada a un gym. Todas las queries filtran por `gym_id` — un agente autenticado con la key del Gym A nunca puede ver ni modificar datos del Gym B.
