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
        error:(e,_)=>Center(child:Text('API: $e', style: const TextStyle(color:ZC.textLo))),
        data:(list)=> list.isEmpty ? const Center(child:Text('No rooms', style:TextStyle(color:ZC.textLo)))
        : GridView.count(crossAxisCount:2, padding: const EdgeInsets.all(12), childAspectRatio:.85, mainAxisSpacing:12, crossAxisSpacing:12,
          children: list.map((r)=>InkWell(onTap:()=>c.push('/room/${r.rid}'), child: Container(decoration: BoxDecoration(color:ZC.card, borderRadius:BorderRadius.circular(14)),
            child: Column(crossAxisAlignment:CrossAxisAlignment.start, children:[
              Expanded(child: Container(decoration: BoxDecoration(gradient:ZC.vipGrad, borderRadius: const BorderRadius.vertical(top:Radius.circular(14))), child: Center(child: Text('${r.seatCount} mic', style: const TextStyle(color:Colors.white70))))),
              Padding(padding: const EdgeInsets.all(8), child: Text(r.name, style: const TextStyle(color:Colors.white, fontWeight:FontWeight.w600))),
              Padding(padding: const EdgeInsets.only(left:8,bottom:8), child: Row(children:[const Icon(Icons.local_fire_department, size:14, color:ZC.gold), Text(' ${r.onlineNum}', style: const TextStyle(color:ZC.textLo, fontSize:12))])),
            ])))).toList())),
    );
  }
}
