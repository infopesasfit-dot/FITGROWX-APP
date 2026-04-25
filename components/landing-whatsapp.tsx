"use client";

import { useEffect, useRef, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";

const WA_NUMBER = process.env.NEXT_PUBLIC_FITGROWX_SUPPORT_WA ?? "5491100000000";
const WA_URL = `https://wa.me/${WA_NUMBER}?text=${encodeURIComponent("Hola! Vi los planes de FitGrowX y tengo una consulta antes de arrancar.")}`;

function WhatsAppIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" className={className} xmlns="http://www.w3.org/2000/svg">
      <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347z"/>
      <path d="M12 0C5.373 0 0 5.373 0 12c0 2.127.558 4.117 1.528 5.845L.057 23.887a.75.75 0 0 0 .921.921l6.086-1.461A11.945 11.945 0 0 0 12 24c6.627 0 12-5.373 12-12S18.627 0 12 0zm0 21.75a9.725 9.725 0 0 1-4.951-1.352l-.355-.21-3.676.882.895-3.617-.228-.37A9.712 9.712 0 0 1 2.25 12C2.25 6.615 6.615 2.25 12 2.25S21.75 6.615 21.75 12 17.385 21.75 12 21.75z"/>
    </svg>
  );
}

export function LandingWhatsApp() {
  const [showBubble, setShowBubble] = useState(false);
  const [dismissed, setDismissed] = useState(false);
  const hasCrossedPricing = useRef(false);
  const bubbleTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    const onScroll = () => {
      if (dismissed) return;

      const pricingEl = document.getElementById("planes");
      if (!pricingEl) return;

      const pricingTop = pricingEl.getBoundingClientRect().top;
      const viewportH = window.innerHeight;

      // Mark when user has scrolled past pricing
      if (pricingTop < viewportH * 0.5) {
        hasCrossedPricing.current = true;
      }

      // Trigger bubble when scrolled past pricing AND scrolled back up past it
      if (hasCrossedPricing.current && pricingTop > viewportH * 0.8 && !showBubble) {
        if (bubbleTimer.current) clearTimeout(bubbleTimer.current);
        bubbleTimer.current = setTimeout(() => setShowBubble(true), 400);
      }
    };

    window.addEventListener("scroll", onScroll, { passive: true });
    return () => {
      window.removeEventListener("scroll", onScroll);
      if (bubbleTimer.current) clearTimeout(bubbleTimer.current);
    };
  }, [dismissed, showBubble]);

  const handleDismiss = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setShowBubble(false);
    setDismissed(true);
  };

  return (
    <div className="fixed bottom-6 right-6 z-[9990] flex flex-col items-end gap-3">

      {/* Bubble */}
      <AnimatePresence>
        {showBubble && (
          <motion.div
            initial={{ opacity: 0, y: 10, scale: 0.92 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 8, scale: 0.94 }}
            transition={{ duration: 0.38, ease: [0.16, 1, 0.3, 1] }}
            className="relative max-w-[240px]"
          >
            {/* Card */}
            <div
              className="relative overflow-hidden rounded-2xl px-4 py-3.5"
              style={{
                background: "linear-gradient(160deg, rgba(22,22,28,0.98) 0%, rgba(12,12,16,0.99) 100%)",
                border: "1px solid rgba(255,255,255,0.08)",
                boxShadow:
                  "0 20px 48px rgba(0,0,0,0.5), " +
                  "0 4px 12px rgba(0,0,0,0.3), " +
                  "inset 0 1px 0 rgba(255,255,255,0.06)",
              }}
            >
              {/* Top highlight */}
              <span className="pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-white/[0.10] to-transparent" />

              {/* Close */}
              <button
                onClick={handleDismiss}
                className="absolute right-2.5 top-2.5 flex h-5 w-5 items-center justify-center rounded-full text-white/25 transition-colors hover:text-white/60"
                style={{ background: "rgba(255,255,255,0.05)" }}
              >
                <svg viewBox="0 0 10 10" className="h-2.5 w-2.5" fill="none" stroke="currentColor" strokeWidth="1.8">
                  <path d="M2 2l6 6M8 2l-6 6" />
                </svg>
              </button>

              {/* Avatar row */}
              <div className="mb-2.5 flex items-center gap-2.5 pr-4">
                <div
                  className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full"
                  style={{
                    background: "linear-gradient(135deg, #25D366, #128C7E)",
                    boxShadow: "0 0 12px rgba(37,211,102,0.3)",
                  }}
                >
                  <WhatsAppIcon className="h-4 w-4 text-white" />
                </div>
                <div>
                  <p className="text-[12px] font-semibold leading-none text-white">FitGrowX</p>
                  <p className="mt-0.5 text-[10px] text-white/35">Responde al instante</p>
                </div>
              </div>

              {/* Message */}
              <div
                className="rounded-xl rounded-tl-sm px-3 py-2.5"
                style={{
                  background: "rgba(255,255,255,0.045)",
                  border: "1px solid rgba(255,255,255,0.06)",
                }}
              >
                <p className="text-[12.5px] leading-relaxed text-white/80">
                  ¿Tenés dudas antes de arrancar?{" "}
                  <span className="text-white font-medium">Hablame y te cuento todo.</span>
                </p>
              </div>

              {/* Dot indicator */}
              <div className="mt-2 flex items-center gap-1 pl-1">
                <span className="h-1 w-1 rounded-full bg-[#25D366]" style={{ boxShadow: "0 0 4px rgba(37,211,102,0.6)" }} />
                <span className="text-[10px] text-white/28">En línea ahora</span>
              </div>
            </div>

            {/* Arrow pointing to button */}
            <div
              className="absolute -bottom-[6px] right-[22px] h-3 w-3 rotate-45"
              style={{
                background: "rgba(12,12,16,0.99)",
                border: "1px solid rgba(255,255,255,0.08)",
                borderTop: "none",
                borderLeft: "none",
              }}
            />
          </motion.div>
        )}
      </AnimatePresence>

      {/* WhatsApp FAB */}
      <motion.a
        href={WA_URL}
        target="_blank"
        rel="noopener noreferrer"
        onClick={() => { setShowBubble(false); setDismissed(true); }}
        className="relative flex h-14 w-14 items-center justify-center rounded-full"
        style={{
          background: "linear-gradient(145deg, #2BE560, #25D366, #1DA851)",
          boxShadow:
            "0 6px 24px rgba(37,211,102,0.4), " +
            "0 2px 8px rgba(0,0,0,0.3), " +
            "inset 0 1px 0 rgba(255,255,255,0.22)",
        }}
        whileHover={{ scale: 1.08 }}
        whileTap={{ scale: 0.95 }}
        transition={{ type: "spring", stiffness: 400, damping: 20 }}
      >
        {/* Pulse ring — visible solo cuando bubble está activo */}
        {showBubble && (
          <span
            className="absolute inset-0 rounded-full animate-ping"
            style={{ background: "rgba(37,211,102,0.25)" }}
          />
        )}
        <WhatsAppIcon className="h-7 w-7 text-white relative z-10" />
      </motion.a>

    </div>
  );
}
