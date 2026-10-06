import type { MetadataRoute } from "next";
import { siteUrl } from "@/lib/site";

export default function robots(): MetadataRoute.Robots {
  const base = siteUrl();
  return {
    // Signed-in pages and the API have nothing for search engines.
    rules: { userAgent: "*", allow: "/", disallow: ["/api/", "/dashboard", "/onboarding"] },
    sitemap: new URL("/sitemap.xml", base).toString()
  };
}
