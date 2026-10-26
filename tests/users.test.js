// Who may see / change user PINs (toun 2026-10-26):
//   edit users + PINs  → admin only (flag editUsers)
//   see PINs           → admin, supervisor, office (flag manageUsers) —
//                        but an admin's PIN only ever to an admin
//   manager / staff    → no user screens at all
// Checked in all three places that show users: po-mobile, po-desktop, erp.
//   python3 -m http.server 8137 &   (repo root)
//   node tests/users.test.js
const path = require('path');
const fs = require('fs');
const PW = (() => { try { return require('playwright'); } catch (e) { return require('/opt/node22/lib/node_modules/playwright'); } })();
const SHIM = fs.readFileSync(path.join(__dirname, 'shim.js'), 'utf8');
const BASE = 'http://127.0.0.1:8137/';
const ADMIN_PIN = '918273';
const USERS = [
  { id: 'u-admin', username: 'toun', display_name: 'Toun', pin: ADMIN_PIN, role: 'admin', station: 'all', is_active: true },
  { id: 'u-sup', username: 'supervisor', display_name: 'สุรชัย', pin: '222333', role: 'supervisor', station: 'all', is_active: true },
  { id: 'u-off', username: 'naree', display_name: 'พี่นา', pin: '333444', role: 'office', station: 'all', is_active: true },
  { id: 'u-man', username: 'bk', display_name: 'แขก', pin: '555666', role: 'manager', station: 'all', is_active: true },
  { id: 'u-stf', username: 'qc1', display_name: 'QC1', pin: '444555', role: 'staff', station: 'qc', is_active: true },
];
const SEED = { users: USERS, role_permissions: [], activity_log: [], po_list: [], po_items: [], config: [], stock_items: [], stock_movements: [] };
const PINS = Object.fromEntries(USERS.map(u => [u.role, u.pin]));
let pass = 0, fail = 0; const errs = [];
const ok = (c, m) => { if (c) pass++; else { fail++; console.log('FAIL', m); } };

async function login(browser, file, role, viewport = { width: 1280, height: 860 }) {
  const ctx = await browser.newContext({ viewport });
  const p = await ctx.newPage();
  const toasts = [];
  p.on('pageerror', e => errs.push(`${file}/${role}: ${e.message}`));
  p.on('dialog', d => d.accept());
  await p.addInitScript(`window.__SEED=${JSON.stringify(SEED)};`);
  await p.route('**/cdn.jsdelivr.net/**', r => r.fulfill({ contentType: 'application/javascript', body: '' }));
  await p.route('**/cdn.jsdelivr.net/npm/@supabase/**', r => r.fulfill({ contentType: 'application/javascript', body: SHIM }));
  await p.route('**/fonts.googleapis.com/**', r => r.fulfill({ contentType: 'text/css', body: '' }));
  await p.route('**/fonts.gstatic.com/**', r => r.abort());
  await p.goto(BASE + file, { waitUntil: 'load' });
  await p.waitForTimeout(400);
  for (const d of PINS[role]) await p.locator('.pin-key').filter({ hasText: new RegExp(`^${d}$`) }).first().click();
  await p.waitForTimeout(1500);
  await p.exposeFunction('__toast', t => toasts.push(t)).catch(() => {});
  await p.evaluate(() => { const t = document.getElementById('toast') || document.getElementById('toast-container');
    if (t) new MutationObserver(() => window.__toast(t.textContent)).observe(t, { childList: true, subtree: true, characterData: true }); });
  return { ctx, p, toasts };
}
const html = p => p.evaluate(() => document.documentElement.outerHTML);
const visible = (p, sel) => p.locator(sel).filter({ visible: true }).count();

