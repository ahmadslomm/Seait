# Asset & Privilege Recovery — com.waig.nalo (ZaffaLive)

_2026-07-24. Read-only recovery phase. No project code was modified._

Output location: **`/root/asset-recovery/`**
- `by-category/` — assets grouped into the 30 requested categories (`bundled/` = from the APK, `cdn/` = downloaded from the live CDN)
- `by-type/` — the same files grouped by format (svga, pag, mp4, png, webp, gif, json)
- `MANIFEST.csv` — every recovered file with category, source, size
- `ASSET_ACTIONS.json` — machine-readable action catalog (114 category↔action mappings + DTO asset-field map)

---

## 1. Headline result

| | Count | Size |
|---|---:|---:|
| Asset URLs harvested from the whole recovery corpus | 398 | — |
| **Successfully downloaded** | **386** | **159 MB** |
| Failed (404 / purged from CDN) | 12 | — |
| Bundled assets extracted from the APK | 156 | 58 MB |
| **Total organised files** (both views) | **1,046** | **377 MB** |

Recovered by category (files):

| Category | Files | Size | Notes |
|---|---:|---:|---|
| VIP / Noble frames | 90 | 116 MB | 44 SVGA + 23 MP4 from the live `noble` H5 bundle + 21 bundled VIP frames |
| CDN unclassified | 271 | 20 MB | mostly PNG sprites from H5 privilege pages |
| Room decorations | 33 | 3.0 MB | `svga/kroom` + `pag/kroom` |
| UI misc | 29 | 5.5 MB | loading, login, rank, topbanner |
| PK effects | 18 | 2.8 MB | `pag/bomb` (16) + bomb SVGA |
| Gift effects | 14 | 9.6 MB | rocket gifts + gift SVGA/PAG |
| Seat decorations | 13 | 660 KB | `yinbo` voice-wave overlays |
| Event rewards | 12 | 29 MB | cpReward / friendCenter MP4 + PNG |
| Level badges | 11 | 1.1 MB | `dj` + `friend` level SVGA |
| Badges (host tags) | 10 | 356 KB | ace/elite host tags, AR + EN |
| Wealth privileges | 8 | 360 KB | wealth_grade SVGA |
| Emojis | 7 | 184 KB | roomEmoji + emoji |
| CP effects | 3 | 444 KB | |
| Lucky-bag effects | 2 | 776 KB | |
| Medals | 1 | 16 KB | only `xunzhangguang` shipped in the APK |
| Agency rewards | 1 | 132 KB | |

---

## 2. Where assets actually live (the key finding)

The APK contains **zero hardcoded CDN URLs**. Every remote asset URL is delivered at runtime inside API responses, in fields recovered from decrypted `@SerializedName` keys. This is confirmed in `REMOTE_ASSET_CATALOG.json`:

> "the actual URLs/CDN host are server-delivered and NOT in the APK (confirmed: 0 hardcoded CDN)"

So there are exactly two recoverable sources, and one unrecoverable one:

| Source | Status | Why |
|---|---|---|
| **Bundled in APK** (`assets/svga`, `assets/pag`) | ✅ fully recovered — 156 files | Shipped inside the APK |
| **H5 privilege pages + their CDN assets** | ✅ 386 files recovered | `fstatic.cat1314.com` is still live and content-addressed |
| **Per-item catalogue URLs** (each gift's `svga_url`, each frame's `avatarFrame`) | ❌ **not recoverable** | Only exist in live `gift.getGiftList` / `medal.*` responses. No capture was ever taken, and we have no valid account token for `api.zaffalive.com` |

### CDN host status (tested today)

| Host | Status | Assets |
|---|---|---|
| `fstatic.cat1314.com` | **live** (200) | primary asset CDN — 292 refs, most SVGA/MP4 recovered here |
| `fstatic.hk.ufileos.com` | live | 41 refs |
| `ufile.zaffalive.com` | live | avatars/user files (verified: real avatar 262 KB) |
| `act.zaffalive.com` | partly live | H5 pages serve; the 240 `_svga_cdn/…` paths are **404 — purged** |
| `ufile.tanmchat.com` | 404 on sampled paths | expired |

---

