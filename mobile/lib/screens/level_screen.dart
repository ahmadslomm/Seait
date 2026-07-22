import 'package:flutter/material.dart';
import '../core/theme.dart';
class LevelScreen extends StatelessWidget { const LevelScreen({super.key});
  @override Widget build(BuildContext c) => DefaultTabController(length: 4, child: Scaffold(backgroundColor: ZC.bg,
    appBar: AppBar(backgroundColor: Colors.transparent, title: const Text('My level'),
      bottom: const TabBar(indicatorColor: ZC.gold, tabs: [Tab(text: 'Wealth'), Tab(text: 'Charm'), Tab(text: 'Active'), Tab(text: 'Game')])),
    body: ListView(padding: const EdgeInsets.all(16), children: [
      Container(padding: const EdgeInsets.all(16), decoration: BoxDecoration(gradient: ZC.vipGrad, borderRadius: BorderRadius.circular(14)),
        child: Column(children: const [Text('Wealth LV.16', style: TextStyle(color: ZC.gold2, fontSize: 22, fontWeight: FontWeight.bold)), SizedBox(height: 8),
          LinearProgressIndicator(value: .85, backgroundColor: Colors.black26, color: ZC.gold), SizedBox(height: 4),
          Text('708075 / 750000 experience', style: TextStyle(color: Colors.white70, fontSize: 12))])),
    ]))); }
