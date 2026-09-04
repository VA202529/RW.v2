# BarberFlow voor RW CUTZZ

BarberFlow is het boekings-, webshop- en beheerplatform voor RW CUTZZ barbershop. Het project combineert online afspraken, aanbetalingen, een webshop met afhaalflow, klantaccounts, e-mailnotificaties, reviews, WhatsApp-integratie en een admin-dashboard.

Het platform is gebouwd door Van Appiah.

## 1. Project Overview

Deze codebase ondersteunt twee aparte applicaties die dezelfde Supabase-backend gebruiken:

- **Customer frontend**: de Lovable-gegenereerde klantensite in `RW Cutzz Booking & Shop/`.
- **Backend + admin**: Supabase Edge Functions, database-migraties, tests, documentatie en het admin-dashboard in de root van deze repository.

De klantensite is bedoeld voor bezoekers en klanten van RW CUTZZ. Daar kunnen zij boeken, betalen, producten bestellen, inloggen met magic link, afspraken beheren, reviews achterlaten en zich uitschrijven voor e-mail.

De backend/admin-kant is bedoeld voor beheer. De admin kan agenda, boekingen, beschikbaarheid, diensten, klanten, webshopproducten, bestellingen, reviews, aankondigingen en statistieken beheren.

## Canonical Customer UI — DO NOT REGRESS

De canonical customer app is `RW Cutzz Booking & Shop/` en de canonical production domain is `https://rwcutzz.com`.

De live customer homepage moet de vaste RW CUTZZ visuele identiteit behouden:

- RW CUTZZ branding.
- Zwarte hero met blauwe accentkleur.
- Echte RW CUTZZ/barbershop hero-foto.
- Headline `FRESHER THAN CLEAN.` met `CLEAN.` in blauwe accentstijl.
- Eyebrow `RW CUTZZ · AMSTERDAM-NOORD`.
- CTA `BOEK NU`.
- CTA `BEKIJK SHOP`.
- Header/navigation met `HOME`, `DIENSTEN`, `BOEKEN`, `WINKEL`, `CONTACT`, `ACCOUNT`.

De variant met `Kapper & Barbershop Noord.` als homepage hero en/of een AI-generated/stylized portrait als hero is niet de canonical RW CUTZZ customer UI. Deze variant mag niet opnieuw als productie-UI op `rwcutzz.com` worden gedeployed.

Admin en customer UI zijn aparte applicaties:

- Customer: `RW Cutzz Booking & Shop/` -> `rwcutzz.com`.
- Admin/backoffice: aparte admin/root-app -> `admin.rwcutzz.com`.

Een admin UI, legacy Lovable UI, snapshot of oude frontend mag nooit automatisch de customer production UI vervangen alleen omdat die map een complete frontend bevat. Legacy/snapshot folders zijn geen source of truth voor productie zonder expliciete verificatie.

Current known-good visual baseline:

- Commit: `7f843149adfc27dd114dc5c3f66269df1c120d61`.
- Commit message: `Restore canonical RW CUTZZ customer UI`.
- Production deployment at time of documentation: `dpl_B9CAbMn7cbv1VBDY4nWFr9uEFbEn`.

Deze commit/deployment is een referentiebaseline, geen instructie om toekomstige functionele wijzigingen terug te draaien. Nieuwe fixes mogen hier bovenop komen, maar de visuele identiteit moet bewust behouden blijven.

Before changing or deploying customer UI:

1. Confirm app = `RW Cutzz Booking & Shop`.
2. Confirm target domain = `rwcutzz.com`.
3. Confirm canonical hero/branding is preserved.
4. Do not replace the real RW CUTZZ hero with an AI/stylized portrait.
5. Do not restore the legacy `Kapper & Barbershop Noord.` homepage hero.
6. Preserve current functional booking/auth/payment fixes.
7. If uncertain which UI is canonical, stop rather than choosing a legacy snapshot.

A deployment is visually wrong if the live homepage contains `Kapper & Barbershop Noord.` as the hero or uses the known AI/stylized portrait instead of the canonical RW CUTZZ hero presentation. A deployment is visually correct only when the intended RW CUTZZ black/blue identity and real hero presentation are preserved. Do not rely only on `build passed` or Vercel `Ready`; after customer UI deployment, visually verify the live homepage.

