import 'dart:io';
import 'package:flutter/foundation.dart';
import 'package:path_provider/path_provider.dart';

/// ── Priority (req 7) ──────────────────────────────────────────────
/// NORMAL < RARE < VIP < LEGENDARY < SUPER. Higher rank plays first and
/// can pre-empt a lower-priority animation that is queued behind it.
enum GiftPriority { normal, rare, vip, legendary, sup }

extension GiftPriorityX on GiftPriority {
  int get rank => index;
  String get label => this == GiftPriority.sup ? 'SUPER' : name.toUpperCase();
}

/// How the gift is staged on screen (req 5).
///  overSeat    → small gift: floats above the receiver's seat 2-3s
///  avatarAnim  → medium gift: sender avatar + animation band
///  fullscreen  → large gift: full-screen overlay
enum GiftDisplay { overSeat, avatarAnim, fullscreen }

/// Which renderer handles the file (req 4).
enum GiftRenderer { svga, pag, image, video }

/// A gift definition — built ONLY from real `gift.getGiftList` API rows.
/// Priority / display / duration are *derived* deterministically from the
/// real fields (price, fullscreen, anim_url) so no model/API change is needed.
@immutable
class GiftDef {
  final int giftId;
  final String name;
  final String icon;      // static thumbnail
  final String animUrl;   // svga/pag/mp4 — asset path or http url ('' → unknown)
  final GiftRenderer renderer;
  final GiftPriority priority;
  final GiftDisplay display;
  final int level;        // combo escalation tier (1-7 for bombs)
  final int durationMs;
  final bool combo;       // can be combo-stacked (x2 x3 …)
  final int price;
  final int coinType;

  const GiftDef({
    required this.giftId,
    required this.name,
    required this.icon,
    required this.animUrl,
    required this.renderer,
    required this.priority,
    required this.display,
    required this.level,
    required this.durationMs,
    required this.combo,
    required this.price,
    required this.coinType,
  });

  bool get hasAnimation => animUrl.isNotEmpty && renderer != GiftRenderer.image;

  /// Normalised asset/network key for the current project's asset convention
  /// (registered as `assets/...`). http urls pass through unchanged.
  String get resolvedUrl {
    final p = animUrl;
    if (p.isEmpty) return p;
    if (p.startsWith('http')) return p;
    // legacy '../assets/..' keys normalise to the in-project 'assets/..' key
    if (p.startsWith('../')) return p.substring(3);
    return p;
  }

  /// Build from a real API gift row (fields: gift_id,name,icon,price,
  /// coin_type,category,anim_type,anim_url,fullscreen).
  factory GiftDef.fromApi(Map j) {
    final id = _int(j['gift_id'] ?? j['giftId'] ?? j['id']);
    final name = '${j['name'] ?? ''}';
    final icon = '${j['icon'] ?? ''}';
    final url = '${j['anim_url'] ?? j['animation_url'] ?? ''}';
    final price = _int(j['price']);
    final coinType = _int(j['coin_type'] ?? j['coinType'], def: 1);
    final fullscreen = j['fullscreen'] == true || j['fullscreen'] == 1;
    final animType = _int(j['anim_type'] ?? j['animation_type']);

    final renderer = _rendererFor(url, animType);
    final priority = _priorityFor(price, fullscreen, renderer);
    final display = fullscreen
        ? GiftDisplay.fullscreen
        : (renderer != GiftRenderer.image && price >= 200 ? GiftDisplay.avatarAnim : GiftDisplay.overSeat);
    final duration = switch (display) {
      GiftDisplay.fullscreen => 5200,
      GiftDisplay.avatarAnim => 3500,
      GiftDisplay.overSeat => 2500,
    };
    return GiftDef(
      giftId: id, name: name, icon: icon, animUrl: url, renderer: renderer,
      priority: priority, display: display, level: _levelFor(price),
      durationMs: duration, combo: true, price: price, coinType: coinType,
    );
  }

