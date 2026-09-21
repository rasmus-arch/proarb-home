# proarb.se – ny sajt (Astro, statisk)

Ersättare för WordPress-sajten. Bygger ren HTML utan ramverk i webbläsaren:
**~1 kB JavaScript totalt**, inga cookies, inga plugins att uppdatera.

| | Idag (WordPress) | Nytt (Astro) |
|---|---|---|
| Sidor | PHP renderas vid varje besök | Förgenererad HTML på CDN |
| JS | Elementor + jQuery + WooCommerce (≈ 500 kB+) | ≈ 1 kB (meny + sök) |
| Bilder | Originalstorlek, jpg/png | AVIF/WebP i rätt storlek per skärm |
| Drift | Plugins, uppdateringar, säkerhet | Statiska filer, inget att hacka |
| Kostnad | Webbhotell + licenser | Gratis på Netlify/Cloudflare Pages |

---

## Kom igång

```bash
npm install
npm run dev        # http://localhost:4321
```

`npm run dev` använder produktdatan som redan ligger i `src/data/`.

## Bygga

```bash
npm run build      # hämtar innehåll från proarb.se + bygger till dist/
npm run build:nosync   # bygger utan att hämta nytt innehåll
npm run preview        # förhandsgranska dist/
```

---

## Innehåll

### Produkter

Produkterna hämtas automatiskt från den nuvarande WooCommerce-sajten via dess
publika Store API (ingen nyckel behövs):

```bash
npm run sync              # produkter + bilder -> src/data/products.json, src/assets/products/
npm run sync -- --no-images
SYNC_SOURCE=https://proarb.se npm run sync
```

Skriptet (`scripts/sync-content.mjs`)

* hämtar alla produkter i kategorierna som listas i `src/data/categories.json`
* slår ihop färg- och storleksvarianter i *Give aways* till **en** produkt med
  färgväljare (1 200 rader i WooCommerce blir ca 200 riktiga produkter)
* laddar ner bilderna så att Astro kan optimera dem till AVIF/WebP
* faller tillbaka på `src/data/products.seed.json` om sajten inte svarar, så att
  bygget aldrig fastnar

`src/data/products.json` och `src/assets/products/` är `.gitignore`:ade – de
genereras vid varje bygge. `products.seed.json` (55 produkter) är incheckad som
reserv och gör att repot går att bygga utan nätverk.

**När WordPress ska stängas av:** kör `npm run sync` en sista gång, ta bort
raderna för `src/data/products.json` och `src/assets/products/` ur `.gitignore`
och checka in dem. Då är sajten helt fristående och innehållet redigeras
direkt i JSON-filen.

### Texter, meny, kontaktuppgifter

* `src/data/site.json` – företagsuppgifter, telefon, adress, meny, varumärken, USP:ar
* `src/data/categories.json` – kategorier, rubriker och SEO-texter per sida
* Sidorna `om-oss`, `kontakt`, `tryck-och-brodyr`, `kopvillkor`,
  `integritetspolicy` har sin text direkt i `src/pages/*.astro`

---

## Formuläret

Offertformuläret är förberett för **Netlify Forms** (`data-netlify="true"`) och
fungerar utan kod så fort sajten ligger på Netlify – inskickade svar hamnar i
Netlify-panelen och kan mailas vidare till info@proarb.se.

Andra alternativ, byt bara `action`/`method` i `src/components/QuoteForm.astro`:

* **Cloudflare Pages** – använd Pages Functions eller en tjänst som Formspree
* **Formspree / Basin / Web3Forms** – peka `action` mot deras endpoint
* **Eget mail-API** – posta till valfri endpoint

Honeypot-fältet (`bot-field`) är redan på plats mot spam.

---

## Publicera

### Netlify (rekommenderat)

1. Pusha repot till GitHub.
2. Netlify → *Add new site* → *Import an existing project* → välj repot.
3. Build command `npm run build`, publish directory `dist` (läses redan från
   `netlify.toml`).
4. Lägg till domänen `proarb.se` under *Domain management* och peka DNS dit.

### Cloudflare Pages

Samma sak: build command `npm run build`, output directory `dist`.
Kopiera vid behov `public/_redirects` – Cloudflare läser samma format.

---

## SEO & flytt från WordPress

* Alla gamla URL:er är mappade i `public/_redirects` (301). `/product/xxx/` går
  till `/produkt/xxx/`, kategorisidorna behåller sina adresser
  (`/arbetsjackor/`, `/varselklader/` …) så att rankingen följer med.
* `sitemap-index.xml` genereras automatiskt.
* Strukturerad data: `ClothingStore` på alla sidor, `BreadcrumbList`,
  `ItemList` på kategorisidor och `Product` på produktsidor.
* Titlar och meta-beskrivningar sätts per kategori i `categories.json`.

**Kom ihåg vid lansering:** verifiera nya sajten i Google Search Console och
skicka in sitemapen.

---

## Design

Designsystemet ligger i `src/styles/global.css` som CSS-variabler – färger,
typografi, radier och mellanrum. Ändra `--accent` så ändras hela sajtens
accentfärg. Mörkt läge följer systeminställningen automatiskt.

Typsnitt: **Archivo** (rubriker) och **Inter** (brödtext), självhostade via
`@fontsource-variable` – inga anrop till Google Fonts.

Logotypen är just nu en ren SVG-wordmark i `src/components/Logo.astro` och
`public/favicon.svg`. Byt till den riktiga logotypen genom att lägga filen i
`src/assets/` och importera den i `Logo.astro`.

---

## Struktur

```
src/
  assets/products/     nedsynkade produktbilder (genereras)
  components/          Header, Footer, ProductCard, QuoteForm, sök m.m.
  data/                site.json, categories.json, products*.json
  layouts/Base.astro   <head>, meta, JSON-LD, header/footer
  lib/content.ts       datahjälpare
  pages/
    index.astro
    [category]/[...page].astro   alla kategorisidor, 48 produkter per sida
    produkt/[slug].astro         alla produktsidor
    om-oss, kontakt, tack, tryck-och-brodyr, kopvillkor, integritetspolicy, 404
    search.json.ts               sökindex
scripts/sync-content.mjs
public/                favicon, robots.txt, _redirects
```