## 2. Architecture

| Laag | Technologie / locatie |
| --- | --- |
| Frontend customer | Lovable-gegenereerde React/TanStack app in `RW Cutzz Booking & Shop/` |
| Backend + admin | Supabase Edge Functions, migraties en React admin-dashboard in de root |
| Database | Supabase, project ref `fgpjnwcgjexxkzlasxqk` |
| Payments | Stripe Connect Standard met direct charges en application fees |
| Email | Resend transactionele e-mailtemplates |
| WhatsApp | Meta Cloud API |
| Hosting | Vercel voor frontend, Supabase voor backend |

De frontend roept Supabase Edge Functions aan via `https://fgpjnwcgjexxkzlasxqk.supabase.co/functions/v1/...`. De Edge Functions gebruiken Supabase service role-toegang, Stripe, Resend en Meta Cloud API waar nodig.

## 3. Repository Structure

```text
.
├── RW Cutzz Booking & Shop/       # Lovable customer frontend
├── docs/                          # Security, testing, WhatsApp en pre-live documentatie
├── src/                           # Admin-dashboard React app
├── supabase/
│   ├── functions/                 # 36 Supabase Edge Functions
│   ├── migrations/                # WP0-WP6 database migrations en fixes
│   └── tests/                     # pgTAP acceptance tests
├── package.json                   # Root/admin Vite app
└── README.md
```

Belangrijke folders:

- `supabase/migrations/`: WP0-WP6 database-migraties voor schema, RLS, booking, account, admin, webshop, reviews/PWA en WhatsApp.
- `supabase/functions/`: 36 Edge Functions voor booking, webshop, account, e-mail, WhatsApp, reviews en admin.
- `supabase/tests/`: pgTAP acceptance tests voor de work packages.
- `docs/`: onder andere `SECURITY.md`, `TESTING-WP1.md` tot en met `TESTING-WP6.md`, `WHATSAPP-TEMPLATES.md` en `PRE-LIVE-CHECKLIST.md`.
- `RW Cutzz Booking & Shop/`: Lovable customer frontend.
- `src/`: admin-dashboard in React.

## 4. Local Development Setup

### Backend/Admin (rwflow)

1. Installeer de Supabase CLI.
2. Login bij Supabase:

   ```bash
   supabase login
   ```

3. Link het project:

   ```bash
   supabase link --project-ref fgpjnwcgjexxkzlasxqk
   ```

4. Kopieer `.env.example` naar `.env` en vul waarden in als het bestand aanwezig is.

   Let op: in de huidige root is geen `.env.example` aangetroffen. De benodigde root/admin Vite-waarden en Supabase secrets staan hieronder gedocumenteerd.

5. Draai migraties:

   ```bash
   supabase db push
   ```

6. Deploy Edge Functions:

   ```bash
   supabase functions deploy
   ```

7. Zet secrets:

   ```bash
   supabase secrets set KEY=value
   ```

8. Start het admin-dashboard:

   ```bash
   npm install
   npm run dev
   ```

   Admin lokaal: `http://localhost:5173/admin`

### Customer Frontend

1. Ga naar de Lovable frontend:

   ```bash
   cd "RW Cutzz Booking & Shop"
   ```

2. Kopieer `.env.example` naar `.env` en vul de `VITE_` waarden in.
3. Start de frontend:

   ```bash
   npm install
   npm run dev
   ```

   Customer site lokaal: `http://localhost:8080`

## 5. Environment Variables

### Customer/admin Vite variables

Deze variabelen staan in `RW Cutzz Booking & Shop/.env.example` of worden door de frontendcode gebruikt.

