import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import '../core/theme.dart';
import '../models/room.dart';
import '../providers.dart';
import '../ui/components.dart';

/// Live — the room grid, backed by Action/LiveRoom.recommend.
///
/// That action is the most-called in the whole app. It used to return an empty
/// envelope and this screen printed each record with `'$r'`, so the moment the
/// backend started answering, the grid filled with raw Map text. It now renders
/// the same [RoomCard] as Home, so the two lists cannot drift apart.
class LiveScreen extends ConsumerWidget {
  const LiveScreen({super.key});

  @override
  Widget build(BuildContext c, WidgetRef ref) {
    final live = ref.watch(actionProvider(ApiCall('Action/LiveRoom.recommend', const {'page': 1})));
    final follow = ref.watch(actionProvider(ApiCall('user.getSubcribeList', const {'page': 1})));

    return ZPage(title: 'Live', tabs: const ['Popular', 'Follow'], tabViews: [
      _grid(live, 'No live rooms yet'),
      _followed(live, follow),
    ], body: const SizedBox());
  }

  List<RoomModel> _rooms(dynamic d) {
    final list = (d is Map ? d['list'] : d) as List? ?? const [];
    return [for (final r in list) if (r is Map) RoomModel.fromJson(r)];
  }

  Widget _gridOf(List<RoomModel> rooms, String emptyText) => rooms.isEmpty
    ? EmptyState(icon: Icons.videocam_off, text: emptyText)
    : GridView.count(
        crossAxisCount: 2, padding: const EdgeInsets.all(ZSpace.md), childAspectRatio: .72,
        mainAxisSpacing: ZSpace.md, crossAxisSpacing: ZSpace.md,
        children: [for (final r in rooms) RoomCard(r)],
      );

  Widget _grid(AsyncValue live, String emptyText) => live.when(
    loading: () => const Center(child: CircularProgressIndicator(color: ZC.purple)),
    error: (e, _) => EmptyState(icon: Icons.cloud_off, text: 'LiveRoom.recommend failed:\n$e'),
    data: (d) => _gridOf(_rooms(d), emptyText),
  );

  /// Rooms hosted by someone the user follows. Filtered by owner nickname
  /// because that is the field every room-list shape carries; matching on
  /// owner_uid would work on some responses and silently empty the tab on
  /// others.
  Widget _followed(AsyncValue live, AsyncValue follow) => follow.when(
    loading: () => const Center(child: CircularProgressIndicator(color: ZC.purple)),
    error: (_, __) => const EmptyState(icon: Icons.people_outline, text: 'No followed lives'),
    data: (f) {
      final list = (f is Map ? f['list'] : f) as List? ?? const [];
      final nicks = {
        for (final u in list)
          if (u is Map) '${u['nick'] ?? ''}',
      }..remove('');
      if (nicks.isEmpty) {
        return const EmptyState(icon: Icons.people_outline, text: 'You are not following anyone yet');
      }
      return live.when(
        loading: () => const Center(child: CircularProgressIndicator(color: ZC.purple)),
        error: (_, __) => const EmptyState(icon: Icons.people_outline, text: 'No followed lives'),
        data: (d) => _gridOf(
          _rooms(d).where((r) => nicks.contains(r.ownerNick)).toList(),
          'None of the people you follow are live',
        ),
      );
    },
  );
}
