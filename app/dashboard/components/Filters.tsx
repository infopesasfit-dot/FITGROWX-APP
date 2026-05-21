import React from "react";

interface FiltersProps {
  compact?: boolean;
  selectedMonth: Date;
  isCurrentMonth: boolean;
  fetchedAtLabel: string | null;
  waBadge: { text: string; color: string; bg: string; border: string; dot: string; href: string | null } | null;
  cronSyncLabel: { text: string; stale: boolean };
  lastCronRun: { summary?: string | null } | null;
  fb: string;
  t1: string;
  t2: string;
  t3: string;
  onPrevMonth: () => void;
  onNextMonth: () => void;
}

export function Filters({
  compact = false,
  selectedMonth,
  isCurrentMonth,
  fetchedAtLabel,
  waBadge,
  cronSyncLabel,
  lastCronRun,
  fb,
  t1,
  t2,
  t3,
  onPrevMonth,
  onNextMonth,
}: FiltersProps) {
  const MONTH_NAMES = ["Enero", "Febrero", "Marzo", "Abril", "Mayo", "Junio", "Julio", "Agosto", "Septiembre", "Octubre", "Noviembre", "Diciembre"];

  return (
    <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap", justifyContent: "flex-end" }}>
      <div style={{ display: "inline-flex", alignItems: "center", gap: 2, background: "#F5F7FA", borderRadius: compact ? 14 : 16, padding: 4, border: "1px solid rgba(17,24,39,0.06)" }}>
        <button
          onClick={onPrevMonth}
          style={{
            width: compact ? 28 : 32,
            height: compact ? 28 : 32,
            borderRadius: compact ? 9 : 10,
            border: "none",
            background: "transparent",
            cursor: "pointer",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            color: t2,
            fontSize: 14,
          }}
        >
          ‹
        </button>
        <span style={{ font: `700 ${compact ? "0.72rem" : "0.76rem"}/1 ${fb}`, color: t1, minWidth: compact ? 110 : 130, textAlign: "center", padding: "0 4px" }}>
          {MONTH_NAMES[selectedMonth.getMonth()]} {selectedMonth.getFullYear()}
        </span>
        <button
          onClick={onNextMonth}
          disabled={isCurrentMonth}
          style={{
            width: compact ? 28 : 32,
            height: compact ? 28 : 32,
            borderRadius: compact ? 9 : 10,
            border: "none",
            background: "transparent",
            cursor: isCurrentMonth ? "default" : "pointer",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            color: isCurrentMonth ? t3 : t2,
            fontSize: 14,
          }}
        >
          ›
        </button>
      </div>

      {fetchedAtLabel && !compact && <span style={{ font: `400 0.68rem/1 ${fb}`, color: t3, whiteSpace: "nowrap" }}>{fetchedAtLabel}</span>}

      {waBadge &&
        (waBadge.href ? (
          <a
            href={waBadge.href}
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: 4,
              font: `500 0.68rem/1 ${fb}`,
              color: waBadge.color,
              background: waBadge.bg,
              border: `1px solid ${waBadge.border}`,
              borderRadius: 6,
              padding: "3px 7px",
              whiteSpace: "nowrap",
              textDecoration: "none",
              cursor: "pointer",
            }}
          >
            <span style={{ width: 5, height: 5, borderRadius: "50%", background: waBadge.dot, flexShrink: 0 }} />
            {waBadge.text}
          </a>
        ) : (
          <span
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: 4,
              font: `500 0.68rem/1 ${fb}`,
              color: waBadge.color,
              background: waBadge.bg,
              border: `1px solid ${waBadge.border}`,
              borderRadius: 6,
              padding: "3px 7px",
              whiteSpace: "nowrap",
            }}
          >
            <span style={{ width: 5, height: 5, borderRadius: "50%", background: waBadge.dot, flexShrink: 0 }} />
            {waBadge.text}
          </span>
        ))}

      {!compact && (
        <span
          title={lastCronRun?.summary ?? undefined}
          style={{
            display: "inline-flex",
            alignItems: "center",
            gap: 4,
            font: `500 0.68rem/1 ${fb}`,
            color: cronSyncLabel.stale ? "#DC2626" : "#16A34A",
            background: cronSyncLabel.stale ? "rgba(220,38,38,0.07)" : "rgba(22,163,74,0.07)",
            border: `1px solid ${cronSyncLabel.stale ? "rgba(220,38,38,0.18)" : "rgba(22,163,74,0.18)"}`,
            borderRadius: 6,
            padding: "3px 7px",
            whiteSpace: "nowrap",
            cursor: lastCronRun?.summary ? "help" : "default",
          }}
        >
          <span style={{ width: 5, height: 5, borderRadius: "50%", background: cronSyncLabel.stale ? "#DC2626" : "#16A34A", flexShrink: 0 }} />
          {cronSyncLabel.text}
        </span>
      )}
    </div>
  );
}
