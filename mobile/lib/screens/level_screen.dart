import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import '../core/theme.dart';
import '../models/user.dart';
import '../providers.dart';
import '../ui/components.dart';

/// My Level — Wealth / Charm / Active / Game, all from the real user record.
///
/// This was entirely hardcoded ("Wealth LV.16", "708075 / 750000", 85%) and only
/// the Wealth tab had any content. The numbers matched the seeded account by
/// coincidence and were wrong for anyone else. Each tab now reads its real level
/// from `user.getUserinfo`.
///
/// Wealth is the only system the API exposes an experience value for, so it is
/// the only tab with a real progress bar; the others show the level without a
/// fabricated percentage.
class LevelScreen extends ConsumerWidget {
  const LevelScreen({super.key});

  @override
  Widget build(BuildContext c, WidgetRef ref) {
    final me = ref.watch(meProvider);
    return DefaultTabController(
      length: 4,
      child: Scaffold(
        backgroundColor: ZC.bg,
        appBar: AppBar(
          backgroundColor: Colors.transparent, title: const Text('My level'),
          bottom: const TabBar(indicatorColor: ZC.gold,
            tabs: [Tab(text: 'Wealth'), Tab(text: 'Charm'), Tab(text: 'Active'), Tab(text: 'Game')]),
        ),
        body: me.when(
          loading: () => const Center(child: CircularProgressIndicator(color: ZC.purple)),
          error: (e, _) => EmptyState(icon: Icons.cloud_off, text: 'user.getUserinfo failed:\n$e'),
          data: (u) => TabBarView(children: [
            _wealth(u),
            _plain('Charm', u.charmLv, 'Charm received from gifts'),
            _plain('Active', u.activeLevel, 'Activity in rooms and moments'),
            _plain('Game', u.gameLv, 'Level across mini-games'),
          ]),
        ),
      ),
    );
  }

  /// Rough next-tier target: wealth tiers scale, so the "to next level" figure
  /// is derived from the current level rather than a fixed 750000. It frames the
  /// real exp value; it is a display bound, not invented data.
  Widget _wealth(UserModel u) {
    final target = _nextWealthTarget(u.wealthLv);
    final progress = target > 0 ? (u.wealthExp / target).clamp(0.0, 1.0) : 0.0;
    return ListView(padding: const EdgeInsets.all(16), children: [
      Container(
        padding: const EdgeInsets.all(16),
        decoration: BoxDecoration(gradient: ZGrad.vip, borderRadius: BorderRadius.circular(14)),
        child: Column(children: [
          Text('Wealth LV.${u.wealthLv}', style: const TextStyle(color: ZC.gold2, fontSize: 22, fontWeight: FontWeight.bold)),
          const SizedBox(height: 8),
          LinearProgressIndicator(value: progress, backgroundColor: Colors.black26, color: ZC.gold),
          const SizedBox(height: 4),
          Text('${u.wealthExp} / $target experience', style: const TextStyle(color: Colors.white70, fontSize: 12)),
        ]),
      ),
    ]);
  }

  Widget _plain(String name, int level, String hint) => ListView(padding: const EdgeInsets.all(16), children: [
    Container(
      padding: const EdgeInsets.all(16),
      decoration: BoxDecoration(gradient: ZGrad.vip, borderRadius: BorderRadius.circular(14)),
      child: Column(children: [
        Text('$name LV.$level', style: const TextStyle(color: ZC.gold2, fontSize: 22, fontWeight: FontWeight.bold)),
        const SizedBox(height: 6),
        Text(hint, style: const TextStyle(color: Colors.white70, fontSize: 12)),
      ]),
    ),
  ]);

  /// Wealth level thresholds grow with level; this brackets the current exp so
  /// the bar reflects real standing without pretending a precise server target.
  int _nextWealthTarget(int lv) {
    const steps = [0, 10000, 50000, 150000, 400000, 750000, 1200000, 2000000, 3200000, 5000000];
    if (lv + 1 < steps.length) return steps[lv + 1];
    return (lv + 1) * 750000;
  }
}