| Variable | Beschrijving | Waar te vinden |
| --- | --- | --- |
| `VITE_SUPABASE_URL` | Publieke Supabase URL | Supabase dashboard -> Settings -> API |
| `VITE_SUPABASE_ANON_KEY` | Publieke anon key | Supabase dashboard -> Settings -> API Keys -> Legacy -> anon |
| `VITE_TURNSTILE_SITE_KEY` | Cloudflare Turnstile site key | dash.cloudflare.com -> Turnstile. Test: `1x00000000000000000000AA` |
| `VITE_APP_NAME` | Naam van de app | Bijvoorbeeld `RW CUTZZ` |
| `VITE_THEME_COLOR` | Theme color voor PWA/browser | Bijvoorbeeld `#2B3BEF` |
| `VITE_OPENING_HOURS` | Openingstijden voor frontendweergave | Bijvoorbeeld `Di-Za 09:00-18:00` |
| `VITE_INSTAGRAM_URL` | Instagram URL | RW CUTZZ Instagram-profiel |
| `VITE_TIKTOK_URL` | TikTok URL | RW CUTZZ TikTok-profiel |
| `VITE_ADDRESS` | Adres in footer | Niet aangetroffen in `.env.example`, wel gebruikt door de code |

### Supabase Edge Function secrets

Deze waarden worden gezet met `supabase secrets set KEY=value`.

| Secret | Beschrijving | Waar te vinden |
| --- | --- | --- |
| `SUPABASE_URL` | Supabase project URL | Automatisch beschikbaar in Edge Functions |
| `SUPABASE_SERVICE_ROLE_KEY` | Service role key | Automatisch beschikbaar in Edge Functions / Supabase dashboard |
| `SUPABASE_ANON_KEY` | Supabase anon key | Supabase dashboard -> Settings -> API Keys |
| `STRIPE_SECRET_KEY` | Stripe secret key | Stripe dashboard -> Developers -> API keys |
| `STRIPE_WEBHOOK_SECRET` | Stripe webhook signing secret | Stripe dashboard -> Developers -> Webhooks |
| `STRIPE_CONNECTED_ACCOUNT_ID` | Connected account ID, `acct_...` | Stripe Connect -> Accounts |
| `RESEND_API_KEY` | Resend API key | resend.com -> API Keys |
| `RESEND_FROM_EMAIL` | Afzender op geverifieerd domein | Bijvoorbeeld `info@rwcutzz.com` |
| `META_WA_TOKEN` | Meta WhatsApp access token | Meta developers -> WhatsApp -> API Setup |
| `META_WA_PHONE_NUMBER_ID` | WhatsApp Phone Number ID | `1204550496077023` |
| `META_APP_SECRET` | Meta app secret | Meta developers -> App Settings -> Basic |
| `META_WEBHOOK_VERIFY_TOKEN` | Zelfgekozen webhook verify token | Zelf genereren en ook in Meta webhookconfig gebruiken |
| `RESEND_UNSUBSCRIBE_SECRET` | Secret voor unsubscribe-links | Zelf genereren |
| `INTERNAL_FUNCTION_SECRET` | Secret voor interne function calls | Zelf genereren |
| `ADMIN_EMAIL` | Admin e-mailadres voor platformfacturen | `chanoroch@outlook.com` |
| `PUBLIC_SITE_URL` | Live customer site URL | Momenteel `https://rw-v2-website.vercel.app` |
| `BARBER_OPENING_HOURS` | Openingstijden in order-ready e-mails | `Di 10:00-15:00 | Wo 10:00-17:00 | Do 10:00-15:00 | Vr 10:00-17:00 | Za 12:00-17:00` |
| `TURNSTILE_SECRET_KEY` | Cloudflare Turnstile secret | Cloudflare Turnstile. Test secret: `1x0000000000000000000000000000000AA` |

## 6. Admin Dashboard Access

- Lokale URL: `http://localhost:5173/admin`
- Live URL: `https://rw-v2-website.vercel.app/admin`
- Status live URL: **niet bevestigd**. De admin staat in de rwflow rootapp, niet in de Lovable customer frontend. Deploy de admin daarom apart of bevestig dat dezelfde live host de admin build serveert.
- Login: magic link via Supabase Auth.
- Client-side admin check: JWT claim `app_role='admin'`.
- Server-side beveiliging: Edge Functions en RLS blijven leidend.

Adminrol instellen via SQL:

