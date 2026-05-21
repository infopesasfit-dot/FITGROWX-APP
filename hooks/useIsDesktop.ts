import { useState, useEffect } from "react";

/**
 * Hook que detecta si el viewport es de desktop (≥ 768px).
 * Escucha cambios de resize y actualiza en tiempo real.
 */
export function useIsDesktop(): boolean {
  const [isDesktop, setIsDesktop] = useState(false);

  useEffect(() => {
    const check = () => setIsDesktop(window.innerWidth >= 768);
    check();
    window.addEventListener("resize", check);
    return () => window.removeEventListener("resize", check);
  }, []);

  return isDesktop;
}
