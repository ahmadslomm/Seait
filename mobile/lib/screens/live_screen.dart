import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import '../core/theme.dart';
import '../providers.dart';
import '../ui/components.dart';

/// Live — stream grid. Loads Action/LiveRoom.recommend (unknown schema → logged).
class LiveScreen extends ConsumerWidget {
  const LiveScreen({super.key});
  @override Widget build(BuildContext c, WidgetRef ref) {
    final live = ref.watch(actionProvider((action: 'Action/LiveRoom.recommend', params: {'page': 1})));
    return ZPage(title: 'Live', tabs: const ['Popular','Follow'], tabViews: [
      live.when(loading: () => const Center(child: CircularProgressIndicator(color: ZC.purple)),
        error: (e, _) => EmptyState(icon: Icons.cloud_off, text: 'API LiveRoom.recommend:\n$e'),
        data: (d) { final list = (d is Map ? d['list'] : d) as List? ?? [];
          return list.isEmpty ? const EmptyState(icon: Icons.videocam_off, text: 'No live rooms yet\n(logged for discovery)')
          : GridView.count(crossAxisCount: 2, padding: const EdgeInsets.all(ZSpace.md), childAspectRatio: .72, mainAxisSpacing: ZSpace.md, crossAxisSpacing: ZSpace.md,
            children: [for (final r in list) ZCard(padding: EdgeInsets.zero, child: Center(child: Text('$r', style: ZType.label)))]); }),
      const EmptyState(icon: Icons.people_outline, text: 'No followed lives'),
    ], body: const SizedBox());
  }
}
