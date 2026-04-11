import 'package:flutter_riverpod/flutter_riverpod.dart';
import '../../core/api_client.dart';
import '../auth/auth_provider.dart';
import 'models.dart';

final cardsProvider =
    FutureProvider.family<List<CardItem>, String>((ref, query) async {
  final apiClient = ref.read(apiClientProvider);
  final params = <String, String>{'limit': '50'};
  if (query.isNotEmpty) params['q'] = query;
  final response =
      await apiClient.dio.get('/api/cards', queryParameters: params);
  final list = response.data['cards'] as List;
  return list.map((e) => CardItem.fromJson(e as Map<String, dynamic>)).toList();
});

final cardDetailProvider =
    FutureProvider.family<CardItem, String>((ref, id) async {
  final apiClient = ref.read(apiClientProvider);
  final response = await apiClient.dio.get('/api/tasks/$id');
  final data = response.data as Map<String, dynamic>;
  return CardItem.fromJson({...data, 'tags': data['tags'] ?? []});
});

class CardActions {
  final ApiClient _api;
  CardActions(this._api);

  Future<String> create() async {
    final response = await _api.dio.post('/api/tasks', data: {
      'title': '',
      'description': '<p></p>',
      'status': 'inbox',
    });
    return response.data['id'] as String;
  }

  Future<void> updateTitle(String id, String title) async {
    await _api.dio.patch('/api/tasks/$id', data: {'title': title});
  }

  Future<void> updateDescription(String id, String description) async {
    await _api.dio.patch('/api/tasks/$id', data: {'description': description});
  }

  Future<void> setTags(String taskId, List<String> tagIds) async {
    await _api.dio
        .put('/api/tasks/$taskId/tags', data: {'tagIds': tagIds});
  }
}

final cardActionsProvider = Provider<CardActions>((ref) {
  return CardActions(ref.read(apiClientProvider));
});
