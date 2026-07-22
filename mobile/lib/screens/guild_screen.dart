import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import '../core/theme.dart';
import '../providers.dart';
import '../ui/components.dart';

/// Guild — from user.getUserinfo.guild_info (real guild 12147).
class GuildScreen extends ConsumerWidget {
  const GuildScreen({super.key});
  @override Widget build(BuildContext c, WidgetRef ref) {
    final me = ref.watch(meProvider);
    return ZPage(title: 'Guild', body: me.when(loading: () => const Center(child: CircularProgressIndicator(color: ZC.purple)),
      error: (e,_) => EmptyState(icon: Icons.cloud_off, text: 'API: $e'),
      data: (u) { final g = u.guildInfo; return ListView(padding: const EdgeInsets.all(ZSpace.lg), children: [
        ZCard(gradient: ZGrad.vip, border: ZC.gold, child: Row(children: [
          const Icon(Icons.groups, color: ZC.gold2, size: 44), const SizedBox(width: ZSpace.md),
          Expanded(child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
            Text('${g['name'] ?? 'No guild'}', style: ZType.section.copyWith(color: ZC.gold2)),
            Text('Guild ID: ${g['guild_id'] ?? '-'}  ·  Anchors: ${g['anchorNum'] ?? 0}', style: ZType.label)]))])),
        const SectionHeader('Members'),
        const EmptyState(icon: Icons.people, text: 'Members via Action/Anchor.* (logged)'),
      ]); }));
  }
}
