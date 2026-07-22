import 'package:flutter/material.dart';
import '../core/theme.dart';
class CpScreen extends StatelessWidget { const CpScreen({super.key});
  @override Widget build(BuildContext c) => Scaffold(backgroundColor: const Color(0xFF2A0E2E),
    appBar: AppBar(backgroundColor: Colors.transparent, title: const Text('CP space')),
    body: Center(child: Column(mainAxisAlignment: MainAxisAlignment.center, children: [
      const Icon(Icons.favorite, color: Colors.pinkAccent, size: 80),
      const SizedBox(height: 12), const Text('Lv.0', style: TextStyle(color: Colors.pinkAccent, fontSize: 24, fontWeight: FontWeight.bold)),
      const SizedBox(height: 8), const Text('CP privilege · Confession wall', style: TextStyle(color: ZC.textLo)),
    ]))); }
