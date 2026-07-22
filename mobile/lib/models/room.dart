class RoomModel { final int rid,onlineNum,seatCount,roomLevel; final String name,cover;
  RoomModel.fromJson(Map j): rid=j['rid']??0, name=j['roomName']??j['name']??'', cover=j['cover']??'',
    onlineNum=j['onlineNum']??0, seatCount=j['seatCount']??10, roomLevel=j['roomLevel']??0; }
