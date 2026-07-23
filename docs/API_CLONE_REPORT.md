# API cloning report — 350 / 350

_2026-07-23. Scope: inventory the original app's API surface, rebuild all of it
on the new backend, point the app at it, and remove hardcoded data._

## Final coverage

**350 / 350 endpoints implemented.** Verified by `test/api_coverage.test.js`,
which fires every endpoint through the real gateway (actions encrypted, HTTP
routes direct) and asserts none falls through to the fallback logger:

```
transport errors:        0
missing http/h5 routes:  0
fell through to logger:  0
PASS: 350/350 endpoints answered by real code
```

Reached in five batches: batch 1 (119) covered the actively-used surface; batches
2–5 completed the rest by priority — Room APIs, advanced room, PK, games, moment,
bottle, then everything remaining.

Transport split: **308 action handlers** (through the encrypted `/api.php`
gateway) + **42 HTTP/H5 routes** (served directly by `LegacyController` /
`AssetsController`). The inventory tool reads both, so its 100% figure counts
what actually responds, not just what has a handler.

Device-verified on the emulator: install Success, **0 crashes**, and the
fallback logger recorded **no unimplemented action** across a full screen sweep.
Every screen that had no UI now has one — the last two, Settings
(`HiddenSettings.*`) and Feedback (`feedback.report`), are wired to real routes
reachable from the Me tab.

### Deliberate stubs — implemented, but no real integration behind them

