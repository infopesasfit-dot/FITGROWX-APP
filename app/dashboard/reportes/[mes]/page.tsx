"use client";

import React, { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { getCachedProfile } from "@/lib/gym-cache";
import { supabase } from "@/lib/supabase";
import { useIsDesktop } from "@/hooks/useIsDesktop";
import { MONTH_NAMES, fmt } from "@/lib/dashboard-helpers";

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
        setIsCurrent(year === currentYear && month === currentMonth);
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
          {isCurrent ? "Reporte en curso" : "Reporte completado"}
        </p>
      </header>

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
              📊 Métricas y charts próximamente
            </p>
          </div>
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
