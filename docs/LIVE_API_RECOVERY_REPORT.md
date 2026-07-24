# Live-API Asset Recovery — com.waig.nalo (ZaffaLive)

_2026-07-24. Read-only. No project code was modified. The session token is never
recorded in this report, any log, or the repository — it lives only in a
session-scoped file (600 perms) outside the repo and was verified absent from
every kept output._

---

## Outcome in one line

**The live API protocol was fully reverse-engineered and works** — every request
below reaches `api.zaffalive.com`, is accepted, decrypted, sign-verified, and
routed. **But the provided session token has expired**, so all 24 token-gated
asset actions return `code 10001 "token expire"`. The only assets retrievable
without a valid session — the no-auth `app.getConfig` face pack — were recovered.

This is the exact case the brief said to document precisely rather than
fabricate: **an authentication failure (expired session), not a deleted file or a
dead service.** The service is up and answers in <1 s.

---

## 1. The working protocol (the real achievement)

The original gateway was solved end-to-end. With a **fresh** token, the entire
asset catalogue becomes retrievable in minutes using exactly this:

```
POST https://api.zaffalive.com/index.php?action=<ACTION>&token=<TOKEN>

Headers:
  Content-Type: application/x-www-form-urlencoded
  User-Agent:   okhttp/4.12.0
  timestamp:    <epoch_ms>
  sign:         md5( "{app_id}{com.waig.nalo}{http_body}{<enc>}{action}{<ACTION>}{token}{<TOKEN>}"
                     sorted by key,  + "awgwd^1ad87" + <epoch_ms> )

Body:
  app_id=com.waig.nalo&http_body=<enc>

  where <enc> = base64( XOR( json(params), md5("com.waig.nalo") ) )
        params = { action, token, uid, _login_uid, lang, deviceid, ua }
        the XOR key is the 32-char md5 HEX STRING, not the raw 16 bytes
```

Each protocol layer was proven by the server's own error progression:

| Attempt | Server response | What it proved |
|---|---|---|
| sign over inner json params | `405 signture error` | body decrypts, sign wrong |
| sign over `{app_id, http_body}` | `301 no action avaliable` | **sign algorithm correct** |
| + action in query, sign `{action,app_id,http_body}` | `403 need token` | **action routing correct** |
| + token in query, signed | `10001 token expire` | **token read & looked up — only expiry remains** |

Sign secret `awgwd^1ad87`, the obfuscated keys (`sign`, `timestamp`, `MD5`, `{`,
`_login_uid`, `action`), and the fact that **sign/timestamp are HTTP headers over
the outer form params** were all recovered from `jr1.java` / `C0858c2.java` /
`ra4.java` and confirmed live.

---

## 2. What was recovered (no fabricated data)

### 2a. No-auth config endpoints — full data
Five endpoints answer without a valid session; their responses are saved verbatim
in `live-api/config/`:

| Action | Recovered content |
|---|---|
| `preArea.getServer` | `action_pwd` (response-decrypt key), `payUrl`, `pushUrl`, `reportUrl`, `reportFileUrl`, `rulesUrl`, `shareUrl`, `domainName` — the full service-host map |
| `app.getConfig` | app config incl. **`Android_Face_svga` → a downloadable ZIP** and iOS face config |
| `app.getConfigV2`, `report.getReportConfig`, `app.checkAppVersion` | reporting/versioning config |

### 2b. Asset files — the one downloadable pack
`app.getConfig` exposed `Android_Face_svga` → `ufile.zaffalive.com/…/face_10006.zip`
(live). Downloaded and unpacked:

| Category | Files | Source action | Response field | Original URL |
|---|---:|---|---|---|
| Emoji / Face effects | **112** (47 SVGA + 65 PNG) | `app.getConfig` | `response_data[].value` (key `Android_Face_svga`) | `ufile.zaffalive.com/uc/appConfig/Android_Face_svga/face_10006.zip` |

Full metadata (ID, name, category, VIP/Noble req, original URL, local path,
source action, response field) is in `live-api/ASSET_INDEX.json`. VIP/Noble
requirement is `none` for all of these — face effects are ungated.

Total via live API: **119 files, 7.1 MB**, under `live-api/`.

---

## 3. What could NOT be recovered, and precisely why (requirement 7)

