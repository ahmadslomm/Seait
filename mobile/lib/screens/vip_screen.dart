import 'package:flutter/material.dart';
import '../core/theme.dart';
import '../ui/components.dart';
/// VIP Center — VIP 1..5 with progress, benefits, frames.
class VipScreen extends StatelessWidget {
  const VipScreen({super.key});
  static const benefits = {
    1: ['Entry effect', 'VIP badge'],
    2: ['Entry', 'Badge', 'Chat bubble'],
    3: ['Entry', 'Badge', 'Bubble', 'Avatar frame'],
    4: ['Entry', 'Badge', 'Bubble', 'Frame', 'Ride'],
    5: ['Entry', 'Badge', 'Bubble', 'Frame', 'Ride', 'Throne'],
  };
  @override Widget build(BuildContext c) => Scaffold(backgroundColor: ZC.bg,
    appBar: AppBar(backgroundColor: Colors.transparent, title: const Text('VIP Center')),
    body: ListView(padding: const EdgeInsets.all(16), children: [
      // current VIP header
      Container(padding: const EdgeInsets.all(20), decoration: BoxDecoration(gradient: ZC.vipGrad, borderRadius: BorderRadius.circular(18), border: Border.all(color: ZC.gold, width: 2)),
        child: Column(children: [
          const VipMedallion(s: 90),
          const Text('VIP 5', style: TextStyle(color: ZC.gold2, fontSize: 30, fontWeight: FontWeight.bold)),
          const SizedBox(height: 8),
          const LinearProgressIndicator(value: .7, backgroundColor: Colors.black26, color: ZC.gold),
          const SizedBox(height: 4), const Text('7000 / 10000 to next level', style: TextStyle(color: Colors.white70, fontSize: 12)),
        ])),
      const SizedBox(height: 16),
      const Text('Levels & Benefits', style: TextStyle(color: Colors.white, fontWeight: FontWeight.bold, fontSize: 16)),
      const SizedBox(height: 8),
      for (int lv = 1; lv <= 5; lv++) Container(margin: const EdgeInsets.only(bottom: 12), padding: const EdgeInsets.all(14),
        decoration: BoxDecoration(color: ZC.card, borderRadius: BorderRadius.circular(14), border: Border.all(color: lv == 5 ? ZC.gold : Colors.white12)),
        child: Row(children: [
          Container(width: 44, height: 44, decoration: BoxDecoration(gradient: ZC.vipGrad, shape: BoxShape.circle), child: Center(child: Text('$lv', style: const TextStyle(color: ZC.gold2, fontWeight: FontWeight.bold, fontSize: 18)))),
          const SizedBox(width: 12),
          Expanded(child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
            Text('VIP $lv', style: const TextStyle(color: ZC.gold2, fontSize: 16, fontWeight: FontWeight.bold)),
            const SizedBox(height: 4),
            Wrap(spacing: 6, runSpacing: 4, children: [for (final b in benefits[lv]!) ZBadge(b, ZC.purple)])])),
        ])),
    ]));
}
