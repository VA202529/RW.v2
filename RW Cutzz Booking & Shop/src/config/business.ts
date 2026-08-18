export type OpeningHoursEntry = {
  day: string;
  schemaDay: string;
  opens?: string;
  closes?: string;
  closed?: boolean;
};

export type PublicService = {
  id: string;
  name: string;
  description: string;
  priceCents: number;
  depositCents: number;
  durationMinutes: number;
};

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
    streetAddress: "Mariëndaal 94",
    postalCode: "1025 BW",
    locality: "Amsterdam",
    region: "Noord-Holland",
    countryName: "Nederland",
    countryCode: "NL",
    mapsUrl:
      "https://www.google.com/maps/search/?api=1&query=Mari%C3%ABndaal%2094%2C%201025%20BW%20Amsterdam%2C%20Nederland",
  },
  legalLocation: {
    label: "Juridisch vestigingsadres",
    streetAddress: "Mariëndaal 94",
    postalCode: "1025 BW",
    locality: "Amsterdam",
    countryName: "Nederland",
  },
  socials: {
    instagram: "https://www.instagram.com/rwcutzzz",
    tiktok: "https://www.tiktok.com/@chanoroch",
    snapchat: "https://www.snapchat.com/add/roch.nwd",
  },
  openingHours: [
    { day: "Maandag", schemaDay: "Monday", closed: true },
    { day: "Dinsdag", schemaDay: "Tuesday", opens: "10:00", closes: "15:00" },
    { day: "Woensdag", schemaDay: "Wednesday", opens: "10:00", closes: "17:00" },
    { day: "Donderdag", schemaDay: "Thursday", opens: "10:00", closes: "15:00" },
    { day: "Vrijdag", schemaDay: "Friday", opens: "10:00", closes: "17:00" },
    { day: "Zaterdag", schemaDay: "Saturday", opens: "12:00", closes: "17:00" },
    { day: "Zondag", schemaDay: "Sunday", closed: true },
  ] satisfies OpeningHoursEntry[],
  seo: {
    defaultTitle: "RW CUTZZ | Kapper & Barbershop in Amsterdam-Noord",
    defaultDescription:
      "RW CUTZZ is een kapper en barbershop in Amsterdam-Noord. Boek online je knipbeurt, baardtrim of design bij de tijdelijke locatie aan Mariëndaal 94.",
    locale: "nl_NL",
  },
} as const;

export const publicServices: PublicService[] = [
  {
    id: "knippen",
    name: "Knippen",
    description: "Strakke knipbeurt met persoonlijke afwerking.",
    priceCents: 3000,
    depositCents: 900,
    durationMinutes: 30,
  },
  {
    id: "knippen-baard",
    name: "Knippen + Baard",
    description: "Complete fresh-up voor haar en baard.",
    priceCents: 4500,
    depositCents: 1350,
    durationMinutes: 45,
  },
  {
    id: "baard-trimmen",
    name: "Baard trimmen",
    description: "Baardtrim met nette lijnen en verzorgde finish.",
    priceCents: 2000,
    depositCents: 600,
    durationMinutes: 20,
  },
  {
    id: "kids-knippen",
    name: "Kids knippen t/m 12 jaar",
    description: "Knipbeurt voor kinderen tot en met 12 jaar.",
    priceCents: 2250,
    depositCents: 675,
    durationMinutes: 30,
  },
  {
    id: "design-lines",
    name: "Design / Lines",
    description: "Creatieve lijnen of design als strakke finishing touch.",
    priceCents: 3500,
    depositCents: 1050,
    durationMinutes: 30,
  },
];

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
  return businessConfig.openingHours
    .map((entry) =>
      entry.closed ? `${entry.day}: gesloten` : `${entry.day}: ${entry.opens}-${entry.closes}`,
    )
    .join(separator);
}
