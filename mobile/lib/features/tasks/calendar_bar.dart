import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import '../../core/theme.dart';
import 'tasks_provider.dart';

class CalendarBar extends ConsumerWidget {
  const CalendarBar({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final selectedDate = ref.watch(selectedDateProvider);
    final selected = DateTime.parse(selectedDate);

    final weekday = selected.weekday;
    final weekStart = selected.subtract(Duration(days: weekday - 1));
    final weekStartStr = _fmt(weekStart);

    final weekDots = ref.watch(weekDotsProvider(weekStartStr));
    final dots = weekDots.when(
      data: (d) => d,
      loading: () => <String>{},
      error: (_, _) => <String>{},
    );

    final dayNames = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 8),
      decoration: BoxDecoration(
        color: AppColors.card,
        borderRadius: BorderRadius.circular(12),
      ),
      child: Row(
        children: [
          Semantics(
            label: '上一週',
            button: true,
            child: _navButton(Icons.chevron_left, () {
              final prev = weekStart.subtract(const Duration(days: 7));
              ref.read(selectedDateProvider.notifier).setDate(_fmt(prev));
            }),
          ),
          ...List.generate(7, (i) {
            final day = weekStart.add(Duration(days: i));
            final dayStr = _fmt(day);
            final isSelected = dayStr == selectedDate;
            final hasTasks = dots.contains(dayStr);

            return Expanded(
              child: Semantics(
                label: '${dayNames[i]} ${day.day}日',
                button: true,
                selected: isSelected,
                child: GestureDetector(
                onTap: () {
                  ref.read(selectedDateProvider.notifier).setDate(dayStr);
                },
                child: Container(
                  padding: const EdgeInsets.symmetric(vertical: 6),
                  decoration: BoxDecoration(
                    color: isSelected
                        ? AppColors.primary
                        : Colors.transparent,
                    borderRadius: BorderRadius.circular(20),
                  ),
                  child: Column(
                    mainAxisSize: MainAxisSize.min,
                    children: [
                      if (hasTasks && !isSelected)
                        Container(
                          width: 4,
                          height: 4,
                          margin: const EdgeInsets.only(bottom: 2),
                          decoration: const BoxDecoration(
                            color: AppColors.primary,
                            shape: BoxShape.circle,
                          ),
                        )
                      else
                        const SizedBox(height: 6),
                      Text(
                        dayNames[i],
                        style: TextStyle(
                          fontSize: 11,
                          color: isSelected
                              ? AppColors.onPrimary
                              : AppColors.textDim,
                        ),
                      ),
                      const SizedBox(height: 2),
                      Text(
                        '${day.day}',
                        style: TextStyle(
                          fontSize: 13,
                          fontWeight:
                              isSelected ? FontWeight.bold : FontWeight.w500,
                          color: isSelected
                              ? AppColors.onPrimary
                              : AppColors.foreground,
                        ),
                      ),
                    ],
                  ),
                ),
              ),
              ),
            );
          }),
          Semantics(
            label: '下一週',
            button: true,
            child: _navButton(Icons.chevron_right, () {
            final next = weekStart.add(const Duration(days: 7));
            ref.read(selectedDateProvider.notifier).setDate(_fmt(next));
          }),
          ),
          Container(
            width: 1,
            height: 20,
            margin: const EdgeInsets.symmetric(horizontal: 4),
            color: AppColors.border,
          ),
          Semantics(
            label: '回到今天',
            button: true,
            child: GestureDetector(
              onTap: () {
                ref.read(selectedDateProvider.notifier).setDate(_fmt(DateTime.now()));
              },
              child: const Padding(
                padding: EdgeInsets.symmetric(horizontal: 8, vertical: 4),
                child: Text(
                  '今天',
                  style: TextStyle(fontSize: 13, color: AppColors.foreground),
                ),
              ),
            ),
          ),
        ],
      ),
    );
  }

  Widget _navButton(IconData icon, VoidCallback onTap) {
    return GestureDetector(
      onTap: onTap,
      child: Padding(
        padding: const EdgeInsets.all(12),
        child: Icon(icon, size: 18, color: AppColors.textDim),
      ),
    );
  }

  static String _fmt(DateTime d) =>
      '${d.year}-${d.month.toString().padLeft(2, '0')}-${d.day.toString().padLeft(2, '0')}';
}
