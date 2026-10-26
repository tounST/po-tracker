#!/usr/bin/env python3
"""Keep the backup branch small: every day for the last 60 days, plus the
first backup of each month for ever. Run inside the backup checkout."""
import os, re, sys
from datetime import date, timedelta

root = sys.argv[1] if len(sys.argv) > 1 else '.'
keep_from = date.today() - timedelta(days=60)
pat = re.compile(r'backup-(\d{4})-(\d{2})-(\d{2})\.json\.gz\.age$')
by_month = {}
for d, _, files in os.walk(os.path.join(root, 'daily')):
    for f in files:
        m = pat.match(f)
        if m:
            by_month.setdefault(m.group(1) + m.group(2), []).append((date(*map(int, m.groups())), os.path.join(d, f)))
removed = 0
for month, items in by_month.items():
    items.sort()
    first = items[0][1]                       # oldest of the month is kept
    for day, path in items:
        if day < keep_from and path != first:
            os.remove(path)
            removed += 1
print(f'pruned {removed} old daily backups')
