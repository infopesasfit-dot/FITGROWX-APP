"use client";

import React, { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { getCachedProfile } from "@/lib/gym-cache";
import { supabase } from "@/lib/supabase";
import { useIsDesktop } from "@/hooks/useIsDesktop";
import { MONTH_NAMES, fmt } from "@/lib/dashboard-helpers";
import { DashboardMetric } from "@/lib/dashboard-types";
import { MetricSection } from "@/app/dashboard/components/MetricSection";
import { HorariosHeatmap } from "@/app/dashboard/components/HorariosHeatmap";

function Skel({ w, h, r = 7 }: { w?: number | string; h: number; r?: number }) {
  return (
    <div style={{
      width: w ?? "100%",
      height: h,
      borderRadius: r,
      flexShrink: 0,
      background: "linear-gradient(90deg,#ECEEF2 25%,#E4E6EB 50%,#ECEEF2 75%)",
      backgroundSize: "400% 100%",
      animation: "skelShimmer 1.6s ease infinite",
    }} />
  );
}

interface PageProps {
  params: Promise<{ mes: string }>;
}

export default function ReporteMesPage({ params }: PageProps) {
  const router = useRouter();
  const isDesktop = useIsDesktop();
  const [mes, setMes] = useState<string>("");
  const [loading, setLoading] = useState(true);
  const [snapshot, setSnapshot] = useState<any>(null);
  const [isCurrent, setIsCurrent] = useState(false);
  const [metricSectionOpen, setMetricSectionOpen] = useState<Record<string, boolean>>({ Embudo: false, Fidelización: false, Eficiencia: false });
  const [activeInfo, setActiveInfo] = useState<{ title: string; body: string } | null>(null);
  const [isClosed, setIsClosed] = useState(false);
  const [closedAt, setClosedAt] = useState<string | null>(null);
  const [showCloseModal, setShowCloseModal] = useState(false);
  const [closeLoading, setCloseLoading] = useState(false);
  const [closeError, setCloseError] = useState<string | null>(null);
  const [closeSuccess, setCloseSuccess] = useState(false);

  useEffect(() => {
    (async () => {
      const p = await params;
      const mesParam = p.mes;

      // Validate format YYYY-MM
      const regex = /^\d{4}-\d{2}$/;
      if (!regex.test(mesParam)) {
        router.push("/dashboard/reportes");
        return;
      }

      const [year, month] = mesParam.split("-").map(Number);

      // Validate month range
      if (month < 1 || month > 12) {
        router.push("/dashboard/reportes");
        return;
      }

      // Check if future
      const today = new Date();
      const currentYear = today.getFullYear();
      const currentMonth = today.getMonth() + 1;

      if (year > currentYear || (year === currentYear && month > currentMonth)) {
        router.push("/dashboard/reportes");
        return;
      }

      setMes(mesParam);

      // Fetch dashboard data
      const profile = await getCachedProfile();
      if (!profile) {
        setLoading(false);
        return;
      }

      // Construct date range for the month
      const daysInMonth = new Date(year, month, 0).getDate();
      const from = `${mesParam}-01`;
      const to = `${mesParam}-${daysInMonth}`;

      try {
        const response = await fetch(
          `/api/admin/dashboard?from=${from}&to=${to}`,
          { cache: "no-store" }
        );
        const data = await response.json();
        setSnapshot(data.snapshot);

        // Check if current month
        const isCurr = year === currentYear && month === currentMonth;
        setIsCurrent(isCurr);

        // Check if month is closed (query monthly_reports)
        if (!isCurr) {
          const { data: reportData } = await supabase
            .from("monthly_reports")
            .select("closed_at")
            .eq("year_month", mesParam)
            .maybeSingle();

          if (reportData) {
            setIsClosed(true);
            setClosedAt(reportData.closed_at);
          }
        }
      } catch (err) {
        console.error("Failed to fetch dashboard:", err);
      } finally {
        setLoading(false);
      }
    })();
  }, [params, router]);

  if (!mes) return null;

  const [year, month] = mes.split("-").map(Number);
  const monthName = MONTH_NAMES[month - 1];

  const handleClose = async () => {
    setCloseError(null);
    setCloseLoading(true);
    try {
      const response = await fetch("/api/admin/reportes/cerrar", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ year_month: mes }),
      });
      const data = await response.json();

      if (response.ok) {
        setCloseSuccess(true);
        setTimeout(() => {
          setShowCloseModal(false);
          router.refresh();
        }, 800);
      } else if (response.status === 409) {
        setCloseError(`${monthName} ${year} ya está cerrado.`);
      } else {
        setCloseError(data.error || "Error al cerrar el mes.");
      }
    } catch (err) {
      setCloseError((err as Error).message || "Error desconocido.");
    } finally {
      setCloseLoading(false);
    }
  };

  return (
    <div style={{
      padding: isDesktop ? "20px 20px 28px" : "12px 10px 96px",
      display: "flex",
      flexDirection: "column",
      gap: 20,
    }}>
      <style>{`
        @keyframes skelShimmer {
          0% { background-position: -400% 0; }
          100% { background-position: 400% 0; }
        }
      `}</style>

      {/* Back Button */}
      <Link href="/dashboard/reportes" style={{
        display: "flex",
        alignItems: "center",
        gap: 8,
        color: "var(--color-text-1, #1A1D23)",
        textDecoration: "none",
        fontSize: "0.9rem",
        fontWeight: 500,
        transition: "opacity 0.15s",
      }}
      onMouseEnter={(e) => {
        (e.currentTarget as HTMLElement).style.opacity = "0.7";
      }}
      onMouseLeave={(e) => {
        (e.currentTarget as HTMLElement).style.opacity = "1";
      }}>
        <ArrowLeft size={18} />
        Volver a Reportes
      </Link>

      {/* Header */}
      <header style={{ paddingBottom: 8 }}>
        <h1 style={{
          margin: "0 0 8px",
          font: "800 2rem/1.2 var(--font-family-display, 'Inter', sans-serif)",
          color: "var(--color-text-1, #1A1D23)",
          letterSpacing: "-0.02em",
        }}>
          {monthName} {year}
        </h1>
        <p style={{
          margin: 0,
          font: "400 0.95rem/1.5 var(--font-family-body, 'Inter', sans-serif)",
          color: "var(--color-text-2, #6B7280)",
        }}>
          {isCurrent
            ? "Reporte en curso"
            : isClosed
              ? `Cerraste este mes el ${new Date(closedAt!).toLocaleDateString("es-AR")}`
              : "Reporte completado"}
        </p>
      </header>

      {/* Close Month Banner (past month not closed) */}
      {!loading && !isCurrent && !isClosed && (
        <div style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          padding: "12px 16px",
          background: "rgba(234, 120, 34, 0.08)",
          border: "1px solid rgba(234, 120, 34, 0.2)",
          borderRadius: 10,
          gap: 12,
        }}>
          <p style={{
            margin: 0,
            font: "500 0.9rem/1.4 var(--font-family-body, 'Inter', sans-serif)",
            color: "#EA7822",
            flex: 1,
          }}>
            Cerrá este mes para guardar los números definitivos.
          </p>
          <button
            onClick={() => {
              setCloseError(null);
              setCloseSuccess(false);
              setShowCloseModal(true);
            }}
            style={{
              padding: "8px 16px",
              borderRadius: 8,
              background: "#EA7822",
              color: "white",
              border: "none",
              font: "600 0.85rem/1 var(--font-family-body, 'Inter', sans-serif)",
              cursor: "pointer",
              whiteSpace: "nowrap",
              flexShrink: 0,
              transition: "background 0.15s",
            }}
            onMouseEnter={(e) => {
              (e.currentTarget as HTMLElement).style.background = "#D46A1A";
            }}
            onMouseLeave={(e) => {
              (e.currentTarget as HTMLElement).style.background = "#EA7822";
            }}
          >
            Cerrar mes
          </button>
        </div>
      )}

      {/* Metrics Grid */}
      {loading ? (
        <div style={{
          display: "grid",
          gridTemplateColumns: isDesktop ? "repeat(4, 1fr)" : "repeat(2, 1fr)",
          gap: isDesktop ? 16 : 12,
        }}>
          {[1, 2, 3, 4].map((i) => (
            <div className="dashboard-card" key={i} style={{
              padding: isDesktop ? "20px" : "16px",
            }}>
              <Skel h={16} w="60%" r={6} />
              <div style={{ marginTop: 12 }}>
                <Skel h={28} w="80%" r={7} />
              </div>
            </div>
          ))}
        </div>
      ) : snapshot ? (
        <>
          <div style={{
            display: "grid",
            gridTemplateColumns: isDesktop ? "repeat(4, 1fr)" : "repeat(2, 1fr)",
            gap: isDesktop ? 16 : 12,
          }}>
            {/* COBRADO */}
            <div className="dashboard-card" style={{
              padding: isDesktop ? "20px" : "16px",
            }}>
              <p style={{
                margin: "0 0 8px",
                font: "500 0.75rem/1 var(--font-family-body, 'Inter', sans-serif)",
                color: "var(--color-text-2, #6B7280)",
                textTransform: "uppercase",
                letterSpacing: "0.05em",
              }}>
                Cobrado
              </p>
              <p style={{
                margin: 0,
                font: "700 1.75rem/1 var(--font-family-display, 'Inter', sans-serif)",
                color: "var(--color-text-1, #1A1D23)",
              }}>
                {fmt(snapshot.recaudadoEsteMes ?? 0)}
              </p>
            </div>

            {/* MARGEN */}
            <div className="dashboard-card" style={{
              padding: isDesktop ? "20px" : "16px",
            }}>
              <p style={{
                margin: "0 0 8px",
                font: "500 0.75rem/1 var(--font-family-body, 'Inter', sans-serif)",
                color: "var(--color-text-2, #6B7280)",
                textTransform: "uppercase",
                letterSpacing: "0.05em",
              }}>
                Margen
              </p>
              <div style={{ display: "flex", alignItems: "baseline", gap: 6 }}>
                <p style={{
                  margin: 0,
                  font: "700 1.75rem/1 var(--font-family-display, 'Inter', sans-serif)",
                  color: "var(--color-text-1, #1A1D23)",
                }}>
                  {fmt((snapshot.recaudadoEsteMes ?? 0) - (snapshot.gastosTotal ?? 0))}
                </p>
                <p style={{
                  margin: 0,
                  font: "600 0.85rem/1 var(--font-family-body, 'Inter', sans-serif)",
                  color: "var(--color-text-2, #6B7280)",
                }}>
                  {snapshot.recaudadoEsteMes > 0
                    ? `${(((snapshot.recaudadoEsteMes - snapshot.gastosTotal) / snapshot.recaudadoEsteMes) * 100).toFixed(1)}%`
                    : "—"}
                </p>
              </div>
            </div>

            {/* ALTAS */}
            <div className="dashboard-card" style={{
              padding: isDesktop ? "20px" : "16px",
            }}>
              <p style={{
                margin: "0 0 8px",
                font: "500 0.75rem/1 var(--font-family-body, 'Inter', sans-serif)",
                color: "var(--color-text-2, #6B7280)",
                textTransform: "uppercase",
                letterSpacing: "0.05em",
              }}>
                Altas
              </p>
              <p style={{
                margin: 0,
                font: "700 1.75rem/1 var(--font-family-display, 'Inter', sans-serif)",
                color: "#22C55E",
              }}>
                +{snapshot.altasMes ?? 0}
              </p>
            </div>

            {/* BAJAS */}
            <div className="dashboard-card" style={{
              padding: isDesktop ? "20px" : "16px",
            }}>
              <p style={{
                margin: "0 0 8px",
                font: "500 0.75rem/1 var(--font-family-body, 'Inter', sans-serif)",
                color: "var(--color-text-2, #6B7280)",
                textTransform: "uppercase",
                letterSpacing: "0.05em",
              }}>
                Bajas
              </p>
              <p style={{
                margin: 0,
                font: "700 1.75rem/1 var(--font-family-display, 'Inter', sans-serif)",
                color: "#EF4444",
              }}>
                -{snapshot.bajasMes ?? 0}
              </p>
            </div>
          </div>

          {/* Variación Neta */}
          <div className="dashboard-card" style={{
            padding: isDesktop ? "20px" : "16px",
            textAlign: "center",
            background: snapshot.variacionNeta >= 0
              ? "rgba(34,197,94,0.06)"
              : "rgba(239,68,68,0.06)",
            border: snapshot.variacionNeta >= 0
              ? "1px solid rgba(34,197,94,0.15)"
              : "1px solid rgba(239,68,68,0.15)",
          }}>
            <p style={{
              margin: "0 0 12px",
              font: "500 0.85rem/1 var(--font-family-body, 'Inter', sans-serif)",
              color: "var(--color-text-2, #6B7280)",
              textTransform: "uppercase",
              letterSpacing: "0.05em",
            }}>
              Variación Neta
            </p>
            <p style={{
              margin: "0 0 8px",
              font: "700 2rem/1 var(--font-family-display, 'Inter', sans-serif)",
              color: snapshot.variacionNeta >= 0 ? "#22C55E" : "#EF4444",
            }}>
              {snapshot.variacionNeta >= 0 ? "+" : ""}
              {snapshot.variacionNeta}
            </p>
            <p style={{
              margin: 0,
              font: "400 0.85rem/1.5 var(--font-family-body, 'Inter', sans-serif)",
              color: "var(--color-text-2, #6B7280)",
            }}>
              {snapshot.variacionNeta >= 0
                ? "Ganaste socios este mes"
                : "Perdiste socios este mes"}
            </p>
          </div>

          {/* Metric Sections */}
          {snapshot.metrics && snapshot.metrics.length > 0 && (
            <>
              <MetricSection
                section="Embudo"
                metrics={snapshot.metrics}
                prospectos={snapshot.prospectos ?? 0}
                loading={false}
                isDesktop={isDesktop}
                isOpen={metricSectionOpen["Embudo"] ?? false}
                onToggle={() => setMetricSectionOpen(prev => ({ ...prev, Embudo: !prev["Embudo"] }))}
                activeInfo={activeInfo}
                setActiveInfo={setActiveInfo}
              />
              <MetricSection
                section="Fidelización"
                metrics={snapshot.metrics}
                prospectos={snapshot.prospectos ?? 0}
                loading={false}
                isDesktop={isDesktop}
                isOpen={metricSectionOpen["Fidelización"] ?? false}
                onToggle={() => setMetricSectionOpen(prev => ({ ...prev, Fidelización: !prev["Fidelización"] }))}
                activeInfo={activeInfo}
                setActiveInfo={setActiveInfo}
              />
              <MetricSection
                section="Eficiencia"
                metrics={snapshot.metrics}
                prospectos={snapshot.prospectos ?? 0}
                loading={false}
                isDesktop={isDesktop}
                isOpen={metricSectionOpen["Eficiencia"] ?? false}
                onToggle={() => setMetricSectionOpen(prev => ({ ...prev, Eficiencia: !prev["Eficiencia"] }))}
                activeInfo={activeInfo}
                setActiveInfo={setActiveInfo}
              />
            </>
          )}

          {/* Horarios Heatmap */}
          {snapshot.asistHoras && snapshot.asistHoras.length > 0 && (
            <HorariosHeatmap asistHoras={snapshot.asistHoras} isDesktop={isDesktop} />
          )}

          {/* Placeholder */}
          <div className="dashboard-card" style={{
            padding: "24px 16px",
            textAlign: "center",
            background: "rgba(59,130,246,0.04)",
            border: "1px dashed rgba(59,130,246,0.2)",
          }}>
            <p style={{
              margin: 0,
              font: "400 0.9rem/1.5 var(--font-family-body, 'Inter', sans-serif)",
              color: "var(--color-text-2, #6B7280)",
            }}>
              📊 Más visualizaciones próximamente
            </p>
          </div>

          {/* Mobile tooltip modal */}
          {!isDesktop && activeInfo && (
            <div
              style={{
                position: "fixed",
                inset: 0,
                background: "rgba(0,0,0,0.4)",
                display: "flex",
                alignItems: "flex-end",
                zIndex: 40,
              }}
              onClick={() => setActiveInfo(null)}
            >
              <div
                style={{
                  width: "100%",
                  background: "white",
                  borderRadius: "16px 16px 0 0",
                  padding: "20px",
                  display: "flex",
                  flexDirection: "column",
                  gap: 12,
                }}
                onClick={(e) => e.stopPropagation()}
              >
                <p style={{
                  font: "700 1rem/1 var(--font-family-display, 'Inter', sans-serif)",
                  color: "var(--color-text-1, #1A1D23)",
                  margin: 0,
                }}>
                  {activeInfo.title}
                </p>
                <p style={{
                  font: "400 0.9rem/1.5 var(--font-family-body, 'Inter', sans-serif)",
                  color: "var(--color-text-2, #6B7280)",
                  margin: 0,
                }}>
                  {activeInfo.body}
                </p>
                <button
                  onClick={() => setActiveInfo(null)}
                  style={{
                    marginTop: 12,
                    padding: "12px 16px",
                    borderRadius: 10,
                    background: "var(--bg-card, #FFFFFF)",
                    border: "1px solid rgba(15,17,21,0.1)",
                    font: "600 0.9rem/1 var(--font-family-body, 'Inter', sans-serif)",
                    color: "var(--color-text-1, #1A1D23)",
                    cursor: "pointer",
                  }}
                >
                  Cerrar
                </button>
              </div>
            </div>
          )}

          {/* Close month modal */}
          {showCloseModal && snapshot && (
            <div
              style={{
                position: "fixed",
                inset: 0,
                background: "rgba(0,0,0,0.5)",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                zIndex: 50,
              }}
              onKeyDown={(e) => {
                if (e.key === "Escape") {
                  setShowCloseModal(false);
                }
              }}
              tabIndex={0}
            >
              <div
                style={{
                  background: "white",
                  borderRadius: 12,
                  padding: "24px 20px",
                  maxWidth: "500px",
                  width: "90%",
                  display: "flex",
                  flexDirection: "column",
                  gap: 20,
                }}
                onClick={(e) => e.stopPropagation()}
              >
                {closeSuccess ? (
                  <div style={{ textAlign: "center", display: "flex", flexDirection: "column", gap: 12 }}>
                    <div style={{
                      fontSize: "3rem",
                      lineHeight: 1,
                    }}>
                      ✓
                    </div>
                    <div>
                      <h2 style={{
                        margin: "0 0 8px",
                        font: "700 1.25rem/1 var(--font-family-display, 'Inter', sans-serif)",
                        color: "#22C55E",
                      }}>
                        Listo, mes cerrado
                      </h2>
                      <p style={{
                        margin: 0,
                        font: "400 0.9rem/1.5 var(--font-family-body, 'Inter', sans-serif)",
                        color: "var(--color-text-2, #6B7280)",
                      }}>
                        Guardando datos definitivos...
                      </p>
                    </div>
                  </div>
                ) : (
                  <div>
                    <h2 style={{
                      margin: "0 0 12px",
                      font: "700 1.25rem/1 var(--font-family-display, 'Inter', sans-serif)",
                      color: "var(--color-text-1, #1A1D23)",
                    }}>
                      Cerrar {monthName} {year}
                    </h2>
                    <p style={{
                      margin: 0,
                      font: "400 0.9rem/1.5 var(--font-family-body, 'Inter', sans-serif)",
                      color: "var(--color-text-2, #6B7280)",
                    }}>
                      Revisá los números antes de cerrar
                    </p>
                  </div>
                )}

                {!closeSuccess && (
                  <>
                    {/* Summary Grid */}
                <div style={{
                  display: "grid",
                  gridTemplateColumns: "repeat(2, 1fr)",
                  gap: 12,
                  padding: "12px",
                  background: "rgba(0,0,0,0.02)",
                  borderRadius: 8,
                }}>
                  <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
                    <p style={{
                      margin: 0,
                      font: "500 0.75rem/1 var(--font-family-body, 'Inter', sans-serif)",
                      color: "var(--color-text-2, #6B7280)",
                      textTransform: "uppercase",
                      letterSpacing: "0.05em",
                    }}>
                      Cobrado
                    </p>
                    <p style={{
                      margin: 0,
                      font: "700 1rem/1 var(--font-family-display, 'Inter', sans-serif)",
                      color: "var(--color-text-1, #1A1D23)",
                    }}>
                      {fmt(snapshot.recaudadoEsteMes ?? 0)}
                    </p>
                  </div>
                  <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
                    <p style={{
                      margin: 0,
                      font: "500 0.75rem/1 var(--font-family-body, 'Inter', sans-serif)",
                      color: "var(--color-text-2, #6B7280)",
                      textTransform: "uppercase",
                      letterSpacing: "0.05em",
                    }}>
                      Margen
                    </p>
                    <p style={{
                      margin: 0,
                      font: "700 1rem/1 var(--font-family-display, 'Inter', sans-serif)",
                      color: "var(--color-text-1, #1A1D23)",
                    }}>
                      {fmt((snapshot.recaudadoEsteMes ?? 0) - (snapshot.gastosTotal ?? 0))}
                    </p>
                  </div>
                  <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
                    <p style={{
                      margin: 0,
                      font: "500 0.75rem/1 var(--font-family-body, 'Inter', sans-serif)",
                      color: "var(--color-text-2, #6B7280)",
                      textTransform: "uppercase",
                      letterSpacing: "0.05em",
                    }}>
                      Altas
                    </p>
                    <p style={{
                      margin: 0,
                      font: "700 1rem/1 var(--font-family-display, 'Inter', sans-serif)",
                      color: "#22C55E",
                    }}>
                      +{snapshot.altasMes ?? 0}
                    </p>
                  </div>
                  <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
                    <p style={{
                      margin: 0,
                      font: "500 0.75rem/1 var(--font-family-body, 'Inter', sans-serif)",
                      color: "var(--color-text-2, #6B7280)",
                      textTransform: "uppercase",
                      letterSpacing: "0.05em",
                    }}>
                      Bajas
                    </p>
                    <p style={{
                      margin: 0,
                      font: "700 1rem/1 var(--font-family-display, 'Inter', sans-serif)",
                      color: "#EF4444",
                    }}>
                      -{snapshot.bajasMes ?? 0}
                    </p>
                  </div>
                  <div style={{ gridColumn: "1 / -1", display: "flex", flexDirection: "column", gap: 4 }}>
                    <p style={{
                      margin: 0,
                      font: "500 0.75rem/1 var(--font-family-body, 'Inter', sans-serif)",
                      color: "var(--color-text-2, #6B7280)",
                      textTransform: "uppercase",
                      letterSpacing: "0.05em",
                    }}>
                      Variación Neta
                    </p>
                    <p style={{
                      margin: 0,
                      font: "700 1.1rem/1 var(--font-family-display, 'Inter', sans-serif)",
                      color: snapshot.variacionNeta >= 0 ? "#22C55E" : "#EF4444",
                    }}>
                      {snapshot.variacionNeta >= 0 ? "+" : ""}
                      {snapshot.variacionNeta}
                    </p>
                  </div>
                </div>

                {/* Warning */}
                <div style={{
                  padding: "12px",
                  background: "rgba(239, 68, 68, 0.08)",
                  border: "1px solid rgba(239, 68, 68, 0.2)",
                  borderRadius: 8,
                }}>
                  <p style={{
                    margin: 0,
                    font: "400 0.85rem/1.5 var(--font-family-body, 'Inter', sans-serif)",
                    color: "#EF4444",
                  }}>
                    ⚠️ Una vez cerrado, este reporte queda guardado y ya no podés cambiar los números.
                  </p>
                </div>

                {/* Error message */}
                {closeError && (
                  <div style={{
                    padding: "12px",
                    background: "rgba(239, 68, 68, 0.08)",
                    border: "1px solid rgba(239, 68, 68, 0.2)",
                    borderRadius: 8,
                  }}>
                    <p style={{
                      margin: 0,
                      font: "400 0.85rem/1.5 var(--font-family-body, 'Inter', sans-serif)",
                      color: "#EF4444",
                    }}>
                      {closeError}
                    </p>
                  </div>
                )}

                    {/* Buttons */}
                    <div style={{
                      display: "flex",
                      gap: 12,
                      justifyContent: "flex-end",
                    }}>
                      <button
                        onClick={() => setShowCloseModal(false)}
                        disabled={closeLoading}
                        style={{
                          padding: "10px 20px",
                          borderRadius: 8,
                          background: "var(--bg-card, #FFFFFF)",
                          border: "1px solid rgba(15,17,21,0.1)",
                          font: "600 0.9rem/1 var(--font-family-body, 'Inter', sans-serif)",
                          color: "var(--color-text-1, #1A1D23)",
                          cursor: closeLoading ? "not-allowed" : "pointer",
                          opacity: closeLoading ? 0.5 : 1,
                          transition: "opacity 0.15s",
                        }}
                      >
                        Cancelar
                      </button>
                      <button
                        onClick={handleClose}
                        disabled={closeLoading}
                        style={{
                          padding: "10px 20px",
                          borderRadius: 8,
                          background: "#EA7822",
                          color: "white",
                          border: "none",
                          font: "600 0.9rem/1 var(--font-family-body, 'Inter', sans-serif)",
                          cursor: closeLoading ? "not-allowed" : "pointer",
                          opacity: closeLoading ? 0.7 : 1,
                          transition: "opacity 0.15s",
                        }}
                      >
                        {closeLoading ? "Cerrando..." : `Cerrar ${monthName} ${year}`}
                      </button>
                    </div>
                  </>
                )}
              </div>
            </div>
          )}
        </>
      ) : (
        <div className="dashboard-card" style={{
          padding: "24px 16px",
          textAlign: "center",
        }}>
          <p style={{
            margin: 0,
            font: "400 0.9rem/1.5 var(--font-family-body, 'Inter', sans-serif)",
            color: "var(--color-text-2, #6B7280)",
          }}>
            Error al cargar el reporte. Por favor, intenta nuevamente.
          </p>
        </div>
      )}
    </div>
  );
}
