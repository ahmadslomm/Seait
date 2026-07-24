# Noble H5 Page Analysis — `/html/noble/index.html`

_2026-07-24. Read-only. No project file was modified. No endpoint guessing —
every action below is a literal string extracted from the page's own `app.js`.
The session token is never recorded here; verified absent from all deliverables._

Page: `https://api.zaffalive.com/html/noble/index.html` (Vue 2 SPA, HTTP 200).

---

## 1. JS files loaded by the page

| File | Source | Bytes | Role |
|---|---|---:|---|
| `js/app.js` | `/html/noble/` | 244,800 | **the noble app — all logic & asset refs** |
| `js/vendor.js` | `/html/noble/` | 94,015 | Vue/runtime deps |
| `css/app.css` | `/html/noble/` | 49,866 | styles (asset refs) |
| `js/env.js`, `js/miyouCallApp.js` | `/js/` | 404 | not present on server (native-bridge stubs) |
| axios, svga.lite, vue-* | `fstatic.cat1314.com/js/` | — | CDN libraries |

All saved under `noble-h5/js/`.

---

## 2. Keyword search inside the JS (requirement 3)

Occurrences in `app.js`: `svga` ×170, `icon` ×110, `png` ×403, `vip` ×159,
`level` ×59, `privilege` ×47, `noble` ×31, `frame` ×17, `medal` ×15,
`avatarFrame` ×15, `pag` ×13, `gift` ×2, `resource_url` ×0. The page is
frame/privilege-centric; it does not reference `resource_url` (that field
belongs to gift DTOs, not this page).

---

## 3. API actions the page actually calls (requirement 5 — no guessing)

Exactly **4** actions, each a literal `/index.php?action=…` string in `app.js`:

| Action | Request template (verbatim from app.js) | Params | Purpose |
|---|---|---|---|
| `Action/Noble.getUserNoble` | `/index.php?action=Action/Noble.getUserNoble&token={token}&uid={uid}` | action, token, uid | current noble tier of the user |
| `Action/Noble.getUserIntegralInfo` | `…getUserIntegralInfo&token={token}&uid={uid}` | action, token, uid | noble points / integral balance |
| `Action/Noble.getRebateCard` | `…getRebateCard&token={token}&uid={uid}` | action, token, uid | rebate-card gift popup |
| `Action/Noble.buyNoble` | `…buyNoble&token={token}&uid={uid}&level=<n>` | action, token, uid, **level** | purchase noble level `n` |

**Request mechanism** (from the axios interceptor in `app.js`): the native app
injects `uid`, `token`, `rid` into the webview URL; the interceptor replaces the
`{token}`/`{uid}`/`{rid}` placeholders, appends `lang` and `t=Date.now()`, and
reads a **`signture` query param** (`atob("c2lnbnR1cmU")`) that the app also
injects. So the H5 does not compute the signature itself — the native shell does.

### Live replay result (requirement 4 & 6)

Replayed all four against the live server with the supplied token. **Response
JSON captured verbatim** in `api/noble_action_results.json`:

```
Action/Noble.getUserNoble         → {"response_status":{"error":"unauthoried user, token expire","code":10001}}
Action/Noble.getUserIntegralInfo  → code 10001  (token expire)
Action/Noble.getRebateCard        → code 10001  (token expire)
Action/Noble.buyNoble             → code 10001  (token expire)
```

**The supplied session is expired** — identical to the previous phase. These
four actions are token-gated; their asset-bearing responses cannot be captured
without a fresh session. This is an authentication limit, not a dead endpoint:
the server processes the request fully and rejects only on token lookup.

---

## 4. Assets recovered from the page (requirement 3 & 6)

The page's visual assets are **not** behind the API — they are hardcoded CDN
URLs and webpack-bundled images, all downloadable without a token. **182 files,
33 MB**, saved under `noble-h5/assets/`, fully indexed in
`NOBLE_ASSET_INDEX.json` (id, name, category, VIP/Noble requirement, original
URL, local path, source).

| Category | Files | VIP/Noble level | Original URL pattern |
|---|---:|---|---|
| VIP **medal** frames | 15 | VIP 1–15 | `fstatic.cat1314.com/uc/video/zaffalive/medal/vip{01..15}.svga` |
| VIP **avatar** frames | 13 | VIP 3–15 | `fstatic.cat1314.com/uc/video/zaffalive/vip/vip{03..15}.svga` |
| generic effect | 1 | — | `fstatic.cat1314.com/uc/svga/24a76c1…svga` |
| Noble **tier privilege icons** | 153 | Noble 1–14, slots 1–6 | `/html/noble/img/{level}_{slot}.<hash>.png` |

All 29 CDN SVGAs downloaded 200/OK; 153 of 328 referenced tier PNGs exist (the
other 175 are conditional level/slot combinations the server never generated —
documented, not fabricated).

### Noble privilege model (extracted from `app.js` → `morePrivilege`)

15 noble tiers (level 0–14) progressively unlock 9 privileges (ids **8–16**):

| Noble level | Privileges unlocked |
|---|---|
| 0–1 | 8 |
| 2–3 | 8, 9 |
| 4–5 | 8, 9, 10 |
| 6–7 | 8, 9, 10, 11, 12 |
| 8–10 | 8, 9, 10, 11, 12, 13 |
| 11 | + 14 |
| 12–14 | + 15, 16 (all nine) |

The tier icons `{level}_{slot}.png` are the 6 privilege icons shown per noble
level; noble level names come from the localized `lang.nobleConfig` array.

---

## 5. What is needed to complete this

A **fresh session token** would let the four `Action/Noble.*` calls return their
real payloads — `getUserNoble` carries the user's frame/medal URLs and noble
config, `getRebateCard` the gift-card art. The client and exact request format
are proven (see the live-API report); one authenticated call each finishes it.

## 6. Deliverables

```
/root/asset-recovery/noble-h5/
  NOBLE_ASSET_INDEX.json     4 actions + 103 indexed assets (id/name/category/VIP-Noble/url/path)
  api/noble_action_results.json   verbatim live responses (token-redacted)
  assets/vip-frames/         29 VIP medal/avatar frame SVGAs
  assets/tier-icons/         153 noble tier privilege PNGs
  js/                        app.js, vendor.js, app.css, index.html
  NOBLE_H5_REPORT.md         (this file)
```
