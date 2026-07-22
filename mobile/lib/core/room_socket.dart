import 'package:socket_io_client/socket_io_client.dart' as io;
import 'config.dart';

/// Client for the backend Room Engine (/room namespace) — real-time seats/gifts/chat.
class RoomSocket {
  late io.Socket _s;
  void connect() { _s = io.io('${Cfg.wsBase}/room', io.OptionBuilder().setTransports(['websocket']).enableForceNew().build()); _s.connect(); }
  void join(int rid, int uid, {int seatCount = 10}) => _s.emit('room_join', {'rid': rid, 'uid': uid, 'seatCount': seatCount});
  void takeSeat(int rid, int seatNo, int uid) => _s.emit('seat_update', {'rid': rid, 'seatNo': seatNo, 'uid': uid});
  void setMic(int rid, int seatNo, int micState) => _s.emit('mic_status', {'rid': rid, 'seatNo': seatNo, 'micState': micState});
  void sendGift(int rid, int fromUid, int toUid, int giftId, int num, int price) =>
      _s.emit('send_gift', {'rid': rid, 'fromUid': fromUid, 'toUid': toUid, 'giftId': giftId, 'num': num, 'price': price});
  void chat(int rid, int uid, String text) => _s.emit('chat', {'rid': rid, 'uid': uid, 'text': text});
  void on(String ev, Function(dynamic) cb) => _s.on(ev, cb);
  void dispose() { try { _s.dispose(); } catch (_) {} }
}
