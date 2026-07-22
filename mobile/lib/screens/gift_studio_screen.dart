import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import '../core/theme.dart';
import '../providers.dart';
import '../gift_engine/gift_engine.dart';
import '../gift_engine/gift_models.dart';
import '../gift_engine/animation_manager.dart';
import '../gift_engine/svga_renderer.dart';
import '../gift_engine/pag_renderer.dart';

/// Gift Studio (req 10 + 11) — preview ANY extracted SVGA/PAG without sending a
/// real gift, and fire the acceptance-test scenarios (Crown of Glory, Angel
/// Scepter, big gifts, combo 10+, several at once) straight into the engine.
class GiftStudioScreen extends ConsumerStatefulWidget {
  const GiftStudioScreen({super.key});
  @override ConsumerState<GiftStudioScreen> createState() => _GiftStudioState();
}

class _GiftStudioState extends ConsumerState<GiftStudioScreen> {
  // Real extracted asset files (assets/svga, assets/pag).
  static const _svga = <String>[
    '../assets/svga/rocket/waitio_rocket_top1.svga',
    '../assets/svga/rocket/waitio_rocket_top2.svga',
    '../assets/svga/rocket/waitio_rocket_top3.svga',
    '../assets/svga/rocket/waitio_room_rocket.svga',
    '../assets/svga/rocket/waitio_rocket1.svga',
    '../assets/svga/rocket/waitio_rocket2.svga',
    '../assets/svga/rocket/waitio_rocket3.svga',
    '../assets/svga/kroom/waitio_lucky_gift.svga',
    '../assets/svga/kroom/waitio_lucky_gift_winning.svga',
    '../assets/svga/kroom/waitio_birthday_lucky_bag.svga',
    '../assets/svga/kroom/waitio_gift_huizhi.svga',
    '../assets/svga/cp/waitio_cp_heart.svga',
    '../assets/svga/cp/waitio_cp_avatar.svga',
    '../assets/svga/gift/waitio_gift_continuous.svga',
    '../assets/svga/medal/waitio_xunzhangguang.svga',
  ];
  static const _pag = <String>[
    '../assets/pag/bomb/waitio_bomb_anim_lv1.pag',
    '../assets/pag/bomb/waitio_bomb_anim_lv3.pag',
    '../assets/pag/bomb/waitio_bomb_anim_lv5.pag',
    '../assets/pag/bomb/waitio_bomb_anim_lv7.pag',
    '../assets/pag/cp/waitio_cp_heart.pag',
    '../assets/pag/gift/waitio_gift_continuous.pag',
  ];

  ({String url, bool pag})? _preview;

  GiftEngine get _engine => ref.read(giftEngineProvider);

  @override
  void initState() {
    super.initState();
    // load real catalog so scenarios can resolve Crown/Angel by name
    ref.read(giftsProvider.future).then((g) => _engine.loadCatalog(g)).catchError((_) {});
  }

  // ── test scenarios (req 11) ─────────────────────────────────────
  GiftDef _byName(String name, {required String asset, required int price, required int coinType}) {
    for (final d in _engine.catalog) {
      if (d.name.toLowerCase() == name.toLowerCase()) return d;
    }
    // studio-local fallback def straight from a real asset file
    final animType = asset.endsWith('.pag') ? 2 : 1;
    return GiftDef.fromApi({'gift_id': name.hashCode & 0xffff, 'name': name, 'anim_url': asset, 'price': price, 'coin_type': coinType, 'anim_type': animType, 'fullscreen': price >= 5000});
  }

