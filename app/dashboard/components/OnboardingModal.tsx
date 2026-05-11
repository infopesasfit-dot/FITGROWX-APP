"use client";

import { useState } from "react";
import { X, ArrowRight, ArrowLeft, ExternalLink } from "lucide-react";
import { useRouter } from "next/navigation";

const fd = "var(--font-inter, 'Inter', sans-serif)";

const DINO_SRCS: Record<"flaco" | "normal" | "jacked", string> = {
  flaco:  "/images/rex-state-one.png",
  normal: "/images/rex-state-two.png",
  jacked: "/images/rex-state-final.png",
};

const DINO_ANIMS: Record<"flaco" | "normal" | "jacked", string> = {
  flaco:  "rex-sad",
  normal: "rex-fight",
  jacked: "rex-celebrate",
};

const DINO_CSS = `
  @keyframes rex-sad {
    0%, 100% { transform: translateY(0) rotate(-1deg); }
    50%       { transform: translateY(-3px) rotate(1deg); }
  }
  @keyframes rex-fight {
    0%, 100% { transform: translateY(0) rotate(0deg); }
    25%      { transform: translateY(-5px) rotate(2deg); }
    75%      { transform: translateY(-3px) rotate(-2deg); }
  }
  @keyframes rex-celebrate {
    0%, 100% { transform: translateY(0) scale(1); }
    30%      { transform: translateY(-10px) scale(1.06) rotate(-3deg); }
    60%      { transform: translateY(-5px) scale(1.03) rotate(3deg); }
  }
  .rex-sad      { animation: rex-sad      2.4s ease-in-out infinite; }
  .rex-fight    { animation: rex-fight    1.1s ease-in-out infinite; }
  .rex-celebrate{ animation: rex-celebrate 0.75s ease-in-out infinite; }
`;

export function DinoSVG({
  state,
  pixelSize = 6,
}: {
  state: "flaco" | "normal" | "jacked";
  pixelSize?: number;
}) {
  const size = pixelSize * 16;
  return (
    <>
      <style>{DINO_CSS}</style>
      <div className={DINO_ANIMS[state]} style={{ width: size, height: size, flexShrink: 0 }}>
        <img
          src={DINO_SRCS[state]}
          alt="Rex"
          style={{ width: "100%", height: "100%", objectFit: "contain", imageRendering: "pixelated", display: "block" }}
        />
      </div>
    </>
  );
}

export function getDinoState(completedCount: number): "flaco" | "normal" | "jacked" {
  if (completedCount <= 1) return "flaco";
  if (completedCount <= 3) return "normal";
  return "jacked";
}

interface DialogStep {
  label?: string;
  text: string;
  href?: string;
  cta?: string;
  dinoState: "flaco" | "normal" | "jacked";
}

const STEPS: DialogStep[] = [
  {
    text: "¡Hola! Soy Rex 👋\n\nEstoy flaco porque tu gym todavía no está configurado...\n\n¡Ayudame a crecer y juntos vamos a hacer crecer tu negocio!",
    dinoState: "flaco",
  },
  {
    label: "Paso 1 · Cargá tus alumnos",
    text: "Sin alumnos no hay gym 🏋️\n\nImportá tu base existente con un Excel o agregalos uno por uno. El sistema cobra vida cuando hay gente adentro.",
    href: "/dashboard/alumnos",
    cta: "Ir a Alumnos",
    dinoState: "flaco",
  },
  {
    label: "Paso 2 · Armá tus planes",
    text: "Los planes definen qué incluye cada membresía y cuánto cuesta 📋\n\nCon esto el sistema rastrea vencimientos y cobros automáticamente.",
    href: "/dashboard/planes",
    cta: "Crear Planes",
    dinoState: "flaco",
  },
  {
    label: "Paso 3 · Publicá tu landing",
    text: "Tu landing es tu vidriera digital 🌐\n\nCualquiera puede encontrar tu gym, dejar sus datos y agendar una clase de prueba. Sin que vos hagas nada.",
    href: "/dashboard/landing",
    cta: "Configurar Landing",
    dinoState: "normal",
  },
  {
    label: "Paso 4 · Conectá WhatsApp",
    text: "Con WhatsApp conectado, los mensajes van solos 💬\n\nRecordatorios de vencimiento, seguimiento de prospectos y bienvenida automática.",
    href: "/dashboard/ajustes",
    cta: "Conectar WhatsApp",
    dinoState: "normal",
  },
  {
    label: "Paso 5 · Configurá los pagos",
    text: "Cerrá el ciclo de cobranza 💰\n\nConectá MercadoPago para cobro online, o dejá los datos de tu cuenta para que los alumnos sepan a dónde transferir.",
    href: "/dashboard/ajustes",
    cta: "Configurar Pagos",
    dinoState: "jacked",
  },
  {
    text: "¡LISTO! ¡Estoy JACKED! 💪\n\nTu gym está configurado y listo para crecer. El checklist en el dashboard te muestra cómo evoluciono a medida que completás los pasos.",
    dinoState: "jacked",
  },
];

