import 'package:flutter_riverpod/flutter_riverpod.dart';
import '../../core/api_client.dart';
import '../auth/auth_provider.dart';
import 'models.dart';

final tagsProvider = FutureProvider<List<Tag>>((ref) async {
  final apiClient = ref.read(apiClientProvider);
  final response = await apiClient.dio.get('/api/tags');
  final list = response.data['tags'] as List;
  return list.map((e) => Tag.fromJson(e as Map<String, dynamic>)).toList();
});

class TagActions {
  final ApiClient _api;
  TagActions(this._api);

  Future<Tag> create(String name, {String color = 'chart-1'}) async {
    final response =
        await _api.dio.post('/api/tags', data: {'name': name, 'color': color});
    return Tag.fromJson(response.data as Map<String, dynamic>);
  }

  Future<void> update(String id, {String? name, String? color}) async {
    final data = <String, dynamic>{};
    if (name != null) data['name'] = name;
    if (color != null) data['color'] = color;
    await _api.dio.patch('/api/tags/$id', data: data);
  }

  Future<void> delete(String id) async {
    await _api.dio.delete('/api/tags/$id');
  }
}

final tagActionsProvider = Provider<TagActions>((ref) {
  return TagActions(ref.read(apiClientProvider));
});
