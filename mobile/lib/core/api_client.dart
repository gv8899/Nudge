import 'package:dio/dio.dart';
import 'constants.dart';
import 'auth_storage.dart';

class ApiClient {
  final Dio dio;
  final AuthStorage authStorage;
  void Function()? onUnauthorized;

  ApiClient(this.authStorage) : dio = Dio(BaseOptions(
    baseUrl: Constants.apiBaseUrl,
    connectTimeout: const Duration(seconds: 10),
    receiveTimeout: const Duration(seconds: 10),
    headers: {'Content-Type': 'application/json'},
  )) {
    dio.interceptors.add(InterceptorsWrapper(
      onRequest: (options, handler) async {
        final token = await authStorage.getToken();
        if (token != null) {
          options.headers['Authorization'] = 'Bearer $token';
        }
        handler.next(options);
      },
      onError: (error, handler) {
        if (error.response?.statusCode == 401) {
          onUnauthorized?.call();
        }
        handler.next(error);
      },
    ));
  }
}
