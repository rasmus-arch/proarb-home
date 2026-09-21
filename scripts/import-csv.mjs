#!/usr/bin/env node
/**
 * Importerar produkter från en WooCommerce/POS CSV-export (Verktyg > Exportera i wp-admin,
 * eller en POS-plugins fullständiga produktexport) och skriver dem till src/data/products.json.
 *
 *   node scripts/import-csv.mjs sokvag/till/export.csv
 *
 * OBS: den här typen av export saknar ofta kategori på de flesta rader (lager-/POS-export av
 * hela leverantörssortimentet). Endast rader med "Synlighet i katalog" = visible OCH minst en
 * kategori som matchar src/data/categories.json tas med – allt annat hoppas över. Skriptet
 * skriver ut hur många rader som dög respektive hoppades över.
 *
 * Färg-/storleksvarianter (t.ex. "Vattenflaska 60 cl One Size Grön") slås ihop till en produkt
 * med flera varianter, grupperat på produktnamn (utan färg/storlek) + kategori.
 */
import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const DATA = path.join(root, 'src/data');

const csvPath = process.argv[2];
if (!csvPath) {
  console.error('Användning: node scripts/import-csv.mjs <sokvag-till-csv>');
  process.exit(1);
}

function parseCSV(text) {
  if (text.charCodeAt(0) === 0xfeff) text = text.slice(1);
  const rows = [];
  let row = [];
  let field = '';
  let inQuotes = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (inQuotes) {
      if (c === '"') {
        if (text[i + 1] === '"') {
          field += '"';
          i++;
        } else inQuotes = false;
      } else field += c;
    } else if (c === '"') {
      inQuotes = true;
    } else if (c === ',') {
      row.push(field);
      field = '';
    } else if (c === '\r') {
      // skip
    } else if (c === '\n') {
      row.push(field);
      rows.push(row);
      row = [];
      field = '';
    } else {
      field += c;
    }
  }
  if (field.length || row.length) {
    row.push(field);
    rows.push(row);
  }
  return rows;
}

const categories = JSON.parse(await fs.readFile(path.join(DATA, 'categories.json'), 'utf8'));
const site = JSON.parse(await fs.readFile(path.join(DATA, 'site.json'), 'utf8'));

const name2slug = new Map();
for (const c of categories) {
  name2slug.set(c.name.trim().toLowerCase(), c.url);
  name2slug.set(c.cat.trim().toLowerCase(), c.url);
}

function mapCategories(field) {
  const slugs = [];
  for (const p of (field || '').split(',')) {
    for (const seg of p.split('>')) {
      const key = seg.trim().toLowerCase();
      if (!key || key === 'uncategorized') continue;
      const slug = name2slug.get(key);
      if (slug && !slugs.includes(slug)) slugs.push(slug);
    }
  }
  return slugs;
}

