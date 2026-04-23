"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import {
  Bitcoin,
  CheckCircle,
  Clock,
  CreditCard,
  LogOut,
  Shield,
  Zap,
} from "lucide-react";
import { supabase } from "@/lib/supabase";

const fd = "var(--font-nunito, 'Nunito', sans-serif)";
const fb = "var(--font-inter, 'Inter', sans-serif)";
const t1 = "#1A1D23";
const t2 = "#6B7280";
const t3 = "#9CA3AF";
const ACCENT = "#C97436";

type PlanCheckoutProps = {
  planName: string;
  priceLabel: string;
  monthlyLabel: string;
  description: string;
  features: string[];
  whatsappMessage: string;
  mpLink: string;
  usdtAmount: string;
  btcAmountLabel: string;
};

const card: React.CSSProperties = {
  background: "#FFFFFF",
  border: "1px solid rgba(0,0,0,0.07)",
  borderRadius: 18,
  boxShadow: "0 4px 20px rgba(0,0,0,0.07), 0 0 1px rgba(0,0,0,0.04)",
};

const USDT_ADDR = process.env.NEXT_PUBLIC_FITGROWX_USDT_ADDR ?? "TRX_ADDRESS_PLACEHOLDER";
const BTC_ADDR = process.env.NEXT_PUBLIC_FITGROWX_BTC_ADDR ?? "BTC_ADDRESS_PLACEHOLDER";
const SUPPORT_WA = process.env.NEXT_PUBLIC_FITGROWX_SUPPORT_WA ?? "5491100000000";

