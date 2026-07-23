import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:cached_network_image/cached_network_image.dart';
import '../core/media.dart';
import '../core/theme.dart';
import '../providers.dart';
import '../ui/components.dart';

/// Moment — the social feed.
///
/// Two defects fixed here. (1) The screen called `moment.recomV3`, which was an
/// empty gateway STUB — the real feed handler was `moment.recomV`; the app never
/// reached data. recomV3 now routes to the real feed. (2) Each record was
/// rendered with `'$m'` — the raw Map printed as text. Records are now proper
/// cards.
///
/// The three tabs call distinct real actions: Follow → `moment.follow` (people
/// you follow), Recommend/Latest → `moment.recomV3` (the recommended feed).
class MomentScreen extends ConsumerWidget {
  const MomentScreen({super.key});

  @override
  Widget build(BuildContext c, WidgetRef ref) {
    final follow = ref.watch(actionProvider(ApiCall('moment.follow', const {'page': 1})));
    final recommend = ref.watch(actionProvider(ApiCall('moment.recomV3', const {'page': 1})));

    return ZPage(title: 'Moment', tabs: const ['Follow', 'Recommend', 'Latest'], tabViews: [
      _feed(follow, "You haven't followed anybody yet"),
      _feed(recommend, 'No moments yet'),
      _feed(recommend, 'No moments yet'),
    ], body: const SizedBox());
  }

  Widget _feed(AsyncValue v, String emptyText) => v.when(
    loading: () => const Center(child: CircularProgressIndicator(color: ZC.purple)),
    error: (e, _) => EmptyState(icon: Icons.cloud_off, text: 'moment feed failed:\n$e'),
    data: (d) {
      final list = (d is Map ? d['list'] : d) as List? ?? const [];
      final moments = [for (final m in list) if (m is Map) m];
      if (moments.isEmpty) return EmptyState(icon: Icons.pets, text: emptyText);
      return ListView(children: [for (final m in moments) _MomentCard(m)]);
    },
  );
}

class _MomentCard extends StatelessWidget {
  final Map m;
  const _MomentCard(this.m);

  @override
  Widget build(BuildContext c) {
    final avatar = Media.url('${m['avatar'] ?? ''}');
    final images = (m['images'] as List?) ?? const [];
    return Container(
      margin: const EdgeInsets.symmetric(horizontal: ZSpace.md, vertical: 6),
      padding: const EdgeInsets.all(ZSpace.md),
      decoration: BoxDecoration(color: ZC.card, borderRadius: BorderRadius.circular(14)),
      child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
        Row(children: [
          CircleAvatar(radius: 20, backgroundColor: ZC.bg2,
            backgroundImage: avatar != null ? CachedNetworkImageProvider(avatar) : null,
            child: avatar == null ? const Icon(Icons.person, color: ZC.textLo, size: 20) : null),
          const SizedBox(width: ZSpace.sm),
          Expanded(child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
            Text('${m['nick'] ?? ''}', maxLines: 1, overflow: TextOverflow.ellipsis,
              style: const TextStyle(color: Colors.white, fontSize: 14, fontWeight: FontWeight.w600)),
            Text(_ago(m['time']), style: const TextStyle(color: ZC.textLo, fontSize: 11)),
          ])),
        ]),
        if ('${m['text'] ?? m['content'] ?? ''}'.isNotEmpty) ...[
          const SizedBox(height: 8),
          Text('${m['text'] ?? m['content']}', style: const TextStyle(color: Colors.white, fontSize: 14)),
        ],
        if (images.isNotEmpty) ...[
          const SizedBox(height: 8),
          Wrap(spacing: 6, runSpacing: 6, children: [
            for (final img in images.take(9))
              ClipRRect(borderRadius: BorderRadius.circular(8),
                child: CachedNetworkImage(imageUrl: Media.url('$img') ?? '', width: 96, height: 96, fit: BoxFit.cover,
                  errorWidget: (_, __, ___) => Container(width: 96, height: 96, color: ZC.bg2))),
          ]),
        ],
        const SizedBox(height: 8),
        Row(children: [
          Icon(m['isLike'] == 1 ? Icons.favorite : Icons.favorite_border,
            color: m['isLike'] == 1 ? ZC.pink : ZC.textLo, size: 17),
          const SizedBox(width: 4),
          Text('${m['likes'] ?? 0}', style: const TextStyle(color: ZC.textLo, fontSize: 12)),
          const SizedBox(width: 16),
          const Icon(Icons.mode_comment_outlined, color: ZC.textLo, size: 16),
          const SizedBox(width: 4),
          Text('${m['comments'] ?? 0}', style: const TextStyle(color: ZC.textLo, fontSize: 12)),
          const Spacer(),
          const Icon(Icons.remove_red_eye_outlined, color: ZC.textLo, size: 15),
          const SizedBox(width: 4),
          Text('${m['views'] ?? 0}', style: const TextStyle(color: ZC.textLo, fontSize: 12)),
        ]),
      ]),
    );
  }

  String _ago(dynamic epoch) {
    final t = int.tryParse('${epoch ?? 0}') ?? 0;
    if (t == 0) return '';
    final d = DateTime.now().difference(DateTime.fromMillisecondsSinceEpoch(t * 1000));
    if (d.inMinutes < 1) return 'just now';
    if (d.inHours < 1) return '${d.inMinutes}m ago';
    if (d.inDays < 1) return '${d.inHours}h ago';
    return '${d.inDays}d ago';
  }
}
