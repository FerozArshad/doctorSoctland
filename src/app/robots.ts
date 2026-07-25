import type { MetadataRoute } from "next";

const APP_URL = (process.env.APP_URL || "https://dashboard.dentalscotland.com").replace(/\/$/, "");

export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      {
        userAgent: "*",
        allow: ["/privacy-policy", "/login"],
        disallow: ["/admin/", "/api/", "/p/"],
      },
    ],
    sitemap: `${APP_URL}/sitemap.xml`,
  };
}
