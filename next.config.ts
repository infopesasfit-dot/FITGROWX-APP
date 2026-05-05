import type { NextConfig } from "next";

const securityHeaders = [
  // Bloquea que el sitio sea embebido en iframes (clickjacking)
  { key: "X-Frame-Options", value: "SAMEORIGIN" },
  // El browser no intenta adivinar el Content-Type
  { key: "X-Content-Type-Options", value: "nosniff" },
  // Fuerza HTTPS por 1 año en todos los subdominios
  { key: "Strict-Transport-Security", value: "max-age=31536000; includeSubDomains; preload" },
  // No envía el Referer completo a dominios externos
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  // Desactiva APIs sensibles que no se usan
  { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=()" },
  // Protección XSS básica para browsers legacy
  { key: "X-XSS-Protection", value: "1; mode=block" },
];

const nextConfig: NextConfig = {
  images: {
    remotePatterns: [
      { protocol: "https", hostname: "images.unsplash.com" },
      { protocol: "https", hostname: "lazsjmwjnsgvibpyagcr.supabase.co" },
    ],
  },
  async headers() {
    return [
      {
        source: "/(.*)",
        headers: securityHeaders,
      },
    ];
  },
};

export default nextConfig;
