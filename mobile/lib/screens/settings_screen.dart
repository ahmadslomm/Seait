import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import '../core/api.dart';
import '../core/config.dart';
import '../core/theme.dart';
import '../providers.dart';
import '../ui/components.dart';

/// Settings — privacy toggles from Action/HiddenSettings.
///
/// Each switch reads its initial state from getHiddenSettings and writes back
/// through updateHiddenSettings. The account rows at the bottom (uid, version)
/// are informational; unbinding a third-party account needs an OAuth provider
/// that is not configured, so that path is not offered here rather than shown
/// as a dead button.
class SettingsScreen extends ConsumerWidget {
  const SettingsScreen({super.key});

  static const _toggles = <(String, String, String)>[
    ('hidden_online', 'Hide online status', 'Others cannot see when you are online'),
    ('hidden_ranking', 'Hide from wealth ranking', 'Your spending will not appear on leaderboards'),
    ('hidden_act_ranking', 'Hide from activity ranking', 'Hidden from event leaderboards'),
    ('refuse_accost', 'Refuse strangers', 'Only people you follow can message you'),
  ];

  @override
  Widget build(BuildContext c, WidgetRef ref) {
    final s = ref.watch(actionProvider(ApiCall('Action/HiddenSettings.getHiddenSettings')));
    return ZPage(
      title: 'Settings',
      body: s.when(
        loading: () => const Center(child: CircularProgressIndicator(color: ZC.purple)),
        error: (e, _) => EmptyState(icon: Icons.cloud_off, text: 'HiddenSettings failed:\n$e'),
        data: (d) {
          final cur = d is Map ? d : const {};
          return ListView(children: [
            const SectionHeader('Privacy'),
            for (final t in _toggles)
              _SettingSwitch(
                title: t.$2, subtitle: t.$3,
                value: (cur[t.$1] ?? 0) == 1,
                onChanged: (v) async {
                  await ref.read(apiProvider).call('Action/HiddenSettings.updateHiddenSettings',
                    params: {t.$1: v ? 1 : 0});
                  ref.invalidate(actionProvider(ApiCall('Action/HiddenSettings.getHiddenSettings')));
                },
              ),
            const SectionHeader('Account'),
            ZListTile(Icons.badge_outlined, 'User ID', trailingText: '${Cfg.myUid}'),
            const ZListTile(Icons.info_outline, 'Version', trailingText: '1.21.150'),
          ]);
        },
      ),
    );
  }
}

class _SettingSwitch extends StatelessWidget {
  final String title, subtitle;
  final bool value;
  final ValueChanged<bool> onChanged;
  const _SettingSwitch({required this.title, required this.subtitle, required this.value, required this.onChanged});

  @override
  Widget build(BuildContext c) => Padding(
    padding: const EdgeInsets.symmetric(horizontal: ZSpace.lg, vertical: 4),
    child: ZCard(
      padding: const EdgeInsets.symmetric(horizontal: ZSpace.md, vertical: 6),
      child: Row(children: [
        Expanded(child: Column(crossAxisAlignment: CrossAxisAlignment.start, mainAxisSize: MainAxisSize.min, children: [
          Text(title, style: const TextStyle(color: Colors.white, fontSize: 15, fontWeight: FontWeight.w500)),
          const SizedBox(height: 2),
          Text(subtitle, style: const TextStyle(color: ZC.textLo, fontSize: 12)),
        ])),
        Switch(value: value, onChanged: onChanged, activeThumbColor: ZC.gold),
      ]),
    ),
  );
}
