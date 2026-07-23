import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import 'package:cached_network_image/cached_network_image.dart';
import '../core/theme.dart';
import '../providers.dart';
import '../models/user.dart';
import '../ui/components.dart';
import '../core/config.dart';
import '../core/asset_registry.dart';
import '../decoration/alpha_video_view.dart';

/// Me / Profile — reproduces screenshot 193434, wired to REAL user.getUserinfo.
class MeScreen extends ConsumerWidget {
  const MeScreen({super.key});
  @override
  Widget build(BuildContext c, WidgetRef ref) {
    final me = ref.watch(meProvider);
    return Scaffold(
      backgroundColor: ZC.bg,
      body: me.when(
        loading: () => const Center(child: CircularProgressIndicator(color: ZC.purple)),
        error: (e, _) => Center(child: Padding(padding: const EdgeInsets.all(24),
          child: Text('API user.getUserinfo:\n$e', textAlign: TextAlign.center, style: const TextStyle(color: ZC.textLo)))),
        data: (u) => _body(c, u),
      ),
    );
  }

  Widget _body(BuildContext c, UserModel u) => SingleChildScrollView(child: Column(children: [
    Stack(clipBehavior: Clip.none, children: [
      // Header: the original plays the user's animated decoration here. The API
      // hands back infoBgImg as a CDN zip holding an RGB+alpha mp4, which Flutter
      // cannot alpha-composite from video_player (platform texture — see
      // docs/ANIMATED_HEADER.md). The bundle is converted offline into an
      // animated WebP with real alpha, which Skia composites correctly.
      SizedBox(height: 178, width: double.infinity, child: Stack(fit: StackFit.expand, children: [
        const _HeaderGradient(),
        // The decoration is a tall portrait piece; cover-ing it into a short wide
        // header zooms into a meaningless sliver. Fit its width and pull the
        // decorative arch (crown + winged horses) into view instead, and keep it
        // subtle so it frames the header rather than darkening it.
        // NOT the original Me header: infoBgImg currently resolves to the VIP-V
        // palace decoration, which is a different asset from the mosque the
        // original shows. Gated off until the real header is located.
        if (kAnimatedHeader && u.infoBgImg.isNotEmpty)
          Opacity(opacity: .45, child: Image.asset(Assets.of('header.deco') ?? '',
            fit: BoxFit.fitWidth, alignment: const Alignment(0, -0.72),
            errorBuilder: (_, __, ___) => const SizedBox.shrink())),
        // Scrim (only meaningful with artwork behind it).
        if (kAnimatedHeader) const DecoratedBox(decoration: BoxDecoration(gradient: LinearGradient(
          begin: Alignment.centerLeft, end: Alignment.centerRight,
          colors: [Color(0xCC1A0B2E), Color(0x772A1148), Color(0x22000000)],
          stops: [0.0, 0.45, 1.0]))),
        // experimental direct-video path, off unless ANIMATED_HEADER=true
        if (kAnimatedHeader && u.infoBgImg.startsWith('http'))
          AlphaVideoView(url: u.infoBgImg, fallback: const SizedBox.shrink()),
      ])),
      Positioned(left: 16, top: 54, child: Row(children: [
        Text(u.nick.isEmpty ? 'ZaffaLive' : u.nick, style: const TextStyle(color: Colors.white, fontSize: 22, fontWeight: FontWeight.bold)),
        const SizedBox(width: 6), const Icon(Icons.edit, color: ZC.textLo, size: 16)])),
      Positioned(left: 16, top: 90, child: Row(children: [
        Text('ID:${u.uid}', style: const TextStyle(color: ZC.textLo)), const SizedBox(width: 4), const Icon(Icons.copy, size: 13, color: ZC.textLo)])),
      Positioned(left: 16, top: 124, child: Row(children: [
        if (u.nationalFlag.isNotEmpty) Padding(padding: const EdgeInsets.only(right: 6),
          child: ClipRRect(borderRadius: BorderRadius.circular(3), child: CachedNetworkImage(imageUrl: u.nationalFlag, width: 26, height: 17, fit: BoxFit.cover, errorWidget: (_, __, ___) => const SizedBox(width: 26)))),
        // original app art for the wealth / charm / active / noble badges
        ZBadge('W${u.wealthLv}', const Color(0xFFB03A5B), icon: Icons.shield), const SizedBox(width: 5),
        ZBadge('${u.charmLv + 12}', const Color(0xFF1E9E9E), icon: Icons.spa), const SizedBox(width: 5),
        LevelMedal(u.activeLevel, s: 24), const SizedBox(width: 5),
        NobleEmblem(u.nobleLevel, s: 26)])),
      // Reference: the First-Recharge medallion sits top-right at ~30% of the
      // screen width — size it relative so it never swallows the header.
      Positioned(right: 6, top: 24, child: VipMedallion(s: MediaQuery.of(c).size.width * .30)),
    ]),
    Padding(padding: const EdgeInsets.symmetric(vertical: 12, horizontal: 8), child: Row(children: [
      _stat('${u.fans}', 'Followers'), _stat('${u.following}', 'Following'), _stat('${u.gifts}', 'Gifts'), _stat('${u.beans}', 'Visitors')])),
    Padding(padding: const EdgeInsets.symmetric(horizontal: 16), child: InkWell(onTap: () => c.push('/vip'),
      child: Container(padding: const EdgeInsets.all(16), decoration: BoxDecoration(gradient: ZGrad.vip,
        borderRadius: BorderRadius.circular(16), border: Border.all(color: ZC.gold, width: 1.5),
        boxShadow: const [BoxShadow(color: Color(0x557B2FF7), blurRadius: 14, offset: Offset(0, 6))]),
      child: Row(children: [
        // original app art: winged VIP crest + gold "VIP n" wordmark
        VipCrest(level: u.nobleLevel, s: 54), const SizedBox(width: 12),
        Column(crossAxisAlignment: CrossAxisAlignment.start, mainAxisSize: MainAxisSize.min, children: [
          VipWordmark(level: u.nobleLevel, h: 32),
          const Text('Welcome Back VIP', style: TextStyle(color: Colors.white70))]),
        const Spacer(),
        Container(padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 8),
          decoration: BoxDecoration(border: Border.all(color: ZC.gold), borderRadius: BorderRadius.circular(20)),
          child: const Text('My Benefits', style: TextStyle(color: ZC.gold2, fontWeight: FontWeight.bold)))])))),
    const SizedBox(height: 12),
    Padding(padding: const EdgeInsets.symmetric(horizontal: 16), child: Row(children: [
      Expanded(child: WalletCard(label: 'Coins', value: '${u.coins}', onTap: () => c.push('/wallet'))),
      const SizedBox(width: 12),
      Expanded(child: WalletCard(label: 'Diamonds', value: '${u.diamonds}', diamond: true, onTap: () => c.push('/wallet')))])),
    const SizedBox(height: 12),
    Padding(padding: const EdgeInsets.symmetric(horizontal: 16), child: Container(
      padding: const EdgeInsets.symmetric(vertical: 16), decoration: BoxDecoration(color: ZC.card, borderRadius: BorderRadius.circular(16)),
      child: Row(mainAxisAlignment: MainAxisAlignment.spaceAround, children: [
        // original app's 3D menu artwork
        _gi(c, 'menu.store', 'Store', Icons.storefront, const Color(0xFFE8862E), null),
        _gi(c, 'menu.task', 'Task', Icons.assignment, const Color(0xFF3FA34D), '/tasks'),
        _gi(c, 'menu.checkin', 'Check in', Icons.event_available, ZC.purple2, '/tasks'),
        _gi(c, 'menu.backpack', 'Backpack', Icons.backpack, ZC.gold, '/backpack')]))),
    const SizedBox(height: 12),
    // Original groups these rows in ONE continuous card with hairline dividers
    // (not separate floating cards), with thin outline glyphs.
    Padding(padding: const EdgeInsets.symmetric(horizontal: 16), child: Container(
      decoration: BoxDecoration(color: ZC.card, borderRadius: BorderRadius.circular(16)),
      child: Column(children: [
        _tile(c, Icons.favorite_border, 'Cp space', '/cp'),
        _tile(c, Icons.star_border, 'My level', '/level'),
        _tile(c, Icons.groups_outlined, 'Guild', '/guild'),
        _tile(c, Icons.business_center_outlined, 'Agency', '/agency'),
        _tile(c, Icons.trending_up, 'My income', null),
        _tile(c, Icons.military_tech_outlined, 'Badge', null),
        _tile(c, Icons.animation_outlined, 'Gift Studio', '/gift-studio'),
        _tile(c, Icons.feedback_outlined, 'Feedback', null),
        _tile(c, Icons.settings_outlined, 'Settings', null, last: true),
      ]))),
    const SizedBox(height: 20),
  ]));

  // Four stats must always fit one row (Gifts can be 6+ digits) — scale the
  // number down rather than wrap, and keep the label on a single line.
  Widget _stat(String v, String l) => Expanded(child: Column(mainAxisSize: MainAxisSize.min, children: [
    FittedBox(fit: BoxFit.scaleDown, child: Text(v, maxLines: 1,
      style: const TextStyle(color: Colors.white, fontSize: 18, fontWeight: FontWeight.bold))),
    FittedBox(fit: BoxFit.scaleDown, child: Text(l, maxLines: 1, style: const TextStyle(color: ZC.textLo, fontSize: 12)))]));
  /// Grid entry using the original 3D artwork, falling back to the tinted
  /// Material tile if the asset is missing.
  Widget _gi(BuildContext c, String asset, String l, IconData i, Color color, String? route) => InkWell(
    onTap: route == null ? null : () => c.push(route),
    child: Column(mainAxisSize: MainAxisSize.min, children: [
      Image.asset(Assets.of(asset) ?? '', width: 56, height: 56, fit: BoxFit.contain,
        errorBuilder: (_, __, ___) => Container(width: 52, height: 52,
          decoration: BoxDecoration(gradient: LinearGradient(colors: [color.withValues(alpha: .95), color.withValues(alpha: .7)],
            begin: Alignment.topLeft, end: Alignment.bottomRight), borderRadius: BorderRadius.circular(14)),
          child: Icon(i, color: Colors.white, size: 26))),
      const SizedBox(height: 6),
      Text(l, style: const TextStyle(color: Colors.white, fontSize: 12))]));
  /// One row inside the grouped card; a hairline divider separates rows exactly
  /// like the original (the final row has none).
  Widget _tile(BuildContext c, IconData i, String t, String? route, {bool last = false}) => InkWell(
    onTap: route == null ? null : () => c.push(route),
    child: Container(
      padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 15),
      decoration: last ? null : const BoxDecoration(
        border: Border(bottom: BorderSide(color: Color(0x14FFFFFF), width: 1))),
      child: Row(children: [Icon(i, color: Colors.white70, size: 22), const SizedBox(width: 12),
        Text(t, style: const TextStyle(color: Colors.white, fontSize: 15)), const Spacer(),
        const Icon(Icons.chevron_right, color: ZC.textLo, size: 20)])));
}

/// The static header backdrop, used until (or instead of) the animated
/// decoration the API points at.
class _HeaderGradient extends StatelessWidget {
  const _HeaderGradient();
  @override
  Widget build(BuildContext c) => const DecoratedBox(decoration: BoxDecoration(
    gradient: LinearGradient(begin: Alignment.topCenter, end: Alignment.bottomCenter,
      colors: [Color(0xFF3E2064), Color(0xFF2A1148), ZC.bg])));
}
