# Phase 2：Flutter 基礎框架設計

## 摘要

建立 Flutter 專案骨架（位於 `mobile/` 子目錄），包含 Google 登入、JWT token 管理、Dio HTTP client、Riverpod 狀態管理、底部 Tab Bar 導航。完成後能登入 → 看到四個 tab → 登出。

## 技術選型

| 項目 | 決定 | 理由 |
|------|------|------|
| 專案位置 | `mobile/`（同 repo 子目錄） | 一人開發，一個 repo 最好管理 |
| 狀態管理 | Riverpod | Type-safe、testable、適合管理 API + 快取 |
| HTTP client | Dio | 攔截器統一處理 token 和 error |
| Token 儲存 | flutter_secure_storage | 加密儲存 JWT |
| Google 登入 | google_sign_in | Flutter 官方推薦 |
| 導航 | GoRouter | 宣告式路由，支援 redirect guard |

## 資料夾結構

```
mobile/
├── lib/
│   ├── main.dart                    — App entry point + ProviderScope
│   ├── app.dart                     — MaterialApp.router + GoRouter
│   ├── core/
│   │   ├── api_client.dart          — Dio 封裝（base URL、Bearer token、error handling）
│   │   ├── auth_storage.dart        — JWT token 讀寫（flutter_secure_storage）
│   │   └── constants.dart           — API base URL 等常數
│   ├── features/
│   │   ├── auth/
│   │   │   ├── auth_provider.dart   — 登入狀態 Riverpod provider
│   │   │   └── login_screen.dart    — Google 登入頁
│   │   ├── tasks/
│   │   │   └── tasks_screen.dart    — Placeholder（Phase 3）
│   │   ├── notes/
│   │   │   └── notes_screen.dart    — Placeholder（Phase 4）
│   │   ├── cards/
│   │   │   └── cards_screen.dart    — Placeholder（Phase 5）
│   │   └── settings/
│   │       └── settings_screen.dart — 登出功能
│   └── shell/
│       └── app_shell.dart           — 底部 Tab Bar + 頁面切換
├── pubspec.yaml
├── android/
├── ios/
└── ...
```

## Auth Flow

### 啟動流程
1. App 啟動 → `AuthProvider` 從 `flutter_secure_storage` 讀 JWT
2. 有 token → 用 Dio 打 `GET /api/me` 驗證
3. 驗證成功 → 設定 `AuthState.authenticated` → GoRouter redirect 到主頁
4. 驗證失敗（401 / network error） → 清除 token → 導到登入頁
5. 沒有 token → 直接導到登入頁

### 登入流程
1. 使用者點「使用 Google 帳號登入」
2. `google_sign_in` SDK 啟動 Google 登入 → 取得 `idToken`
3. POST `/api/auth/mobile` body: `{ "idToken": "<token>" }`
4. 後端驗證 → 回傳 `{ "token": "<jwt>", "user": { id, email, name, avatarUrl } }`
5. JWT 存入 `flutter_secure_storage`
6. 設定 `AuthState.authenticated` → 自動導到主頁

### 登出流程
1. 設定頁點「登出」
2. 清除 `flutter_secure_storage` 的 JWT
3. `google_sign_in` signOut
4. 設定 `AuthState.unauthenticated` → GoRouter redirect 到登入頁

## Dio 封裝

### `ApiClient`（`core/api_client.dart`）

```dart
class ApiClient {
  late final Dio dio;
  final AuthStorage authStorage;

  ApiClient(this.authStorage) {
    dio = Dio(BaseOptions(baseUrl: Constants.apiBaseUrl));

    // Request interceptor：自動帶 Bearer token
    dio.interceptors.add(InterceptorsWrapper(
      onRequest: (options, handler) async {
        final token = await authStorage.getToken();
        if (token != null) {
          options.headers['Authorization'] = 'Bearer $token';
        }
        handler.next(options);
      },
      onError: (error, handler) {
        // 401 時通知 auth provider 清 token
        if (error.response?.statusCode == 401) {
          // 觸發登出邏輯
        }
        handler.next(error);
      },
    ));
  }
}
```

### `AuthStorage`（`core/auth_storage.dart`）

