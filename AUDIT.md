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

## ✅ Completado

- **Paso A (Error boundary redesign):** error.tsx con card blanca + DinoSVG (WCAG AA contrast)
- **Paso B (Data loading error handling):** try/catch en ajustes/page.tsx Promise.all
- **Paso C 1.1 (getDinoState):** utility function & tests
- **Paso C 1.2 (OnboardingProgress & DinoSVG):** Extracted components
- **Paso C 2 (getPageMetrics refactor):** TBD
- **Paso C 3.1 (OnboardingProgress extraction):** ✅ Complete
- **Paso C 3.3 (OnboardingProgress component):** ✅ Complete
