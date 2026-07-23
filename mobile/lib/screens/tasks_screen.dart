import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import '../core/theme.dart';
import '../providers.dart';
import '../ui/components.dart';

/// Tasks — task.getSignInListV3 (real action name; unknown schema → logged).
class TasksScreen extends ConsumerWidget {
  const TasksScreen({super.key});
  @override Widget build(BuildContext c, WidgetRef ref) {
    final t = ref.watch(actionProvider(ApiCall('task.getSignInListV3')));
    return ZPage(title: 'Tasks', body: t.when(loading: () => const Center(child: CircularProgressIndicator(color: ZC.purple)),
      error: (e,_) => EmptyState(icon: Icons.cloud_off, text: 'API task.getSignInListV3:\n$e'),
      data: (d) { final list = (d is List) ? d : []; return list.isEmpty
        ? const EmptyState(icon: Icons.assignment_turned_in, text: 'No tasks (logged)')
        : ListView(children: [for (final task in list) ZListTile(Icons.check_circle, '$task', trailingText: 'Go')]); }));
  }
}
