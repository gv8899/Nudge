# Phase 2：Flutter 基礎框架實作計畫

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 建立 Flutter App 骨架，能 Google 登入取得 JWT → 四個 Tab 頁面 → 登出

**Architecture:** Flutter 專案在 `mobile/` 子目錄。Riverpod 管理狀態，Dio 封裝 HTTP（自動帶 Bearer token），GoRouter 做路由（含 auth redirect guard），google_sign_in 做 Google 登入，flutter_secure_storage 存 JWT。

**Tech Stack:** Flutter 3.41, Dart 3.11, Riverpod, Dio, GoRouter, google_sign_in, flutter_secure_storage

---

## 檔案結構

| 操作 | 檔案 | 職責 |
|------|------|------|
| 建立 | `mobile/` | Flutter 專案根目錄 |
| 建立 | `mobile/lib/main.dart` | Entry point + ProviderScope |
| 建立 | `mobile/lib/app.dart` | MaterialApp.router + GoRouter |
| 建立 | `mobile/lib/core/constants.dart` | API base URL 等常數 |
| 建立 | `mobile/lib/core/auth_storage.dart` | JWT token 讀寫 |
| 建立 | `mobile/lib/core/api_client.dart` | Dio 封裝 |
| 建立 | `mobile/lib/features/auth/auth_provider.dart` | 登入狀態 provider |
| 建立 | `mobile/lib/features/auth/login_screen.dart` | Google 登入頁 |
| 建立 | `mobile/lib/features/tasks/tasks_screen.dart` | Placeholder |
| 建立 | `mobile/lib/features/notes/notes_screen.dart` | Placeholder |
| 建立 | `mobile/lib/features/cards/cards_screen.dart` | Placeholder |
| 建立 | `mobile/lib/features/settings/settings_screen.dart` | 登出功能 |
| 建立 | `mobile/lib/shell/app_shell.dart` | 底部 Tab Bar |
| 修改 | `.gitignore` | 加入 Flutter 忽略規則 |

---

### Task 1: Flutter 專案建立 + dependencies

- [ ] **Step 1: 建立 Flutter 專案**

```bash
cd /Users/mike/Documents/nudge
flutter create --org com.nudge mobile
```

- [ ] **Step 2: 安裝 dependencies**

```bash
cd mobile
flutter pub add flutter_riverpod dio google_sign_in flutter_secure_storage go_router
```

- [ ] **Step 3: 更新根目錄 .gitignore**

在 `/Users/mike/Documents/nudge/.gitignore` 底部加入：

```
# Flutter
mobile/.dart_tool/
mobile/.packages
mobile/build/
mobile/.flutter-plugins
mobile/.flutter-plugins-dependencies
mobile/ios/Pods/
mobile/ios/.symlinks/
mobile/android/.gradle/
mobile/android/local.properties
mobile/android/app/debug/
mobile/android/app/profile/
mobile/android/app/release/
```

- [ ] **Step 4: 驗證專案可執行**

```bash
cd /Users/mike/Documents/nudge/mobile
flutter analyze
```

預期：無錯誤（可能有 info 等級的提示，沒關係）。

- [ ] **Step 5: Commit**

```bash
cd /Users/mike/Documents/nudge
git add .gitignore mobile/
git commit -m "feat: 建立 Flutter 專案 + 安裝 dependencies"
```

---

### Task 2: Core — constants + auth_storage + api_client

**Files:**
- Create: `mobile/lib/core/constants.dart`
- Create: `mobile/lib/core/auth_storage.dart`
- Create: `mobile/lib/core/api_client.dart`

- [ ] **Step 1: 建立 constants.dart**

```dart
class Constants {
  Constants._();

  static const String apiBaseUrl = 'https://nudgee.zeabur.app';
}
```

- [ ] **Step 2: 建立 auth_storage.dart**

