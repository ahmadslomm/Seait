import 'package:flutter/material.dart';
import 'package:cached_network_image/cached_network_image.dart';
import '../core/theme.dart';

const _ui = 'assets/ui';

// ---------------- primitives (real cropped app art) ----------------
class CoinIcon extends StatelessWidget { final double s; const CoinIcon({super.key, this.s = 34});
  @override Widget build(BuildContext c) => Image.asset('$_ui/coin_icon.png', width: s, height: s, errorBuilder: (_, __, ___) => Icon(Icons.monetization_on, color: ZC.coin, size: s)); }
class DiamondIcon extends StatelessWidget { final double s; const DiamondIcon({super.key, this.s = 34});
  @override Widget build(BuildContext c) => Image.asset('$_ui/diamond_icon.png', width: s, height: s, errorBuilder: (_, __, ___) => Icon(Icons.diamond, color: ZC.diamond, size: s)); }
class VipMedallion extends StatelessWidget { final double s; const VipMedallion({super.key, this.s = 150});
  @override Widget build(BuildContext c) => Image.asset('$_ui/vip_medallion.png', width: s, errorBuilder: (_, __, ___) => Icon(Icons.workspace_premium, color: ZC.gold, size: s)); }

// ---------------- page scaffolding ----------------
/// Standard page: transparent AppBar + back + optional tabs, on the ZC.bg canvas.
class ZPage extends StatelessWidget {
  final String title; final Widget body; final List<String>? tabs; final List<Widget>? tabViews; final List<Widget>? actions;
  const ZPage({super.key, required this.title, required this.body, this.tabs, this.tabViews, this.actions});
  @override Widget build(BuildContext c) {
    final bar = AppBar(title: Text(title, style: ZType.title.copyWith(fontSize: 18)), centerTitle: true, actions: actions,
      bottom: tabs == null ? null : TabBar(isScrollable: tabs!.length > 3, tabs: tabs!.map((t) => Tab(text: t)).toList()));
    if (tabs != null) return DefaultTabController(length: tabs!.length, child: Scaffold(backgroundColor: ZC.bg, appBar: bar, body: TabBarView(children: tabViews!)));
    return Scaffold(backgroundColor: ZC.bg, appBar: bar, body: body);
  }
}

/// Glass/surface card.
class ZCard extends StatelessWidget {
  final Widget child; final EdgeInsets padding; final Gradient? gradient; final Color? color; final Color? border; final VoidCallback? onTap;
  const ZCard({super.key, required this.child, this.padding = const EdgeInsets.all(ZSpace.lg), this.gradient, this.color, this.border, this.onTap});
  @override Widget build(BuildContext c) {
    final w = Container(padding: padding, decoration: BoxDecoration(gradient: gradient, color: gradient == null ? (color ?? ZC.card) : null,
      borderRadius: BorderRadius.circular(ZRadius.lg), border: border == null ? null : Border.all(color: border!, width: 1.5), boxShadow: ZShadow.card), child: child);
    return onTap == null ? w : InkWell(onTap: onTap, borderRadius: BorderRadius.circular(ZRadius.lg), child: w);
  }
}

class SectionHeader extends StatelessWidget { final String text; final Widget? trailing; const SectionHeader(this.text, {super.key, this.trailing});
  @override Widget build(BuildContext c) => Padding(padding: const EdgeInsets.symmetric(horizontal: ZSpace.lg, vertical: ZSpace.sm),
    child: Row(children: [Text(text, style: ZType.section), const Spacer(), if (trailing != null) trailing!])); }

class ZListTile extends StatelessWidget { final IconData icon; final String text; final Color? iconColor; final VoidCallback? onTap; final String? trailingText;
  const ZListTile(this.icon, this.text, {super.key, this.iconColor, this.onTap, this.trailingText});
  @override Widget build(BuildContext c) => Padding(padding: const EdgeInsets.symmetric(horizontal: ZSpace.lg, vertical: 5),
    child: ZCard(onTap: onTap, padding: const EdgeInsets.all(ZSpace.md + 2), child: Row(children: [
      Icon(icon, color: iconColor ?? ZC.purple2, size: 22), const SizedBox(width: ZSpace.md),
      Text(text, style: ZType.body), const Spacer(),
      if (trailingText != null) Text(trailingText!, style: ZType.label), const Icon(Icons.chevron_right, color: ZC.textLo)]))); }

