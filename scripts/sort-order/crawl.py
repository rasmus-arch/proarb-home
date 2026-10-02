"""
Läser av "Standardsortering" för varje kategori på proarb.se (alla sidor).

  python3 scripts/sort-order/crawl.py /tmp/order.json arbetsklader arbetsbyxor ...
  (utan kategorinamn efter filnamnet: ange de kategorier som ska läsas)

Därefter: python3 scripts/sort-order/match.py /tmp/order.json /tmp/positions.json
och python3 scripts/sort-order/write.py /tmp/positions.json  -> src/data/sort-order.json
"""
import json, re, subprocess, html, sys
from concurrent.futures import ThreadPoolExecutor
targets = sys.argv[2:]
cats = {c['url']: c for c in json.load(open('src/data/categories.json'))}
import os
out = json.load(open(sys.argv[1])) if os.path.exists(sys.argv[1]) else {}
targets = targets or list(cats)
pat = re.compile(r'<li class="product type-product post-(\d+)[^"]*">\s*<a href="https://proarb\.se/product/([^/"]+)/"[\s\S]*?<h2 class="woocommerce-loop-product__title">([\s\S]*?)</h2>')
def fetch(slug, page):
    r = subprocess.run(['curl','-sL','-m','60','--retry','3',f"https://proarb.se/?product_cat={slug}&paged={page}"], capture_output=True, text=True)
    total = re.search(r'Visar [\d–]+ av (\d+) resultat', r.stdout)
    return page, [(int(i), s, html.unescape(t).strip()) for i, s, t in pat.findall(r.stdout)], int(total.group(1)) if total else None
for url in targets:
    slug = cats[url]['cat']
    _, first, total = fetch(slug, 1)
    pages = -(-total // 12)
    with ThreadPoolExecutor(6) as ex:
        res = dict((p, items) for p, items, _ in ex.map(lambda p: fetch(slug, p), range(1, pages + 1)))
    order = [x for p in range(1, pages + 1) for x in res[p]]
    out[url] = order
    print(url, 'total', total, 'pages', pages, 'got', len(order), 'unique', len({x[0] for x in order}), file=sys.stderr)
json.dump(out, open(sys.argv[1], 'w'), ensure_ascii=False, indent=1)
