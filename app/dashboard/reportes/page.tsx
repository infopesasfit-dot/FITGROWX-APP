"use client";

import React, { useState, useEffect } from "react";
import Link from "next/link";
import { ChevronRight } from "lucide-react";
import { getCachedProfile } from "@/lib/gym-cache";
import { supabase } from "@/lib/supabase";
import { useIsDesktop } from "@/hooks/useIsDesktop";
import { MONTH_NAMES } from "@/lib/dashboard-helpers";

// ── Skeleton ──────────────────────────────────────────────────────────────────
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

// ── Month Row ─────────────────────────────────────────────────────────────────
interface MonthRowProps {
  year: number;
  month: number;
  isCurrent: boolean;
  isClosed: boolean;
  isLast: boolean;
  isDesktop: boolean;
}

function MonthRow({ year, month, isCurrent, isClosed, isLast, isDesktop }: MonthRowProps) {
  const monthName = MONTH_NAMES[month];
  const yearMonth = `${year}-${String(month + 1).padStart(2, "0")}`;
  const href = `/dashboard/reportes/${yearMonth}`;

  return (
    <Link href={href} style={{
      display: "block",
      textDecoration: "none",
      borderBottom: isLast ? "none" : "1px solid rgba(15,17,21,0.06)",
    }}>
      <div style={{
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        gap: 12,
        padding: isDesktop ? "20px 22px" : "16px 18px",
        cursor: "pointer",
        transition: "background 0.15s",
      }}
      onMouseEnter={(e) => {
        const el = e.currentTarget;
        el.style.background = "rgba(15,17,21,0.02)";
      }}
      onMouseLeave={(e) => {
        const el = e.currentTarget;
        el.style.background = "transparent";
      }}>
        {/* Left: Title + Tag */}
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{
            display: "flex",
            alignItems: "center",
            gap: 8,
            marginBottom: 4,
          }}>
            <h3 style={{
              margin: 0,
              font: "600 1rem/1 var(--font-family-display, 'Inter', sans-serif)",
              color: "var(--color-text-1, #1A1D23)",
            }}>
              {monthName} {year}
            </h3>
            <span style={{
              display: "inline-flex",
              alignItems: "center",
              gap: 4,
              padding: "3px 8px",
              borderRadius: 9999,
              fontSize: "0.75rem",
              fontWeight: 600,
              fontFamily: "var(--font-family-body, 'Inter', sans-serif)",
              background: isCurrent
                ? "rgba(255,122,24,0.12)"
                : isClosed
                  ? "rgba(34,197,94,0.12)"
                  : "rgba(251,191,36,0.12)",
              color: isCurrent
                ? "#FF7A18"
                : isClosed
                  ? "#22C55E"
                  : "#F59E0B",
            }}>
              {isCurrent ? "🔄 En curso" : isClosed ? "✅ Cerrado" : "⏳ Pendiente"}
            </span>
          </div>
          <p style={{
            margin: 0,
            font: "400 0.85rem/1.4 var(--font-family-body, 'Inter', sans-serif)",
            color: "var(--color-text-2, #6B7280)",
          }}>
            {isCurrent
              ? "Disponible al cierre del mes"
              : isClosed
                ? "Reporte cerrado"
                : "Pendiente de cierre"}
          </p>
        </div>

        {/* Right: Chevron */}
        <ChevronRight size={18} color="var(--color-text-3, #9CA3AF)" style={{ flexShrink: 0 }} />
      </div>
    </Link>
  );
}