```dart
import 'package:flutter_secure_storage/flutter_secure_storage.dart';

class AuthStorage {
  static const _tokenKey = 'nudge_jwt';
  final FlutterSecureStorage _storage = const FlutterSecureStorage();

  Future<String?> getToken() => _storage.read(key: _tokenKey);

  Future<void> setToken(String token) =>
      _storage.write(key: _tokenKey, value: token);

  Future<void> clearToken() => _storage.delete(key: _tokenKey);
}
```

- [ ] **Step 3: 建立 api_client.dart**

```dart
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
```

- [ ] **Step 4: Commit**

```bash
cd /Users/mike/Documents/nudge
git add mobile/lib/core/
git commit -m "feat: core 層 — constants, auth_storage, api_client"
```

---

### Task 3: Auth Provider

**Files:**
- Create: `mobile/lib/features/auth/auth_provider.dart`

- [ ] **Step 1: 建立 auth_provider.dart**

```dart
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

// Singleton providers
final authStorageProvider = Provider<AuthStorage>((ref) => AuthStorage());

final apiClientProvider = Provider<ApiClient>((ref) {
  final storage = ref.read(authStorageProvider);
  return ApiClient(storage);
});

final googleSignInProvider = Provider<GoogleSignIn>((ref) => GoogleSignIn());

// Auth state
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
```

- [ ] **Step 2: Commit**

```bash
cd /Users/mike/Documents/nudge
git add mobile/lib/features/auth/auth_provider.dart
git commit -m "feat: AuthProvider — 登入狀態管理"
```

---

### Task 4: Login Screen

**Files:**
- Create: `mobile/lib/features/auth/login_screen.dart`

- [ ] **Step 1: 建立 login_screen.dart**

```dart
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'auth_provider.dart';

class LoginScreen extends ConsumerStatefulWidget {
  const LoginScreen({super.key});

  @override
  ConsumerState<LoginScreen> createState() => _LoginScreenState();
}

class _LoginScreenState extends ConsumerState<LoginScreen> {
  bool _isLoading = false;

  Future<void> _handleLogin() async {
    setState(() => _isLoading = true);
    final success = await ref.read(authProvider.notifier).login();
    if (mounted) {
      setState(() => _isLoading = false);
      if (!success) {
        ScaffoldMessenger.of(context).showSnackBar(
          const SnackBar(content: Text('登入失敗，請再試一次')),
        );
      }
    }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      body: Center(
        child: Column(
          mainAxisAlignment: MainAxisAlignment.center,
          children: [
            Text(
              'Nudge',
              style: Theme.of(context).textTheme.headlineLarge?.copyWith(
                    fontWeight: FontWeight.bold,
                  ),
            ),
            const SizedBox(height: 8),
            Text(
              '輕量型每日任務推進工具',
              style: Theme.of(context).textTheme.bodyMedium?.copyWith(
                    color: Colors.grey,
                  ),
            ),
            const SizedBox(height: 48),
            _isLoading
                ? const CircularProgressIndicator()
                : ElevatedButton.icon(
                    onPressed: _handleLogin,
                    icon: const Icon(Icons.login, size: 20),
                    label: const Text('使用 Google 帳號登入'),
                    style: ElevatedButton.styleFrom(
                      padding: const EdgeInsets.symmetric(
                          horizontal: 24, vertical: 14),
                    ),
                  ),
          ],
        ),
      ),
    );
  }
}
```

- [ ] **Step 2: Commit**

```bash
cd /Users/mike/Documents/nudge
git add mobile/lib/features/auth/login_screen.dart
git commit -m "feat: 登入頁 UI"
```

---

### Task 5: Placeholder Screens + Settings (logout)

**Files:**
- Create: `mobile/lib/features/tasks/tasks_screen.dart`
- Create: `mobile/lib/features/notes/notes_screen.dart`
- Create: `mobile/lib/features/cards/cards_screen.dart`
- Create: `mobile/lib/features/settings/settings_screen.dart`

- [ ] **Step 1: 建立 tasks_screen.dart**

