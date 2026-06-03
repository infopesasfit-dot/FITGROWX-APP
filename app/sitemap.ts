import type { MetadataRoute } from "next";

const BASE_URL = "https://fitgrowx.com";

export default function sitemap(): MetadataRoute.Sitemap {
  const lastModified = new Date();

  return [
    { url: `${BASE_URL}/`, lastModified, changeFrequency: "monthly", priority: 1.0 },
    { url: `${BASE_URL}/guia`, lastModified, changeFrequency: "weekly", priority: 0.9 },
    { url: `${BASE_URL}/reseller`, lastModified, changeFrequency: "monthly", priority: 0.9 },
    { url: `${BASE_URL}/faq`, lastModified, changeFrequency: "monthly", priority: 0.7 },
    { url: `${BASE_URL}/privacidad`, lastModified, changeFrequency: "monthly", priority: 0.7 },
    { url: `${BASE_URL}/terminos`, lastModified, changeFrequency: "monthly", priority: 0.7 },
  ];
}