class SectionTabs extends StatelessWidget { final List<String> tabs; final int index; final ValueChanged<int> onTap;
  const SectionTabs(this.tabs, this.index, this.onTap, {super.key});
  @override Widget build(BuildContext c) => Padding(padding: const EdgeInsets.symmetric(horizontal: ZSpace.md, vertical: ZSpace.sm),
    child: Row(children: [for (int i = 0; i < tabs.length; i++) Padding(padding: const EdgeInsets.only(right: ZSpace.sm),
      child: InkWell(onTap: () => onTap(i), child: Container(padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 6),
        decoration: BoxDecoration(color: i == index ? ZC.purple : ZC.card, borderRadius: BorderRadius.circular(ZRadius.lg)),
        child: Text(tabs[i], style: TextStyle(color: i == index ? ZC.textHi : ZC.textLo, fontSize: 13)))))])); }

class ZProgress extends StatelessWidget { final double value; final String? label; const ZProgress(this.value, {super.key, this.label});
  @override Widget build(BuildContext c) => Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
    ClipRRect(borderRadius: BorderRadius.circular(ZRadius.pill), child: LinearProgressIndicator(value: value.clamp(0, 1), minHeight: 8, backgroundColor: Colors.black26, color: ZC.gold)),
    if (label != null) Padding(padding: const EdgeInsets.only(top: 4), child: Text(label!, style: ZType.label))]); }

/// Async wrapper: shows loader/error/data consistently for API-bound screens.
class ZAsync<T> extends StatelessWidget {
  final AsyncValueLike<T> value; final Widget Function(T) builder; const ZAsync(this.value, this.builder, {super.key});
  @override Widget build(BuildContext c) => value.when(
    loading: () => const Center(child: CircularProgressIndicator(color: ZC.purple)),
    error: (e) => EmptyState(icon: Icons.cloud_off, text: 'API: $e'),
    data: builder);
}
/// tiny adapter so ZAsync doesn't import riverpod
class AsyncValueLike<T> { final T? _d; final Object? _e; final bool _loading;
  const AsyncValueLike.data(T d) : _d = d, _e = null, _loading = false;
  const AsyncValueLike.error(Object e) : _d = null, _e = e, _loading = false;
  const AsyncValueLike.loading() : _d = null, _e = null, _loading = true;
  R when<R>({required R Function() loading, required R Function(Object) error, required R Function(T) data}) =>
    _loading ? loading() : (_e != null ? error(_e) : data(_d as T)); }

class EmptyState extends StatelessWidget { final IconData icon; final String text; final Widget? action;
  const EmptyState({super.key, this.icon = Icons.pets, required this.text, this.action});
  @override Widget build(BuildContext c) => Center(child: Column(mainAxisAlignment: MainAxisAlignment.center, children: [
    Icon(icon, size: 72, color: ZC.textLo), const SizedBox(height: ZSpace.md), Text(text, style: ZType.label, textAlign: TextAlign.center),
    if (action != null) Padding(padding: const EdgeInsets.only(top: ZSpace.lg), child: action!)])); }

// ---------------- domain widgets ----------------
class ZBadge extends StatelessWidget { final String text; final Color color; final IconData? icon; const ZBadge(this.text, this.color, {super.key, this.icon});
  @override Widget build(BuildContext c) => Container(padding: const EdgeInsets.symmetric(horizontal: 7, vertical: 2),
    decoration: BoxDecoration(color: color.withValues(alpha: .9), borderRadius: BorderRadius.circular(9), boxShadow: [BoxShadow(color: color.withValues(alpha: .4), blurRadius: 6)]),
    child: Row(mainAxisSize: MainAxisSize.min, children: [if (icon != null) ...[Icon(icon, size: 11, color: ZC.textHi), const SizedBox(width: 2)], Text(text, style: ZType.badge)])); }

class AvatarFrame extends StatelessWidget { final String avatarUrl; final String? frameUrl; final double size;
  const AvatarFrame({super.key, required this.avatarUrl, this.frameUrl, this.size = 48});
  @override Widget build(BuildContext c) => SizedBox(width: size * 1.4, height: size * 1.4, child: Stack(alignment: Alignment.center, children: [
    ClipOval(child: CachedNetworkImage(imageUrl: avatarUrl, width: size, height: size, fit: BoxFit.cover,
      errorWidget: (_, __, ___) => CircleAvatar(radius: size / 2, backgroundColor: ZC.card, child: const Icon(Icons.person, color: ZC.textLo)))),
    if (frameUrl != null && frameUrl!.endsWith('.png')) CachedNetworkImage(imageUrl: frameUrl!, width: size * 1.4, height: size * 1.4)])); }

