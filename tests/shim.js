// Minimal in-browser stand-in for supabase-js, used by the tests in this
// folder. Seed data comes from window.__SEED (set by the test before load);
// every call is recorded in window.__SB_LOG. It mirrors the query-builder
// shape only — RPC maths, RLS and overload resolution are NOT simulated, so
// anything that depends on them must be checked against the real database
// (see the BUG46 note in CLAUDE.md).
(function () {
  const DATA = window.__DATA = JSON.parse(JSON.stringify(window.__SEED || {}));
  const LOG = window.__SB_LOG = [];
  let seq = 0;
  function query(table) {
    const filters = [];
    let op = 'select', payload = null, single = false, maybe = false, wantCount = false, head = false,
        orderBy = [], lim = null, rng = null, cols = null;
    const f = fn => { filters.push(fn); return api; };
    const api = {
      select(c, o) {
        if (op === 'select' && c && c.trim() !== '*') cols = c.split(',').map(x => x.trim()).filter(Boolean);
        if (o && o.count) wantCount = true; if (o && o.head) head = true; return api;
      },
      eq: (k, v) => f(r => String(r[k]) === String(v)),
      neq: (k, v) => f(r => String(r[k]) !== String(v)),
      in: (k, vs) => f(r => vs.map(String).includes(String(r[k]))),
      gte: (k, v) => f(r => r[k] >= v), gt: (k, v) => f(r => r[k] > v),
      lte: (k, v) => f(r => r[k] <= v), lt: (k, v) => f(r => r[k] < v),
      is: (k, v) => f(r => (r[k] ?? null) === v),
      ilike: (k, v) => { const re = new RegExp('^' + String(v).replace(/%/g, '.*') + '$', 'i'); return f(r => re.test(String(r[k] ?? ''))); },
      not: () => api, or: () => api, filter: () => api, contains: () => api,
      order(k, o) { orderBy.push([k, !(o && o.ascending === false)]); return api; },
      limit(n) { lim = n; return api; }, range(a, b) { rng = [a, b]; return api; },
      single() { single = true; return api; }, maybeSingle() { single = true; maybe = true; return api; },
      insert(p) { op = 'insert'; payload = p; return api; }, upsert(p) { op = 'upsert'; payload = p; return api; },
      update(p) { op = 'update'; payload = p; return api; }, delete() { op = 'delete'; return api; },
      then(res, rej) { return Promise.resolve().then(run).then(res, rej); },
    };
    function run() {
      const T = DATA[table] || (DATA[table] = []);
      LOG.push({ table, op, payload });
      if (op === 'insert' || op === 'upsert') {
        const rows = [].concat(payload).map(r => ({ id: r.id || ('t' + (++seq)), created_at: new Date().toISOString(), ...r }));
        T.push(...rows);
        return { data: single ? rows[0] : rows, error: null };
      }
      let m = T.filter(r => filters.every(fn => fn(r)));
      if (op === 'update') { m.forEach(r => Object.assign(r, payload)); return { data: m, error: null }; }
      if (op === 'delete') { DATA[table] = T.filter(r => !m.includes(r)); return { data: m, error: null }; }
      orderBy.slice().reverse().forEach(([k, asc]) => {
        m = m.slice().sort((a, b) => (a[k] > b[k] ? 1 : a[k] < b[k] ? -1 : 0) * (asc ? 1 : -1));
      });
      const count = m.length;
      if (rng) m = m.slice(rng[0], rng[1] + 1);
      if (lim != null) m = m.slice(0, lim);
      if (head) return { data: null, count, error: null };
      // Like the real API: a copy, holding only the columns asked for — so a
      // page that "forgets" a column cannot see it, and a row read before an
      // update is not silently changed by that update.
      m = m.map(r => {
        const c = JSON.parse(JSON.stringify(r));
        if (!cols) return c;
        const o = {}; cols.forEach(k => { if (k in c) o[k] = c[k]; }); return o;
      });
      if (single) return m.length ? { data: m[0], error: null }
        : { data: null, error: maybe ? null : { message: 'no rows', code: 'PGRST116' } };
      return { data: m, count: wantCount ? count : null, error: null };
    }
    return api;
  }
  window.supabase = {
    createClient() {
      return {
        from: query,
        rpc: async (fn, args) => { LOG.push({ rpc: fn, args }); return { data: null, error: null }; },
        channel() { const ch = { on: () => ch, subscribe(cb) { if (cb) cb('SUBSCRIBED'); return ch; }, unsubscribe() {} }; return ch; },
        removeChannel() {},
        storage: { from: () => ({ upload: async () => ({ error: null }), getPublicUrl: () => ({ data: { publicUrl: '' } }) }) },
      };
    },
  };
})();
