import os
R="/root/Seait/mobile/lib"
def w(p,c):
    f=os.path.join(R,p)
    if os.path.exists(f): os.remove(f)
    open(f,"w").write(c.lstrip("\n"))

# ---------- HOME (tabs Mine/Popular/Discover + room cards) ----------
w("screens/home_screen.dart", r"""
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import 'package:cached_network_image/cached_network_image.dart';
import '../core/theme.dart';
import '../providers.dart';
import '../models/room.dart';

/// Home — Mine / Popular / Discover tabs + room cards (room.getRecommendRoomV2).
class HomeScreen extends ConsumerWidget {
  const HomeScreen({super.key});
  @override Widget build(BuildContext c, WidgetRef ref) {
    return DefaultTabController(length: 3, child: Scaffold(backgroundColor: ZC.bg,
      appBar: AppBar(backgroundColor: Colors.transparent, elevation: 0,
        title: const TabBar(isScrollable: true, indicatorColor: ZC.gold, labelColor: Colors.white, unselectedLabelColor: ZC.textLo,
          tabs: [Tab(text: 'Mine'), Tab(text: 'Popular'), Tab(text: 'Discover')]),
        actions: const [Icon(Icons.search, color: ZC.textLo), SizedBox(width: 16)]),
      body: TabBarView(children: [ _roomList(ref, sub: true), _popular(ref), _discover() ])));
  }
  Widget _roomList(WidgetRef ref, {bool sub = false}) {
    final rooms = ref.watch(roomsProvider);
    return Column(children: [
      if (sub) const Padding(padding: EdgeInsets.symmetric(horizontal: 12, vertical: 8),
        child: Row(children: [_Chip('New room', true), SizedBox(width: 10), _Chip('Recently', false), SizedBox(width: 10), _Chip('Follow', false)])),
      Expanded(child: rooms.when(
        loading: () => const Center(child: CircularProgressIndicator(color: ZC.purple)),
        error: (e, _) => Center(child: Text('API: $e', style: const TextStyle(color: ZC.textLo))),
        data: (list) => list.isEmpty
          ? const Center(child: Text('No rooms yet', style: TextStyle(color: ZC.textLo)))
          : GridView.count(crossAxisCount: 2, padding: const EdgeInsets.all(12), childAspectRatio: .82, mainAxisSpacing: 12, crossAxisSpacing: 12,
              children: list.map((r) => _RoomCard(r)).toList()))),
    ]);
  }
  Widget _popular(WidgetRef ref) => Column(children: [
    Container(margin: const EdgeInsets.all(12), height: 90, decoration: BoxDecoration(gradient: ZC.vipGrad, borderRadius: BorderRadius.circular(14)),
      child: const Center(child: Text('Welcome to Zaffalive', style: TextStyle(color: ZC.gold2, fontSize: 20, fontWeight: FontWeight.bold)))),
    Expanded(child: _roomList(ref)),
  ]);
  Widget _discover() => ListView(padding: const EdgeInsets.all(12), children: [
    Container(height: 80, decoration: BoxDecoration(gradient: ZC.coinGrad, borderRadius: BorderRadius.circular(14)), child: const Center(child: Text('Gift Wall', style: TextStyle(color: Colors.brown, fontSize: 18, fontWeight: FontWeight.bold)))),
    const SizedBox(height: 12),
    const Text('Event', style: TextStyle(color: Colors.white, fontWeight: FontWeight.bold)),
    for (final e in ['Official Events', 'Room Events', 'My Events']) Card(color: ZC.card, child: ListTile(title: Text(e, style: const TextStyle(color: Colors.white)), trailing: const Icon(Icons.chevron_right, color: ZC.textLo))),
  ]);
}
class _Chip extends StatelessWidget { final String t; final bool on; const _Chip(this.t, this.on);
  @override Widget build(BuildContext c) => Container(padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 6),
    decoration: BoxDecoration(color: on ? ZC.purple : ZC.card, borderRadius: BorderRadius.circular(16)),
    child: Text(t, style: TextStyle(color: on ? Colors.white : ZC.textLo, fontSize: 13))); }
class _RoomCard extends StatelessWidget { final RoomModel r; const _RoomCard(this.r);
  @override Widget build(BuildContext c) => InkWell(onTap: () => c.push('/room/${r.rid}'),
    child: Container(decoration: BoxDecoration(color: ZC.card, borderRadius: BorderRadius.circular(14)),
      child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
        Expanded(child: ClipRRect(borderRadius: const BorderRadius.vertical(top: Radius.circular(14)),
          child: r.cover.isNotEmpty ? CachedNetworkImage(imageUrl: r.cover, fit: BoxFit.cover, width: double.infinity, errorWidget: (_, __, ___) => _ph(r))
            : _ph(r))),
        Padding(padding: const EdgeInsets.fromLTRB(8, 6, 8, 2), child: Text(r.name, maxLines: 1, overflow: TextOverflow.ellipsis, style: const TextStyle(color: Colors.white, fontWeight: FontWeight.w600))),
        Padding(padding: const EdgeInsets.only(left: 8, bottom: 8), child: Row(children: [const Icon(Icons.local_fire_department, size: 14, color: ZC.gold), Text(' ${r.onlineNum}', style: const TextStyle(color: ZC.textLo, fontSize: 12))])),
      ])));
  Widget _ph(RoomModel r) => Container(decoration: const BoxDecoration(gradient: ZC.vipGrad), child: Center(child: Text('${r.seatCount} mic', style: const TextStyle(color: Colors.white70))));
}
""")

