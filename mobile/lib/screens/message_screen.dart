import 'package:flutter/material.dart';
import '../core/theme.dart';
class MessageScreen extends StatelessWidget { const MessageScreen({super.key});
  @override Widget build(BuildContext c)=>Scaffold(backgroundColor:ZC.bg, appBar: AppBar(backgroundColor:Colors.transparent, title: const Text('Message')),
    body: const Center(child: Text('Message', style: TextStyle(color:ZC.textLo)))); }
