import 'package:flutter/material.dart';

/// Nudge design tokens — matches Web CSS variables
class AppColors {
  AppColors._();

  // Base
  static const background = Color(0xFF1C1B18);
  static const foreground = Color(0xFFEBE5D4);
  static const card = Color(0xFF2A2825);
  static const primary = Color(0xFFD4A574);
  static const onPrimary = Color(0xFF1C1B18);

  // Text
  static const textDim = Color(0xFF8A8578);
  static const textFaint = Color(0xFF6B6560);
  static const textMuted = Color(0xFFBBB5A0);

  // Borders
  static const border = Color(0xFF3A3835);

  // Status colors
  static const statusInbox = Color(0xFF8A8578);
  static const statusBacklog = Color(0xFF7A8B9C);
  static const statusInProgress = Color(0xFF5A9BC5);
  static const statusWaiting = Color(0xFF9A7B4F);
  static const statusDone = Color(0xFF5A7050);
  static const statusArchived = Color(0xFF6B6560);

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
}
