import '../core/api.dart';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import '../core/theme.dart';
import '../providers.dart';
import '../ui/components.dart';

/// Message — notice categories with live unread counts, plus real friends.
///
/// The category rows were previously a hardcoded list with no counts, and the
/// notice.checkNotice result was fetched and then discarded. Both halves are now
/// driven by the API: counts come from checkNotice, the Friends tab from
/// user.getFriendList (mutual follows).
class MessageScreen extends ConsumerWidget {
  const MessageScreen({super.key});

  /// Row label, icon, and the counter field checkNotice returns for it.
  static const _rows = <(String, IconData, String)>[
    ('System', Icons.campaign, 'sysNum'),
    ('Relationship', Icons.favorite, 'fansNum'),
    ('Reward Assistant', Icons.card_giftcard, 'giftNum'),
    ('New followers', Icons.person_add, 'fansNum'),
    ('Official Assistant', Icons.verified, 'actNum'),
  ];

  @override
  Widget build(BuildContext c, WidgetRef ref) {
    final msg = ref.watch(actionProvider(ApiCall('notice.checkNotice')));
    final friends = ref.watch(actionProvider(ApiCall('user.getFriendList')));

    return ZPage(title: 'Message', tabs: const ['Chat', 'Friends'], tabViews: [
      msg.when(
        loading: () => const Center(child: CircularProgressIndicator(color: ZC.purple)),
        error: (e, _) => EmptyState(icon: Icons.cloud_off, text: 'notice.checkNotice failed:\n$e'),
        data: (d) {
          final m = d is Map ? d : const {};
          return ListView(children: [
            for (final r in _rows)
              ZListTile(r.$2, r.$1,
                trailingText: _count(m[r.$3]) > 0 ? '${_count(m[r.$3])}' : null,
                onTap: () async {
                  await ref.read(apiProvider).call('notice.clearNoticeAndImCount');
                  ref.invalidate(actionProvider(ApiCall('notice.checkNotice')));
                }),
          ]);
        },
      ),
      friends.when(
        loading: () => const Center(child: CircularProgressIndicator(color: ZC.purple)),
        error: (_, __) => const EmptyState(icon: Icons.group, text: 'No friends yet'),
        data: (d) {
          final list = (d is Map ? d['list'] : d) as List? ?? const [];
          if (list.isEmpty) {
            return const EmptyState(icon: Icons.group, text: 'No friends yet\n(friends are mutual follows)');
          }
          return ListView(children: [
            for (final u in list)
              // Same tile the Search results use — it renders whichever fields
              // are present and never the Map itself.
              if (u is Map) UserResultTile(u),
          ]);
        },
      ),
    ], body: const SizedBox());
  }

  static int _count(dynamic v) => int.tryParse('${v ?? 0}') ?? 0;
}