## 3. Action catalogue (requirements 1 & 2)

`ASSET_ACTIONS.json` holds the full machine-readable catalogue: **114 category↔action mappings** across 15 groups, each with action name, style/transport, request parameters, caller site in the APK, implementation status, and auth.

**92 of the original app's 280 endpoints are asset/privilege related. All 78 core ones are already implemented in the Seait backend** (we cloned all 350) — they need *data*, not code.

### Asset-bearing DTOs (85 total) — the field names each category returns

| DTO | Category | Asset fields |
|---|---|---|
| `C5619a` / `t43` | vip | `avatarFrame`, `avatarFrameJson`, `carFrame`, `carFrameJson`, `vipMedalImg`, `wealthFrame`, `guildTagUrl`, `avatar_small`, `couple_avatar`, `best_friend_avatar` |
| `rx4` | gift | `svga_url`, `svga_type`, `banner_url`, `subGifts`, `bar_label_url`, `continuous_url`, `continuous_url2`, `preview_url`, `resource_url`, `jump_url` |
| `l63` | gift | `svga_url`, `svga_type`, `svga_expire`, `clientSvgaDynamics`, `continuous_url`, `resource_url`, `sub_image` |
| `o63` | levels | `url_lv1…url_lv4` + `_gray` + `_small` variants (12 fields) |
| `hq3` | bomb/PK | `bomb_mp4_zip_1…bomb_mp4_zip_7` — **MP4-in-ZIP** effect packs |
| `bn0` | user (98 fields) | `infoBgImg` (profile background), `avatarFrame`, `carFrame`, `photos`, `audit_avatar` |
| `C2445et` / `C3119a` | room theme | `themeUrl`, `themeName`, `themeDiyJson`, `pic_url` |
| `ri3` / `C2232d` | PAG | `page_image`, `page_image_new` |
| `gq3` / `dp5` | effects | `svga_url`, `special_url`, `resource_url` |
| `cw3` | config | `payUrl`, `rulesUrl`, `shareUrl`, `reportUrl` |

### Delivering endpoints per category (from `REMOTE_ASSET_CATALOG.json`)

| Category | Endpoints that deliver the URLs |
|---|---|
| Gift art / animations | `gift.getGiftList`, `gift.getCommonGift`, `gift.getClientGiftTabs`, IM opcode **10600** |
| VIP frames / medals | `medal.*`, `room.getWealthInfo`, DTO `t43` |
| Banners / activities | `activity.getBannerList`, `Action/RoomAct.*` |
| Room themes | `mall.buyTheme`, `mall.useTheme`, `room.updateRoomInfo` |
| Rocket / effects | `Action/RocketGift.*`, IM opcode **11300** |
| Prizes | `Action/luckyBags.*`, `Action/LuckyDraw.*` (`prize_image`, `preview_url`, `zip_url`) |

**Auth:** every `api.php` action carries the same envelope — `action`, `token`, `uid`, `_login_uid`, `lang`, `deviceid`, `ua`, plus `sign` + `timestamp`. All asset catalogue reads require a logged-in token; none is anonymous.

**Returns:** all of these return **CDN URL strings**, never file bytes. The only endpoints returning files directly are the H5 pages under `/html/…`.

---

## 4. Dormant actions (requirement 4)

**141 asset/privilege actions have real caller sites in the APK but were never observed at runtime** in our capture. Genuinely dormant / seasonal candidates worth noting:

| Action | Callers | Likely feature |
|---|---:|---|
| `Action/RoomAct.getActInfoById` / `joinAct` | 2 | seasonal room events |
| `Action/ChargeGiftBag.getGiftBagStatus` | 1 | first-purchase bundle |
| `Action/bestFriend.handleInvitation` | 1 | best-friend privilege |
| `Action/Noble.getBirthdayInfo` / `receiveBirthdayPresent` | — | noble birthday gift |
| `Action/LuckyDraw.drawPrizesPreview` | — | prize pool preview |
| `gift.getDrawGiftTemplate` | 1 | lucky/draw gift template |
| `user.getGiftWallList` | 1 | gift wall (all gifts + lit state) |
| `mall.buyCustomizeTheme` | 1 | custom room theme |
| `room.getHotvalAndMedal` | 1 | room heat + medals |
| `Action/HiddenSettings.updateHiddenSettings` | 4 | privacy privileges |

