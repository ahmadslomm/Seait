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
      error:(e,_)=>Center(child:Text('API: $e', style:const TextStyle(color:ZC.textLo))),
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
        Text('ID:${u.uid}', style: const TextStyle(color:ZC.textLo)), const SizedBox(width:4), const Icon(Icons.copy, size:14, color:ZC.textLo)])),
      Positioned(left:16, top:130, child: _badges(u)),
    ]),
    // stats row
    Padding(padding: const EdgeInsets.symmetric(vertical:14, horizontal:8), child: Row(children:[
      _stat('${u.fans}','Followers'), _stat('${u.following}','Following'), _stat('${u.gifts}','Gifts'), _stat('100','Visitors'),
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
    const SizedBox(width:6), _pill('W${u.wealthLv}', ZC.gold),
    const SizedBox(width:6), _pill('Lv${u.charmLv}', ZC.diamond),
    const SizedBox(width:6), _pill('★${u.activeLevel}', ZC.purple2),
    const SizedBox(width:6), _pill('N${u.nobleLevel}', const Color(0xFF3A3A5C)),
  ]);
  Widget _pill(String t, Color c)=>Container(padding: const EdgeInsets.symmetric(horizontal:8,vertical:2), decoration: BoxDecoration(color:c.withOpacity(.85), borderRadius:BorderRadius.circular(9)), child: Text(t, style: const TextStyle(color:Colors.white, fontSize:11, fontWeight:FontWeight.bold)));
  Widget _stat(String v,String l)=>Expanded(child: Column(children:[Text(v, style: const TextStyle(color:Colors.white, fontSize:18, fontWeight:FontWeight.bold)), Text(l, style: const TextStyle(color:ZC.textLo, fontSize:12))]));
  Widget _vipCard(BuildContext c, UserModel u)=>Padding(padding: const EdgeInsets.symmetric(horizontal:16), child: InkWell(onTap:()=>c.push('/vip'), child: Container(padding: const EdgeInsets.all(16), decoration: BoxDecoration(gradient:ZC.vipGrad, borderRadius:BorderRadius.circular(16), border:Border.all(color:ZC.gold, width:1.5)),
    child: Row(children:[
      const Icon(Icons.workspace_premium, color:ZC.gold, size:40),
      const SizedBox(width:12),
      Column(crossAxisAlignment:CrossAxisAlignment.start, children:[Text('VIP ${u.nobleLevel}', style: const TextStyle(color:ZC.gold2, fontSize:26, fontWeight:FontWeight.bold)), const Text('Welcome Back VIP', style: TextStyle(color:Colors.white70))]),
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
