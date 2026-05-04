"use client";

import { motion } from "framer-motion";
import { Play } from "lucide-react";

const EASE: [number, number, number, number] = [0.16, 1, 0.3, 1];

const GRAIN =
  "url(\"data:image/svg+xml,%3Csvg viewBox='0 0 256 256' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.80' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)'/%3E%3C/svg%3E\")";

export function VideoSection() {
  return (
    <section id="demo" className="scroll-mt-24 relative py-20 lg:py-32">
      <div className="mx-auto max-w-5xl px-6 lg:px-10">

        {/* Header */}
        <motion.div
          className="text-center mb-12 lg:mb-16"
          initial={{ opacity: 0, y: 18 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, amount: 0.5 }}
          transition={{ duration: 0.75, ease: EASE }}
        >
          <p className="text-[10px] font-semibold uppercase tracking-[0.25em] text-[#FF8C3A] mb-4">Demo</p>
          <h2 className="text-3xl sm:text-4xl lg:text-5xl font-extralight tracking-[-0.05em] text-white leading-[1.08]">
            Mirá cómo funciona{" "}
            <span className="text-white/35">por dentro.</span>
          </h2>
        </motion.div>

        {/* Video placeholder */}
        <motion.div
          initial={{ opacity: 0, scale: 0.97 }}
          whileInView={{ opacity: 1, scale: 1 }}
          viewport={{ once: true, amount: 0.25 }}
          transition={{ duration: 0.85, ease: EASE, delay: 0.1 }}
          className="relative"
        >
          {/* Outer glow */}
          <div
            className="absolute -inset-px rounded-[2rem] pointer-events-none"
            style={{
              boxShadow: "0 0 80px rgba(255,96,0,0.12), 0 32px 80px rgba(0,0,0,0.6)",
            }}
          />

          {/* Video frame — 16:9 */}
          <div
            className="relative w-full overflow-hidden rounded-[2rem]"
            style={{
              paddingBottom: "56.25%",
              background: "linear-gradient(160deg, rgba(255,255,255,0.04) 0%, rgba(0,0,0,0.80) 100%)",
              border: "1px solid rgba(255,106,0,0.30)",
              backdropFilter: "blur(20px)",
              WebkitBackdropFilter: "blur(20px)",
            }}
          >
            {/* Grain */}
            <div
              className="absolute inset-0 pointer-events-none mix-blend-soft-light"
              style={{ backgroundImage: GRAIN, backgroundSize: "180px 180px", opacity: 0.14 }}
            />

            {/* Top sheen */}
            <div
              className="absolute inset-x-0 top-0 h-px pointer-events-none"
              style={{
                background: "linear-gradient(90deg, transparent, rgba(255,255,255,0.12) 40%, rgba(255,255,255,0.12) 60%, transparent)",
              }}
            />

            {/* Play button */}
            <div className="absolute inset-0 flex flex-col items-center justify-center gap-5">
              <div
                className="flex h-16 w-16 sm:h-20 sm:w-20 items-center justify-center rounded-full"
                style={{
                  background: "rgba(255,106,0,0.12)",
                  border: "1px solid rgba(255,106,0,0.30)",
                  boxShadow: "0 0 40px rgba(255,96,0,0.18)",
                }}
              >
                <Play className="h-6 w-6 sm:h-7 sm:w-7 text-[#FF8C3A]" fill="currentColor" style={{ marginLeft: 3 }} />
              </div>
              <p className="text-[11px] font-medium uppercase tracking-[0.22em] text-white/25">
                Video próximamente
              </p>
            </div>

            {/* Reflection */}
            <div
              aria-hidden
              className="absolute inset-x-0 bottom-0 h-24 pointer-events-none"
              style={{
                background: "linear-gradient(to top, rgba(255,106,0,0.04), transparent)",
              }}
            />
          </div>

          {/* Mirror reflection */}
          <div
            aria-hidden
            className="pointer-events-none select-none overflow-hidden rounded-[2rem]"
            style={{
              marginTop: 2,
              height: 60,
              background: "linear-gradient(160deg, rgba(255,255,255,0.04) 0%, rgba(0,0,0,0.80) 100%)",
              border: "1px solid rgba(255,106,0,0.30)",
              transform: "scaleY(-1)",
              maskImage: "linear-gradient(to bottom, rgba(0,0,0,0.20) 0%, transparent 100%)",
              WebkitMaskImage: "linear-gradient(to bottom, rgba(0,0,0,0.20) 0%, transparent 100%)",
            }}
          />
        </motion.div>

      </div>
    </section>
  );
}
