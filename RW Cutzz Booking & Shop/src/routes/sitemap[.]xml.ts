import { createFileRoute } from "@tanstack/react-router";
import type {} from "@tanstack/react-start";
import { businessConfig } from "@/config/business";

const BASE_URL = businessConfig.websiteUrl;

const entries = [
  { path: "/", changefreq: "weekly", priority: "1.0" },
  { path: "/diensten", changefreq: "weekly", priority: "0.9" },
  { path: "/boeken", changefreq: "weekly", priority: "0.9" },
  { path: "/winkel", changefreq: "weekly", priority: "0.8" },
  { path: "/contact", changefreq: "monthly", priority: "0.8" },
  { path: "/privacy", changefreq: "yearly", priority: "0.2" },
  { path: "/voorwaarden", changefreq: "yearly", priority: "0.2" },
  { path: "/cookies", changefreq: "yearly", priority: "0.2" },
];

export const Route = createFileRoute("/sitemap.xml")({
  server: {
    handlers: {
      GET: async () => {
        const urls = entries.map(
          (e) =>
            `  <url>\n    <loc>${BASE_URL}${e.path}</loc>\n    <changefreq>${e.changefreq}</changefreq>\n    <priority>${e.priority}</priority>\n  </url>`,
        );
        const xml = `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${urls.join("\n")}\n</urlset>`;
        return new Response(xml, {
          headers: {
            "Content-Type": "application/xml",
            "Cache-Control": "public, max-age=3600",
          },
        });
      },
    },
  },
});
