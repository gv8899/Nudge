import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import 'core/theme.dart';
import 'features/auth/auth_provider.dart';
import 'features/auth/login_screen.dart';
import 'features/tasks/tasks_screen.dart';
import 'features/notes/notes_screen.dart';
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
        scaffoldBackgroundColor: AppColors.background,
        colorScheme: ColorScheme.dark(
          surface: AppColors.background,
          primary: AppColors.primary,
          onPrimary: AppColors.onPrimary,
          secondary: AppColors.card,
          onSurface: AppColors.foreground,
        ),
        navigationBarTheme: NavigationBarThemeData(
          backgroundColor: AppColors.card,
          indicatorColor: AppColors.primary.withValues(alpha: 0.2),
          labelTextStyle: WidgetStateProperty.resolveWith((states) {
            if (states.contains(WidgetState.selected)) {
              return const TextStyle(
                fontSize: 11,
                fontWeight: FontWeight.w600,
                color: AppColors.primary,
              );
            }
            return const TextStyle(
              fontSize: 11,
              color: AppColors.textDim,
            );
          }),
          iconTheme: WidgetStateProperty.resolveWith((states) {
            if (states.contains(WidgetState.selected)) {
              return const IconThemeData(color: AppColors.primary, size: 22);
            }
            return const IconThemeData(color: AppColors.textDim, size: 22);
          }),
        ),
        textTheme: const TextTheme(
          headlineLarge: TextStyle(color: AppColors.foreground),
          headlineSmall: TextStyle(color: AppColors.foreground),
          titleMedium: TextStyle(color: AppColors.foreground),
          bodyMedium: TextStyle(color: AppColors.foreground),
          bodySmall: TextStyle(color: AppColors.textDim),
        ),
      ),
      routerConfig: router,
    );
  }
}
