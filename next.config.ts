import type { NextConfig } from "next";

// CSP is set per-request by middleware.ts using nonces (see middleware.ts).
const securityHeaders = [
  // X-Frame-Options se aplica por ruta abajo:
  // - DENY para todo el sitio
  // - SAMEORIGIN solo para /alumno/auth, usado por /dashboard/preview
  // El browser no intenta adivinar el Content-Type
  { key: "X-Content-Type-Options", value: "nosniff" },
  // Fuerza HTTPS por 1 año en todos los subdominios
  { key: "Strict-Transport-Security", value: "max-age=31536000; includeSubDomains; preload" },
  // No envía el Referer completo a dominios externos
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  // Desactiva APIs sensibles que no se usan
  { key: "Permissions-Policy", value: "camera=(self), microphone=(), geolocation=()" },
  // Protección XSS básica para browsers legacy
  { key: "X-XSS-Protection", value: "1; mode=block" },
];

const nextConfig: NextConfig = {
  images: {
    formats: ["image/avif", "image/webp"],
    remotePatterns: [
      { protocol: "https", hostname: "images.unsplash.com" },
      { protocol: "https", hostname: "*.supabase.co", pathname: "/storage/v1/**" },
    ],
  },
  async headers() {
    return [
      {
        source: "/:path((?!alumno/auth$).*)",
        headers: [
          { key: "X-Frame-Options", value: "DENY" },
          ...securityHeaders,
        ],
      },
      {
        source: "/alumno/auth",
        headers: [
          { key: "X-Frame-Options", value: "SAMEORIGIN" },
          ...securityHeaders,
        ],
      },
    ];
  },
};

export default nextConfig;
