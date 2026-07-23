#!/usr/bin/env node
/**
 * Coverage smoke test: every endpoint in the inventory must respond as
 * IMPLEMENTED, not fall through to the fallback logger.
 *
 * This is not a per-endpoint behaviour test (api_modules.test.js does that for
 * the important ones). It proves the weaker but essential property that the
 * inventory claims: every action the app can send is answered by real code.
 *
 * How "answered" is detected: the fallback path returns `response_data: null`
 * for a truly-unknown action and `{}` for a known-but-unimplemented one, and it
 * appends to unknown-apis.log. So the test records the log size, fires every
 * action, and asserts nothing new was logged. JSON-RPC actions go through the
 * real encrypted gateway; the HTTP/H5 routes are hit directly.
 *
 * Usage: node test/api_coverage.test.js [apiBase]
 */
const http = require('http');
const fs = require('fs');
const path = require('path');
const { createHash } = require('crypto');

const BASE = process.argv[2] || 'http://127.0.0.1:8077';
const UID = 1278472;
const inventory = require('../src/api-spec/inventory.json');
const LOG = path.join(__dirname, '..', 'unknown-apis.log');

const KEY = Buffer.from(createHash('md5').update('com.waig.nalo').digest('hex'));
const xor = (d, k) => { const o = Buffer.allocUnsafe(d.length); for (let i = 0; i < d.length; i++) o[i] = d[i] ^ k[i % k.length]; return o; };
const enc = j => xor(Buffer.from(j, 'utf8'), KEY).toString('base64');
const dec = b => { let s = b.replace(/_/g, '/'); while (s.length % 4) s += '='; return xor(Buffer.from(s, 'base64'), KEY).toString('utf8'); };

// Representative params so handlers that need an id do not bail before doing
// anything. These are existing seeded ids.
const COMMON = { uid: UID, _login_uid: UID, rid: 1, roomId: 1, target_uid: 900100, tuid: 900100,
  gift_id: 1, giftId: 1, product_id: 7, game_id: 1, gameId: 1, page: 1, keyword: 'a',
  seatNo: 2, num: 1, moment_id: 1, bottle_id: 1, comment_id: 1, medal_id: 1,
  country: 'SA', mobile: '900000000', text: 'x', bag_id: 1, level: 1, act_id: 1, pk_id: 1 };

function callAction(action) {
  return new Promise(res => {
    const body = 'app_id=com.waig.nalo&http_body=' + enc(JSON.stringify({ action, token: '', ...COMMON }));
    const u = new URL(BASE);
    const r = http.request({ host: u.hostname, port: u.port, path: '/api.php', method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded', 'Content-Length': Buffer.byteLength(body) } },
      x => { let d = ''; x.on('data', c => d += c); x.on('end', () => {
        let t = d.trim(); if (t.startsWith('QxZ')) t = dec(t);
        try { res({ ok: true, data: JSON.parse(t).response_data }); }
        catch { res({ ok: false, raw: t.slice(0, 80) }); }
      }); });
    r.on('error', e => res({ ok: false, err: e.message })); r.write(body); r.end();
  });
}

function callHttp(route) {
  return new Promise(res => {
    const p = '/' + route.replace(/^\//, '').split('?')[0];
    const u = new URL(BASE);
    const r = http.request({ host: u.hostname, port: u.port, path: p, method: 'GET' },
      x => { let d = ''; x.on('data', c => d += c); x.on('end', () => res({ status: x.statusCode, body: d.slice(0, 60) })); });
    r.on('error', e => res({ status: 0, err: e.message })); r.end();
  });
}

const isAction = a => /^(Action\/)?[A-Za-z_]\w*\.[A-Za-z_]\w*$/.test(a) && !a.endsWith('.php');

(async () => {
  const before = fs.existsSync(LOG) ? fs.statSync(LOG).size : 0;
  const eps = inventory.endpoints;
  const actions = eps.filter(e => isAction(e.action));
  const routes = eps.filter(e => !isAction(e.action));

  console.log(`Coverage smoke test -> ${BASE}`);
  console.log(`${eps.length} endpoints: ${actions.length} actions, ${routes.length} http/h5\n`);

  let errored = 0;
  // Actions: fire all, collect transport failures.
  for (const e of actions) {
    const r = await callAction(e.action);
    if (!r.ok) { errored++; console.log(`  ✗ ${e.action}: ${r.err || r.raw}`); }
  }
  // HTTP/H5: every route must resolve (not 404). 200 or a deliberate
  // not_configured JSON both count; only a 404 means the route is missing.
  let missing = 0;
  for (const e of routes) {
    const r = await callHttp(e.action);
    if (r.status === 404 || r.status === 0) { missing++; console.log(`  ✗ ${e.action}: status ${r.status} ${r.err || ''}`); }
  }

  // Give the async fallback logger a moment to flush.
  await new Promise(r => setTimeout(r, 300));
  const after = fs.existsSync(LOG) ? fs.statSync(LOG).size : 0;

  let leaked = [];
  if (after > before) {
    const added = fs.readFileSync(LOG, 'utf8').slice(before).trim().split('\n');
    for (const line of added) {
      try { const o = JSON.parse(line); if (o.action) leaked.push(o.action); } catch {}
    }
  }
  leaked = [...new Set(leaked)];

  console.log('');
  console.log(`transport errors:        ${errored}`);
  console.log(`missing http/h5 routes:  ${missing}`);
  console.log(`fell through to logger:  ${leaked.length}${leaked.length ? ' -> ' + leaked.join(', ') : ''}`);

  const failed = errored + missing + leaked.length;
  console.log(`\n${failed === 0 ? 'PASS' : 'FAIL'}: ${eps.length - failed}/${eps.length} endpoints answered by real code`);
  process.exit(failed === 0 ? 0 : 1);
})();
