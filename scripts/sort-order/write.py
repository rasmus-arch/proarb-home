"""Skriver src/data/sort-order.json från positions.json (utdata från match.py)."""
import json, sys
pos = json.load(open(sys.argv[1]))
out = {cat: [s for s, _ in sorted(d.items(), key=lambda kv: kv[1])] for cat, d in pos.items()}
json.dump(out, open('src/data/sort-order.json', 'w'), ensure_ascii=False, indent=1)
print({k: len(v) for k, v in out.items()})