# ---------- VIP CENTER ----------
w("screens/vip_screen.dart", r"""
import 'package:flutter/material.dart';
import '../core/theme.dart';
import '../ui/components.dart';
/// VIP Center — VIP 1..5 with progress, benefits, frames.
class VipScreen extends StatelessWidget {
  const VipScreen({super.key});
  static const benefits = {
    1: ['Entry effect', 'VIP badge'],
    2: ['Entry', 'Badge', 'Chat bubble'],
    3: ['Entry', 'Badge', 'Bubble', 'Avatar frame'],
    4: ['Entry', 'Badge', 'Bubble', 'Frame', 'Ride'],
    5: ['Entry', 'Badge', 'Bubble', 'Frame', 'Ride', 'Throne'],
  };
  @override Widget build(BuildContext c) => Scaffold(backgroundColor: ZC.bg,
    appBar: AppBar(backgroundColor: Colors.transparent, title: const Text('VIP Center')),
    body: ListView(padding: const EdgeInsets.all(16), children: [
      // current VIP header
      Container(padding: const EdgeInsets.all(20), decoration: BoxDecoration(gradient: ZC.vipGrad, borderRadius: BorderRadius.circular(18), border: Border.all(color: ZC.gold, width: 2)),
        child: Column(children: [
          const VipMedallion(s: 90),
          const Text('VIP 5', style: TextStyle(color: ZC.gold2, fontSize: 30, fontWeight: FontWeight.bold)),
          const SizedBox(height: 8),
          const LinearProgressIndicator(value: .7, backgroundColor: Colors.black26, color: ZC.gold),
          const SizedBox(height: 4), const Text('7000 / 10000 to next level', style: TextStyle(color: Colors.white70, fontSize: 12)),
        ])),
      const SizedBox(height: 16),
      const Text('Levels & Benefits', style: TextStyle(color: Colors.white, fontWeight: FontWeight.bold, fontSize: 16)),
      const SizedBox(height: 8),
      for (int lv = 1; lv <= 5; lv++) Container(margin: const EdgeInsets.only(bottom: 12), padding: const EdgeInsets.all(14),
        decoration: BoxDecoration(color: ZC.card, borderRadius: BorderRadius.circular(14), border: Border.all(color: lv == 5 ? ZC.gold : Colors.white12)),
        child: Row(children: [
          Container(width: 44, height: 44, decoration: BoxDecoration(gradient: ZC.vipGrad, shape: BoxShape.circle), child: Center(child: Text('$lv', style: const TextStyle(color: ZC.gold2, fontWeight: FontWeight.bold, fontSize: 18)))),
          const SizedBox(width: 12),
          Expanded(child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
            Text('VIP $lv', style: const TextStyle(color: ZC.gold2, fontSize: 16, fontWeight: FontWeight.bold)),
            const SizedBox(height: 4),
            Wrap(spacing: 6, runSpacing: 4, children: [for (final b in benefits[lv]!) ZBadge(b, ZC.purple)])])),
        ])),
    ]));
}
""")

