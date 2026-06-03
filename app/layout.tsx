import type { Metadata } from "next";
import { Inter, JetBrains_Mono } from "next/font/google";
import { SpeedInsights } from "@vercel/speed-insights/next";
import { Analytics } from "@vercel/analytics/next";
import { CookieBanner } from "@/components/cookie-banner";
import { BrandConfirmProvider } from "@/components/brand-confirm";
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

const SITE_DESCRIPTION =
  "FitGrowX es un software de gestión y crecimiento para gimnasios en LATAM que centraliza alumnos, cobros, WhatsApp, QR, staff, clases y app del alumno.";

export const metadata: Metadata = {
  metadataBase: new URL("https://fitgrowx.com"),
  title: "FitGrowX — Software de gestión para gimnasios en LATAM",
  description: SITE_DESCRIPTION,
  keywords: [
    "software para gimnasios",
    "gestión de gimnasios",
    "cobros gimnasio",
    "WhatsApp gimnasio",
    "app alumno gimnasio",
    "software gimnasio Argentina",
    "software gimnasio México",
  ],
  icons: {
    icon: "/favicon.ico",
  },
  alternates: {
    canonical: "/",
    languages: {
      "es-AR": "/",
      "es-MX": "/",
      "es-CO": "/",
      "es-CL": "/",
      "es-UY": "/",
    },
  },
  openGraph: {
    type: "website",
    siteName: "FitGrowX",
    title: "FitGrowX — Software de gestión para gimnasios en LATAM",
    description: SITE_DESCRIPTION,
    url: "https://fitgrowx.com",
    locale: "es_AR",
    images: [
      {
        url: "/images/og-fitgrowx.png",
        width: 1200,
        height: 630,
        alt: "FitGrowX — Software de gestión para gimnasios en LATAM",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: "FitGrowX — Software de gestión para gimnasios en LATAM",
    description: SITE_DESCRIPTION,
    images: ["/images/og-fitgrowx.png"],
  },
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="es" className={`h-full antialiased ${inter.variable} ${jetbrainsMono.variable}`} style={{ backgroundColor: "#050505" }}>
      <head>
        <meta name="theme-color" content="#050505" />
      </head>
      <body className="min-h-full"><BrandConfirmProvider>{children}</BrandConfirmProvider><SpeedInsights /><Analytics /><CookieBanner /></body>
    </html>
  );
}