export default function PlanCheckout({
  planName,
  priceLabel,
  monthlyLabel,
  description,
  features,
  whatsappMessage,
  mpLink,
  usdtAmount,
  btcAmountLabel,
}: PlanCheckoutProps) {
  const router = useRouter();
  const [tab, setTab] = useState<"mp" | "crypto">("mp");
  const [copied, setCopied] = useState<string | null>(null);
  const [notified, setNotified] = useState(false);

  const copyToClipboard = (text: string, key: string) => {
    navigator.clipboard.writeText(text);
    setCopied(key);
    setTimeout(() => setCopied(null), 2500);
  };

  const handleNotify = async () => {
    const text = encodeURIComponent(whatsappMessage);
    window.open(`https://wa.me/${SUPPORT_WA}?text=${text}`, "_blank");
    setNotified(true);
  };

  const handleLogout = async () => {
    await supabase.auth.signOut();
    router.push("/login");
  };

  return (
    <div
      style={{
        minHeight: "100vh",
        background: "#F3F4F6",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        padding: "32px 16px",
        fontFamily: fb,
      }}
    >
      <div style={{ marginBottom: 32, textAlign: "center" }}>
        <div
          style={{
            display: "inline-flex",
            alignItems: "center",
            gap: 10,
            marginBottom: 8,
          }}
        >
          <div
            style={{
              width: 40,
              height: 40,
              borderRadius: 12,
              background: "#151515",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            <Zap size={20} color={ACCENT} fill={ACCENT} />
          </div>
          <span style={{ font: `800 1.4rem/1 ${fd}`, color: t1, letterSpacing: "-0.02em" }}>
            FitGrowX
          </span>
        </div>
        <p style={{ font: `400 0.82rem/1 ${fb}`, color: t3 }}>
          Checkout de suscripción
        </p>
      </div>

      <div style={{ ...card, width: "100%", maxWidth: 520, overflow: "hidden" }}>
        <div
          style={{
            background: "linear-gradient(135deg, #171717 0%, #2B2B2B 100%)",
            padding: "28px 32px",
          }}
        >
          <div
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: 6,
              background: "rgba(201,116,54,0.15)",
              border: "1px solid rgba(201,116,54,0.30)",
              borderRadius: 9999,
              padding: "4px 12px",
              marginBottom: 14,
            }}
          >
            <Clock size={11} color={ACCENT} />
            <span
              style={{
                font: `700 0.62rem/1 ${fb}`,
                color: ACCENT,
                textTransform: "uppercase",
                letterSpacing: "0.09em",
              }}
            >
              Compra directa
            </span>
          </div>
          <h1
            style={{
              font: `800 1.7rem/1.1 ${fd}`,
              color: "#FFFFFF",
              letterSpacing: "-0.02em",
              marginBottom: 8,
            }}
          >
            Activá {planName}
          </h1>
          <p style={{ font: `400 0.875rem/1.5 ${fb}`, color: "rgba(255,255,255,0.60)" }}>
            {description}
          </p>
        </div>

        <div
          style={{
            padding: "24px 32px 0",
            display: "flex",
            alignItems: "baseline",
            gap: 8,
          }}
        >
          <span style={{ font: `800 3rem/1 ${fd}`, color: t1, letterSpacing: "-0.04em" }}>
            {priceLabel}
          </span>
          <span style={{ font: `500 1rem/1 ${fb}`, color: t2 }}>{monthlyLabel}</span>
        </div>

        <div style={{ padding: "16px 32px 24px" }}>
          {features.map((feature) => (
            <div
              key={feature}
              style={{ display: "flex", alignItems: "flex-start", gap: 10, marginBottom: 9 }}
            >
              <CheckCircle size={15} color="#16A34A" style={{ flexShrink: 0, marginTop: 1 }} />
              <span style={{ font: `400 0.82rem/1.4 ${fb}`, color: t2 }}>{feature}</span>
            </div>
          ))}
        </div>

        <div style={{ height: 1, background: "rgba(0,0,0,0.06)", margin: "0 32px" }} />

        <div style={{ padding: "24px 32px 28px" }}>
          <p
            style={{
              font: `600 0.78rem/1 ${fb}`,
              color: t3,
              textTransform: "uppercase",
              letterSpacing: "0.08em",
              marginBottom: 14,
            }}
          >
            Elegí cómo pagar
          </p>

          <div style={{ display: "flex", gap: 8, marginBottom: 20 }}>
            {([
              { key: "mp", label: "Mercado Pago", icon: <CreditCard size={14} /> },
              { key: "crypto", label: "Crypto", icon: <Bitcoin size={14} /> },
            ] as const).map((item) => (
              <button
                key={item.key}
                onClick={() => setTab(item.key)}
                style={{
                  flex: 1,
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  gap: 7,
                  padding: "10px 14px",
                  borderRadius: 10,
                  border: `1px solid ${tab === item.key ? ACCENT : "rgba(0,0,0,0.10)"}`,
                  background: tab === item.key ? "rgba(201,116,54,0.06)" : "#FAFBFD",
                  color: tab === item.key ? ACCENT : t2,
                  font: `600 0.82rem/1 ${fb}`,
                  cursor: "pointer",
                  transition: "all 0.14s",
                }}
              >
                {item.icon} {item.label}
              </button>
            ))}
          </div>

          {tab === "mp" && (
            <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
              <div
                style={{
                  padding: "16px",
                  background: "rgba(20,20,20,0.04)",
                  border: "1px solid rgba(20,20,20,0.08)",
                  borderRadius: 12,
                }}
              >
                <p style={{ font: `500 0.78rem/1.5 ${fb}`, color: t2 }}>
                  Hacé clic para ir al link de pago seguro. El proceso tarda menos de 2 minutos.
                </p>
              </div>
              <a
                href={mpLink}
                target="_blank"
                rel="noreferrer"
                style={{
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  gap: 8,
                  padding: "14px",
                  borderRadius: 12,
                  background: ACCENT,
                  color: "white",
                  font: `700 0.95rem/1 ${fd}`,
                  textDecoration: "none",
                  boxShadow: "0 4px 14px rgba(201,116,54,0.20)",
                }}
              >
                <CreditCard size={16} />
                Pagar {planName} — {priceLabel} USD
              </a>
            </div>
          )}

          {tab === "crypto" && (
            <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
              <div
                style={{
                  padding: "16px",
                  background: "rgba(201,116,54,0.04)",
                  border: "1px solid rgba(201,116,54,0.15)",
                  borderRadius: 12,
                }}
              >
                <p style={{ font: `500 0.78rem/1.5 ${fb}`, color: t2 }}>
                  Enviá exactamente <strong style={{ color: t1 }}>{usdtAmount} USDT</strong> (red TRC-20) o el equivalente en BTC.
                </p>
              </div>

              <div
                style={{
                  padding: "14px 16px",
                  background: "#FFFFFF",
                  border: "1px solid rgba(0,0,0,0.08)",
                  borderRadius: 12,
                }}
              >
                <div
                  style={{
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "space-between",
                    marginBottom: 6,
                  }}
                >
                  <span
                    style={{
                      font: `700 0.72rem/1 ${fb}`,
                      color: "#16A34A",
                      textTransform: "uppercase",
                      letterSpacing: "0.07em",
                    }}
                  >
                    USDT — TRC-20
                  </span>
                  <button
                    onClick={() => copyToClipboard(USDT_ADDR, "usdt")}
                    style={{
                      padding: "4px 10px",
                      borderRadius: 7,
                      border: "1px solid rgba(0,0,0,0.10)",
                      background: copied === "usdt" ? "rgba(22,163,74,0.08)" : "#FAFBFD",
                      color: copied === "usdt" ? "#16A34A" : t2,
                      font: `600 0.68rem/1 ${fb}`,
                      cursor: "pointer",
                    }}
                  >
                    {copied === "usdt" ? "¡Copiado!" : "Copiar"}
                  </button>
                </div>
                <p style={{ font: `500 0.75rem/1.4 ${fb}`, color: t1, wordBreak: "break-all" }}>
                  {USDT_ADDR}
                </p>
              </div>

              <div
                style={{
                  padding: "14px 16px",
                  background: "#FFFFFF",
                  border: "1px solid rgba(0,0,0,0.08)",
                  borderRadius: 12,
                }}
              >
                <div
                  style={{
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "space-between",
                    marginBottom: 6,
                  }}
                >
                  <span
                    style={{
                      font: `700 0.72rem/1 ${fb}`,
                      color: "#D97706",
                      textTransform: "uppercase",
                      letterSpacing: "0.07em",
                    }}
                  >
                    BTC — Bitcoin
                  </span>
                  <button
                    onClick={() => copyToClipboard(BTC_ADDR, "btc")}
                    style={{
                      padding: "4px 10px",
                      borderRadius: 7,
                      border: "1px solid rgba(0,0,0,0.10)",
                      background: copied === "btc" ? "rgba(217,119,6,0.08)" : "#FAFBFD",
                      color: copied === "btc" ? "#D97706" : t2,
                      font: `600 0.68rem/1 ${fb}`,
                      cursor: "pointer",
                    }}
                  >
                    {copied === "btc" ? "¡Copiado!" : "Copiar"}
                  </button>
                </div>
                <p style={{ font: `500 0.75rem/1.4 ${fb}`, color: t1, wordBreak: "break-all" }}>
                  {BTC_ADDR}
                </p>
                <p style={{ font: `400 0.72rem/1.5 ${fb}`, color: t3, marginTop: 8 }}>
                  Enviá el equivalente a {btcAmountLabel}.
                </p>
              </div>
            </div>
          )}

          <div
            style={{
              marginTop: 20,
              padding: "16px",
              background: "#F4F5F9",
              borderRadius: 12,
              display: "flex",
              flexDirection: "column",
              gap: 10,
            }}
          >
            <p
              style={{
                font: `500 0.78rem/1.4 ${fb}`,
                color: t2,
                display: "flex",
                gap: 7,
                alignItems: "flex-start",
              }}
            >
              <Shield size={14} color={t3} style={{ flexShrink: 0, marginTop: 1 }} />
              Una vez confirmado el pago, activamos tu acceso en menos de 24 hs.
            </p>
            <button
              onClick={handleNotify}
              disabled={notified}
              style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                gap: 7,
                padding: "11px",
                borderRadius: 10,
                border: "1px solid rgba(22,163,74,0.30)",
                background: notified ? "rgba(22,163,74,0.08)" : "#FFFFFF",
                color: "#16A34A",
                font: `700 0.82rem/1 ${fd}`,
                cursor: notified ? "default" : "pointer",
              }}
            >
              <CheckCircle size={14} />
              {notified ? "¡Mensaje enviado! Te contactamos pronto." : "Ya pagué — Notificar al equipo"}
            </button>
          </div>
        </div>
      </div>

      <button
        onClick={handleLogout}
        style={{
          marginTop: 20,
          display: "flex",
          alignItems: "center",
          gap: 6,
          background: "none",
          border: "none",
          color: t3,
          font: `400 0.78rem/1 ${fb}`,
          cursor: "pointer",
          padding: "8px 12px",
        }}
      >
        <LogOut size={13} /> Cerrar sesión
      </button>
    </div>
  );
}
