import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import '../core/theme.dart';
import '../providers.dart';
import '../ui/components.dart';

/// Message — conversations + friends. Loads notice.checkNotice / IM (unknown → logged).
class MessageScreen extends ConsumerWidget {
  const MessageScreen({super.key});
  @override Widget build(BuildContext c, WidgetRef ref) {
    final msg = ref.watch(actionProvider(ApiCall('notice.checkNotice')));
    return ZPage(title: 'Message', tabs: const ['Chat','Friends'], tabViews: [
      ListView(children: [
        for (final s in const [['System',Icons.campaign],['Relationship',Icons.favorite],['Reward Assistant',Icons.card_giftcard],['New followers',Icons.person_add],['Official Assistant',Icons.verified]])
          ZListTile(s[1] as IconData, s[0] as String, onTap: () {}),
        msg.when(loading: () => const SizedBox(), error: (e,_) => Padding(padding: const EdgeInsets.all(ZSpace.lg), child: Text('IM/notice: $e', style: ZType.label)), data: (_) => const SizedBox()),
      ]),
      const EmptyState(icon: Icons.group, text: 'No friends yet'),
    ], body: const SizedBox());
  }
}
