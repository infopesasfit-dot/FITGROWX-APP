import React from "react";
import { Activity, ClipboardList, Clock, UserPlus } from "lucide-react";
import { useIsDesktop } from "@/hooks/useIsDesktop";

interface QuickActionsProps {
  asistHoy: number;
  alerts: { upcomingExpirations: any[] };
  accentDeep: string;
}

export function QuickActions({
  asistHoy,
  alerts,
  accentDeep,
}: QuickActionsProps) {
  const isDesktop = useIsDesktop();
  const actions = [
    {
      icon: <Activity size={16} color="var(--color-text-2)" />,
      iconBg: "rgba(15,17,21,0.06)",
      label: `${asistHoy} asistencia${asistHoy !== 1 ? "s" : ""} hoy`,
      hint: "Resumen del día",
      href: "/dashboard/asistencias",
      shortcut: null as string | null,
    },
    {
      icon: <ClipboardList size={16} color="var(--color-text-2)" />,
      iconBg: "rgba(15,17,21,0.06)",
      label: "Cargar egreso",
      hint: "Gasto del día",
      href: "/dashboard/egresos",
      shortcut: null as string | null,
    },
    {
      icon: <Clock size={16} color={alerts.upcomingExpirations.length > 0 ? "#16A34A" : "#16A34A"} />,
      iconBg: "rgba(22,163,74,0.10)",
      label: alerts.upcomingExpirations.length > 0 ? `${alerts.upcomingExpirations.length} vencen pronto` : "Sin vencimientos",
      hint: alerts.upcomingExpirations.length > 0 ? "Contactalos antes que venzan" : "Todo al día",
      href: "/dashboard/alumnos",
      shortcut: null as string | null,
    },
    {
      icon: <UserPlus size={16} color={accentDeep} />,
      iconBg: "rgba(255,122,24,0.12)",
      label: "Cargar alumno",
      hint: "Atajo · A",
      href: "/dashboard/alumnos",
      shortcut: "A" as string,
    },
  ];

  return (
    <div style={{ display: "grid", gridTemplateColumns: !isDesktop ? "1fr" : "1fr 1fr", gap: 10 }}>
      {actions.map((a) => {
        const isCargaAlumno = a.label === "Cargar alumno";
        return (
          <a
            key={a.label}
            href={a.href}
            className="dashboard-card"
            style={{
              display: "flex",
              alignItems: "center",
              gap: 12,
              padding: isCargaAlumno ? "10px 12px" : "14px 16px",
              textDecoration: "none",
              color: "inherit",
              cursor: "pointer",
            }}
          >
            <div
              style={{
                width: isCargaAlumno ? 28 : 34,
                height: isCargaAlumno ? 28 : 34,
                borderRadius: 10,
                background: a.iconBg,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                flexShrink: 0,
              }}
            >
              {React.cloneElement(a.icon, { size: isCargaAlumno ? 14 : 16 })}
            </div>
            <div style={{ flex: 1, minWidth: 0 }}>
              <p style={{ font: `600 0.82rem/1.2 var(--font-family-display)`, color: "var(--color-text-1)", margin: 0, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                {a.label}
              </p>
              <p style={{ font: `500 0.68rem/1.3 var(--font-family-body)`, color: "var(--color-text-3)", margin: 0 }}>{a.hint}</p>
            </div>
            {a.shortcut && (
              <kbd
                style={{
                  font: `700 0.62rem/1 var(--font-family-body)`,
                  color: "var(--color-text-3)",
                  background: "rgba(15,17,21,0.06)",
                  border: "1px solid rgba(15,17,21,0.10)",
                  borderRadius: 5,
                  padding: "3px 6px",
                  flexShrink: 0,
                }}
              >
                {a.shortcut}
              </kbd>
            )}
          </a>
        );
      })}
    </div>
  );
}
