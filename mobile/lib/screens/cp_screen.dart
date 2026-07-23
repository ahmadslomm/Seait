import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import '../core/theme.dart';
import '../providers.dart';
import '../ui/components.dart';

/// CP space — from user.getUserinfo.cp_info (real: partner 1150147, sweet 4887591).
class CpScreen extends ConsumerWidget {
  const CpScreen({super.key});
  @override Widget build(BuildContext c, WidgetRef ref) {
    final me = ref.watch(meProvider);
    // Confession-wall gifts were a fake list (Gift ×8 at 100,200,…). Bind to the
    // real gift catalogue so it matches what can actually be sent.
    final gifts = ref.watch(giftsProvider);
    return Scaffold(backgroundColor: const Color(0xFF2A0E2E), appBar: AppBar(title: const Text('CP space')),
      body: me.when(loading: () => const Center(child: CircularProgressIndicator(color: ZC.pink)),
        error: (e,_) => EmptyState(icon: Icons.cloud_off, text: 'API: $e'),
        data: (u) { final cp = u.cpInfo; final has = (cp['hasCp'] ?? 0) == 1; return ListView(padding: const EdgeInsets.all(ZSpace.lg), children: [
          Center(child: Column(children: [
            const Icon(Icons.favorite, color: ZC.pink, size: 80),
            Text('Sweet ${cp['sweet_value'] ?? 0}', style: const TextStyle(color: ZC.pink, fontSize: 20, fontWeight: FontWeight.bold)),
            Text('${cp['days'] ?? 0} days', style: ZType.label),
            const SizedBox(height: ZSpace.sm),
            Text(has ? 'CP privilege · Lv.${cp['cp_lv'] ?? 0}' : 'No CP yet', style: ZType.body)])),
          const SectionHeader('Confession wall'),
          gifts.when(
            loading: () => const Padding(padding: EdgeInsets.all(ZSpace.lg), child: Center(child: CircularProgressIndicator(color: ZC.pink))),
            error: (_, __) => const EmptyState(icon: Icons.card_giftcard, text: 'Gifts unavailable'),
            data: (list) => list.isEmpty
              ? const EmptyState(icon: Icons.card_giftcard, text: 'No gifts')
              : GridView.count(crossAxisCount: 4, shrinkWrap: true, physics: const NeverScrollableScrollPhysics(), childAspectRatio: .8,
                  children: [for (final g in list.whereType<Map>())
                    GiftCell(name: '${g['name'] ?? ''}', price: int.tryParse('${g['price'] ?? 0}') ?? 0, onTap: () {})])),
        ]); }));
  }
}
