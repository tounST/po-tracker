// Error reporter + backup health card (task.md B2).
//   python3 -m http.server 8137 &   (from the repo root)
//   node tests/errors.test.js
const path = require('path');
const fs = require('fs');
const PW = (() => { try { return require('playwright'); } catch (e) { return require('/opt/node22/lib/node_modules/playwright'); } })();
const { chromium } = PW;
const ROOT = path.resolve(__dirname, '..');
const SHIM = fs.readFileSync(path.join(__dirname, 'shim.js'), 'utf8');
const LOCAL = 'http://127.0.0.1:8137/';
const LIVE = 'https://tounst.github.io/po-tracker/';
const PAGES = [['stock.html', 'stock'], ['erp.html', 'erp'], ['po-mobile.html', 'po-mobile'], ['po-desktop.html', 'po-desktop']];
const ago = h => new Date(Date.now() - h * 3600000).toISOString();
const SEED = {
  users: [{ id: 'u1', username: 'toun', display_name: 'Toun', pin: '111222', role: 'admin', station: 'all', is_active: true }],
  role_permissions: [], activity_log: [], po_list: [], po_items: [],
  config: [{ id: 'c1', config_type: 'stock_unit', config_value: 'ลิตร', sort_order: 1, is_active: true }],
  stock_items: [{ id: 's1', name: 'ทินเนอร์', category: 'สี', unit: 'ลิตร', qty_current: 10, qty_min: 2, cost_per_unit: 50, is_active: true }],
  stock_movements: [{ id: 'm1', item_id: 's1', movement_type: 'initial', qty: 10, balance_after: 10, unit_cost: 50, created_at: ago(240) }],
  client_errors: [],
};
let pass = 0, fail = 0;
const pageErrors = [];
const ok = (c, m) => { if (c) pass++; else { fail++; console.log('FAIL', m); } };

async function open(browser, file, { live = false, seed = SEED, status = null, abortXlsx = false } = {}) {
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 860 } });
  const p = await ctx.newPage();
  const posts = [], consoleErrors = [];
  p.on('pageerror', e => pageErrors.push(`${file}: ${e.message}`));
  p.on('console', m => { if (m.type() === 'error') consoleErrors.push(m.text()); });
  p.on('dialog', d => d.accept());
  await p.addInitScript(`window.__SEED=${JSON.stringify(seed)};`);
  await p.route('**/cdn.jsdelivr.net/**', r => abortXlsx && /xlsx/.test(r.request().url()) ? r.abort() : r.fulfill({ contentType: 'application/javascript', body: '' }));
  await p.route('**/cdn.jsdelivr.net/npm/@supabase/**', r => r.fulfill({ contentType: 'application/javascript', body: SHIM }));
  await p.route('**/fonts.googleapis.com/**', r => r.fulfill({ contentType: 'text/css', body: '' }));
  await p.route('**/fonts.gstatic.com/**', r => r.abort());
  await p.route('https://rkdxbxtakvisroxelrvq.supabase.co/rest/v1/client_errors', r => {
    posts.push({ method: r.request().method(), body: JSON.parse(r.request().postData() || 'null'), headers: r.request().headers() });
    r.fulfill({ status: 201, body: '' });
  });
  await p.route('https://raw.githubusercontent.com/**', r => status === null
    ? r.fulfill({ status: 404, body: '404' })
    : r.fulfill({ contentType: 'application/json', body: JSON.stringify(status), headers: { 'access-control-allow-origin': '*' } }));
  if (live) {
    await p.route(LIVE + '**', r => {
      const f = path.join(ROOT, new URL(r.request().url()).pathname.replace('/po-tracker/', '') || 'index.html');
      fs.existsSync(f) ? r.fulfill({ path: f }) : r.fulfill({ status: 404, body: '' });
    });
  }
  await p.goto((live ? LIVE : LOCAL) + file, { waitUntil: 'load' });
  await p.waitForTimeout(600);
  return { ctx, p, posts, consoleErrors };
}

