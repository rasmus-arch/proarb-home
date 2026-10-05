#!/usr/bin/env python3
"""Slår ihop produkter som bara skiljer sig i färg eller storlek till en produkt med varianter.

    python3 scripts/merge-variants.py            # skriver src/data/products.seed.json (+ products.json)
    python3 scripts/merge-variants.py --dry-run  # visar bara grupperna

Gäller endast kategorin give-aways. Originalet sparas i scripts/products.before-merge.json första gången.
Produktens första slug behålls som adress; övriga slugs finns kvar som varianter, så att gamla
länkar fortfarande kan skickas vidare (scripts/…/gammal-produkt.php slår upp via variantslugs).
"""
import json
import os
import re
import shutil
import sys
from collections import defaultdict

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
SEED = os.path.join(ROOT, 'src/data/products.seed.json')
BACKUP = os.path.join(ROOT, 'scripts/products.before-merge.json')
SITE = os.path.join(ROOT, 'src/data/site.json')

COLORS = [
    'dalablå', 'royalblå', 'äpplegrön', 'aquagrön', 'denimblå', 'duvblå', 'lejon', 'mossa', 'nougat', 'petrol',
    'salvia', 'terracotta', 'cerise', 'ljuslila', 'ljusrosa', 'lime', 'champagne', 'krom', 'chrome', 'rost',
    'grafit', 'mörk', 'gräddvit', 'stål', 'rosé', 'dimblå', 'båstad', 'sandhamn', 'smögen', 'tylösand', 'visby',
    'neutral', 'lavendel', 'denim', 'bambu',
]
SIZE_RX = [
    r'\b\d+[,.]?\d*\s?[x×X]\s?\d+(?:\s?[x×X]\s?\d+)?\s?(?:cm)?\b',     # 150x210, 50x60cm
    r'\b(?:XXS|XS|S|M|L|XL|XXL|3XL|4XL)(?:/(?:XXS|XS|S|M|L|XL|XXL|3XL|4XL))?\b',  # S/M, L/XL
    r'\b\d+\s?ML\b',                                                  # 640 ML
]


def find_sizes(name):
    found = []
    for rx in SIZE_RX:
        for m in re.finditer(rx, name):
            found.append(m.group(0))
    return found


def strip_name(name):
    """-> (grundnamn, storlek|None, färg|None)"""
    n = re.sub(r'\bOne ?Size\b', ' ', name, flags=re.I)
    size = None
    for rx in SIZE_RX:
        m = re.search(rx, n)
        if m:
            size = size or m.group(0).replace(' ', '')
            n = n[:m.start()] + ' ' + n[m.end():]
    n = re.sub(r'\s+', ' ', n).strip(' ,-')
    color = []
    while True:
        m = re.search(r'[\s,]+(' + '|'.join(COLORS) + r')$', n, flags=re.I)
        if not m or m.start() == 0:
            break
        color.insert(0, m.group(1))
        n = n[:m.start()].strip(' ,-')
    return n, size, (' '.join(color).capitalize() if color else None)


# Familjer där storleken står som ord (Hög/Låg, Liten/Stor …) eller som volym
FAMILIES = [
    (r'^syntetkudde\b', 'Syntetkudde', None),
    (r'^microfiberkudde\b', 'Microfiberkudde', None),
    (r'^syntettäcke\b', 'Syntettäcke', None),
    (r'^microfibertäcke\b', 'Microfibertäcke', None),
    (r'^badrumsmatta\b', 'Badrumsmatta', r'\b(Liten|Rund|Stor)\b'),
    (r'^gjutjärnsgryta\b', 'Gjutjärnsgryta', r'\b\d+[,.]?\d*\s?l\b'),
]


def key_for(name):
    low = name.lower()
    for rx, display, size_rx in FAMILIES:
        if re.search(rx, low):
            rest = re.sub(rx, '', low, flags=re.I).strip()
            m = re.search(size_rx, name, flags=re.I) if size_rx else None
            size = m.group(0) if m else (name[len(display):].strip() or None)
            _, _, color = strip_name(name)
            if size and color:
                size = re.sub(re.escape(color), '', size, flags=re.I).strip(' ,') or None
            return display.lower(), display, color, size

    if low.startswith('doftljus solstickan'):
        return 'doftljus solstickan', 'Doftljus Solstickan', name[len('Doftljus Solstickan'):].strip(' ,') or None, None
    if low in ('carry 30l', 'carry kylkorg 30l') or low.startswith('carry kylkorg 30l'):
        n, size, color = strip_name(name)
        return 'carry kylkorg 30l', 'Carry kylkorg 30 L', color, size
    base, size, color = strip_name(name)
    return re.sub(r'\s+', ' ', base.lower()), base, color, size


def main():
    dry = '--dry-run' in sys.argv
    if not os.path.exists(BACKUP):
        shutil.copy(SEED, BACKUP)
    products = json.load(open(BACKUP))   # alltid från originalet, så att skriptet kan köras om
    featured = {it['slug'] for g in json.load(open(SITE))['featured'] for it in g['items']}

    groups = defaultdict(list)
    for i, p in enumerate(products):
        if 'give-aways' in p['categories']:
            groups[key_for(p['name'])[0]].append(i)

    drop = set()
    merged_count = 0
    for key, idxs in groups.items():
        if len(idxs) < 2:
            continue
        members = [products[i] for i in idxs]
        primary = max(members, key=lambda m: (m['slug'] in featured, len(m['gallery']) + len(m['variants']), -len(m['name'])))
        _, display, _, _ = key_for(primary['name'])
        keyed = key_for(primary['name'])
        display = keyed[1]
        variants, seen = [], set()
        gallery = list(primary['gallery'])
        for m in [primary] + [x for x in members if x is not primary]:
            _, _, mcolor, msize = key_for(m['name'])
            own = m['variants'] or [{'slug': m['slug'], 'size': None, 'color': None, 'image': m['image'], 'file': None}]
            for v in own:
                v = dict(v)
                if not v.get('color') and mcolor:
                    v['color'] = mcolor
                if (not v.get('size') or v['size'].lower() == 'one size') and msize:
                    v['size'] = msize
                sig = (v.get('slug'), v.get('color'), v.get('size'))
                if sig in seen:
                    continue
                seen.add(sig)
                variants.append(v)
            for g in m['gallery']:
                if g not in gallery:
                    gallery.append(g)
        cats = []
        for m in members:
            for c in m['categories']:
                if c not in cats:
                    cats.append(c)
        primary['name'] = display
        primary['variants'] = variants
        primary['gallery'] = gallery[:12]
        primary['categories'] = cats
        for m in members:
            if m is not primary:
                drop.add(m['slug'])
        merged_count += 1
        if dry:
            print(f"{display!r:55} <- {len(members)} st: " + ' | '.join(m['name'] for m in members)[:200])

    out = [p for p in products if p['slug'] not in drop]
    print(f'{len(products)} -> {len(out)} produkter ({merged_count} grupper, {len(drop)} borttagna)')
    if not dry:
        json.dump(out, open(SEED, 'w'), ensure_ascii=False, indent=2)
        shutil.copy(SEED, os.path.join(ROOT, 'src/data/products.json'))


if __name__ == '__main__':
    main()
