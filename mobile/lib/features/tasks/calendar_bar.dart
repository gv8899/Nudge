import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:intl/intl.dart';
import '../../core/date_utils.dart';
import '../../core/theme.dart';
import 'tasks_provider.dart';

class CalendarBar extends ConsumerWidget {
  const CalendarBar({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final selectedDate = ref.watch(selectedDateProvider);
    final selected = DateTime.parse(selectedDate);

    final localeTag = intlLocaleOf(context);
    final weekday = selected.weekday;
    final weekStart = selected.subtract(Duration(days: weekday - 1));

    final dayFormatter = DateFormat('EEE', localeTag);
    // 繁中「週一/週二…」精簡成「一/二…」；其他語系照 locale default
    final dayNames = List.generate(7, (i) {
      final raw = dayFormatter.format(weekStart.add(Duration(days: i)));
      return raw.startsWith('週') ? raw.substring(1) : raw;
    });

    return GestureDetector(
      behavior: HitTestBehavior.translucent,
      onHorizontalDragEnd: (details) {
        if (details.primaryVelocity == null) return;
        if (details.primaryVelocity! < -100) {
          final next = weekStart.add(const Duration(days: 7));
          ref.read(selectedDateProvider.notifier).setDate(formatDate(next));
        } else if (details.primaryVelocity! > 100) {
          final prev = weekStart.subtract(const Duration(days: 7));
          ref.read(selectedDateProvider.notifier).setDate(formatDate(prev));
        }
      },
      child: Padding(
        padding: const EdgeInsets.symmetric(vertical: 4),
        child: Row(
          children: List.generate(7, (i) {
            final day = weekStart.add(Duration(days: i));
            final dayStr = formatDate(day);
            final isSelected = dayStr == selectedDate;
            final isWeekend = i >= 5;

            return Expanded(
              child: Semantics(
                label: '${dayNames[i]} ${day.day}',
                button: true,
                selected: isSelected,
                child: GestureDetector(
                  onTap: () {
                    ref.read(selectedDateProvider.notifier).setDate(dayStr);
                  },
                  behavior: HitTestBehavior.opaque,
                  child: Column(
                    mainAxisSize: MainAxisSize.min,
                    children: [
                      Text(
                        dayNames[i],
                        style: TextStyle(
                          fontSize: 12,
                          fontWeight: FontWeight.w500,
                          color: isWeekend
                              ? AppColors.destructive.withValues(alpha: 0.7)
                              : AppColors.textDim,
                        ),
                      ),
                      const SizedBox(height: 6),
                      Container(
                        width: 36,
                        height: 36,
                        decoration: BoxDecoration(
                          color: isSelected ? AppColors.primary : Colors.transparent,
                          shape: BoxShape.circle,
                        ),
                        alignment: Alignment.center,
                        child: Text(
                          '${day.day}',
                          style: TextStyle(
                            fontSize: 15,
                            fontWeight: isSelected ? FontWeight.bold : FontWeight.w500,
                            color: isSelected
                                ? AppColors.onPrimary
                                : AppColors.foreground,
                          ),
                        ),
                      ),
                    ],
                  ),
                ),
              ),
            );
          }),
        ),
      ),
    );
  }
}
