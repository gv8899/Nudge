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

  static bool get isDark => _isDark;
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

    final cs = isDark
        ? ColorScheme.dark(
            surface: background,
            onSurface: foreground,
            surfaceContainerHighest: card,
            onSurfaceVariant: textDim,
            primary: primary,
            onPrimary: onPrimary,
            secondary: card,
            onSecondary: foreground,
            error: destructive,
            onError: onPrimary,
            outline: border,
            outlineVariant: border,
          )
        : ColorScheme.light(
            surface: background,
            onSurface: foreground,
            surfaceContainerHighest: card,
            onSurfaceVariant: textDim,
            primary: primary,
            onPrimary: onPrimary,
            secondary: card,
            onSecondary: foreground,
            error: destructive,
            onError: onPrimary,
            outline: border,
            outlineVariant: border,
          );

    return ThemeData(
      brightness: brightness,
      scaffoldBackgroundColor: background,
      canvasColor: background,
      dividerColor: border,
      colorScheme: cs,

      // Text / icon defaults
      iconTheme: IconThemeData(color: foreground),
      primaryIconTheme: IconThemeData(color: foreground),

      textTheme: TextTheme(
        displayLarge: TextStyle(color: foreground),
        displayMedium: TextStyle(color: foreground),
        displaySmall: TextStyle(color: foreground),
        headlineLarge: TextStyle(color: foreground),
        headlineMedium: TextStyle(color: foreground),
        headlineSmall: TextStyle(color: foreground),
        titleLarge: TextStyle(color: foreground),
        titleMedium: TextStyle(color: foreground),
        titleSmall: TextStyle(color: foreground),
        bodyLarge: TextStyle(color: foreground),
        bodyMedium: TextStyle(color: foreground),
        bodySmall: TextStyle(color: textDim),
        labelLarge: TextStyle(color: foreground),
        labelMedium: TextStyle(color: foreground),
        labelSmall: TextStyle(color: textDim),
      ),

      // AppBar
      appBarTheme: AppBarTheme(
        backgroundColor: background,
        foregroundColor: foreground,
        elevation: 0,
        scrolledUnderElevation: 0,
        iconTheme: IconThemeData(color: foreground),
        titleTextStyle: TextStyle(color: foreground, fontSize: 18, fontWeight: FontWeight.w600),
      ),

      // ListTile
      listTileTheme: ListTileThemeData(
        textColor: foreground,
        iconColor: textDim,
        titleTextStyle: TextStyle(color: foreground, fontSize: 14),
        subtitleTextStyle: TextStyle(color: textDim, fontSize: 12),
      ),

      // Dialog
      dialogTheme: DialogThemeData(
        backgroundColor: card,
        titleTextStyle: TextStyle(color: foreground, fontSize: 16, fontWeight: FontWeight.w600),
        contentTextStyle: TextStyle(color: textDim, fontSize: 14),
      ),

      // Bottom sheet
      bottomSheetTheme: BottomSheetThemeData(
        backgroundColor: card,
        surfaceTintColor: Colors.transparent,
        modalBackgroundColor: card,
        modalBarrierColor: Colors.black.withValues(alpha: 0.4),
      ),

      // Buttons
      textButtonTheme: TextButtonThemeData(
        style: TextButton.styleFrom(foregroundColor: primary),
      ),
      outlinedButtonTheme: OutlinedButtonThemeData(
        style: OutlinedButton.styleFrom(
          foregroundColor: foreground,
          side: BorderSide(color: border),
        ),
      ),
      iconButtonTheme: IconButtonThemeData(
        style: IconButton.styleFrom(foregroundColor: foreground),
      ),

      // Input fields
      inputDecorationTheme: InputDecorationTheme(
        hintStyle: TextStyle(color: textFaint),
        labelStyle: TextStyle(color: textDim),
        floatingLabelStyle: TextStyle(color: primary),
        border: UnderlineInputBorder(borderSide: BorderSide(color: border)),
        enabledBorder: UnderlineInputBorder(borderSide: BorderSide(color: border)),
        focusedBorder: UnderlineInputBorder(borderSide: BorderSide(color: primary)),
      ),
      textSelectionTheme: TextSelectionThemeData(
        cursorColor: primary,
        selectionColor: primary.withValues(alpha: 0.3),
        selectionHandleColor: primary,
      ),

      // Card
      cardTheme: CardThemeData(
        color: card,
        surfaceTintColor: Colors.transparent,
      ),

      // Divider
      dividerTheme: DividerThemeData(color: border, thickness: 1),

      // Progress indicator
      progressIndicatorTheme: ProgressIndicatorThemeData(color: primary),

      // Navigation bar (bottom nav)
      navigationBarTheme: NavigationBarThemeData(
        backgroundColor: card,
        indicatorColor: primary.withValues(alpha: 0.2),
        surfaceTintColor: Colors.transparent,
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

      // Snackbar
      snackBarTheme: SnackBarThemeData(
        backgroundColor: card,
        contentTextStyle: TextStyle(color: foreground),
        actionTextColor: primary,
      ),
    );
  }
}
