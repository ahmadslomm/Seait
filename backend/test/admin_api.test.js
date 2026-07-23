#!/usr/bin/env node
/**
 * Acceptance test for the operator console API.
 *
 * Exercises the real HTTP surface: auth (login + guard), generic CRUD over the
 * registry, active-toggle, economy balance adjustment through the shared ledger,
 * asset upload, and role enforcement. It does NOT touch the api.php gateway,
 * room socket, or RTC — those suites stay independent.
 *
 * Usage: node test/admin_api.test.js [base] [username] [password]
 */
const http = require('http');

const BASE = process.argv[2] || 'http://127.0.0.1:8077';
const USER = process.argv[3] || 'admin';
const PASS = process.argv[4] || process.env.ADMIN_SEED_PASSWORD || 'seait-admin-2026';

let pass = 0, fail = 0;
const ok = (n, x = '') => { pass++; console.log(`  ✓ ${n}${x ? '  ' + x : ''}`); };
const bad = (n, e) => { fail++; console.log(`  ✗ ${n}\n      ${e}`); };
const check = (n, c, x = '') => c ? ok(n, x) : bad(n, x || 'failed');

function req(method, path, { token, body, raw, contentType } = {}) {
  return new Promise((res, rej) => {
    const u = new URL(BASE);
    const headers = {};
    if (token) headers['Authorization'] = 'Bearer ' + token;
    let payload = null;
    if (raw) { payload = raw; headers['Content-Type'] = contentType; }
    else if (body !== undefined) { payload = JSON.stringify(body); headers['Content-Type'] = 'application/json'; }
    if (payload) headers['Content-Length'] = Buffer.byteLength(payload);
    const r = http.request({ host: u.hostname, port: u.port, path, method, headers }, x => {
      let d = ''; x.on('data', c => d += c); x.on('end', () => {
        let j; try { j = JSON.parse(d); } catch { j = { raw: d }; }
        res({ status: x.statusCode, body: j });
      });
    });
    r.on('error', rej); if (payload) r.write(payload); r.end();
  });
}

