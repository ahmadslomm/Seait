import 'package:flutter/material.dart';
import 'package:google_fonts/google_fonts.dart';
class ZC {
  static const bg       = Color(0xFF1A0B2E);   // deep purple base
  static const bg2      = Color(0xFF241238);
  static const card     = Color(0xFF2A1A44);
  static const nav      = Color(0xFF2B1650);
  static const purple   = Color(0xFF7B2FF7);
  static const purple2  = Color(0xFFA24BFF);
  static const gold     = Color(0xFFE9B949);
  static const gold2    = Color(0xFFFFD76A);
  static const coin     = Color(0xFFF2C14E);
  static const diamond  = Color(0xFFB57BFF);
  static const textHi   = Color(0xFFFFFFFF);
  static const textLo   = Color(0xFFB9AEDA);
  static const vipGrad  = LinearGradient(colors:[Color(0xFF7B2FF7),Color(0xFF9D4EDD)]);
  static const coinGrad = LinearGradient(colors:[Color(0xFFFFE08A),Color(0xFFE9B949)]);
  static const diaGrad  = LinearGradient(colors:[Color(0xFFC9A7FF),Color(0xFF9D6BFF)]);
}
class ZTheme {
  static ThemeData get dark => ThemeData(
    useMaterial3:true, brightness:Brightness.dark, scaffoldBackgroundColor:ZC.bg,
    colorScheme: const ColorScheme.dark(primary:ZC.purple, secondary:ZC.gold, surface:ZC.card),
    textTheme: GoogleFonts.cairoTextTheme(ThemeData.dark().textTheme),
  );
}
