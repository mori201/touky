import type { MetadataRoute } from "next";
import { SITE_URL } from "@/lib/env";

export default function robots(): MetadataRoute.Robots {
  return {
    rules: [{ userAgent: "*", allow: "/", disallow: ["/app", "/onboarding", "/auth", "/api", "/invitation"] }],
    sitemap: SITE_URL ? `${SITE_URL}/sitemap.xml` : undefined,
  };
}