/// Coins / Diamonds card — uses the ORIGINAL app's card artwork as the
/// background (gold silk for coins, violet silk for diamonds) with the gradient
/// kept only as a fallback if the asset is unavailable.
class WalletCard extends StatelessWidget { final String label, value; final bool diamond; final VoidCallback? onTap;
  const WalletCard({super.key, required this.label, required this.value, this.diamond = false, this.onTap});
  @override Widget build(BuildContext c) {
    final fg = diamond ? Colors.deepPurple.shade900 : Colors.brown.shade900;
    final inner = Row(children: [
      diamond ? const DiamondIcon() : const CoinIcon(), const SizedBox(width: ZSpace.sm + 2),
      Expanded(child: Column(crossAxisAlignment: CrossAxisAlignment.start, mainAxisSize: MainAxisSize.min, children: [
        Text(label, style: TextStyle(color: fg.withValues(alpha: .85), fontWeight: FontWeight.w700)),
        FittedBox(fit: BoxFit.scaleDown, child: Text(value, maxLines: 1,
          style: TextStyle(color: fg, fontSize: 22, fontWeight: FontWeight.bold)))]))]);
    final w = ClipRRect(borderRadius: BorderRadius.circular(ZRadius.lg), child: Stack(children: [
      Positioned.fill(child: Image.asset('$_ui/${diamond ? "card_diamonds_bg" : "card_coins_bg"}.webp',
        fit: BoxFit.fill, errorBuilder: (_, __, ___) => DecoratedBox(decoration: BoxDecoration(gradient: diamond ? ZGrad.dia : ZGrad.coin)))),
      Padding(padding: const EdgeInsets.all(ZSpace.lg), child: inner),
    ]));
    return onTap == null ? w : InkWell(onTap: onTap, borderRadius: BorderRadius.circular(ZRadius.lg), child: w);
  }
}

/// VIP crest + "VIP n" wordmark straight from the original app art.
class VipCrest extends StatelessWidget { final int level; final double s; const VipCrest({super.key, this.level = 5, this.s = 54});
  @override Widget build(BuildContext c) => Image.asset('$_ui/vip_crest_$level.webp', width: s, height: s,
    errorBuilder: (_, __, ___) => Icon(Icons.workspace_premium, color: ZC.gold2, size: s)); }

class VipWordmark extends StatelessWidget { final int level; final double h; const VipWordmark({super.key, this.level = 5, this.h = 34});
  @override Widget build(BuildContext c) => Image.asset('$_ui/vip_text_$level.webp', height: h, fit: BoxFit.contain,
    errorBuilder: (_, __, ___) => Text('VIP $level', style: TextStyle(color: ZC.gold2, fontSize: h * .8, fontWeight: FontWeight.bold))); }

/// Wealth/charm/noble medal art (levels 1-5) from the original app.
class LevelMedal extends StatelessWidget { final int level; final double s; const LevelMedal(this.level, {super.key, this.s = 26});
  @override Widget build(BuildContext c) {
    final n = level.clamp(1, 5);
    return Image.asset('$_ui/medal_$n.webp', width: s, height: s,
      errorBuilder: (_, __, ___) => Icon(Icons.military_tech, color: ZC.gold, size: s));
  }
}

/// Noble emblem art (1-7) from the original app.
class NobleEmblem extends StatelessWidget { final int level; final double s; const NobleEmblem(this.level, {super.key, this.s = 30});
  @override Widget build(BuildContext c) {
    final n = level.clamp(1, 7);
    return Image.asset('$_ui/noble_$n.webp', width: s, height: s,
      errorBuilder: (_, __, ___) => Icon(Icons.emoji_events, color: ZC.gold, size: s));
  }
}

class BalancePill extends StatelessWidget { final String value; final bool diamond; const BalancePill(this.value, {super.key, this.diamond = false});
  @override Widget build(BuildContext c) => Row(mainAxisSize: MainAxisSize.min, children: [
    diamond ? const DiamondIcon(s: 16) : const CoinIcon(s: 16), const SizedBox(width: 3), Text(value, style: const TextStyle(color: ZC.gold))]); }

/// A single mic seat, reproducing the original room cell:
///   translucent ring + chair glyph when empty, avatar (+ decoration frame) when
///   taken, "No.N" (or the occupant's name) underneath, then a dark heart pill
///   with the charm count. Diameter is driven by the caller so the grid scales
///   with the screen instead of using fixed sizes.
class RoomSeat extends StatelessWidget {
  final int no;                 // 1-based seat number as shown in the original
  final String? avatarUrl;
  final String? frameUrl;       // avatar decoration (network png/webp)
  final String name;
  final bool host, speaking, micOff, locked;
  final int charm;
  final double diameter;
  final VoidCallback? onTap;
  const RoomSeat({super.key, required this.no, this.avatarUrl, this.frameUrl, this.name = '',
    this.host = false, this.speaking = false, this.micOff = false, this.locked = false,
    this.charm = 0, this.diameter = 46, this.onTap});

