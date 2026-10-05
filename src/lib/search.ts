/** Sökning i webbläsaren mot /sok-index.json (byggs av src/pages/sok-index.json.ts). */
export interface Entry {
  /** typ: p = produkt, b = märke, c = kategori */
  t: 'p' | 'b' | 'c';
  n: string; // namn
  u: string; // adress
  s?: string; // artikelnummer
  b?: string; // märke
  c?: string; // kategorinamn
  v?: string; // färger/storlekar (sökbar text)
  i?: string; // miniatyr
}

export const norm = (s: string) =>
  s
    .toLowerCase()
    .replace(/[åä]/g, 'a')
    .replace(/ö/g, 'o')
    .replace(/é/g, 'e')
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();

/** Grov ordstam så att "byxa" hittar "byxor" och "jackor" hittar "jacka" */
const stem = (w: string) => {
  const s = w.replace(/(arna|erna|orna|or|ar|er|na|n|a|e|s)$/, '');
  return s.length >= 3 ? s : w;
};

const lev1 = (a: string, b: string) => {
  if (Math.abs(a.length - b.length) > 1) return false;
  let i = 0;
  while (i < a.length && i < b.length && a[i] === b[i]) i++;
  if (a.length === b.length) return a.slice(i + 1) === b.slice(i + 1) || (a[i] === b[i + 1] && a[i + 1] === b[i] && a.slice(i + 2) === b.slice(i + 2));
  return a.length > b.length ? a.slice(i + 1) === b.slice(i) : b.slice(i + 1) === a.slice(i);
};

interface Prepared extends Entry {
  name: string; // normaliserat namn
  hay: string; // allt sökbart
  words: string[];
}

export function prepare(entries: Entry[]): Prepared[] {
  return entries.map((e) => {
    const name = norm(e.n);
    const hay = norm([e.n, e.s, e.b, e.c, e.v].filter(Boolean).join(' '));
    return { ...e, name, hay, words: hay.split(' ') };
  });
}

export function search(index: Prepared[], query: string, limit = 60): Prepared[] {
  const q = norm(query);
  if (!q) return [];
  const tokens = q.split(' ');
  const scored: { e: Prepared; score: number }[] = [];
  for (const e of index) {
    let total = 0;
    let ok = true;
    for (const tk of tokens) {
      const st = stem(tk);
      let best = 0;
      if (e.name === tk || (e.s && norm(e.s) === tk)) best = 10;
      else if (e.name.startsWith(tk)) best = 6;
      else if (e.words.some((w) => w.startsWith(tk))) best = 4;
      else if (e.words.some((w) => w.startsWith(st))) best = 3;
      else if (tk.length >= 3 && e.hay.includes(tk)) best = 1.5;
      else if (tk.length >= 5 && /^[a-z]+$/.test(tk) && e.words.some((w) => w.length >= 4 && lev1(tk, w.slice(0, tk.length)))) best = 1;
      if (!best) {
        ok = false;
        break;
      }
      total += best;
    }
    if (!ok) continue;
    if (e.t !== 'p') total += 2; // märken och kategorier först vid lika träff
    scored.push({ e, score: total });
  }
  scored.sort((a, b) => b.score - a.score || a.e.n.localeCompare(b.e.n, 'sv'));
  return scored.slice(0, limit).map((x) => x.e);
}

let cached: Promise<Prepared[]> | null = null;
export const loadIndex = () =>
  (cached ??= fetch('/sok-index.json')
    .then((r) => r.json() as Promise<Entry[]>)
    .then(prepare));

export const typeLabel = (e: Entry) => (e.t === 'b' ? 'Varumärke' : e.t === 'c' ? 'Kategori' : '');

export function track(term: string) {
  const g = (window as any).gtag;
  if (typeof g === 'function') g('event', 'search', { search_term: term });
}
