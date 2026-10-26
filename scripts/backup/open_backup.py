#!/usr/bin/env python3
"""Open an encrypted backup and write one CSV per table (Excel-friendly).

  python3 scripts/backup/open_backup.py <backup.json.gz.age> <private-key.txt> <out-dir>

Needs the `age` program and the private key file toun keeps. CSVs are UTF-8
with a BOM so Excel shows Thai correctly. Restoring into Supabase is a
separate, deliberate step — see docs/BACKUP.md.
"""
import csv, gzip, json, os, subprocess, sys

if len(sys.argv) != 4:
    sys.exit(__doc__)
src, key, out = sys.argv[1:]
plain = subprocess.run(['age', '--decrypt', '-i', key, src], capture_output=True, check=True).stdout
doc = json.loads(gzip.decompress(plain))
os.makedirs(out, exist_ok=True)
for table, rows in doc['tables'].items():
    cols = sorted({k for r in rows for k in r}) if rows else []
    with open(os.path.join(out, f'{table}.csv'), 'w', encoding='utf-8-sig', newline='') as f:
        w = csv.writer(f)
        w.writerow(cols)
        for r in rows:
            w.writerow([json.dumps(r.get(c), ensure_ascii=False) if isinstance(r.get(c), (dict, list)) else r.get(c) for c in cols])
with open(os.path.join(out, 'backup.json'), 'w', encoding='utf-8') as f:
    json.dump(doc, f, ensure_ascii=False, indent=1)
print(f"backup from {doc['created_at']}:")
for t, n in doc['counts'].items():
    print(f'  {t}: {n}')
