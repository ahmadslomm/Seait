import 'package:socket_io_client/socket_io_client.dart' as io;
import 'config.dart';

/// Client for the backend Room Engine (/room namespace).
///
/// Mirrors the gateway one-for-one: presence, seats, mic, chat and moderation.
/// Every request carries the acting uid so the server can enforce permissions —
/// the client never decides what it is allowed to do, it only asks and reacts to
/// an `action_denied` reply.
class RoomSocket {
  io.Socket? _s;
  bool get connected => _s?.connected ?? false;

  void connect() {
    _s = io.io('${Cfg.wsBase}/room',
        io.OptionBuilder().setTransports(['websocket']).enableForceNew().build());
    _s!.connect();
  }

  // ── presence ────────────────────────────────────────────────────
  void join(int rid, int uid, {int seatCount = 10}) =>
      _emit('room_join', {'rid': rid, 'uid': uid, 'seatCount': seatCount});
  void leave(int rid, int uid) => _emit('room_leave', {'rid': rid, 'uid': uid});
  void requestUsers(int rid) => _emit('users_list', {'rid': rid});

  // ── seats ───────────────────────────────────────────────────────
  void takeSeat(int rid, int seatNo, int uid) =>
      _emit('seat_update', {'rid': rid, 'seatNo': seatNo, 'uid': uid});

  /// Stand up. [targetUid] lets staff remove someone else.
  void leaveSeat(int rid, int uid, {int? targetUid}) =>
      _emit('seat_leave', {'rid': rid, 'uid': uid, 'targetUid': targetUid ?? uid});

  /// Move to another seat. [targetUid] lets staff move someone else.
  void moveSeat(int rid, int uid, int toSeat, {int? targetUid}) =>
      _emit('seat_move', {'rid': rid, 'uid': uid, 'toSeat': toSeat, 'targetUid': targetUid ?? uid});

  void lockSeat(int rid, int uid, int seatNo, bool lock) =>
      _emit('seat_lock', {'rid': rid, 'uid': uid, 'seatNo': seatNo, 'lock': lock ? 1 : 0});

  // ── mic ─────────────────────────────────────────────────────────
  void setMic(int rid, int seatNo, int micState, int uid) =>
      _emit('mic_status', {'rid': rid, 'seatNo': seatNo, 'micState': micState, 'uid': uid});
  void setSpeaking(int rid, int seatNo, bool speaking) =>
      _emit('speaking', {'rid': rid, 'seatNo': seatNo, 'speaking': speaking});
  void requestMic(int rid, int uid, {int seatNo = -1}) =>
      _emit('mic_request', {'rid': rid, 'uid': uid, 'seatNo': seatNo});

  // ── chat / gifts ────────────────────────────────────────────────
  void chat(int rid, int uid, String text) =>
      _emit('chat', {'rid': rid, 'uid': uid, 'text': text});
  void sendGift(int rid, int fromUid, int toUid, int giftId, int num, int price) =>
      _emit('send_gift', {'rid': rid, 'fromUid': fromUid, 'toUid': toUid, 'giftId': giftId, 'num': num, 'price': price});

  // ── moderation (requests; the server decides) ───────────────────
  void muteUser(int rid, int uid, int targetUid, bool mute) =>
      _emit('mute_user', {'rid': rid, 'uid': uid, 'targetUid': targetUid, 'mute': mute ? 1 : 0});
  void kickUser(int rid, int uid, int targetUid) =>
      _emit('kick_user', {'rid': rid, 'uid': uid, 'targetUid': targetUid});
  void setAdmin(int rid, int uid, int targetUid, bool admin) =>
      _emit('set_admin', {'rid': rid, 'uid': uid, 'targetUid': targetUid, 'admin': admin ? 1 : 0});

  void on(String ev, Function(dynamic) cb) => _s?.on(ev, cb);
  void _emit(String ev, Map<String, dynamic> data) => _s?.emit(ev, data);
  void dispose() { try { _s?.dispose(); } catch (_) {} _s = null; }
}
