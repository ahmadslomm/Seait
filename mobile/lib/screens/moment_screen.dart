import 'package:flutter/material.dart';
import '../core/theme.dart';
class MomentScreen extends StatelessWidget { const MomentScreen({super.key});
  @override Widget build(BuildContext c)=>Scaffold(backgroundColor:ZC.bg, appBar: AppBar(backgroundColor:Colors.transparent, title: const Text('Moment'),
    bottom: const TabBar(tabs:[Tab(text:'Follow'),Tab(text:'Recommend'),Tab(text:'Latest')])),
    body: const Center(child: Column(mainAxisAlignment:MainAxisAlignment.center, children:[Icon(Icons.pets,size:80,color:ZC.textLo), SizedBox(height:12), Text("You haven't followed anybody yet", style: TextStyle(color:ZC.textLo))])));
}
