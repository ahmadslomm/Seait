import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'core/theme.dart';
import 'routing.dart';
import 'providers.dart';
void main(){
  final container = ProviderContainer();
  // Pull server art overrides early; harmless no-op until the endpoint exists.
  container.read(assetOverridesProvider);
  runApp(UncontrolledProviderScope(container: container, child: const SeaitApp()));
}
class SeaitApp extends StatelessWidget { const SeaitApp({super.key});
  @override Widget build(BuildContext c)=>MaterialApp.router(title:'Seait',debugShowCheckedModeBanner:false,theme:ZTheme.dark,routerConfig:router); }
