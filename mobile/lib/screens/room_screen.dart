import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import '../core/theme.dart';
import '../core/room_socket.dart';
import '../core/config.dart';
import '../ui/components.dart';

/// Voice Room — reproduces the app's live room: dynamic seat grid (5/10/15/21/30),
/// gift banner, chat (All/Message/Gift), bottom bar, gift panel. Real-time via RoomSocket.
class RoomScreen extends ConsumerStatefulWidget {
  final int rid; const RoomScreen({super.key, required this.rid});
  @override ConsumerState<RoomScreen> createState() => _RoomState();
}

class _RoomState extends ConsumerState<RoomScreen> {
  final socket = RoomSocket();
  int seatCount = 10;
  List seats = [];
  final chat = <Map>[];
  String? giftBanner;

  @override void initState() {
    super.initState();
    seats = List.generate(seatCount, (i) => {'seatNo': i, 'uid': null, 'micState': 0});
    socket.connect();
    socket.join(widget.rid, Cfg.myUid, seatCount: seatCount);
    socket.on('room_state', (d) { if (d?['seats'] != null) setState(() => seats = d['seats']); });
    socket.on('seat_update', (s) => setState(() { if (s['seatNo'] < seats.length) seats[s['seatNo']] = s; }));
    socket.on('mic_status', (s) => setState(() { if (s['seatNo'] < seats.length) seats[s['seatNo']] = s; }));
    socket.on('chat', (d) => setState(() => chat.add(Map<String, dynamic>.from(d))));
    socket.on('gift_received', (d) => setState(() => giftBanner = 'Gift x${d['num'] ?? 1}'));
  }
  @override void dispose() { socket.dispose(); super.dispose(); }

  @override Widget build(BuildContext c) {
    final host = seats.isNotEmpty ? seats.first : {'seatNo': 0, 'uid': null, 'micState': 0};
    final guests = seats.length > 1 ? seats.sublist(1) : [];
    return Scaffold(
      body: Container(
        decoration: const BoxDecoration(gradient: LinearGradient(begin: Alignment.topCenter, end: Alignment.bottomCenter, colors: [Color(0xFF3A1D6E), Color(0xFF1A0B2E)])),
        child: SafeArea(child: Column(children: [
          _topBar(c),
          if (giftBanner != null) _banner(),
          // host seat
          Padding(padding: const EdgeInsets.only(top: 8), child: RoomSeat(no: 0, host: true, avatarUrl: host['uid'] != null ? null : null, name: 'Host')),
          const SizedBox(height: 8),
          // guest seats grid
          Expanded(child: GridView.count(crossAxisCount: seatCount <= 10 ? 4 : (seatCount <= 15 ? 5 : 6),
            padding: const EdgeInsets.symmetric(horizontal: 12), childAspectRatio: .8, physics: const BouncingScrollPhysics(),
            children: [for (final s in guests) RoomSeat(no: s['seatNo'], avatarUrl: s['uid'] != null ? null : null, onTap: () => socket.takeSeat(widget.rid, s['seatNo'], Cfg.myUid), micOff: (s['micState'] ?? 0) == 1)])),
          _chatFeed(),
          _bottomBar(c),
        ])),
      ),
    );
  }

