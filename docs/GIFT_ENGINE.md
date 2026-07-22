# Gift Animation Engine (SVGA / PAG)

Real animation engine wired into the Voice Room — same behaviour as nalo / HelloYo /
Tami: **queue + priority + SVGA/PAG + combo + overlay**. No mock; no API/model change.

## Files — `mobile/lib/gift_engine/`
| file | role |
|---|---|
| `gift_models.dart` | `GiftPriority` (NORMAL·RARE·VIP·LEGENDARY·SUPER), `GiftDef` (built from real `gift.getGiftList`, priority/size/duration **derived** from real fields), `GiftEvent`, `GiftLogger` (→ `unknown-gifts.log`) |
| `gift_queue.dart` | priority-ordered queue + combo merge (same combo run = bump, not re-enqueue) |
| `gift_engine.dart` | entry point `receive()`; single **feature** slot (medium/large, priority-queued) + up to 3 concurrent **toast** slots (small) + entrances; `giftEngineProvider` |
| `gift_player.dart` | plays ONE event: renderer selection + placement (over-seat / avatar-band / fullscreen) + combo counter that pops `x2 x3 …` and never replays |
| `svga_renderer.dart` | `svgaplayer_flutter` — asset/URL, loop/once, graceful fallback |
| `pag_renderer.dart` | `pag` (libpag) — `PAGView.asset`/`.url`, loop/once, graceful fallback |
| `animation_manager.dart` | `GiftStage` — the 5-layer overlay Stack (non-interactive) |

## Flow (req 4)
```
socket gift_received / gift_broadcast / gift.send (local)
        → GiftEngine.eventFromPayload → GiftEvent
        → receive() → [combo? bump] else Queue (by priority)
        → renderer: url .svga→SVGA · .pag→PAG · else→icon fallback (+ log if no url)
        → GiftStage renders on the right layer
```

## 5 display layers (req 6)
`GiftStage` = Stack: **1** background glow (legendary/super) · **2** gift animation
(feature + concurrent toasts) · **3** combo counter (inside the player chip) ·
**4** camera flash (SUPER/LEGENDARY) · **5** special entrance (noble/VIP banner).

## Sizes (req 5)
- small  → `overSeat`: floats above the seat ~2.5s, combo-stackable, up to 3 at once.
- medium → `avatarAnim`: sender avatar + animation band (~3.5s).
- large  → `fullscreen`: full-screen overlay (~5.2s) + background + camera flash.
- combo  → animation plays **once**; each repeat only increments the counter and
  extends the linger window.

## Priority (req 7)
Derived from real price/fullscreen: `≥15000 SUPER · fullscreen|≥5000 LEGENDARY ·
≥1000 VIP · ≥100|animated RARE · else NORMAL`. Higher rank leaves the queue first.

## API binding (req 8)
From `gift.getGiftList` rows: `gift_id, name, icon, price, coin_type, category,
anim_type, anim_url, fullscreen`. `GiftDef.fromApi` maps these; `level/combo/
duration/priority/display` are derived (so **no model or API change**).

Seed (`backend/prisma/seed.ts`) now points `anim_url` at the real extracted assets:
Lucky Bag→`kroom/waitio_lucky_gift.svga`, CP Heart→`pag/cp/waitio_cp_heart.pag`,
Bomb→`pag/bomb/waitio_bomb_anim_lv3.pag`, Rocket/Sports Car/Crown of Glory/Angel
Scepter→`rocket/*.svga`. **Rose has no extracted art → empty `anim_url` → logged**.

## Unknown gifts (req 9)
`animation_url` empty → `GiftLogger` appends to `unknown-gifts.log`
(`gift_id / user_id / room_id / name`) and shows only the static icon — never faked.

## Gift Studio (req 10) — `/gift-studio` (Me → Gift Studio)
Preview ANY extracted SVGA/PAG without sending a real gift, and fire the
acceptance scenarios (req 11): **Crown of Glory, Angel Scepter, big gift, combo x12,
multi-at-once, VIP entrance**. Renders through the same `GiftStage`.

## Test (req 11)
Enter a room → tap 🎁 → pick a gift → **Send**: the engine plays the real
SVGA/PAG instantly (`_sendGift` = optimistic local + socket broadcast). Big gifts
go fullscreen; repeated sends show `xN`; several senders at once coexist (toasts +
one feature). Or use **Gift Studio** to trigger every scenario deterministically.

## Dependencies added
`svgaplayer_flutter: ^2.2.0`, `pag: ^1.3.4`, `path_provider: ^2.1.2`
(+ per-subdir asset registration in `pubspec.yaml`). Run `flutter pub get`.
