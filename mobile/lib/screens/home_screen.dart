import '../ui/components.dart';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import '../core/theme.dart';
import '../providers.dart';

/// Home — Mine / Popular / Discover tabs + room cards (room.getRecommendRoomV2).
class HomeScreen extends ConsumerWidget {
  const HomeScreen({super.key});
  @override Widget build(BuildContext c, WidgetRef ref) {
    return DefaultTabController(length: 3, child: Scaffold(backgroundColor: ZC.bg,
      appBar: AppBar(backgroundColor: Colors.transparent, elevation: 0,
        title: const TabBar(isScrollable: true, indicatorColor: ZC.gold, labelColor: Colors.white, unselectedLabelColor: ZC.textLo,
          tabs: [Tab(text: 'Mine'), Tab(text: 'Popular'), Tab(text: 'Discover')]),
        actions: [IconButton(icon: const Icon(Icons.search, color: ZC.textLo), onPressed: () => c.push('/search')), const SizedBox(width: 8)]),
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
              children: list.map((r) => RoomCard(r)).toList()))),
    ]);
  }
  Widget _popular(WidgetRef ref) => Column(children: [
    Container(margin: const EdgeInsets.all(12), height: 90, decoration: BoxDecoration(gradient: ZGrad.vip, borderRadius: BorderRadius.circular(14)),
      child: const Center(child: Text('Welcome to Zaffalive', style: TextStyle(color: ZC.gold2, fontSize: 20, fontWeight: FontWeight.bold)))),
    Expanded(child: _roomList(ref)),
  ]);
  Widget _discover() => ListView(padding: const EdgeInsets.all(12), children: [
    Container(height: 80, decoration: BoxDecoration(gradient: ZGrad.coin, borderRadius: BorderRadius.circular(14)), child: const Center(child: Text('Gift Wall', style: TextStyle(color: Colors.brown, fontSize: 18, fontWeight: FontWeight.bold)))),
    const SizedBox(height: 12),
    const Text('Event', style: TextStyle(color: Colors.white, fontWeight: FontWeight.bold)),
    for (final e in ['Official Events', 'Room Events', 'My Events']) Card(color: ZC.card, child: ListTile(title: Text(e, style: const TextStyle(color: Colors.white)), trailing: const Icon(Icons.chevron_right, color: ZC.textLo))),
  ]);
}
class _Chip extends StatelessWidget { final String t; final bool on; const _Chip(this.t, this.on);
  @override Widget build(BuildContext c) => Container(padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 6),
    decoration: BoxDecoration(color: on ? ZC.purple : ZC.card, borderRadius: BorderRadius.circular(16)),
    child: Text(t, style: TextStyle(color: on ? Colors.white : ZC.textLo, fontSize: 13))); }