```dart
class AuthStorage {
  static const _tokenKey = 'nudge_jwt';
  final FlutterSecureStorage _storage = const FlutterSecureStorage();

  Future<String?> getToken() => _storage.read(key: _tokenKey);
  Future<void> setToken(String token) => _storage.write(key: _tokenKey, value: token);
  Future<void> clearToken() => _storage.delete(key: _tokenKey);
}
```

## Riverpod Providers

### `AuthProvider`

```dart
enum AuthStatus { unknown, authenticated, unauthenticated }

class AuthState {
  final AuthStatus status;
  final User? user;
}

class AuthNotifier extends AsyncNotifier<AuthState> {
  // build() → 檢查 token → 驗證 → 回傳 state
  // login() → Google Sign-In → POST /api/auth/mobile → 存 token
  // logout() → 清 token → signOut
}
```

### Provider 依賴
```
authStorageProvider → AuthStorage 實例
apiClientProvider → ApiClient（依賴 authStorage）
authProvider → AuthNotifier（依賴 apiClient + authStorage）
```

## 路由（GoRouter）

```dart
GoRouter(
  redirect: (context, state) {
    final auth = ref.read(authProvider);
    final isLogin = state.matchedLocation == '/login';

    if (auth is unauthenticated && !isLogin) return '/login';
    if (auth is authenticated && isLogin) return '/';
    return null;
  },
  routes: [
    GoRoute(path: '/login', builder: → LoginScreen),
    ShellRoute(
      builder: → AppShell (Tab Bar),
      routes: [
        GoRoute(path: '/', builder: → TasksScreen),
        GoRoute(path: '/notes', builder: → NotesScreen),
        GoRoute(path: '/cards', builder: → CardsScreen),
        GoRoute(path: '/settings', builder: → SettingsScreen),
      ],
    ),
  ],
)
```

## 底部 Tab Bar

| Tab | Icon | Label | 路由 |
|-----|------|-------|------|
| 行動 | Icons.check_circle_outline | 行動 | `/` |
| 日誌 | Icons.edit_note | 日誌 | `/notes` |
| 卡片 | Icons.style | 卡片 | `/cards` |
| 設定 | Icons.settings | 設定 | `/settings` |

## 主題

Phase 2 先用固定 dark theme，配色參考 Web 的 design token：
- Background: `#1c1b18`
- Foreground: `#ebe5d4`
- Primary: Web 的 `--primary` 值
- Card: `#2a2825`

## Dependencies（pubspec.yaml）

```yaml
dependencies:
  flutter:
    sdk: flutter
  flutter_riverpod: ^2.5.0
  riverpod_annotation: ^2.3.0
  dio: ^5.4.0
  google_sign_in: ^6.2.0
  flutter_secure_storage: ^9.2.0
  go_router: ^14.0.0

dev_dependencies:
  flutter_test:
    sdk: flutter
  riverpod_generator: ^2.4.0
  build_runner: ^2.4.0
```

## Google Sign-In 設定

### iOS
`ios/Runner/Info.plist` 加入 reversed client ID（從 Google Cloud Console 下載 `GoogleService-Info.plist`）

### Android
`android/app/src/main/res/values/strings.xml` 加入 web client ID
`android/app/build.gradle` 加入 google-services plugin

### Google Cloud Console
OAuth 2.0 Client 需要新增：
- iOS client ID（bundle ID）
- Android client ID（SHA-1 fingerprint + package name）
- 或直接用現有的 Web client ID（google_sign_in 支援）

## 不做

- 任何業務功能 UI（Phase 3-5）
- 離線快取
- 推播通知
- 主題切換（先固定 dark theme）
- Refresh token 機制（JWT 30 天到期，到期重新登入）

## 完成標準

- [ ] `flutter run` 能在 iOS simulator / Android emulator 啟動
- [ ] Google 登入 → 取得 JWT → 進入主頁
- [ ] 四個 tab 正常切換
- [ ] 設定頁登出 → 回到登入頁
- [ ] 重開 App 自動登入（token 未過期）
- [ ] 401 時自動導回登入頁
- [ ] 登入頁未登入時無法訪問主頁（redirect guard）
