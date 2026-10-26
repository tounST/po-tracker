#!/usr/bin/env python3
"""Turn yesterday's browser errors into one GitHub issue (task.md B2).

Every page reports uncaught errors and console.error() to the client_errors
table. Opening an issue is what makes GitHub email the owner. The issue holds
page + message + count only — no stack, user agent or time detail — because
issues in a public repo are public. Also prunes rows older than 60 days.
"""
import json, os, sys, urllib.request
from collections import Counter
from datetime import datetime, timedelta, timezone

base = os.environ['SUPABASE_URL'].rstrip('/')
key = os.environ['SUPABASE_KEY']
hdr = {'apikey': key, 'Authorization': 'Bearer ' + key}
now = datetime.now(timezone.utc)
since = (now - timedelta(hours=int(os.environ.get('WINDOW_HOURS', '24')))).strftime('%Y-%m-%dT%H:%M:%SZ')


def call(url, method='GET', headers=None, body=None):
    req = urllib.request.Request(url, method=method, headers={**hdr, **(headers or {})},
                                 data=json.dumps(body).encode() if body is not None else None)
    with urllib.request.urlopen(req, timeout=60) as r:
        raw = r.read()
        return json.loads(raw) if raw else None


rows = call(f'{base}/rest/v1/client_errors?select=page,kind,message&created_at=gte.{since}&order=id&limit=1000') or []
old = (now - timedelta(days=60)).strftime('%Y-%m-%dT%H:%M:%SZ')
try:
    call(f'{base}/rest/v1/client_errors?created_at=lt.{old}', method='DELETE', headers={'Prefer': 'return=minimal'})
except Exception as e:                       # pruning is housekeeping, not worth a failed run
    print(f'prune skipped: {e}')

print(f'client errors in the last window: {len(rows)}')
summary = {'errors_24h': len(rows), 'checked_utc': now.strftime('%Y-%m-%dT%H:%M:%SZ')}
if os.environ.get('STATUS_FILE') and os.path.exists(os.environ['STATUS_FILE']):
    with open(os.environ['STATUS_FILE'], encoding='utf-8') as f:
        st = json.load(f)
    st.update(summary)
    with open(os.environ['STATUS_FILE'], 'w', encoding='utf-8') as f:
        json.dump(st, f, ensure_ascii=False, indent=1)
if not rows:
    sys.exit(0)

groups = Counter((r['page'], r['message'][:200]) for r in rows)
th_months = ['ม.ค.', 'ก.พ.', 'มี.ค.', 'เม.ย.', 'พ.ค.', 'มิ.ย.', 'ก.ค.', 'ส.ค.', 'ก.ย.', 'ต.ค.', 'พ.ย.', 'ธ.ค.']
local = now + timedelta(hours=7)
label = f'{local.day} {th_months[local.month - 1]} {local.year + 543}'
lines = ['ระบบเจอข้อผิดพลาดบนหน้าจอของผู้ใช้ใน 24 ชั่วโมงที่ผ่านมา', '',
         '| หน้า | ข้อความ | ครั้ง |', '|---|---|---|']
for (page, msg), n in groups.most_common(30):
    lines.append(f"| {page} | {msg.replace('|', '/').replace(chr(10), ' ')} | {n} |")
if len(groups) > 30:
    lines.append(f'| … | อีก {len(groups) - 30} แบบ | |')
lines += ['', 'รายละเอียดเต็ม (เวลา · เครื่อง · stack) อยู่ในตาราง `client_errors` ใน Supabase',
          'ส่งลิงก์ issue นี้ให้ Claude ดูได้เลย — ถ้าเป็นเรื่องเดียวกับที่แก้ไปแล้ว ปิด issue ได้']

repo, token = os.environ.get('GITHUB_REPOSITORY'), os.environ.get('GITHUB_TOKEN')
if not (repo and token):
    print('\n'.join(lines))
    sys.exit(0)
req = urllib.request.Request(f'https://api.github.com/repos/{repo}/issues', method='POST',
                             headers={'Authorization': 'Bearer ' + token, 'Accept': 'application/vnd.github+json'},
                             data=json.dumps({'title': f'🚨 ระบบมีข้อผิดพลาด {len(rows)} ครั้ง ({label})',
                                              'body': '\n'.join(lines)}).encode())
with urllib.request.urlopen(req, timeout=60) as r:
    print('opened issue', json.loads(r.read())['html_url'])