```dart
import 'package:flutter/material.dart';

class TasksScreen extends StatelessWidget {
  const TasksScreen({super.key});

  @override
  Widget build(BuildContext context) {
    return const Scaffold(
      body: Center(child: Text('行動', style: TextStyle(fontSize: 18))),
    );
  }
}
```

- [ ] **Step 2: 建立 notes_screen.dart**

```dart
import 'package:flutter/material.dart';

class NotesScreen extends StatelessWidget {
  const NotesScreen({super.key});

  @override
  Widget build(BuildContext context) {
    return const Scaffold(
      body: Center(child: Text('日誌', style: TextStyle(fontSize: 18))),
    );
  }
}
```

- [ ] **Step 3: 建立 cards_screen.dart**

```dart
import 'package:flutter/material.dart';

class CardsScreen extends StatelessWidget {
  const CardsScreen({super.key});

  @override
  Widget build(BuildContext context) {
    return const Scaffold(
      body: Center(child: Text('卡片', style: TextStyle(fontSize: 18))),
    );
  }
}
```

- [ ] **Step 4: 建立 settings_screen.dart（含登出）**

```dart
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import '../auth/auth_provider.dart';

class SettingsScreen extends ConsumerWidget {
  const SettingsScreen({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final authState = ref.watch(authProvider);

    return Scaffold(
      body: SafeArea(
        child: Padding(
          padding: const EdgeInsets.all(16),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              const SizedBox(height: 16),
              Text(
                '設定',
                style: Theme.of(context).textTheme.headlineSmall?.copyWith(
                      fontWeight: FontWeight.bold,
                    ),
              ),
              const SizedBox(height: 24),
              if (authState.user != null) ...[
                Text(
                  authState.user!['name'] ?? '未命名',
                  style: Theme.of(context).textTheme.titleMedium,
                ),
                const SizedBox(height: 4),
                Text(
                  authState.user!['email'] ?? '',
                  style: Theme.of(context).textTheme.bodySmall?.copyWith(
                        color: Colors.grey,
                      ),
                ),
                const SizedBox(height: 32),
              ],
              SizedBox(
                width: double.infinity,
                child: OutlinedButton.icon(
                  onPressed: () => ref.read(authProvider.notifier).logout(),
                  icon: const Icon(Icons.logout, size: 18),
                  label: const Text('登出'),
                  style: OutlinedButton.styleFrom(
                    foregroundColor: Colors.redAccent,
                    side: const BorderSide(color: Colors.redAccent),
                    padding: const EdgeInsets.symmetric(vertical: 12),
                  ),
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }
}
```

- [ ] **Step 5: Commit**

```bash
cd /Users/mike/Documents/nudge
git add mobile/lib/features/
git commit -m "feat: placeholder screens + 設定頁登出"
```

---

### Task 6: App Shell (Tab Bar)

**Files:**
- Create: `mobile/lib/shell/app_shell.dart`

- [ ] **Step 1: 建立 app_shell.dart**

```dart
import 'package:flutter/material.dart';

class AppShell extends StatelessWidget {
  final int currentIndex;
  final Widget child;
  final ValueChanged<int> onTabChanged;

  const AppShell({
    super.key,
    required this.currentIndex,
    required this.child,
    required this.onTabChanged,
  });

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      body: child,
      bottomNavigationBar: NavigationBar(
        selectedIndex: currentIndex,
        onDestinationSelected: onTabChanged,
        destinations: const [
          NavigationDestination(
            icon: Icon(Icons.check_circle_outline),
            selectedIcon: Icon(Icons.check_circle),
            label: '行動',
          ),
          NavigationDestination(
            icon: Icon(Icons.edit_note_outlined),
            selectedIcon: Icon(Icons.edit_note),
            label: '日誌',
          ),
          NavigationDestination(
            icon: Icon(Icons.style_outlined),
            selectedIcon: Icon(Icons.style),
            label: '卡片',
          ),
          NavigationDestination(
            icon: Icon(Icons.settings_outlined),
            selectedIcon: Icon(Icons.settings),
            label: '設定',
          ),
        ],
      ),
    );
  }
}
```

