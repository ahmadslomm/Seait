import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import '../core/theme.dart';
import '../core/room_socket.dart';
import '../core/config.dart';
import '../ui/components.dart';
import '../providers.dart';
import '../gift_engine/gift_engine.dart';
import '../gift_engine/gift_models.dart';
import '../gift_engine/animation_manager.dart';

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

  GiftEngine get _engine => ref.read(giftEngineProvider);

  @override void initState() {
    super.initState();
    seats = List.generate(seatCount, (i) => {'seatNo': i, 'uid': null, 'micState': 0});
    // Load the REAL gift catalog (gift.getGiftList) into the engine.
    ref.read(giftsProvider.future).then((g) { _engine.clear(); _engine.loadCatalog(g); }).catchError((_) {});
    socket.connect();
    socket.join(widget.rid, Cfg.myUid, seatCount: seatCount);
    socket.on('room_state', (d) { if (d?['seats'] != null) setState(() => seats = d['seats']); });
    socket.on('seat_update', (s) => setState(() { if (s['seatNo'] < seats.length) seats[s['seatNo']] = s; }));
    socket.on('mic_status', (s) => setState(() { if (s['seatNo'] < seats.length) seats[s['seatNo']] = s; }));
    socket.on('chat', (d) => setState(() => chat.add(Map<String, dynamic>.from(d))));
    // Gift events (room broadcast) → animation engine (req 4).
    void onGift(d) {
      if (d is Map) {
        _engine.receive(_engine.eventFromPayload(d, roomId: widget.rid));
        setState(() => giftBanner = '${d['fromName'] ?? "U${d['fromUid'] ?? ''}"} sent a gift x${d['num'] ?? 1}');
      }
    }
    socket.on('gift_received', onGift);
    socket.on('gift_broadcast', onGift);
    // VIP/noble entrance (Layer 5).
    socket.on('user_enter', (d) { if (d is Map && (int.tryParse('${d['noble_level'] ?? 0}') ?? 0) > 0) {
      _engine.showEntrance(EntranceEvent(uid: int.tryParse('${d['uid']}') ?? 0, name: '${d['nick'] ?? ''}', avatar: '${d['avatar'] ?? ''}', nobleLevel: int.tryParse('${d['noble_level']}') ?? 0));
    }});
  }
  @override void dispose() { socket.dispose(); super.dispose(); }

  /// Send locally (optimistic) + over the socket. The engine plays it instantly
  /// (like nalo/HelloYo), and the server broadcast reflects it to others.
  void _sendGift(GiftDef def, int qty) {
    socket.sendGift(widget.rid, Cfg.myUid, 0, def.giftId, qty, def.price);
    _engine.receive(GiftEvent(def: def, senderUid: Cfg.myUid, senderName: 'Me', roomId: widget.rid, count: qty));
  }

  @override Widget build(BuildContext c) {
    final host = seats.isNotEmpty ? seats.first : {'seatNo': 0, 'uid': null, 'micState': 0};
    final guests = seats.length > 1 ? seats.sublist(1) : [];
    return Scaffold(
      body: Stack(children: [ Container(
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
      const Positioned.fill(child: GiftStage()), // 5-layer gift overlay
      ]),
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
    builder: (_) => GiftPanel(onSend: _sendGift));
  void _roomInfo(BuildContext c) => showModalBottomSheet(context: c, backgroundColor: ZC.bg2, builder: (_) => Padding(padding: const EdgeInsets.all(16),
    child: Column(mainAxisSize: MainAxisSize.min, crossAxisAlignment: CrossAxisAlignment.start, children: [
      const Text('Room information', style: TextStyle(color: Colors.white, fontSize: 18, fontWeight: FontWeight.bold)), const SizedBox(height: 12),
      _info('Room ID', '${widget.rid}'), _info('Room mode', 'Voice chat room'), _info('Room country', 'Belgium'), _info('Room decoration', '›'),
    ])));
  Widget _info(String k, String v) => Padding(padding: const EdgeInsets.symmetric(vertical: 10), child: Row(children: [Text(k, style: const TextStyle(color: Colors.white)), const Spacer(), Text(v, style: const TextStyle(color: ZC.textLo))]));
}

/// Gift panel sheet — real gifts from gift.getGiftList, selectable + qty + Send.
/// Selecting a gift and Send drives the REAL engine (svga/pag), no mock.
class GiftPanel extends ConsumerStatefulWidget {
  final void Function(GiftDef def, int qty) onSend;
  const GiftPanel({super.key, required this.onSend});
  @override ConsumerState<GiftPanel> createState() => _GiftPanelState();
}

class _GiftPanelState extends ConsumerState<GiftPanel> {
  int _sel = -1;
  int _qty = 1;
  static const _qtys = [1, 10, 99, 520, 1314];

  List<GiftDef> _filter(List<GiftDef> all, int tab) {
    switch (tab) {
      case 1: return all.where((g) => g.coinType == 1).toList();          // Gift (coins)
      case 2: return all.where((g) => g.name.toLowerCase().contains('luck') || g.name.toLowerCase().contains('bag')).toList();
      case 3: return all.where((g) => g.price >= 1000).toList();          // Aristocracy
      case 4: return all.where((g) => g.name.toLowerCase().contains('cp') || g.name.toLowerCase().contains('heart')).toList();
      default: return all;                                                // Commonly = all
    }
  }

  @override Widget build(BuildContext c) {
    final async = ref.watch(giftsProvider);
    final me = ref.watch(meProvider);
    final coins = me.asData?.value.coins ?? 0;
    return DefaultTabController(length: 5, child: SizedBox(height: 400, child: async.when(
      loading: () => const Center(child: CircularProgressIndicator(color: ZC.gold)),
      error: (e, _) => Center(child: Text('gift.getGiftList: $e', style: const TextStyle(color: ZC.textLo))),
      data: (rows) {
        final all = rows.whereType<Map>().map((m) => GiftDef.fromApi(m)).where((g) => g.giftId != 0).toList();
        final defById = {for (final g in all) g.giftId: g};
        return Column(children: [
          const TabBar(isScrollable: true, indicatorColor: ZC.gold, labelColor: ZC.gold, unselectedLabelColor: ZC.textLo,
            tabs: [Tab(text: 'Commonly'), Tab(text: 'Gift'), Tab(text: 'Lucky'), Tab(text: 'Aristocracy'), Tab(text: 'CP')]),
          Expanded(child: TabBarView(children: [for (int t = 0; t < 5; t++) _grid(_filter(all, t))])),
          _bar(c, coins, defById),
        ]);
      },
    )));
  }

  Widget _grid(List<GiftDef> gifts) {
    if (gifts.isEmpty) return const Center(child: Text('No gifts here', style: TextStyle(color: ZC.textLo)));
    return GridView.count(crossAxisCount: 4, padding: const EdgeInsets.all(12), childAspectRatio: .72, mainAxisSpacing: 8, crossAxisSpacing: 8,
      children: [for (final g in gifts) _cell(g)]);
  }

  Widget _cell(GiftDef g) {
    final on = _sel == g.giftId;
    return InkWell(onTap: () => setState(() => _sel = g.giftId), child: Container(
      decoration: BoxDecoration(
        color: on ? ZC.purple.withOpacity(.25) : Colors.transparent,
        borderRadius: BorderRadius.circular(10),
        border: Border.all(color: on ? ZC.gold : Colors.transparent)),
      child: Column(mainAxisAlignment: MainAxisAlignment.center, children: [
        Expanded(child: g.icon.startsWith('http')
          ? Image.network(g.icon, errorBuilder: (_, __, ___) => const Icon(Icons.card_giftcard, color: ZC.gold, size: 30))
          : Icon(Icons.card_giftcard, color: g.priority.rank >= GiftPriority.legendary.rank ? ZC.gold2 : ZC.gold, size: 30)),
        Text(g.name, style: const TextStyle(color: Colors.white, fontSize: 11), overflow: TextOverflow.ellipsis, maxLines: 1),
        Row(mainAxisAlignment: MainAxisAlignment.center, children: [
          Icon(g.coinType == 2 ? Icons.diamond : Icons.monetization_on, size: 11, color: g.coinType == 2 ? ZC.diamond : ZC.coin),
          Text(' ${g.price}', style: const TextStyle(color: ZC.gold, fontSize: 11))]),
      ]),
    ));
  }

  Widget _bar(BuildContext c, int coins, Map<int, GiftDef> defById) => Container(
    padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 8), color: ZC.bg, child: Row(children: [
      const CoinIcon(s: 18), Text(' $coins', style: const TextStyle(color: ZC.gold)), const SizedBox(width: 8),
      InkWell(onTap: () => c.push('/wallet'), child: const Text('Recharge', style: TextStyle(color: ZC.purple2, fontSize: 12))),
      const Spacer(),
      PopupMenuButton<int>(
        color: ZC.bg2, initialValue: _qty, onSelected: (v) => setState(() => _qty = v),
        itemBuilder: (_) => [for (final q in _qtys) PopupMenuItem(value: q, child: Text('x$q', style: const TextStyle(color: Colors.white)))],
        child: Container(padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 6),
          decoration: BoxDecoration(border: Border.all(color: ZC.textLo), borderRadius: BorderRadius.circular(6)),
          child: Row(mainAxisSize: MainAxisSize.min, children: [Text('$_qty', style: const TextStyle(color: Colors.white)), const Icon(Icons.arrow_drop_down, color: ZC.textLo, size: 18)])),
      ),
      const SizedBox(width: 8),
      ElevatedButton(
        onPressed: _sel < 0 ? null : () { widget.onSend(defById[_sel]!, _qty); Navigator.pop(c); },
        style: ElevatedButton.styleFrom(backgroundColor: ZC.purple, disabledBackgroundColor: ZC.card, shape: const StadiumBorder()),
        child: const Text('Send')),
    ]));
}
