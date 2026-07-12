# PWA-iconen

`npm run build` draait eerst `scripts/generate-pwa-icons.js`. Dat script gebruikt `VITE_APP_NAME` en `VITE_THEME_COLOR` om `public/manifest.json` en placeholder-iconen in `public/icons/` te genereren.

Vervang de placeholders voor livegang door echte PNG-iconen:

- `public/icons/icon-192.png`
- `public/icons/icon-512.png`

Behoud dezelfde bestandsnamen, zodat `manifest.json` en de service worker niet aangepast hoeven te worden.
