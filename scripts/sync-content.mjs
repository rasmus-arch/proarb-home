#!/usr/bin/env node
/**
 * Hämtar produkter från den nuvarande WooCommerce-sajten (Store API, publik – ingen nyckel krävs)
 * och skriver ner dem som statisk data + laddar hem bilderna.
 *
 *   node scripts/sync-content.mjs            # produkter + bilder
 *   node scripts/sync-content.mjs --no-images
 *   SYNC_SOURCE=https://proarb.se node scripts/sync-content.mjs
 *
 * Körs automatiskt före `astro build`. Om källan inte går att nå används
 * src/data/products.seed.json så att bygget aldrig fastnar.
 */
import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const SOURCE = process.env.SYNC_SOURCE || 'https://proarb.se';
const WITH_IMAGES = !process.argv.includes('--no-images');
const IMG_DIR = path.join(root, 'src/assets/products');
const DATA = path.join(root, 'src/data');

const categories = JSON.parse(await fs.readFile(path.join(DATA, 'categories.json'), 'utf8'));
const site = JSON.parse(await fs.readFile(path.join(DATA, 'site.json'), 'utf8'));

const COLORS = ['Svart','Vit','Marinblå','Marin','Blå','Ljusblå','Mörkblå','Grön','Mörkgrön','Ljusgrön','Grå','Mörkgrå','Ljusgrå','Röd','Vinröd','Rosa','Lila','Orange','Gul','Beige','Sand','Brun','Turkos','Transparent','Silver','Guld','Natur','Antracit'];
const SIZES = ['One Size','XXXL','XXL','XS/S','S/M','L/XL','XL','XS','S','M','L'];

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

/** "Vattenflaska 60 cl One Size Grön" -> { base: "Vattenflaska 60 cl", size: "One Size", color: "Grön" } */
function splitVariant(name) {
  let base = name.trim();
  let color = null;
  let size = null;
  const colorRe = new RegExp(`\\s(${COLORS.join('|')})(\\/(${COLORS.join('|')}))?$`, 'i');
  const cm = base.match(colorRe);
  if (cm) {
    color = cm[0].trim();
    base = base.slice(0, cm.index).trim();
  }
  for (const s of SIZES) {
    if (base.toLowerCase().endsWith(' ' + s.toLowerCase())) {
      size = s;
      base = base.slice(0, base.length - s.length - 1).trim();
      break;
    }
  }
  return { base, size, color };
}

async function getJson(url, tries = 3) {
  for (let i = 0; i < tries; i++) {
    try {
      const r = await fetch(url, { headers: { 'user-agent': 'proarb-sync' } });
      if (!r.ok) throw new Error(r.status + ' ' + url);
      return { data: await r.json(), headers: r.headers };
    } catch (e) {
      if (i === tries - 1) throw e;
      await new Promise((r) => setTimeout(r, 800 * (i + 1)));
    }
  }
}

async function fetchCategory(cat) {
  let out = [];
  for (let page = 1; page <= 30; page++) {
    const { data, headers } = await getJson(
      `${SOURCE}/wp-json/wc/store/v1/products?per_page=100&page=${page}&category=${cat.id}`
    );
    out = out.concat(data);
    const total = Number(headers.get('x-wp-totalpages') || 1);
    if (page >= total || data.length === 0) break;
  }
  return out;
}

async function download(url, file) {
  try {
    await fs.access(file);
    return true;
  } catch {}
  try {
    const r = await fetch(url);
    if (!r.ok) return false;
    await fs.writeFile(file, Buffer.from(await r.arrayBuffer()));
    return true;
  } catch {
    return false;
  }
}

async function main() {
  await fs.mkdir(IMG_DIR, { recursive: true });

  let raw = new Map();
  try {
    for (const cat of categories) {
      const list = await fetchCategory(cat);
      for (const p of list) {
        const existing = raw.get(p.slug);
        if (existing) existing._urls.add(cat.url);
        else raw.set(p.slug, { ...p, _urls: new Set([cat.url]) });
      }
      process.stdout.write(`  ${cat.name}: ${list.length}\n`);
    }
  } catch (err) {
    console.warn(`\n!  Kunde inte nå ${SOURCE} (${err.message}). Använder src/data/products.seed.json.\n`);
    const seed = await fs.readFile(path.join(DATA, 'products.seed.json'), 'utf8');
    await fs.writeFile(path.join(DATA, 'products.json'), seed);
    return;
  }

  // Slå ihop färg-/storleksvarianter till en produkt
  const groups = new Map();
  for (const p of raw.values()) {
    const urls = [...p._urls];
    const onlyGiveaway = urls.length === 1 && urls[0] === 'give-aways';
    const { base, size, color } = onlyGiveaway ? splitVariant(p.name) : { base: p.name, size: null, color: null };
    const key = onlyGiveaway ? 'g:' + base.toLowerCase() : 'p:' + p.slug;
    const image = p.images?.[0]?.src || null;
    const entry = groups.get(key);
    if (entry) {
      entry.variants.push({ slug: p.slug, size, color, image });
      if (!entry.description && p.description) entry.description = clean(p.description);
      continue;
    }
    groups.set(key, {
      slug: p.slug,
      name: clean(base),
      sku: p.sku || null,
      brand: brandOf(clean(base)),
      description: clean(p.description || p.short_description || ''),
      categories: urls,
      image,
      gallery: (p.images || []).slice(0, 5).map((i) => i.src),
      variants: color || size ? [{ slug: p.slug, size, color, image }] : []
    });
  }

  const products = [...groups.values()].sort((a, b) => a.name.localeCompare(b.name, 'sv'));

  if (WITH_IMAGES) {
    let n = 0;
    const queue = [];
    for (const p of products) {
      const urls = new Set([p.image, ...p.variants.map((v) => v.image)].filter(Boolean));
      for (const u of urls) queue.push(u);
    }
    const unique = [...new Set(queue)];
    const localName = (u) => u.split('/').pop().split('?')[0];
    const pool = 12;
    let idx = 0;
    await Promise.all(
      Array.from({ length: pool }, async () => {
        while (idx < unique.length) {
          const u = unique[idx++];
          const ok = await download(u, path.join(IMG_DIR, localName(u)));
          if (ok) n++;
          if (n % 100 === 0) process.stdout.write(`  bilder: ${n}/${unique.length}\r`);
        }
      })
    );
    console.log(`  bilder: ${n}/${unique.length} klara`);
    for (const p of products) {
      p.file = p.image ? localName(p.image) : null;
      for (const v of p.variants) v.file = v.image ? localName(v.image) : null;
    }
  }

  await fs.writeFile(path.join(DATA, 'products.json'), JSON.stringify(products, null, 0));
  console.log(`\n✓ ${products.length} produkter skrivna till src/data/products.json`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
