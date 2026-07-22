import os
R="/root/Seait/mobile/lib"
def w(p,c):
    f=os.path.join(R,p); os.makedirs(os.path.dirname(f),exist_ok=True); open(f,"w").write(c.lstrip("\n"))

# ---- routing + shell ----
w("routing.dart","""
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
""")
w("screens/shell.dart","""
import 'package:flutter/material.dart';
import '../core/theme.dart';
import 'home_screen.dart';
import 'moment_screen.dart';
import 'live_screen.dart';
import 'message_screen.dart';
import 'me_screen.dart';
class Shell extends StatefulWidget { const Shell({super.key}); @override State<Shell> createState()=>_S(); }
class _S extends State<Shell> {
  int i=4; // start on Me (has real data)
  final pages=const [HomeScreen(),MomentScreen(),LiveScreen(),MessageScreen(),MeScreen()];
  final labels=const ['Home','Moment','Live','Message','Me'];
  final icons=const [Icons.mosque,Icons.explore,Icons.videocam,Icons.forum,Icons.person];
  @override Widget build(BuildContext c)=>Scaffold(
    body: IndexedStack(index:i, children:pages),
    bottomNavigationBar: Container(color:ZC.nav, child: SafeArea(child: SizedBox(height:64, child: Row(
      children: List.generate(5,(n)=>Expanded(child: InkWell(onTap:()=>setState(()=>i=n), child: Column(mainAxisAlignment:MainAxisAlignment.center, children:[
        Icon(icons[n], color: i==n?ZC.gold:ZC.textLo, size:24),
        const SizedBox(height:2),
        Text(labels[n], style: TextStyle(fontSize:11, color:i==n?ZC.gold:ZC.textLo)),
      ])))),
    )))),
  );
}
""")
# ---- ME / PROFILE (matches screenshot, real user.getUserinfo) ----
w("screens/me_screen.dart","""
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import 'package:cached_network_image/cached_network_image.dart';
import '../core/theme.dart';
import '../providers.dart';
import '../models/user.dart';
class MeScreen extends ConsumerWidget { const MeScreen({super.key});
  @override Widget build(BuildContext c, WidgetRef ref){
    final me = ref.watch(meProvider);
    return Scaffold(backgroundColor:ZC.bg, body: me.when(
      loading:()=>const Center(child:CircularProgressIndicator(color:ZC.purple)),
      error:(e,_)=>Center(child:Text('API: \$e', style:const TextStyle(color:ZC.textLo))),
      data:(u)=>_body(c,u),
    ));
  }
  Widget _body(BuildContext c, UserModel u)=>SingleChildScrollView(child: Column(children:[
    // header with palace bg + name/id + big vip frame
    Stack(children:[
      Container(height:260, decoration: const BoxDecoration(gradient: LinearGradient(begin:Alignment.topCenter,end:Alignment.bottomCenter, colors:[Color(0xFF3A1D5C),ZC.bg]))),
      Positioned(left:16, top:60, child: Row(children:[
        Text(u.nick, style: const TextStyle(color:Colors.white, fontSize:22, fontWeight:FontWeight.bold)),
        const SizedBox(width:6), const Icon(Icons.edit, color:ZC.textLo, size:16)])),
      Positioned(left:16, top:96, child: Row(children:[
        Text('ID:\${u.uid}', style: const TextStyle(color:ZC.textLo)), const SizedBox(width:4), const Icon(Icons.copy, size:14, color:ZC.textLo)])),
      Positioned(left:16, top:130, child: _badges(u)),
    ]),
    // stats row
    Padding(padding: const EdgeInsets.symmetric(vertical:14, horizontal:8), child: Row(children:[
      _stat('\${u.fans}','Followers'), _stat('\${u.following}','Following'), _stat('\${u.gifts}','Gifts'), _stat('100','Visitors'),
    ])),
    // VIP card
    _vipCard(c,u),
    // coins + diamonds
    Padding(padding: const EdgeInsets.symmetric(horizontal:16, vertical:8), child: Row(children:[
      Expanded(child: _balance('Coins','89', ZC.coinGrad, Icons.monetization_on, Colors.brown.shade800)),
      const SizedBox(width:12),
      Expanded(child: _balance('Diamonds','57551', ZC.diaGrad, Icons.diamond, Colors.deepPurple.shade900)),
    ])),
    // grid
    _grid(),
    // list
    _tile(Icons.favorite,'Cp space'), _tile(Icons.workspace_premium,'My level'), _tile(Icons.trending_up,'My income'),
    const SizedBox(height:20),
  ]));
  Widget _badges(UserModel u)=>Row(children:[
    if(u.nationalFlag.isNotEmpty) ClipRRect(borderRadius:BorderRadius.circular(3), child: CachedNetworkImage(imageUrl:u.nationalFlag, width:28, height:18, fit:BoxFit.cover, errorWidget:(_,__,___)=>const SizedBox())),
    const SizedBox(width:6), _pill('W\${u.wealthLv}', ZC.gold),
    const SizedBox(width:6), _pill('Lv\${u.charmLv}', ZC.diamond),
    const SizedBox(width:6), _pill('★\${u.activeLevel}', ZC.purple2),
    const SizedBox(width:6), _pill('N\${u.nobleLevel}', const Color(0xFF3A3A5C)),
  ]);
  Widget _pill(String t, Color c)=>Container(padding: const EdgeInsets.symmetric(horizontal:8,vertical:2), decoration: BoxDecoration(color:c.withOpacity(.85), borderRadius:BorderRadius.circular(9)), child: Text(t, style: const TextStyle(color:Colors.white, fontSize:11, fontWeight:FontWeight.bold)));
  Widget _stat(String v,String l)=>Expanded(child: Column(children:[Text(v, style: const TextStyle(color:Colors.white, fontSize:18, fontWeight:FontWeight.bold)), Text(l, style: const TextStyle(color:ZC.textLo, fontSize:12))]));
  Widget _vipCard(BuildContext c, UserModel u)=>Padding(padding: const EdgeInsets.symmetric(horizontal:16), child: InkWell(onTap:()=>c.push('/vip'), child: Container(padding: const EdgeInsets.all(16), decoration: BoxDecoration(gradient:ZC.vipGrad, borderRadius:BorderRadius.circular(16), border:Border.all(color:ZC.gold, width:1.5)),
    child: Row(children:[
      const Icon(Icons.workspace_premium, color:ZC.gold, size:40),
      const SizedBox(width:12),
      Column(crossAxisAlignment:CrossAxisAlignment.start, children:[Text('VIP \${u.nobleLevel}', style: const TextStyle(color:ZC.gold2, fontSize:26, fontWeight:FontWeight.bold)), const Text('Welcome Back VIP', style: TextStyle(color:Colors.white70))]),
      const Spacer(),
      Container(padding: const EdgeInsets.symmetric(horizontal:14,vertical:8), decoration: BoxDecoration(border:Border.all(color:ZC.gold), borderRadius:BorderRadius.circular(20)), child: const Text('My Benefits', style: TextStyle(color:ZC.gold2, fontWeight:FontWeight.bold))),
    ]))));
  Widget _balance(String l,String v,Gradient g,IconData ic,Color icc)=>Container(padding: const EdgeInsets.all(14), decoration: BoxDecoration(gradient:g, borderRadius:BorderRadius.circular(14)),
    child: Row(children:[Icon(ic, color:icc, size:34), const SizedBox(width:10), Column(crossAxisAlignment:CrossAxisAlignment.start, children:[Text(l, style: TextStyle(color:icc.withOpacity(.9), fontWeight:FontWeight.w600)), Text(v, style: TextStyle(color:icc, fontSize:22, fontWeight:FontWeight.bold))])]));
  Widget _grid()=>Padding(padding: const EdgeInsets.all(16), child: Container(padding: const EdgeInsets.symmetric(vertical:16), decoration: BoxDecoration(color:ZC.card, borderRadius:BorderRadius.circular(16)),
    child: Row(mainAxisAlignment:MainAxisAlignment.spaceAround, children:[
      _gi(Icons.store,'Store',Colors.orange), _gi(Icons.assignment,'Task',Colors.green), _gi(Icons.event_available,'Check in',ZC.purple2), _gi(Icons.backpack,'Backpack',ZC.gold)])));
  Widget _gi(IconData i,String l,Color c)=>Column(children:[Container(width:52,height:52, decoration: BoxDecoration(color:c.withOpacity(.9), borderRadius:BorderRadius.circular(14)), child: Icon(i, color:Colors.white)), const SizedBox(height:6), Text(l, style: const TextStyle(color:Colors.white, fontSize:12))]);
  Widget _tile(IconData i,String t)=>Padding(padding: const EdgeInsets.symmetric(horizontal:16, vertical:6), child: Container(padding: const EdgeInsets.all(14), decoration: BoxDecoration(color:ZC.card, borderRadius:BorderRadius.circular(12)),
    child: Row(children:[Icon(i, color:ZC.purple2), const SizedBox(width:12), Text(t, style: const TextStyle(color:Colors.white, fontSize:15)), const Spacer(), const Icon(Icons.chevron_right, color:ZC.textLo)])));
}
""")
# ---- HOME (rooms, real room.getRecommendRoomV2) ----
w("screens/home_screen.dart","""
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import '../core/theme.dart';
import '../providers.dart';
class HomeScreen extends ConsumerWidget { const HomeScreen({super.key});
  @override Widget build(BuildContext c, WidgetRef ref){
    final rooms=ref.watch(roomsProvider);
    return Scaffold(backgroundColor:ZC.bg, appBar: AppBar(backgroundColor:Colors.transparent, elevation:0, title: const Text('ZaffaLive'),
      bottom: const TabBar(isScrollable:true, tabs:[Tab(text:'Popular'),Tab(text:'Party'),Tab(text:'Games'),Tab(text:'New')])),
      body: rooms.when(loading:()=>const Center(child:CircularProgressIndicator(color:ZC.purple)),
        error:(e,_)=>Center(child:Text('API: \$e', style: const TextStyle(color:ZC.textLo))),
        data:(list)=> list.isEmpty ? const Center(child:Text('No rooms', style:TextStyle(color:ZC.textLo)))
        : GridView.count(crossAxisCount:2, padding: const EdgeInsets.all(12), childAspectRatio:.85, mainAxisSpacing:12, crossAxisSpacing:12,
          children: list.map((r)=>InkWell(onTap:()=>c.push('/room/\${r.rid}'), child: Container(decoration: BoxDecoration(color:ZC.card, borderRadius:BorderRadius.circular(14)),
            child: Column(crossAxisAlignment:CrossAxisAlignment.start, children:[
              Expanded(child: Container(decoration: BoxDecoration(gradient:ZC.vipGrad, borderRadius: const BorderRadius.vertical(top:Radius.circular(14))), child: Center(child: Text('\${r.seatCount} mic', style: const TextStyle(color:Colors.white70))))),
              Padding(padding: const EdgeInsets.all(8), child: Text(r.name, style: const TextStyle(color:Colors.white, fontWeight:FontWeight.w600))),
              Padding(padding: const EdgeInsets.only(left:8,bottom:8), child: Row(children:[const Icon(Icons.local_fire_department, size:14, color:ZC.gold), Text(' \${r.onlineNum}', style: const TextStyle(color:ZC.textLo, fontSize:12))])),
            ])))).toList())),
    );
  }
}
""")
# ---- simple screens ----
w("screens/moment_screen.dart","""
import 'package:flutter/material.dart';
import '../core/theme.dart';
class MomentScreen extends StatelessWidget { const MomentScreen({super.key});
  @override Widget build(BuildContext c)=>Scaffold(backgroundColor:ZC.bg, appBar: AppBar(backgroundColor:Colors.transparent, title: const Text('Moment'),
    bottom: const TabBar(tabs:[Tab(text:'Follow'),Tab(text:'Recommend'),Tab(text:'Latest')])),
    body: const Center(child: Column(mainAxisAlignment:MainAxisAlignment.center, children:[Icon(Icons.pets,size:80,color:ZC.textLo), SizedBox(height:12), Text("You haven't followed anybody yet", style: TextStyle(color:ZC.textLo))])));
}
""")
for name,cls,label in [('live','LiveScreen','Live'),('message','MessageScreen','Message')]:
    w(f"screens/{name}_screen.dart", f"""
import 'package:flutter/material.dart';
import '../core/theme.dart';
class {cls} extends StatelessWidget {{ const {cls}({{super.key}});
  @override Widget build(BuildContext c)=>Scaffold(backgroundColor:ZC.bg, appBar: AppBar(backgroundColor:Colors.transparent, title: const Text('{label}')),
    body: const Center(child: Text('{label}', style: TextStyle(color:ZC.textLo)))); }}
""")
# ---- wallet / vip / room screens ----
w("screens/wallet_screen.dart","""
import 'package:flutter/material.dart';
import '../core/theme.dart';
class WalletScreen extends StatelessWidget { const WalletScreen({super.key});
  @override Widget build(BuildContext c)=>Scaffold(backgroundColor:ZC.bg, appBar: AppBar(title: const Text('Wallet'), backgroundColor:Colors.transparent),
    body: const Center(child: Text('Coins & Diamonds', style: TextStyle(color:ZC.textLo)))); }
""")
w("screens/vip_screen.dart","""
import 'package:flutter/material.dart';
import '../core/theme.dart';
class VipScreen extends StatelessWidget { const VipScreen({super.key});
  @override Widget build(BuildContext c)=>Scaffold(backgroundColor:ZC.bg, appBar: AppBar(title: const Text('VIP'), backgroundColor:Colors.transparent),
    body: ListView(padding: const EdgeInsets.all(16), children: List.generate(5,(i)=>Container(margin: const EdgeInsets.only(bottom:12), padding: const EdgeInsets.all(16), decoration: BoxDecoration(gradient:ZC.vipGrad, borderRadius:BorderRadius.circular(14), border:Border.all(color:ZC.gold)),
      child: Row(children:[const Icon(Icons.workspace_premium,color:ZC.gold,size:36), const SizedBox(width:12), Text('VIP \${i+1}', style: const TextStyle(color:ZC.gold2, fontSize:20, fontWeight:FontWeight.bold)), const Spacer(), const Text('Benefits ›', style: TextStyle(color:Colors.white70))])))));
}
""")
w("screens/room_screen.dart","""
import 'package:flutter/material.dart';
import '../core/theme.dart';
class RoomScreen extends StatelessWidget { final int rid; const RoomScreen({super.key, required this.rid});
  @override Widget build(BuildContext c)=>Scaffold(backgroundColor:ZC.bg, appBar: AppBar(backgroundColor:Colors.transparent, title: Text('Room \$rid')),
    body: GridView.count(crossAxisCount:5, padding: const EdgeInsets.all(16), children: List.generate(10,(i)=>Column(mainAxisSize:MainAxisSize.min, children:[
      CircleAvatar(radius:22, backgroundColor:ZC.card, child: Icon(i==0?Icons.mic:Icons.add, color:ZC.textLo, size:18)), const SizedBox(height:4), Text('\${i}', style: const TextStyle(color:ZC.textLo, fontSize:11))])))); }
""")
print("screens generated")