# ---------- CP + Level stubs (referenced from Me) ----------
w("screens/cp_screen.dart", r"""
import 'package:flutter/material.dart';
import '../core/theme.dart';
class CpScreen extends StatelessWidget { const CpScreen({super.key});
  @override Widget build(BuildContext c) => Scaffold(backgroundColor: const Color(0xFF2A0E2E),
    appBar: AppBar(backgroundColor: Colors.transparent, title: const Text('CP space')),
    body: Center(child: Column(mainAxisAlignment: MainAxisAlignment.center, children: [
      const Icon(Icons.favorite, color: Colors.pinkAccent, size: 80),
      const SizedBox(height: 12), const Text('Lv.0', style: TextStyle(color: Colors.pinkAccent, fontSize: 24, fontWeight: FontWeight.bold)),
      const SizedBox(height: 8), const Text('CP privilege · Confession wall', style: TextStyle(color: ZC.textLo)),
    ]))); }
""")
w("screens/level_screen.dart", r"""
import 'package:flutter/material.dart';
import '../core/theme.dart';
class LevelScreen extends StatelessWidget { const LevelScreen({super.key});
  @override Widget build(BuildContext c) => DefaultTabController(length: 4, child: Scaffold(backgroundColor: ZC.bg,
    appBar: AppBar(backgroundColor: Colors.transparent, title: const Text('My level'),
      bottom: const TabBar(indicatorColor: ZC.gold, tabs: [Tab(text: 'Wealth'), Tab(text: 'Charm'), Tab(text: 'Active'), Tab(text: 'Game')])),
    body: ListView(padding: const EdgeInsets.all(16), children: [
      Container(padding: const EdgeInsets.all(16), decoration: BoxDecoration(gradient: ZC.vipGrad, borderRadius: BorderRadius.circular(14)),
        child: Column(children: const [Text('Wealth LV.16', style: TextStyle(color: ZC.gold2, fontSize: 22, fontWeight: FontWeight.bold)), SizedBox(height: 8),
          LinearProgressIndicator(value: .85, backgroundColor: Colors.black26, color: ZC.gold), SizedBox(height: 4),
          Text('708075 / 750000 experience', style: TextStyle(color: Colors.white70, fontSize: 12))])),
    ]))); }
""")

# ---------- routing (add cp/level; keep others) ----------
w("routing.dart", r"""
import 'package:go_router/go_router.dart';
import 'screens/shell.dart';
import 'screens/wallet_screen.dart';
import 'screens/vip_screen.dart';
import 'screens/room_screen.dart';
import 'screens/cp_screen.dart';
import 'screens/level_screen.dart';
final router = GoRouter(initialLocation: '/', routes: [
  GoRoute(path: '/', builder: (c, s) => const Shell()),
  GoRoute(path: '/wallet', builder: (c, s) => const WalletScreen()),
  GoRoute(path: '/vip', builder: (c, s) => const VipScreen()),
  GoRoute(path: '/cp', builder: (c, s) => const CpScreen()),
  GoRoute(path: '/level', builder: (c, s) => const LevelScreen()),
  GoRoute(path: '/room/:rid', builder: (c, s) => RoomScreen(rid: int.parse(s.pathParameters['rid']!))),
]);
""")
print("home/vip/cp/level/routing generated")
