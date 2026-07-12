# WP5 testrapport - reviews + PWA

## Automatische checks

Run na installatie van de Supabase CLI:

```bash
supabase test db
```

Deze suite bevat nu ook `supabase/tests/database/wp5_acceptance.sql` met dekking voor:

1. Geldige review-token op een completed booking.
2. Ongeldige token.
3. Duplicate review.
4. Review op niet-afgeronde booking.
5. Body korter dan 10 tekens.
6. Admin toggle naar gepubliceerd en publieke query.
7. Raw-token/hash-validatie.
8. Manifest aanwezig en valide JSON.
9. Service worker bevat network-only voor `/functions/v1/`.
10. Offlinepagina bevat Nederlandse offlineboodschap.

## Handmatige PWA-check

1. Vul `VITE_APP_NAME` en `VITE_THEME_COLOR` in.
2. Run `npm run build`.
3. Controleer dat `public/manifest.json`, `public/icons/icon-192.png` en `public/icons/icon-512.png` bestaan.
4. Open de productiebuild en bevestig dat de service worker registreert.
5. Bezoek de homepage een tweede sessie en controleer de install-banner.
6. Zet netwerk offline en laad een niet-gecachete navigatie: `offline.html` moet verschijnen.

## Handmatige review-check

1. Markeer een boeking als afgerond via admin.
2. Controleer dat de review_request-mail een link bevat als `/review/[booking_id]?token=[raw_token]`.
3. Plaats een review.
4. Controleer dat de review in `/account` als `In behandeling` staat.
5. Publiceer de review via `/admin/reviews`.
6. Controleer dat de review op de homepage zichtbaar is zonder achternaam of e-mail.