Caveat stated honestly: "never observed" means *never triggered in our emulator sweep*, which only visited a subset of screens. Core actions like `gift.getGiftList` and `medal.*` appear in this list for that reason — they are not dead, just unvisited. The table above lists the ones that are plausibly seasonal/gated rather than merely unvisited.

---

## 5. What could NOT be recovered, and why

| Missing | Why | Could it be obtained? |
|---|---|---|
| **Per-gift art URLs** (each gift's `svga_url`, `resource_url`) | Only exist in a live `gift.getGiftList` response. `FINAL_ASSET_URL_MAP.csv` is header-only — never captured | Yes — one authenticated capture against `api.zaffalive.com` would yield the whole gift catalogue |
| **Per-frame / per-medal URLs** | Same: live `medal.*` / user-info responses | Same |
| 240 `act.zaffalive.com/_svga_cdn/*.svga` | Purged from the CDN (404) | No — gone |
| 12 of the 398 URLs | 404 at source | No |
| `bomb_mp4_zip_*` effect packs | URLs come from `RoomBomb.getBombConfig` at runtime | Yes, with a live capture |
| Medals beyond 1 | Only one medal SVGA ships in the APK; the rest are CDN-delivered per-item | Yes, with a live capture |

**The single highest-value next step** is one authenticated session against the original API. With a valid token, these six calls would yield essentially the entire remaining asset catalogue:

```
gift.getGiftList            → every gift's svga_url / resource_url / preview_url
medal.getMedalList          → every medal icon
mall.getMallProductV2       → frames, bubbles, rides, entry effects, themes
Action/RocketGift.gifts     → rocket effect art
Action/RoomBomb.getBombConfig → bomb_mp4_zip_1..7
activity.getBannerListV2    → live banners
```

That is not possible today: no account token exists, and `LIVE_API_RESPONSES/` contains only a Frida unpinning script, never a capture.

---

## 6. What can be wired into the control panel now

Everything in `by-category/` is a real file on disk and can be uploaded through the admin console's asset library (`/admin` → any asset section → **Library → Upload**), then attached to a catalogue row. Highest-value first:

| Admin section | Feed it from | Files ready |
|---|---|---:|
| VIP Frames / Noble Badges | `by-category/vip-noble-frames/` | 90 |
| Room Decorations | `by-category/room-decorations/` | 33 |
| Gift Animations | `by-category/gift-effects/` | 14 |
| Entry Effects | `by-category/vip-noble-frames/bundled` (VIP1–6 SVGA) | 6 |
| Medals / Badges | `by-category/badges/` + `medals/` | 11 |
| Seat decorations | `by-category/seat-decorations/` | 13 |
| Emojis | `by-category/emojis/` | 7 |

The catalogue schema already supports every one of these (`MallProduct.type` = frame / entry / room_bg / theme / decoration / bubble / car, plus `Gift`, `Medal`, `NobleLevel`), and paths are relative, so uploaded art is served through `/assets` immediately.

---

## 7. Method (for reproducibility)

1. Harvested every asset URL from the full recovery corpus — `assets-archive/` manifest, all H5 js/html/css, every `*.json`, `*.csv`, and `analysis/` — with one regex over 9 media extensions → 398 distinct URLs.
2. Tested host liveness per URL (content-addressed CDNs purge per-hash, so liveness is per-URL not per-host).
3. Downloaded all 398 with a 30 s timeout, keeping only `200` responses over 200 bytes → 386 files, 159 MB, written into `by-type/<ext>/`.
4. Cross-referenced each downloaded URL against the archive manifest's `page` field to map it to a privilege/feature, then to one of the requested categories.
5. Extracted the 156 bundled APK assets and mapped their feature folders (`userspace`→VIP frames, `yinbo`→seat, `bomb`→PK, `kroom`→room, `hosttag`→badges …) to the same categories.
6. Joined `COMPLETE_API_CONTRACT` + `API_SCHEMA` (244 DTOs) + `REMOTE_ASSET_CATALOG` + the Seait inventory to produce `ASSET_ACTIONS.json`.
