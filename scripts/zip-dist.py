"""Zippar innehållet i dist/ (inte själva mappen) för uppladdning till cPanel.

Rättigheterna sätts i arkivet (mappar 755, filer 644), så att Apache kan läsa
allt oavsett vilka rättigheter filerna hade där bygget kördes.

    python3 scripts/zip-dist.py LADDA-UPP.zip
"""
import os
import sys
import zipfile

src = 'dist'
out = sys.argv[1] if len(sys.argv) > 1 else 'LADDA-UPP.zip'
n = 0
with zipfile.ZipFile(out, 'w', zipfile.ZIP_DEFLATED, compresslevel=6) as z:
    for root, dirs, files in os.walk(src):
        dirs.sort()
        rel = os.path.relpath(root, src)
        if rel != '.':
            d = zipfile.ZipInfo(rel.replace(os.sep, '/') + '/')
            d.external_attr = (0o40755 << 16) | 0x10
            z.writestr(d, b'')
        for f in sorted(files):
            p = os.path.join(root, f)
            info = zipfile.ZipInfo.from_file(p, os.path.relpath(p, src))
            info.external_attr = 0o100644 << 16
            info.compress_type = zipfile.ZIP_STORED if f.endswith(('.webp', '.png', '.jpg', '.woff2', '.woff')) else zipfile.ZIP_DEFLATED
            with open(p, 'rb') as fh:
                z.writestr(info, fh.read())
            n += 1
print(f'{out}: {n} filer, {os.path.getsize(out) / 2**20:.1f} MiB')