  void _fire(String scenario) {
    const room = 999;
    switch (scenario) {
      case 'crown':
        _engine.receive(GiftEvent(def: _byName('Crown of Glory', asset: '../assets/svga/rocket/waitio_rocket_top1.svga', price: 14999, coinType: 2), senderUid: 1278472, senderName: 'ar', roomId: room));
        break;
      case 'angel':
        _engine.receive(GiftEvent(def: _byName('Angel Scepter', asset: '../assets/svga/rocket/waitio_rocket_top2.svga', price: 19999, coinType: 2), senderUid: 1278472, senderName: 'ar', roomId: room));
        break;
      case 'big':
        _engine.receive(GiftEvent(def: _byName('Rocket', asset: '../assets/svga/rocket/waitio_room_rocket.svga', price: 5000, coinType: 2), senderUid: 1150147, senderName: 'partner', roomId: room));
        break;
      case 'combo':
        // 12 hits of the same small gift → x12 counter, single animation
        final rose = _byName('Rose', asset: '', price: 10, coinType: 1);
        for (var i = 0; i < 12; i++) {
          _engine.receive(GiftEvent(def: rose, senderUid: 1278472, senderName: 'ar', targetUid: 1150147, roomId: room));
        }
        break;
      case 'multi':
        _engine.receive(GiftEvent(def: _byName('Lucky Bag', asset: '../assets/svga/kroom/waitio_lucky_gift.svga', price: 99, coinType: 1), senderUid: 111, senderName: 'A', targetUid: 5, roomId: room));
        _engine.receive(GiftEvent(def: _byName('CP Heart', asset: '../assets/svga/cp/waitio_cp_heart.svga', price: 520, coinType: 2), senderUid: 222, senderName: 'B', roomId: room));
        _engine.receive(GiftEvent(def: _byName('Crown of Glory', asset: '../assets/svga/rocket/waitio_rocket_top1.svga', price: 14999, coinType: 2), senderUid: 333, senderName: 'C', roomId: room));
        break;
      case 'entrance':
        _engine.showEntrance(EntranceEvent(uid: 1278472, name: 'ar', nobleLevel: 5));
        break;
    }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: ZC.bg,
      appBar: AppBar(backgroundColor: Colors.transparent, title: const Text('Gift Studio'),
        leading: IconButton(icon: const Icon(Icons.arrow_back), onPressed: () => context.pop())),
      body: Stack(children: [
        ListView(padding: const EdgeInsets.all(12), children: [
          _section('Scenarios (fire into engine)'),
          Wrap(spacing: 8, runSpacing: 8, children: [
            _chip('👑 Crown of Glory', () => _fire('crown')),
            _chip('🪄 Angel Scepter', () => _fire('angel')),
            _chip('🚀 Big gift', () => _fire('big')),
            _chip('🔥 Combo x12', () => _fire('combo')),
            _chip('🎁 Multi at once', () => _fire('multi')),
            _chip('🚪 VIP entrance', () => _fire('entrance')),
            _chip('🧹 Clear', () => _engine.clear()),
          ]),
          const SizedBox(height: 16),
          _section('SVGA assets (tap to preview)'),
          _assetGrid(_svga, pag: false),
          const SizedBox(height: 16),
          _section('PAG assets (tap to preview)'),
          _assetGrid(_pag, pag: true),
          const SizedBox(height: 60),
        ]),
        // raw single-file preview overlay
        if (_preview != null) _previewOverlay(),
        // live engine overlay (scenarios render here)
        const Positioned.fill(child: GiftStage()),
      ]),
    );
  }

  Widget _section(String t) => Padding(padding: const EdgeInsets.symmetric(vertical: 8),
    child: Text(t, style: const TextStyle(color: ZC.gold, fontWeight: FontWeight.bold, fontSize: 14)));

  Widget _chip(String t, VoidCallback onTap) => ActionChip(
    backgroundColor: ZC.card, label: Text(t, style: const TextStyle(color: Colors.white)), onPressed: onTap);

  Widget _assetGrid(List<String> files, {required bool pag}) => Wrap(spacing: 8, runSpacing: 8,
    children: [for (final f in files) InkWell(
      onTap: () => setState(() => _preview = (url: f, pag: pag)),
      child: Container(width: 108, padding: const EdgeInsets.all(8),
        decoration: BoxDecoration(color: ZC.card, borderRadius: BorderRadius.circular(10)),
        child: Column(children: [
          Icon(pag ? Icons.bolt : Icons.animation, color: pag ? ZC.pink : ZC.purple2, size: 26),
          const SizedBox(height: 4),
          Text(f.split('/').last.replaceAll('waitio_', '').replaceAll('.svga', '').replaceAll('.pag', ''),
            style: const TextStyle(color: ZC.textLo, fontSize: 10), textAlign: TextAlign.center, maxLines: 2, overflow: TextOverflow.ellipsis),
        ]))),
    ]);

  Widget _previewOverlay() {
    final p = _preview!;
    return Positioned.fill(child: GestureDetector(
      onTap: () => setState(() => _preview = null),
      child: Container(color: Colors.black87, child: Center(
        child: SizedBox(width: 320, height: 320, key: ValueKey(p.url),
          child: p.pag
            ? PagRenderer(url: p.url, repeat: 0)
            : SvgaRenderer(url: p.url, loops: 0)),
      )),
    ));
  }
}
