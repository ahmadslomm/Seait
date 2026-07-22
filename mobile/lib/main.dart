import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'core/theme.dart';
import 'routing.dart';
void main()=>runApp(const ProviderScope(child: SeaitApp()));
class SeaitApp extends StatelessWidget { const SeaitApp({super.key});
  @override Widget build(BuildContext c)=>MaterialApp.router(title:'Seait',debugShowCheckedModeBanner:false,theme:ZTheme.dark,routerConfig:router); }
