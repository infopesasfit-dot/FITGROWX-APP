import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  allowedDevOrigins: ["sugar-overcome-bunch.ngrok-free.dev"],
  images: {
    remotePatterns: [
      {
        protocol: "https",
        hostname: "images.unsplash.com",
      },
      {
        protocol: "https",
        hostname: "lazsjmwjnsgvibpyagcr.supabase.co",
      },
    ],
  },
};

export default nextConfig;
