"use client";

import { motion, type Variants } from "framer-motion";
import {
  MessageCircleMore, CreditCard, ScanLine, LayoutDashboard, Users,
} from "lucide-react";

const EASE: [number, number, number, number] = [0.16, 1, 0.3, 1];
const FM = "var(--font-mono,'JetBrains Mono',monospace)";
const ORANGE = "#FF6A00";

const headV: Variants = {
  hidden: { opacity: 0, y: 20 },
  visible: { opacity: 1, y: 0, transition: { duration: 0.75, ease: EASE } },
};
const stagger: Variants = {
  hidden: {},
  visible: { transition: { staggerChildren: 0.09, delayChildren: 0.1 } },
};
const cardV: Variants = {
  hidden: { opacity: 0, y: 28, filter: "blur(8px)" },
  visible: { opacity: 1, y: 0, filter: "blur(0px)", transition: { duration: 0.78, ease: EASE } },
};

const glass: React.CSSProperties = {
  background: "rgba(6,6,10,0.82)",
  backdropFilter: "blur(28px)",
  WebkitBackdropFilter: "blur(28px)",
  border: "1px solid rgba(255,255,255,0.07)",
  boxShadow: "inset 0 1px 0 rgba(255,255,255,0.05), inset 0 -1px 0 rgba(0,0,0,0.18), 0 24px 56px rgba(0,0,0,0.45)",
};

/* ── Mini decorations ───────────────────────────────────────────── */

function ChatBubbles() {
  const msgs = [
    { from: "lead", text: "Hola, quiero info sobre clases 👋" },
    { from: "bot",  text: "¡Hola! Te mando los horarios ahora 🚀" },
    { from: "bot",  text: "También tenés 3 días gratis para probar 🎯" },
  ];
  return (
    <div className="flex flex-col gap-2 mt-5">
      {msgs.map((m, i) => (
        <motion.div
          key={i}
          initial={{ opacity: 0, x: m.from === "lead" ? -10 : 10 }}
          whileInView={{ opacity: 1, x: 0 }}
          viewport={{ once: true }}
          transition={{ delay: 0.3 + i * 0.18, duration: 0.5, ease: EASE }}
          className={`flex ${m.from === "bot" ? "justify-end" : "justify-start"}`}
        >
          <span
            className="rounded-2xl px-3 py-2 text-[11.5px] leading-snug max-w-[80%]"
            style={{
              background: m.from === "lead" ? "rgba(255,255,255,0.07)" : `rgba(255,106,0,0.18)`,
              color: m.from === "lead" ? "rgba(255,255,255,0.65)" : "rgba(255,255,255,0.85)",
              border: m.from === "bot" ? `1px solid rgba(255,106,0,0.22)` : "1px solid rgba(255,255,255,0.05)",
            }}
          >
            {m.text}
          </span>
        </motion.div>
      ))}
    </div>
  );
}

