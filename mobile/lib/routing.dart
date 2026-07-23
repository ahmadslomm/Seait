import 'package:go_router/go_router.dart';
import 'screens/shell.dart';
import 'screens/wallet_screen.dart';
import 'screens/vip_screen.dart';
import 'screens/room_screen.dart';
import 'screens/cp_screen.dart';
import 'screens/level_screen.dart';
import 'screens/backpack_screen.dart';
import 'screens/guild_screen.dart';
import 'screens/agency_screen.dart';
import 'screens/tasks_screen.dart';
import 'screens/search_screen.dart';
import 'screens/gift_studio_screen.dart';

final router = GoRouter(initialLocation: '/', routes: [
  GoRoute(path: '/', builder: (c, s) => const Shell()),
  GoRoute(path: '/wallet', builder: (c, s) => const WalletScreen()),
  GoRoute(path: '/vip', builder: (c, s) => const VipScreen()),
  GoRoute(path: '/cp', builder: (c, s) => const CpScreen()),
  GoRoute(path: '/level', builder: (c, s) => const LevelScreen()),
  GoRoute(path: '/backpack', builder: (c, s) => const BackpackScreen()),
  GoRoute(path: '/guild', builder: (c, s) => const GuildScreen()),
  GoRoute(path: '/agency', builder: (c, s) => const AgencyScreen()),
  GoRoute(path: '/tasks', builder: (c, s) => const TasksScreen()),
  GoRoute(path: '/search', builder: (c, s) => const SearchScreen()),
  GoRoute(path: '/gift-studio', builder: (c, s) => const GiftStudioScreen()),
  // ?demoBanner=1 forces the decorative win plate on for QA. The flag is only
  // honoured when built with --dart-define=DEMO_TRIGGERS=true (see kDemoTriggers).
  GoRoute(path: '/room/:rid', builder: (c, s) => RoomScreen(
    rid: int.parse(s.pathParameters['rid']!),
    demoBanner: s.uri.queryParameters['demoBanner'] == '1')),
]);
