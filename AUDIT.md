# 🔍 AUDIT — Deuda Técnica & Mejoras Futuras

## 🔮 Mejoras futuras

### Refactor de arquitectura: Rama mobile/desktop duplicada (Paso C 3.5)
**Contexto:** El dashboard tiene dos returns separados (`if (!isDesktop)` + fallback desktop) que duplican componentes compartidos como OnboardingModal, OnboardingProgress, y otros elementos que no cambian entre ramas.

**Acción requerida:** 
Refactor candidato (Bloque 7): unificar en un único árbol JSX con condicionales internos en lugar de dos returns paralelos. Esto:
- Elimina duplicación (DRY)
- Reduce deuda de mantenimiento
- Mejora readability

**Archivos afectados:**
- `/app/dashboard/page.tsx` (estructura del componente)

---

### Discrepancia de tokens de marca (Paso C 3.3)
**Contexto:** Durante la extracción de `OnboardingProgress`, se descubrió:
- `page.tsx` línea 20: `const accent = "#FF7A18"` (naranja claro)
- `globals.css` línea 176: `--accent: #f06418` (naranja oscuro)

Estos valores divergen sin intención. La solución actual (Paso C 3.3) hardcodea `#FF7A18` en `OnboardingProgress.tsx` para mantener comportamiento exacto.

**Acción requerida:** 
Decidir cuál es el naranja oficial FitGrowX y unificar. Probable solución: extender CSS vars con:
- `--accent-bright`: #FF7A18 (para progress bars, highlights)
- `--accent-medium`: #f06418 (para elementos secundarios)
- `--accent-deep`: #e05000 (para gradients, botones)

Luego migrar todos los hardcodes a CSS vars.

