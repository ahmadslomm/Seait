import os
R="/root/Seait/mobile"
def w(p,c):
    f=os.path.join(R,p); os.makedirs(os.path.dirname(f),exist_ok=True); open(f,"w").write(c.lstrip("\n"))

w("pubspec.yaml","""
name: seait
description: Seait — modern voice-social app (== com.waig.nalo / ZaffaLive), real API.
publish_to: none
environment: { sdk: ">=3.3.0 <4.0.0" }
dependencies:
  flutter: { sdk: flutter }
  flutter_riverpod: ^2.5.1
  go_router: ^14.0.0
  dio: ^5.4.0
  crypto: ^3.0.3
  socket_io_client: ^2.0.3
  cached_network_image: ^3.3.1
  google_fonts: ^6.2.1
flutter:
  uses-material-design: true
  assets: [ ../assets/svga/, ../assets/pag/, ../assets/images/ ]
""")
w("lib/main.dart","""
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'core/theme.dart';
import 'routing.dart';
void main()=>runApp(const ProviderScope(child: SeaitApp()));
class SeaitApp extends StatelessWidget { const SeaitApp({super.key});
  @override Widget build(BuildContext c)=>MaterialApp.router(title:'Seait',debugShowCheckedModeBanner:false,theme:ZTheme.dark,routerConfig:router); }
""")
# ---- theme (from real screenshots) ----
w("lib/core/theme.dart","""
import 'package:flutter/material.dart';
import 'package:google_fonts/google_fonts.dart';
class ZC {
  static const bg       = Color(0xFF1A0B2E);   // deep purple base
  static const bg2      = Color(0xFF241238);
  static const card     = Color(0xFF2A1A44);
  static const nav      = Color(0xFF2B1650);
  static const purple   = Color(0xFF7B2FF7);
  static const purple2  = Color(0xFFA24BFF);
  static const gold     = Color(0xFFE9B949);
  static const gold2    = Color(0xFFFFD76A);
  static const coin     = Color(0xFFF2C14E);
  static const diamond  = Color(0xFFB57BFF);
  static const textHi   = Color(0xFFFFFFFF);
  static const textLo   = Color(0xFFB9AEDA);
  static const vipGrad  = LinearGradient(colors:[Color(0xFF7B2FF7),Color(0xFF9D4EDD)]);
  static const coinGrad = LinearGradient(colors:[Color(0xFFFFE08A),Color(0xFFE9B949)]);
  static const diaGrad  = LinearGradient(colors:[Color(0xFFC9A7FF),Color(0xFF9D6BFF)]);
}
class ZTheme {
  static ThemeData get dark => ThemeData(
    useMaterial3:true, brightness:Brightness.dark, scaffoldBackgroundColor:ZC.bg,
    colorScheme: const ColorScheme.dark(primary:ZC.purple, secondary:ZC.gold, surface:ZC.card),
    textTheme: GoogleFonts.cairoTextTheme(ThemeData.dark().textTheme),
  );
}
""")
# ---- crypto (Dart, matches backend/original) ----
w("lib/core/crypto.dart","""
import 'dart:convert';
import 'package:crypto/crypto.dart';
class ZCrypto {
  static const pkg='com.waig.nalo';
  static final List<int> _key = ascii.encode(md5.convert(utf8.encode(pkg)).toString());
  static List<int> _xor(List<int> d)=>List<int>.generate(d.length,(i)=>d[i]^_key[i%_key.length]);
  static String encrypt(String j)=>base64.encode(_xor(utf8.encode(j)));
  static String decrypt(String b){ var s=Uri.decodeComponent(b).replaceAll('_','/'); while(s.length%4!=0){s+='=';} return utf8.decode(_xor(base64.decode(s)),allowMalformed:true); }
}
""")
w("lib/core/config.dart","""
class Cfg {
  // Seait backend (api.php gateway). Emulator host = 10.0.2.2.
  static const apiBase = String.fromEnvironment('API_BASE', defaultValue:'http://10.0.2.2:8080');
  static const wsBase  = String.fromEnvironment('WS_BASE',  defaultValue:'http://10.0.2.2:8080');
  static const myUid   = 1278472; // real seeded account
}
""")
# ---- api client (real protocol) ----
w("lib/core/api.dart","""
import 'dart:convert';
import 'package:dio/dio.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'crypto.dart';
import 'config.dart';
class ApiException implements Exception { final String message; ApiException(this.message); }
class Api {
  final Dio _dio; String token; int uid;
  Api({this.token='', this.uid=Cfg.myUid, Dio? dio})
    : _dio = dio ?? Dio(BaseOptions(baseUrl:Cfg.apiBase, headers:{'User-Agent':'okhttp/4.12.0'}));
  Map<String,dynamic> _payload(String action, Map<String,dynamic> p)=>{
    'action':action,'token':token,'uid':uid,'_login_uid':uid,'lang':'ar','deviceid':'seait-dev',
    'ua':'Android_version=1.21.150;system=11;bundleId=com.waig.nalo', ...p };
  /// Real api.php call: encrypt request -> POST -> decrypt {response_status,response_data}.
  Future<dynamic> call(String action,{Map<String,dynamic> params=const{}}) async {
    final body='app_id=com.waig.nalo&http_body=' + ZCrypto.encrypt(jsonEncode(_payload(action,params)));
    final r=await _dio.post('/api.php', data:body, options:Options(contentType:'application/x-www-form-urlencoded',responseType:ResponseType.plain));
    var t=(r.data as String).trim();
    if(t.startsWith('QxZ')) t=ZCrypto.decrypt(t);
    final o=jsonDecode(t); final e=(o['response_status']?['error']??'') as String;
    if(e.isNotEmpty) throw ApiException(e);
    return o['response_data'];
  }
}
final apiProvider = Provider((ref)=>Api());
""")
# ---- models ----
w("lib/models/user.dart","""
class UserModel {
  final int uid; final String nick, avatar, avatarFrame, chatBubble, infoBgImg, sign, levelName, nationalFlag, constellation;
  final int sex, age, nobleLevel, wealthLv, charmLv, activeLevel; final bool isAnchor;
  final int fans, following, gifts, beans, photos, days; final int charm;
  final Map cpInfo; final Map guildInfo; final List medals;
  UserModel.fromJson(Map j):
    uid=int.tryParse('\${j['uid']}')??0, nick=j['nick']??'', avatar=j['avatar']??'', avatarFrame=j['avatarFrame']??'',
    chatBubble=j['chatBubble']??'', infoBgImg=j['infoBgImg']??'', sign=j['sign']??'', levelName=j['levelName']??'',
    nationalFlag=j['nationalFlag']??'', constellation=j['constellation']??'', sex=int.tryParse('\${j['sex']}')??0,
    age=int.tryParse('\${j['age']}')??0, nobleLevel=j['noble_level']??0, wealthLv=j['wealthLv']??0, charmLv=j['charmLv']??0,
    activeLevel=j['active_level']??0, isAnchor=j['isAnchor']==true, fans=int.tryParse('\${j['fans']}')??0,
    following=int.tryParse('\${j['subs']}')??0, gifts=int.tryParse('\${j['gifts']}')??0, beans=int.tryParse('\${j['beans']}')??0,
    photos=int.tryParse('\${j['photos']}')??0, days=int.tryParse('\${j['days']}')??0, charm=int.tryParse('\${j['charm']}')??0,
    cpInfo=j['cp_info']??const{}, guildInfo=j['guild_info']??const{}, medals=j['medal']??const[];
}
""")
w("lib/models/wallet.dart","""
class Wallet { final int coins, diamonds; Wallet(this.coins,this.diamonds);
  factory Wallet.fromJson(Map j)=>Wallet(int.tryParse('\${j['coins']??j['coin']??0}')??0, int.tryParse('\${j['diamonds']??j['diamond']??0}')??0); }
""")
w("lib/models/room.dart","""
class RoomModel { final int rid,onlineNum,seatCount,roomLevel; final String name,cover;
  RoomModel.fromJson(Map j): rid=j['rid']??0, name=j['roomName']??j['name']??'', cover=j['cover']??'',
    onlineNum=j['onlineNum']??0, seatCount=j['seatCount']??10, roomLevel=j['roomLevel']??0; }
""")
# ---- providers ----
w("lib/providers.dart","""
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'core/api.dart';
import 'core/config.dart';
import 'models/user.dart';
import 'models/room.dart';
/// Profile — REAL user.getUserinfo
final meProvider = FutureProvider<UserModel>((ref) async {
  final d = await ref.read(apiProvider).call('user.getUserinfo', params:{'uid':Cfg.myUid,'toUid':Cfg.myUid});
  return UserModel.fromJson(d as Map);
});
/// Home rooms — REAL room.getRecommendRoomV2
final roomsProvider = FutureProvider<List<RoomModel>>((ref) async {
  final d = await ref.read(apiProvider).call('room.getRecommendRoomV2', params:{'page':1});
  final list = (d is Map ? d['list'] : d) as List? ?? [];
  return list.map((e)=>RoomModel.fromJson(e as Map)).toList();
});
""")
print("mobile core generated")
