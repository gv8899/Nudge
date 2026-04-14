import 'package:flutter/material.dart';
import 'package:flutter_localizations/flutter_localizations.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_quill/flutter_quill.dart';
import 'package:go_router/go_router.dart';
import 'core/locale_provider.dart';
import 'core/theme.dart';
import 'core/theme_provider.dart';
import 'features/auth/auth_provider.dart';
import 'l10n/app_localizations.dart';
import 'features/auth/login_screen.dart';
import 'features/tasks/tasks_screen.dart';
import 'features/notes/notes_screen.dart';
import 'features/notes/notes_feed_screen.dart';
import 'features/cards/cards_screen.dart';
import 'features/cards/card_detail_screen.dart';
import 'features/settings/settings_screen.dart';
import 'shell/app_shell.dart';

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
                routes: [
                  GoRoute(
                    path: 'task/:id',
                    builder: (context, state) => CardDetailScreen(
                      taskId: state.pathParameters['id']!,
                    ),
                  ),
                ],
              ),
            ],
          ),
          StatefulShellBranch(
            routes: [
              GoRoute(
                path: '/cards',
                builder: (context, state) => const CardsScreen(),
                routes: [
                  GoRoute(
                    path: ':id',
                    builder: (context, state) => CardDetailScreen(
                      taskId: state.pathParameters['id']!,
                    ),
                  ),
                ],
              ),
            ],
          ),
          StatefulShellBranch(
            routes: [
              GoRoute(
                path: '/notes',
                builder: (context, state) => const NotesScreen(),
                routes: [
                  GoRoute(
                    path: 'feed',
                    builder: (context, state) => const NotesFeedScreen(),
                  ),
                ],
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
    final themeMode = ref.watch(themeProvider);
    final brightness = resolveThemeBrightness(themeMode);
    final userLocale = ref.watch(localeProvider);

    // Set AppColors before building so static getters return correct values
    AppColors.setDark(brightness == Brightness.dark);

    return MaterialApp.router(
      title: 'Nudge',
      debugShowCheckedModeBanner: false,
      theme: AppColors.buildThemeData(brightness),
      locale: userLocale,
      localizationsDelegates: const [
        AppL10n.delegate,
        GlobalMaterialLocalizations.delegate,
        GlobalWidgetsLocalizations.delegate,
        GlobalCupertinoLocalizations.delegate,
        FlutterQuillLocalizations.delegate,
      ],
      supportedLocales: const [
        Locale('zh'),
        Locale('en'),
        Locale('ja'),
      ],
      routerConfig: router,
    );
  }
}
