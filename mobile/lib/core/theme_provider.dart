import 'package:flutter/material.dart';
import 'package:flutter/scheduler.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:shared_preferences/shared_preferences.dart';

/// Theme modes matching web: light, dark, system
enum AppThemeMode { light, dark, system }

const _storageKey = 'nudge:theme-mode';

final themeProvider = NotifierProvider<ThemeNotifier, AppThemeMode>(
  ThemeNotifier.new,
);

class ThemeNotifier extends Notifier<AppThemeMode> {
  @override
  AppThemeMode build() {
    _load();
    return AppThemeMode.system;
  }

  Future<void> _load() async {
    final prefs = await SharedPreferences.getInstance();
    final stored = prefs.getString(_storageKey);
    if (stored != null) {
      final mode = AppThemeMode.values.firstWhere(
        (m) => m.name == stored,
        orElse: () => AppThemeMode.system,
      );
      state = mode;
    }
  }

  Future<void> setTheme(AppThemeMode mode) async {
    state = mode;
    final prefs = await SharedPreferences.getInstance();
    await prefs.setString(_storageKey, mode.name);
  }
}

/// Resolves AppThemeMode to actual Brightness
Brightness resolveThemeBrightness(AppThemeMode mode) {
  switch (mode) {
    case AppThemeMode.light:
      return Brightness.light;
    case AppThemeMode.dark:
      return Brightness.dark;
    case AppThemeMode.system:
      return SchedulerBinding.instance.platformDispatcher.platformBrightness;
  }
}