- [ ] **Step 2: Commit**

```bash
cd /Users/mike/Documents/nudge
git add mobile/lib/shell/
git commit -m "feat: AppShell 底部 Tab Bar"
```

---

### Task 7: App Router + Main

**Files:**
- Create: `mobile/lib/app.dart`
- Rewrite: `mobile/lib/main.dart`

- [ ] **Step 1: 建立 app.dart**

```dart
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import 'features/auth/auth_provider.dart';
import 'features/auth/login_screen.dart';
import 'features/tasks/tasks_screen.dart';
import 'features/notes/notes_screen.dart';
import 'features/cards/cards_screen.dart';
import 'features/settings/settings_screen.dart';
import 'shell/app_shell.dart';

final _shellNavigatorKey = GlobalKey<NavigatorState>();

final routerProvider = Provider<GoRouter>((ref) {
  final authState = ref.watch(authProvider);

  return GoRouter(
    initialLocation: '/',
    redirect: (context, state) {
      final isAuthenticated = authState.status == AuthStatus.authenticated;
      final isLoginRoute = state.matchedLocation == '/login';

      if (authState.status == AuthStatus.unknown) return null;
      if (!isAuthenticated && !isLoginRoute) return '/login';
      if (isAuthenticated && isLoginRoute) return '/';
      return null;
    },
    routes: [
      GoRoute(
        path: '/login',
        builder: (context, state) => const LoginScreen(),
      ),
      StatefulShellRoute.indexedStack(
        builder: (context, state, navigationShell) {
          return AppShell(
            currentIndex: navigationShell.currentIndex,
            onTabChanged: (index) => navigationShell.goBranch(index),
            child: navigationShell,
          );
        },
        branches: [
          StatefulShellBranch(
            routes: [
              GoRoute(
                path: '/',
                builder: (context, state) => const TasksScreen(),
              ),
            ],
          ),
          StatefulShellBranch(
            routes: [
              GoRoute(
                path: '/notes',
                builder: (context, state) => const NotesScreen(),
              ),
            ],
          ),
          StatefulShellBranch(
            routes: [
              GoRoute(
                path: '/cards',
                builder: (context, state) => const CardsScreen(),
              ),
            ],
          ),
          StatefulShellBranch(
            routes: [
              GoRoute(
                path: '/settings',
                builder: (context, state) => const SettingsScreen(),
              ),
            ],
          ),
        ],
      ),
    ],
  );
});

class NudgeApp extends ConsumerWidget {
  const NudgeApp({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final router = ref.watch(routerProvider);

    return MaterialApp.router(
      title: 'Nudge',
      debugShowCheckedModeBanner: false,
      theme: ThemeData(
        brightness: Brightness.dark,
        scaffoldBackgroundColor: const Color(0xFF1C1B18),
        colorScheme: ColorScheme.dark(
          surface: const Color(0xFF1C1B18),
          primary: const Color(0xFFD4A574),
          onPrimary: const Color(0xFF1C1B18),
          secondary: const Color(0xFF2A2825),
          onSurface: const Color(0xFFEBE5D4),
        ),
        navigationBarTheme: NavigationBarThemeData(
          backgroundColor: const Color(0xFF2A2825),
          indicatorColor: const Color(0xFFD4A574).withOpacity(0.2),
          labelTextStyle: WidgetStateProperty.resolveWith((states) {
            if (states.contains(WidgetState.selected)) {
              return const TextStyle(
                fontSize: 11,
                fontWeight: FontWeight.w600,
                color: Color(0xFFD4A574),
              );
            }
            return const TextStyle(
              fontSize: 11,
              color: Color(0xFF8A8578),
            );
          }),
          iconTheme: WidgetStateProperty.resolveWith((states) {
            if (states.contains(WidgetState.selected)) {
              return const IconThemeData(color: Color(0xFFD4A574), size: 22);
            }
            return const IconThemeData(color: Color(0xFF8A8578), size: 22);
          }),
        ),
        textTheme: const TextTheme(
          headlineLarge: TextStyle(color: Color(0xFFEBE5D4)),
          headlineSmall: TextStyle(color: Color(0xFFEBE5D4)),
          titleMedium: TextStyle(color: Color(0xFFEBE5D4)),
          bodyMedium: TextStyle(color: Color(0xFFEBE5D4)),
          bodySmall: TextStyle(color: Color(0xFF8A8578)),
        ),
      ),
      routerConfig: router,
    );
  }
}
```

