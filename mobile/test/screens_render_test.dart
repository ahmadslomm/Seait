import 'dart:io';
import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import 'package:seait/core/theme.dart';
import 'package:seait/screens/me_screen.dart';
import 'package:seait/screens/home_screen.dart';
import 'package:seait/screens/wallet_screen.dart';
import 'package:seait/screens/vip_screen.dart';
import 'package:seait/screens/cp_screen.dart';
import 'package:seait/screens/level_screen.dart';
import 'package:seait/screens/backpack_screen.dart';
import 'package:seait/screens/guild_screen.dart';
import 'package:seait/screens/agency_screen.dart';
import 'package:seait/screens/tasks_screen.dart';
import 'package:seait/screens/search_screen.dart';
import 'package:seait/screens/live_screen.dart';
import 'package:seait/screens/message_screen.dart';
import 'package:seait/screens/moment_screen.dart';
import 'package:seait/screens/room_screen.dart';
import 'package:seait/screens/gift_studio_screen.dart';

/// Renders every screen at real phone size against the REAL backend and writes
/// PNGs to test/screenshots/. Run with:
///   flutter test --update-goldens test/screens_render_test.dart \
///     --dart-define=API_BASE=http://127.0.0.1:8077 --dart-define=WS_BASE=http://127.0.0.1:8077
///
/// HttpOverrides.global = null restores real networking (flutter_test stubs it
/// out by default), so these are genuine API-backed renders — no mock data.
void main() {
  setUpAll(() {
    HttpOverrides.global = null;
  });

  Future<void> shoot(WidgetTester tester, String name, Widget screen) async {
    tester.view.physicalSize = const Size(1080, 2340);
    tester.view.devicePixelRatio = 3.0;
    addTearDown(tester.view.reset);

    await tester.pumpWidget(ProviderScope(
      child: MaterialApp(
        debugShowCheckedModeBanner: false,
        theme: ZTheme.dark,
        home: screen,
        // a router is present so context.push() targets resolve if tapped
        builder: (c, child) => child ?? const SizedBox(),
      ),
    ));
    // runAsync lets REAL network I/O + image decoding progress (flutter_test's
    // fake-async clock would otherwise never let dio complete).
    await tester.runAsync(() async {
      await Future.delayed(const Duration(seconds: 3));
    });
    await tester.pump();
    await tester.pump(const Duration(milliseconds: 400));
    await tester.runAsync(() async {
      await Future.delayed(const Duration(milliseconds: 800));
    });
    await tester.pump();
    await tester.pump(const Duration(milliseconds: 400));
    await expectLater(find.byType(MaterialApp), matchesGoldenFile('screenshots/$name.png'));
  }

  testWidgets('me', (t) => shoot(t, '01_me', const MeScreen()));
  testWidgets('home', (t) => shoot(t, '02_home', const HomeScreen()));
  testWidgets('wallet', (t) => shoot(t, '03_wallet', const WalletScreen()));
  testWidgets('vip', (t) => shoot(t, '04_vip', const VipScreen()));
  testWidgets('cp', (t) => shoot(t, '05_cp', const CpScreen()));
  testWidgets('level', (t) => shoot(t, '06_level', const LevelScreen()));
  testWidgets('backpack', (t) => shoot(t, '07_backpack', const BackpackScreen()));
  testWidgets('guild', (t) => shoot(t, '08_guild', const GuildScreen()));
  testWidgets('agency', (t) => shoot(t, '09_agency', const AgencyScreen()));
  testWidgets('tasks', (t) => shoot(t, '10_tasks', const TasksScreen()));
  testWidgets('search', (t) => shoot(t, '11_search', const SearchScreen()));
  testWidgets('live', (t) => shoot(t, '12_live', const LiveScreen()));
  testWidgets('message', (t) => shoot(t, '13_message', const MessageScreen()));
  testWidgets('moment', (t) => shoot(t, '14_moment', const MomentScreen()));
  testWidgets('room', (t) => shoot(t, '15_room', const RoomScreen(rid: 1)));
  testWidgets('gift studio', (t) => shoot(t, '16_gift_studio', const GiftStudioScreen()));
}