const clean = (html = '') =>
  html
    .replace(/<[^>]*>/g, ' ')
    .replace(/&#8211;|&#8212;/g, '–')
    .replace(/&#8217;|&#039;|&#8216;/g, '’')
    .replace(/&#215;/g, '×')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&quot;/g, '"')
    .replace(/&#\d+;/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();

const brandOf = (name) => {
  const n = name.toLowerCase().replace(/\s+/g, '');
  const hit = site.brands.find((b) => n.startsWith(b.toLowerCase().replace(/[\s&]+/g, '')));
  return hit || null;
};

const COLORS = ['Svart', 'Vit', 'Marinblå', 'Marin', 'Blå', 'Ljusblå', 'Mörkblå', 'Grön', 'Mörkgrön', 'Ljusgrön', 'Grå', 'Mörkgrå', 'Ljusgrå', 'Röd', 'Vinröd', 'Rosa', 'Lila', 'Orange', 'Gul', 'Beige', 'Sand', 'Brun', 'Turkos', 'Transparent', 'Silver', 'Guld', 'Natur', 'Antracit'];
const SIZES = ['One Size', 'XXXL', 'XXL', 'XS/S', 'S/M', 'L/XL', 'XL', 'XS', 'S', 'M', 'L'];
const colorRe = new RegExp(`[\\s,\\-–]+(${COLORS.join('|')})(\\s*/\\s*(${COLORS.join('|')}))?$`, 'i');

function splitVariant(name) {
  let base = name.trim();
  let color = null;
  const m = base.match(colorRe);
  if (m) {
    color = m[0].replace(/^[\s,\-–]+/, '').trim();
    base = base.slice(0, m.index).trim();
  }
  let size = null;
  for (const s of SIZES) {
    if (base.toLowerCase().endsWith(' ' + s.toLowerCase())) {
      size = s;
      base = base.slice(0, base.length - s.length - 1).trim();
      break;
    }
  }
  return { base, color, size };
}

const slugify = (s) =>
  s
    .toLowerCase()
    .replace(/å/g, 'a')
    .replace(/ä/g, 'a')
    .replace(/ö/g, 'o')
    .replace(/é/g, 'e')
    .replace(/ü/g, 'u')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');

const raw = await fs.readFile(csvPath, 'utf8');
const table = parseCSV(raw);
const header = table[0];
const rows = table
  .slice(1)
  .filter((r) => r.length > 1)
  .map((r) => Object.fromEntries(header.map((h, i) => [h, r[i] ?? ''])));

let usable = 0;
let skippedUncategorized = 0;
let skippedHidden = 0;
const groups = new Map();

for (const row of rows) {
  if (row['Synlighet i katalog'] !== 'visible') {
    skippedHidden++;
    continue;
  }
  const slugs = mapCategories(row['Kategorier']);
  if (!slugs.length) {
    skippedUncategorized++;
    continue;
  }
  usable++;

  const { base, color, size } = splitVariant(row['Namn']);
  const key = base.toLowerCase() + '::' + [...slugs].sort().join(',');
  const images = (row['Bilder'] || '').split(',').map((s) => s.trim()).filter(Boolean);
  const image = images[0] || null;
  const variant = { color, size, image };

  const entry = groups.get(key);
  if (entry) {
    const dup = entry.variants.some((v) => v.color === variant.color && v.size === variant.size);
    if (!dup) entry.variants.push(variant);
    if (!entry.description && row['Beskrivning']) entry.description = clean(row['Beskrivning']);
    if (!entry.gallery.length && images.length) entry.gallery = images.slice(0, 5);
  } else {
    groups.set(key, {
      name: clean(base),
      sku: row['Artikelnummer'] || null,
      brand: brandOf(clean(base)),
      description: clean(row['Beskrivning'] || row['Kort beskrivning'] || ''),
      categories: slugs,
      image,
      gallery: images.slice(0, 5),
      variants: color || size ? [variant] : []
    });
  }
}

const usedSlugs = new Set();
const products = [...groups.values()]
  .map((p) => {
    const base = slugify(p.name);
    let slug = base;
    let n = 2;
    while (usedSlugs.has(slug)) slug = `${base}-${n++}`;
    usedSlugs.add(slug);
    return {
      slug,
      name: p.name,
      sku: p.sku,
      brand: p.brand,
      description: p.description,
      categories: p.categories,
      image: p.image,
      gallery: p.gallery,
      variants: p.variants.map((v) => ({
        slug: `${slug}-${slugify([v.color, v.size].filter(Boolean).join('-') || 'variant')}`,
        size: v.size,
        color: v.color,
        image: v.image,
        file: null
      })),
      file: null
    };
  })
  .sort((a, b) => a.name.localeCompare(b.name, 'sv'));

await fs.writeFile(path.join(DATA, 'products.json'), JSON.stringify(products, null, 0));
await fs.writeFile(path.join(DATA, 'products.seed.json'), JSON.stringify(products, null, 2));

console.log(`Rader totalt: ${rows.length}`);
console.log(`  hoppade över (ej synliga): ${skippedHidden}`);
console.log(`  hoppade över (ingen matchande kategori): ${skippedUncategorized}`);
console.log(`  användbara rader: ${usable}`);
console.log(`✓ ${products.length} produkter skrivna till src/data/products.json + products.seed.json`);
