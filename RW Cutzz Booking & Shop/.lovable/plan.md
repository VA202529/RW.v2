## RW CUTZZ — Volledige klantwebsite (NL)

Behoud het huidige light-blue kleurenschema en design system. Voeg de nieuwe merkkleuren als accent toe: `--brand-accent: #2B3BEF` (elektrisch blauw, met glow) en gebruik `#0C0C0E` voor dark hero-secties. Alle nieuwe copy in het Nederlands. Tagline: "Fresher Than Clean".

### Architectuur

- **Mock adapter pattern** in `src/lib/api/`:
  - `client.ts` — detecteert `import.meta.env.VITE_SUPABASE_URL`. Zonder env → mock adapter met realistische NL placeholder data. Met env → echte `supabase.functions.invoke` calls.
  - Alle contracten uit spec als typed functies (`getServices`, `getSlots`, `createBookingHold`, `createCheckout`, `getProducts`, `createOrder`, `createOrderCheckout`, `getPublicReviews`, `getBookingSummary`, `submitReview`, `unsubscribe`, `getAccountData`, `cancelBooking`, `rescheduleBooking`, `updateNotificationPrefs`, `updateCustomerPhone`, `deleteAccount`, `cancelOrder`).
  - Error mapping → NL toast strings (SLOT_TAKEN, OUT_OF_STOCK, 403, 429).
- **Supabase client** lazy geladen (`src/lib/supabase.ts`) — alleen als env vars aanwezig zijn. Geen Cloud enablement nodig; backend bestaat al extern.
- **State**: React `useReducer` voor booking flow; cart in `localStorage` + Context; Tanstack Query voor data fetching.

### Pages (routes)

- `/` Home — hero (dark section met neon-blauwe CTA glow), diensten preview, over ons + openingstijden + maps iframe placeholder, reviews carousel/grid, footer met Van Appiah credit.
- `/boeken` — 4-stap flow (service → datum+tijd → gegevens → betaling) met progress bar, 15-min countdown op stap 4, Turnstile placeholder/widget, `?service=` prefill.
- `/boeken/succes` — bevestiging + .ics download + PWA hint.
- `/boeken/verlopen` — hold verlopen.
- `/winkel` — sticky afhaalmelding, product grid, voorraadbadges.
- `/winkel/$id` — product detail met carousel.
- `/winkel/checkout` — cart summary + GuestForm + herroepingsrecht.
- `/winkel/succes`, `/winkel/mislukt`.
- `/account` — magic-link login OR dashboard (aankomend, historie, tegoed, bestellingen, reviews, notificaties, account verwijderen).
- `/review/$bookingId?token=` — sterren + textarea.
- `/annuleer?token=&booking=` — tegoed of terugbetaling.
- `/uitschrijven?token=` — auto call unsubscribe.
- `/voorwaarden`, `/privacy`, `/cookies` — statische NL content met placeholders.

### Gedeelde componenten (`src/components/`)

- `SiteHeader` (vervangt SiteNav) — logo, nav (Home/Boeken/Winkel/Account), cart badge, mobile hamburger.
- `SiteFooter` — uitgebreid met openingstijden, adres, socials (env), Van Appiah credit.
- `GuestForm` — hergebruikt in booking stap 3 + winkel checkout.
- `StarRating`, `RelativeDate` (Europe/Amsterdam, `date-fns` + `nl` locale), `EmptyState`, `Skeleton` wrappers, `Countdown`, `Turnstile` wrapper.
- `CookieConsent` banner (localStorage `cookie_consent`).
- `PwaInstallPrompt` (second visit).
- `CartDrawer` + `CartContext`.

### PWA

- `public/manifest.webmanifest` (RW CUTZZ, `#2B3BEF`/`#0C0C0E`, standalone).
- Icon placeholders 192/512 in `public/icons/`.
- Service worker `public/sw.js`: cache-first app shell; network-only voor `/functions/v1/` en `/rest/v1/`; NL `offline.html` fallback.
- Registratie enkel in productie via guarded module (skill/pwa regels: nooit in Lovable preview/iframe).

### Styling

- Behoud `--brand-bg`, `--brand-surface`, `--brand-text`, `--brand-muted` (light blue thema).
- Update `--brand-accent` naar `#2B3BEF` en voeg utility voor neon glow toe (`shadow-[0_0_24px_rgba(43,59,239,0.5)]`).
- Voeg `--brand-dark: #0C0C0E` toe voor hero/dark secties met neon accent.
- Alle interacties: elektrisch blauw met subtle glow op hover van primary CTAs.

### Copy & i18n

- 100% Nederlands. Bedragen als `€X,XX` (Intl `nl-NL`). Datums via `date-fns` + `nl` locale + `Europe/Amsterdam`.
- Placeholders `[BEDRIJFSNAAM]`, `[KVK-NUMMER]`, `[ADRES]`, `[CONTACT-EMAIL]` in juridische pagina's.

### Env vars (allen optioneel, met fallbacks)

`VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY`, `VITE_TURNSTILE_SITE_KEY`, `VITE_OPENING_HOURS` (fallback "Di–Za 09:00–18:00"), `VITE_INSTAGRAM_URL`, `VITE_TIKTOK_URL`.

### Out of scope

- Geen admin routes.
- Geen echte backend setup (Lovable Cloud niet enablen) — contracten bestaan extern.
- Bestaande `/shop` en `/booking` routes worden vervangen door `/winkel` en `/boeken`; oude bestanden verwijderd.
