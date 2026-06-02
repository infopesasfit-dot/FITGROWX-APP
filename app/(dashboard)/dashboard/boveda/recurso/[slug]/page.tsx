import Link from "next/link";
import { ArrowLeft, CheckCircle2 } from "lucide-react";
import { getVaultResourcePageData } from "../../content";

const fd = "var(--font-inter, 'Inter', sans-serif)";
const fb = "var(--font-inter, 'Inter', sans-serif)";
const t1 = "#1A1D23";
const t2 = "#475569";
const t3 = "#94A3B8";
const orange = "#F97316";
const pageBg = "#ECEFF3";
const cardBg = "#F4F6F8";
const innerCardBg = "#F8FAFC";

type Params = Promise<{ slug: string }>;

export default async function VaultResourcePage({ params }: { params: Params }) {
  const { slug } = await params;
  const { resource, category } = await getVaultResourcePageData(slug);

  if (!resource) {
    return (
      <div style={{ padding: "24px 0" }}>
        <div
          style={{
            background: "#FFFFFF",
            borderRadius: 22,
            border: "1px solid rgba(15,23,42,0.08)",
            padding: 28,
          }}
        >
          <p style={{ font: `700 0.8rem/1 ${fd}`, color: t3, marginBottom: 10 }}>
            Recurso no encontrado
          </p>
          <Link
            href="/dashboard/boveda"
            style={{ color: orange, textDecoration: "none", font: `700 0.9rem/1 ${fd}` }}
          >
            Volver a la bóveda
          </Link>
        </div>
      </div>
    );
  }

  const Icon = resource.icon;

  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        gap: 22,
        paddingBottom: 18,
        minHeight: "100%",
        background: pageBg,
      }}
    >
      <section
        style={{
          background: cardBg,
          borderRadius: 28,
          border: "1px solid rgba(255,255,255,0.95)",
          padding: "28px 28px 26px",
          boxShadow: "0 28px 60px rgba(15,23,42,0.10), 0 6px 16px rgba(15,23,42,0.05), inset 0 1px 0 rgba(255,255,255,0.6)",
        }}
      >
        <div style={{ display: "flex", gap: 12, flexWrap: "wrap", marginBottom: 18 }}>
          <Link
            href="/dashboard/boveda"
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: 8,
              color: t2,
              textDecoration: "none",
              font: `600 0.82rem/1 ${fb}`,
            }}
          >
            <ArrowLeft size={15} />
            Bóveda
          </Link>
          {category && (
            <Link
              href={`/dashboard/boveda/categoria/${category.slug}`}
              style={{
                color: t3,
                textDecoration: "none",
                font: `600 0.82rem/1 ${fb}`,
              }}
            >
              / {category.title}
            </Link>
          )}
        </div>

        <div
          style={{
            width: 50,
            height: 50,
            borderRadius: 16,
            background: "#171717",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            marginBottom: 16,
          }}
        >
          <Icon size={20} color="#FFFFFF" />
        </div>

        <p
          style={{
            font: `600 0.82rem/1 ${fb}`,
            color: t3,
            marginBottom: 10,
          }}
        >
          {resource.format} · {resource.readTime}
        </p>
        <h1
          style={{
            font: `800 clamp(2rem, 4vw, 3.4rem)/1 ${fd}`,
            color: t1,
            letterSpacing: "-0.05em",
            marginBottom: 14,
            maxWidth: 860,
          }}
        >
          {resource.title}
        </h1>
        <p style={{ maxWidth: 860, font: `400 1rem/1.7 ${fb}`, color: t2, marginBottom: 20 }}>
          {resource.intro}
        </p>

        <p
          style={{
            maxWidth: 760,
            paddingLeft: 14,
            borderLeft: `3px solid rgba(249,115,22,0.24)`,
            font: `500 0.95rem/1.7 ${fb}`,
            color: t2,
          }}
        >
          Objetivo: {resource.objective} Resultado esperado: {resource.outcome}
        </p>
      </section>

      <section
        style={{
          background: cardBg,
          borderRadius: 28,
          border: "1px solid rgba(255,255,255,0.95)",
          padding: "24px 24px 22px",
          boxShadow: "0 28px 60px rgba(15,23,42,0.10), 0 6px 16px rgba(15,23,42,0.05), inset 0 1px 0 rgba(255,255,255,0.6)",
        }}
      >
        <p
          style={{
            font: `700 0.72rem/1 ${fd}`,
            color: t3,
            textTransform: "uppercase",
            letterSpacing: "0.16em",
            marginBottom: 10,
          }}
        >
          Paso a paso
        </p>
        <h2 style={{ font: `800 1.8rem/1 ${fd}`, color: t1, letterSpacing: "-0.04em", marginBottom: 18 }}>
          Cómo aplicarlo en tu negocio
        </h2>

        <div style={{ display: "grid", gap: 14 }}>
          {resource.steps.map((step, index) => (
            <article
              key={step}
              style={{
                display: "grid",
                gridTemplateColumns: "42px 1fr",
                gap: 14,
                alignItems: "start",
                padding: 18,
                borderRadius: 22,
                border: "1px solid rgba(255,255,255,0.95)",
                background: innerCardBg,
                boxShadow: "0 22px 36px rgba(15,23,42,0.08), inset 0 1px 0 rgba(255,255,255,0.65)",
              }}
            >
              <div
                style={{
                  width: 42,
                  height: 42,
                  borderRadius: 14,
                  background: "rgba(249,115,22,0.1)",
                  color: "#C2410C",
                  font: `800 0.9rem/1 ${fd}`,
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                }}
              >
                {index + 1}
              </div>
              <p style={{ font: `400 0.95rem/1.7 ${fb}`, color: t2 }}>{step}</p>
            </article>
          ))}
        </div>
      </section>

      <section
        style={{
          background: cardBg,
          borderRadius: 28,
          border: "1px solid rgba(255,255,255,0.95)",
          padding: "24px 24px 22px",
          boxShadow: "0 28px 60px rgba(15,23,42,0.10), 0 6px 16px rgba(15,23,42,0.05), inset 0 1px 0 rgba(255,255,255,0.6)",
        }}
      >
        <h2 style={{ font: `800 1.8rem/1 ${fd}`, color: t1, letterSpacing: "-0.04em", marginBottom: 18 }}>
          Notas rápidas
        </h2>

        <div style={{ display: "grid", gap: 12 }}>
          {resource.bullets.map((item) => (
            <div
              key={item}
              style={{
                display: "flex",
                gap: 12,
                alignItems: "flex-start",
                padding: 16,
                borderRadius: 18,
                border: "1px solid rgba(255,255,255,0.95)",
                background: innerCardBg,
                boxShadow: "0 18px 30px rgba(15,23,42,0.07), inset 0 1px 0 rgba(255,255,255,0.65)",
              }}
            >
              <CheckCircle2 size={18} color={orange} style={{ flexShrink: 0, marginTop: 2 }} />
              <p style={{ font: `400 0.92rem/1.6 ${fb}`, color: t2 }}>{item}</p>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}
