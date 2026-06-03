import type { Metadata, Viewport } from "next";
import { PwaShell } from "@/components/alumno/PwaShell";

export const metadata: Metadata = {
  title: "Mi Panel | FitGrowX",
  description: "Tu panel de entrenamiento y membresía",
  robots: { index: false, follow: false },
  manifest: "/manifest.json",
  appleWebApp: {
    capable: true,
    statusBarStyle: "black-translucent",
    title: "FitGrowX",
  },
  icons: {
    apple: "/images/logo-favicon-fitgrowx.png",
  },
};

export const viewport: Viewport = {
  themeColor: "#F97316",
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
};

export default function AlumnoLayout({ children }: { children: React.ReactNode }) {
  return <PwaShell>{children}</PwaShell>;
}
