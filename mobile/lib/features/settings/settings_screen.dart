import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:intl/intl.dart';
import 'package:lucide_icons/lucide_icons.dart';
import '../../core/theme.dart';
import '../../core/theme_provider.dart';
import '../../l10n/app_localizations.dart';
import '../auth/auth_provider.dart';
import '../cards/cards_provider.dart';
import '../tags/tag_manager.dart';

class SettingsScreen extends ConsumerWidget {
  const SettingsScreen({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final authState = ref.watch(authProvider);
    final themeMode = ref.watch(themeProvider);
    final l = AppL10n.of(context)!;

    return Scaffold(
      body: SafeArea(
        child: ListView(
          padding: const EdgeInsets.all(16),
          children: [
            const SizedBox(height: 16),
            Text(
              l.settingsTitle,
              style: TextStyle(
                fontSize: 24,
                fontWeight: FontWeight.bold,
                color: AppColors.foreground,
              ),
            ),
            const SizedBox(height: 24),

            // 帳號資料
            if (authState.user != null) _UserProfile(user: authState.user!),
            const SizedBox(height: 24),

            // 主題
            _ThemeSelector(
              current: themeMode,
              onChanged: (mode) => ref.read(themeProvider.notifier).setTheme(mode),
            ),
            const SizedBox(height: 24),

            // 標籤管理（TagManager 自己有標題）
            const TagManager(),
            const SizedBox(height: 24),

            // 清除空白卡片
            const _CleanUntitledButton(),
            const SizedBox(height: 24),

            // 登出
            SizedBox(
              width: double.infinity,
              child: OutlinedButton.icon(
                onPressed: () => _confirmLogout(context, ref),
                icon: const Icon(LucideIcons.logOut, size: 18),
                label: Text(l.settingsLogoutButton),
                style: OutlinedButton.styleFrom(
                  foregroundColor: AppColors.destructive,
                  side: BorderSide(color: AppColors.destructiveBorder),
                  padding: const EdgeInsets.symmetric(vertical: 12),
                ),
              ),
            ),
          ],
        ),
      ),
    );
  }

  Future<void> _confirmLogout(BuildContext context, WidgetRef ref) async {
    final l = AppL10n.of(context)!;
    final confirmed = await showDialog<bool>(
      context: context,
      builder: (ctx) => AlertDialog(
        backgroundColor: AppColors.card,
        title: Text(l.settingsLogoutConfirmTitle, style: const TextStyle(fontSize: 16)),
        content: Text(
          l.settingsLogoutConfirmBody,
          style: TextStyle(fontSize: 14, color: AppColors.textDim),
        ),
        actions: [
          TextButton(onPressed: () => Navigator.pop(ctx, false), child: Text(l.commonCancel)),
          TextButton(
            onPressed: () => Navigator.pop(ctx, true),
            child: Text(l.settingsLogoutButton, style: TextStyle(color: AppColors.destructive)),
          ),
        ],
      ),
    );
    if (confirmed == true) {
      ref.read(authProvider.notifier).logout();
    }
  }
}

class _UserProfile extends StatelessWidget {
  final Map<String, dynamic> user;
  const _UserProfile({required this.user});

  @override
  Widget build(BuildContext context) {
    final l = AppL10n.of(context)!;
    final name = user['name'] as String? ?? l.settingsAccountUnnamed;
    final email = user['email'] as String? ?? '';
    final avatarUrl = user['avatarUrl'] as String?;
    final createdAt = user['createdAt'] as String?;

    String? joinDate;
    if (createdAt != null) {
      try {
        final d = DateTime.parse(createdAt);
        joinDate = DateFormat('yyyy/MM/dd').format(d);
      } catch (_) {}
    }

    return Row(
      children: [
        if (avatarUrl != null && avatarUrl.isNotEmpty)
          ClipRRect(
            borderRadius: BorderRadius.circular(24),
            child: Image.network(
              avatarUrl,
              width: 48,
              height: 48,
              cacheWidth: 96,
              cacheHeight: 96,
              fit: BoxFit.cover,
              loadingBuilder: (ctx, child, progress) {
                if (progress == null) return child;
                return _InitialsAvatar(name: name);
              },
              errorBuilder: (_, _, _) => _InitialsAvatar(name: name),
            ),
          )
        else
          _InitialsAvatar(name: name),
        const SizedBox(width: 12),
        Expanded(
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Text(
                name,
                style: TextStyle(fontSize: 14, fontWeight: FontWeight.w500, color: AppColors.foreground),
                overflow: TextOverflow.ellipsis,
              ),
              Text(
                email,
                style: TextStyle(fontSize: 12, color: AppColors.textDim),
                overflow: TextOverflow.ellipsis,
              ),
              if (joinDate != null)
                Padding(
                  padding: const EdgeInsets.only(top: 2),
                  child: Text(
                    l.settingsAccountJoinedAt(joinDate),
                    style: TextStyle(fontSize: 11, color: AppColors.textFaint),
                  ),
                ),
            ],
          ),
        ),
      ],
    );
  }
}

class _InitialsAvatar extends StatelessWidget {
  final String name;
  const _InitialsAvatar({required this.name});