```sql
UPDATE auth.users
SET raw_app_meta_data = raw_app_meta_data || '{"app_role":"admin"}'::jsonb
WHERE id = '[USER-ID]';
```

User ID vinden: Supabase dashboard -> Authentication -> Users.

## 7. Customer Site Access

- Lokale URL: `http://localhost:8080`
- Live URL: `https://rw-v2-website.vercel.app`
- Login: magic link, geen wachtwoordlogin.

Belangrijke routes:

- `/`: home
- `/boeken`: afspraak boeken
- `/boeken/succes`: succesvolle bookingbetaling
- `/boeken/verlopen`: verlopen of afgebroken bookingbetaling
- `/winkel`: webshop
- `/winkel/checkout`: webshop checkout
- `/winkel/succes`: succesvolle webshopbetaling
- `/winkel/mislukt`: mislukte of verlopen webshopbetaling
- `/account`: klantaccount
- `/review/[id]`: review achterlaten
- `/annuleer`: annuleren via token
- `/uitschrijven`: e-mail uitschrijven
- `/voorwaarden`: algemene voorwaarden
- `/privacy`: privacyverklaring
- `/cookies`: cookiebeleid

## 8. Database

- Project ref: `fgpjnwcgjexxkzlasxqk`
- Migraties: WP0 tot en met WP6 plus latere bugfix-migraties.
- Testcommand:

  ```bash
  supabase test db
  ```

  Hiervoor is de Supabase CLI nodig.

Belangrijke tabellen:

- `customers`
- `services`
- `bookings`
- `payments`
- `credits`
- `products`
- `orders`
- `order_items`
- `reviews`
- `message_log`
- `webhook_events`
- `availability_rules`
- `blocked_slots`

## 9. Edge Functions (36 deployed)

### Booking

- `get-slots`: geeft beschikbare tijdsloten terug.
- `create-booking-hold`: maakt een tijdelijke booking hold aan.
- `create-checkout`: maakt een Stripe Checkout Session voor een booking.
- `stripe-webhook`: verwerkt Stripe events voor bookings en orders.
- `expire-pending-bookings`: laat verlopen booking holds vervallen.

### Webshop

- `get-products`: geeft actieve producten met voorraad terug.
- `create-order`: maakt een tijdelijke order hold en reserveert voorraad.
- `create-order-checkout`: maakt een Stripe Checkout Session voor een order.
- `expire-pending-orders`: laat verlopen order holds vervallen en herstelt voorraad.
- `cancel-order`: annuleert/refundt betaalde orders waar toegestaan.

### Account

- `account-data`: haalt klantaccountgegevens op.
- `cancel-booking`: annuleert een booking volgens beleid.
- `reschedule-booking`: verplaatst een booking.
- `update-notification-prefs`: wijzigt notificatievoorkeuren.
- `update-customer-phone`: wijzigt telefoonnummer.
- `delete-account`: anonimiseert/verwijdert accountgegevens volgens beleid.

### Email

- `send-email`: centrale transactionele e-mailfunctie.
- `send-due-emails`: verstuurt geplande/reminder e-mails.
- `send-broadcast`: verstuurt aankondigingen naar opt-in klanten.
- `unsubscribe`: verwerkt uitschrijflinks.

### WhatsApp

- `send-whatsapp`: verstuurt WhatsApp-templateberichten via Meta Cloud API.
- `meta-webhook`: verwerkt Meta webhookverificatie en events.

### Admin

- `admin-dashboard-data`: haalt dashboardgegevens op.
- `admin-manual-booking`: maakt handmatige adminboekingen.
- `admin-update-booking-status`: wijzigt bookingstatussen.
- `admin-manage-availability`: beheert openingstijden en blokkades.
- `admin-manage-services`: beheert diensten.
- `admin-client-data`: beheert klantdata, notities en blokkades.
- `admin-manage-products`: beheert webshopproducten.
- `admin-manage-orders`: beheert webshopbestellingen.
- `admin-manage-reviews`: beheert reviews.
- `admin-stats`: levert dashboardstatistieken.
- `send-platform-invoice`: verstuurt platformfactuuroverzicht.

