import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:url_launcher/url_launcher.dart';
import '../../core/theme.dart';
import '../../l10n/app_localizations.dart';
import 'calendar_event_tile.dart';
import 'calendar_models.dart';
import 'calendar_provider.dart';
import 'calendar_repository.dart';

class CalendarStrip extends ConsumerStatefulWidget {
  final String date;
  const CalendarStrip({super.key, required this.date});

  @override
  ConsumerState<CalendarStrip> createState() => _CalendarStripState();
}

class _CalendarStripState extends ConsumerState<CalendarStrip> {
  String? _expandedEventKey;

  @override
  Widget build(BuildContext context) {
    final l10n = AppL10n.of(context)!;
    final collapsed = ref.watch(calendarCollapsedProvider);
    final eventsAsync = ref.watch(calendarEventsProvider(widget.date));

    return eventsAsync.when(
      data: (resp) => _buildStrip(context, l10n, collapsed, resp),
      loading: () => _buildHeader(
        context,
        l10n,
        collapsed,
        label: l10n.calendarPanelLoading,
      ),
      error: (_, _) => _buildHeader(
        context,
        l10n,
        collapsed,
        label: l10n.calendarPanelError,
      ),
    );
  }

  Widget _buildStrip(
    BuildContext context,
    AppL10n l10n,
    bool collapsed,
    CalendarEventsResponse resp,
  ) {
    if (!resp.connected) {
      return _buildHeader(
        context,
        l10n,
        collapsed,
        label: l10n.calendarMobileConnectPrompt,
        isCta: true,
      );
    }

    final count = resp.events.length;
    final headerLabel = count == 0
        ? l10n.calendarMobileCollapsedEmpty
        : l10n.calendarMobileCollapsedCount(count);

    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        _buildHeader(context, l10n, collapsed, label: headerLabel),
        if (!collapsed && count > 0)
          Container(
            margin: const EdgeInsets.fromLTRB(14, 0, 14, 4),
            padding: const EdgeInsets.all(10),
            decoration: BoxDecoration(
              color: AppColors.card,
              border: Border.all(color: AppColors.border),
              borderRadius: const BorderRadius.only(
                bottomLeft: Radius.circular(8),
                bottomRight: Radius.circular(8),
              ),
            ),
            child: Column(
              children: [
                for (final e in resp.events)
                  Padding(
                    padding: const EdgeInsets.only(bottom: 6),
                    child: CalendarEventTile(
                      event: e,
                      expanded: _expandedEventKey == '${e.calendarId}-${e.id}',
                      past: e.end.isBefore(DateTime.now()) && !e.allDay,
                      onTap: () {
                        setState(() {
                          final key = '${e.calendarId}-${e.id}';
                          _expandedEventKey =
                              _expandedEventKey == key ? null : key;
                        });
                      },
                    ),
                  ),
              ],
            ),
          ),
      ],
    );
  }

  Widget _buildHeader(
    BuildContext context,
    AppL10n l10n,
    bool collapsed, {
    required String label,
    bool isCta = false,
  }) {
    return GestureDetector(
      onTap: () async {
        if (isCta) {
          // 點 CTA 橫幅 → 先跟後端換一張短效 ticket，再打開系統瀏覽器
          final url = await ref
              .read(calendarRepositoryProvider)
              .fetchMobileConnectUrl();
          if (url != null) {
            await launchUrl(
              Uri.parse(url),
              mode: LaunchMode.externalApplication,
            );
          }
          return;
        }
        ref.read(calendarCollapsedProvider.notifier).toggle();
      },
      child: Container(
        margin: EdgeInsets.fromLTRB(14, 4, 14, collapsed ? 4 : 0),
        padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 10),
        decoration: BoxDecoration(
          color: AppColors.muted,
          border: Border.all(color: AppColors.border),
          borderRadius: collapsed
              ? BorderRadius.circular(8)
              : const BorderRadius.only(
                  topLeft: Radius.circular(8),
                  topRight: Radius.circular(8),
                ),
        ),
        child: Row(
          children: [
            Container(
              width: 12,
              height: 12,
              decoration: BoxDecoration(
                color: AppColors.primary,
                borderRadius: BorderRadius.circular(3),
              ),
            ),
            const SizedBox(width: 8),
            Expanded(
              child: Text(
                label,
                style: TextStyle(fontSize: 12, color: AppColors.foreground),
              ),
            ),
            if (!isCta)
              Icon(
                collapsed ? Icons.expand_more : Icons.expand_less,
                size: 16,
                color: AppColors.textDim,
              ),
          ],
        ),
      ),
    );
  }
}