  @override Widget build(BuildContext c) {
    final d = diameter;
    return InkWell(onTap: onTap, borderRadius: BorderRadius.circular(d), child: Column(mainAxisSize: MainAxisSize.min, children: [
      SizedBox(width: d * 1.5, height: d * 1.5, child: Stack(alignment: Alignment.center, children: [
        // speaking halo
        if (speaking) Container(width: d + 10, height: d + 10, decoration: BoxDecoration(shape: BoxShape.circle,
          border: Border.all(color: ZC.gold, width: 2.5),
          boxShadow: [BoxShadow(color: ZC.gold.withValues(alpha: .45), blurRadius: 10)])),
        // seat disc
        Container(width: d, height: d, decoration: BoxDecoration(shape: BoxShape.circle,
          color: Colors.white.withValues(alpha: .10),
          border: Border.all(color: Colors.white.withValues(alpha: .45), width: 1.2)),
          child: avatarUrl != null && avatarUrl!.startsWith('http')
            ? ClipOval(child: CachedNetworkImage(imageUrl: avatarUrl!, fit: BoxFit.cover,
                errorWidget: (_, __, ___) => Icon(Icons.chair, color: Colors.white70, size: d * .5)))
            : Icon(locked ? Icons.lock : Icons.chair, color: Colors.white.withValues(alpha: .85), size: d * .5)),
        // avatar decoration frame sits OUTSIDE the disc, like the original
        if (frameUrl != null && frameUrl!.startsWith('http'))
          IgnorePointer(child: CachedNetworkImage(imageUrl: frameUrl!, width: d * 1.5, height: d * 1.5,
            fit: BoxFit.contain, errorWidget: (_, __, ___) => const SizedBox.shrink())),
        if (micOff) Positioned(right: d * .16, bottom: d * .16,
          child: CircleAvatar(radius: d * .16, backgroundColor: Colors.black54,
            child: Icon(Icons.mic_off, size: d * .2, color: ZC.danger))),
      ])),
      Text(avatarUrl != null && name.isNotEmpty ? name : 'No.$no',
        style: const TextStyle(color: Colors.white, fontSize: 11, fontWeight: FontWeight.w500),
        maxLines: 1, overflow: TextOverflow.ellipsis),
      const SizedBox(height: 3),
      // heart / charm pill
      Container(padding: const EdgeInsets.symmetric(horizontal: 6, vertical: 1),
        decoration: BoxDecoration(color: Colors.black.withValues(alpha: .35), borderRadius: BorderRadius.circular(10)),
        child: Row(mainAxisSize: MainAxisSize.min, children: [
          Icon(Icons.favorite, size: 10, color: ZC.pink),
          const SizedBox(width: 3),
          Text('$charm', style: const TextStyle(color: Colors.white, fontSize: 10))])),
    ]));
  }
}

class RankingItem extends StatelessWidget { final int rank; final String name; final int score; final String? avatarUrl;
  const RankingItem({super.key, required this.rank, required this.name, required this.score, this.avatarUrl});
  @override Widget build(BuildContext c) => Padding(padding: const EdgeInsets.symmetric(horizontal: ZSpace.md, vertical: 6), child: Row(children: [
    SizedBox(width: 28, child: Text('$rank', style: TextStyle(color: rank <= 3 ? ZC.gold : ZC.textLo, fontWeight: FontWeight.bold, fontSize: 16))),
    CircleAvatar(radius: 18, backgroundColor: ZC.card, backgroundImage: avatarUrl != null ? NetworkImage(avatarUrl!) : null),
    const SizedBox(width: ZSpace.sm + 2), Expanded(child: Text(name, style: ZType.body)), BalancePill('$score')])); }

/// Gift cell (uses a real svga/pag thumbnail name if provided).
class GiftCell extends StatelessWidget { final String name; final int price; final bool diamond; final VoidCallback? onTap;
  const GiftCell({super.key, required this.name, required this.price, this.diamond = false, this.onTap});
  @override Widget build(BuildContext c) => InkWell(onTap: onTap, child: Column(children: [
    Expanded(child: Container(decoration: BoxDecoration(color: ZC.card, borderRadius: BorderRadius.circular(ZRadius.sm)), child: const Icon(Icons.card_giftcard, color: ZC.gold, size: 30))),
    const SizedBox(height: 4), Text(name, style: ZType.label.copyWith(color: ZC.textHi, fontSize: 11), overflow: TextOverflow.ellipsis, maxLines: 1),
    BalancePill('$price', diamond: diamond)])); }
