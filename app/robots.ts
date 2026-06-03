import type { MetadataRoute } from "next";

export default function robots(): MetadataRoute.Robots {
  return {
    rules: {
      userAgent: "*",
      allow: [
        "/",
        "/guia",
        "/faq",
        "/reseller",
        "/privacidad",
        "/terminos",
        "/gym/",
      ],
      disallow: [
        "/dashboard",
        "/platform",
        "/alumno",
        "/api",
        "/onboarding",
        "/start",
      ],
    },
    sitemap: "https://fitgrowx.com/sitemap.xml",
  };
}
