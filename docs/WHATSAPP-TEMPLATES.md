# WhatsApp templates

Deze templates zijn bedoeld voor Meta Cloud API template messages. Alle templates gebruiken `language_code: nl` en categorie `Utility`.

## Template: booking_confirmation

Category: Utility  
Language: nl  
Body variables: `{{1}}`=klant voornaam, `{{2}}`=dienst naam, `{{3}}`=datum `dd-mm-yyyy`, `{{4}}`=tijd `HH:mm`, `{{5}}`=aanbetaling bedrag `€X,XX`

Components array:

```json
[{"type":"body","parameters":[{"type":"text","text":"{{1}}"},{"type":"text","text":"{{2}}"},{"type":"text","text":"{{3}}"},{"type":"text","text":"{{4}}"},{"type":"text","text":"{{5}}"}]}]
```

## Template: booking_reminder_48h

Category: Utility  
Language: nl  
Body variables: `{{1}}`=klant voornaam, `{{2}}`=dienst naam, `{{3}}`=datum, `{{4}}`=tijd, `{{5}}`=aanbetaling bedrag

Components array:

```json
[{"type":"body","parameters":[{"type":"text","text":"{{1}}"},{"type":"text","text":"{{2}}"},{"type":"text","text":"{{3}}"},{"type":"text","text":"{{4}}"},{"type":"text","text":"{{5}}"}]}]
```

## Template: booking_reminder_sameday

Category: Utility  
Language: nl  
Body variables: `{{1}}`=klant voornaam, `{{2}}`=dienst naam, `{{3}}`=datum, `{{4}}`=tijd, `{{5}}`=aanbetaling bedrag

Components array:

```json
[{"type":"body","parameters":[{"type":"text","text":"{{1}}"},{"type":"text","text":"{{2}}"},{"type":"text","text":"{{3}}"},{"type":"text","text":"{{4}}"},{"type":"text","text":"{{5}}"}]}]
```

## Template: booking_cancelled

Category: Utility  
Language: nl  
Body variables: `{{1}}`=klant voornaam, `{{2}}`=dienst naam, `{{3}}`=datum, `{{4}}`=tijd, `{{5}}`=aanbetaling bedrag

Components array:

```json
[{"type":"body","parameters":[{"type":"text","text":"{{1}}"},{"type":"text","text":"{{2}}"},{"type":"text","text":"{{3}}"},{"type":"text","text":"{{4}}"},{"type":"text","text":"{{5}}"}]}]
```

## Template: order_confirmation

Category: Utility  
Language: nl  
Body variables: `{{1}}`=klant voornaam, `{{2}}`=artikelen samenvatting, `{{3}}`=totaalbedrag

Components array:

```json
[{"type":"body","parameters":[{"type":"text","text":"{{1}}"},{"type":"text","text":"{{2}}"},{"type":"text","text":"{{3}}"}]}]
```

## Template: order_ready

Category: Utility  
Language: nl  
Body variables: `{{1}}`=klant voornaam, `{{2}}`=artikelen samenvatting, `{{3}}`=openingstijden

Components array:

```json
[{"type":"body","parameters":[{"type":"text","text":"{{1}}"},{"type":"text","text":"{{2}}"},{"type":"text","text":"{{3}}"}]}]
```

## Optioneel: booking_rescheduled

`booking_rescheduled` was in het oorspronkelijke plan opgenomen, maar is gereduceerd buiten de 6 bevestigde utility templates. De code roept dit template wel aan als het in Meta is goedgekeurd.

Body variables: `{{1}}`=klant voornaam, `{{2}}`=dienst naam, `{{3}}`=nieuwe datum, `{{4}}`=nieuwe tijd

Components array:

```json
[{"type":"body","parameters":[{"type":"text","text":"{{1}}"},{"type":"text","text":"{{2}}"},{"type":"text","text":"{{3}}"},{"type":"text","text":"{{4}}"}]}]
```
