import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import '../core/theme.dart';
import '../providers.dart';
import '../ui/components.dart';

/// VIP / Noble Center — the user's real level and the benefit ladder.
///
/// This was hardcoded to "VIP 5" with a fabricated "7000 / 10000" progress bar,
/// so it showed the same thing for every account (it matched the seeded user's
/// noble level 5 only by coincidence). It now reads the real level from
/// `user.getUserinfo` and highlights it in the ladder.
///
/// The benefit list per level is fixed catalogue text (what each tier grants),
/// so it stays declared here — it is not per-user data. The numeric progress bar
/// was removed rather than faked: the API carries no VIP-experience field, and a
/// made-up percentage is exactly the non-parity this audit exists to remove.
class VipScreen extends ConsumerWidget {
  const VipScreen({super.key});

  static const benefits = {
    1: ['Entry effect', 'VIP badge'],
    2: ['Entry', 'Badge', 'Chat bubble'],
    3: ['Entry', 'Badge', 'Bubble', 'Avatar frame'],
    4: ['Entry', 'Badge', 'Bubble', 'Frame', 'Ride'],
    5: ['Entry', 'Badge', 'Bubble', 'Frame', 'Ride', 'Throne'],
  };

  @override
  Widget build(BuildContext c, WidgetRef ref) {
    final me = ref.watch(meProvider);
    return Scaffold(
      backgroundColor: ZC.bg,
      appBar: AppBar(backgroundColor: Colors.transparent, title: const Text('VIP Center')),
      body: me.when(
        loading: () => const Center(child: CircularProgressIndicator(color: ZC.purple)),
        error: (e, _) => EmptyState(icon: Icons.cloud_off, text: 'user.getUserinfo failed:\n$e'),
        data: (u) {
          // Noble level is the app's "VIP" tier; fall back to vip_level.
          final level = u.nobleLevel > 0 ? u.nobleLevel : u.vipLevel;
          return ListView(padding: const EdgeInsets.all(16), children: [
            Container(
              padding: const EdgeInsets.all(20),
              decoration: BoxDecoration(gradient: ZGrad.vip, borderRadius: BorderRadius.circular(18), border: Border.all(color: ZC.gold, width: 2)),
              child: Column(children: [
                const VipMedallion(s: 90),
                Text(level > 0 ? 'VIP $level' : 'No VIP yet',
                  style: const TextStyle(color: ZC.gold2, fontSize: 30, fontWeight: FontWeight.bold)),
                const SizedBox(height: 8),
                Text(level > 0 ? 'Level $level of 5' : 'Reach VIP 1 to unlock privileges',
                  style: const TextStyle(color: Colors.white70, fontSize: 13)),
              ]),
            ),
            const SizedBox(height: 16),
            const Text('Levels & Benefits', style: TextStyle(color: Colors.white, fontWeight: FontWeight.bold, fontSize: 16)),
            const SizedBox(height: 8),
            for (int lv = 1; lv <= 5; lv++)
              Container(
                margin: const EdgeInsets.only(bottom: 12), padding: const EdgeInsets.all(14),
                decoration: BoxDecoration(
                  color: ZC.card, borderRadius: BorderRadius.circular(14),
                  // The user's CURRENT level is highlighted, not a fixed VIP 5.
                  border: Border.all(color: lv == level ? ZC.gold : Colors.white12, width: lv == level ? 2 : 1)),
                child: Row(children: [
                  Container(width: 44, height: 44, decoration: BoxDecoration(gradient: ZGrad.vip, shape: BoxShape.circle),
                    child: Center(child: Text('$lv', style: const TextStyle(color: ZC.gold2, fontWeight: FontWeight.bold, fontSize: 18)))),
                  const SizedBox(width: 12),
                  Expanded(child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                    Row(children: [
                      Text('VIP $lv', style: const TextStyle(color: ZC.gold2, fontSize: 16, fontWeight: FontWeight.bold)),
                      if (lv == level) ...[
                        const SizedBox(width: 8),
                        Container(padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 2),
                          decoration: BoxDecoration(color: ZC.gold, borderRadius: BorderRadius.circular(10)),
                          child: const Text('Current', style: TextStyle(color: Colors.black, fontSize: 10, fontWeight: FontWeight.bold))),
                      ] else if (lv < level)
                        const Padding(padding: EdgeInsets.only(left: 6), child: Icon(Icons.check_circle, color: ZC.gold, size: 15)),
                    ]),
                    const SizedBox(height: 4),
                    Wrap(spacing: 6, runSpacing: 4, children: [for (final b in benefits[lv]!) ZBadge(b, ZC.purple)]),
                  ])),
                ]),
              ),
          ]);
        },
      ),
    );
  }
}
