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
}

final calendarRepositoryProvider = Provider<CalendarRepository>((ref) {
  return CalendarRepository(ref.read(apiClientProvider));
});
