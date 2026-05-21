# 🔍 AUDIT — Deuda Técnica & Mejoras Futuras

## 🔮 Mejoras futuras

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
