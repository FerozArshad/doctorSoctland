import type { MetadataRoute } from "next";

const APP_URL = (process.env.APP_URL || "https://dashboard.dentalscotland.com").replace(/\/$/, "");

export default function sitemap(): MetadataRoute.Sitemap {
  return [
    {
      url: `${APP_URL}/privacy-policy`,
      lastModified: new Date("2026-07-25"),
      changeFrequency: "monthly",
      priority: 0.8,
    },
    {
      url: `${APP_URL}/login`,
      lastModified: new Date("2026-07-25"),
      changeFrequency: "yearly",
      priority: 0.3,
    },
  ];
}
