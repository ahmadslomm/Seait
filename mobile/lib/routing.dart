import 'package:go_router/go_router.dart';
import 'screens/shell.dart';
import 'screens/wallet_screen.dart';
import 'screens/vip_screen.dart';
import 'screens/room_screen.dart';
final router = GoRouter(initialLocation:'/', routes:[
  GoRoute(path:'/', builder:(c,s)=>const Shell()),
  GoRoute(path:'/wallet', builder:(c,s)=>const WalletScreen()),
  GoRoute(path:'/vip', builder:(c,s)=>const VipScreen()),
  GoRoute(path:'/room/:rid', builder:(c,s)=>RoomScreen(rid:int.parse(s.pathParameters['rid']!))),
]);
