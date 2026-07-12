# WP6 testrapport - WhatsApp + pre-live

## Automatische checks

Run na installatie van de Supabase CLI:

```bash
supabase test db
```

WP6-dekking:

1. `send-whatsapp` zonder `META_WA_TOKEN`: verwacht `{status:"skipped"}`, geen `message_log`.
2. Ongeldig E.164 nummer: verwacht `{status:"skipped", reason:"invalid_phone"}`.
3. Idempotency: bestaande WhatsApp `sent` log voor booking/order + template geeft `already_sent`.
4. `meta-webhook` GET geeft `hub.challenge` terug bij geldige verify token.
5. `meta-webhook` POST met ongeldige signature geeft 403.
6. Status `delivered` werkt `message_log.status` bij en replay maakt geen duplicaat.
7. Status `failed` triggert e-mail fallback.
8. E-mail fallback is idempotent bij tweede failed status.
9. `update-customer-phone` verwerpt ongeldig E.164.
10. `update-customer-phone` accepteert geldig nummer; daarna kan `whatsapp_opt_in` aan.

## Handmatige Meta live test

1. Zet Supabase secrets: `META_WA_TOKEN`, `META_WA_PHONE_NUMBER_ID`, `META_APP_SECRET`, `META_WEBHOOK_VERIFY_TOKEN`.
2. Configureer Meta webhook URL naar `/functions/v1/meta-webhook`.
3. Laat Meta de GET verify challenge uitvoeren.
4. Maak een testboeking met `whatsapp_opt_in=true` en een E.164 testnummer.
5. Rond de betaling af in Stripe test mode.
6. Controleer dat `booking_confirmation` via WhatsApp wordt verzonden.
7. Controleer dat Meta delivery status webhook binnenkomt.
8. Controleer dat `message_log.channel='whatsapp'` status wijzigt naar `delivered` of `read`.
9. Forceer of simuleer een failed status en controleer dat een e-mail fallback wordt gelogd.

## Veilig deployen zonder Meta-goedkeuring

Als `META_WA_TOKEN` leeg is, retourneert `send-whatsapp` `skipped` en blijven alle e-mails normaal verzonden worden. WP6 kan dus alvast live mee zonder goedgekeurde Meta templates.
