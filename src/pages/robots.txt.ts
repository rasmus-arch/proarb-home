import type { APIRoute } from 'astro';
import { site } from '../lib/content';

// Bygg med STAGING=1 npm run build (t.ex. för new.proarb.se) för att stänga
// ute sökmotorer helt tills sajten pushas live på proarb.se.
const staging = process.env.STAGING === '1';

export const GET: APIRoute = () => {
  const body = staging
    ? 'User-agent: *\nDisallow: /\n'
    : `User-agent: *\nAllow: /\n\nSitemap: ${site.url}/sitemap-index.xml\n`;
  return new Response(body, { headers: { 'Content-Type': 'text/plain; charset=utf-8' } });
};
