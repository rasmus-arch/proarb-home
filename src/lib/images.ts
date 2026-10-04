import productImages from '../data/product-images.json';

/**
 * Produktbilder som ligger lokalt.
 * - src/assets/products/   – nersynkade med `npm run sync` (checkas inte in)
 * - src/assets/produktbilder/ – frilagda kopior av proarb.se:s bilder, nycklade
 *   på originalets URL i src/data/product-images.json
 */
const local = import.meta.glob<{ default: ImageMetadata }>(
  '/src/assets/{products,produktbilder}/**/*.{jpeg,jpg,png,webp,avif,gif}',
  { eager: true }
);
const byUrl = productImages as Record<string, string>;

export function localImage(file?: string | null, src?: string | null): ImageMetadata | undefined {
  const synced = file ? local[`/src/assets/products/${file}`] : undefined;
  if (synced) return synced.default;
  const name = src ? byUrl[src] : undefined;
  return name ? local[`/src/assets/produktbilder/${name}`]?.default : undefined;
}
