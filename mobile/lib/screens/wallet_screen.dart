import 'package:flutter/material.dart';
import '../core/theme.dart';
class WalletScreen extends StatelessWidget { const WalletScreen({super.key});
  @override Widget build(BuildContext c)=>Scaffold(backgroundColor:ZC.bg, appBar: AppBar(title: const Text('Wallet'), backgroundColor:Colors.transparent),
    body: const Center(child: Text('Coins & Diamonds', style: TextStyle(color:ZC.textLo)))); }