// ── Page ──────────────────────────────────────────────────────────────────────
export default function ReportesPage() {
  const isDesktop = useIsDesktop();
  const [loading, setLoading] = useState(true);
  const [months, setMonths] = useState<{ year: number; month: number; isCurrent: boolean; isClosed: boolean }[]>([]);
  const [gymCreatedAt, setGymCreatedAt] = useState<Date | null>(null);

  useEffect(() => {
    const fetchData = async () => {
      setLoading(true);
      const profile = await getCachedProfile();
      if (!profile) {
        setLoading(false);
        return;
      }

      const { data: gym } = await supabase
        .from("gyms")
        .select("created_at")
        .eq("id", profile.gymId)
        .maybeSingle();

      if (!gym?.created_at) {
        setLoading(false);
        return;
      }

      const createdDate = new Date(gym.created_at);
      const createdMonth = new Date(createdDate.getFullYear(), createdDate.getMonth(), 1);
      setGymCreatedAt(createdDate);

      // Generate months from created_at to today, max 6 most recent
      const today = new Date();
      const currentYear = today.getFullYear();
      const currentMonth = today.getMonth();

      const monthsList: { year: number; month: number; isCurrent: boolean }[] = [];

      // Start from current month and go backwards
      for (let i = 0; i < 6; i++) {
        const d = new Date(currentYear, currentMonth - i, 1);
        const y = d.getFullYear();
        const m = d.getMonth();

        // Stop if we've gone before gym creation
        if (d < createdMonth) break;

        monthsList.push({
          year: y,
          month: m,
          isCurrent: i === 0,
        });
      }

      // Query monthly_reports to check which months are closed
      const { data: closed } = await supabase
        .from("monthly_reports")
        .select("year_month")
        .eq("gym_id", profile.gymId);

      const closedSet = new Set(closed?.map(r => r.year_month) ?? []);

      // Add isClosed field to each month
      const monthsWithClosed = monthsList.map(({ year, month, isCurrent }) => ({
        year,
        month,
        isCurrent,
        isClosed: closedSet.has(`${year}-${String(month + 1).padStart(2, "0")}`),
      }));

      setMonths(monthsWithClosed);
      setLoading(false);
    };

    void fetchData();
  }, []);

  const hasOlderMonths = gymCreatedAt
    ? new Date(gymCreatedAt.getFullYear(), gymCreatedAt.getMonth(), 1) <
      new Date(new Date().getFullYear(), new Date().getMonth() - 5, 1)
    : false;

  return (
    <div style={{
      padding: isDesktop ? "20px 20px 28px" : "12px 10px 96px",
      display: "flex",
      flexDirection: "column",
      gap: 20,
    }}>
      {/* Style for skeleton animation */}
      <style>{`
        @keyframes skelShimmer {
          0% { background-position: -400% 0; }
          100% { background-position: 400% 0; }
        }
      `}</style>

      {/* Header */}
      <header style={{ paddingBottom: 8 }}>
        <h1 style={{
          margin: "0 0 8px",
          font: "800 2rem/1.2 var(--font-family-display, 'Inter', sans-serif)",
          color: "var(--color-text-1, #1A1D23)",
          letterSpacing: "-0.02em",
        }}>
          Reportes mensuales
        </h1>
        <p style={{
          margin: 0,
          font: "400 0.95rem/1.5 var(--font-family-body, 'Inter', sans-serif)",
          color: "var(--color-text-2, #6B7280)",
        }}>
          Ver el desempeño de tu gym mes a mes
        </p>
      </header>

      {/* Months List */}
      {loading ? (
        <div className="dashboard-card" style={{
          display: "flex",
          flexDirection: "column",
        }}>
          {[1, 2, 3].map((i) => (
            <div key={i} style={{
              padding: isDesktop ? "20px 22px" : "16px 18px",
              borderBottom: i < 3 ? "1px solid rgba(15,17,21,0.06)" : "none",
            }}>
              <Skel h={24} w="45%" r={7} />
              <div style={{ marginTop: 8 }}>
                <Skel h={16} w="70%" r={6} />
              </div>
            </div>
          ))}
        </div>
      ) : months.length > 0 ? (
        <div className="dashboard-card" style={{
          display: "flex",
          flexDirection: "column",
          overflow: "hidden",
        }}>
          {months.map(({ year, month, isCurrent, isClosed }, index) => (
            <MonthRow
              key={`${year}-${month}`}
              year={year}
              month={month}
              isCurrent={isCurrent}
              isClosed={isClosed}
              isLast={index === months.length - 1}
              isDesktop={isDesktop}
            />
          ))}
        </div>
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
            No hay reportes disponibles aún. Los reportes aparecerán cuando completes tu primer mes.
          </p>
        </div>
      )}

      {/* Older months notice */}
      {hasOlderMonths && months.length > 0 && (
        <div style={{
          padding: "14px 16px",
          borderRadius: 14,
          background: "rgba(59,130,246,0.06)",
          border: "1px solid rgba(59,130,246,0.15)",
        }}>
          <p style={{
            margin: 0,
            font: "500 0.85rem/1.5 var(--font-family-body, 'Inter', sans-serif)",
            color: "var(--color-text-2, #6B7280)",
          }}>
            📊 Para ver meses anteriores a los últimos 6,{" "}
            <a href="https://wa.me/5491164893435" target="_blank" rel="noopener noreferrer" style={{
              color: "#FF7A18",
              textDecoration: "none",
              fontWeight: 600,
            }}>
              contactá a soporte
            </a>
            .
          </p>
        </div>
      )}
    </div>
  );
}
