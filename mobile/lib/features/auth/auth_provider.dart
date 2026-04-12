import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:google_sign_in/google_sign_in.dart';
import '../../core/auth_storage.dart';
import '../../core/api_client.dart';
import '../../core/locale_provider.dart';

enum AuthStatus { unknown, authenticated, unauthenticated }

class AuthState {
  final AuthStatus status;
  final Map<String, dynamic>? user;

  const AuthState({required this.status, this.user});

  factory AuthState.unknown() => const AuthState(status: AuthStatus.unknown);
  factory AuthState.authenticated(Map<String, dynamic> user) =>
      AuthState(status: AuthStatus.authenticated, user: user);
  factory AuthState.unauthenticated() =>
      const AuthState(status: AuthStatus.unauthenticated);
}

final authStorageProvider = Provider<AuthStorage>((ref) => AuthStorage());

final apiClientProvider = Provider<ApiClient>((ref) {
  final storage = ref.read(authStorageProvider);
  return ApiClient(storage);
});

final googleSignInProvider = Provider<GoogleSignIn>(
  (ref) => GoogleSignIn.instance,
);

final authProvider = NotifierProvider<AuthNotifier, AuthState>(
  AuthNotifier.new,
);

class AuthNotifier extends Notifier<AuthState> {
  late final ApiClient _apiClient;
  late final AuthStorage _authStorage;
  late final GoogleSignIn _googleSignIn;

  @override
  AuthState build() {
    _apiClient = ref.read(apiClientProvider);
    _authStorage = ref.read(authStorageProvider);
    _googleSignIn = ref.read(googleSignInProvider);
    _apiClient.onUnauthorized = _handleUnauthorized;
    _init();
    return AuthState.unknown();
  }

  Future<void> _init() async {
    final token = await _authStorage.getToken();
    if (token == null) {
      state = AuthState.unauthenticated();
      return;
    }

    try {
      final response = await _apiClient.dio.get('/api/me');
      state = AuthState.authenticated(response.data);
      _syncServerLocale(response.data);
    } catch (_) {
      await _authStorage.clearToken();
      state = AuthState.unauthenticated();
    }
  }

  /// 若 server user.locale 與本機 localeProvider 不同，以 server 為準覆蓋本機。
  /// 跨裝置切換語言時讓兩邊同步。
  void _syncServerLocale(dynamic responseData) {
    final serverTag = responseData is Map ? responseData['locale'] as String? : null;
    if (serverTag == null || !supportedLocaleTags.contains(serverTag)) return;
    final current = ref.read(localeProvider);
    final currentTag = current == null ? null : formatLocaleTag(current);
    if (currentTag != serverTag) {
      ref.read(localeProvider.notifier).setLocale(parseLocaleTag(serverTag));
    }
  }

  Future<bool> login() async {
    try {
      final googleUser = await _googleSignIn.authenticate();
      final googleAuth = googleUser.authentication;
      final idToken = googleAuth.idToken;
      if (idToken == null) return false;

      final response = await _apiClient.dio.post('/api/auth/mobile', data: {
        'idToken': idToken,
      });

      final jwt = response.data['token'] as String;
      final user = response.data['user'] as Map<String, dynamic>;

      await _authStorage.setToken(jwt);
      state = AuthState.authenticated(user);
      _syncServerLocale(user);
      return true;
    } catch (e) {
      return false;
    }
  }

  Future<void> logout() async {
    await _authStorage.clearToken();
    await _googleSignIn.signOut();
    state = AuthState.unauthenticated();
  }

  void _handleUnauthorized() {
    _authStorage.clearToken();
    _googleSignIn.signOut();
    state = AuthState.unauthenticated();
  }
}