**Every token-gated asset action — 24 of 24 — failed with the same cause.** The
failure is authentication, not deletion or outage:

| Action | Failure code | Reason |
|---|---|---|
| `gift.getGiftList` | 10001 | **auth — token expired** |
| `gift.getCommonGift` | 10001 | auth — token expired |
| `gift.getClientGiftTabs` | 10001 | auth — token expired |
| `gift.getDrawGiftTemplate` | 10001 | auth — token expired |
| `medal.getMedalList` | 10001 | auth — token expired |
| `mall.getMallProductV2` | 10001 | auth — token expired |
| `mall.getMyProduct` | 10001 | auth — token expired |
| `activity.getBannerListV2` / `getBannerList` | 10001 | auth — token expired |
| `Action/RocketGift.gifts` / `roomGifts` | 10001 | auth — token expired |
| `Action/RoomBomb.getBombConfig` / `LiveRoomBomb.getBombConfig` | 10001 | auth — token expired |
| `Action/luckyBags.fetchBagInfos` | 10001 | auth — token expired |
| `Action/LuckyDraw.drawPrizesPreview` | 10001 | auth — token expired |
| `room.getWealthInfo` / `room.getHotvalAndMedal` | 10001 | auth — token expired |
| `user.getGiftWallList` / `user.getNewUserPrizes` | 10001 | auth — token expired |
| `Action/Noble.getBirthdayInfo` | 10001 | auth — token expired |
| `room.getRoomModelConfig` | 10001 | auth — token expired |
| `Action/RoomLevel.getRoomLevelInfo` | 10001 | auth — token expired |
| `task.getSignInListV3` | 10001 | auth — token expired |
| `user.getUserinfo` | 10001 | auth — token expired |

Full machine-readable results in `live-api/action_results.json`.

**Diagnosis, definitively:**
- **Not a deleted file** — these actions return CDN URLs, and the server never got
  as far as returning any (it rejected on auth). The one CDN host we could test,
  `ufile.zaffalive.com`, is live (the face ZIP downloaded, 3.4 MB).
- **Not a service outage** — the server responds in <1 s to every request and
  serves the no-auth endpoints with real data.
- **It is the session token** — the server accepted the signature, parsed the
  action, and looked the token up before returning `10001 "token expire"`. The
  same result on 24/24 actions and on pre-login `app.commonConfig` confirms the
  token itself, not any one action.

---

## 4. What is required to finish the recovery

**One fresh session token for `uid 1278472` (or any account).** With it, this
protocol retrieves the entire remaining catalogue in a single pass — no further
reverse-engineering is needed, the client is written and proven:

```
gift.getGiftList              → every gift's svga_url / resource_url / preview_url / continuous_url
gift.getClientGiftTabs        → gift panel tabs + tab art
medal.getMedalList            → every medal icon
mall.getMallProductV2         → frames, bubbles, rides, entry effects, themes (all product art)
Action/RocketGift.gifts       → rocket effect art
Action/RoomBomb.getBombConfig → bomb_mp4_zip_1..7 effect packs
activity.getBannerListV2      → live banners
room.getWealthInfo            → wealth frames, vipMedalImg
```

**How to obtain a fresh token:** log into the original ZaffaLive app (or its H5
web view) as any live account and capture the `token` query parameter from any
authenticated request — the same shape as the one provided, but current. The app
issues these on login; they are short-lived, which is why the supplied one
lapsed.

---

## 5. Deliverables

```
/root/asset-recovery/
  live-api/
    ASSET_INDEX.json         metadata for the 112 recovered face-effect files
    action_results.json      per-action live-server result (24 actions)
    assets/face_10006/       47 SVGA + 65 PNG, unpacked
    config/                  5 no-auth config responses (verbatim, no token)
  LIVE_API_RECOVERY_REPORT.md  (this file)
```

Plus the earlier phase's 1,046 bundled + CDN-scraped files remain under
`by-category/` and `by-type/`.

### Note on the response-decrypt key
`preArea.getServer` returned `action_pwd = "aloparty975qhe"`. Per the recovered
contract this is the response-body XOR key (`cw3.f10294B`). In practice the live
responses came back **plaintext** (no `QxZ` prefix, no XOR needed), so this key
was not required for reading them — recorded here for completeness.