**Archivos afectados:**
- `/app/dashboard/page.tsx` (accent variable)
- `/app/dashboard/components/OnboardingProgress.tsx` (ACCENT_BAR constant)
- `/app/globals.css` (--accent definition)
- Diversos gradients con naranjas (#ff7a1a → #ff6000 → #e05000)

---

## 🎯 Features pendientes (próximo sprint)

### gymName: integración en 3 lugares

**Contexto:** El modal de bienvenida pre-dashboard ya captura `gymName`. La fuente de verdad está allá. Necesita propagarse a 3 ubicaciones:

**1. Sidebar logo clickeable**
- Envolver `"{gymName}"` + logo en `<Link href="/dashboard">` para que sea atajo al inicio
- Componente: probablemente `/app/dashboard/Sidebar.tsx` o similar
- Ventaja: uno-click volver al dashboard desde cualquier página

**2. Magic link del alumno via WhatsApp**
- El mensaje que recibe el alumno con el link debe incluir el nombre del gym
- Formato esperado: `"Accedé a {gymName}: [link]"`
- Pasar `gymName` al template del mensaje en la función que envía el WhatsApp
- Archivo probable: `/api/alumno/send-welcome` o similar

**3. Email de bienvenida (si existe)**
- Mismo patrón: `"Bienvenido a {gymName}"`

**Archivos a revisar:**
- Sidebar/layout donde se muestra gym name
- Funciones de envío de WhatsApp en `/api/`
- Templates de mensajes

---

### Modal de bienvenida pre-dashboard — verificación de lead capture

**Contexto:** Existen DOS modales distintos en el dashboard:

1. **Modal de bienvenida pre-dashboard** (anterior a dashboard page.tsx)
   - Captura: nombre del gym + teléfono del dueño
   - Propósito: gate de primer login + lead capture
   - Estado: ¿Bloqueante? ¿Se puede saltar?

2. **OnboardingModal con Rex** (refactoreado en Paso C 4/4)
   - NO captura data
   - Propósito: guía visual educativa de 5 pasos onboarding
   - Estado: ✅ Completo

**Verificaciones pendientes (NO bugs confirmados):**
- ¿El modal de bienvenida pre-dashboard es realmente bloqueante (no se puede saltar)?
- ¿Dónde guardan los datos capturados? (gym_settings, profiles, leads table?)
- ¿Sirve también como mecanismo de lead capture? Si el gym abandona después de este paso, ¿quedan datos para outreach manual?

**Archivos a revisar:**
- Modal pre-dashboard (probablemente en `/app/` raíz, no en `/app/dashboard/`)
- Lógica de guardado de datos capturados

---

## 📋 Deuda menor

### Test faltante: onEnterDemo callback
En `OnboardingProgress.test.tsx`, falta test que verifique que el botón "Ver demo" dispara el callback `onEnterDemo` correctamente.

**Descripción:**
```typescript
it('calls onEnterDemo when Ver demo button clicked', () => {
  const mockOnEnterDemo = vi.fn();
  const { container } = render(
    <OnboardingProgress demoMode={false} setup={incompleteSetup} onEnterDemo={mockOnEnterDemo} />
  );
  const demoButton = container.querySelector('button');
  demoButton?.click();
  expect(mockOnEnterDemo).toHaveBeenCalledOnce();
});
```

**Contexto:** La lógica existe y funciona (botón renderiza con `onClick={onEnterDemo}`), pero falta cobertura de test explícita.

---

## ✅ Completado

- **Paso A (Error boundary redesign):** error.tsx con card blanca + DinoSVG (WCAG AA contrast)
  - Commits: e1f3e67 (v2), amend
- **Paso B (Data loading error handling):** try/catch en ajustes/page.tsx Promise.all
  - Commit: 515ee13
- **Paso C 1.1 (getDinoState):** utility function & tests
  - Anteriormente integrado
- **Paso C 1.2 (DinoSVG):** Extracted to /components
  - Anteriormente completado
- **Paso C 2 (getPageMetrics refactor):** TBD
- **Paso C 3.1 (OnboardingProgress extraction):** ✅ Complete
  - Commit: 1f69222
- **Paso C 3.3 (OnboardingProgress component):** ✅ Complete (commit 1f69222)
  - File: `/app/dashboard/components/OnboardingProgress.tsx` (72 líneas)
  - Tests: 4 (render, null cases, href)
  - page.tsx: 1378 líneas (reducción de 64 líneas de IIFE)
  - Cambio: <a> → <Link> for SPA navigation

- **Paso C 3.4 (OnboardingMobileBanner component):** ✅ Complete (commit 4b8a96c)
  - File: `/app/dashboard/components/OnboardingMobileBanner.tsx` (68 líneas)
  - Tests: 4 (render, null cases, callback)
  - Mobile-only banner (mutually exclusive with OnboardingProgress)
  - Touch target 44px+ (12px padding per accessibility guidelines)
  - Pluralization: "1 cosa" vs "N cosas"
  - **Próximo paso:** Integrar en page.tsx (SOLO en mobile)

- **Paso C 4/4 (Suggestions component extraction):** ✅ Complete (commit c6b679b)
  - Files: 
    - `/app/dashboard/components/Suggestions.tsx` (174 líneas)
    - `/lib/dashboard-helpers.ts` — new `buildSuggestionItems()` + `SuggestionItem` interface with typed `key` field
    - `/tests/Suggestions.test.tsx` (7 tests)
  - Mobile variant: accordion with chevron ⌄, no lucide icons
  - Desktop variant: always expanded with lucide icons (Megaphone, Send, BadgeAlert, Clock, CheckCircle)
  - Icon mapping by stable `key` field (not title)
  - WhatsApp href: `/dashboard/ajustes?tab=conexiones` (corrected)
  - Unified title: "Sugerencias" in both viewports
  - Replaced `<a>` with `<Link>` from next/link
  - Removed `sugerOpen` state from page.tsx (now internal to component)
  - page.tsx: 1318 líneas (reducción de 71 líneas de IIFE)
  - **🎉 Bloque 2 — Paso C COMPLETADO. Paso D (cleanup/refactoring) pendiente.**
