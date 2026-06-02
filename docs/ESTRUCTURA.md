# Estructura del proyecto FitGrowX

## Mapa visual

```text
app/
  (auth)/          rutas de autenticacion sin cambiar URL publica
  (dashboard)/     rutas del dashboard del gym
  (alumno)/        rutas de la app del alumno
  (platform)/      rutas del platform owner
  api/             endpoints organizados por dominio
  onboarding/      flujo de registro
  checkin/         check-in publico
  gym/             landing publica de gimnasios
  pase/            pases y tokens publicos
  reserva/         reservas publicas
  start/           entrada comercial
  faq, guia, privacidad, reseller, terminos

components/
  ui/              componentes genericos reutilizables
  dashboard/       componentes exclusivos del dashboard
  alumno/          componentes exclusivos de la app del alumno
  platform/        componentes exclusivos del platform owner
  *.tsx            componentes compartidos o de marketing

hooks/             hooks custom compartidos

lib/
  api/             helpers de parsing y mappers de API
  mp/              helpers de MercadoPago
  *.ts             utilidades y clientes compartidos

types/             tipos TypeScript compartidos

constants/         constantes globales

supabase/
  migrations/      migraciones SQL versionadas

docs/
  audit/           auditorias tecnicas
  archive/         artefactos historicos y SQL manuales
  *.md             documentacion del producto y del proyecto

scripts/           scripts manuales de soporte
```

## Convenciones de nombres

- Rutas Next.js: `app/(grupo)/segmento/page.tsx`, usando route groups para ordenar sin modificar URLs.
- Componentes React: `PascalCase.tsx` cuando exportan un componente principal.
- Hooks: `useNombre.ts` y siempre dentro de `hooks/`.
- Tipos compartidos: `types/<dominio>.ts`.
- Constantes compartidas: `constants/<dominio>.ts` o `constants/index.ts` si son globales.
- Helpers de proveedores: `lib/<proveedor>/<helper>.ts` cuando el proveedor no supera el umbral de imports.
- Documentacion: nombres descriptivos en `docs/`, preferentemente `UPPER_SNAKE_CASE.md` para documentos de referencia.

## Donde va cada archivo nuevo

- Nueva ruta de auth: `app/(auth)/`.
- Nueva pantalla del dashboard: `app/(dashboard)/dashboard/<ruta>/page.tsx`.
- Nueva pantalla del alumno: `app/(alumno)/alumno/<ruta>/page.tsx`.
- Nueva pantalla de platform owner: `app/(platform)/platform/<ruta>/page.tsx`.
- Nuevo endpoint: `app/api/<dominio>/<accion>/route.ts`.
- Nuevo componente reusable: `components/ui/`.
- Nuevo componente de dashboard: `components/dashboard/`.
- Nuevo componente de alumno: `components/alumno/`.
- Nuevo componente de platform owner: `components/platform/`.
- Nuevo hook: `hooks/`.
- Nuevo tipo compartido: `types/`.
- Nueva constante global: `constants/`.
- Nuevo helper MercadoPago: `lib/mp/`.
- Nueva migracion Supabase: `supabase/migrations/`.
- Nueva documentacion: `docs/`.
- Nuevo script manual: `scripts/`.

## Auditoria aplicada

- Archivos raiz movidos a `docs/`: backlog, auditorias, testing, endpoints, plan pre-launch y documento de arquitectura WhatsApp.
- Artefactos historicos movidos a `docs/archive/`: `build.log` y SQL manual de comprobantes.
- Script raiz movido a `scripts/query_roles.mjs`.
- Componentes especificos salieron de `app/` hacia `components/dashboard`, `components/alumno` y `components/platform`.
- `app/alumno/hooks/useAlumnoFotos.ts` paso a `hooks/useAlumnoFotos.ts`.
- `lib/dashboard-types.ts` y `lib/database.types.ts` pasaron a `types/`.
- `lib/ejercicios.ts` y `lib/constants.ts` pasaron a `constants/`.
- `lib/mp-timeout.ts` paso a `lib/mp/timeout.ts`.

## No movido por regla de mas de 10 imports

- `lib/supabase.ts`, `lib/supabase-admin.ts`, `lib/supabase-server.ts` y `lib/supabase-relations.ts`.
- `lib/wa.ts` y el grupo `lib/wa-*`.

Estos modulos deberian moverse en una tarea dedicada, idealmente con barrels temporales o aliases de compatibilidad para evitar un cambio masivo de imports en el mismo commit.

## Carpetas principales

- `app/`: rutas, layouts y route handlers de Next.js.
- `components/`: componentes React fuera del sistema de rutas.
- `hooks/`: estado y efectos reutilizables de cliente.
- `lib/`: clientes, helpers y utilidades de dominio.
- `types/`: contratos TypeScript compartidos.
- `constants/`: listas, valores globales y mocks constantes.
- `supabase/`: migraciones y soporte de base de datos.
- `docs/`: documentacion, auditorias y archivos historicos.
- `scripts/`: scripts manuales que no forman parte del runtime.
