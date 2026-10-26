#!/usr/bin/env python3
"""Nightly backup of the Supabase database (task.md B2).

Run by .github/workflows/nightly-backup.yml. Reads every table through the
public REST API, checks that each table came back complete, gzips the lot and
encrypts it with `age` for the public key in backup-recipient.txt. Only the
holder of the matching private key (toun) can read the result — this repo is
public, and the data holds staff PINs, purchase prices and customer names.

Writes into OUT_DIR:
  daily/YYYY-MM/backup-YYYY-MM-DD.json.gz.age   the encrypted snapshot
  status.json                                   row counts + time (no data)

Never prints table contents: workflow logs of a public repo are public too.
Exit code 2 = the database could not be read (asleep, down, or partial).
"""
import gzip, json, os, subprocess, sys, time, urllib.error, urllib.request
from datetime import datetime, timedelta, timezone

# table -> PostgREST order clause. A stable order is what makes paging safe.
TABLES = {
    'po_list': 'id', 'po_items': 'id', 'config': 'id', 'users': 'id',
    'role_permissions': 'role,permission_key', 'activity_log': 'id',
    'stock_items': 'id', 'stock_movements': 'id', 'client_errors': 'id',
}
PAGE = 1000          # Supabase caps a response at 1000 rows (see BUG43)
HERE = os.path.dirname(os.path.abspath(__file__))


def get(url, key, want_count=False, tries=6):
    """GET with retries. A free-tier project that is waking up answers 5xx for
    a while, so back off for up to ~2 minutes before calling it down."""
    headers = {'apikey': key, 'Authorization': 'Bearer ' + key, 'Accept': 'application/json'}
    if want_count:
        headers['Prefer'] = 'count=exact'
    delay = 5
    for attempt in range(1, tries + 1):
        try:
            with urllib.request.urlopen(urllib.request.Request(url, headers=headers), timeout=60) as r:
                return json.loads(r.read().decode('utf-8')), r.headers.get('Content-Range')
        except urllib.error.HTTPError as e:
            if e.code < 500 or attempt == tries:
                raise RuntimeError(f'HTTP {e.code} for {url.split("?")[0]}') from None
        except (urllib.error.URLError, TimeoutError, ConnectionError) as e:
            if attempt == tries:
                raise RuntimeError(f'network error for {url.split("?")[0]}: {e}') from None
        print(f'  retry {attempt}/{tries - 1} in {delay}s', flush=True)
        time.sleep(delay)
        delay = min(delay * 2, 40)


def fetch_table(base, key, table, order):
    rows, offset, total = [], 0, None
    while True:
        url = f'{base}/rest/v1/{table}?select=*&order={order}&limit={PAGE}&offset={offset}'
        page, crange = get(url, key, want_count=(offset == 0))
        if offset == 0:
            # "0-999/1234" or "*/0" — the number after the slash is the true total
            try:
                total = int((crange or '').split('/')[-1])
            except ValueError:
                total = None
        rows.extend(page)
        if len(page) < PAGE:
            break
        offset += PAGE
    if total is not None and total != len(rows):
        # A half backup that looks whole is worse than a loud failure.
        raise RuntimeError(f'{table}: got {len(rows)} rows, database says {total}')
    return rows


def main():
    base = os.environ['SUPABASE_URL'].rstrip('/')
    key = os.environ['SUPABASE_KEY']
    out_dir = os.environ.get('OUT_DIR', '.')
    recipient_file = os.path.join(HERE, 'backup-recipient.txt')
    now = datetime.now(timezone.utc)

    data, counts = {}, {}
    try:
        for table, order in TABLES.items():
            data[table] = fetch_table(base, key, table, order)
            counts[table] = len(data[table])
            print(f'  {table}: {counts[table]} rows', flush=True)
    except RuntimeError as e:
        print(f'::error::อ่านฐานข้อมูลไม่ได้ — {e}', flush=True)
        return 2

    payload = json.dumps({'format': 1, 'created_at': now.isoformat(), 'project': base,
                          'counts': counts, 'tables': data},
                         ensure_ascii=False, separators=(',', ':')).encode('utf-8')
    packed = gzip.compress(payload, compresslevel=9)

    day = (now + timedelta(hours=7)).strftime('%Y-%m-%d')   # Bangkok date — the one toun thinks in
    rel = f'daily/{day[:7]}/backup-{day}.json.gz.age'
    dest = os.path.join(out_dir, rel)
    os.makedirs(os.path.dirname(dest), exist_ok=True)
    # Plaintext only ever exists in this process's memory and age's stdin.
    subprocess.run(['age', '--encrypt', '-R', recipient_file, '-o', dest], input=packed, check=True)

    status = {'ok': True, 'last_backup_utc': now.strftime('%Y-%m-%dT%H:%M:%SZ'), 'file': rel,
              'size_bytes': os.path.getsize(dest), 'tables': len(counts), 'counts': counts}
    with open(os.path.join(out_dir, 'status.json'), 'w', encoding='utf-8') as f:
        json.dump(status, f, ensure_ascii=False, indent=1)
    print(f'saved {rel} ({status["size_bytes"]:,} bytes, {sum(counts.values()):,} rows)', flush=True)
    return 0


if __name__ == '__main__':
    sys.exit(main())
