import 'package:flutter/material.dart';
import '../core/theme.dart';
class RoomScreen extends StatelessWidget { final int rid; const RoomScreen({super.key, required this.rid});
  @override Widget build(BuildContext c)=>Scaffold(backgroundColor:ZC.bg, appBar: AppBar(backgroundColor:Colors.transparent, title: Text('Room $rid')),
    body: GridView.count(crossAxisCount:5, padding: const EdgeInsets.all(16), children: List.generate(10,(i)=>Column(mainAxisSize:MainAxisSize.min, children:[
      CircleAvatar(radius:22, backgroundColor:ZC.card, child: Icon(i==0?Icons.mic:Icons.add, color:ZC.textLo, size:18)), const SizedBox(height:4), Text('${i}', style: const TextStyle(color:ZC.textLo, fontSize:11))])))); }
