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
          indicatorColor: const Color(0xFFD4A574).withValues(alpha: 0.2),
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
