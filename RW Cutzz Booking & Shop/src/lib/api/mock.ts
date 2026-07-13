import type {
  Service,
  Product,
  Review,
  AccountData,
} from "./types";

export const mockServices: Service[] = [
  {
    id: "fade",
    name: "Classic Fade",
    description: "Strakke fade met scherpe lijnen en styling naar wens.",
    price_cents: 3000,
    duration_minutes: 30,
    buffer_minutes: 5,
    deposit_type: "fixed",
    deposit_value: 1000,
  },
  {
    id: "beard",
    name: "Baard Trim",
    description: "Baard sculpten met hete handdoek en verzorgende olie.",
    price_cents: 2000,
    duration_minutes: 20,
    buffer_minutes: 5,
    deposit_type: "fixed",
    deposit_value: 500,
  },
  {
    id: "combo",
    name: "The RW Combo",
    description: "Knippen, baard en styling. De complete behandeling.",
    price_cents: 4500,
    duration_minutes: 60,
    buffer_minutes: 10,
    deposit_type: "percentage",
    deposit_value: 30,
  },
  {
    id: "kids",
    name: "Kids Cut",
    description: "Voor jongens t/m 12 jaar. Snel en netjes.",
    price_cents: 2000,
    duration_minutes: 20,
    buffer_minutes: 5,
    deposit_type: "fixed",
    deposit_value: 500,
  },
];

export const mockProducts: Product[] = [
  {
    id: "matte-clay",
    name: "RW Matte Clay",
    description: "Sterke hold, matte finish. Perfect voor textured styles.",
    price_cents: 1995,
    stock: 12,
    image_paths: [],
    category: "Styling",
  },
  {
    id: "beard-oil",
    name: "Baardolie Oak & Cedar",
    description: "Verzorgende baardolie met houtige geur.",
    price_cents: 1495,
    stock: 3,
    image_paths: [],
    category: "Baardverzorging",
  },
  {
    id: "shampoo",
    name: "Daily Shampoo",
    description: "Milde dagelijkse shampoo voor alle haartypes.",
    price_cents: 1295,
    stock: 8,
    image_paths: [],
    category: "Verzorging",
  },
  {
    id: "cap",
    name: "RW CUTZZ Cap",
    description: "Zwarte snapback met neon blauw logo.",
    price_cents: 2495,
    stock: 5,
    image_paths: [],
    category: "Merch",
  },
  {
    id: "tee",
    name: "RW CUTZZ Tee",
    description: "100% katoen, oversized fit.",
    price_cents: 2995,
    stock: 0,
    image_paths: [],
    category: "Merch",
  },
  {
    id: "comb",
    name: "Kam & Etui",
    description: "Handgemaakte houten kam met lederen etui.",
    price_cents: 1795,
    stock: 15,
    image_paths: [],
    category: "Tools",
  },
];

export const mockReviews: Review[] = [
  {
    rating: 5,
    body: "Beste kapper van de stad. Fade zit strak en de sfeer is top.",
    first_name: "Jasper",
    last_initial: "V",
    service_name: "Classic Fade",
    created_at: new Date(Date.now() - 3 * 24 * 3600 * 1000).toISOString(),
  },
  {
    rating: 5,
    body: "Al maanden vaste klant. Altijd fresh, altijd op tijd.",
    first_name: "Mo",
    last_initial: "B",
    service_name: "The RW Combo",
    created_at: new Date(Date.now() - 14 * 24 * 3600 * 1000).toISOString(),
  },
  {
    rating: 4,
    body: "Nette knipbeurt, prettige service. Aanrader.",
    first_name: "Daan",
    last_initial: "K",
    service_name: "Classic Fade",
    created_at: new Date(Date.now() - 30 * 24 * 3600 * 1000).toISOString(),
  },
  {
    rating: 5,
    body: "Baard trim was perfect. Handdoek + olie ritueel is heerlijk.",
    first_name: "Lars",
    last_initial: "S",
    service_name: "Baard Trim",
    created_at: new Date(Date.now() - 45 * 24 * 3600 * 1000).toISOString(),
  },
];

export function mockSlots(from: string, to: string): string[] {
  const start = new Date(from);
  const end = new Date(to);
  const out: string[] = [];
  const cursor = new Date(start);
  cursor.setHours(9, 0, 0, 0);
  while (cursor <= end) {
    const day = cursor.getDay();
    // Closed Sunday (0) and Monday (1)
    if (day !== 0 && day !== 1) {
      for (let h = 9; h < 18; h++) {
        for (const m of [0, 30]) {
          const slot = new Date(cursor);
          slot.setHours(h, m, 0, 0);
          if (slot > start && Math.random() > 0.35) {
            out.push(slot.toISOString());
          }
        }
      }
    }
    cursor.setDate(cursor.getDate() + 1);
    cursor.setHours(9, 0, 0, 0);
  }
  return out;
}

export const mockAccount: AccountData = {
  customer: {
    full_name: "Sam Jansen",
    email: "sam@voorbeeld.nl",
    phone_e164: "+31612345678",
    visit_count: 7,
  },
  upcoming_bookings: [
    {
      id: "b1",
      service_name: "Classic Fade",
      starts_at: new Date(Date.now() + 3 * 24 * 3600 * 1000).toISOString(),
      deposit_cents: 1000,
      remaining_cents: 2000,
      status: "confirmed",
    },
  ],
  past_bookings: [
    {
      id: "b0",
      service_name: "The RW Combo",
      starts_at: new Date(Date.now() - 21 * 24 * 3600 * 1000).toISOString(),
      status: "completed",
      has_review: false,
    },
    {
      id: "b-1",
      service_name: "Baard Trim",
      starts_at: new Date(Date.now() - 60 * 24 * 3600 * 1000).toISOString(),
      status: "completed",
      has_review: true,
    },
  ],
  credit_cents: 500,
  orders: [
    {
      id: "o1",
      created_at: new Date(Date.now() - 5 * 24 * 3600 * 1000).toISOString(),
      items_summary: "1× RW Matte Clay, 1× Kam & Etui",
      total_cents: 3790,
      status: "ready_for_pickup",
      cancellable: true,
    },
  ],
  reviews: [
    {
      rating: 5,
      body: "Top service, altijd fresh.",
      is_visible: true,
      service_name: "Baard Trim",
      starts_at: new Date(Date.now() - 60 * 24 * 3600 * 1000).toISOString(),
    },
  ],
  notification_prefs: { whatsapp_opt_in: true, marketing_email_opt_in: false },
};
