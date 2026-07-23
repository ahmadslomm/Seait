#!/usr/bin/env node
/**
 * Builds the single source of truth for the API cloning effort.
 *
 * Three recovered datasets describe the original app's surface, and each is
 * incomplete on its own:
 *
 *   src/actions.catalog.json          303 action names (what the app can call)
 *   zaffa_recovery/COMPLETE_API_...   280 endpoints WITH caller sites + module
 *   zaffa_recovery/API_SCHEMA.json    244 @SerializedName model classes
 *
 * The catalog has no response shapes at all (`response_fields` is empty for
 * every entry), so route names alone would leave every response invented. The
 * model classes are where real field names live — they are the decrypted
 * SerializedName keys the original client deserialised into, which is the
 * closest thing to a response schema that exists without a live server to
 * capture from.
 *
 * This merges the three, folds in what the running backend already implements
 * and what the app has actually been observed calling (unknown-apis.log), and
 * writes src/api-spec/inventory.json plus a readable coverage report.
 *
 * Re-runnable: nothing here mutates the recovered data.
 *
 * Usage: node tools/build_api_inventory.js [--report]
 */
const fs = require('fs');
const path = require('path');

const BE  = path.join(__dirname, '..');
const REC = '/root/zaffa_recovery';
const OUT = path.join(BE, 'src', 'api-spec');

const readJson = p => JSON.parse(fs.readFileSync(p, 'utf8'));

// ── sources ─────────────────────────────────────────────────────────
const catalog  = readJson(path.join(BE, 'src', 'actions.catalog.json'));
const contract = readJson(path.join(REC, 'COMPLETE_API_CONTRACT.json'));
const schema   = readJson(path.join(REC, 'API_SCHEMA.json'));

// What the backend implements today, read from source so it cannot drift.
// Handlers live in two places: a few directly on the gateway router, the rest
// in the domain modules. Scanning only the router silently under-reports every
// module action, which would make the coverage figure meaningless.
const srcFiles = [
  path.join(BE, 'src', 'gateway', 'action-router.ts'),
  ...fs.readdirSync(path.join(BE, 'src', 'modules'))
      .filter(f => f.endsWith('.service.ts'))
      .map(f => path.join(BE, 'src', 'modules', f)),
];
const implemented = new Set();
for (const f of srcFiles)
  for (const m of fs.readFileSync(f, 'utf8').matchAll(/^\s*'([\w./]+)':\s*async/gm))
    implemented.add(m[1]);

// What the app has actually been seen calling. An action here is not optional:
// the client asks for it at runtime, so a stub means a visibly broken screen.
const observed = new Map();
const logPath = path.join(BE, 'unknown-apis.log');
if (fs.existsSync(logPath)) {
  for (const line of fs.readFileSync(logPath, 'utf8').split('\n')) {
    if (!line.trim()) continue;
    let o; try { o = JSON.parse(line); } catch { continue; }
    if (!o.action) continue;
    const e = observed.get(o.action) || { calls: 0, params: new Set() };
    e.calls++;
    const ENVELOPE = ['action', 'token', 'uid', '_login_uid', 'lang', 'deviceid', 'ua', 'sign', 'timestamp'];
    for (const k of o.keys || []) if (!ENVELOPE.includes(k)) e.params.add(k);
    observed.set(o.action, e);
  }
}

// ── module inference ────────────────────────────────────────────────
// "user.getUserinfo" -> user ; "Action/LiveRoom.recommend" -> LiveRoom
const moduleOf = id => {
  const head = id.split('.')[0];
  return head.startsWith('Action/') ? head.slice(7) : head;
};

// Group the recovered model classes by their category so an endpoint can be
// pointed at the shapes it plausibly returns. This is a HINT, not a binding:
// the recovery never linked a model to a specific endpoint, so the mapping is
// by category only and must be confirmed against the client when implementing.
const modelsByCategory = {};
for (const m of schema.models || []) {
  const c = m.category || 'unclassified';
  (modelsByCategory[c] = modelsByCategory[c] || []).push({
    class: m.class, file: m.file, field_count: m.field_count,
    fields: (m.fields || []).map(f => ({ json: f.json, type: f.type })),
  });
}

const contractById = new Map((contract.endpoints || []).map(e => [e.id, e]));

// ── merge ───────────────────────────────────────────────────────────
const ids = new Set([
  ...Object.keys(catalog.actions || {}),
  ...contractById.keys(),
  ...observed.keys(),
  // Handlers we added that the original app never had (rtc.getToken exists
  // because we mint our own RTC tokens). Without this they vanish from the
  // count and the coverage figure quietly understates what is built.
  ...implemented,
]);

// Probes fired by hand while testing the fallback logger. They are our noise,
// not app surface, and would otherwise sit in the inventory forever.
const NOISE = new Set(['foobar.doesNotExist']);

