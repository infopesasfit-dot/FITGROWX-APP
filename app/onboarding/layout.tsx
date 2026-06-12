import type { Metadata } from "next";
import { headers } from "next/headers";

export const metadata: Metadata = {
  robots: { index: false, follow: false },
};

export const dynamic = "force-dynamic";

export default async function OnboardingLayout({ children }: { children: React.ReactNode }) {
  await headers();
  return children;
}