function MetricRows() {
  const rows = [
    { label: "Alumnos activos", value: "142", up: true },
    { label: "Cobros este mes",  value: "$890K", up: true },
    { label: "Leads en curso",   value: "23",   up: false },
    { label: "Clases hoy",       value: "6",    up: true },
  ];
  return (
    <div className="flex flex-col gap-2.5 mt-5">
      {rows.map((r, i) => (
        <motion.div
          key={r.label}
          initial={{ opacity: 0, x: -8 }}
          whileInView={{ opacity: 1, x: 0 }}
          viewport={{ once: true }}
          transition={{ delay: 0.2 + i * 0.1, duration: 0.5, ease: EASE }}
          className="flex items-center justify-between rounded-xl px-3 py-2"
          style={{ background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.05)" }}
        >
          <span className="text-[11px] text-white/45">{r.label}</span>
          <span className="text-[12px] font-semibold text-white/85" style={{ fontFamily: FM }}>{r.value}</span>
        </motion.div>
      ))}
    </div>
  );
}

function PaymentToast() {
  const payments = [
    { name: "Tomás G.", amount: "$4.500", ago: "hace 2 min" },
    { name: "Lucía M.", amount: "$6.200", ago: "hace 18 min" },
    { name: "Marcos D.", amount: "$4.500", ago: "hace 1 h" },
  ];
  return (
    <div className="flex flex-col gap-2 mt-5">
      {payments.map((p, i) => (
        <motion.div
          key={p.name}
          initial={{ opacity: 0, y: 6 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ delay: 0.25 + i * 0.14, duration: 0.5, ease: EASE }}
          className="flex items-center gap-3 rounded-xl px-3 py-2.5"
          style={{ background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.05)" }}
        >
          <div className="h-6 w-6 rounded-full flex items-center justify-center flex-shrink-0"
            style={{ background: "rgba(34,197,94,0.14)", border: "1px solid rgba(34,197,94,0.22)" }}>
            <div className="h-1.5 w-1.5 rounded-full bg-green-400" />
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-[11.5px] text-white/75 truncate">{p.name}</p>
            <p className="text-[10px] text-white/35">{p.ago}</p>
          </div>
          <span className="text-[12px] font-semibold text-white/80 flex-shrink-0" style={{ fontFamily: FM }}>{p.amount}</span>
        </motion.div>
      ))}
    </div>
  );
}

function CheckinVisual() {
  return (
    <div className="flex flex-col items-center gap-3 mt-5">
      {/* QR frame */}
      <div className="relative w-20 h-20 rounded-2xl flex items-center justify-center"
        style={{ background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.09)" }}>
        <div className="grid grid-cols-3 gap-[3px]">
          {Array.from({ length: 9 }).map((_, i) => (
            <div key={i} className="w-3.5 h-3.5 rounded-[3px]"
              style={{ background: [0,2,6,8].includes(i) ? "rgba(255,106,0,0.8)" : "rgba(255,255,255,0.15)" }} />
          ))}
        </div>
        {/* scan line */}
        <motion.div
          className="absolute inset-x-1 h-[1.5px] rounded-full"
          style={{ background: `linear-gradient(90deg, transparent, ${ORANGE}, transparent)` }}
          animate={{ top: ["15%", "80%", "15%"] }}
          transition={{ duration: 2.2, repeat: Infinity, ease: "easeInOut" }}
        />
      </div>
      <p className="text-[11px] text-white/40 tracking-wide">Escaneá · Entrá · Listo</p>
    </div>
  );
}

/* ── Main component ─────────────────────────────────────────────── */

export function BenefitsSection() {
  return (
    <section id="beneficios" className="scroll-mt-24 relative py-20 lg:py-32">
      <div className="mx-auto max-w-7xl px-6 lg:px-10">

        {/* Header */}
        <motion.div
          className="mb-12 lg:mb-16"
          variants={headV}
          initial="hidden"
          whileInView="visible"
          viewport={{ once: true, amount: 0.5 }}
        >
          <div className="inline-flex items-center gap-2 rounded-full border border-[#FF6A00]/20 bg-[#FF6A00]/5 px-4 py-1.5 mb-5">
            <span className="h-1.5 w-1.5 rounded-full" style={{ background: ORANGE }} />
            <span className="text-[10px] font-black uppercase tracking-[0.28em] text-[#FF6A00]">Producto</span>
          </div>
          <h2 className="text-3xl sm:text-4xl lg:text-5xl font-semibold tracking-[-0.05em] text-white leading-[1.06] max-w-xl">
            Un sistema que trabaja<br />
            <span className="text-white/40">mientras vos entrenás.</span>
          </h2>
        </motion.div>

        {/* Bento grid */}
        <motion.div
          variants={stagger}
          initial="hidden"
          whileInView="visible"
          viewport={{ once: true, amount: 0.15 }}
          className="grid grid-cols-1 md:grid-cols-3 gap-4 auto-rows-auto"
        >

          {/* A — Hero: WhatsApp flows (2 cols) */}
          <motion.article
            variants={cardV}
            className="md:col-span-2 rounded-[1.75rem] p-6 lg:p-7 relative overflow-hidden"
            style={glass}
          >
            <span className="pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-white/[0.10] to-transparent" />
            <div className="absolute -top-20 -left-20 w-60 h-60 rounded-full pointer-events-none"
              style={{ background: `radial-gradient(circle, rgba(255,106,0,0.10) 0%, transparent 70%)` }} />
            <div className="relative z-10">
              <div className="inline-flex h-10 w-10 items-center justify-center rounded-2xl mb-4"
                style={{ background: "rgba(255,106,0,0.12)", border: "1px solid rgba(255,106,0,0.20)" }}>
                <MessageCircleMore className="h-5 w-5" style={{ color: ORANGE }} />
              </div>
              <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-white/35 mb-1">WhatsApp Automation</p>
              <h3 className="text-xl font-semibold tracking-tight text-white leading-snug">
                Cada lead entra en<br />un flujo automático.
              </h3>
              <ChatBubbles />
            </div>
          </motion.article>

          {/* B — Dashboard metrics (1 col, tall / md:row-span-2) */}
          <motion.article
            variants={cardV}
            className="md:row-span-2 rounded-[1.75rem] p-6 lg:p-7 relative overflow-hidden"
            style={glass}
          >
            <span className="pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-white/[0.10] to-transparent" />
            <div className="relative z-10">
              <div className="inline-flex h-10 w-10 items-center justify-center rounded-2xl mb-4"
                style={{ background: "rgba(99,102,241,0.12)", border: "1px solid rgba(99,102,241,0.20)" }}>
                <LayoutDashboard className="h-5 w-5 text-indigo-400" />
              </div>
              <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-white/35 mb-1">Panel en tiempo real</p>
              <h3 className="text-xl font-semibold tracking-tight text-white leading-snug">
                Sabés exactamente<br />cómo está tu gym.
              </h3>
              <MetricRows />

              {/* Big stat */}
              <div className="mt-6 pt-5 border-t border-white/[0.06]">
                <p className="text-[42px] font-bold text-white leading-none tracking-[-0.05em]" style={{ fontFamily: FM }}>142</p>
                <p className="text-[11px] text-white/35 mt-1 uppercase tracking-wider">alumnos activos</p>
                <div className="mt-4 flex items-center gap-1.5">
                  <Users className="h-3.5 w-3.5 text-emerald-400" />
                  <span className="text-[11px] text-emerald-400">+12 este mes</span>
                </div>
              </div>
            </div>
          </motion.article>

          {/* C — Cobros automáticos */}
          <motion.article
            variants={cardV}
            className="rounded-[1.75rem] p-6 lg:p-7 relative overflow-hidden"
            style={glass}
          >
            <span className="pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-white/[0.10] to-transparent" />
            <div className="relative z-10">
              <div className="inline-flex h-10 w-10 items-center justify-center rounded-2xl mb-4"
                style={{ background: "rgba(34,197,94,0.10)", border: "1px solid rgba(34,197,94,0.18)" }}>
                <CreditCard className="h-5 w-5 text-emerald-400" />
              </div>
              <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-white/35 mb-1">Cobros</p>
              <h3 className="text-xl font-semibold tracking-tight text-white leading-snug">
                Cobrás sin<br />pedir por favor.
              </h3>
              <PaymentToast />
            </div>
          </motion.article>

          {/* D — Check-in */}
          <motion.article
            variants={cardV}
            className="rounded-[1.75rem] p-6 lg:p-7 relative overflow-hidden"
            style={glass}
          >
            <span className="pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-white/[0.10] to-transparent" />
            <div className="relative z-10">
              <div className="inline-flex h-10 w-10 items-center justify-center rounded-2xl mb-4"
                style={{ background: "rgba(255,106,0,0.10)", border: "1px solid rgba(255,106,0,0.18)" }}>
                <ScanLine className="h-5 w-5" style={{ color: ORANGE }} />
              </div>
              <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-white/35 mb-1">Check-in & Clases</p>
              <h3 className="text-xl font-semibold tracking-tight text-white leading-snug">
                Operación<br />sin papel.
              </h3>
              <CheckinVisual />
            </div>
          </motion.article>

        </motion.div>
      </div>
    </section>
  );
}
