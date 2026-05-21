'use client';

interface OwnerPhoneAlertProps {
  ownerPhoneMissing: boolean;
  demoMode: boolean;
}

export function OwnerPhoneAlert({ ownerPhoneMissing, demoMode }: OwnerPhoneAlertProps) {
  if (!ownerPhoneMissing || demoMode) return null;

  return (
    <a
      href="/dashboard/ajustes"
      style={{
        display: "flex",
        alignItems: "center",
        gap: 12,
        padding: "12px 16px",
        borderRadius: 14,
        textDecoration: "none",
        background: "rgba(234,179,8,0.07)",
        border: "1px solid rgba(234,179,8,0.25)",
      }}
    >
      <span style={{ fontSize: "1rem", flexShrink: 0 }}>⚠️</span>
      <div style={{ flex: 1 }}>
        <p style={{ font: `600 0.82rem/1.3 var(--font-family-display)`, color: "#111827", margin: 0 }}>
          Falta tu número de WhatsApp
        </p>
        <p style={{ font: `400 0.74rem/1.4 var(--font-family-display)`, color: "#1F2937", margin: 0 }}>
          Sin él, las alertas de pagos, socios en riesgo y transferencias pendientes no te llegan. Agregalo en Ajustes →
        </p>
      </div>
    </a>
  );
}
