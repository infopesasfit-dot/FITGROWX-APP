import type { Metadata } from "next";
import { Inter, JetBrains_Mono } from "next/font/google";
import { SpeedInsights } from "@vercel/speed-insights/next";
import "./globals.css";

const inter = Inter({
  subsets: ["latin"],
  variable: "--font-inter",
  display: "swap",
});

const jetbrainsMono = JetBrains_Mono({
  subsets: ["latin"],
  variable: "--font-mono",
  display: "swap",
});

export const metadata: Metadata = {
  title: "FitGrowX | Software y crecimiento para gimnasios",
  description:
    "FitGrowX combina gestion, cobros por WhatsApp y una Boveda de Crecimiento para ayudar a los gimnasios a recuperar el control y escalar.",
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="es" className={`h-full antialiased ${inter.variable} ${jetbrainsMono.variable}`} style={{ backgroundColor: "#050505" }}>
      <head>
        <meta name="theme-color" content="#050505" />
      </head>
      <body className="min-h-full">{children}<SpeedInsights /></body>
    </html>
  );
}
