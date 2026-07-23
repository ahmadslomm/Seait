import 'dart:convert';
import 'dart:io';

import 'package:archive/archive.dart';
import 'package:crypto/crypto.dart';
import 'package:flutter/foundation.dart';
import 'package:path_provider/path_provider.dart';

/// Downloads and unpacks the decoration bundles the API points at.
///
/// `user.getUserinfo` does not return images for the decoration fields — it
/// returns CDN **zip** URLs:
///
///   infoBgImg   srcType=2 -> zip containing an .mp4 (animated profile bg)
///   avatarFrame srcType=3 -> zip containing a .pag
///   chatBubble  srcType=1 -> zip containing a bubble bundle
///
/// Bundles are ~2 MB, so they are cached on disk keyed by a hash of the URL and
/// only fetched once. Everything is best-effort: any failure returns null and
/// the caller falls back to its static rendering.
class DecorationCache {
  DecorationCache._();
  static final DecorationCache I = DecorationCache._();

  final Map<String, Future<File?>> _inflight = {};

  Future<Directory> _dir() async {
    final base = await getApplicationSupportDirectory();
    final d = Directory('${base.path}/decorations');
    if (!await d.exists()) await d.create(recursive: true);
    return d;
  }

  String _key(String url) => md5.convert(utf8.encode(url)).toString();

  /// Returns the first entry inside the bundle whose name ends with one of
  /// [extensions], written to the cache directory. Null when unavailable.
  Future<File?> fetch(String url, List<String> extensions) {
    if (!url.startsWith('http')) return Future.value(null);
    return _inflight.putIfAbsent(url, () => _fetch(url, extensions));
  }

  Future<File?> _fetch(String url, List<String> extensions) async {
    try {
      final dir = await _dir();
      final key = _key(url);

      // already unpacked?
      for (final ext in extensions) {
        final f = File('${dir.path}/$key$ext');
        if (await f.exists() && await f.length() > 0) return f;
      }

      final client = HttpClient()..connectionTimeout = const Duration(seconds: 20);
      final req = await client.getUrl(Uri.parse(url));
      final res = await req.close();
      if (res.statusCode != 200) {
        debugPrint('[decoration] HTTP ${res.statusCode} for $url');
        return null;
      }
      final bytes = await consolidateHttpClientResponseBytes(res);
      client.close();

      final archive = ZipDecoder().decodeBytes(bytes);
      for (final entry in archive) {
        if (!entry.isFile) continue;
        final name = entry.name.toLowerCase();
        for (final ext in extensions) {
          if (name.endsWith(ext)) {
            final out = File('${dir.path}/$key$ext');
            await out.writeAsBytes(entry.content as List<int>, flush: true);
            debugPrint('[decoration] unpacked ${entry.name} -> ${out.path}');
            return out;
          }
        }
      }
      debugPrint('[decoration] no ${extensions.join("/")} inside $url');
      return null;
    } catch (e) {
      debugPrint('[decoration] failed $url: $e');
      return null;
    }
  }
}
