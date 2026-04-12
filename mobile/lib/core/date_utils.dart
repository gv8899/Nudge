import 'package:flutter/widgets.dart';

String formatDate(DateTime d) =>
    '${d.year}-${d.month.toString().padLeft(2, '0')}-${d.day.toString().padLeft(2, '0')}';

String todayStr() => formatDate(DateTime.now());

/// Resolve the current UI locale to an intl-compatible tag.
/// Bare `zh` is promoted to `zh_TW` so DateFormat uses Traditional Chinese
/// weekday / month names (週一 instead of simplified 周一).
String intlLocaleOf(BuildContext context) {
  final locale = Localizations.localeOf(context);
  if (locale.languageCode == 'zh') {
    return locale.countryCode == null || locale.countryCode!.isEmpty
        ? 'zh_TW'
        : 'zh_${locale.countryCode}';
  }
  return locale.toLanguageTag().replaceAll('-', '_');
}
