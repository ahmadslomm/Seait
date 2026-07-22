import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import '../core/theme.dart';
import '../providers.dart';
import '../ui/components.dart';

/// Backpack / Mine — decorations: Frame/Ride/Entry/Bubble/Profile Card. Loads mall.getMyProduct.
class BackpackScreen extends ConsumerWidget {
  const BackpackScreen({super.key});
  static const cats = ['Frame','Ride','Entry effect','Bubble','Profile Card'];
  @override Widget build(BuildContext c, WidgetRef ref) {
    final inv = ref.watch(actionProvider((action: 'mall.getMyProduct', params: {})));
    return ZPage(title: 'Backpack', tabs: cats, tabViews: [ for (final cat in cats)
      inv.when(loading: () => const Center(child: CircularProgressIndicator(color: ZC.purple)),
        error: (e, _) => EmptyState(icon: Icons.cloud_off, text: 'API mall.getMyProduct:\n$e'),
        data: (d) { final list = (d is List) ? d : []; return list.isEmpty
          ? EmptyState(icon: Icons.backpack, text: 'No $cat yet\n(mall.getMyProduct returned empty — logged)')
          : GridView.count(crossAxisCount: 2, padding: const EdgeInsets.all(ZSpace.md), childAspectRatio: 1.2,
            children: [for (final it in list) ZCard(child: Center(child: Text('$it', style: ZType.body)))]); }),
    ], body: const SizedBox());
  }
}
