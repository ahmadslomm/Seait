import '../core/api.dart';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:cached_network_image/cached_network_image.dart';
import '../core/media.dart';
import '../core/theme.dart';
import '../providers.dart';
import '../ui/components.dart';

/// Daily sign-in — task.getSignInListV3 / task.signInV3.
///
/// The response is `{list: [7 days], signed, continuous, today}`. The previous
/// version read it as a bare List and printed each day with `'$task'`.
class TasksScreen extends ConsumerWidget {
  const TasksScreen({super.key});

  @override
  Widget build(BuildContext c, WidgetRef ref) {
    final t = ref.watch(actionProvider(ApiCall('task.getSignInListV3')));
    return ZPage(
      title: 'Tasks',
      body: t.when(
        loading: () => const Center(child: CircularProgressIndicator(color: ZC.purple)),
        error: (e, _) => EmptyState(icon: Icons.cloud_off, text: 'task.getSignInListV3 failed:\n$e'),
        data: (d) {
          final m = d is Map ? d : const {};
          final days = (m['list'] as List?) ?? const [];
          if (days.isEmpty) {
            return const EmptyState(icon: Icons.assignment_turned_in, text: 'No sign-in rewards configured');
          }
          final signed = m['signed'] == 1;
          final streak = '${m['continuous'] ?? 0}';

          return ListView(padding: const EdgeInsets.all(ZSpace.md), children: [
            Text('Signed in $streak day${streak == '1' ? '' : 's'} in a row',
              style: const TextStyle(color: Colors.white, fontSize: 15, fontWeight: FontWeight.w600)),
            const SizedBox(height: ZSpace.md),
            GridView.count(
              crossAxisCount: 4, shrinkWrap: true, physics: const NeverScrollableScrollPhysics(),
              childAspectRatio: .82, mainAxisSpacing: ZSpace.sm, crossAxisSpacing: ZSpace.sm,
              children: [for (final day in days) if (day is Map) _DayTile(day)],
            ),
            const SizedBox(height: ZSpace.lg),
            SizedBox(
              height: 46,
              child: FilledButton(
                style: FilledButton.styleFrom(
                  backgroundColor: signed ? ZC.card : ZC.gold,
                  foregroundColor: signed ? ZC.textLo : Colors.black),
                onPressed: signed ? null : () async {
                  await ref.read(apiProvider).call('task.signInV3');
                  // Both the board and the wallet move on a claim.
                  ref.invalidate(actionProvider(ApiCall('task.getSignInListV3')));
                  ref.invalidate(actionProvider(ApiCall('wallet.getWalletInfo')));
                },
                child: Text(signed ? 'Already signed in today' : 'Sign in'),
              ),
            ),
          ]);
        },
      ),
    );
  }
}

class _DayTile extends StatelessWidget {
  final Map day;
  const _DayTile(this.day);

  @override
  Widget build(BuildContext c) {
    final claimed = day['status'] == 1;
    final icon = Media.url('${day['icon'] ?? ''}');
    return Container(
      decoration: BoxDecoration(
        color: claimed ? ZC.card.withValues(alpha: .5) : ZC.card,
        borderRadius: BorderRadius.circular(10),
        border: Border.all(color: day['isToday'] == 1 ? ZC.gold : Colors.transparent, width: 1.4)),
      child: Column(mainAxisAlignment: MainAxisAlignment.center, children: [
        if (icon != null)
          CachedNetworkImage(imageUrl: icon, width: 26, height: 26,
            errorWidget: (_, __, ___) => const Icon(Icons.monetization_on, color: ZC.gold, size: 24))
        else
          const Icon(Icons.monetization_on, color: ZC.gold, size: 24),
        const SizedBox(height: 4),
        Text('${day['reward_num'] ?? 0}',
          style: TextStyle(color: claimed ? ZC.textLo : Colors.white, fontSize: 12, fontWeight: FontWeight.w600)),
        Text('Day ${day['day'] ?? ''}', style: const TextStyle(color: ZC.textLo, fontSize: 10)),
        if (claimed) const Padding(padding: EdgeInsets.only(top: 2),
          child: Icon(Icons.check_circle, color: ZC.gold, size: 13)),
      ]),
    );
  }
}
