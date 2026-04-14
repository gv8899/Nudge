import 'package:flutter/foundation.dart';

class Constants {
  Constants._();

  /// Debug build 指向本機 dev server，release build 指向正式機。
  /// 可用 --dart-define=API_BASE_URL=... 覆寫（例如用 LAN IP 給實機測）。
  static const String _prodApiBaseUrl = 'https://nudgee.zeabur.app';
  static const String _devApiBaseUrl = 'http://localhost:3000';

  static const String apiBaseUrl = String.fromEnvironment(
    'API_BASE_URL',
    defaultValue: kDebugMode ? _devApiBaseUrl : _prodApiBaseUrl,
  );
}
