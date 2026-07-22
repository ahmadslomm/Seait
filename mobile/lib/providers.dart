import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'core/api.dart';
import 'core/config.dart';
import 'models/user.dart';
import 'models/room.dart';
/// Profile — REAL user.getUserinfo
final meProvider = FutureProvider<UserModel>((ref) async {
  final d = await ref.read(apiProvider).call('user.getUserinfo', params:{'uid':Cfg.myUid,'toUid':Cfg.myUid});
  return UserModel.fromJson(d as Map);
});
/// Home rooms — REAL room.getRecommendRoomV2
final roomsProvider = FutureProvider<List<RoomModel>>((ref) async {
  final d = await ref.read(apiProvider).call('room.getRecommendRoomV2', params:{'page':1});
  final list = (d is Map ? d['list'] : d) as List? ?? [];
  return list.map((e)=>RoomModel.fromJson(e as Map)).toList();
});
