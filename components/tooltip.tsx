"use client";

import { ReactNode, useState } from "react";

export function Tooltip({ content, children }: { content: string; children: ReactNode }) {
  const [visible, setVisible] = useState(false);
  return (
    <div style={{ position: "relative", display: "inline-flex" }}
      onMouseEnter={() => setVisible(true)}
      onMouseLeave={() => setVisible(false)}
    >
      {children}
      {visible && (
        <div style={{
          position: "absolute",
          bottom: "calc(100% + 6px)",
          left: "50%",
          transform: "translateX(-50%)",
          background: "#1A1D23",
          color: "#FFFFFF",
          fontSize: "0.695rem",
          fontWeight: 500,
          padding: "5px 9px",
          borderRadius: 6,
          whiteSpace: "nowrap",
          pointerEvents: "none",
          zIndex: 99999,
          boxShadow: "0 2px 8px rgba(0,0,0,0.22)",
          letterSpacing: "0.01em",
          lineHeight: 1,
        }}>
          {content}
          <div style={{
            position: "absolute",
            top: "100%",
            left: "50%",
            transform: "translateX(-50%)",
            width: 0,
            height: 0,
            borderLeft: "4px solid transparent",
            borderRight: "4px solid transparent",
            borderTop: "4px solid #1A1D23",
          }} />
        </div>
      )}
    </div>
  );
}
