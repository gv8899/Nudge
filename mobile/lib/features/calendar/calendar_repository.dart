import 'package:flutter_riverpod/flutter_riverpod.dart';
import '../../core/api_client.dart';
import '../auth/auth_provider.dart';
import 'calendar_models.dart';

class CalendarRepository {
  final ApiClient _api;
  CalendarRepository(this._api);

  Future<CalendarEventsResponse> fetchEvents(String date) async {
    final tz = DateTime.now().timeZoneName;
    final response = await _api.dio.get(
      '/api/calendar/events',
      queryParameters: {'date': date, 'tz': tz},
    );
    return CalendarEventsResponse.fromJson(
      response.data as Map<String, dynamic>,
    );
  }

  /// 從 /api/calendar/calendars 抓 primary calendar 的 id（就是 Google 帳號 email），
  /// 未連結或失敗時回 null。
  Future<String?> fetchLinkedEmail() async {
    try {
      final response = await _api.dio.get('/api/calendar/calendars');
      final data = response.data as Map<String, dynamic>;
      final calendars = (data['calendars'] as List?) ?? [];
      for (final c in calendars) {
        final m = c as Map<String, dynamic>;
        if (m['primary'] == true) return m['id'] as String?;
      }
      return null;
    } catch (_) {
      return null;
    }
  }
}

final calendarRepositoryProvider = Provider<CalendarRepository>((ref) {
  return CalendarRepository(ref.read(apiClientProvider));
});
