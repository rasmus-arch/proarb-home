# Publicera på cPanel (istället för Netlify/Cloudflare Pages)

Sajten är statisk (Astro, `output: 'static'`), så cPanel-servern behöver bara
kunna servera vanliga filer + PHP för offertformuläret. Node.js behöver
**inte** vara installerat på webbhotellet – bygget körs på din egen dator.

## 1. Bygg sajten lokalt

```bash
npm install
npm run build         # synkar produkter från proarb.se + bygger till dist/
# eller, om du inte vill hämta nytt innehåll just nu:
npm run build:nosync
```

Resultatet hamnar i `dist/` – det är **innehållet** i den mappen (inte mappen
själv) som ska laddas upp.

## 2. Ladda upp till cPanel

**Via File Manager (enklast):**
1. Zippa allt som ligger *inuti* `dist/` (inte själva `dist`-mappen) till en fil, t.ex. `site.zip`.
2. cPanel → *File Manager* → gå till `public_html` (eller rätt underkatalog om domänen pekar dit).
3. Ladda upp `site.zip`, markera den, välj *Extract*.
4. Ta bort ev. gamla WordPress-filer i `public_html` först (`wp-content`, `wp-admin`, `wp-config.php` osv.) – gör en backup innan du raderar något.

**Via FTP/SFTP:** använd cPanel-kontots FTP-uppgifter (*FTP Accounts* i cPanel)
med t.ex. FileZilla och ladda upp allt innehåll i `dist/` till `public_html`.

## 3. Två saker är redan anpassade för cPanel

Projektet är från början byggt för Netlify, så två saker skiljer sig från
`public/_redirects` / Netlify Forms:

- **`public/.htaccess`** – Apache-motsvarighet till `_redirects`: 301:or från
  gamla WooCommerce-URL:er, https-tvång, 404-sida, cache/komprimering. Följer
  automatiskt med i `dist/` vid varje bygge.
- **`public/send-quote.php`** – tar emot offertformuläret via PHP:s `mail()`
  och skickar det till `info@proarb.se`, sedan redirect till `/tack/`.
  Fungerar direkt på i princip alla cPanel-hotell (PHP + sendmail ingår
  normalt). Formuläret (`src/components/QuoteForm.astro`) postar till denna
  fil istället för till Netlify Forms.

Om mail via `mail()` hamnar i skräppost hos mottagaren, kolla SPF/DKIM för
domänen i cPanel (*Email Deliverability*), eller byt ut `send-quote.php` mot
en tjänst som skickar via SMTP/PHPMailer.

## 4. Domän

Om `proarb.se` redan ligger på det här cPanel-kontot: peka domänens
dokumentrot mot den katalog du laddade upp till (*Domains* i cPanel).
Ligger domänen någon annanstans: uppdatera DNS (A-post/CNAME) till detta
webbhotells server, enligt hotellets instruktioner.

Allt i sajten är relativa sökvägar (menyer, bilder, `.htaccess`-redirects,
formuläret), så den fungerar oavsett vilken domän/subdomän den ligger på –
du kan testa fritt på `new.proarb.se` och sen flytta samma filer till
`proarb.se` utan att röra koden.

## 5. Testa på new.proarb.se innan lansering

Två saker pekar redan mot det slutgiltiga domännamnet `proarb.se`
(`src/data/site.json` → `url`, samt `astro.config.mjs` → `site`): canonical-
taggar, Open Graph, JSON-LD och sitemapen. Det är avsiktligt och behöver
**inte** ändras – så länge sajten ligger på `new.proarb.se` säger den själv
till Google att "originalet" finns på proarb.se, vilket minskar risken för
duplicerat innehåll.

Det som ändå är värt att stänga ute sökmotorer helt under testperioden,
använd flaggan `STAGING=1` när du bygger:

```bash
STAGING=1 npm run build:nosync
```

Det gör att `/robots.txt` svarar `Disallow: /` och varje sida får
`<meta name="robots" content="noindex, nofollow">`, så `new.proarb.se`
inte hamnar i sökresultat. Vill du dessutom hindra utomstående från att
hitta sidan alls: cPanel → *Directory Privacy* (lösenordsskydda katalogen)
på subdomänen – kräver ingen kodändring.

## 6. Vid lansering (flytt till proarb.se)

1. Kör `npm run sync` en sista gång så produktdatan är uppdaterad från
   WordPress-sajten (se README för hur ni sedan checkar in `products.json`
   permanent när WordPress stängs av).
2. Bygg **utan** staging-flaggan så robots/indexering blir normal igen:
   ```bash
   npm run build
   ```
3. Ladda upp innehållet i `dist/` till dokumentroten för `proarb.se` (samma
   steg som i punkt 2 ovan, men på huvuddomänen istället för `new.proarb.se`).
4. Ta ner eller lösenordsskydda `new.proarb.se` igen (eller låt den 301-
   redirecta till `proarb.se`) så den inte blir en permanent dubblett.
5. Verifiera sajten i Google Search Console för `proarb.se` och skicka in
   `sitemap-index.xml`.
6. Testa formuläret och några gamla WordPress-länkar (t.ex. `/product/...`)
   för att bekräfta att redirectarna i `.htaccess` fungerar på den riktiga
   domänen.

## 7. Google Tag Manager, Analytics & Search Console

Förberett men avstängt tills ni har egna ID:n – fyll i `src/data/site.json`
under `"analytics"`:

```json
"analytics": {
  "gtmId": "GTM-XXXXXXX",
  "googleSiteVerification": "koden-fran-verifieringstaggen"
}
```

- **`gtmId`** – skapa en Google Tag Manager-container (tagmanager.google.com),
  klistra in container-ID:t (`GTM-...`). Google Analytics 4 läggs sedan till
  som en *tagg inuti GTM* (ingen extra kod behövs här) – skapa en GA4-egendom,
  lägg till GA4-taggen i GTM-gränssnittet, publicera containern.
- **`googleSiteVerification`** – Search Console → lägg till egendom
  `proarb.se` → verifieringsmetod "HTML-tagg" → klistra in bara `content`-
  värdet (inte hela `<meta>`-taggen) här.
- Bygg om (`npm run build`) och ladda upp. Så länge fälten är tomma laddas
  ingenting – sajten förblir skriptfri tills ni aktivt fyller i dem.

**Kom ihåg cookiesamtycke:** GTM/GA4 sätter cookies för besöksstatistik.
Enligt svensk lag (kompletterande till GDPR) krävs samtycke innan sådana
cookies sätts – den här sajten har idag ingen cookie-banner. Prata med er
jurist/webbyrå om ni vill vara på den säkra sidan, eller fråga mig så kan
jag sätta upp Consent Mode/en enkel samtyckesruta innan ni aktiverar GTM.
