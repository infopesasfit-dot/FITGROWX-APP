import type { ReactNode } from "react";
import PlatformHeader from "./components/PlatformHeader";

export default function PlatformLayout({ children }: { children: ReactNode }) {
  return (
    <main
      style={{
        minHeight: "100vh",
        background: "linear-gradient(180deg, #eef2f6 0%, #e7ecf2 100%)",
        color: "#111827",
      }}
    >
      <PlatformHeader />
      {children}
    </main>
  );
}
