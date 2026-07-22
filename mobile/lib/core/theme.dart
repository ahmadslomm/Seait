import 'package:flutter/material.dart';
import 'package:google_fonts/google_fonts.dart';

/// CENTRAL DESIGN SYSTEM — every color, size, gradient, radius, shadow, and text
/// style lives here. Screens must NOT hardcode values; use these tokens + components.

/// Colors (sampled from the original app screenshots).
class ZC {
  static const bg      = Color(0xFF1A0B2E); // deep purple base
  static const bg2     = Color(0xFF241238); // sheet / secondary
  static const card    = Color(0xFF2A1A44); // card surface
  static const card2   = Color(0xFF33204F);
  static const nav     = Color(0xFF2B1650); // bottom nav
  static const header  = Color(0xFF3E2064); // profile header top
  static const purple  = Color(0xFF7B2FF7);
  static const purple2 = Color(0xFFA24BFF);
  static const gold    = Color(0xFFE9B949);
  static const gold2   = Color(0xFFFFD76A);
  static const coin    = Color(0xFFF2C14E);
  static const diamond = Color(0xFFB57BFF);
  static const pink    = Color(0xFFEC5CA0);
  static const green   = Color(0xFF3FA34D);
  static const orange  = Color(0xFFE8862E);
  static const teal    = Color(0xFF1E9E9E);
  static const danger  = Color(0xFFFF4D6D);
  static const textHi  = Color(0xFFFFFFFF);
  static const textMid = Color(0xFFD8CFEA);
  static const textLo  = Color(0xFFB9AEDA);
  static const line    = Color(0x22FFFFFF);
}

/// Gradients.
class ZGrad {
  static const vip   = LinearGradient(colors: [Color(0xFF7B2FF7), Color(0xFF9D4EDD)]);
  static const coin  = LinearGradient(colors: [Color(0xFFFFE08A), Color(0xFFE9B949)]);
  static const dia   = LinearGradient(colors: [Color(0xFFC9A7FF), Color(0xFF9D6BFF)]);
  static const gold  = LinearGradient(colors: [Color(0xFFFFE08A), Color(0xFFF0B23C)]);
  static const cp    = LinearGradient(colors: [Color(0xFFFF7EB3), Color(0xFFE05C97)]);
  static const header = LinearGradient(begin: Alignment.topCenter, end: Alignment.bottomCenter, colors: [ZC.header, Color(0xFF2A1148), ZC.bg]);
  static const roomBg = LinearGradient(begin: Alignment.topCenter, end: Alignment.bottomCenter, colors: [Color(0xFF3A1D6E), ZC.bg]);
}

/// Spacing scale (dp).
class ZSpace { static const xs = 4.0, sm = 8.0, md = 12.0, lg = 16.0, xl = 24.0, xxl = 32.0; }

/// Corner radii.
class ZRadius { static const sm = 8.0, md = 12.0, lg = 16.0, xl = 20.0, pill = 28.0; }

/// Shadows.
class ZShadow {
  static const card = [BoxShadow(color: Color(0x33000000), blurRadius: 10, offset: Offset(0, 4))];
  static const vip  = [BoxShadow(color: Color(0x557B2FF7), blurRadius: 14, offset: Offset(0, 6))];
}

/// Typography.
class ZType {
  static TextStyle get title    => GoogleFonts.cairo(color: ZC.textHi, fontSize: 22, fontWeight: FontWeight.bold);
  static TextStyle get section  => GoogleFonts.cairo(color: ZC.textHi, fontSize: 16, fontWeight: FontWeight.bold);
  static TextStyle get body     => GoogleFonts.cairo(color: ZC.textHi, fontSize: 15);
  static TextStyle get label    => GoogleFonts.cairo(color: ZC.textLo, fontSize: 12);
  static TextStyle get value    => GoogleFonts.cairo(color: ZC.textHi, fontSize: 18, fontWeight: FontWeight.bold);
  static TextStyle get gold     => GoogleFonts.cairo(color: ZC.gold2, fontSize: 26, fontWeight: FontWeight.bold);
  static TextStyle get badge    => GoogleFonts.cairo(color: ZC.textHi, fontSize: 11, fontWeight: FontWeight.bold);
}

class ZTheme {
  static ThemeData get dark => ThemeData(
    useMaterial3: true, brightness: Brightness.dark, scaffoldBackgroundColor: ZC.bg,
    colorScheme: const ColorScheme.dark(primary: ZC.purple, secondary: ZC.gold, surface: ZC.card),
    textTheme: GoogleFonts.cairoTextTheme(ThemeData.dark().textTheme),
    appBarTheme: const AppBarTheme(backgroundColor: Colors.transparent, elevation: 0),
    tabBarTheme: const TabBarTheme(indicatorColor: ZC.gold, labelColor: ZC.textHi, unselectedLabelColor: ZC.textLo),
  );
}
