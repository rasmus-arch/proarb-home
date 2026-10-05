import type { APIRoute } from 'astro';
import { getImage } from 'astro:assets';
import { products, categories, site, brandSlug } from '../lib/content';
import { localImage } from '../lib/images';

// Sökindex: en rad per produkt, märke och kategori. Hämtas först när någon söker.
export const GET: APIRoute = async () => {
  const catName = new Map(categories.map((c) => [c.url, c.name]));
  const entries: any[] = [];

  for (const p of products) {
    const m = localImage(p.file, p.image);
    const thumb = m ? (await getImage({ src: m, width: 96, format: 'webp', quality: 60 })).src : undefined;
    const variants = [
      ...new Set(p.variants.flatMap((v) => [v.color, v.size && v.size.toLowerCase() !== 'one size' ? v.size : null]).filter(Boolean))
    ].join(' ');
    entries.push({
      t: 'p',
      n: p.name,
      u: `/produkt/${p.slug}/`,
      s: p.sku ?? undefined,
      b: p.brand ?? undefined,
      c: p.categories.map((u) => catName.get(u)).filter((n) => n && !['Arbetskläder', 'Profilprodukter'].includes(n)).join(', ') || undefined,
      v: variants || undefined,
      i: thumb
    });
  }
  for (const b of site.brands as string[]) {
    entries.push({ t: 'b', n: b, u: `/varumarke/${brandSlug(b)}/` });
  }
  for (const c of categories) {
    entries.push({ t: 'c', n: c.name, u: `/${c.url}/` });
  }
  return new Response(JSON.stringify(entries), { headers: { 'Content-Type': 'application/json' } });
};
