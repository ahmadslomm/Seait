class Cfg {
  // Seait backend (api.php gateway). Emulator host = 10.0.2.2.
  static const apiBase = String.fromEnvironment('API_BASE', defaultValue:'http://10.0.2.2:8080');
  static const wsBase  = String.fromEnvironment('WS_BASE',  defaultValue:'http://10.0.2.2:8080');
  static const myUid   = 1278472; // real seeded account
}

/// Compile-time switch for development-only triggers (e.g. the room's
/// ?demoBanner=1 deep link used to verify decorative overlays on the emulator).
/// Defaults to FALSE, so a normal release build has these paths tree-shaken out
/// entirely — they only exist when built with --dart-define=DEMO_TRIGGERS=true.
const bool kDemoTriggers = bool.fromEnvironment('DEMO_TRIGGERS');
