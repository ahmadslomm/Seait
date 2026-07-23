import 'config.dart';

/// Turns whatever the API returns for an image field into something loadable.
///
/// Catalogue rows, avatars and theme overrides all store RELATIVE paths
/// (`ui/medal_1.webp`, `svga/userspace/waitio_VIP1ma.svga`) so the same database
/// works behind any host. The client joins them to the `assetBase` handed out by
/// `app.getConfig`. Absolute urls are passed through untouched, because some
/// fields legitimately point at third-party CDNs.
///
/// Every widget that renders an API-supplied image must go through [url];
/// passing a raw field to CachedNetworkImage works only for absolute urls and
/// fails silently — an empty box — for everything else.
class Media {
  Media._();

  /// Set from `app.getConfig`. Defaults to the API host's /assets/ so images
  /// still resolve before config arrives.
  static String _base = '${Cfg.apiBase}/assets/';

  static void setBase(String? assetBase) {
    if (assetBase == null || assetBase.isEmpty) return;
    // A relative base ("/assets/") is relative to the API host; an absolute one
    // is a CDN and replaces the host entirely.
    final b = assetBase.startsWith('http')
        ? assetBase
        : '${Cfg.apiBase}${assetBase.startsWith('/') ? '' : '/'}$assetBase';
    _base = b.endsWith('/') ? b : '$b/';
  }

  static String get base => _base;

  /// Absolute url for an API image field, or null when there is nothing to show.
  /// Returning null rather than an empty string matters: callers branch on null
  /// to render their placeholder, and CachedNetworkImage throws on ''.
  static String? url(String? path) {
    if (path == null) return null;
    final p = path.trim();
    if (p.isEmpty) return null;
    if (p.startsWith('http://') || p.startsWith('https://')) return p;
    // Bundled asset keys are resolved by the widget layer, not here.
    if (p.startsWith('assets/')) return null;
    return '$_base${p.startsWith('/') ? p.substring(1) : p}';
  }

  /// Convenience for the common `x.isNotEmpty ? Net(x) : placeholder` pattern.
  static bool has(String? path) => url(path) != null;
}