(async () => {
  const browser = await chromium.launch();

  // ── 1. each page reports what goes wrong, once, within the DB limits ──
  for (const [file, page] of PAGES) {
    const { ctx, p, posts, consoleErrors } = await open(browser, file, { live: true });
    const boot = posts.length;
    await p.evaluate(() => {
      setTimeout(() => { throw new Error('boom-A'); }, 0);
      setTimeout(() => { throw new Error('boom-A'); }, 5);      // same message again → not resent
      Promise.reject(new Error('rej-B'));
      console.error('[saveX]', { message: 'db fail C', code: '23505' });
    });
    await p.waitForTimeout(500);
    const mine = posts.slice(boot).map(x => x.body);
    ok(boot === 0, `${file}: nothing reported while the page loads (${boot}: ${JSON.stringify(posts.slice(0, boot).map(x => x.body.message))})`);
    ok(mine.filter(b => /boom-A/.test(b.message)).length === 1, `${file}: uncaught error reported exactly once`);
    ok(mine.some(b => b.kind === 'rejection' && /rej-B/.test(b.message)), `${file}: unhandled promise rejection reported`);
    ok(mine.some(b => b.kind === 'console' && /\[saveX\] db fail C/.test(b.message)), `${file}: console.error with a Supabase-style error object reported`);
    ok(mine.every(b => b.page === page), `${file}: page = "${page}"`);
    ok(mine.every(b => ['error', 'rejection', 'console'].includes(b.kind) && b.page.length <= 40 && b.message.length <= 500 &&
      (b.stack || '').length <= 2000 && (b.source || '').length <= 200 && (b.user_agent || '').length <= 300 && (b.app_version || '').length <= 40),
      `${file}: every report fits the table's CHECK limits`);
    ok(!mine.some(b => 'user' in b || 'username' in b || 'display_name' in b), `${file}: no user identity in the report`);
    ok(posts.every(x => x.method === 'POST' && x.headers.apikey && x.headers.prefer === 'return=minimal'), `${file}: plain REST insert with the anon key`);
    ok(consoleErrors.some(t => /\[saveX\]/.test(t)), `${file}: console.error still prints to the console`);
    // a storm of errors is capped at 10 per page load
    await p.evaluate(() => { for (let i = 0; i < 25; i++) setTimeout(() => { throw new Error('storm ' + i); }, 0); });
    await p.waitForTimeout(500);
    ok(posts.length <= 10, `${file}: at most 10 reports per page load (${posts.length})`);
    await ctx.close();
  }

  // ── 2. local copies and tests stay quiet ──
  {
    const { ctx, p, posts } = await open(browser, 'stock.html');
    await p.evaluate(() => { setTimeout(() => { throw new Error('local'); }, 0); console.error('local'); });
    await p.waitForTimeout(400);
    ok(posts.length === 0, `not on tounst.github.io → nothing is sent (${posts.length})`);
    await ctx.close();
  }

  // ── 3. a script that fails to load is reported ──
  {
    const { ctx, posts } = await open(browser, 'po-mobile.html', { live: true, abortXlsx: true });
    ok(posts.some(x => /โหลดสคริปต์ไม่สำเร็จ: .*xlsx/.test(x.body.message)), `failed CDN script is reported (${JSON.stringify(posts.map(x => x.body.message))})`);
    await ctx.close();
  }

  // ── 4. backup health card in the admin tab ──
  const card = async (opts) => {
    const r = await open(browser, 'stock.html', opts);
    for (const d of '111222') await r.p.click(`.pin-key:has-text("${d}")`);
    await r.p.waitForTimeout(1500);
    await r.p.evaluate(() => switchStockView('perms'));
    await r.p.waitForTimeout(800);
    const text = await r.p.innerText('#health-card');
    return { ...r, text };
  };
  {
    const st = { ok: true, last_backup_utc: ago(5), file: 'daily/x.age', tables: 9, counts: { po_list: 15, stock_items: 73 } };
    const { ctx, p, text } = await card({ status: st });
    ok(/✅\s*สำรองล่าสุด .* 9 ตาราง · 88 แถว/.test(text), `fresh backup shown as OK (${JSON.stringify(text)})`);
    ok(/ไม่มีข้อผิดพลาดบนหน้าจอผู้ใช้/.test(text), 'no errors → says so');
    ok(/ถ้ากุญแจหาย/.test(text), 'reminds that the key must not be lost');
    ok(await p.locator('#health-card a[href$="/issues"]').count() === 1 && await p.locator('#health-card a[href$="/tree/backup"]').count() === 1, 'links to alerts and backup files');
    await p.setViewportSize({ width: 320, height: 640 }); await p.waitForTimeout(200);
    const w = await p.evaluate(() => [document.documentElement.scrollWidth, innerWidth]);
    ok(w[0] <= w[1], `320px: card does not push the page sideways (${w})`);
    await ctx.close();
  }
  {
    const seed = { ...SEED, client_errors: [{ id: 1, created_at: ago(2), page: 'stock', kind: 'error', message: 'x' }, { id: 2, created_at: ago(3), page: 'erp', kind: 'error', message: 'y' }, { id: 3, created_at: ago(50), page: 'erp', kind: 'error', message: 'old' }] };
    const { ctx, text } = await card({ status: { ok: true, last_backup_utc: ago(24 * 5 + 2), tables: 9, counts: {} }, seed });
    ok(/ไม่ได้สำรองมา 5 วันแล้ว/.test(text), `stale backup flagged (${text.split('\n')[2]})`);
    ok(/ข้อผิดพลาดบนหน้าจอผู้ใช้ 2 ครั้ง/.test(text), 'counts only the last 24 hours (2 of 3)');
    await ctx.close();
  }
  {
    const { ctx, text } = await card({ status: null });
    ok(/ยังไม่มีข้อมูลสำรอง/.test(text), 'no status file yet → "รอบแรกจะเกิดคืนนี้"');
    await ctx.close();
  }

  // ── 5. every page still boots cleanly ──
  for (const [file] of PAGES) {
    const { ctx } = await open(browser, file);
    await ctx.close();
  }
  ok(pageErrors.filter(e => !/boom-A|rej-B|storm|local/.test(e)).length === 0,
    `no unexpected JS errors (${JSON.stringify([...new Set(pageErrors.filter(e => !/boom-A|rej-B|storm|local/.test(e)))])})`);

  await browser.close();
  console.log(`pass ${pass} fail ${fail}`);
  process.exit(fail ? 1 : 0);
})();
