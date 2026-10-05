import productsJson from '../data/products.json';
import categoriesJson from '../data/categories.json';
import siteJson from '../data/site.json';
import sortOrderJson from '../data/sort-order.json';

export interface Variant {
  slug: string;
  size: string | null;
  color: string | null;
  image: string | null;
  file?: string | null;
}

export interface Product {
  slug: string;
  name: string;
  sku: string | null;
  brand: string | null;
  description: string;
  categories: string[];
  image: string | null;
  gallery: string[];
  variants: Variant[];
  file?: string | null;
}

export interface Category {
  url: string;
  cat: string;
  id: number;
  group: 'arbete' | 'profil';
  name: string;
  h1: string;
  lead: string;
  seoTitle: string;
  seoDesc: string;
}

export const site = siteJson;
export const categories = categoriesJson as Category[];
export const products = (productsJson as Product[]).filter((p) => p.name);

export const categoryByUrl = (url: string) => categories.find((c) => c.url === url);

/**
 * Sortering per kategori, avläst från "Standardsortering" på proarb.se
 * (src/data/sort-order.json). Produkter som saknas i listan hamnar sist.
 */
const sortOrder = sortOrderJson as Record<string, string[]>;

const text = (p: Product) => `${p.name} ${p.brand ?? ''}`.toLowerCase();

/** Give aways: vattenflaskor, kepsar, pennor, termosmuggar, Solstickan och de modernare
 *  designprodukterna först – resten (sängkläder, badrumstextil m.m.) sist. */
const GIVEAWAY_TIERS: RegExp[] = [
  /vattenflaska|aluminiumflaska|stålflaska|dricksflaska|sportflaska|water ?bottle/,
  /\bkeps|trucker|\bcap\b|mössa|beanie/,
  /\bpenn|kulspets|kulpenn|\bpen\b/,
  /termos|thermo|\bmugg|muggar|\bkopp\b/,
  /solstickan/,
  /orrefors|kosta|blacksmith|queen anne|lord nelson|nightingale|toppoint|skärbräda|kyl|cykelväska|korkskruv|\bvin\b|grill|brandfilt|picknick|carry|kylkorg/
];
const giveawayTier = (p: Product) => {
  const t = text(p);
  const i = GIVEAWAY_TIERS.findIndex((rx) => rx.test(t));
  return i === -1 ? GIVEAWAY_TIERS.length : i;
};

export function productsIn(url: string): Product[] {
  let list = products.filter((p) => p.categories.includes(url));
  const order = sortOrder[url];
  if (order) {
    const rank = new Map(order.map((slug, i) => [slug, i]));
    list = list
      .map((p, i) => ({ p, r: rank.get(p.slug) ?? order.length + i }))
      .sort((a, b) => a.r - b.r)
      .map(({ p }) => p);
  }
  // Handskar hör hemma sist i den samlade arbetsklädesvyn
  if (url === 'arbetsklader') {
    const gloves = (p: Product) => p.categories.includes('arbetshandskar');
    list = [...list.filter((p) => !gloves(p)), ...list.filter(gloves)];
  }
  if (url === 'give-aways') {
    list = list
      .map((p, i) => ({ p, t: giveawayTier(p), i }))
      .sort((a, b) => a.t - b.t || a.i - b.i)
      .map(({ p }) => p);
  }
  if (url === 'profilprodukter') {
    // De prioriterade give-awayen och profilkläderna blandas jämnt; övriga give aways sist
    const isGiveaway = (p: Product) => p.categories.includes('give-aways');
    const top = list
      .filter((p) => isGiveaway(p) && giveawayTier(p) < GIVEAWAY_TIERS.length)
      .map((p, i) => ({ p, t: giveawayTier(p), i }))
      .sort((a, b) => a.t - b.t || a.i - b.i)
      .map(({ p }) => p);
    const clothes = list.filter((p) => !isGiveaway(p));
    const rest = list.filter((p) => isGiveaway(p) && giveawayTier(p) === GIVEAWAY_TIERS.length);
    const mixed: Product[] = [];
    const total = top.length + clothes.length;
    let a = 0;
    let b = 0;
    for (let n = 0; n < total; n++) {
      // välj den lista som ligger längst efter sin andel
      const pickClothes = b < clothes.length && (a >= top.length || b / clothes.length <= a / top.length);
      mixed.push(pickClothes ? clothes[b++] : top[a++]);
    }
    list = [...mixed, ...rest];
  }
  return list;
}

/** Varumärken – nyckel utan mellanslag/tecken så att "Tee Jays" och "TeeJays" blir samma */
export const brandKey = (name: string) => name.toLowerCase().replace(/[^a-z0-9åäö]/g, '');
export const brandSlug = (name: string) =>
  name.toLowerCase().replace(/å|ä/g, 'a').replace(/ö/g, 'o').replace(/[^a-z0-9\s-]/g, '').trim().replace(/[\s-]+/g, '-');
/** Det namn som står i site.brands (t.ex. "TeeJays" för "Tee Jays") */
export const canonicalBrand = (name: string) =>
  (siteJson.brands as string[]).find((b) => brandKey(b) === brandKey(name)) ?? name;
export const brandHref = (name: string) => `/varumarke/${brandSlug(canonicalBrand(name))}/`;

/** Ordning på märkesfilter och märkeslistor: Helly Hansen, Snickers, Jobman, ProJob, ID Identity,
 *  sedan övriga alfabetiskt, Blåkläder längst bort. */
const BRAND_FIRST = ['helly hansen', 'snickers', 'jobman', 'projob', 'id identity'].map(brandKey);
const BRAND_LAST = ['blåkläder'].map(brandKey);
export function brandOrder(a: string, b: string): number {
  const rank = (n: string) => {
    const k = brandKey(n);
    const f = BRAND_FIRST.indexOf(k);
    if (f !== -1) return f;
    return BRAND_LAST.includes(k) ? 1000 : 100;
  };
  return rank(a) - rank(b) || a.localeCompare(b, 'sv');
}

/** Underkategorier till en toppkategori, i menyordning. */
export function childrenOf(url: string): Category[] {
  const parent = categoryByUrl(url);
  if (!parent) return [];
  const roots = ['arbetsklader', 'profilprodukter'];
  if (!roots.includes(url)) return [];
  return categories.filter((c) => c.group === parent.group && !roots.includes(c.url));
}

export function relatedTo(product: Product, limit = 4): Product[] {
  const scope = product.categories.filter((c) => c !== 'arbetsklader' && c !== 'profilprodukter');
  const pool = products.filter(
    (p) => p.slug !== product.slug && p.categories.some((c) => scope.includes(c))
  );
  const sameBrand = pool.filter((p) => p.brand && p.brand === product.brand);
  const rest = pool.filter((p) => !sameBrand.includes(p));
  return [...sameBrand, ...rest].slice(0, limit);
}

export const brandsInUse = (): string[] =>
  [...new Set(products.map((p) => p.brand).filter(Boolean) as string[])].sort((a, b) =>
    a.localeCompare(b, 'sv')
  );

export function excerpt(text: string, max = 120): string {
  if (!text) return '';
  if (text.length <= max) return text;
  const cut = text.slice(0, max);
  return cut.slice(0, cut.lastIndexOf(' ')) + '…';
}

export const canonical = (path: string) =>
  new URL(path, site.url).toString().replace(/([^:]\/)\/+/g, '$1');
