import 'package:flutter/widgets.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:mobile/core/locale_provider.dart';
import 'package:shared_preferences/shared_preferences.dart';

void main() {
  setUp(() {
    SharedPreferences.setMockInitialValues({});
  });

  test('build returns null initially (system locale)', () async {
    final container = ProviderContainer();
    addTearDown(container.dispose);
    expect(container.read(localeProvider), isNull);
  });

  test('setLocale writes to SharedPreferences', () async {
    final container = ProviderContainer();
    addTearDown(container.dispose);

    await container
        .read(localeProvider.notifier)
        .setLocale(const Locale('en'));
    expect(container.read(localeProvider), const Locale('en'));

    final prefs = await SharedPreferences.getInstance();
    expect(prefs.getString('nudge:locale'), 'en');
  });

  test('clearLocale removes preference (back to system)', () async {
    final container = ProviderContainer();
    addTearDown(container.dispose);

    await container
        .read(localeProvider.notifier)
        .setLocale(const Locale('en'));
    await container.read(localeProvider.notifier).clearLocale();
    expect(container.read(localeProvider), isNull);

    final prefs = await SharedPreferences.getInstance();
    expect(prefs.getString('nudge:locale'), isNull);
  });

  test('loads persisted locale on build', () async {
    SharedPreferences.setMockInitialValues({'nudge:locale': 'ja'});
    final container = ProviderContainer();
    addTearDown(container.dispose);

    await container.read(localeProvider.notifier).loadComplete;
    expect(container.read(localeProvider), const Locale('ja'));
  });

  test('parseLocaleTag handles zh-TW region code', () {
    expect(parseLocaleTag('zh-TW'), const Locale('zh', 'TW'));
    expect(parseLocaleTag('en'), const Locale('en'));
    expect(parseLocaleTag('ja'), const Locale('ja'));
  });

  test('formatLocaleTag emits BCP47 with dash', () {
    expect(formatLocaleTag(const Locale('zh', 'TW')), 'zh-TW');
    expect(formatLocaleTag(const Locale('en')), 'en');
  });
}
