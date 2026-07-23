import 'package:flutter/material.dart';
import 'package:svgaplayer_flutter/svgaplayer_flutter.dart';

/// SVGA renderer — plays a `.svga` file (asset path or http url) exactly like
/// nalo/HelloYo do for gift effects. Plays [loops] times then calls [onDone].
/// Any decode/asset error degrades to [onDone] (no crash) so the queue keeps moving.
class SvgaRenderer extends StatefulWidget {
  final String url;         // 'assets/svga/...' or 'http...'
  final int loops;          // 0 = loop forever until disposed
  final BoxFit fit;
  final VoidCallback? onDone;
  const SvgaRenderer({super.key, required this.url, this.loops = 1, this.fit = BoxFit.contain, this.onDone});

  @override
  State<SvgaRenderer> createState() => _SvgaRendererState();
}

class _SvgaRendererState extends State<SvgaRenderer> with SingleTickerProviderStateMixin {
  SVGAAnimationController? _ctrl;
  int _played = 0;
  bool _failed = false;

  @override
  void initState() {
    super.initState();
    _ctrl = SVGAAnimationController(vsync: this);
    _ctrl!.addStatusListener(_onStatus);
    _load();
  }

  Future<void> _load() async {
    try {
      final u = widget.url;
      final video = u.startsWith('http')
          ? await SVGAParser.shared.decodeFromURL(u)
          : await SVGAParser.shared.decodeFromAssets(u);
      if (!mounted) { return; }
      _ctrl!.videoItem = video;
      _ctrl!.forward(from: 0);
    } catch (_) {
      _failed = true;
      if (mounted) setState(() {});
      widget.onDone?.call();
    }
  }

  void _onStatus(AnimationStatus s) {
    if (s != AnimationStatus.completed) return;
    _played++;
    if (widget.loops == 0 || _played < widget.loops) {
      _ctrl!.reset();
      _ctrl!.forward(from: 0);
    } else {
      widget.onDone?.call();
    }
  }

  @override
  void dispose() {
    _ctrl?.removeStatusListener(_onStatus);
    try { _ctrl?.videoItem = null; } catch (_) {}
    _ctrl?.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    if (_failed || _ctrl == null) return const SizedBox.shrink();
    return SVGAImage(_ctrl!, fit: widget.fit, clearsAfterStop: true);
  }
}
