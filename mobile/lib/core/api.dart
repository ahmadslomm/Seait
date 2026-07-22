import 'dart:convert';
import 'package:dio/dio.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'crypto.dart';
import 'config.dart';
class ApiException implements Exception { final String message; ApiException(this.message); }
class Api {
  final Dio _dio; String token; int uid;
  Api({this.token='', this.uid=Cfg.myUid, Dio? dio})
    : _dio = dio ?? Dio(BaseOptions(baseUrl:Cfg.apiBase, headers:{'User-Agent':'okhttp/4.12.0'}));
  Map<String,dynamic> _payload(String action, Map<String,dynamic> p)=>{
    'action':action,'token':token,'uid':uid,'_login_uid':uid,'lang':'ar','deviceid':'seait-dev',
    'ua':'Android_version=1.21.150;system=11;bundleId=com.waig.nalo', ...p };
  /// Real api.php call: encrypt request -> POST -> decrypt {response_status,response_data}.
  Future<dynamic> call(String action,{Map<String,dynamic> params=const{}}) async {
    final body='app_id=com.waig.nalo&http_body=' + ZCrypto.encrypt(jsonEncode(_payload(action,params)));
    final r=await _dio.post('/api.php', data:body, options:Options(contentType:'application/x-www-form-urlencoded',responseType:ResponseType.plain));
    var t=(r.data as String).trim();
    if(t.startsWith('QxZ')) t=ZCrypto.decrypt(t);
    final o=jsonDecode(t); final e=(o['response_status']?['error']??'') as String;
    if(e.isNotEmpty) throw ApiException(e);
    return o['response_data'];
  }
}
final apiProvider = Provider((ref)=>Api());