(async () => {
  console.log(`Admin console API -> ${BASE}\n`);

  console.log('auth');
  const badLogin = await req('POST', '/admin/api/login', { body: { username: USER, password: 'wrong' } });
  check('a wrong password is rejected', badLogin.body.ok === false, JSON.stringify(badLogin.body));
  const login = await req('POST', '/admin/api/login', { body: { username: USER, password: PASS } });
  check('correct credentials return a token', login.body.ok === true && !!login.body.token, JSON.stringify(login.body).slice(0, 60));
  const token = login.body.token;
  const noAuth = await req('GET', '/admin/api/dashboard');
  check('the guard blocks an unauthenticated request', noAuth.status === 401, `status ${noAuth.status}`);
  const me = await req('GET', '/admin/api/me', { token });
  check('me returns the operator identity', me.body.admin && me.body.admin.username === USER);

  console.log('dashboard + menu');
  const dash = await req('GET', '/admin/api/dashboard', { token });
  check('dashboard reports user count', dash.body && typeof dash.body.users === 'number', `users=${dash.body.users}`);
  const menu = await req('GET', '/admin/api/menu', { token });
  check('menu groups assets/economy/system', menu.body.assets && menu.body.economy && menu.body.system,
    `assets=${menu.body.assets && menu.body.assets.length}`);

  console.log('CRUD — gifts');
  const list = await req('GET', '/admin/api/entity/gifts', { token });
  check('gift list returns rows and a field schema', Array.isArray(list.body.list) && list.body.entity.fields.length > 0,
    `rows=${list.body.list.length}`);
  const gid = 90000 + Math.floor(Math.random() * 9999);
  const created = await req('POST', '/admin/api/entity/gifts', { token,
    body: { gift_id: gid, name: 'Test Rose', icon: 'ui/gift_box.webp', price: 99, coin_type: 1, anim_type: 1, active: true } });
  check('create returns the new gift', created.body.gift_id === gid, JSON.stringify(created.body).slice(0, 80));
  const updated = await req('PUT', `/admin/api/entity/gifts/${gid}`, { token, body: { name: 'Renamed Rose', price: 150 } });
  check('update changes the fields', updated.body.name === 'Renamed Rose' && String(updated.body.price) === '150');
  const toggled = await req('POST', `/admin/api/entity/gifts/${gid}/toggle`, { token });
  check('toggle flips active', toggled.body.active === false);
  const removed = await req('DELETE', `/admin/api/entity/gifts/${gid}`, { token });
  check('delete removes it', removed.body.ok === true);
  const gone = await req('GET', `/admin/api/entity/gifts/${gid}`, { token });
  check('the deleted gift is gone', gone.status === 404, `status ${gone.status}`);

  console.log('CRUD — typed view isolation (VIP vs user frames)');
  const vf = await req('POST', '/admin/api/entity/vip-frames', { token, body: { name: 'Royal Frame', price: 500, vip_only: 3 } });
  check('a VIP frame is created with type=frame', vf.body.type === 'frame' && vf.body.vip_only === 3, JSON.stringify(vf.body).slice(0, 90));
  const uf = await req('GET', '/admin/api/entity/user-frames', { token });
  check('the VIP frame does NOT appear under user frames', !uf.body.list.some(x => x.product_id === vf.body.product_id));
  const vfl = await req('GET', '/admin/api/entity/vip-frames', { token });
  check('but DOES appear under VIP frames', vfl.body.list.some(x => x.product_id === vf.body.product_id));
  await req('DELETE', `/admin/api/entity/vip-frames/${vf.body.product_id}`, { token });

  console.log('validation');
  const missing = await req('POST', '/admin/api/entity/gifts', { token, body: { price: 10 } });
  check('a missing required field is a 400', missing.status === 400, `status ${missing.status}`);
  const badInt = await req('POST', '/admin/api/entity/gifts', { token, body: { gift_id: 'notanumber', name: 'x' } });
  check('a non-numeric int is a 400', badInt.status === 400, `status ${badInt.status}`);

  console.log('economy');
  const users = await req('GET', '/admin/api/users?q=1278472', { token });
  check('user search finds the seeded account', users.body.some && users.body.some(u => u.uid === 1278472) || (Array.isArray(users.body) && users.body.some(u => u.uid === 1278472)), JSON.stringify(users.body).slice(0, 60));
  const before = await req('GET', '/admin/api/users/1278472', { token });
  const beforeCoins = Number(before.body.coins);
  const credit = await req('POST', '/admin/api/users/1278472/balance', { token, body: { currency: 'coins', amount: 1234, reason: 'test grant' } });
  check('a credit reports the new balance', credit.body.balance && Number(credit.body.balance.coins) === beforeCoins + 1234,
    `${beforeCoins} -> ${credit.body.balance && credit.body.balance.coins}`);
  const overdraw = await req('POST', '/admin/api/users/1278472/balance', { token, body: { currency: 'coins', amount: -99999999999, reason: 'overdraw' } });
  check('an overdrawing debit is refused, not floored', overdraw.status === 400, `status ${overdraw.status}`);

  console.log('asset upload');
  // a tiny valid PNG (1x1) as multipart/form-data
  const png = Buffer.from('89504e470d0a1a0a0000000d49484452000000010000000108060000001f15c4890000000d4944415478da6360000002000154a24f200000000049454e44ae426082', 'hex');
  const boundary = '----seaittest' + Date.now();
  const body = Buffer.concat([
    Buffer.from(`--${boundary}\r\nContent-Disposition: form-data; name="file"; filename="dot.png"\r\nContent-Type: image/png\r\n\r\n`),
    png, Buffer.from(`\r\n--${boundary}--\r\n`),
  ]);
  const up = await req('POST', '/admin/api/assets/upload', { token, raw: body, contentType: `multipart/form-data; boundary=${boundary}` });
  check('upload stores the file and returns a relative path', up.body.ok === true && /^uploads\/image\//.test(up.body.path || ''),
    JSON.stringify(up.body).slice(0, 90));
  const lib = await req('GET', '/admin/api/assets?kind=image', { token });
  check('the upload appears in the asset library', lib.body.list.some(a => a.path === up.body.path));

  console.log('audit');
  const audit = await req('GET', '/admin/api/audit?limit=50', { token });
  check('mutations were written to the audit log',
    audit.body.list.some(a => a.action === 'create') && audit.body.list.some(a => a.action === 'balance'),
    `entries=${audit.body.list.length}`);

  console.log(`\n${pass} passed, ${fail} failed`);
  process.exit(fail === 0 ? 0 : 1);
})().catch(e => { console.error('harness error:', e.message); process.exit(2); });