  @override
  Widget build(BuildContext context) {
    return Container(
      width: 48,
      height: 48,
      decoration: BoxDecoration(
        color: AppColors.muted,
        shape: BoxShape.circle,
      ),
      alignment: Alignment.center,
      child: Text(
        name.isNotEmpty ? name[0].toUpperCase() : '?',
        style: TextStyle(
          fontSize: 18,
          fontWeight: FontWeight.w500,
          color: AppColors.foreground,
        ),
      ),
    );
  }
}

class _ThemeSelector extends StatelessWidget {
  final AppThemeMode current;
  final ValueChanged<AppThemeMode> onChanged;

  const _ThemeSelector({required this.current, required this.onChanged});

  @override
  Widget build(BuildContext context) {
    final l = AppL10n.of(context)!;
    return Row(
      children: [
        _ThemeOption(
          icon: LucideIcons.sun,
          label: l.settingsThemeLight,
          isSelected: current == AppThemeMode.light,
          onTap: () => onChanged(AppThemeMode.light),
        ),
        const SizedBox(width: 8),
        _ThemeOption(
          icon: LucideIcons.moon,
          label: l.settingsThemeDark,
          isSelected: current == AppThemeMode.dark,
          onTap: () => onChanged(AppThemeMode.dark),
        ),
        const SizedBox(width: 8),
        _ThemeOption(
          icon: LucideIcons.monitor,
          label: l.settingsThemeSystem,
          isSelected: current == AppThemeMode.system,
          onTap: () => onChanged(AppThemeMode.system),
        ),
      ],
    );
  }
}

class _ThemeOption extends StatelessWidget {
  final IconData icon;
  final String label;
  final bool isSelected;
  final VoidCallback onTap;

  const _ThemeOption({
    required this.icon,
    required this.label,
    required this.isSelected,
    required this.onTap,
  });

  @override
  Widget build(BuildContext context) {
    return Expanded(
      child: Semantics(
        button: true,
        selected: isSelected,
        label: label,
        child: Material(
          color: isSelected ? AppColors.primarySoft : Colors.transparent,
          borderRadius: BorderRadius.circular(8),
          child: InkWell(
            onTap: onTap,
            borderRadius: BorderRadius.circular(8),
            child: Container(
              padding: const EdgeInsets.symmetric(vertical: 12),
              decoration: BoxDecoration(
                borderRadius: BorderRadius.circular(8),
                border: Border.all(
                  color: isSelected ? AppColors.primary : AppColors.border,
                ),
              ),
              child: Column(
                children: [
                  Icon(icon, size: 20, color: isSelected ? AppColors.primary : AppColors.textDim),
                  const SizedBox(height: 4),
                  Text(
                    label,
                    style: TextStyle(
                      fontSize: 11,
                      color: isSelected ? AppColors.primary : AppColors.textDim,
                    ),
                  ),
                ],
              ),
            ),
          ),
        ),
      ),
    );
  }
}

class _CleanUntitledButton extends ConsumerStatefulWidget {
  const _CleanUntitledButton();

  @override
  ConsumerState<_CleanUntitledButton> createState() => _CleanUntitledButtonState();
}

class _CleanUntitledButtonState extends ConsumerState<_CleanUntitledButton> {
  bool _loading = false;

  Future<void> _clean() async {
    final l = AppL10n.of(context)!;
    final confirmed = await showDialog<bool>(
      context: context,
      builder: (ctx) => AlertDialog(
        backgroundColor: AppColors.card,
        title: Text(l.settingsCleanUntitledConfirmTitle, style: const TextStyle(fontSize: 16)),
        content: Text(
          l.settingsCleanUntitledConfirmBody,
          style: TextStyle(fontSize: 14, color: AppColors.textDim),
        ),
        actions: [
          TextButton(onPressed: () => Navigator.pop(ctx, false), child: Text(l.commonCancel)),
          TextButton(
            onPressed: () => Navigator.pop(ctx, true),
            child: Text(l.settingsCleanUntitledConfirmOk, style: TextStyle(color: AppColors.destructive)),
          ),
        ],
      ),
    );

    if (confirmed != true || !mounted) return;

    setState(() => _loading = true);
    try {
      final api = ref.read(apiClientProvider);
      final res = await api.dio.delete('/api/cards/untitled');
      final deleted = (res.data['deleted'] as int?) ?? 0;
      ref.invalidate(cardsProvider);
      if (mounted) {
        final msg = deleted > 0
            ? l.settingsCleanUntitledSuccessWithCount(deleted)
            : l.settingsCleanUntitledSuccessEmpty;
        ScaffoldMessenger.of(context).showSnackBar(SnackBar(content: Text(msg)));
      }
    } catch (_) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(content: Text(l.settingsCleanUntitledFailed)),
        );
      }
    } finally {
      if (mounted) setState(() => _loading = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    final l = AppL10n.of(context)!;
    return SizedBox(
      width: double.infinity,
      child: OutlinedButton.icon(
        onPressed: _loading ? null : _clean,
        icon: _loading
            ? SizedBox(width: 16, height: 16, child: CircularProgressIndicator(strokeWidth: 2, color: AppColors.textDim))
            : Icon(LucideIcons.eraser, size: 18),
        label: Text(_loading ? l.settingsCleanUntitledLabelLoading : l.settingsCleanUntitledLabel),
        style: OutlinedButton.styleFrom(
          foregroundColor: AppColors.textDim,
          side: BorderSide(color: AppColors.border),
          padding: const EdgeInsets.symmetric(vertical: 12),
        ),
      ),
    );
  }
}
