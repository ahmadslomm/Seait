import 'package:flutter/material.dart';
import 'package:pag/pag.dart';

/// PAG renderer — plays a `.pag` file via libpag (Tencent), the same engine the
/// original app uses for its bomb / combo-band animations. Asset or network url.
/// [repeat] = 1 plays once then [onDone]; 0 loops forever. On load failure the
/// `defaultBuilder` fires [onDone] so the queue keeps moving (req: fallback).
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
    Widget fallback(BuildContext _) {
      WidgetsBinding.instance.addPostFrameCallback((_) => onDone?.call());
      return const SizedBox.shrink();
    }
    return url.startsWith('http')
        ? PAGView.network(url, width: width, height: height, repeatCount: count, autoPlay: true, onAnimationEnd: end, defaultBuilder: fallback)
        : PAGView.asset(url, width: width, height: height, repeatCount: count, autoPlay: true, onAnimationEnd: end, defaultBuilder: fallback);
  }
}