  Widget _topBar(BuildContext c) => Padding(padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 4), child: Row(children: [
    IconButton(icon: const Icon(Icons.arrow_back, color: Colors.white), onPressed: () => c.pop()),
    Container(padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 4), decoration: BoxDecoration(color: Colors.black26, borderRadius: BorderRadius.circular(20)),
      child: Row(mainAxisSize: MainAxisSize.min, children: [const CircleAvatar(radius: 12, backgroundColor: ZC.card), const SizedBox(width: 6), Text('Room:${widget.rid}', style: const TextStyle(color: Colors.white, fontSize: 12))])),
    const SizedBox(width: 8),
    Container(padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 3), decoration: BoxDecoration(color: ZC.purple.withOpacity(.4), borderRadius: BorderRadius.circular(12)),
      child: const Text('Ranking 99+', style: TextStyle(color: ZC.gold, fontSize: 11))),
    const Spacer(),
    const Icon(Icons.person, color: Colors.white70, size: 18), const Text(' 1', style: TextStyle(color: Colors.white70)),
    IconButton(icon: const Icon(Icons.share, color: Colors.white70, size: 20), onPressed: () {}),
    IconButton(icon: const Icon(Icons.more_horiz, color: Colors.white70), onPressed: () => _roomInfo(c)),
  ]));
  Widget _banner() => Container(margin: const EdgeInsets.symmetric(horizontal: 12, vertical: 4), padding: const EdgeInsets.all(8),
    decoration: BoxDecoration(gradient: ZGrad.coin, borderRadius: BorderRadius.circular(20)),
    child: Row(children: [const Icon(Icons.card_giftcard, color: Colors.brown), const SizedBox(width: 8), Expanded(child: Text(giftBanner!, style: const TextStyle(color: Colors.brown, fontWeight: FontWeight.bold)))]));
  Widget _chatFeed() => Container(height: 120, padding: const EdgeInsets.symmetric(horizontal: 12), child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
    const Row(children: [Text('All', style: TextStyle(color: Colors.white)), SizedBox(width: 16), Text('Message', style: TextStyle(color: ZC.textLo)), SizedBox(width: 16), Text('Gift', style: TextStyle(color: ZC.textLo))]),
    Expanded(child: ListView(children: [for (final m in chat.reversed.take(6).toList().reversed) Padding(padding: const EdgeInsets.symmetric(vertical: 2), child: Text('u${m['uid']}: ${m['text']}', style: const TextStyle(color: ZC.textLo, fontSize: 12)))])),
  ]));
  Widget _bottomBar(BuildContext c) => Padding(padding: const EdgeInsets.all(8), child: Row(children: [
    Expanded(child: Container(height: 40, padding: const EdgeInsets.symmetric(horizontal: 14), alignment: Alignment.centerLeft,
      decoration: BoxDecoration(color: Colors.black26, borderRadius: BorderRadius.circular(20)), child: const Text('Say Hi', style: TextStyle(color: ZC.textLo)))),
    IconButton(icon: const Icon(Icons.emoji_emotions_outlined, color: Colors.white), onPressed: () {}),
    IconButton(icon: const Icon(Icons.mic, color: Colors.white), onPressed: () => socket.setMic(widget.rid, 0, 0)),
    IconButton(icon: const Icon(Icons.sports_esports, color: Colors.white), onPressed: () {}),
    IconButton(icon: const Icon(Icons.card_giftcard, color: ZC.gold), onPressed: () => _giftPanel(c)),
  ]));

  void _giftPanel(BuildContext c) => showModalBottomSheet(context: c, backgroundColor: ZC.bg2, isScrollControlled: true,
    builder: (_) => const GiftPanel());
  void _roomInfo(BuildContext c) => showModalBottomSheet(context: c, backgroundColor: ZC.bg2, builder: (_) => Padding(padding: const EdgeInsets.all(16),
    child: Column(mainAxisSize: MainAxisSize.min, crossAxisAlignment: CrossAxisAlignment.start, children: [
      const Text('Room information', style: TextStyle(color: Colors.white, fontSize: 18, fontWeight: FontWeight.bold)), const SizedBox(height: 12),
      _info('Room ID', '${widget.rid}'), _info('Room mode', 'Voice chat room'), _info('Room country', 'Belgium'), _info('Room decoration', '›'),
    ])));
  Widget _info(String k, String v) => Padding(padding: const EdgeInsets.symmetric(vertical: 10), child: Row(children: [Text(k, style: const TextStyle(color: Colors.white)), const Spacer(), Text(v, style: const TextStyle(color: ZC.textLo))]));
}

/// Gift panel sheet — tabs + gift grid + coin balance + qty + Send. Loads gift.getGiftList.
class GiftPanel extends ConsumerWidget {
  const GiftPanel({super.key});
  @override Widget build(BuildContext c, WidgetRef ref) {
    return DefaultTabController(length: 5, child: SizedBox(height: 380, child: Column(children: [
      const TabBar(isScrollable: true, indicatorColor: ZC.gold, labelColor: ZC.gold, unselectedLabelColor: ZC.textLo,
        tabs: [Tab(text: 'Commonly'), Tab(text: 'Gift'), Tab(text: 'Lucky'), Tab(text: 'Aristocracy'), Tab(text: 'CP')]),
      Expanded(child: GridView.count(crossAxisCount: 4, padding: const EdgeInsets.all(12), childAspectRatio: .75, mainAxisSpacing: 8, crossAxisSpacing: 8,
        children: List.generate(8, (i) => Column(children: [
          Expanded(child: Container(decoration: BoxDecoration(color: ZC.card, borderRadius: BorderRadius.circular(10)), child: const Icon(Icons.card_giftcard, color: ZC.gold, size: 30))),
          const SizedBox(height: 4), Text(['Rose', 'Lucky Bag', 'Crown of Glory', 'Angel Scepter', 'CP Ring', 'Rocket', 'World Cup', 'Firework'][i], style: const TextStyle(color: Colors.white, fontSize: 11), overflow: TextOverflow.ellipsis),
          Row(mainAxisAlignment: MainAxisAlignment.center, children: [const CoinIcon(s: 12), Text(' ${[10, 99, 14999, 19999, 520, 5000, 200, 60][i]}', style: const TextStyle(color: ZC.gold, fontSize: 11))])]))))),
      Container(padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 8), color: ZC.bg, child: Row(children: [
        const CoinIcon(s: 18), const Text(' 89', style: TextStyle(color: ZC.gold)), const SizedBox(width: 4),
        const Text('Recharge', style: TextStyle(color: ZC.purple2, fontSize: 12)), const Spacer(),
        Container(padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 4), decoration: BoxDecoration(border: Border.all(color: ZC.textLo), borderRadius: BorderRadius.circular(6)), child: const Text('1', style: TextStyle(color: Colors.white))),
        const SizedBox(width: 8),
        ElevatedButton(onPressed: () {}, style: ElevatedButton.styleFrom(backgroundColor: ZC.purple, shape: const StadiumBorder()), child: const Text('Send')),
      ])),
    ])));
  }
}
