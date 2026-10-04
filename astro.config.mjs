import { defineConfig } from 'astro/config';
import sitemap from '@astrojs/sitemap';
import { readdir, readFile, stat, rm } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

// Astro lägger ut originalet för varje importerad bild även när sidorna bara
// använder de skalade versionerna. Bildfiler i _astro/ som ingen sida, CSS
// eller JS pekar på tas bort, så att uppladdningen inte blir onödigt stor.
const pruneUnusedImages = () => ({
  name: 'prune-unused-images',
  hooks: {
    'astro:build:done': async ({ dir, logger }) => {
      const root = fileURLToPath(dir);
      const used = new Set();
      const walk = async (d) => {
        for (const e of await readdir(d, { withFileTypes: true })) {
          const p = path.join(d, e.name);
          if (e.isDirectory()) await walk(p);
          else if (/\.(html|css|js|xml|json|webmanifest)$/.test(e.name)) {
            for (const m of (await readFile(p, 'utf8')).matchAll(/_astro\/([A-Za-z0-9._-]+)/g)) used.add(m[1]);
          }
        }
      };
      await walk(root);
      const assets = path.join(root, '_astro');
      let n = 0;
      let bytes = 0;
      for (const f of await readdir(assets)) {
        if (!/\.(webp|avif|png|jpe?g|gif)$/i.test(f) || used.has(f)) continue;
        const p = path.join(assets, f);
        bytes += (await stat(p)).size;
        await rm(p);
        n++;
      }
      logger.info(`Tog bort ${n} oanvända bildfiler (${(bytes / 1e6).toFixed(1)} MB)`);
    }
  }
});

export default defineConfig({
  site: 'https://proarb.se',
  trailingSlash: 'always',
  prefetch: { prefetchAll: true, defaultStrategy: 'viewport' },
  integrations: [sitemap(), pruneUnusedImages()],
  image: {
    domains: ['proarb.se'],
    responsiveStyles: true
  },
  build: { inlineStylesheets: 'auto', format: 'directory' },
  compressHTML: true
});
