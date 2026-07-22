class Cfg {
  // Seait backend (api.php gateway). Emulator host = 10.0.2.2.
  static const apiBase = String.fromEnvironment('API_BASE', defaultValue:'http://10.0.2.2:8080');
  static const wsBase  = String.fromEnvironment('WS_BASE',  defaultValue:'http://10.0.2.2:8080');
  static const myUid   = 1278472; // real seeded account
}
