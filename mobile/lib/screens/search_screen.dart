import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import '../core/theme.dart';
import '../providers.dart';
import '../ui/components.dart';

/// Search users. Loads user.search style action (unknown → logged).
class SearchScreen extends ConsumerWidget {
  const SearchScreen({super.key});
  @override Widget build(BuildContext c, WidgetRef ref) {
    // Suggestions previously came from user.batchGetUserinfoV2, which returns
    // only the logged-in user — so "People you may like" listed yourself.
    // getRecommendUser is the action that returns actual suggestions.
    final rec = ref.watch(actionProvider(ApiCall('user.getRecommendUser', const {'page': 1})));
    return Scaffold(backgroundColor: ZC.bg, appBar: AppBar(title: Container(height: 38, padding: const EdgeInsets.symmetric(horizontal: ZSpace.md),
      decoration: BoxDecoration(color: ZC.card, borderRadius: BorderRadius.circular(ZRadius.pill)),
      child: const Row(children: [Icon(Icons.search, color: ZC.textLo, size: 18), SizedBox(width: 6), Text('Search for users', style: TextStyle(color: ZC.textLo))]))),
      body: ListView(children: [
        const SectionHeader('People you may like'),
        rec.when(loading: () => const Center(child: CircularProgressIndicator(color: ZC.purple)),
          error: (e,_) => EmptyState(icon: Icons.cloud_off, text: 'API: $e'),
          data: (d) {
            // The action may return a bare list or {list:[...]} — accept both,
            // and render user records as cards (never the raw Map).
            final raw = (d is Map) ? (d['list'] ?? d['users'] ?? const []) : d;
            final list = (raw is List) ? raw.whereType<Map>().toList() : const <Map>[];
            return list.isEmpty
              ? const Padding(padding: EdgeInsets.all(ZSpace.lg), child: Text('(no suggestions — logged)', style: TextStyle(color: ZC.textLo)))
              : Column(children: [for (final u in list) UserResultTile(u)]);
          }),
      ]));
  }
}
