import 'dart:async';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import '../../core/theme.dart';
import 'cards_provider.dart';
import 'card_list_item.dart';
import 'card_grid_item.dart';

enum _View { list, grid }

class CardsScreen extends ConsumerStatefulWidget {
  const CardsScreen({super.key});

  @override
  ConsumerState<CardsScreen> createState() => _CardsScreenState();
}

class _CardsScreenState extends ConsumerState<CardsScreen> {
  _View _view = _View.grid;
  final _searchController = TextEditingController();
  String _query = '';
  Timer? _debounce;

  @override
  void dispose() {
    _searchController.dispose();
    _debounce?.cancel();
    super.dispose();
  }

  void _onSearchChanged(String value) {
    _debounce?.cancel();
    _debounce = Timer(const Duration(milliseconds: 300), () {
      setState(() => _query = value.trim());
    });
  }

  Future<void> _createCard() async {
    final id = await ref.read(cardActionsProvider).create();
    if (mounted) {
      context.push('/cards/$id');
    }
  }

  @override
  Widget build(BuildContext context) {
    final cardsAsync = ref.watch(cardsProvider(_query));

    return Scaffold(
      body: SafeArea(
        child: Column(
          children: [
            // Header
            Padding(
              padding: const EdgeInsets.fromLTRB(16, 16, 16, 8),
              child: Row(
                children: [
                  Text('卡片',
                      style: TextStyle(fontSize: 24, fontWeight: FontWeight.bold, color: AppColors.foreground)),
                  const SizedBox(width: 8),
                  GestureDetector(
                    onTap: _createCard,
                    child: Icon(Icons.add_circle_outline, size: 22, color: AppColors.primary),
                  ),
                  const Spacer(),
                  // View toggle
                  Container(
                    padding: const EdgeInsets.all(2),
                    decoration: BoxDecoration(
                      border: Border.all(color: AppColors.border),
                      borderRadius: BorderRadius.circular(8),
                    ),
                    child: Row(
                      children: [
                        _viewButton(Icons.view_list, _View.list),
                        _viewButton(Icons.grid_view, _View.grid),
                      ],
                    ),
                  ),
                ],
              ),
            ),

            // Search
            Padding(
              padding: const EdgeInsets.symmetric(horizontal: 16),
              child: TextField(
                controller: _searchController,
                onChanged: _onSearchChanged,
                style: TextStyle(fontSize: 14, color: AppColors.foreground),
                decoration: InputDecoration(
                  hintText: '搜尋卡片...',
                  hintStyle: TextStyle(color: AppColors.textFaint),
                  prefixIcon: Icon(Icons.search, size: 18, color: AppColors.textDim),
                  isDense: true,
                  contentPadding: const EdgeInsets.symmetric(vertical: 10),
                  border: OutlineInputBorder(
                    borderRadius: BorderRadius.circular(8),
                    borderSide: BorderSide(color: AppColors.border),
                  ),
                  enabledBorder: OutlineInputBorder(
                    borderRadius: BorderRadius.circular(8),
                    borderSide: BorderSide(color: AppColors.border),
                  ),
                  focusedBorder: OutlineInputBorder(
                    borderRadius: BorderRadius.circular(8),
                    borderSide: BorderSide(color: AppColors.primary),
                  ),
                  filled: true,
                  fillColor: AppColors.background,
                ),
              ),
            ),

            const SizedBox(height: 12),

            // Content
            Expanded(
              child: cardsAsync.when(
                loading: () => const Center(child: CircularProgressIndicator()),
                error: (e, _) => Center(child: Text('載入失敗', style: TextStyle(color: Colors.grey[400]))),
                data: (cards) {
                  if (cards.isEmpty) {
                    return Center(
                      child: Text(
                        _query.isNotEmpty ? '沒有符合的卡片' : '還沒有卡片',
                        style: TextStyle(fontSize: 14, color: AppColors.textDim),
                      ),
                    );
                  }

                  if (_view == _View.list) {
                    return RefreshIndicator(
                      onRefresh: () async => ref.invalidate(cardsProvider(_query)),
                      child: ListView.separated(
                        padding: const EdgeInsets.symmetric(horizontal: 16),
                        itemCount: cards.length,
                        separatorBuilder: (_, _) => Container(height: 1, color: AppColors.border),
                        itemBuilder: (_, i) => CardListItem(
                          card: cards[i],
                          onTap: () => context.push('/cards/${cards[i].id}'),
                        ),
                      ),
                    );
                  }

                  return RefreshIndicator(
                    onRefresh: () async => ref.invalidate(cardsProvider(_query)),
                    child: GridView.builder(
                      padding: const EdgeInsets.symmetric(horizontal: 16),
                      gridDelegate: const SliverGridDelegateWithFixedCrossAxisCount(
                        crossAxisCount: 2,
                        crossAxisSpacing: 12,
                        mainAxisSpacing: 12,
                        childAspectRatio: 0.85,
                      ),
                      itemCount: cards.length,
                      itemBuilder: (_, i) => CardGridItem(
                        card: cards[i],
                        onTap: () => context.push('/cards/${cards[i].id}'),
                      ),
                    ),
                  );
                },
              ),
            ),
          ],
        ),
      ),
    );
  }

  Widget _viewButton(IconData icon, _View view) {
    final isActive = _view == view;
    return GestureDetector(
      onTap: () => setState(() => _view = view),
      child: Container(
        padding: const EdgeInsets.all(6),
        decoration: BoxDecoration(
          color: isActive ? AppColors.card : Colors.transparent,
          borderRadius: BorderRadius.circular(6),
        ),
        child: Icon(icon, size: 18, color: isActive ? AppColors.foreground : AppColors.textDim),
      ),
    );
  }
}
