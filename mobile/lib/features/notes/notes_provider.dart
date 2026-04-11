import 'package:flutter_riverpod/flutter_riverpod.dart';
import '../../core/api_client.dart';
import '../../core/date_utils.dart';
import '../auth/auth_provider.dart';

// ---------------------------------------------------------------------------
// Single-day note content (HTML string)
// ---------------------------------------------------------------------------

final notesContentProvider =
    FutureProvider.family<String, String>((ref, date) async {
  final apiClient = ref.read(apiClientProvider);
  final response = await apiClient.dio.get('/api/daily/$date/notes');
  return response.data['content'] as String? ?? '';
});

// ---------------------------------------------------------------------------
// Notes feed (recent notes across dates)
// ---------------------------------------------------------------------------

class NoteFeedItem {
  final String id;
  final String date;
  final String content;
  final String createdAt;

  const NoteFeedItem({
    required this.id,
    required this.date,
    required this.content,
    required this.createdAt,
  });

  factory NoteFeedItem.fromJson(Map<String, dynamic> json) => NoteFeedItem(
        id: json['id'] as String,
        date: json['date'] as String,
        content: json['content'] as String? ?? '',
        createdAt: json['createdAt'] as String,
      );
}

final notesFeedProvider = FutureProvider<List<NoteFeedItem>>((ref) async {
  final apiClient = ref.read(apiClientProvider);
  final response = await apiClient.dio
      .get('/api/notes/feed', queryParameters: {'limit': '50'});
  final list = response.data['notes'] as List;
  return list
      .map((e) => NoteFeedItem.fromJson(e as Map<String, dynamic>))
      .toList();
});

// ---------------------------------------------------------------------------
// Selected date for notes view
// ---------------------------------------------------------------------------

final selectedNoteDateProvider =
    NotifierProvider<SelectedNoteDateNotifier, String>(
  SelectedNoteDateNotifier.new,
);

class SelectedNoteDateNotifier extends Notifier<String> {
  @override
  String build() => todayStr();

  void setDate(String date) => state = date;
}

// ---------------------------------------------------------------------------
// Notes actions (save)
// ---------------------------------------------------------------------------

class NotesActions {
  final ApiClient _api;
  NotesActions(this._api);

  Future<void> save(String date, String htmlContent) async {
    await _api.dio.put('/api/daily/$date/notes', data: {
      'content': htmlContent,
    });
  }
}

final notesActionsProvider = Provider<NotesActions>((ref) {
  return NotesActions(ref.read(apiClientProvider));
});