### Reviews

- `submit-review`: verwerkt klantreviews.
- `get-booking-summary`: geeft publieke bookingcontext voor reviewpagina's.
- `get-public-reviews`: geeft gepubliceerde reviews terug.

## 10. WhatsApp Templates

Referentie: `docs/WHATSAPP-TEMPLATES.md`.

Templates ingediend of gepland volgens de projectdocumentatie:

- Ingediend / pending approval:
  - `booking_confirmation`
  - `booking_reminder_48h`
- Nog indienen:
  - `booking_reminder_sameday`
  - `booking_cancelled`
  - `order_confirmation`
  - `order_ready`

Phone Number ID: `1204550496077023`.

## 11. Pre-Live Checklist

Referentie: `docs/PRE-LIVE-CHECKLIST.md`.

Belangrijkste open punten:

- [ ] Resend domain `rwcutzz.com` verified.
- [ ] Stripe live account voor kapper en Van Appiah via ouder/voogd geregeld.
- [ ] Custom domain `rwcutzz.com` op Vercel gekoppeld.
- [ ] Meta business verification afgerond.
- [ ] Resterende 4 WhatsApp templates ingediend.
- [ ] Barber levert KVK, adres en btw-gegevens voor juridische pagina's.
- [ ] `supabase test db` groen voor WP0-WP6.

## 12. Fee Model

- Booking: EUR 1,00 per betaalde booking (`application_fee_amount = 100` cent).
- Webshop: 3% van ordertotaal, minimum EUR 0,50.
- Fees worden automatisch geind via Stripe Connect direct charges.

## 13. Key Contacts

- Van Appiah, developer: `chanoroch@outlook.com`
- Barber, RW CUTZZ: `[to be filled in]`

## Veelgebruikte Commands

### Root/admin

```bash
npm install
npm run dev
npm run build
```

### Customer frontend

```bash
cd "RW Cutzz Booking & Shop"
npm install
npm run dev
npm run build
```

### Supabase

```bash
supabase login
supabase link --project-ref fgpjnwcgjexxkzlasxqk
supabase db push
supabase functions deploy
supabase test db
```

### Secrets

```bash
supabase secrets set STRIPE_SECRET_KEY=...
supabase secrets set STRIPE_WEBHOOK_SECRET=...
supabase secrets set STRIPE_CONNECTED_ACCOUNT_ID=...
supabase secrets set RESEND_API_KEY=...
supabase secrets set RESEND_FROM_EMAIL=...
supabase secrets set PUBLIC_SITE_URL=https://rw-v2-website.vercel.app
```

## Troubleshooting

### Booking geeft 400 of 500

Controleer de body die de frontend naar `create-booking-hold` stuurt. Belangrijke velden zijn `service_id`, `starts_at`, `guest` en `turnstile_token`. Controleer ook Supabase Function logs.

### Magic link opent de verkeerde pagina

Controleer Supabase Auth redirect URLs en `PUBLIC_SITE_URL`. Admin magic links moeten naar `/admin`, klantaccounts naar `/account`.

### Stripe webhook verwerkt niet

Controleer `STRIPE_WEBHOOK_SECRET`, webhook endpoint in Stripe en logs van `stripe-webhook`.

### Resend mail komt niet aan

Controleer `RESEND_API_KEY`, `RESEND_FROM_EMAIL`, domeinverificatie en spamfolder.

### WhatsApp wordt overgeslagen

Controleer `META_WA_TOKEN`, `META_WA_PHONE_NUMBER_ID`, template approval en Meta business verification.

### Admin niet toegankelijk

Controleer of de gebruiker bestaat in Supabase Auth en of `raw_app_meta_data` de claim `"app_role":"admin"` bevat.

## Opmerkingen

- De Lovable customer frontend en de root/admin app zijn gescheiden applicaties binnen dezelfde repository.
- De backend in `supabase/` blijft de bron van waarheid voor RLS, statuslifecycles en Edge Function-validatie.
- Wijzig productie-secrets nooit in Git. Gebruik `.env` lokaal en `supabase secrets set` voor Edge Functions.
