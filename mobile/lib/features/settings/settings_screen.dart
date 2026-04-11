import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:intl/intl.dart';
import 'package:lucide_icons/lucide_icons.dart';
import '../../core/theme.dart';
import '../../core/theme_provider.dart';
import '../auth/auth_provider.dart';
import '../tags/tag_manager.dart';

class SettingsScreen extends ConsumerWidget {
  const SettingsScreen({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final authState = ref.watch(authProvider);
    final themeMode = ref.watch(themeProvider);

    return Scaffold(
      body: SafeArea(
        child: ListView(
          padding: const EdgeInsets.all(16),
          children: [
            const SizedBox(height: 16),
            Text(
              '設定',
              style: TextStyle(
                fontSize: 24,
                fontWeight: FontWeight.bold,
                color: AppColors.foreground,
              ),
            ),
            const SizedBox(height: 24),

            // 帳號資料
            _SectionTitle(title: '帳號資料'),
            const SizedBox(height: 12),
            if (authState.user != null) _UserProfile(user: authState.user!),
            const SizedBox(height: 24),

            // 主題
            _SectionTitle(title: '主題'),
            const SizedBox(height: 12),
            _ThemeSelector(
              current: themeMode,
              onChanged: (mode) => ref.read(themeProvider.notifier).setTheme(mode),
            ),
            const SizedBox(height: 24),

            // 標籤管理
            _SectionTitle(title: '標籤管理'),
            const SizedBox(height: 12),
            const TagManager(),
            const SizedBox(height: 24),

            // 清除空白卡片
            _SectionTitle(title: '維護'),
            const SizedBox(height: 12),
            _CleanUntitledButton(ref: ref),
            const SizedBox(height: 24),

            // 登出
            SizedBox(
              width: double.infinity,
              child: OutlinedButton.icon(
                onPressed: () => ref.read(authProvider.notifier).logout(),
                icon: const Icon(LucideIcons.logOut, size: 18),
                label: const Text('登出'),
                style: OutlinedButton.styleFrom(
                  foregroundColor: AppColors.destructive,
                  side: BorderSide(color: AppColors.destructive.withValues(alpha: 0.4)),
                  padding: const EdgeInsets.symmetric(vertical: 12),
                ),
              ),
            ),
          ],
        ),
      ),
    );
  }
}

class _SectionTitle extends StatelessWidget {
  final String title;
  const _SectionTitle({required this.title});

  @override
  Widget build(BuildContext context) {
    return Text(
      title,
      style: TextStyle(
        fontSize: 11,
        fontWeight: FontWeight.bold,
        letterSpacing: 1.2,
        color: AppColors.textDim,
      ),
    );
  }
}

class _UserProfile extends StatelessWidget {
  final Map<String, dynamic> user;
  const _UserProfile({required this.user});

  @override
  Widget build(BuildContext context) {
    final name = user['name'] as String? ?? '未命名';
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
              fit: BoxFit.cover,
              errorBuilder: (_, __, ___) => _InitialsAvatar(name: name),
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
                    '加入於 $joinDate',
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
    return Row(
      children: [
        _ThemeOption(
          icon: LucideIcons.sun,
          label: 'Light',
          isSelected: current == AppThemeMode.light,
          onTap: () => onChanged(AppThemeMode.light),
        ),
        const SizedBox(width: 8),
        _ThemeOption(
          icon: LucideIcons.moon,
          label: 'Dark',
          isSelected: current == AppThemeMode.dark,
          onTap: () => onChanged(AppThemeMode.dark),
        ),
        const SizedBox(width: 8),
        _ThemeOption(
          icon: LucideIcons.monitor,
          label: '跟隨系統',
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
      child: GestureDetector(
        onTap: onTap,
        child: Container(
          padding: const EdgeInsets.symmetric(vertical: 12),
          decoration: BoxDecoration(
            borderRadius: BorderRadius.circular(8),
            border: Border.all(
              color: isSelected ? AppColors.primary : AppColors.border,
            ),
            color: isSelected ? AppColors.primary.withValues(alpha: 0.1) : Colors.transparent,
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
    );
  }
}

class _CleanUntitledButton extends StatefulWidget {
  final WidgetRef ref;
  const _CleanUntitledButton({required this.ref});

  @override
  State<_CleanUntitledButton> createState() => _CleanUntitledButtonState();
}

class _CleanUntitledButtonState extends State<_CleanUntitledButton> {
  bool _loading = false;

  Future<void> _clean() async {
    final confirmed = await showDialog<bool>(
      context: context,
      builder: (ctx) => AlertDialog(
        backgroundColor: AppColors.card,
        title: const Text('清除空白卡片', style: TextStyle(fontSize: 16)),
        content: Text(
          '這會刪除所有沒有標題的卡片，確定嗎？',
          style: TextStyle(fontSize: 14, color: AppColors.textDim),
        ),
        actions: [
          TextButton(onPressed: () => Navigator.pop(ctx, false), child: const Text('取消')),
          TextButton(
            onPressed: () => Navigator.pop(ctx, true),
            child: Text('確定清除', style: TextStyle(color: AppColors.destructive)),
          ),
        ],
      ),
    );

    if (confirmed != true || !mounted) return;

    setState(() => _loading = true);
    try {
      final api = widget.ref.read(apiClientProvider);
      final res = await api.dio.delete('/api/cards/untitled');
      final deleted = res.data['deleted'] ?? 0;
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(
            content: Text(deleted > 0 ? '已清除 $deleted 張空白卡片' : '沒有需要清除的卡片'),
          ),
        );
      }
    } catch (_) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          const SnackBar(content: Text('清除失敗')),
        );
      }
    } finally {
      if (mounted) setState(() => _loading = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    return SizedBox(
      width: double.infinity,
      child: OutlinedButton.icon(
        onPressed: _loading ? null : _clean,
        icon: _loading
            ? SizedBox(width: 16, height: 16, child: CircularProgressIndicator(strokeWidth: 2, color: AppColors.textDim))
            : Icon(LucideIcons.eraser, size: 18),
        label: Text(_loading ? '清除中...' : '清除空白卡片'),
        style: OutlinedButton.styleFrom(
          foregroundColor: AppColors.textDim,
          side: BorderSide(color: AppColors.border),
          padding: const EdgeInsets.symmetric(vertical: 12),
        ),
      ),
    );
  }
}
