import type { APIRoute } from 'astro';
import { products } from '../lib/content';

export const GET: APIRoute = () =>
  new Response(
    JSON.stringify(
      products.map((p) => ({
        s: p.slug,
        n: p.name,
        b: p.brand,
        k: p.sku,
        i: p.image,
        c: p.categories.join(' ')
      }))
    ),
    { headers: { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'public, max-age=3600' } }
  );
