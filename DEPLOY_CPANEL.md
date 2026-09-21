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

## 5. Efter lansering

- Verifiera sajten i Google Search Console, skicka in `sitemap-index.xml`.
- Testa formuläret och några gamla WordPress-länkar (t.ex. `/product/...`)
  för att bekräfta att redirectarna i `.htaccess` fungerar.
