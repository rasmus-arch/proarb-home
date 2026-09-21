import { defineConfig } from 'astro/config';
import sitemap from '@astrojs/sitemap';

export default defineConfig({
  site: 'https://proarb.se',
  trailingSlash: 'always',
  prefetch: { prefetchAll: true, defaultStrategy: 'viewport' },
  integrations: [sitemap()],
  image: {
    domains: ['proarb.se'],
    responsiveStyles: true
  },
  build: { inlineStylesheets: 'auto', format: 'directory' },
  compressHTML: true
});
