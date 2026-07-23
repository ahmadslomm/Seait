# Admin Panel — build & audit

_2026-07-23. Phase: turn the cloned platform into a manageable commercial product._

## Starting point

There was **no admin panel**. The catalogue tables (products, gifts, medals,
banners, levels…) were built during the clone phase to *be* manageable — relative
asset paths, `active` flags, `vip_only`/`noble_only` gating — but nothing managed
them. The only operator capability was a config-based allowlist gating the
`SuperManage` moderation actions.

This phase built the management layer over those existing systems. **No new
app-facing feature was added, no existing architecture changed, and the API /
Room / Agora test suites still pass unchanged.**

## What was built

A self-contained operator console, added as one Nest module (`src/admin/`) plus
a static single-page UI (`backend/public/console.html`), served at **`/admin`**.
It never touches the app's `api.php` gateway — different trust domain, separate
code path.

### Authentication & audit
- `AdminUser` with scrypt-hashed passwords (per-user salt, Node built-in KDF — no
  crypto dependency). Three roles: **super / admin / editor**.
- Opaque bearer-token sessions (`AdminSession`), 12h TTL, server-side — revoke is
  a row delete. A guard protects every route except login.
- **Every mutation is written to `AuditLog`** (who, what, which entity, when).
- Default super-admin is seeded with a password from `ADMIN_SEED_PASSWORD` or a
  random one printed once — never a hard-coded live default.

### Asset management — all nine categories, fully manageable
Add / edit / delete / enable-disable / gate, from one generic CRUD path driven by
a declarative registry (`admin.registry.ts`). Adding a section is a registry
entry, not new code.

| Category | Backed by | Gating available |
|---|---|---|
| Backgrounds | MallProduct `room_bg` | price, VIP, noble, duration |
| Room Themes | MallProduct `theme` | ″ |
| VIP Frames | MallProduct `frame` (vip_only>0) | ″ |
| User Frames | MallProduct `frame` (vip_only=0) | ″ |
| Entry Effects | MallProduct `entry` | ″ |
| Room Decorations | MallProduct `decoration` | ″ |
| Chat Bubbles / Rides | MallProduct `bubble` / `car` | ″ |
| Medals | Medal | active, sort |
| Noble Badges | NobleLevel | per-level art, horns, privileges |
| Gift Animations | Gift | anim type (SVGA/PAG/MP4), price, fullscreen |

The typed views are isolated: creating a "VIP Frame" injects `type=frame` and a
VIP gate, and it never appears under "User Frames" — verified by test.

### Asset upload
Real file upload (`@fastify/multipart`, 25 MB cap) into `assets/uploads/<kind>/`,
tracked in an `AssetFile` library so an upload can be reused across many rows.
Uploaded art is served through the existing `/assets` route, so a new frame is
live the moment it is saved. The picker previews images and labels SVGA/PAG/MP4.

### Economy management
- **User search** by uid or nickname → balances, VIP, wealth, recent ledger.
- **Balance adjustment** goes through the same `EconomyService.credit/debit` the
  app uses, so an admin grant writes the same ledger row and an over-drawing
  debit is **refused, not floored** — verified by test.
- Grant/revoke VIP level; ban/unban (mirrored onto the User row the client reads).
- **Recharge packages, VIP levels, wealth levels, daily rewards, banners, games**
  are all editable catalogue sections. Wealth levels previously had no config
  table at all; one was added (`WealthLevelConfig`) so the ladder is tunable.

### Dashboard
Live counts: users, live rooms, active gifts/products, coins & diamonds in
circulation, gifts sent, transactions, admins, audit entries.

## Verification

- `test/admin_api.test.js` — **23/23**: login, wrong-password rejection, guard
  enforcement (401), CRUD, active-toggle, typed-view isolation, input validation
  (400 not 500), balance credit + overdraw refusal, multipart upload, audit trail.
- Visually verified in headless Chromium — dashboard, an asset table, an
  auto-generated edit form, and the user-balance view (screenshots in
  `docs/parity/admin_*.png`).
- **No regression**: `api_coverage` 350/350, `api_modules` 48/48,
  `rtc_token` 12/12, `room_multiclient` 25/25 — all still green.

## Ready to launch

- All nine asset categories + the economy catalogue are add/edit/delete/toggle
  manageable, with VIP/noble/level gating, from one console.
- Auth, roles, audit trail, and a safe seeded first admin.
- Uploads land live behind the existing asset CDN path.
- Balance operations share the app's ledger and its no-negative guarantee.

## What still needs improvement (honest list)

1. **Product↔asset linkage for level rewards is manual.** SignInReward can point
   at a `product_id`, but the form takes a raw number rather than a product
   picker. Low risk, but easy to mis-type. → add a product dropdown.
2. **No image/dimension validation on upload.** The size cap (25 MB) and
   extension→kind mapping exist, but a corrupt SVGA or a huge PNG is accepted as
   long as it is under the cap. → validate magic bytes / decode server-side.
3. **VIP/Noble privilege JSON is free-form.** Editable as raw JSON; there is no
   schema or the client-side key catalogue behind it. → a structured privilege
   editor once the client's privilege keys are enumerated.
4. **No bulk actions or CSV import.** Fine for tens of items; a large catalogue
   would want multi-select enable/disable and import/export.
5. **Recharge is catalogue-only.** Packages are listed to the client, but real
   money purchase still needs Google Play billing (documented `not_configured`
   from the clone phase). The admin manages the SKUs; it does not settle payments.
6. **Session store is the DB with no rate-limiting on login.** Adequate for an
   internal tool; before exposing publicly, add login throttling and rotate the
   12h token on activity.
7. **Uploads are local disk.** Correct for single-host; a multi-host deploy needs
   the uploads dir on shared storage or an object store (the relative-path design
   already supports swapping the base).

None of these block managing the platform today; they are the difference between
"manageable" and "hardened for scale."

## Architecture notes / decisions

- The console is **entirely registry-driven**: one CRUD service, one form
  renderer. This keeps 18 manageable entities behind ~200 lines of logic instead
  of per-entity endpoints, and makes the audit uniform.
- **Balance changes never bypass `EconomyService`** — the one place money moves,
  so the console cannot create an unbacked balance.
- **Additive only**: new tables, new module, new controllers. `main.ts` gained a
  multipart parser scoped to `multipart/form-data` (the api.php path is
  urlencoded, untouched). Nothing in the gateway, room engine, or RTC changed.
