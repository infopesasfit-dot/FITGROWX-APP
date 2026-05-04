"use client";

import { useEffect, useRef, useState } from "react";
import { motion } from "framer-motion";

const EASE: [number, number, number, number] = [0.16, 1, 0.3, 1];
const FM = "var(--font-mono,'JetBrains Mono',monospace)";

/* ── Count-up hook ──────────────────────────────────────────────── */
function useCountUp(target: number, duration = 1400) {
  const [val, setVal] = useState(0);
  const fired = useRef(false);
  const elRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const el = elRef.current;
    if (!el) return;
    const obs = new IntersectionObserver(
      ([entry]) => {
        if (!entry.isIntersecting || fired.current) return;
        fired.current = true;
        const t0 = performance.now();
        const tick = (now: number) => {
          const p = Math.min((now - t0) / duration, 1);
          const eased = 1 - Math.pow(1 - p, 4);
          setVal(Math.round(eased * target));
          if (p < 1) requestAnimationFrame(tick);
        };
        requestAnimationFrame(tick);
      },
      { threshold: 0.5 }
    );
    obs.observe(el);
    return () => obs.disconnect();
  }, [target, duration]);

  return { val, elRef };
}

/* ── Stat with count-up ─────────────────────────────────────────── */
function Stat({ value, prefix = "", suffix = "", label }: {
  value: number; prefix?: string; suffix?: string; label: string;
}) {
  const { val, elRef } = useCountUp(value);
  return (
    <div ref={elRef} className="flex flex-col items-center gap-2 text-center">
      <p
        className="text-[3.2rem] sm:text-[4rem] font-extralight tracking-[-0.06em] text-white leading-none"
        style={{ fontFamily: FM }}
      >
        {prefix}{val}{suffix}
      </p>
      <p className="text-[12px] font-medium uppercase tracking-[0.18em] text-white/35">{label}</p>
    </div>
  );
}


/* ── Main ───────────────────────────────────────────────────────── */
export function BenefitsSection() {
  return (
    <section id="beneficios" className="scroll-mt-24 relative py-20 lg:py-32">
      <div className="mx-auto max-w-7xl px-6 lg:px-10">

        {/* Header — same style as pricing section */}
        <motion.div
          className="mx-auto max-w-3xl text-center mb-16 lg:mb-20"
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, amount: 0.5 }}
          transition={{ duration: 0.75, ease: EASE }}
        >
          <h2 className="text-[10px] font-semibold uppercase tracking-[0.25em] text-[#FF8C3A] mb-5">Producto</h2>
          <p className="text-3xl sm:text-4xl lg:text-5xl font-extralight tracking-[-0.05em] text-white leading-[1.08]">
            Resultados reales.{" "}
            <span className="text-white/35">No solo tecnología.</span>
          </p>
        </motion.div>

        {/* Count-up stats row */}
        <motion.div
          className="grid grid-cols-2 md:grid-cols-4 gap-8 mb-16 lg:mb-20"
          initial={{ opacity: 0, y: 16 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, amount: 0.4 }}
          transition={{ duration: 0.8, ease: EASE, delay: 0.1 }}
        >
          <Stat value={98}  suffix="%" label="Retención" />
          <Stat value={24}  suffix="/7"  label="Tu negocio activo" />
          <Stat value={200} prefix="+" label="Alumnos migrados en 1 clic" />
          <Stat value={0}   suffix="%" label="Fricción en cobros" />
        </motion.div>


      </div>
    </section>
  );
}
