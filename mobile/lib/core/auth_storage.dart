import 'package:flutter_secure_storage/flutter_secure_storage.dart';

class AuthStorage {
  static const _tokenKey = 'nudge_jwt';
  final FlutterSecureStorage _storage = const FlutterSecureStorage();

  Future<String?> getToken() => _storage.read(key: _tokenKey);

  Future<void> setToken(String token) =>
      _storage.write(key: _tokenKey, value: token);

  Future<void> clearToken() => _storage.delete(key: _tokenKey);
}
