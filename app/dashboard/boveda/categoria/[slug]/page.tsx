import Link from "next/link";
import { ArrowLeft, ArrowRight } from "lucide-react";
import { getVaultCategoryPageData } from "../../content";

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

export default async function VaultCategoryPage({ params }: { params: Params }) {
  const { slug } = await params;
  const { category, resources } = await getVaultCategoryPageData(slug);

  if (!category) {
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
            Categoría no encontrada
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

  const Icon = category.icon;

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
        <Link
          href="/dashboard/boveda"
          style={{
            display: "inline-flex",
            alignItems: "center",
            gap: 8,
            color: t2,
            textDecoration: "none",
            font: `600 0.82rem/1 ${fb}`,
            marginBottom: 18,
          }}
        >
          <ArrowLeft size={15} />
          Volver a la bóveda
        </Link>

        <div
          style={{
            width: 48,
            height: 48,
            borderRadius: 16,
            background: "rgba(249,115,22,0.1)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            marginBottom: 16,
          }}
        >
          <Icon size={20} color={orange} />
        </div>

        <p
          style={{
            font: `600 0.82rem/1 ${fb}`,
            color: t3,
            marginBottom: 10,
          }}
        >
          {resources.length} recursos
        </p>
        <h1
          style={{
            font: `800 clamp(2rem, 4vw, 3.4rem)/1 ${fd}`,
            color: t1,
            letterSpacing: "-0.05em",
            marginBottom: 14,
          }}
        >
          {category.title}
        </h1>
        <p style={{ maxWidth: 760, font: `400 1rem/1.7 ${fb}`, color: t2 }}>
          {category.description}
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
        <div style={{ marginBottom: 18 }}>
          <p
            style={{
              font: `700 0.72rem/1 ${fd}`,
              color: t3,
              textTransform: "uppercase",
              letterSpacing: "0.16em",
              marginBottom: 8,
            }}
          >
            Recursos disponibles
          </p>
          <h2 style={{ font: `800 1.8rem/1 ${fd}`, color: t1, letterSpacing: "-0.04em" }}>
            Material dentro de esta categoría
          </h2>
        </div>

        <div style={{ display: "grid", gap: 16 }}>
          {resources.map((resource) => {
            const ResourceIcon = resource.icon;

            return (
              <article
                key={resource.slug}
                style={{
                  borderRadius: 22,
                  border: "1px solid rgba(255,255,255,0.95)",
                  background: innerCardBg,
                  padding: 20,
                  boxShadow: "0 22px 36px rgba(15,23,42,0.08), inset 0 1px 0 rgba(255,255,255,0.65)",
                }}
              >
                <div
                  style={{
                    display: "flex",
                    justifyContent: "space-between",
                    alignItems: "flex-start",
                    gap: 18,
                    flexWrap: "wrap",
                  }}
                >
                  <div style={{ display: "flex", gap: 14, maxWidth: 760 }}>
                    <div
                      style={{
                        width: 44,
                        height: 44,
                        borderRadius: 15,
                        background: "#171717",
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        flexShrink: 0,
                      }}
                    >
                      <ResourceIcon size={19} color="#FFFFFF" />
                    </div>
                    <div>
                      <p style={{ font: `600 0.8rem/1 ${fb}`, color: t3, marginBottom: 8 }}>
                        {resource.format} · {resource.readTime}
                      </p>
                      <h3
                        style={{
                          font: `760 1.15rem/1.2 ${fd}`,
                          color: t1,
                          letterSpacing: "-0.03em",
                          marginBottom: 10,
                        }}
                      >
                        {resource.title}
                      </h3>
                      <p style={{ font: `400 0.92rem/1.65 ${fb}`, color: t2, marginBottom: 12 }}>
                        {resource.description}
                      </p>
                    </div>
                  </div>

                  <Link
                    href={`/dashboard/boveda/recurso/${resource.slug}`}
                    style={{
                      display: "inline-flex",
                      alignItems: "center",
                      gap: 8,
                      padding: "11px 14px",
                      borderRadius: 12,
                      background: "rgba(249,115,22,0.1)",
                      color: "#C2410C",
                      font: `700 0.84rem/1 ${fd}`,
                      textDecoration: "none",
                    }}
                  >
                    Abrir recurso
                    <ArrowRight size={14} />
                  </Link>
                </div>
              </article>
            );
          })}
        </div>
      </section>
    </div>
  );
}
