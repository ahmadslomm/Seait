import '../core/api.dart';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:cached_network_image/cached_network_image.dart';
import '../core/media.dart';
import '../core/theme.dart';
import '../providers.dart';
import '../ui/components.dart';

/// Backpack — the decorations the user owns, from mall.getMyProduct.
///
/// Each tab maps to a product `type` on the backend. The previous version read
/// the response as a bare List (it is `{list: [...]}`), showed every item under
/// every tab, and rendered each record with `'$it'` — so it looked empty before
/// the endpoint existed and would have shown raw Map text after.
class BackpackScreen extends ConsumerWidget {
  const BackpackScreen({super.key});

  /// Tab label -> the backend product type it holds.
  static const cats = <String, String>{
    'Frame': 'frame',
    'Ride': 'car',
    'Entry effect': 'entry',
    'Bubble': 'bubble',
    'Profile Card': 'theme',
  };

  @override
  Widget build(BuildContext c, WidgetRef ref) {
    final inv = ref.watch(actionProvider(ApiCall('mall.getMyProduct')));
    return ZPage(
      title: 'Backpack',
      tabs: cats.keys.toList(),
      tabViews: [
        for (final e in cats.entries)
          inv.when(
            loading: () => const Center(child: CircularProgressIndicator(color: ZC.purple)),
            error: (err, _) => EmptyState(icon: Icons.cloud_off, text: 'mall.getMyProduct failed:\n$err'),
            data: (d) {
              final all = (d is Map ? d['list'] : d) as List? ?? const [];
              final items = [
                for (final it in all)
                  if (it is Map && '${it['type']}' == e.value) it,
              ];
              return items.isEmpty
                ? EmptyState(icon: Icons.backpack, text: 'No ${e.key} yet')
                : GridView.count(
                    crossAxisCount: 2, padding: const EdgeInsets.all(ZSpace.md),
                    childAspectRatio: .95, mainAxisSpacing: ZSpace.md, crossAxisSpacing: ZSpace.md,
                    children: [
                      for (final it in items)
                        _ItemTile(it, onUse: () async {
                          await ref.read(apiProvider).call('mall.useProduct', params: {
                            'product_id': it['product_id'],
                            'status': it['equipped'] == 1 ? 0 : 1,
                          });
                          // Re-read rather than flipping the flag locally, so
                          // the badge shows what the server actually did.
                          ref.invalidate(actionProvider(ApiCall('mall.getMyProduct')));
                        }),
                    ],
                  );
            },
          ),
      ],
      body: const SizedBox(),
    );
  }
}

class _ItemTile extends StatelessWidget {
  final Map it;
  final VoidCallback onUse;
  const _ItemTile(this.it, {required this.onUse});

  @override
  Widget build(BuildContext c) {
    final equipped = it['equipped'] == 1;
    final days = int.tryParse('${it['days_left'] ?? 0}') ?? 0;
    // Animated items (svga/pag) have no still frame to show, so they get a
    // glyph rather than a broken image box.
    final art = Media.url('${it['icon'] ?? ''}');
    final drawable = art != null && !art.endsWith('.svga') && !art.endsWith('.pag');

    return ZCard(
      onTap: onUse,
      padding: const EdgeInsets.all(ZSpace.sm),
      child: Column(mainAxisAlignment: MainAxisAlignment.center, children: [
        Expanded(
          child: drawable
            ? CachedNetworkImage(imageUrl: art, fit: BoxFit.contain,
                errorWidget: (_, __, ___) => const Icon(Icons.auto_awesome, color: ZC.gold, size: 40))
            : const Icon(Icons.auto_awesome, color: ZC.gold, size: 40),
        ),
        const SizedBox(height: 4),
        Text('${it['name'] ?? ''}', maxLines: 1, overflow: TextOverflow.ellipsis,
          style: const TextStyle(color: Colors.white, fontSize: 12, fontWeight: FontWeight.w600)),
        const SizedBox(height: 2),
        Text(days > 0 ? '$days days left' : 'Permanent',
          style: const TextStyle(color: ZC.textLo, fontSize: 10)),
        const SizedBox(height: 4),
        Container(
          padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 3),
          decoration: BoxDecoration(
            color: equipped ? ZC.gold : ZC.purple,
            borderRadius: BorderRadius.circular(10)),
          child: Text(equipped ? 'Equipped' : 'Use',
            style: TextStyle(color: equipped ? Colors.black : Colors.white, fontSize: 11)),
        ),
      ]),
    );
  }
}
