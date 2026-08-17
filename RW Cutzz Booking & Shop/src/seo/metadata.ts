import { businessConfig } from "@/config/business";

type RouteHeadInput = {
  title: string;
  description: string;
  path?: string;
  robots?: string;
  type?: string;
};

export function canonicalUrl(path = "/") {
  const normalizedPath = path.startsWith("/") ? path : `/${path}`;
  return `${businessConfig.websiteUrl}${normalizedPath}`;
}

export function routeHead(input: RouteHeadInput, scripts: Array<Record<string, unknown>> = []) {
  const url = canonicalUrl(input.path ?? "/");

  return {
    meta: [
      { title: input.title },
      { name: "description", content: input.description },
      { name: "robots", content: input.robots ?? "index, follow" },
      { property: "og:locale", content: businessConfig.seo.locale },
      { property: "og:type", content: input.type ?? "website" },
      { property: "og:site_name", content: businessConfig.businessName },
      { property: "og:title", content: input.title },
      { property: "og:description", content: input.description },
      { property: "og:url", content: url },
      { name: "twitter:card", content: "summary_large_image" },
      { name: "twitter:title", content: input.title },
      { name: "twitter:description", content: input.description },
    ],
    links: [{ rel: "canonical", href: url }],
    scripts,
  };
}

export function jsonLdScript(data: unknown) {
  return {
    type: "application/ld+json",
    children: JSON.stringify(data),
  };
}
