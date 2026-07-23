import 'core/media.dart';
import 'package:flutter/foundation.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'core/api.dart';
import 'core/config.dart';
import 'core/asset_registry.dart';
import 'models/user.dart';
import 'models/room.dart';

/// Generic: call ANY action from any screen. Unknown actions return empty and the
/// backend fallback-logger records them (request+fields) — nothing is mocked/guessed.
/// Immutable, value-equal key for [actionProvider].
///
/// Riverpod compares family keys with `==`. A record holding a `Map` literal is
/// NEVER equal to itself across rebuilds, so watching one during `build` spawns
/// a brand-new provider every frame that restarts loading and never resolves —
/// the screen sits on its spinner forever. This type collapses the call to a
/// canonical string so the same request always yields the same key.
@immutable
class ApiCall {
  final String action;
  final Map<String, dynamic> params;
  final String _key;

  ApiCall(this.action, [Map<String, dynamic>? params])
      : params = Map<String, dynamic>.unmodifiable(params ?? const <String, dynamic>{}),
        _key = _canonical(action, params ?? const <String, dynamic>{});

  static String _canonical(String action, Map<String, dynamic> p) {
    final keys = p.keys.toList()..sort();
    return '$action?${keys.map((k) => '$k=${p[k]}').join('&')}';
  }

  @override
  bool operator ==(Object other) => other is ApiCall && other._key == _key;
  @override
  int get hashCode => _key.hashCode;
  @override
  String toString() => 'ApiCall($_key)';
}

/// Generic: call ANY action. Keyed by [ApiCall] so repeated builds reuse the
/// same provider instance instead of re-creating it.
final actionProvider = FutureProvider.family<dynamic, ApiCall>((ref, c) async {
  return ref.read(apiProvider).call(c.action, params: c.params);
});

/// Profile / Wallet / VIP / Noble / Wealth / CP / Guild all come from user.getUserinfo.
final meProvider = FutureProvider<UserModel>((ref) async {
  final d = await ref.read(apiProvider).call('user.getUserinfo', params: {'uid': Cfg.myUid, 'toUid': Cfg.myUid});
  return UserModel.fromJson(d as Map);
});

/// Home rooms — room.getRecommendRoomV2.
final roomsProvider = FutureProvider<List<RoomModel>>((ref) async {
  final d = await ref.read(apiProvider).call('room.getRecommendRoomV2', params: {'page': 1});
  final list = (d is Map ? d['list'] : d) as List? ?? [];
  return list.map((e) => RoomModel.fromJson(e as Map)).toList();
});

/// Live room record for a given rid, taken from the same recommend feed the
/// original client uses. Everything the room renders (seat count, backdrop,
/// title, lock state) comes from here — nothing is hardcoded in the UI.
final roomInfoProvider = FutureProvider.family<Map, int>((ref, rid) async {
  final d = await ref.read(apiProvider).call('room.getRecommendRoomV2', params: {'page': 1});
  final list = (d is Map ? d['list'] : d) as List? ?? [];
  for (final r in list) {
    if (r is Map && int.tryParse('${r['rid']}') == rid) return r;
  }
  return const {};
});

/// Any user's profile, keyed by uid. Keyed by an int on purpose: family keys are
/// compared with ==, and a Map literal is never equal to itself across rebuilds,
/// so keying on a params map would re-create the provider every frame and never
/// resolve.
final userInfoProvider = FutureProvider.family<Map, int>((ref, uid) async {
  final d = await ref.read(apiProvider).call('user.getUserinfo', params: {'uid': uid, 'toUid': uid});
  return (d is Map) ? d : const {};
});

/// Server-driven art overrides — app.getThemeAssets.
///
/// Returns {logicalKey: path} plus `assetBase`. Applying it re-points any asset
/// slot with no code change, which is how the Theme/Background Manager will
/// deliver skins. assetBase is installed into [Media] FIRST, because every
/// relative path in the map — and every image field in every other response —
/// is resolved against it; applying overrides before the base would produce
/// urls pointing at the wrong host for one frame.
final assetOverridesProvider = FutureProvider<Map<String, dynamic>>((ref) async {
  try {
    final d = await ref.read(apiProvider).call('app.getThemeAssets');
    final m = (d is Map) ? Map<String, dynamic>.from(d) : <String, dynamic>{};
    Media.setBase(m['assetBase'] as String?);
    m.remove('assetBase'); // a base is not an art slot
    if (m.isNotEmpty) Assets.applyOverrides(m);
    return m;
  } catch (_) {
    return <String, dynamic>{};
  }
});

/// Gifts — gift.getGiftList.
final giftsProvider = FutureProvider<List>((ref) async {
  final d = await ref.read(apiProvider).call('gift.getGiftList');
  return (d as List?) ?? [];
});

/// Ranking — gift.songGiftRank (real handler).
final rankProvider = FutureProvider<List>((ref) async {
  final d = await ref.read(apiProvider).call('gift.songGiftRank', params: {'type': 'gift'});
  return (d as List?) ?? [];
});
