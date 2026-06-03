import type { NextConfig } from "next";

const csp = [
  "default-src 'self'",
  "script-src 'self' https://challenges.cloudflare.com https://vercel.live 'sha256-OBTN3RiyCV4Bq7dFqZ5a2pAXjnCcCYeTJMO2I/LYKeo=' 'sha256-h9pw7ayhFSvjQVup3mqV1COEeT9TmrkU7tfu/mCQkKM=' 'sha256-pWjK+pVFhyoPnt6SAJ5jSlXRZiE4mDfR2lbSL0P7BIQ=' 'sha256-LK6s7mC7UWxXuaZKHhZaAhtXN46CHlOLwjQSwJ7ak+8=' 'sha256-CyexBgci/AgvFvUI1CJSlg7JCUPKih9Pund0Dehy6bo=' 'sha256-yWaW4onlAatINKSsxLGzEZgN4pe9YsxBYpsiCFi74xk=' 'sha256-crrexb2n0N/r2hOv7BH6ZmrEzVa4Uj0mvGjfT2fk0GE='",
  "style-src 'self' 'unsafe-inline'",
  "img-src 'self' data: blob: https:",
  "font-src 'self' data:",
  "connect-src 'self' https://*.supabase.co https://vitals.vercel-insights.com https://challenges.cloudflare.com",
  "frame-src https://challenges.cloudflare.com",
  "object-src 'none'",
  "base-uri 'self'",
  "frame-ancestors 'none'",
].join("; ");

const securityHeaders = [
  // Content Security Policy
  { key: "Content-Security-Policy", value: csp },
  // Bloquea que el sitio sea embebido en iframes (clickjacking)
  { key: "X-Frame-Options", value: "DENY" },
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
        source: "/(.*)",
        headers: securityHeaders,
      },
    ];
  },
};

export default nextConfig;
