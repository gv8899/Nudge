import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:shared_preferences/shared_preferences.dart';
import 'calendar_models.dart';
import 'calendar_repository.dart';

final calendarEventsProvider =
    FutureProvider.family<CalendarEventsResponse, String>((ref, date) async {
  final repo = ref.read(calendarRepositoryProvider);
  return repo.fetchEvents(date);
});

/// 收合/展開狀態，跨 app 啟動保持
final calendarCollapsedProvider =
    NotifierProvider<CalendarCollapsedNotifier, bool>(
  CalendarCollapsedNotifier.new,
);

class CalendarCollapsedNotifier extends Notifier<bool> {
  static const _key = 'calendar_strip_collapsed';

  @override
  bool build() {
    _load();
    return true; // 預設收合
  }

  Future<void> _load() async {
    final prefs = await SharedPreferences.getInstance();
    final stored = prefs.getBool(_key);
    if (stored != null) state = stored;
  }

  Future<void> toggle() async {
    state = !state;
    final prefs = await SharedPreferences.getInstance();
    await prefs.setBool(_key, state);
  }
}
