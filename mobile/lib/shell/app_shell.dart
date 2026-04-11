import 'package:flutter/material.dart';
import 'package:lucide_icons/lucide_icons.dart';

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
        destinations: [
          NavigationDestination(
            icon: Icon(LucideIcons.checkSquare),
            selectedIcon: Icon(LucideIcons.checkSquare),
            label: '行動',
          ),
          NavigationDestination(
            icon: Icon(LucideIcons.fileEdit),
            selectedIcon: Icon(LucideIcons.fileEdit),
            label: '日誌',
          ),
          NavigationDestination(
            icon: Icon(LucideIcons.bookOpen),
            selectedIcon: Icon(LucideIcons.bookOpen),
            label: '卡片',
          ),
          NavigationDestination(
            icon: Icon(LucideIcons.settings),
            selectedIcon: Icon(LucideIcons.settings),
            label: '設定',
          ),
        ],
      ),
    );
  }
}