These respond (the route exists, the client's call resolves) but cannot do the
real thing without a third-party service that is not wired up. Each returns an
explicit `not_configured`, never a fake success — a forged Google Play receipt
would grant currency for an unverified purchase, which is worse than an error.

| Endpoint(s) | Missing service | Behaviour |
|---|---|---|
| `googleplay_getReceipt`, `googleplaySub_getSubReceipt`, `getOrder` | Google Play billing | `billing_not_configured` |
| `api_sms_kit_*`, `login.call` | SMS provider | `sms_provider_not_configured` |
| `api/GetUserSig`, `Action/Api.GetUserSig` | Tencent IM | `im_provider_not_configured` (our IM is the room socket) |
| `api_bind_google`, `api_bind_facebook` | OAuth apps | `google_oauth` / `facebook_oauth` not configured |
| `googleplay_productList`, `api_GetCountry` | — | **answered for real** from our own catalogue/country data |

The 22 H5 activity pages render a themed "not configured" page rather than 404,
so the client's web view resolves and closes cleanly instead of showing a
browser error. The original HTML was never recovered.

---
_The sections below are the original batch-1 report, retained for the reasoning
behind the inventory method and the architecture._

## Where the numbers come from

Three recovered datasets describe the original surface. None is sufficient alone:

| Source | What it has | What it lacks |
|---|---|---|
| `backend/src/actions.catalog.json` | 303 action names, category, request envelope | `response_fields` is **empty for every entry** |
| `zaffa_recovery/COMPLETE_API_CONTRACT.json` | 280 endpoints with the Java caller site for each | no payloads |
| `zaffa_recovery/API_SCHEMA.json` | 244 model classes with decrypted `@SerializedName` keys | not bound to any endpoint |

`backend/tools/build_api_inventory.js` merges them with what the router
implements and what the app has been observed calling at runtime, and writes
`backend/src/api-spec/inventory.json` plus `docs/API_INVENTORY.md`. It is
re-runnable and reads implementation state from source, so the coverage figure
cannot drift from reality.

## What "cloned" means here, precisely

**Route names are exact.** Taken from decrypted static strings, including the
original's own misspellings — `user.subcribe` (not subscribe),
`gift.getReceieveGift` (not receive). Correcting them would break the client,
which sends those strings.

**Response shapes are reconstructed, not copied.** No capture of the original
server exists, and the catalogue recovered zero response fields. Shapes come
from the recovered model keys where those exist, and otherwise from what our
client actually reads. This is the single biggest difference from the original
and it will not be resolvable without a live capture.

## Coverage

| | Before | After |
|---|---:|---:|
| Endpoints implemented | 16 / 350 | **119 / 350** |
| Actions the app calls that return nothing | 5 | **0** |

The second row is the one that matters for the app working today. Verified on
device, not inferred: run `r-api-batch1` swept every screen and the fallback
logger recorded **no unimplemented action**.

### Completed modules

`user` (26), `room` (23 incl. `Action/LiveRoom.*`), `mall` (12), `gift` (11),
`medal` (5), `task` (5), `search` (4), `activity` (5), `notice` (2), `wallet`
(1), `agency` (2), `app.getThemeAssets`.

### The five that were actively broken

The app polled these constantly and got an empty envelope back:

| Action | Calls in one session | Screen it broke |
|---|---:|---|
| `Action/LiveRoom.recommend` | 9,407 | Live tab |
| `notice.checkNotice` | 9,364 | Message badges |
| `mall.getMyProduct` | 804 | Backpack |
| `Action/BDCenter.inviteUserRes` | 668 | Agency invite card |
| `task.getSignInListV3` | 623 | Daily sign-in |

### Remaining — 231 endpoints

| Group | Count | Note |
|---|---:|---|
| `room` (advanced) | 25 | PK, games, blacklists, role management |
| `Action/RoomApi` | 23 | in-room mic/moderation over HTTP; our room engine does this over the socket |
| `Action/LiveRoom` | 15 | live-stream specific |
| `Game` / `LivePk` / `MiniGame` | 25 | mini-games, PK battles |
| `bottle` | 10 | drift-bottle feature |
| `moment` | 8 | social feed — **no table yet** |
| `comment` / `feedTopic` | 11 | depends on moments |
| `SuperManage` | 7 | admin/moderation |
| others | 107 | payments, H5 pages, reporting, noble extras |

None of these are called by the app in its current state.

## Architecture decisions

**Domain modules, not one switch.** Handlers moved from a single router object
into `src/modules/*.service.ts`, each owning its Prisma access. The router only
dispatches. Adding an endpoint touches one file.

**One place changes money.** `EconomyService` handles every balance movement —
sign-in rewards, purchases, gift sends. Its `debit` runs the balance check and
the decrement inside one transaction, so two concurrent purchases cannot both
pass against the same balance. Letting three modules each call `wallet.update`
would mean three chances to forget the ledger row.

**Duplicate actions unified.** `mall.getMallProductV/V2`,
`buyProduct/buyTheme/buyCustomizeTheme`, `useProduct/useTheme`, the six
room-list actions and the four gift-send actions are each one implementation
behind several client-visible names.

**No hardcoded art.** Nine new tables back the catalogue (frames, entry effects,
room backgrounds, banners, medals, sign-in rewards). Rows store **relative**
paths; `app.getConfig` hands out `assetBase` and a new `/assets` route serves
the files. Moving to a CDN is one `Config` row, not a data migration. The seed
refuses to insert a row whose art is missing from disk and reports what it
skipped — a catalogue of 404s renders broken tiles, which is worse than an empty
shelf.

**Theme manager data path exists.** `app.getThemeAssets` returns the
`{logicalKey: path}` override map, deriving `room.bg.*` slots from the
`room_bg` products so adding a background to the store makes it selectable in
rooms. This is how the parked Me-header background will eventually be delivered.

## Bugs found

1. **Seated users could never speak.** `rtc.getToken` decided publisher from
   `prisma.seat`, but seats live in the room gateway's memory — sitting down is
   a socket event never written to the DB. Every non-owner got a subscriber
   token. Hidden because the only tested client was the room owner, who
   qualifies on a different branch.
2. **`room.getRoomInfo` returned an empty room** while people were visibly
   sitting in it — same source-of-truth split.
3. **Gateway stubs silently outranked module implementations.** A leftover
   `mall.getMallProductV2 → []` beat the real handler and the store came back
   empty. My own clash detection compared module-against-module and missed the
   case that actually bites; it now warns on gateway-vs-module too.
4. **Four screens had no renderer.** Live, Backpack, Tasks and Message either
   printed raw `Map` records or read the wrong response shape. Invisible while
   the endpoints returned nothing — an empty response and a broken renderer look
   identical from outside.
5. **The database had one user.** Fans lists, search, recommendations and
   supporters were all correctly implemented and all correctly empty.

## Differences from the original app

- **Response shapes are inferred** (see above). The highest-value next step for
  fidelity is a live capture of the original server.
- **Seats are authoritative in memory, not the DB.** Deliberate — the room
  engine is socket-driven — but it means any new HTTP endpoint touching seats
  must ask the gateway. Two bugs have already come from forgetting this.
- **`Action/RoomApi.*` is not implemented** because our room engine does mic and
  moderation over the socket. If the original client is ever pointed at this
  backend, those 23 actions become required.
- **Avatars** are the one bundled default plus the seeded account's real
  remote URL. No invented CDN links.

## Verification

| Suite | Result |
|---|---|
| `test/api_modules.test.js` | 34 assertions, 0 failed — through the real encrypted gateway |
| `test/rtc_token.test.js` | 12 / 12 |
| `test/room_multiclient.test.js` | 25 / 25 |
| Device run `r-api-batch1` | install Success, 0 crashes, 0 unimplemented actions |

The API test asserts **content**, not status codes: an empty list is
indistinguishable from an unimplemented action from the client's side, which is
the exact failure this work exists to remove.
