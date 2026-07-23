# Parity Audit — final report

_2026-07-23. Every app screen reviewed against the original ZaffaLive
(com.waig.nalo), focused on the data plane: right action called, request/response
compatible, all returned data actually rendered, correct loading/error/empty
states, and live updates. No new features — only differences found and fixed._

Method: static data-flow audit (each screen's action → backend fields returned →
fields rendered → gap), cross-referenced with the original's screen-by-screen
description in `zaffa_recovery/SCREEN_BY_SCREEN_DIFFERENCES.md`, then a device run
(`r-parity-audit`) watching `unknown-apis.log` for any action that falls through
to the fallback logger.

**Headline device result:** install Success, 0 crashes, and **zero actions fell
through** — every action the app calls is answered by real code. Backend suites
still green: coverage 350/350, api_modules 48/48.

---

## 1. What is now 100% matching

Verified rendering real API data on device, correct action, full payload used,
with loading/error/empty states:

| Screen | Action(s) | Notes |
|---|---|---|
| **Home** | `room.getRecommendRoomV2` | room cards with cover/name/count |
| **Live** | `Action/LiveRoom.recommend`, `user.getSubcribeList` | shared RoomCard; Follow tab filters by followed owners |
| **Moment** | `moment.recomV3` (recommend/latest), `moment.follow` | **fixed** — see §2.1 |
| **Message** | `notice.checkNotice`, `user.getFriendList`, `notice.clearNoticeAndImCount` | live unread counts; friends = mutual follows |
| **Me** | `user.getUserinfo` | **fixed** — visitor stat, see §2.4 |
| **VIP Center** | `user.getUserinfo` | **fixed** — real level, see §2.2 |
| **My Level** | `user.getUserinfo` | **fixed** — all 4 tabs real, see §2.3 |
| **Wallet** | `user.getUserinfo` | real coin/diamond balances |
| **CP space** | `user.getUserinfo`, `gift.getGiftList` | **fixed** — real gift wall, see §2.6 |
| **Guild** | `user.getUserinfo.guild_info` | real guild name/id/anchors |
| **Backpack** | `mall.getMyProduct`, `mall.useProduct` | per-type tabs, equip works |
| **Tasks** | `task.getSignInListV3`, `task.signInV3` | 7-day board, real claim |
| **Search** | `user.getRecommendUser` | **fixed** — real suggestions, see §2.5 |
| **Agency** | `Action/BDCenter.inviteUserRes` | invite state |
| **Room** | socket engine + `rtc.getToken` | live seats/chat/gifts/mic, RTC verified separately |
| **Gift Studio** | (local preview) | dev tool, no API by design |

Flows exercised end-to-end and matching: profile, rooms, seats, voice (RTC),
gifts, chat, VIP/noble, guild, store, backpack, wallet, tasks, notifications,
search, messages.

## 2. Differences found and fixed

Six defects where the app showed hardcoded, wrong, or unreachable data even
though the API carried the truth. All fixed and verified on device.

### 2.1 Moment feed was unreachable — the worst finding
The screen called `moment.recomV3`, but that was an empty **gateway stub**; the
real feed handler was registered as `moment.recomV` (no "3"). The gateway wins
dispatch, so the app received `{list:[]}` forever while 12 real posts sat behind
the other name. On top of that the screen rendered each record with `'$m'` — the
raw Map printed as text.
**Fix:** `recomV3` now routes to the real feed; the screen draws proper cards
(author, avatar, text, images, like/comment/view counts, relative time).
_This is precisely the "endpoint not reached / data present but not shown" case
the audit set out to catch._

### 2.2 VIP Center was hardcoded to "VIP 5"
Showed "VIP 5" and a fabricated "7000 / 10000" progress bar to **every** account
— it matched the seeded user's noble level 5 only by coincidence.
**Fix:** reads the real level from `user.getUserinfo`, highlights the user's tier
with a "Current" badge and checkmarks on completed tiers. The fake numeric bar
was removed rather than re-faked (the API has no VIP-exp field).

### 2.3 My Level was hardcoded
"Wealth LV.16 / 708075 / 750000 / 85%", again the seeded user's exact numbers,
and only the Wealth tab had content.
**Fix:** all four tabs (Wealth/Charm/Active/Game) read their real level. Wealth
keeps a real progress bar (it is the only system with an exp value); the target
curve is a clearly-commented display approximation, not fabricated server data.

### 2.4 Me "Visitors" stat showed the beans balance
The fourth stat, labelled Visitors (الزائرين), was bound to `beans` — a currency
balance, a completely different number.
**Fix:** added a real `visitors` count to `user.getUserinfo` (counts the visit
rows) and bound the stat to it. Reordered the four stats to the original's order:
Visitors, Gifts, Following, Followers. Now shows 8 visitors, not the beans total.

### 2.5 Search "People you may like" listed yourself
Suggestions called `user.batchGetUserinfoV2`, which returns only the logged-in
user.
**Fix:** now calls `user.getRecommendUser` (returns 20 real suggestions with
avatar, id, gender/age, sign, noble badge).

### 2.6 CP confession wall used fake gifts
Rendered a placeholder list (Gift ×8 at 100, 200, …).
**Fix:** bound to the real gift catalogue (`gift.getGiftList`).

## 3. Differs from the original — needs UI work (not built, by request)

These are real differences but closing them means building **new screens**, which
this phase deliberately excluded. The backend endpoints already exist; only the
Flutter UI is absent. The four are reached from dead menu rows on the Me page:

| Menu row | Backend ready | Missing |
|---|---|---|
| **Settings** | `Action/HiddenSettings.get/updateHiddenSettings` | settings screen |
| **Feedback** | `feedback.report`, `report.reportUser` | feedback form |
| **Badge** | `medal.getUserMedalListAll`, `adornMedalList` | badge/medal screen |
| **My income** | guild/gift income aggregates | income screen |

Also lighter, cosmetic-only differences noted but not in the data-parity scope:
Home's Discover/Popular tabs use decorative placeholders rather than the
banner-carousel / rank-showcase the original shows (banners *are* available via
`activity.getBannerListV2`); the room's chat-tab bar (All/Gift/Message) and event
thumbnail are simpler than the reference. These are visual build-outs, not data
defects.

## 4. Needs an external service to complete

Unchanged from the API report — implemented as explicit `not_configured` stubs,
never faked:

| Area | Service required |
|---|---|
| Recharge / purchase validation | Google Play Billing |
| Registration / login by phone | SMS provider |
| Third-party IM signatures | Tencent IM (our IM is the room socket) |
| Google / Facebook binding | OAuth apps |

The recharge tier list and country list render from our own data; only the
purchase/verify round-trips need the external service.

## 5. Log-monitoring result

During the full `r-parity-audit` device sweep, **no action fell through to the
fallback logger** — there is no unused action reached by the app, no unreachable
endpoint, and (after the six fixes) no data arriving from the API that a screen
fails to render. The one moment-feed case where data arrived but wasn't shown is
resolved.
