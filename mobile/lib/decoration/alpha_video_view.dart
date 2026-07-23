import 'dart:io';

import 'package:flutter/material.dart';
import 'package:flutter/rendering.dart';
import 'package:video_player/video_player.dart';

import 'decoration_cache.dart';

/// Paints its child with [blendMode] into an isolated layer, so a mask can be
/// applied over sibling content. Flutter has no built-in widget for this.
class _BlendMask extends SingleChildRenderObjectWidget {
  final BlendMode blendMode;
  const _BlendMask({required this.blendMode, required Widget child}) : super(child: child);
  @override
  RenderObject createRenderObject(BuildContext c) => _RenderBlendMask(blendMode);
  @override
  void updateRenderObject(BuildContext c, _RenderBlendMask r) => r.blendMode = blendMode;
}

class _RenderBlendMask extends RenderProxyBox {
  BlendMode blendMode;
  _RenderBlendMask(this.blendMode);
  @override
  void paint(PaintingContext context, Offset offset) {
    context.canvas.saveLayer(offset & size, Paint()..blendMode = blendMode);
    super.paint(context, offset);
    context.canvas.restore();
  }
}

/// Plays an "RGB | ALPHA" side-by-side video — the format the original app uses
/// for animated profile backgrounds — and composites it to real transparency.
///
/// Give it the raw `infoBgImg` URL: it downloads/unpacks the CDN zip, plays the
/// contained mp4 muted + looping, and shows the colour half masked by the
/// greyscale half. While loading, or on any failure, [fallback] is shown.
///
/// Implementation note: `video_player` renders through a platform Texture and
/// never hands out a `ui.Image`, so a FragmentShader cannot sample it. Instead
/// the frame is drawn twice —
///   * left region  -> the colour layer
///   * right region -> stretched to the same box (that IS the 2x horizontal
///     upscale, since the mask is stored at half width) and converted from
///     luminance to alpha by a colour matrix, then applied with BlendMode.dstIn.
class AlphaVideoView extends StatefulWidget {
  final String url;
  final Widget fallback;

  /// Normalised x where the alpha region begins. Measured on the real payload
  /// (1136px wide frame, split at 757): 757/1136 = 0.6664.
  final double split;

  const AlphaVideoView({
    super.key,
    required this.url,
    required this.fallback,
    this.split = 757.0 / 1136.0,
  });

  @override
  State<AlphaVideoView> createState() => _AlphaVideoViewState();
}

class _AlphaVideoViewState extends State<AlphaVideoView> {
  VideoPlayerController? _ctrl;
  bool _failed = false;

  /// Zeroes RGB and moves luminance into the alpha channel, turning the
  /// greyscale mask region into a real alpha mask for BlendMode.dstIn.
  static const ColorFilter _lumaToAlpha = ColorFilter.matrix(<double>[
    0, 0, 0, 0, 0,
    0, 0, 0, 0, 0,
    0, 0, 0, 0, 0,
    0.2126, 0.7152, 0.0722, 0, 0,
  ]);

  @override
  void initState() { super.initState(); _load(); }

  @override
  void didUpdateWidget(covariant AlphaVideoView old) {
    super.didUpdateWidget(old);
    if (old.url != widget.url) { _disposeCtrl(); _failed = false; _load(); }
  }

  Future<void> _load() async {
    try {
      final file = await DecorationCache.I.fetch(widget.url, const ['.mp4', '.webm']);
      if (file == null || !mounted) { _fail(); return; }
      final c = VideoPlayerController.file(File(file.path));
      await c.initialize();
      await c.setVolume(0);
      await c.setLooping(true);
      await c.play();
      if (!mounted) { await c.dispose(); return; }
      setState(() => _ctrl = c);
    } catch (e) {
      debugPrint('[alpha-video] $e');
      _fail();
    }
  }

  void _fail() { if (mounted) setState(() => _failed = true); }
  void _disposeCtrl() { _ctrl?.dispose(); _ctrl = null; }
  @override
  void dispose() { _disposeCtrl(); super.dispose(); }

  /// One horizontal slice of the frame, stretched to fill the whole box.
  Widget _region(VideoPlayerController c, {required bool left}) {
    final factor = left ? widget.split : 1 - widget.split;
    return FittedBox(
      fit: BoxFit.fill,
      child: ClipRect(
        child: Align(
          alignment: left ? Alignment.centerLeft : Alignment.centerRight,
          widthFactor: factor,
          child: SizedBox(
            width: c.value.size.width,
            height: c.value.size.height,
            child: VideoPlayer(c),
          ),
        ),
      ),
    );
  }

  @override
  Widget build(BuildContext context) {
    final c = _ctrl;
    if (_failed || c == null || !c.value.isInitialized) return widget.fallback;

    return ClipRect(
      // saveLayer so the dstIn mask composites against the colour layer only.
      child: _BlendMask(
        blendMode: BlendMode.srcOver,
        child: Stack(fit: StackFit.expand, children: [
          _region(c, left: true),
          _BlendMask(
            blendMode: BlendMode.dstIn,
            child: ColorFiltered(colorFilter: _lumaToAlpha, child: _region(c, left: false)),
          ),
        ]),
      ),
    );
  }
}
