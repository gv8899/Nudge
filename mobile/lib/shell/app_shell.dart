import 'package:flutter/material.dart';
import 'package:lucide_icons/lucide_icons.dart';
import '../l10n/app_localizations.dart';

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
    final l = AppL10n.of(context)!;
    return Scaffold(
      body: child,
      bottomNavigationBar: NavigationBar(
        selectedIndex: currentIndex,
        onDestinationSelected: onTabChanged,
        destinations: [
          NavigationDestination(
            icon: Icon(LucideIcons.checkSquare),
            selectedIcon: Icon(LucideIcons.checkSquare),
            label: l.navTasks,
          ),
          NavigationDestination(
            icon: Icon(LucideIcons.fileEdit),
            selectedIcon: Icon(LucideIcons.fileEdit),
            label: l.navNotes,
          ),
          NavigationDestination(
            icon: Icon(LucideIcons.bookOpen),
            selectedIcon: Icon(LucideIcons.bookOpen),
            label: l.navCards,
          ),
          NavigationDestination(
            icon: Icon(LucideIcons.settings),
            selectedIcon: Icon(LucideIcons.settings),
            label: l.navSettings,
          ),
        ],
      ),
    );
  }
}
