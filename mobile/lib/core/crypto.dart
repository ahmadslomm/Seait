import 'dart:convert';
import 'package:crypto/crypto.dart';
class ZCrypto {
  static const pkg='com.waig.nalo';
  static final List<int> _key = ascii.encode(md5.convert(utf8.encode(pkg)).toString());
  static List<int> _xor(List<int> d)=>List<int>.generate(d.length,(i)=>d[i]^_key[i%_key.length]);
  static String encrypt(String j)=>base64.encode(_xor(utf8.encode(j)));
  static String decrypt(String b){ var s=Uri.decodeComponent(b).replaceAll('_','/'); while(s.length%4!=0){s+='=';} return utf8.decode(_xor(base64.decode(s)),allowMalformed:true); }
}
