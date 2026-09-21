import productsJson from '../data/products.json';
import categoriesJson from '../data/categories.json';
import siteJson from '../data/site.json';

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

export function productsIn(url: string): Product[] {
  return products.filter((p) => p.categories.includes(url));
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
