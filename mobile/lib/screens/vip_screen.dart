import 'package:flutter/material.dart';
import '../core/theme.dart';
class VipScreen extends StatelessWidget { const VipScreen({super.key});
  @override Widget build(BuildContext c)=>Scaffold(backgroundColor:ZC.bg, appBar: AppBar(title: const Text('VIP'), backgroundColor:Colors.transparent),
    body: ListView(padding: const EdgeInsets.all(16), children: List.generate(5,(i)=>Container(margin: const EdgeInsets.only(bottom:12), padding: const EdgeInsets.all(16), decoration: BoxDecoration(gradient:ZC.vipGrad, borderRadius:BorderRadius.circular(14), border:Border.all(color:ZC.gold)),
      child: Row(children:[const Icon(Icons.workspace_premium,color:ZC.gold,size:36), const SizedBox(width:12), Text('VIP ${i+1}', style: const TextStyle(color:ZC.gold2, fontSize:20, fontWeight:FontWeight.bold)), const Spacer(), const Text('Benefits ›', style: TextStyle(color:Colors.white70))])))));
}
