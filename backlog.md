# Backlog — FitGrowX pre-launch

**Última actualización:** 2026-05-31  
**Branch de referencia:** `backup/pre-launch-fixes` (ee01ae3)  
**Build:** ✅ verde · **Tests:** ✅ 244/244

---

## ✅ Completado

### Seguridad (Bloque 1)
- **Fix 1.1** `82b07b3` — `getSession()` → `getUser()` en todas las APIs protegidas
- **Fix 1.2** verificado 2026-05-31 — IDOR push subscriptions: `alumno_id` se toma del token, no del body
- **Fix 1.3** verificado 2026-05-31 — WA relay: ownership de gym validado + rate limit por `gym_id`
- **Fix 1.4** verificado 2026-05-31 — Gemini: 20 req/hora por `user.id` ya activo
- **Fix 1.5** `19d2cu8` — CSP: eliminar `unsafe-eval` de `script-src`
- **Fix 1.6** `0f48a16` — reemplazar `xlsx@0.18.5` por `exceljs` (CVE prototype pollution)
- `fcbd1e8` — rate limit + payload cap en support-chat
- `558b71b` — validar `Content-Length` antes de buffering en upload-comprobante
- `5a89ff5` — validar tamaño de payload en workout-log
- `0480056` — cap de payload HTML/text en email-blast

### Pagos MercadoPago
- `65b66b2` — webhook token en notification_url de pagar-link
- `65a216c` — downgrade de gym en cancelación/fallo de suscripción
- `8bac974` — expiración de suscripciones por fecha, no solo por boolean
- `9662549` — cancelar preapproval mensual al activar plan anual
- `54ea6dc` — redactar webhook log, validar monto, preservar audit trail
- `7660fe3` — preservar ID de preapproval mensual y alertar al platform owner si falla cancelación en upgrade anual
- `57092b8` — idempotencia de webhooks con insert-first y unique index en DB
- `b42e648` — paywall server-side en todas las operaciones de escritura

### Plataforma interna
- `116f0b7` — consola de gyms con estado de billing y acciones de gestión
- `1bc3037` — tracking de `cron_runs` en todos los scheduled jobs
- `9501217` — dev page: header correcto (`CRON_SECRET`) + confirmaciones antes de ejecutar
- `ee01ae3` — columnas de métricas WA en `wa_mensajes_log` (`status`, `latency_ms`, `motor_status_code`, `motor_error`)
- `0a1524f` — log de fallo de email al registrar un gym nuevo

### Legal / compliance
- `a9387c9` + `72489be` — aceptación de términos obligatoria en registro
- `e464606` — actualizar fecha legal y remover CUIT personal de páginas públicas

### Infraestructura WA
- `9e89842` — flush de wa-queue cada minuto (cron)

---

## 🟡 Pendiente — importante antes de escalar

### Bloque 2 — Contratos de datos
- **Fix 2.1** — Generar `lib/database.types.ts` con `supabase gen types typescript` y tipar todos los clientes.
- **Fix 2.2** — Helper `lib/api/parse.ts` para centralizar `req.json()` + Zod y devolver 400 consistente.
- **Fix 2.3** — Unificar snake_case/camelCase: snake en payloads API/DB, camelCase solo en UI.

### Bloque 3 — Performance / App Router
- **Fix 3.1** — Dashboard layout como Server Component; mover interacciones a `DashboardShellClient`.
- **Fix 3.2** — Sacar Framer Motion del hero above-the-fold (reemplazar con CSS).
- **Fix 3.3** — `next/image` con `priority` en rutas LCP; habilitar AVIF/WebP en `next.config.ts`.
- **Fix 3.4** — Reemplazar `@import` de Google Fonts por `next/font/google`.
- **Fix 3.5** — Paginación server-side o virtualización (`@tanstack/react-virtual`) en lista de alumnos.

### Bloque 4 — Tests y CI
- **Fix 4.1** — ESLint a cero: eliminar `any`, corregir `set-state-in-effect`, limpiar imports no usados.
- **Fix 4.2** — Reemplazar tests inline por tests de componentes reales con Testing Library.
- **Fix 4.3** — Tests de seguridad: IDOR, payload inválido y rate limit para `push-subscribe`, `reservar`, `pagar`, `rutina/sugerir`.
- **Fix 4.4** — Husky + lint-staged + Prettier como pre-commit.

---

## 🟢 Pendiente — deuda técnica (post-launch)

### Bloque 5 — Mantenibilidad
- **Fix 5.1** — Partir `app/dashboard/alumnos/page.tsx` (2802 líneas) en hooks + componentes.
- **Fix 5.2** — Extraer lógica de cálculo de vencimientos/descuentos a `lib/domain/payments.ts` (funciones puras + tests).
- **Fix 5.3** — Normalizar errores API: usar `sanitizeError` en todas las rutas, no exponer mensajes internos de Supabase.
- **Fix 5.4** — Centralizar tipos de dominio en `lib/types/*`; eliminar redefiniciones por página.

### Pendiente menor
- Agregar constraint `gym_promotions_type_check` cuando se active la feature de promociones (ver `docs/audit/backlog_20260427_findings.md`).
