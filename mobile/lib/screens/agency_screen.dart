import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import '../core/theme.dart';
import '../providers.dart';
import '../ui/components.dart';

class AgencyScreen extends ConsumerWidget {
  const AgencyScreen({super.key});
  @override Widget build(BuildContext c, WidgetRef ref) {
    final a = ref.watch(actionProvider((action: 'Action/BDCenter.inviteUserRes', params: {})));
    return ZPage(title: 'Agency', body: a.when(loading: () => const Center(child: CircularProgressIndicator(color: ZC.purple)),
      error: (e,_) => EmptyState(icon: Icons.cloud_off, text: 'API BDCenter:\n$e'),
      data: (_) => const EmptyState(icon: Icons.business_center, text: 'Agency center (BDCenter.* — logged)')));
  }
}
