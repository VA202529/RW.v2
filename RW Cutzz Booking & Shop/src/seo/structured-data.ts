import {
  businessConfig,
  centsToPrice,
  formatActiveAddress,
  publicServices,
  type PublicService,
} from "@/config/business";
import { canonicalUrl } from "@/seo/metadata";
import type { Product } from "@/lib/api/types";

export function websiteJsonLd() {
  return {
    "@context": "https://schema.org",
    "@type": "WebSite",
    name: businessConfig.businessName,
    alternateName: businessConfig.alternateName,
    url: businessConfig.websiteUrl,
    inLanguage: "nl-NL",
  };
}

export function hairSalonJsonLd() {
  const { activeLocation } = businessConfig;

  return {
    "@context": "https://schema.org",
    "@type": "HairSalon",
    "@id": `${businessConfig.websiteUrl}/#hairsalon`,
    name: businessConfig.businessName,
    alternateName: businessConfig.alternateName,
    slogan: businessConfig.tagline,
    url: businessConfig.websiteUrl,
    telephone: businessConfig.phoneMachine,
    email: businessConfig.email,
    address: {
      "@type": "PostalAddress",
      streetAddress: activeLocation.streetAddress,
      postalCode: activeLocation.postalCode,
      addressLocality: activeLocation.locality,
      addressRegion: activeLocation.region,
      addressCountry: activeLocation.countryCode,
    },
    areaServed: "Amsterdam-Noord",
    priceRange: "EUR 20-45",
    openingHoursSpecification: businessConfig.openingHours
      .filter((entry) => !entry.closed)
      .map((entry) => ({
        "@type": "OpeningHoursSpecification",
        dayOfWeek: entry.schemaDay,
        opens: entry.opens,
        closes: entry.closes,
      })),
    sameAs: [businessConfig.socials.instagram, businessConfig.socials.tiktok],
    hasOfferCatalog: {
      "@type": "OfferCatalog",
      name: "Barberdiensten",
      itemListElement: publicServices.map((service) => serviceOfferJsonLd(service)),
    },
  };
}

export function serviceOfferJsonLd(service: PublicService) {
  return {
    "@type": "Offer",
    name: service.name,
    description: service.description,
    price: (service.priceCents / 100).toFixed(2),
    priceCurrency: "EUR",
    url: canonicalUrl(`/boeken?service=${service.id}`),
  };
}

export function webPageJsonLd(path: string, name: string, description: string) {
  return {
    "@context": "https://schema.org",
    "@type": "WebPage",
    name,
    description,
    url: canonicalUrl(path),
    isPartOf: {
      "@type": "WebSite",
      name: businessConfig.businessName,
      url: businessConfig.websiteUrl,
    },
  };
}

export function productJsonLd(product: Product) {
  const image = product.image_paths?.[0];

  return {
    "@context": "https://schema.org",
    "@type": "Product",
    name: product.name,
    description: product.description,
    image: image ? [image] : undefined,
    sku: product.id,
    brand: {
      "@type": "Brand",
      name: businessConfig.businessName,
    },
    offers: {
      "@type": "Offer",
      price: (product.price_cents / 100).toFixed(2),
      priceCurrency: "EUR",
      availability:
        product.stock > 0 ? "https://schema.org/InStock" : "https://schema.org/OutOfStock",
      url: canonicalUrl(`/winkel/${product.id}`),
    },
  };
}

export const activeAddressText = formatActiveAddress();
export const servicePriceSummary = publicServices
  .map((service) => `${service.name} ${centsToPrice(service.priceCents)}`)
  .join(", ");