- [ ] **Step 2: 重寫 main.dart**

替換 `mobile/lib/main.dart` 為：

```dart
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'app.dart';

void main() {
  WidgetsFlutterBinding.ensureInitialized();
  runApp(const ProviderScope(child: NudgeApp()));
}
```

- [ ] **Step 3: 驗證編譯**

```bash
cd /Users/mike/Documents/nudge/mobile
flutter analyze
```

預期：無錯誤。

- [ ] **Step 4: Commit**

```bash
cd /Users/mike/Documents/nudge
git add mobile/lib/main.dart mobile/lib/app.dart
git commit -m "feat: GoRouter + main entry point + dark theme"
```

---

### Task 8: Google Sign-In 平台設定

- [ ] **Step 1: iOS 設定**

在 `mobile/ios/Runner/Info.plist` 的 `<dict>` 裡加入（在其他 key 之前）：

```xml
<key>CFBundleURLTypes</key>
<array>
  <dict>
    <key>CFBundleTypeRole</key>
    <string>Editor</string>
    <key>CFBundleURLSchemes</key>
    <array>
      <string>com.googleusercontent.apps.465373997523-1kl8dj47nhs98tci67tpk4fc9fba30u2</string>
    </array>
  </dict>
</array>
```

注意：URL scheme 是 Google Client ID 反轉：`com.googleusercontent.apps.<CLIENT_ID>`

- [ ] **Step 2: Android 設定**

確認 `mobile/android/app/build.gradle.kts` 的 `minSdk` 至少 21（Flutter 預設已滿足）。

google_sign_in 在 Android 上使用 Web client ID，不需要額外的 google-services.json（因為我們只用 idToken 驗證，不用 Firebase）。

在 `mobile/android/app/src/main/AndroidManifest.xml` 確認有 internet permission（Flutter 預設已有）。

- [ ] **Step 3: Commit**

```bash
cd /Users/mike/Documents/nudge
git add mobile/ios/Runner/Info.plist mobile/android/
git commit -m "feat: Google Sign-In 平台設定（iOS + Android）"
```

---

### Task 9: 驗證 + 測試

- [ ] **Step 1: Flutter analyze**

```bash
cd /Users/mike/Documents/nudge/mobile
flutter analyze
```

預期：無錯誤。

- [ ] **Step 2: 列出手動測試步驟**

我只驗證了 analyze 通過，實際互動流程沒有跑過。請在 iOS simulator 或 Android emulator 測試以下步驟：

**啟動：**
```bash
cd /Users/mike/Documents/nudge/mobile
flutter run
```

**測試流程：**
1. App 啟動 → 顯示登入頁（Nudge 標題 + Google 登入按鈕）
2. 點「使用 Google 帳號登入」→ Google 登入流程 → 成功後進入主頁
3. 底部 Tab Bar 有四個 tab：行動、日誌、卡片、設定
4. 點各 tab → 切換正常
5. 設定 tab → 顯示名稱、email → 點「登出」→ 回到登入頁
6. 重開 App → 自動登入（不用再點 Google 登入）
7. 殺掉 App 重開 → 同上

- [ ] **Step 3: 最終 commit**

```bash
cd /Users/mike/Documents/nudge
git add -A
git commit -m "feat: Phase 2 完成 — Flutter 基礎框架"
git push
```
