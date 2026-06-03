import type { MetadataRoute } from "next";
import { vaultCategories, vaultResources } from "@/app/(dashboard)/dashboard/boveda/data";

const BASE_URL = "https://fitgrowx.com";

export default function sitemap(): MetadataRoute.Sitemap {
  const lastModified = new Date();

  const categoryEntries: MetadataRoute.Sitemap = vaultCategories.map((c) => ({
    url: `${BASE_URL}/recursos/${c.slug}`,
    lastModified,
    changeFrequency: "weekly",
    priority: 0.7,
  }));

  const resourceEntries: MetadataRoute.Sitemap = vaultResources.map((r) => ({
    url: `${BASE_URL}/recursos/${r.category}/${r.slug}`,
    lastModified,
    changeFrequency: "monthly",
    priority: 0.65,
  }));

  return [
    { url: `${BASE_URL}/`, lastModified, changeFrequency: "monthly", priority: 1.0 },
    { url: `${BASE_URL}/guia`, lastModified, changeFrequency: "weekly", priority: 0.9 },
    { url: `${BASE_URL}/reseller`, lastModified, changeFrequency: "monthly", priority: 0.9 },
    { url: `${BASE_URL}/faq`, lastModified, changeFrequency: "monthly", priority: 0.7 },
    { url: `${BASE_URL}/privacidad`, lastModified, changeFrequency: "monthly", priority: 0.7 },
    { url: `${BASE_URL}/terminos`, lastModified, changeFrequency: "monthly", priority: 0.7 },
    // SEO pillar pages
    { url: `${BASE_URL}/software-para-gimnasios`, lastModified, changeFrequency: "monthly", priority: 0.85 },
    { url: `${BASE_URL}/excel-vs-software-para-gimnasios`, lastModified, changeFrequency: "monthly", priority: 0.8 },
    { url: `${BASE_URL}/automatizacion-whatsapp-gimnasios`, lastModified, changeFrequency: "monthly", priority: 0.8 },
    // Public recursos library
    { url: `${BASE_URL}/recursos`, lastModified, changeFrequency: "weekly", priority: 0.8 },
    ...categoryEntries,
    ...resourceEntries,
  ];
}
