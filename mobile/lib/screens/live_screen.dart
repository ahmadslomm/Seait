import 'package:flutter/material.dart';
import '../core/theme.dart';
class LiveScreen extends StatelessWidget { const LiveScreen({super.key});
  @override Widget build(BuildContext c)=>Scaffold(backgroundColor:ZC.bg, appBar: AppBar(backgroundColor:Colors.transparent, title: const Text('Live')),
    body: const Center(child: Text('Live', style: TextStyle(color:ZC.textLo)))); }
