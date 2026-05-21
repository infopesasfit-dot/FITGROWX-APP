"use client";

import Link from "next/link";
import type { SetupFlags } from "@/lib/dashboard-types";
import { DinoSVG } from "@/app/dashboard/components/DinoSVG";
import { getDinoState } from "@/lib/dashboard-helpers";

const ACCENT_BAR = "#FF7A18";

interface OnboardingProgressProps {
  demoMode: boolean;
  setup: SetupFlags | null;
  onEnterDemo: () => void;
}

export function OnboardingProgress({ demoMode, setup, onEnterDemo }: OnboardingProgressProps) {
  if (demoMode || !setup || Object.values(setup).every(Boolean)) return null;

  const tasks: { key: keyof typeof setup; label: string; desc: string; href: string; time: string }[] = [
    { key: "alumnos",  label: "Cargá tu primer alumno", desc: "El sistema cobra vida cuando hay gente adentro",  href: "/dashboard/alumnos", time: "1 min"  },
    { key: "planes",   label: "Creá un plan",           desc: "Definí qué incluye cada membresía y su precio",   href: "/dashboard/membresias",  time: "2 min"  },
    { key: "landing",  label: "Publicá tu landing",     desc: "Tu página para que te encuentren en el web",      href: "/dashboard/landing", time: "3 min"  },
    { key: "whatsapp", label: "Conectá WhatsApp",       desc: "Recordatorios y bienvenidas automáticas",         href: "/dashboard/ajustes?tab=conexiones", time: "2 min"  },
    { key: "pagos",    label: "Configurá pagos",        desc: "MercadoPago o datos de transferencia",            href: "/dashboard/ajustes?tab=conexiones", time: "2 min"  },
  ];

  const done      = tasks.filter(t => setup[t.key]).length;
  const nextTask  = tasks.find(t => !setup[t.key]);
  const dinoState = getDinoState(done);

  return (
    <div className="dashboard-card" style={{ padding: "14px 18px" }}>
      <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
        <div style={{ flexShrink: 0, lineHeight: 0 }}>
          <DinoSVG state={dinoState} pixelSize={3} />
        </div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 8 }}>
            {nextTask && (
              <span style={{ font: `600 0.66rem/1 var(--font-family-body)`, color: "#7C2D12", background: "rgba(124,45,18,0.10)", border: "1px solid rgba(124,45,18,0.20)", borderRadius: 999, padding: "3px 9px", whiteSpace: "nowrap" }}>
                PASO {done + 1}/5 · {nextTask.label} · {nextTask.time}
              </span>
            )}
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <div style={{ flex: 1, display: "flex", gap: 4 }}>
              {tasks.map((t, i) => (
                <div key={t.key} style={{ flex: 1, height: 4, borderRadius: 999, background: setup[t.key] ? "#22C55E" : i === done ? ACCENT_BAR : "rgba(0,0,0,0.10)" }} />
              ))}
            </div>
            <p style={{ font: `500 0.72rem/1 var(--font-family-body)`, color: "var(--color-text-3)", whiteSpace: "nowrap" }}>{done}/5 listos</p>
          </div>
        </div>
        {nextTask && (
          <Link
            href={nextTask.href}
            style={{ padding: "9px 18px", borderRadius: 10, background: "var(--color-text-1)", font: `600 0.78rem/1 var(--font-family-display)`, color: "white", cursor: "pointer", whiteSpace: "nowrap", flexShrink: 0, textDecoration: "none", display: "inline-flex", alignItems: "center", gap: 6 }}
          >
            Continuar
            <svg width="11" height="11" viewBox="0 0 12 12" fill="none"><path d="M2 6h8M6 2l4 4-4 4" stroke="white" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"/></svg>
          </Link>
        )}
      </div>
      <div style={{ marginTop: 12, paddingTop: 12, borderTop: "1px solid rgba(249,115,22,0.12)", display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12, flexWrap: "wrap" }}>
        <p style={{ font: `400 0.78rem/1.4 var(--font-family-display)`, color: "var(--color-text-2)" }}>
          ¿Querés ver cómo se vería tu dashboard con 50 alumnos?
        </p>
        <button
          onClick={onEnterDemo}
          style={{ display: "inline-flex", alignItems: "center", gap: 7, padding: "8px 16px", borderRadius: 10, border: "1.5px solid rgba(249,115,22,0.30)", background: "white", color: "#C2410C", font: `700 0.78rem/1 var(--font-family-display)`, cursor: "pointer", whiteSpace: "nowrap", flexShrink: 0 }}
        >
          <span>👁</span> Ver demo
        </button>
      </div>
    </div>
  );
}
