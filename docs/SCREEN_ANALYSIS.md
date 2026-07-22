# SCREEN ANALYSIS — ZaffaLive/nalo UI (from 38 real screenshots)

Device 1440×3088. RTL(ar)/LTR(en) both present. Global chrome: **status bar** (purple) + **bottom nav** (5 tabs, gold-on-dark): 🏛️Home · 🧭Moment · 🎥Live · 💬Message(99+) · 👤Me. Background = deep purple `#1A0B2E`, Islamic-palace header art, gradient cards, **gold VIP** accents.

## 1. Me / Profile  `185614,193434,193753,185548(ar)`
- Header (h≈260): palace bg → fade; name + ✏️; `ID:1278472` + copy; **badge row**: country flag, Wealth(W2), level(14), star(6), Noble(5), medals; right: large **VIP medallion frame + "First Recharge"** banner around avatar.
- **Stat row** (4): `Followers 6 · Following 5 · Gifts 265811 · Visitors 100` (value bold 18, label 12 grey).
- **VIP card**: purple gradient + gold border; medallion + `VIP 5` (gold 26) + "Welcome Back VIP" + `My Benefits` outline pill (right).
- **Coins card** (gold gradient, coin icon, `89`) | **Diamonds card** (purple gradient, diamond icon, `57551`) — side by side.
- **Grid card** (4): Store(orange), Task(green), Check in(purple), Backpack(gold) — 52px rounded icons + label.
- **List tiles**: Cp space, My level, My income, Badge, Feedback, Settings — icon + text + chevron.

## 2. VIP Center  `185554`
- Top VIP5 medallion banner "مزايا/benefits". Purple & gold benefit cards (`57539` diamonds / `189` coins style). Frames/effects per level.

## 3. Home (room discovery)  `193900,193905,193910,193915,194030`
- Top tabs: **Mine · Popular · Discover** (+ search). Sub-tabs: **New room · Recently · Follow**.
- "Welcome to Zaffalive" banner; category chips (Gift/Room/Wealth…).
- **Room cards grid (2-col)**: cover image, room name (ar), country flag, 🔥online count, tag. Popular has bigger feature cards.
- Discover: **Gift Wall** banner, Broadcast (KING winning), Event tabs (Official/Room/My Events) + activity banners.

## 4. Live Room (voice room) — PRIORITY  `194040,194048,194056,194100,194106,194128,194148,194152,194201`
- Top bar: back, `Room:1278472` avatar + name + Ranking99+ + online(👥1) + share/settings/close.
- **Seat grid**: **host seat (No.1)** larger top-center, then **No.2…No.N** circular avatars (empty = ring + "No.x"); layouts seen **10** and **15** (also 5/21/30 supported). Speaking = glow ring; mic-off badge.
- Gift banner overlay (e.g. "M5 naghm sends Lucky gift ×100 returns 4500 coins"), "Brilliant Weekly Star" ticker, **Super Bomb (n)** button, Lv.14 EXP bar.
- Bottom: chat feed (tabs **All/Message/Gift**) → input "Say Hi" + 😊 emoji + 🎤 mic + ⌨️ + 🎮 game + 🎁 gift.
- **Gift panel** (sheet): tabs Commonly used/**Gift**/Lucky/Lucky Draw/Aristocracy/CP/Country/Celebrity/Agency/Backpack; grid of gifts (Lucky Package, **Crown of Glory 14999**, Angel Scepter 19999, Champion's Tre, Champion Feast, CP Ring, Victory Firework/Celebration…, Cup of Glory, Zaffa World Cup, World Cup Glory); coin balance `89` + Recharge; qty selector (1/5/10) + **Send** (purple).
- **Emoji panel** (Default grid). **Room information** sheet: cover, Room ID, name, announcement, mode(Voice chat room), topic, decoration, private toggle, country(Belgium), block list.
- **Basic tools** sheet: Message, Turn off the…, Background, Block effects, Room mode; Room theme, Free seat, Lucky number, Public room, Counter; Set public…, Setting, Frame Setting, Opening time.

## 5. Wallet  `193512,193527`
- **Diamonds**: "My Diamonds 57551" + Record; **Exchange for gold coins** (2💎=1🪙) amount grid (500000…10000000) + Custom + Exchange; **Withdrawal** ($ table).
- **Coins**: "My Coins 89" + Record; **Recharge** Google Pay list (50000=0.99€ … 10000000=209.99€).

## 6. Mine / Decorations (backpack)  `193532,193537,193541,193544,193547`
- Left rail tabs: **Frame · Ride · Entry effect · Bubble · Profile Card**; item cards (Lv1 Bomb Frame, VIP5 Frame, Red Mech ride, VIP5 Entry, VIP bubbles/cards) with countdown + **Use/Renew**.

## 7. CP space  `193607,193610`
- Heart with 2 avatars + sweet value `2448317`, `5 days`, **CP privilege**, **Lv.0**; **Confession wall** gift grid (x1..x2194).

## 8. My level  `193627`
- Tabs **Wealth · Charm · Active · Game**; `Wealth LV.14` medallion + progress (415435/475000); description; **level table** (1-10…51-60: level icon + Entry Effect).

## 9. Moment (feed)  `193805,193810`
- Tabs Follow/Recommend/Latest; empty = lion mascot "You haven't followed anybody yet" + View recommendation; Recommend = user posts (photos) + "Say Hi" list; floating +.

## 10. Live (stream grid)  `193817,193823`
- Tabs Popular + country flags; 2-col cards of streamers with viewer count (1.5M…) + flag.

## 11. Message  `193833`
- Tabs Chat/Friends; System, Relationship, Reward Assistant, New followers, Official Assistant rows (icon + title + preview + time/distance).

## 12. Search  `194222`
- Search bar; "People you may like" + Follow; Recommended room cards.

## Reusable components (→ Design System)
UserCard (avatar+frame+badges+stats) · VipBadge/NobleBadge · WealthBadge · AvatarFrame (svga/pag overlay) · GiftLayer (banner+combo+fullscreen) · RoomSeat (host/guest, mic, speaking) · RankingItem · WalletCard (coin/diamond gradients) · GridIcon · ListTile(chevron) · SectionTabs.
