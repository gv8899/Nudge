import 'package:flutter/widgets.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:shared_preferences/shared_preferences.dart';

const _storageKey = 'nudge:locale';
const supportedLocaleTags = ['zh-TW', 'en', 'ja'];

/// BCP47 tag → Flutter Locale
Locale parseLocaleTag(String tag) {
  final parts = tag.split('-');
  if (parts.length == 1) return Locale(parts[0]);
  return Locale(parts[0], parts[1]);
}

/// Flutter Locale → BCP47 tag（例 'zh-TW'、'en'、'ja'）
String formatLocaleTag(Locale locale) {
  if (locale.countryCode != null && locale.countryCode!.isNotEmpty) {
    return '${locale.languageCode}-${locale.countryCode}';
  }
  return locale.languageCode;
}

/// 從 Flutter locale 映射到 intl / DateFormat 可接受的 tag（底線格式）
String intlLocaleTag(Locale? locale) {
  if (locale == null) return 'zh_TW';
  if (locale.languageCode == 'zh') return 'zh_TW';
  if (locale.languageCode == 'en') return 'en_US';
  if (locale.languageCode == 'ja') return 'ja_JP';
  return 'zh_TW';
}

/// null = 跟隨系統；Locale = 使用者覆蓋
final localeProvider =
    NotifierProvider<LocaleNotifier, Locale?>(LocaleNotifier.new);

class LocaleNotifier extends Notifier<Locale?> {
  /// Resolves when the initial SharedPreferences load finishes. Tests can
  /// `await container.read(localeProvider.notifier).loadComplete` to wait for
  /// state hydration without sleeping.
  late final Future<void> loadComplete;

  @override
  Locale? build() {
    loadComplete = _load();
    return null;
  }

  Future<void> _load() async {
    final prefs = await SharedPreferences.getInstance();
    final stored = prefs.getString(_storageKey);
    if (stored != null && supportedLocaleTags.contains(stored)) {
      if (!ref.mounted) return;
      state = parseLocaleTag(stored);
    }
  }

  Future<void> setLocale(Locale locale) async {
    state = locale;
    final prefs = await SharedPreferences.getInstance();
    await prefs.setString(_storageKey, formatLocaleTag(locale));
  }

  Future<void> clearLocale() async {
    state = null;
    final prefs = await SharedPreferences.getInstance();
    await prefs.remove(_storageKey);
  }
}
