import type { MetadataRoute } from "next";
import { SITE_URL } from "@/lib/env";

const PAGES = ["", "/fonctionnalites", "/tarifs", "/a-propos", "/contact", "/aide", "/cgu", "/confidentialite", "/cookies", "/inscription", "/connexion"];

export default function sitemap(): MetadataRoute.Sitemap {
  const base = SITE_URL || "https://menjef-pro.vercel.app";
  return PAGES.map((p) => ({ url: `${base}${p}`, changeFrequency: "monthly", priority: p === "" ? 1 : 0.6 }));
}
