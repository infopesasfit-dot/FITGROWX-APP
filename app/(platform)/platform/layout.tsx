import type { ReactNode } from "react";
import type { Metadata } from "next";
import { headers } from "next/headers";
import PlatformHeader from "@/components/platform/PlatformHeader";

export const metadata: Metadata = {
  robots: { index: false, follow: false },
};

export const dynamic = "force-dynamic";

export default async function PlatformLayout({ children }: { children: ReactNode }) {
  await headers();
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