  /// Placeholder for a gift whose animation is missing — it is *logged*
  /// (unknown-gifts.log) and shown only as a small floating icon (never faked).
  factory GiftDef.unknown(int id, String name, {String icon = ''}) => GiftDef(
        giftId: id, name: name, icon: icon, animUrl: '', renderer: GiftRenderer.image,
        priority: GiftPriority.normal, display: GiftDisplay.overSeat, level: 1,
        durationMs: 2200, combo: true, price: 0, coinType: 1,
      );

  static GiftRenderer _rendererFor(String url, int animType) {
    final u = url.toLowerCase();
    if (u.endsWith('.svga')) return GiftRenderer.svga;
    if (u.endsWith('.pag')) return GiftRenderer.pag;
    if (u.endsWith('.mp4') || u.endsWith('.webm')) return GiftRenderer.video;
    if (u.endsWith('.png') || u.endsWith('.webp') || u.endsWith('.gif')) return GiftRenderer.image;
    // fall back to the numeric hint: 1=svga 2=pag 3=mp4
    return switch (animType) { 1 => GiftRenderer.svga, 2 => GiftRenderer.pag, 3 => GiftRenderer.video, _ => GiftRenderer.image };
  }

  static GiftPriority _priorityFor(int price, bool fullscreen, GiftRenderer r) {
    if (price >= 15000) return GiftPriority.sup;
    if (fullscreen || price >= 5000) return GiftPriority.legendary;
    if (price >= 1000) return GiftPriority.vip;
    if (price >= 100 || r != GiftRenderer.image) return GiftPriority.rare;
    return GiftPriority.normal;
  }

  static int _levelFor(int price) {
    if (price >= 15000) return 7;
    if (price >= 9999) return 6;
    if (price >= 5000) return 5;
    if (price >= 1000) return 4;
    if (price >= 520) return 3;
    if (price >= 99) return 2;
    return 1;
  }

  static int _int(dynamic v, {int def = 0}) => v is int ? v : int.tryParse('${v ?? ''}') ?? def;
}

/// A runtime gift event coming from the socket / gift.send / broadcast (req 4).
class GiftEvent {
  final GiftDef def;
  final int senderUid;
  final String senderName;
  final String senderAvatar;
  final int? targetUid;    // null = whole room / self
  final String targetName;
  final int? targetSeat;   // seat index for over-seat placement
  final int roomId;
  final DateTime ts;

  /// Mutable combo state (req 5): a repeat of the same (sender,gift,target)
  /// does NOT replay — it bumps [count].
  int count;

  GiftEvent({
    required this.def,
    required this.senderUid,
    this.senderName = '',
    this.senderAvatar = '',
    this.targetUid,
    this.targetName = '',
    this.targetSeat,
    required this.roomId,
    this.count = 1,
    DateTime? ts,
  }) : ts = ts ?? DateTime.now();

  /// Combo identity — same key = same combo run.
  String get comboKey => '$roomId:$senderUid:${def.giftId}:${targetUid ?? 0}';

  GiftPriority get priority => def.priority;
}

/// Unknown-gift logger (req 9). When a gift has no animation_url it is recorded
/// with gift_id / user_id / room_id — never mocked.
class GiftLogger {
  GiftLogger._();
  static final GiftLogger I = GiftLogger._();
  File? _file;

  Future<File?> _f() async {
    if (_file != null) return _file;
    try {
      final dir = await getApplicationDocumentsDirectory();
      _file = File('${dir.path}/unknown-gifts.log');
      return _file;
    } catch (_) {
      return null; // e.g. running without plugin — still debugPrints below
    }
  }

  Future<void> logUnknown({required int giftId, required int userId, required int roomId, String name = ''}) async {
    final line = '${DateTime.now().toIso8601String()}\tgift_id=$giftId\tuser_id=$userId\troom_id=$roomId\tname=$name';
    debugPrint('[UNKNOWN-GIFT] $line');
    try {
      final f = await _f();
      await f?.writeAsString('$line\n', mode: FileMode.append, flush: true);
    } catch (_) {}
  }
}