(async () => {
  const browser = await PW.chromium.launch();

  // ── po-mobile: จัดการ → ผู้ใช้งานระบบ ──
  const mobileUsers = async role => {
    const r = await login(browser, 'po-mobile.html', role, { width: 390, height: 844 });
    await r.p.evaluate(() => { switchTab('master'); });
    await r.p.waitForTimeout(800);
    return r;
  };
  for (const role of ['admin', 'supervisor', 'office']) {
    const { ctx, p } = await mobileUsers(role);
    ok(await visible(p, '#user-list-container .user-card') === 5, `mobile/${role}: sees all 5 users`);
    const page = await html(p);
    if (role === 'admin') {
      ok(page.includes(ADMIN_PIN), 'mobile/admin: own PIN available behind 👁');
      ok(await visible(p, '#user-list-container .user-card-edit-btn') === 5, 'mobile/admin: can edit every user');
      ok(await visible(p, 'button.edit-users-only') === 1, 'mobile/admin: ➕ เพิ่มผู้ใช้ visible');
    } else {
      ok(!page.includes(ADMIN_PIN), `mobile/${role}: admin PIN not anywhere in the page`);
      ok(page.includes('555666') && page.includes('444555'), `mobile/${role}: other people's PINs are there to reveal`);
      ok(/🔒 ซ่อน/.test(await p.innerText('#ucard-u-admin')), `mobile/${role}: admin row says 🔒 ซ่อน`);
      ok(await p.locator('#ucard-u-admin .pin-toggle-btn').count() === 0, `mobile/${role}: no 👁 on the admin row`);
      await p.click('#ucard-u-stf .pin-toggle-btn');
      ok((await p.innerText('#upin-u-stf')).trim() === '444555', `mobile/${role}: 👁 reveals a staff PIN`);
      ok(await p.locator('#user-list-container .user-card-edit-btn, #user-list-container .user-card-del-btn').count() === 0, `mobile/${role}: no edit / delete buttons`);
      ok(await visible(p, 'button.edit-users-only') === 0, `mobile/${role}: no ➕ เพิ่มผู้ใช้`);
      ok(/ดูได้อย่างเดียว/.test(await p.innerText('#user-list-container')), `mobile/${role}: says view-only`);
      // calling the functions directly is refused too
      await p.evaluate(() => { showAddUserForm(); editUser('u-stf'); deleteUser('u-stf'); });
      await p.waitForTimeout(600);
      ok(await p.locator('#uadd-form, [id^="uedit-"]').count() === 0, `mobile/${role}: add/edit forms refuse to open`);
      ok(await p.evaluate(() => window.__DATA.users.length) === 5, `mobile/${role}: delete refused`);
    }
    await ctx.close();
  }
  for (const role of ['manager', 'staff']) {
    const { ctx, p } = await mobileUsers(role);
    ok(await visible(p, '.manage-users-only') === 0, `mobile/${role}: user section hidden`);
    ok(!(await html(p)).includes('222333'), `mobile/${role}: no PINs in the page`);
    await ctx.close();
  }
  // admin edits with 6 digits; PIN never logged
  {
    const { ctx, p } = await mobileUsers('admin');
    await p.click('#ucard-u-stf .user-card-edit-btn'); await p.waitForTimeout(500);
    const f = '#uedit-u-stf';
    ok(await p.getAttribute(`${f}-pin`, 'maxlength') === '6', 'mobile form: PIN field takes 6 digits');
    await p.fill(`${f}-pin`, '1234');
    await p.click(`${f}-form .user-form-btns button >> nth=0`); await p.waitForTimeout(500);
    ok(await p.evaluate(() => window.__DATA.users.find(u => u.id === 'u-stf').pin) === '444555', 'mobile form: 4-digit PIN rejected');
    await p.fill(`${f}-pin`, '222333');
    await p.click(`${f}-form .user-form-btns button >> nth=0`); await p.waitForTimeout(500);
    ok(await p.evaluate(() => window.__DATA.users.find(u => u.id === 'u-stf').pin) === '444555', 'mobile form: PIN already used by someone else rejected');
    await p.fill(`${f}-pin`, '777888');
    await p.click(`${f}-form .user-form-btns button >> nth=0`); await p.waitForTimeout(900);
    ok(await p.evaluate(() => window.__DATA.users.find(u => u.id === 'u-stf').pin) === '777888', 'mobile form: 6-digit PIN saved');
    const log = await p.evaluate(() => JSON.stringify(window.__DATA.activity_log.filter(a => a.action === 'edit_user')));
    ok(/เปลี่ยนแล้ว/.test(log) && !/777888|444555/.test(log), `mobile: activity log says PIN changed, without the digits (${log})`);
    await ctx.close();
  }

  // ── po-desktop: จัดการ → ผู้ใช้ ──
  const desktopUsers = async role => {
    const r = await login(browser, 'po-desktop.html', role);
    await r.p.evaluate(() => goTo('manage'));
    await r.p.waitForTimeout(900);
    return r;
  };
  for (const role of ['admin', 'supervisor', 'office']) {
    const { ctx, p } = await desktopUsers(role);
    ok(await p.locator('.user-table-row').count() === 5, `pc/${role}: sees all 5 users`);
    const page = await html(p);
    if (role === 'admin') {
      ok(await p.locator('[data-edit-uid]').count() === 5 && await visible(p, '#btn-add-user') === 1, 'pc/admin: edit every user + add button');
      await p.click('[data-eye-uid="u-admin"]');
      ok((await p.innerText('[data-pin-uid="u-admin"]')).trim() === ADMIN_PIN, 'pc/admin: 👁 shows own PIN');
      await p.click('[data-edit-uid="u-stf"]'); await p.waitForTimeout(300);
      ok(await p.getAttribute('#um-pin', 'maxlength') === '6', 'pc modal: PIN field takes 6 digits');
      await p.fill('#um-pin', '123'); await p.click('#um-save-btn'); await p.waitForTimeout(500);
      ok(await p.evaluate(() => window.__DATA.users.find(u => u.id === 'u-stf').pin) === '444555', 'pc modal: short PIN rejected');
      await p.fill('#um-pin', '909090'); await p.click('#um-save-btn'); await p.waitForTimeout(900);
      ok(await p.evaluate(() => window.__DATA.users.find(u => u.id === 'u-stf').pin) === '909090', 'pc modal: 6-digit PIN saved');
      const log = await p.evaluate(() => JSON.stringify(window.__DATA.activity_log.filter(a => a.action === 'edit_user')));
      ok(/เปลี่ยนแล้ว/.test(log) && !/909090|444555/.test(log), 'pc: activity log has no PIN digits');
    } else {
      ok(!page.includes(ADMIN_PIN), `pc/${role}: admin PIN not anywhere in the page`);
      ok(await p.locator('[data-eye-uid="u-admin"]').count() === 0 && /🔒/.test(await p.innerText('.user-table-row[data-uid="u-admin"]')), `pc/${role}: admin row locked, no 👁`);
      await p.click('[data-eye-uid="u-man"]');
      ok((await p.innerText('[data-pin-uid="u-man"]')).trim() === '555666', `pc/${role}: 👁 reveals a manager PIN`);
      ok(await p.locator('[data-edit-uid], [data-del-uid]').count() === 0 && await visible(p, '#btn-add-user') === 0, `pc/${role}: no add / edit / delete`);
      await p.evaluate(() => { openUserModal(null); openUserModal({ id: 'u-stf', role: 'staff' }); });
      ok(!(await p.locator('#user-modal.show').count()), `pc/${role}: user modal refuses to open`);
      await p.evaluate(() => deleteUserDesktop({ id: 'u-stf', role: 'staff', username: 'qc1' })); await p.waitForTimeout(300);
      ok(await p.evaluate(() => window.__DATA.users.length) === 5, `pc/${role}: delete refused`);
    }
    await ctx.close();
  }
  for (const role of ['manager', 'staff']) {
    const { ctx, p } = await desktopUsers(role);
    ok(await p.locator('.user-table-row').count() === 0 && !(await html(p)).includes('222333'), `pc/${role}: no user list, no PINs`);
    await ctx.close();
  }

  // ── erp: ตั้งค่าผู้ใช้งาน ──
  const erp = async (role, vp) => {
    const r = await login(browser, 'erp.html', role, vp);
    return r;
  };
  for (const role of ['admin', 'supervisor', 'office']) {
    const { ctx, p } = await erp(role);
    ok(await visible(p, '.manage-users-only') >= 1, `erp/${role}: settings entry visible`);
    await p.evaluate(() => openUserSettings()); await p.waitForTimeout(700);
    const list = await p.innerText('#users-list');
    ok((list.match(/·/g) || []).length >= 5 && /Toun/.test(list), `erp/${role}: list shows everyone`);
    if (role === 'admin') {
      ok(await p.locator('[data-setpin]').count() === 5, 'erp/admin: เปลี่ยนรหัส on every row');
      await p.click('#users-eye-all'); await p.waitForTimeout(200);
      ok((await p.innerText('#users-list')).includes(ADMIN_PIN), 'erp/admin: show-all includes own PIN');
    } else {
      ok(!(await html(p)).includes(ADMIN_PIN), `erp/${role}: admin PIN not anywhere in the page`);
      ok(await p.evaluate(() => !('pin' in usUsers.find(u => u.role === 'admin'))), `erp/${role}: admin PIN never loaded into memory`);
      ok(await p.locator('[data-setpin]').count() === 0, `erp/${role}: no เปลี่ยนรหัส buttons`);
      ok(await p.locator('[data-eye="u-admin"]').count() === 0, `erp/${role}: no 👁 on admin`);
      await p.click('#users-eye-all'); await p.waitForTimeout(200);
      const shown = await p.innerText('#users-list');
      ok(shown.includes('444555') && shown.includes('555666') && !shown.includes(ADMIN_PIN) && /🔒 ซ่อน/.test(shown), `erp/${role}: show-all reveals others, admin stays 🔒`);
      ok(/ดูได้อย่างเดียว/.test(await p.innerText('#users-note')), `erp/${role}: note says view-only`);
      await p.evaluate(() => openPinModal('u-stf')); await p.waitForTimeout(200);
      ok(await p.locator('#pin-modal:not(.hidden)').count() === 0, `erp/${role}: PIN dialog refuses to open`);
    }
    await ctx.close();
  }
  for (const role of ['manager', 'staff']) {
    // manager/staff are bounced from ERP entirely (viewERP); the settings door must stay shut anyway
    const { ctx, p } = await erp(role);
    ok(await visible(p, '.manage-users-only') === 0, `erp/${role}: settings entry hidden`);
    await p.evaluate(() => { try { openUserSettings(); } catch (e) {} }); await p.waitForTimeout(400);
    ok(await p.locator('#users-modal:not(.hidden)').count() === 0, `erp/${role}: settings refuse to open`);
    await ctx.close();
  }
  // admin changes a PIN in ERP; a PIN equal to someone else's is refused even if not in the list
  {
    const { ctx, p } = await erp('admin');
    await p.evaluate(() => openUserSettings()); await p.waitForTimeout(600);
    await p.evaluate(() => openPinModal('u-off')); await p.waitForTimeout(200);
    await p.fill('#pin-new', '555666'); await p.fill('#pin-new2', '555666'); await p.click('#pin-save'); await p.waitForTimeout(500);
    ok(/ซ้ำ|มีคนใช้แล้ว/.test(await p.innerText('#pin-msg')), 'erp/admin: duplicate PIN refused');
    await p.fill('#pin-new', '606060'); await p.fill('#pin-new2', '606060'); await p.click('#pin-save'); await p.waitForTimeout(900);
    ok(await p.evaluate(() => window.__DATA.users.find(u => u.id === 'u-off').pin) === '606060', 'erp/admin: PIN changed');
    await ctx.close();
  }
  // PC navigation rail: supervisor sees ตั้งค่า & ผู้ใช้, manager would not (manager has no ERP)
  {
    const { ctx, p } = await erp('office', { width: 1440, height: 900 });
    ok(await visible(p, '.dk-nav-item.manage-users-only') === 1, 'erp PC rail: office sees ตั้งค่า & ผู้ใช้');
    await ctx.close();
  }

  ok(errs.length === 0, `no JS errors (${JSON.stringify([...new Set(errs)].slice(0, 5))})`);
  await browser.close();
  console.log(`pass ${pass} fail ${fail}`);
  process.exit(fail ? 1 : 0);
})();
