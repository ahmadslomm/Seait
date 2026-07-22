# Seait ≈ com.waig.nalo — Build Status Report

Seait rebuilt as a protocol-identical clone of ZaffaLive/nalo (real backend + Flutter), from the reverse-engineering of the original APK. Built on top of the existing (empty) repo — nothing removed; the 38 real screenshots moved to `screenshots/` as the design reference.

## ✅ Done / linked

### Inventory (phase 1–2)
- **`docs/API_INVENTORY.md`** — **303 endpoints** catalogued (not just 165): 165 business + 118 `Action/*` sub-namespaced (LiveRoom, RoomApi, LivePk, Noble, Game/MiniGame, SuperManage, Guild…) + 21 php. Plus 48 H5 pages.
- **`backend/src/actions.catalog.json`** — machine registry {action, category, endpoint, method, encrypted, request_fields, response_fields, source}. Systems: Room 99, User 33, Feed 29, Game 23, Gift 19, Moderation 13, Store 11, PK 10, Config 8, Medal/Activity 5, Noble/Search/Guild/IM/CP/Task/Auth/Messages/Settings…
- **`docs/MODELS.md`** — real UserModel (exact fields from decrypted `user.getUserinfo`), ConfigModel, captured schemas.
- **`docs/DATABASE_SCHEMA.md` + `backend/prisma/schema.prisma`** — 22 tables (users, profiles, wealth, wallets, vip, noble, gifts, gift_records, rooms, seats, guilds, cp, friends, messages, rankings, settings, configs…).

### Backend (phase 1,3,7) — REAL protocol, not mock
- **`api.php` gateway** (`backend/src/gateway/api.controller.ts`): identical wire protocol — `POST /api.php` `app_id=…&http_body=base64(XOR(json, md5(pkg)))` → decrypt → route by `action` → encrypt `{response_status,response_data}` (`QxZ…`). **Verified end-to-end**: decrypts real captured traffic; our responses carry the `QxZ` prefix the original client expects.
- **Same cipher / envelope / sign** (`common/crypto.ts`, `envelope.ts`, `sign.ts` = md5 + key `awgwd^1ad87`), token/uid/timestamp preserved.
- **Action router** with real handlers for user.getUserinfo, room.getRecommendRoomV2, gift.getGiftList, preArea.getServer, app.getConfigV2, report.getReportConfig, ranks… + **fallback logger** (`fallback/logger.ts` → `unknown-apis.log`) records every action without a native handler (known-TODO or unknown) so missing APIs surface at runtime.
- **Room engine** WebSocket (`gateway/room.gateway.ts`): seats 5/10/15/21/30 + events room_join/seat_update/mic_status/gift_received/user_enter/user_leave/speaking/chat.

### Seed (phase 4) — real account 1278472
- `backend/prisma/seed.ts` inserts the REAL account: nick (ar), avatar, avatarFrame/chatBubble/infoBg goods, wealthLv 16, charmLv 2, charm 361519, noble/VIP 5, gifts 220651, fans 6, following 5, levelName "Potential Rookie V", isAnchor, CP (partner 1150147, sweet 4887591), Guild 12147, national flag BE — plus VIP/Noble levels 1–5, sample gifts/rooms/ranking, and Config (agoraAppId, imAppId 1721002742, bigoAppId, qttKey from real preArea.getServer).

### Flutter (phase 6) — connected to the real API
- `mobile/`: Dart cipher (matches), `core/api.dart` client (encrypt→/api.php→decrypt), models (User/Wallet/Room), Riverpod providers.
- **Me/Profile screen** reproduces the real screenshot (badges, 4 stats, VIP card, Coins/Diamonds, Store/Task/Check-in/Backpack grid, Cp-space/My-level/My-income list) — **wired to `user.getUserinfo`** (real data). Home → `room.getRecommendRoomV2`. Moment/Live/Message + bottom nav Home/Moment/Live/Message/Me. Theme = ZaffaLive dark-purple + gold VIP.

## 🚧 Remaining
- Backend: native DB logic for the ~290 proxied/fallback actions (wallet/vip/gift-send/rank aggregation/guild/CP/PK/game); Google-Play IAP verify; real Agora/IM token signing.
- Flutter: full VIP purchase page, voice-room UI (seat grid + SVGA/PAG gift overlays), gift panel with combos, wallet/recharge, chat (IM), remaining screens from the other 36 screenshots.
- Assets: wire real svga/pag/frames from `assets/` into gift/frame rendering (files organized; not yet bound).

## ❓ Unknown / to discover at runtime
- Exact request/response fields for the 118 `Action/*` room-system endpoints (only names known from smali) — the **fallback logger** captures these live as the app calls them.
- The `http_body`/`ver_token` sub-cipher is solved; per-action business schemas fill in from captured authed traffic (real device) or the running fallback log.

## Run
```
# backend
cd backend && cp .env.example .env && npm i && npx prisma migrate dev && npm run seed && npm run start:dev
# mobile
cd mobile && flutter pub get && flutter run --dart-define=API_BASE=http://10.0.2.2:8080
```
