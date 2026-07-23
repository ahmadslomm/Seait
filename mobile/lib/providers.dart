import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'core/api.dart';
import 'core/config.dart';
import 'models/user.dart';
import 'models/room.dart';

/// Generic: call ANY action from any screen. Unknown actions return empty and the
/// backend fallback-logger records them (request+fields) — nothing is mocked/guessed.
final actionProvider = FutureProvider.family<dynamic, ({String action, Map<String, dynamic> params})>((ref, a) async {
  return ref.read(apiProvider).call(a.action, params: a.params);
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
