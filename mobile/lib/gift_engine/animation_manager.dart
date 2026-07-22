import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import '../core/theme.dart';
import 'gift_engine.dart';
import 'gift_models.dart';
import 'gift_player.dart';

/// The 5-layer gift overlay (req 6). Drop [GiftStage] on top of the room Stack;
/// it is fully non-interactive (touches pass through) and watches [GiftEngine].
///
///   Layer 1  background effects  (radial glow behind legendary/super)
///   Layer 2  gift animation      (feature player + concurrent small toasts)
///   Layer 3  combo counter       (rendered inside each GiftPlayer chip)
///   Layer 4  camera effect       (flash / vignette on SUPER)
///   Layer 5  special entrance    (VIP / noble entrance banner)
class GiftStage extends ConsumerStatefulWidget {
  const GiftStage({super.key});
  @override
  ConsumerState<GiftStage> createState() => _GiftStageState();
}

class _GiftStageState extends ConsumerState<GiftStage> with SingleTickerProviderStateMixin {
  late final AnimationController _flash =
      AnimationController(vsync: this, duration: const Duration(milliseconds: 650));
  String? _lastFeatureKey;

  @override
  void dispose() { _flash.dispose(); super.dispose(); }

  void _maybeFlash(GiftEvent? f) {
    final key = f?.comboKey;
    if (key == _lastFeatureKey) return;
    _lastFeatureKey = key;
    if (f != null && f.priority.rank >= GiftPriority.legendary.rank) {
      _flash.forward(from: 0);
    }
  }

  @override
  Widget build(BuildContext context) {
    final engine = ref.watch(giftEngineProvider);
    final feature = engine.feature;
    WidgetsBinding.instance.addPostFrameCallback((_) => _maybeFlash(feature));

    return IgnorePointer(
      child: Stack(children: [
        // ── Layer 1: background effects ──────────────────────────
        if (feature != null && feature.priority.rank >= GiftPriority.legendary.rank)
          Positioned.fill(
            child: DecoratedBox(
              decoration: BoxDecoration(
                gradient: RadialGradient(
                  colors: [ZC.purple.withOpacity(.30), Colors.transparent],
                  radius: .9,
                ),
              ),
            ),
          ),

        // ── Layer 2: gift animation (+ Layer 3 combo inside players) ──
        for (final t in engine.toasts)
          GiftPlayer(key: ValueKey('toast_${t.comboKey}'), event: t, onDone: () => engine.removeToast(t)),
        if (feature != null)
          GiftPlayer(key: ValueKey('feat_${feature.comboKey}'), event: feature, onDone: engine.completeFeature),

        // ── Layer 4: camera effect (flash on SUPER/LEGENDARY) ────
        Positioned.fill(
          child: AnimatedBuilder(
            animation: _flash,
            builder: (_, __) {
              final v = _flash.value;
              // 0 → peak at 30% → fade out
              final o = v == 0 ? 0.0 : (v < .3 ? v / .3 * .5 : (1 - v) / .7 * .5);
              return Container(color: Colors.white.withOpacity(o.clamp(0.0, 0.5)));
            },
          ),
        ),

        // ── Layer 5: special entrance ────────────────────────────
        if (engine.entrance != null) _entrance(engine.entrance!),
      ]),
    );
  }

  Widget _entrance(EntranceEvent e) => Positioned(
        left: 0, right: 0, top: 96,
        child: _EntranceBanner(e: e),
      );
}

/// VIP / noble entrance banner sliding in from the left (Layer 5).
class _EntranceBanner extends StatefulWidget {
  final EntranceEvent e;
  const _EntranceBanner({required this.e});
  @override
  State<_EntranceBanner> createState() => _EntranceBannerState();
}

class _EntranceBannerState extends State<_EntranceBanner> with SingleTickerProviderStateMixin {
  late final AnimationController _c =
      AnimationController(vsync: this, duration: const Duration(milliseconds: 500))..forward();
  @override
  void dispose() { _c.dispose(); super.dispose(); }

  @override
  Widget build(BuildContext context) {
    final e = widget.e;
    return SlideTransition(
      position: Tween(begin: const Offset(-1.1, 0), end: Offset.zero).animate(CurvedAnimation(parent: _c, curve: Curves.easeOutBack)),
      child: Align(
        alignment: Alignment.centerLeft,
        child: Container(
          margin: const EdgeInsets.symmetric(horizontal: 12),
          padding: const EdgeInsets.fromLTRB(6, 6, 18, 6),
          decoration: BoxDecoration(
            gradient: ZGrad.vip,
            borderRadius: BorderRadius.circular(28),
            border: Border.all(color: ZC.gold.withOpacity(.7)),
            boxShadow: const [BoxShadow(color: Color(0x66E9B949), blurRadius: 14)],
          ),
          child: Row(mainAxisSize: MainAxisSize.min, children: [
            CircleAvatar(
              radius: 18, backgroundColor: ZC.card,
              backgroundImage: e.avatar.startsWith('http') ? NetworkImage(e.avatar) : null,
              child: e.avatar.startsWith('http') ? null : const Icon(Icons.person, color: ZC.textLo, size: 18),
            ),
            const SizedBox(width: 10),
            Column(mainAxisSize: MainAxisSize.min, crossAxisAlignment: CrossAxisAlignment.start, children: [
              Text(e.name.isEmpty ? 'U${e.uid}' : e.name, style: const TextStyle(color: Colors.white, fontWeight: FontWeight.bold)),
              Text('Noble ${e.nobleLevel} entered', style: const TextStyle(color: ZC.gold2, fontSize: 11)),
            ]),
          ]),
        ),
      ),
    );
  }
}
