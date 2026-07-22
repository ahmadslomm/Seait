import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import '../core/theme.dart';
import '../providers.dart';
import '../ui/components.dart';

/// Wallet — Coins & Diamonds from user.getUserinfo; exchange + recharge lists.
class WalletScreen extends ConsumerWidget {
  const WalletScreen({super.key});
  @override Widget build(BuildContext c, WidgetRef ref) {
    final me = ref.watch(meProvider);
    return ZPage(title: 'Wallet', tabs: const ['Coins', 'Diamonds'], tabViews: [
      me.when(loading: () => const Center(child: CircularProgressIndicator(color: ZC.purple)),
        error: (e, _) => EmptyState(icon: Icons.cloud_off, text: 'API: $e'),
        data: (u) => _coins(u.coins)),
      me.when(loading: () => const Center(child: CircularProgressIndicator(color: ZC.purple)),
        error: (e, _) => EmptyState(icon: Icons.cloud_off, text: 'API: $e'),
        data: (u) => _diamonds(u.diamonds)),
    ], body: const SizedBox());
  }
  Widget _coins(int coins) => ListView(padding: const EdgeInsets.all(ZSpace.lg), children: [
    ZCard(gradient: ZGrad.coin, child: Row(children: [const CoinIcon(s: 40), const SizedBox(width: ZSpace.md),
      Column(crossAxisAlignment: CrossAxisAlignment.start, children: [Text('My Coins', style: TextStyle(color: Colors.brown.shade800, fontWeight: FontWeight.w700)),
        Text('$coins', style: TextStyle(color: Colors.brown.shade900, fontSize: 26, fontWeight: FontWeight.bold))])])),
    const SectionHeader('Recharge'),
    for (final r in const [[50000,'0.99'],[250000,'4.99'],[1000000,'20.99'],[2500000,'54.99'],[5000000,'104.99'],[10000000,'209.99']])
      ZCard(padding: const EdgeInsets.symmetric(horizontal: ZSpace.lg, vertical: ZSpace.md), child: Row(children: [
        const CoinIcon(s: 20), const SizedBox(width: ZSpace.sm), Text('${r[0]}', style: ZType.body), const Spacer(),
        Container(padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 6), decoration: BoxDecoration(gradient: ZGrad.vip, borderRadius: BorderRadius.circular(ZRadius.lg)), child: Text('${r[1]} €', style: const TextStyle(color: ZC.textHi))) ])),
  ]);
  Widget _diamonds(int dia) => ListView(padding: const EdgeInsets.all(ZSpace.lg), children: [
    ZCard(gradient: ZGrad.dia, child: Row(children: [const DiamondIcon(s: 40), const SizedBox(width: ZSpace.md),
      Column(crossAxisAlignment: CrossAxisAlignment.start, children: [Text('My Diamonds', style: TextStyle(color: Colors.deepPurple.shade900, fontWeight: FontWeight.w700)),
        Text('$dia', style: TextStyle(color: Colors.deepPurple.shade900, fontSize: 26, fontWeight: FontWeight.bold))])])),
    const SectionHeader('Exchange for gold coins  (2 💎 = 1 🪙)'),
    Wrap(spacing: ZSpace.sm, runSpacing: ZSpace.sm, children: [for (final v in const [500000,1500000,2500000,5000000,7500000,10000000])
      Container(width: 100, padding: const EdgeInsets.all(ZSpace.md), decoration: BoxDecoration(color: ZC.card, borderRadius: BorderRadius.circular(ZRadius.md)), child: Center(child: Text('$v', style: ZType.label.copyWith(color: ZC.gold))))]),
  ]);
}