const endpoints = [...ids].filter(id => id && id !== '(empty)' && !NOISE.has(id)).sort().map(id => {
  const cat = (catalog.actions || {})[id] || {};
  const con = contractById.get(id) || {};
  const obs = observed.get(id);
  return {
    action: id,
    module: moduleOf(id),
    category: (cat.category || con.category || 'unknown').toLowerCase(),
    style: con.style || (id.startsWith('Action/') ? 'action-rest' : 'json-rpc'),
    transport: cat.method || con.transport || 'POST',
    endpoint: cat.endpoint || '/api.php',
    encrypted: cat.encrypted !== false,
    request_fields: cat.request_fields || [],
    // Params seen on the wire beyond the envelope — the only request evidence
    // that is not guesswork.
    observed_params: obs ? [...obs.params].sort() : [],
    observed_calls: obs ? obs.calls : 0,
    callers: con.callers || [],
    caller_count: con.caller_count || 0,
    implemented: implemented.has(id),
    // Not present in any recovered source: ours, not the original app's.
    extension: !(catalog.actions || {})[id] && !contractById.has(id),
    evidence: con.evidence || cat.source || 'catalog only',
  };
});

const byModule = {};
for (const e of endpoints) {
  const m = (byModule[e.module] = byModule[e.module] || { total: 0, implemented: 0, observed: 0, actions: [] });
  m.total++;
  if (e.implemented) m.implemented++;
  if (e.observed_calls) m.observed++;
  m.actions.push(e.action);
}

const inventory = {
  _generated: new Date().toISOString(),
  _sources: {
    catalog: 'src/actions.catalog.json',
    contract: 'zaffa_recovery/COMPLETE_API_CONTRACT.json',
    models: 'zaffa_recovery/API_SCHEMA.json',
    observed: 'backend/unknown-apis.log',
  },
  _caveat:
    'Response shapes were NOT recovered — every catalog entry has an empty ' +
    'response_fields. model_hints below are @SerializedName keys grouped by ' +
    'category, not per-endpoint bindings. Any response shape not confirmed ' +
    'against the client is inference and is marked as such where implemented.',
  envelope: contract.contract || {},
  totals: {
    endpoints: endpoints.length,
    implemented: endpoints.filter(e => e.implemented).length,
    observed_at_runtime: endpoints.filter(e => e.observed_calls).length,
    modules: Object.keys(byModule).length,
    model_classes: (schema.models || []).length,
  },
  modules: byModule,
  endpoints,
  model_hints: modelsByCategory,
};

fs.mkdirSync(OUT, { recursive: true });
fs.writeFileSync(path.join(OUT, 'inventory.json'), JSON.stringify(inventory, null, 2));

// ── report ──────────────────────────────────────────────────────────
const t = inventory.totals;
const pct = n => ((n / t.endpoints) * 100).toFixed(1) + '%';
const lines = [];
lines.push('# API inventory — original app vs new backend');
lines.push('');
lines.push(`Generated ${inventory._generated}`);
lines.push('');
lines.push(`- **${t.endpoints}** distinct endpoints across **${t.modules}** modules`);
lines.push(`- **${t.implemented}** implemented (${pct(t.implemented)})`);
lines.push(`- **${t.observed_at_runtime}** confirmed called by the client at runtime`);
lines.push(`- **${t.model_classes}** recovered model classes available as shape evidence`);
lines.push('');
lines.push('> Response shapes were never recovered: every catalog entry carries an');
lines.push('> empty `response_fields`. Field names come from decrypted');
lines.push('> `@SerializedName` keys, grouped by category rather than bound to an');
lines.push('> endpoint. Shapes are therefore reconstructed from what the client');
lines.push('> actually reads, not copied from a captured response.');
lines.push('');
lines.push('## Coverage by module');
lines.push('');
lines.push('| Module | Endpoints | Implemented | Called at runtime |');
lines.push('|---|---:|---:|---:|');
for (const [m, v] of Object.entries(byModule).sort((a, b) => b[1].total - a[1].total)) {
  lines.push(`| ${m} | ${v.total} | ${v.implemented} | ${v.observed} |`);
}
lines.push('');
lines.push('## Called by the client but not implemented');
lines.push('');
lines.push('These are not theoretical — the app requests them and currently gets an');
lines.push('empty envelope, so each one is a screen that renders wrong today.');
lines.push('');
lines.push('| Action | Calls | Params observed |');
lines.push('|---|---:|---|');
for (const e of endpoints.filter(e => e.observed_calls && !e.implemented).sort((a, b) => b.observed_calls - a.observed_calls)) {
  lines.push(`| \`${e.action}\` | ${e.observed_calls} | ${e.observed_params.join(', ') || '—'} |`);
}
fs.writeFileSync(path.join(BE, '..', 'docs', 'API_INVENTORY.md'), lines.join('\n') + '\n');

console.log(`inventory: ${t.endpoints} endpoints, ${t.implemented} implemented, ${t.modules} modules`);
console.log(`wrote src/api-spec/inventory.json and docs/API_INVENTORY.md`);
