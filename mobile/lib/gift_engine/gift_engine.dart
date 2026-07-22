import 'dart:async';
import 'package:flutter/foundation.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'gift_models.dart';
import 'gift_queue.dart';

/// Special-entrance banner (Layer 5) — a VIP/noble user walking into the room.
class EntranceEvent {
  final int uid;
  final String name;
  final String avatar;
  final int nobleLevel;
  final String mount; // optional ride/mount animation url
  EntranceEvent({required this.uid, this.name = '', this.avatar = '', this.nobleLevel = 0, this.mount = ''});
}

/// The public gift engine (req 3). One entry point [receive]; it maintains:
///  • a priority queue + single "feature" slot for medium/large gifts, and
///  • up to 3 concurrent "toast" slots for small over-seat gifts,
/// so several gifts can be on screen at once (req 11) while big ones are still
/// ordered by priority (req 4/7). Combo hits bump counters, never replay (req 5).
class GiftEngine extends ChangeNotifier {
  final GiftQueue _queue = GiftQueue();
  final Map<int, GiftDef> _catalog = {}; // giftId → def, built from real gift.getGiftList

  GiftEvent? _feature;                    // current medium/large gift
  final List<GiftEvent> _toasts = [];     // concurrent small gifts (max 3)
  EntranceEvent? _entrance;
  Timer? _entranceTimer;

  GiftEvent? get feature => _feature;
  List<GiftEvent> get toasts => List.unmodifiable(_toasts);
  EntranceEvent? get entrance => _entrance;
  int get queued => _queue.length;
  bool get busy => _feature != null || _queue.isEmpty == false || _toasts.isNotEmpty;

  // ── catalog (real API data, req 8) ──────────────────────────────
  void loadCatalog(List apiGifts) {
    for (final g in apiGifts) {
      if (g is Map) {
        final d = GiftDef.fromApi(g);
        if (d.giftId != 0) _catalog[d.giftId] = d;
      }
    }
    notifyListeners();
  }

  GiftDef? defFor(int giftId) => _catalog[giftId];
  Iterable<GiftDef> get catalog => _catalog.values;

  /// Build an event from a raw socket / broadcast payload, resolving the def
  /// from the real catalog (or `unknown` → will be logged on receive).
  GiftEvent eventFromPayload(Map d, {required int roomId}) {
    final giftId = _int(d['giftId'] ?? d['gift_id'] ?? d['id']);
    final count = _int(d['num'] ?? d['count'] ?? d['combo'], def: 1);
    final def = _catalog[giftId] ?? GiftDef.unknown(giftId, '${d['name'] ?? 'Gift'}', icon: '${d['icon'] ?? ''}');
    return GiftEvent(
      def: def,
      senderUid: _int(d['fromUid'] ?? d['from_uid'] ?? d['uid']),
      senderName: '${d['fromName'] ?? d['senderName'] ?? ''}',
      senderAvatar: '${d['fromAvatar'] ?? d['avatar'] ?? ''}',
      targetUid: d['toUid'] != null ? _int(d['toUid']) : (d['to_uid'] != null ? _int(d['to_uid']) : null),
      targetName: '${d['toName'] ?? d['targetName'] ?? ''}',
      targetSeat: d['seat'] != null ? _int(d['seat']) : null,
      roomId: roomId,
      count: count < 1 ? 1 : count,
    );
  }

  /// THE entry point (req 4): socket room event / gift.send / broadcast.
  void receive(GiftEvent e) {
    // Unknown animation → log (gift_id/user_id/room_id) and never fake it (req 9).
    if (e.def.animUrl.isEmpty) {
      GiftLogger.I.logUnknown(giftId: e.def.giftId, userId: e.senderUid, roomId: e.roomId, name: e.def.name);
    }

    if (e.def.display == GiftDisplay.overSeat) {
      // small gift → concurrent toast; combo-merge if same run
      for (final t in _toasts) {
        if (t.comboKey == e.comboKey) { t.count += e.count; notifyListeners(); return; }
      }
      _toasts.add(e);
      if (_toasts.length > 3) _toasts.removeAt(0);
      notifyListeners();
      return;
    }

    // medium/large → single feature slot
    if (_feature != null && _feature!.comboKey == e.comboKey) {
      _feature!.count += e.count; // combo bump, no replay
      notifyListeners();
      return;
    }
    _queue.add(e);
    _startFeatureIfIdle();
  }

  void _startFeatureIfIdle() {
    if (_feature != null) return;
    _feature = _queue.poll();
    notifyListeners();
  }

  /// GiftStage calls this when the feature player's linger finishes.
  void completeFeature() {
    _feature = null;
    _startFeatureIfIdle();
    notifyListeners();
  }

  /// GiftStage calls this when a small toast finishes.
  void removeToast(GiftEvent e) {
    _toasts.remove(e);
    notifyListeners();
  }

  // ── special entrance (Layer 5) ──────────────────────────────────
  void showEntrance(EntranceEvent e) {
    _entrance = e;
    notifyListeners();
    _entranceTimer?.cancel();
    _entranceTimer = Timer(const Duration(milliseconds: 3200), () {
      if (_entrance == e) { _entrance = null; notifyListeners(); }
    });
  }

  void clear() {
    _queue.clear();
    _feature = null;
    _toasts.clear();
    _entrance = null;
    _entranceTimer?.cancel();
    notifyListeners();
  }

  @override
  void dispose() { _entranceTimer?.cancel(); super.dispose(); }

  static int _int(dynamic v, {int def = 0}) => v is int ? v : int.tryParse('${v ?? ''}') ?? def;
}

/// One engine instance per app (a room clears it on enter/leave).
final giftEngineProvider = ChangeNotifierProvider<GiftEngine>((ref) => GiftEngine());
