import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:google_sign_in/google_sign_in.dart';
import '../../core/auth_storage.dart';
import '../../core/api_client.dart';

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

final googleSignInProvider = Provider<GoogleSignIn>((ref) => GoogleSignIn());

final authProvider = StateNotifierProvider<AuthNotifier, AuthState>((ref) {
  return AuthNotifier(
    ref.read(apiClientProvider),
    ref.read(authStorageProvider),
    ref.read(googleSignInProvider),
  );
});

class AuthNotifier extends StateNotifier<AuthState> {
  final ApiClient _apiClient;
  final AuthStorage _authStorage;
  final GoogleSignIn _googleSignIn;

  AuthNotifier(this._apiClient, this._authStorage, this._googleSignIn)
      : super(AuthState.unknown()) {
    _apiClient.onUnauthorized = _handleUnauthorized;
    _init();
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
    } catch (_) {
      await _authStorage.clearToken();
      state = AuthState.unauthenticated();
    }
  }

  Future<bool> login() async {
    try {
      final googleUser = await _googleSignIn.signIn();
      if (googleUser == null) return false;

      final googleAuth = await googleUser.authentication;
      final idToken = googleAuth.idToken;
      if (idToken == null) return false;

      final response = await _apiClient.dio.post('/api/auth/mobile', data: {
        'idToken': idToken,
      });

      final jwt = response.data['token'] as String;
      final user = response.data['user'] as Map<String, dynamic>;

      await _authStorage.setToken(jwt);
      state = AuthState.authenticated(user);
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
