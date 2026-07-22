import 'package:flutter/material.dart';
import 'package:pag/pag.dart';

/// PAG renderer — plays a `.pag` file via libpag (Tencent), the same engine the
/// original app uses for its bomb / combo-band animations. Asset or network url.
/// [repeat] = 1 plays once then [onDone]; 0 loops forever.
///
/// NB: PAGView sizes to its parent, so width/height are applied via a SizedBox
/// wrapper. Network uses `PAGView.url` (not `.network`).
class PagRenderer extends StatelessWidget {
  final String url;         // '../assets/pag/...' or 'http...'
  final int repeat;
  final double? width;
  final double? height;
  final VoidCallback? onDone;
  const PagRenderer({super.key, required this.url, this.repeat = 1, this.width, this.height, this.onDone});

  @override
  Widget build(BuildContext context) {
    final count = repeat == 0 ? PAGView.REPEAT_COUNT_LOOP : repeat;
    void end() => onDone?.call();
    Widget view;
    try {
      view = url.startsWith('http')
          ? PAGView.url(url, repeatCount: count, autoPlay: true, onAnimationEnd: end)
          : PAGView.asset(url, repeatCount: count, autoPlay: true, onAnimationEnd: end);
    } catch (_) {
      // plugin/asset unavailable → skip cleanly, keep the queue alive.
      WidgetsBinding.instance.addPostFrameCallback((_) => onDone?.call());
      return const SizedBox.shrink();
    }
    if (width == null && height == null) return view;
    return SizedBox(width: width, height: height, child: view);
  }
}
