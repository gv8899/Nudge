import 'package:flutter/material.dart';

/// Nudge design tokens — matches Web CSS variables.
/// Light and dark variants mirror globals.css :root and .dark blocks.
class AppColors {
  AppColors._();

  // ── Dark mode (default, matches .dark in globals.css) ──
  static const _darkBackground = Color(0xFF1C1B18);
  static const _darkForeground = Color(0xFFEBE5D4);
  static const _darkCard = Color(0xFF2A2825);
  static const _darkPrimary = Color(0xFFC89968);
  static const _darkOnPrimary = Color(0xFF1C1B18);
  static const _darkTextDim = Color(0xFF9B9485);
  static const _darkTextFaint = Color(0xFF7A7567);
  static const _darkTextMuted = Color(0xFFBBB5A0);
  static const _darkBorder = Color(0xFF3A3833);
  static const _darkMuted = Color(0xFF2C2A25);
  static const _darkDestructive = Color(0xFFB56B5A);

  // ── Light mode (matches :root in globals.css) ──
  static const _lightBackground = Color(0xFFEFE9D4);
  static const _lightForeground = Color(0xFF1C1B18);
  static const _lightCard = Color(0xFFE6DFC6);
  static const _lightPrimary = Color(0xFFA87A45);
  static const _lightOnPrimary = Color(0xFFEFE9D4);
  static const _lightTextDim = Color(0xFF6E6855);
  static const _lightTextFaint = Color(0xFF8A8068);
  static const _lightTextMuted = Color(0xFF6E6855);
  static const _lightBorder = Color(0xFFC8C0A0);
  static const _lightMuted = Color(0xFFDDD6BA);
  static const _lightDestructive = Color(0xFF9A4F3F);

  // ── Current theme (set by NudgeApp on build) ──
  static bool _isDark = true;

  static void setDark(bool isDark) => _isDark = isDark;

  // Base
  static Color get background => _isDark ? _darkBackground : _lightBackground;
  static Color get foreground => _isDark ? _darkForeground : _lightForeground;
  static Color get card => _isDark ? _darkCard : _lightCard;
  static Color get primary => _isDark ? _darkPrimary : _lightPrimary;
  static Color get onPrimary => _isDark ? _darkOnPrimary : _lightOnPrimary;

  // Text
  static Color get textDim => _isDark ? _darkTextDim : _lightTextDim;
  static Color get textFaint => _isDark ? _darkTextFaint : _lightTextFaint;
  static Color get textMuted => _isDark ? _darkTextMuted : _lightTextMuted;

  // Borders
  static Color get border => _isDark ? _darkBorder : _lightBorder;

  // Misc
  static Color get muted => _isDark ? _darkMuted : _lightMuted;
  static Color get destructive => _isDark ? _darkDestructive : _lightDestructive;

  // Status colors (same in both modes, matching web)
  static Color get statusInbox => _isDark ? const Color(0xFF9B9080) : const Color(0xFF7A7060);
  static Color get statusBacklog => _isDark ? const Color(0xFF7A8B9C) : const Color(0xFF5A6B7C);
  static Color get statusInProgress => _isDark ? const Color(0xFFC89968) : const Color(0xFFA87A45);
  static Color get statusWaiting => _isDark ? const Color(0xFFA78AAF) : const Color(0xFF8A6D92);
  static Color get statusDone => _isDark ? const Color(0xFF8AA57D) : const Color(0xFF5A7050);
  static Color get statusArchived => _isDark ? const Color(0xFF807A6C) : const Color(0xFF7A7466);

  static Color statusColor(String status) {
    switch (status) {
      case 'inbox':
        return statusInbox;
      case 'backlog':
        return statusBacklog;
      case 'in_progress':
        return statusInProgress;
      case 'waiting':
        return statusWaiting;
      case 'done':
        return statusDone;
      case 'archived':
        return statusArchived;
      default:
        return statusInbox;
    }
  }

  /// Build Flutter ThemeData for current brightness
  static ThemeData buildThemeData(Brightness brightness) {
    final isDark = brightness == Brightness.dark;
    setDark(isDark);

    return ThemeData(
      brightness: brightness,
      scaffoldBackgroundColor: background,
      colorScheme: isDark
          ? ColorScheme.dark(
              surface: background,
              primary: primary,
              onPrimary: onPrimary,
              secondary: card,
              onSurface: foreground,
            )
          : ColorScheme.light(
              surface: background,
              primary: primary,
              onPrimary: onPrimary,
              secondary: card,
              onSurface: foreground,
            ),
      navigationBarTheme: NavigationBarThemeData(
        backgroundColor: card,
        indicatorColor: primary.withValues(alpha: 0.2),
        labelTextStyle: WidgetStateProperty.resolveWith((states) {
          if (states.contains(WidgetState.selected)) {
            return TextStyle(fontSize: 11, fontWeight: FontWeight.w600, color: primary);
          }
          return TextStyle(fontSize: 11, color: textDim);
        }),
        iconTheme: WidgetStateProperty.resolveWith((states) {
          if (states.contains(WidgetState.selected)) {
            return IconThemeData(color: primary, size: 22);
          }
          return IconThemeData(color: textDim, size: 22);
        }),
      ),
      textTheme: TextTheme(
        headlineLarge: TextStyle(color: foreground),
        headlineSmall: TextStyle(color: foreground),
        titleMedium: TextStyle(color: foreground),
        bodyMedium: TextStyle(color: foreground),
        bodySmall: TextStyle(color: textDim),
      ),
    );
  }
}
