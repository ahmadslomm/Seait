import 'package:flutter/foundation.dart';

/// Single source of truth for every bundled art asset.
///
/// Screens must resolve art through [Assets.of] rather than writing
/// `'assets/ui/foo.webp'` inline. Two reasons:
///
///  * one place to see what art exists and what each slot is for;
///  * the server can override any slot at runtime — call [Assets.applyOverrides]
///    with a `{logicalKey: url}` map (e.g. from a future Theme/Background
///    Manager) and every screen picks up the new art with no code change.
///
/// A slot resolves in this order: server override -> bundled asset -> null
/// (callers fall back to their own placeholder).
class Assets {
  Assets._();

  /// Bundled defaults. Keys are LOGICAL names, never file paths.
  static const Map<String, String> _bundled = {
    // profile / identity
    'vip.crest.5': 'assets/ui/vip_crest_5.webp',
    'vip.wordmark.5': 'assets/ui/vip_text_5.webp',
    'vip.medallion': 'assets/ui/vip_medallion.png',
    'wallet.card.coins': 'assets/ui/card_coins_bg.webp',
    'wallet.card.diamonds': 'assets/ui/card_diamonds_bg.webp',
    'icon.coin': 'assets/ui/coin_icon.png',
    'icon.diamond': 'assets/ui/diamond_icon.png',
    'icon.coin.z': 'assets/ui/coin_z.webp',

    'medal.1': 'assets/ui/medal_1.webp',
    'medal.2': 'assets/ui/medal_2.webp',
    'medal.3': 'assets/ui/medal_3.webp',
    'medal.4': 'assets/ui/medal_4.webp',
    'medal.5': 'assets/ui/medal_5.webp',
    'noble.1': 'assets/ui/noble_1.webp',
    'noble.2': 'assets/ui/noble_2.webp',
    'noble.3': 'assets/ui/noble_3.webp',
    'noble.4': 'assets/ui/noble_4.webp',
    'noble.5': 'assets/ui/noble_5.webp',
    'noble.6': 'assets/ui/noble_6.webp',
    'noble.7': 'assets/ui/noble_7.webp',

    // Me grid
    'menu.store': 'assets/ui/menu_store.webp',
    'menu.task': 'assets/ui/menu_task.webp',
    'menu.checkin': 'assets/ui/menu_checkin.webp',
    'menu.backpack': 'assets/ui/menu_backpack.webp',

    // bottom navigation (selected / idle)
    'nav.home': 'assets/ui/nav_home.webp',
    'nav.home.off': 'assets/ui/nav_home_off.webp',
    'nav.moment': 'assets/ui/nav_moment.webp',
    'nav.moment.off': 'assets/ui/nav_moment_off.webp',
    'nav.live': 'assets/ui/nav_live.webp',
    'nav.live.off': 'assets/ui/nav_live_off.webp',
    'nav.message': 'assets/ui/nav_message.webp',
    'nav.message.off': 'assets/ui/nav_message_off.webp',
    'nav.me': 'assets/ui/nav_me.webp',
    'nav.me.off': 'assets/ui/nav_me_off.webp',

    // room decoration
    'room.banner.gold': 'assets/ui/banner_gold.webp',
    'room.times.100': 'assets/ui/times_100.webp',
    'room.luckybag': 'assets/ui/lucky_bag.webp',
    'room.throne': 'assets/ui/throne_purple.webp',
    'room.gift.box': 'assets/ui/gift_box.webp',

    // room backdrops, keyed by theme name (not by index)
    'room.bg.arabian': 'assets/ui/room_bg_arabian.webp',
    'room.bg.galaxy': 'assets/ui/room_bg_galaxy.webp',
    'room.bg.stage': 'assets/ui/room_bg_stage.webp',

    // profile header decoration (see docs/ANIMATED_HEADER.md)
    'header.deco': 'assets/ui/header_deco_vip5.webp',
  };

  /// Server-supplied overrides: logical key -> http url.
  static Map<String, String> _overrides = const {};

  /// Feed this from the backend (e.g. a theme/background manager payload).
  /// Keys not present simply keep their bundled default.
  static void applyOverrides(Map<String, dynamic> m) {
    _overrides = {
      for (final e in m.entries)
        if (e.value is String && (e.value as String).isNotEmpty) e.key: e.value as String,
    };
    debugPrint('[assets] ${_overrides.length} override(s) applied');
  }

  /// Resolve a slot. Returns an http url (override) or a bundled asset key,
  /// or null when the slot is unknown — callers then use their own placeholder.
  static String? of(String key) => _overrides[key] ?? _bundled[key];

  /// True when the resolved value is a network url rather than a bundled asset.
  static bool isRemote(String? v) => v != null && v.startsWith('http');

  /// Room backdrop for a theme name coming from room data. Unknown themes fall
  /// back to the first bundled backdrop rather than throwing.
  static String? roomBackdrop(String theme) =>
      of('room.bg.$theme') ?? of('room.bg.arabian');

  /// All logical keys, for diagnostics / a future admin screen.
  static Iterable<String> get keys => _bundled.keys;
}
