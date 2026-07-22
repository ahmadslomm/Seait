import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import '../core/theme.dart';
import '../providers.dart';
import '../ui/components.dart';

/// Moment — feed. Loads moment.recomV3.
class MomentScreen extends ConsumerWidget {
  const MomentScreen({super.key});
  @override Widget build(BuildContext c, WidgetRef ref) {
    final feed = ref.watch(actionProvider((action: 'moment.recomV3', params: {'page': 1})));
    return ZPage(title: 'Moment', tabs: const ['Follow','Recommend','Latest'], tabViews: [
      const EmptyState(icon: Icons.pets, text: "You haven't followed anybody yet"),
      feed.when(loading: () => const Center(child: CircularProgressIndicator(color: ZC.purple)),
        error: (e,_) => EmptyState(icon: Icons.cloud_off, text: 'API moment.recomV3:\n$e'),
        data: (d) { final list = (d is Map ? d['list'] : d) as List? ?? [];
          return list.isEmpty ? const EmptyState(icon: Icons.pets, text: 'No moments yet') : ListView(children: [for (final m in list) ZListTile(Icons.article, '$m')]); }),
      const EmptyState(icon: Icons.schedule, text: 'Latest'),
    ], body: const SizedBox());
  }
}