interface OnboardingModalProps {
  open: boolean;
  onClose: () => void;
}

export function OnboardingModal({ open, onClose }: OnboardingModalProps) {
  const [step, setStep] = useState(0);
  const router = useRouter();

  if (!open) return null;

  const current = STEPS[step];
  const isLast = step === STEPS.length - 1;
  const isFirst = step === 0;

  function handleCta() {
    onClose();
    router.push(current.href!);
  }

  return (
    <div
      onClick={onClose}
      style={{
        position: "fixed", inset: 0, zIndex: 9999,
        background: "rgba(0,0,0,0.55)", backdropFilter: "blur(6px)",
        display: "flex", alignItems: "center", justifyContent: "center", padding: 20,
      }}
    >
      <div
        onClick={e => e.stopPropagation()}
        style={{
          background: "#FFFFFF", borderRadius: 28,
          width: "100%", maxWidth: 500,
          padding: "24px 24px 20px", position: "relative",
          boxShadow: "0 32px 80px rgba(0,0,0,0.22)",
          display: "flex", flexDirection: "column", gap: 18,
        }}
      >
        {/* Close */}
        <button
          onClick={onClose}
          style={{
            position: "absolute", top: 14, right: 14,
            width: 30, height: 30, borderRadius: 999,
            background: "#F3F4F6", border: "none", cursor: "pointer",
            display: "flex", alignItems: "center", justifyContent: "center", color: "#9CA3AF",
          }}
        >
          <X size={14} />
        </button>

        {/* Progress dots */}
        <div style={{ display: "flex", gap: 5, justifyContent: "center", paddingRight: 30 }}>
          {STEPS.map((_, i) => (
            <div
              key={i}
              style={{
                height: 4,
                width: i === step ? 24 : 6,
                borderRadius: 999,
                background: i <= step ? "#F97316" : "#E5E7EB",
                opacity: i < step ? 0.35 : 1,
                transition: "all 0.3s ease",
              }}
            />
          ))}
        </div>

        {/* Dino + speech bubble */}
        <div style={{ display: "flex", gap: 16, alignItems: "flex-end" }}>
          <div style={{ flexShrink: 0, transition: "opacity 0.2s ease" }}>
            <DinoSVG state={current.dinoState} pixelSize={9} />
          </div>
          <div
            style={{
              background: "#FFF7ED",
              border: "1.5px solid rgba(249,115,22,0.2)",
              borderRadius: "16px 16px 16px 4px",
              padding: "14px 16px", flex: 1, minHeight: 96,
            }}
          >
            {current.label && (
              <p
                style={{
                  font: `700 0.68rem/1 ${fd}`, color: "#F97316",
                  textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: 8,
                }}
              >
                {current.label}
              </p>
            )}
            <p style={{ font: `500 0.87rem/1.55 ${fd}`, color: "#1A1D23", whiteSpace: "pre-line" }}>
              {current.text}
            </p>
          </div>
        </div>

        {/* Nav */}
        <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
          {!isFirst && (
            <button
              onClick={() => setStep(s => s - 1)}
              style={{
                width: 36, height: 36, borderRadius: 10, background: "#F3F4F6",
                border: "none", cursor: "pointer", display: "flex",
                alignItems: "center", justifyContent: "center", color: "#6B7280", flexShrink: 0,
              }}
            >
              <ArrowLeft size={14} />
            </button>
          )}
          <div style={{ flex: 1 }} />
          {current.href && (
            <button
              onClick={handleCta}
              style={{
                padding: "9px 16px", borderRadius: 12,
                background: "rgba(249,115,22,0.08)", border: "1.5px solid rgba(249,115,22,0.2)",
                font: `600 0.8rem/1 ${fd}`, color: "#F97316", cursor: "pointer",
                display: "flex", alignItems: "center", gap: 6,
              }}
            >
              {current.cta} <ExternalLink size={12} />
            </button>
          )}
          <button
            onClick={() => (isLast ? onClose() : setStep(s => s + 1))}
            style={{
              padding: "9px 20px", borderRadius: 12, background: "#F97316", border: "none",
              font: `700 0.86rem/1 ${fd}`, color: "white", cursor: "pointer",
              display: "flex", alignItems: "center", gap: 7,
            }}
          >
            {isLast ? "¡Empecemos!" : isFirst ? "¡Vamos!" : "Siguiente"}
            <ArrowRight size={14} />
          </button>
        </div>
      </div>
    </div>
  );
}
