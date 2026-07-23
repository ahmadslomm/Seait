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
  // Original app's ornate gold nav artwork (selected) + plain variant (idle).
  final art=const ['nav_home','nav_moment','nav_live','nav_message','nav_me'];
  final icons=const [Icons.mosque,Icons.explore,Icons.videocam,Icons.forum,Icons.person];

  Widget _navIcon(int n){
    final on = i==n;
    return Image.asset('assets/ui/${art[n]}${on ? "" : "_off"}.webp',
      width:30, height:30, fit:BoxFit.contain,
      errorBuilder:(_,__,___)=>Icon(icons[n], color: on?ZC.gold:ZC.textLo, size:24));
  }

  @override Widget build(BuildContext c)=>Scaffold(
    body: IndexedStack(index:i, children:pages),
    bottomNavigationBar: Container(color:ZC.nav, child: SafeArea(child: SizedBox(height:66, child: Row(
      children: List.generate(5,(n)=>Expanded(child: InkWell(onTap:()=>setState(()=>i=n), child: Column(mainAxisAlignment:MainAxisAlignment.center, children:[
        _navIcon(n),
        const SizedBox(height:2),
        Text(labels[n], style: TextStyle(fontSize:11, color:i==n?ZC.gold:ZC.textLo)),
      ])))),
    )))),
  );
}
