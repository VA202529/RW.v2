const env = import.meta.env;

const activeAddress = parseAddress(env.VITE_ADDRESS as string | undefined);

export const businessConfig = {
  businessName: "RW CUTZZ",
  alternateName: "RWCUTZZ",
  tagline: "Fresher Than Clean",
  category: "HairSalon",
  websiteUrl: "https://rwcutzz.com",
  vercelUrl: "https://rw-v2-website.vercel.app",
  kvk: "94077991",
  legalForm: "Eenmanszaak",
  phoneDisplay: "+31 6 18954868",
  phoneMachine: "+31618954868",
  email: "info@rwcutzz.com",
  activeLocation: {
    label: "Tijdelijke salonlocatie",
    streetAddress: activeAddress.streetAddress,
    postalCode: activeAddress.postalCode,
    locality: activeAddress.locality,
    region: "Noord-Holland",
    countryName: "Nederland",
    countryCode: "NL",
    mapsUrl: `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(activeAddress.fullAddress + ", Nederland")}`,
  },
  legalLocation: {
    label: "Juridisch vestigingsadres",
    streetAddress: activeAddress.streetAddress,
    postalCode: activeAddress.postalCode,
    locality: activeAddress.locality,
    countryName: "Nederland",
  },
  socials: {
    instagram: (env.VITE_INSTAGRAM_URL as string | undefined) ?? "",
    tiktok: (env.VITE_TIKTOK_URL as string | undefined) ?? "",
    snapchat: (env.VITE_SNAPCHAT_URL as string | undefined) ?? "",
  },
  openingHours: (env.VITE_OPENING_HOURS as string | undefined) ?? "",
  seo: {
    defaultTitle: "RW CUTZZ | Kapper & Barbershop in Amsterdam-Noord",
    defaultDescription: `RW CUTZZ is een kapper en barbershop in Amsterdam-Noord. Boek online je afspraak bij de tijdelijke locatie aan ${activeAddress.streetAddress}.`,
    locale: "nl_NL",
  },
} as const;

export function centsToPrice(cents: number) {
  return new Intl.NumberFormat("nl-NL", {
    style: "currency",
    currency: "EUR",
  }).format(cents / 100);
}

export function formatActiveAddress(separator = ", ") {
  const { activeLocation } = businessConfig;
  return [
    activeLocation.streetAddress,
    `${activeLocation.postalCode} ${activeLocation.locality}`,
    activeLocation.countryName,
  ].join(separator);
}

export function formatLegalAddress(separator = ", ") {
  const { legalLocation } = businessConfig;
  return [
    legalLocation.streetAddress,
    `${legalLocation.postalCode} ${legalLocation.locality}`,
    legalLocation.countryName,
  ].join(separator);
}

export function formatOpeningHours(separator = "\n") {
  return businessConfig.openingHours.replaceAll(" | ", separator);
}

function parseAddress(value: string | undefined) {
  const fullAddress = value ?? "";
  const parts = fullAddress.split(",").map((part) => part.trim()).filter(Boolean);
  const streetAddress = parts[0] ?? "";
  const postalAndLocality = parts[1] ?? "";
  const match = postalAndLocality.match(/^(\d{4}\s?[A-Z]{2})\s+(.+)$/i);

  return {
    fullAddress,
    streetAddress,
    postalCode: match?.[1] ?? "",
    locality: match?.[2] ?? postalAndLocality,
  };
}
