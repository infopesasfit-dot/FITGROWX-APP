import Link from "next/link";
import { ArrowRight, FolderOpen } from "lucide-react";
import { getVaultHomeData } from "./content";

const fd = "var(--font-inter, 'Inter', sans-serif)";
const fb = "var(--font-inter, 'Inter', sans-serif)";
const t1 = "#1A1D23";
const t2 = "#475569";
const t3 = "#94A3B8";
const orange = "#F97316";
const pageBg = "#ECEFF3";
const cardBg = "#F4F6F8";
const innerCardBg = "#F8FAFC";

const shellCard: React.CSSProperties = {
  background: cardBg,
  borderRadius: 28,
  border: "1px solid rgba(255,255,255,0.75)",
  boxShadow: "0 28px 60px rgba(15,23,42,0.10), 0 6px 16px rgba(15,23,42,0.05), inset 0 1px 0 rgba(255,255,255,0.6)",
};

export default async function BovedaPage() {
  const { categories, resources } = await getVaultHomeData();
  const featuredResources = resources.slice(0, 4);
  const heroResource = featuredResources[0] ?? resources[0];

  return (
    <>
      <style>{`
        .vault-cats,
        .vault-resources {
          display: grid;
          gap: 18px;
        }

        .vault-cats {
          grid-template-columns: repeat(2, minmax(0, 1fr));
        }

        .vault-resources {
          grid-template-columns: repeat(2, minmax(0, 1fr));
        }

        @media (max-width: 1160px) {
          .vault-resources {
            grid-template-columns: 1fr;
          }
        }

        @media (max-width: 860px) {
          .vault-cats {
            grid-template-columns: 1fr;
          }
        }
      `}</style>

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
            ...shellCard,
            padding: "30px 30px 28px",
            position: "relative",
            overflow: "hidden",
            background: "linear-gradient(180deg, #F6F8FA 0%, #ECEFF3 100%)",
          }}
        >
          <div
            style={{
              position: "absolute",
              right: -80,
              top: -90,
              width: 240,
              height: 240,
              borderRadius: "50%",
              background: "radial-gradient(circle, rgba(249,115,22,0.18) 0%, transparent 68%)",
              pointerEvents: "none",
            }}
          />
          <div
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: 8,
              padding: "7px 12px",
              borderRadius: 999,
              border: `1px solid rgba(249,115,22,0.18)`,
              background: "rgba(249,115,22,0.08)",
              marginBottom: 18,
            }}
          >
            <FolderOpen size={14} color={orange} />
            <span
              style={{
                font: `700 0.72rem/1 ${fd}`,
                color: orange,
                textTransform: "uppercase",
                letterSpacing: "0.12em",
              }}
            >
              Bóveda FitGrowX
            </span>
          </div>

          <p
            style={{
              font: `500 0.74rem/1 ${fb}`,
              color: t3,
              textTransform: "uppercase",
              letterSpacing: "0.16em",
              marginBottom: 8,
            }}
          >
            Biblioteca central
          </p>
          <h1
            style={{
              font: `800 clamp(2rem, 3.2vw, 3.1rem)/1 ${fd}`,
              color: t1,
              letterSpacing: "-0.05em",
              maxWidth: 680,
              marginBottom: 16,
            }}
          >
            Recursos simples para hacer crecer tu espacio.
          </h1>
          <p
            style={{
              font: `400 1rem/1.75 ${fb}`,
              color: t2,
              maxWidth: 760,
              marginBottom: 22,
            }}
          >
            Tutoriales y guías prácticas para ventas, operación y experiencia del alumno.
            Todo pensado para que encuentres rápido qué aplicar en tu negocio.
          </p>

          <Link
            href={
              heroResource
                ? `/dashboard/boveda/recurso/${heroResource.slug}`
                : "/dashboard/boveda"
            }
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: 8,
              padding: "12px 18px",
              borderRadius: 14,
              background: "#171717",
              color: "#FFFFFF",
              textDecoration: "none",
              font: `700 0.9rem/1 ${fd}`,
              boxShadow: "0 12px 26px rgba(23,23,23,0.18)",
            }}
          >
            Ver tutorial de ejemplo
            <ArrowRight size={15} />
          </Link>
        </section>

        <section style={{ ...shellCard, padding: "26px 26px 24px" }}>
          <div style={{ marginBottom: 20 }}>
            <p
              style={{
                font: `700 0.7rem/1 ${fd}`,
                color: t3,
                textTransform: "uppercase",
                letterSpacing: "0.16em",
                marginBottom: 8,
              }}
            >
              Categorías principales
            </p>
            <h2 style={{ font: `800 1.95rem/1 ${fd}`, color: t1, letterSpacing: "-0.04em" }}>
              Encontrá contenido por área del negocio
            </h2>
          </div>

          <div className="vault-cats">
            {categories.map(({ slug, title, description, icon: Icon }) => (
              <Link
                key={title}
                href={`/dashboard/boveda/categoria/${slug}`}
                style={{
                  textDecoration: "none",
                  borderRadius: 22,
                  border: "1px solid rgba(255,255,255,0.95)",
                  background: innerCardBg,
                  padding: 20,
                  boxShadow: "0 22px 36px rgba(15,23,42,0.08), inset 0 1px 0 rgba(255,255,255,0.65)",
                  display: "block",
                }}
              >
                <div
                  style={{
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "space-between",
                    gap: 14,
                    marginBottom: 16,
                  }}
                >
                  <div
                    style={{
                      width: 42,
                      height: 42,
                      borderRadius: 14,
                      background: "rgba(249,115,22,0.1)",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      flexShrink: 0,
                    }}
                  >
                    <Icon size={19} color={orange} />
                  </div>
                </div>

                <h3
                  style={{
                    font: `750 1.15rem/1.15 ${fd}`,
                    color: t1,
                    letterSpacing: "-0.03em",
                    marginBottom: 10,
                  }}
                >
                  {title}
                </h3>
                <p style={{ font: `400 0.92rem/1.65 ${fb}`, color: t2 }}>{description}</p>
              </Link>
            ))}
          </div>
        </section>

        <section id="recursos" style={{ ...shellCard, padding: "26px 26px 24px" }}>
          <div
            style={{
              display: "flex",
              alignItems: "flex-end",
              justifyContent: "space-between",
              gap: 12,
              flexWrap: "wrap",
              marginBottom: 20,
            }}
          >
            <div>
              <p
                style={{
                  font: `700 0.7rem/1 ${fd}`,
                  color: t3,
                  textTransform: "uppercase",
                  letterSpacing: "0.16em",
                  marginBottom: 8,
                }}
              >
                Destacados
              </p>
              <h2 style={{ font: `800 1.95rem/1 ${fd}`, color: t1, letterSpacing: "-0.04em" }}>
                Recursos reales para empezar
              </h2>
            </div>
            <span style={{ font: `500 0.84rem/1 ${fb}`, color: t3 }}>
              {resources.length} recursos entre biblioteca base y contenido publicado en CMS.
            </span>
          </div>

          <div className="vault-resources">
            {featuredResources.map(({ slug, title, description, cta, icon: Icon }) => (
              <article
                key={title}
                style={{
                  display: "flex",
                  flexDirection: "column",
                  gap: 14,
                  minHeight: 220,
                  borderRadius: 22,
                  border: "1px solid rgba(255,255,255,0.95)",
                  background: innerCardBg,
                  padding: 20,
                  boxShadow: "0 22px 36px rgba(15,23,42,0.08), inset 0 1px 0 rgba(255,255,255,0.65)",
                }}
              >
                <div
                  style={{
                    width: 46,
                    height: 46,
                    borderRadius: 15,
                    background: "#171717",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    boxShadow: "0 10px 24px rgba(23,23,23,0.12)",
                  }}
                >
                  <Icon size={20} color="#FFFFFF" />
                </div>

                <div style={{ display: "grid", gap: 10 }}>
                  <h3
                    style={{
                      font: `760 1.22rem/1.2 ${fd}`,
                      color: t1,
                      letterSpacing: "-0.035em",
                    }}
                  >
                    {title}
                  </h3>
                  <p style={{ font: `400 0.92rem/1.65 ${fb}`, color: t2 }}>{description}</p>
                </div>

                <Link
                  href={`/dashboard/boveda/recurso/${slug}`}
                  style={{
                    marginTop: "auto",
                    display: "inline-flex",
                    alignItems: "center",
                    gap: 8,
                    width: "fit-content",
                    padding: "11px 14px",
                    borderRadius: 12,
                    border: "none",
                    background: "rgba(249,115,22,0.1)",
                    color: "#C2410C",
                    font: `700 0.84rem/1 ${fd}`,
                    cursor: "pointer",
                    textDecoration: "none",
                  }}
                >
                  {cta}
                  <ArrowRight size={14} />
                </Link>
              </article>
            ))}
          </div>
        </section>
      </div>
    </>
  );
}
