"use client";

import type { SetupFlags } from "@/lib/dashboard-types";
import { DinoSVG } from "@/app/dashboard/components/DinoSVG";
import { getDinoState } from "@/lib/dashboard-helpers";

interface OnboardingMobileBannerProps {
  demoMode: boolean;
  setup: SetupFlags | null;
  onOpenModal: () => void;
}

export function OnboardingMobileBanner({ demoMode, setup, onOpenModal }: OnboardingMobileBannerProps) {
  if (demoMode || !setup || Object.values(setup).every(Boolean)) return null;

  const totalTasks = 5;
  const done = Object.values(setup).filter(Boolean).length;
  const remaining = totalTasks - done;
  const dinoState = getDinoState(done);
  const cosaLabel = remaining === 1 ? "cosa" : "cosas";

  return (
    <div className="dashboard-card" style={{ padding: "16px 18px" }}>
      <div style={{
        display: "flex",
        flexDirection: "column",
        gap: 14,
      }}>
        {/* Dino + Título */}
        <div style={{ display: "flex", gap: 12, alignItems: "flex-start" }}>
          <div style={{ flexShrink: 0, lineHeight: 0 }}>
            <DinoSVG state={dinoState} pixelSize={2.5} />
          </div>
          <h3 style={{ font: `600 0.9rem/1.2 var(--font-family-display)`, color: "var(--color-text-1)", margin: 0 }}>
            ¡Casi listo!
          </h3>
        </div>

        {/* Texto */}
        <p style={{ font: `400 0.8rem/1.4 var(--font-family-body)`, color: "var(--color-text-2)", margin: 0 }}>
          Te faltan {remaining} {cosaLabel} para que FitGrowX pueda ayudarte a hacer crecer tu gym.
        </p>

        {/* Botón */}
        <button
          onClick={onOpenModal}
          style={{
            padding: "12px 18px",
            borderRadius: 10,
            background: "var(--color-text-1)",
            border: "none",
            font: `600 0.78rem/1 var(--font-family-display)`,
            color: "white",
            cursor: "pointer",
            whiteSpace: "nowrap",
            display: "inline-flex",
            alignItems: "center",
            gap: 6,
          }}
        >
          Continuar setup
          <svg width="11" height="11" viewBox="0 0 12 12" fill="none">
            <path d="M2 6h8M6 2l4 4-4 4" stroke="white" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </button>
      </div>
    </div>
  );
}
