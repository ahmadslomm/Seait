import '../core/media.dart';
import 'dart:async';
import 'package:flutter/material.dart';
import '../core/theme.dart';
import 'gift_models.dart';
import 'svga_renderer.dart';
import 'pag_renderer.dart';

/// Plays a SINGLE [GiftEvent] with the right renderer and the right placement
/// (req 5). Combo behaviour: the animation is played once and NOT replayed — a
/// combo hit only bumps the counter and extends the on-screen linger window.
class GiftPlayer extends StatefulWidget {
  final GiftEvent event;
  final VoidCallback onDone;
  const GiftPlayer({super.key, required this.event, required this.onDone});

  @override
  State<GiftPlayer> createState() => _GiftPlayerState();
}

class _GiftPlayerState extends State<GiftPlayer> with TickerProviderStateMixin {
  Timer? _linger;
  bool _done = false;
  late int _shownCount = widget.event.count;
  late final AnimationController _comboAnim =
      AnimationController(vsync: this, duration: const Duration(milliseconds: 260));
  late final AnimationController _enter =
      AnimationController(vsync: this, duration: const Duration(milliseconds: 380))..forward();

  @override
  void initState() {
    super.initState();
    _arm();
  }

  /// (Re)start the linger timer. Combo hits call this to keep the gift visible.
  void _arm() {
    _linger?.cancel();
    _linger = Timer(Duration(milliseconds: widget.event.def.durationMs), () {
      if (_done) return;
      _done = true;
      widget.onDone();
    });
  }

  @override
  void didUpdateWidget(covariant GiftPlayer old) {
    super.didUpdateWidget(old);
    // Same event object, new count → combo bump (no renderer rebuild: key is stable).
    if (widget.event.count != _shownCount) {
      _shownCount = widget.event.count;
      _comboAnim.forward(from: 0);
      _arm(); // extend linger
    }
  }

  @override
  void dispose() {
    _linger?.cancel();
    _comboAnim.dispose();
    _enter.dispose();
    super.dispose();
  }

  // ── renderer selection (req 4) ──────────────────────────────────
  Widget _renderer(GiftDef d, {double? w, double? h, BoxFit fit = BoxFit.contain}) {
    switch (d.renderer) {
      case GiftRenderer.svga:
        return SvgaRenderer(url: d.resolvedUrl, loops: 1, fit: fit);
      case GiftRenderer.pag:
        return PagRenderer(url: d.resolvedUrl, repeat: 1, width: w, height: h);
      case GiftRenderer.video:
      case GiftRenderer.image:
        return _iconFallback(d);
    }
  }

  Widget _iconFallback(GiftDef d) => Center(
        child: Column(mainAxisSize: MainAxisSize.min, children: [
          d.icon.startsWith('http')
              ? Image.network(Media.url(d.icon) ?? '', width: 64, height: 64, errorBuilder: (_, __, ___) => const Icon(Icons.card_giftcard, color: ZC.gold, size: 56))
              : const Icon(Icons.card_giftcard, color: ZC.gold, size: 56),
        ]),
      );

  @override
  Widget build(BuildContext context) {
    final e = widget.event;
    switch (e.def.display) {
      case GiftDisplay.fullscreen:
        return _fullscreen(e);
      case GiftDisplay.avatarAnim:
        return _avatarBand(e);
      case GiftDisplay.overSeat:
        return _overSeat(e);
    }
  }

  // Large gift → full-screen overlay (req 5).
  Widget _fullscreen(GiftEvent e) => Positioned.fill(
        child: IgnorePointer(
          child: Stack(children: [
            Positioned.fill(child: _renderer(e.def, fit: BoxFit.cover)),
            // sender ribbon + combo, bottom-third
            Positioned(left: 0, right: 0, bottom: 130, child: Center(child: _senderChip(e, big: true))),
          ]),
        ),
      );

  // Medium gift → sender avatar + animation band (req 5).
  Widget _avatarBand(GiftEvent e) => Positioned(
        left: 0, right: 0, bottom: 220,
        child: IgnorePointer(
          child: FadeTransition(
            opacity: _enter,
            child: SlideTransition(
              position: Tween(begin: const Offset(-.4, 0), end: Offset.zero).animate(CurvedAnimation(parent: _enter, curve: Curves.easeOut)),
              child: Column(mainAxisSize: MainAxisSize.min, children: [
                SizedBox(height: 150, child: _renderer(e.def, w: 300, h: 150)),
                _senderChip(e),
              ]),
            ),
          ),
        ),
      );

  // Small gift → floats above the receiver's seat 2-3s (req 5).
  Widget _overSeat(GiftEvent e) => Positioned(
        left: 12, bottom: 260,
        child: IgnorePointer(
          child: FadeTransition(
            opacity: _enter,
            child: Container(
              padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 6),
              decoration: BoxDecoration(
                gradient: LinearGradient(colors: [ZC.purple.withValues(alpha: .85), ZC.card.withValues(alpha: .85)]),
                borderRadius: BorderRadius.circular(24),
                border: Border.all(color: ZC.gold.withValues(alpha: .5)),
              ),
              child: Row(mainAxisSize: MainAxisSize.min, children: [
                SizedBox(width: 40, height: 40, child: _renderer(e.def, w: 40, h: 40)),
                const SizedBox(width: 8),
                Text('${e.senderName.isEmpty ? "U${e.senderUid}" : e.senderName}  →  ${e.def.name}',
                    style: const TextStyle(color: Colors.white, fontSize: 12)),
                const SizedBox(width: 8),
                _comboBadge(e),
              ]),
            ),
          ),
        ),
      );

  Widget _senderChip(GiftEvent e, {bool big = false}) => Container(
        padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 6),
        decoration: BoxDecoration(color: Colors.black38, borderRadius: BorderRadius.circular(24)),
        child: Row(mainAxisSize: MainAxisSize.min, children: [
          CircleAvatar(radius: big ? 18 : 14, backgroundColor: ZC.card,
              backgroundImage: e.senderAvatar.startsWith('http') ? NetworkImage(e.senderAvatar) : null,
              child: e.senderAvatar.startsWith('http') ? null : const Icon(Icons.person, size: 16, color: ZC.textLo)),
          const SizedBox(width: 8),
          Column(crossAxisAlignment: CrossAxisAlignment.start, mainAxisSize: MainAxisSize.min, children: [
            Text(e.senderName.isEmpty ? 'U${e.senderUid}' : e.senderName, style: TextStyle(color: Colors.white, fontSize: big ? 14 : 12, fontWeight: FontWeight.bold)),
            Text('Sent ${e.def.name}${e.targetName.isNotEmpty ? " → ${e.targetName}" : ""}', style: const TextStyle(color: ZC.textLo, fontSize: 11)),
          ]),
          const SizedBox(width: 10),
          _comboBadge(e, big: big),
        ]),
      );

  // Combo counter (Layer 3) — bumps x2 x3 … with a pop animation.
  Widget _comboBadge(GiftEvent e, {bool big = false}) {
    if (e.count <= 1) return const SizedBox.shrink();
    return ScaleTransition(
      scale: Tween(begin: 1.0, end: 1.35).animate(CurvedAnimation(parent: _comboAnim, curve: Curves.elasticOut)),
      child: ShaderMask(
        shaderCallback: (r) => ZGrad.gold.createShader(r),
        child: Text('x${e.count}',
            style: TextStyle(color: Colors.white, fontStyle: FontStyle.italic, fontWeight: FontWeight.w900, fontSize: big ? 30 : 20)),
      ),
    );
  }
}
