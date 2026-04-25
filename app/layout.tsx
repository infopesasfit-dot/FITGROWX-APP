import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";

const inter = Inter({
  subsets: ["latin"],
  variable: "--font-inter",
  display: "swap",
});

export const metadata: Metadata = {
  title: "FitGrowX | Software y crecimiento para gimnasios",
  description:
    "FitGrowX combina gestion, cobros por WhatsApp y una Boveda de Crecimiento para ayudar a los gimnasios a recuperar el control y escalar.",
  icons: {
    icon: "/images/logo-favicon-fitgrowx.png",
    apple: "/images/logo-favicon-fitgrowx.png",
  },
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="es" className={`h-full antialiased ${inter.variable}`} style={{ backgroundColor: "#050505" }}>
      <head>
        <meta name="theme-color" content="#050505" />
      </head>
      <body className="min-h-full">{children}</body>
    </html>
  );
}
