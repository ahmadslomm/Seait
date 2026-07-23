/// A room as the API returns it.
///
/// The room-list actions (LiveRoom.recommend, room.getRecommendRoomV*,
/// discoverRoom, getCountryRoomList*) all share one shape from the backend, so
/// one model covers every list screen. Owner fields are present only on the
/// list endpoints that join the owner, hence the empty defaults.
class RoomModel {
  final int rid, onlineNum, seatCount, roomLevel;
  final String name, cover, country, ownerNick, ownerAvatar;

  RoomModel.fromJson(Map j)
    : rid = int.tryParse('${j['rid'] ?? 0}') ?? 0,
      name = '${j['roomName'] ?? j['name'] ?? ''}',
      cover = '${j['cover'] ?? j['roomImg'] ?? ''}',
      onlineNum = int.tryParse('${j['onlineNum'] ?? 0}') ?? 0,
      seatCount = int.tryParse('${j['seatCount'] ?? 10}') ?? 10,
      roomLevel = int.tryParse('${j['roomLevel'] ?? 0}') ?? 0,
      country = '${j['country'] ?? ''}',
      ownerNick = '${j['owner_nick'] ?? ''}',
      ownerAvatar = '${j['owner_avatar'] ?? ''}';
}
