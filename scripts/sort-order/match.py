"""Matchar proarb.se-produkter mot src/data/products.json (slug, namn, namnprefix)."""
import json, re, unicodedata, sys
order = json.load(open(sys.argv[1]))
prods = json.load(open('src/data/products.json'))
def norm(s):
    s = unicodedata.normalize('NFKD', s.lower().replace('×', 'x'))
    s = ''.join(ch for ch in s if not unicodedata.combining(ch))
    return re.sub(r'[^a-z0-9]+', '', s)
def slugbase(s): return re.sub(r'-\d+$', '', s)
by_slug = {}
for p in prods:
    by_slug.setdefault(p['slug'], p)
    for v in p.get('variants') or []:
        if v.get('slug'): by_slug.setdefault(v['slug'], p)
by_name = {norm(p['name']): p for p in prods}
names_sorted = sorted(prods, key=lambda p: -len(norm(p['name'])))
def find(wslug, title):
    for s in (wslug, slugbase(wslug)):
        if s in by_slug: return by_slug[s], 'slug'
    n = norm(title)
    if n in by_name: return by_name[n], 'name'
    for p in names_sorted:
        pn = norm(p['name'])
        if len(pn) >= 6 and n.startswith(pn): return p, 'prefix'
    return None, None
result, report = {}, {}
for cat, items in order.items():
    pos = {}
    how = {}
    for idx, (wid, wslug, title) in enumerate(items):
        p, m = find(wslug, title)
        if p and cat in p['categories'] and p['slug'] not in pos:
            pos[p['slug']] = idx; how[m] = how.get(m, 0) + 1
    ours = [p['slug'] for p in prods if cat in p['categories']]
    missing = [s for s in ours if s not in pos]
    result[cat] = pos
    report[cat] = (len(ours), len(ours) - len(missing), how, missing[:8])
for k, (n, found, how, miss) in report.items():
    print(f'{k}: ours {n}, matched {found} {how}', ('MISSING e.g. ' + ', '.join(miss)) if miss else '')
json.dump(result, open(sys.argv[2], 'w'), ensure_ascii=False)
