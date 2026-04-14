import 'package:flutter/material.dart';
import 'package:url_launcher/url_launcher.dart';
import '../../core/theme.dart';
import '../../l10n/app_localizations.dart';
import 'calendar_models.dart';

class CalendarEventTile extends StatelessWidget {
  final CalendarEvent event;
  final bool expanded;
  final VoidCallback onTap;
  final bool past;

  const CalendarEventTile({
    super.key,
    required this.event,
    required this.expanded,
    required this.onTap,
    required this.past,
  });

  String _formatTime(BuildContext context) {
    final l10n = AppL10n.of(context)!;
    if (event.allDay) return l10n.calendarEventAllDay;
    String two(int n) => n.toString().padLeft(2, '0');
    return '${two(event.start.hour)}:${two(event.start.minute)} – '
        '${two(event.end.hour)}:${two(event.end.minute)}';
  }

  @override
  Widget build(BuildContext context) {
    final l10n = AppL10n.of(context)!;
    final canExpand = !event.busyOnly;
    final opacity = past ? 0.55 : 1.0;

    return Opacity(
      opacity: opacity,
      child: Container(
        decoration: BoxDecoration(
          color: AppColors.card,
          border: Border.all(color: AppColors.border),
          borderRadius: BorderRadius.circular(8),
        ),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: [
            InkWell(
              onTap: canExpand ? onTap : null,
              borderRadius: BorderRadius.circular(8),
              child: Padding(
                padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 8),
                child: Row(
                  children: [
                    Expanded(
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          Text(
                            _formatTime(context),
                            style: TextStyle(fontSize: 11, color: AppColors.textDim),
                          ),
                          const SizedBox(height: 2),
                          Text(
                            event.title,
                            style: TextStyle(fontSize: 13, color: AppColors.foreground),
                            maxLines: 1,
                            overflow: TextOverflow.ellipsis,
                          ),
                          if (event.location != null) ...[
                            const SizedBox(height: 2),
                            Row(
                              children: [
                                Icon(Icons.place_outlined, size: 10, color: AppColors.textDim),
                                const SizedBox(width: 2),
                                Expanded(
                                  child: Text(
                                    event.location!,
                                    style: TextStyle(fontSize: 10, color: AppColors.textDim),
                                    maxLines: 1,
                                    overflow: TextOverflow.ellipsis,
                                  ),
                                ),
                              ],
                            ),
                          ],
                        ],
                      ),
                    ),
                    if (canExpand)
                      Icon(
                        expanded ? Icons.expand_less : Icons.expand_more,
                        size: 16,
                        color: AppColors.textDim,
                      ),
                  ],
                ),
              ),
            ),
            if (canExpand && expanded)
              Container(
                padding: const EdgeInsets.fromLTRB(12, 8, 12, 12),
                decoration: BoxDecoration(
                  border: Border(top: BorderSide(color: AppColors.border)),
                ),
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    if (event.location != null)
                      _DetailRow(label: l10n.calendarEventLocation, value: event.location!),
                    if (event.attendees.isNotEmpty)
                      _DetailRow(
                        label: l10n.calendarEventAttendees,
                        value: event.attendees.join(' · '),
                      ),
                    if (event.description != null)
                      _DetailRow(
                        label: l10n.calendarEventDescription,
                        value: event.description!,
                        maxLines: 6,
                      ),
                    if (event.hangoutLink.isNotEmpty)
                      Padding(
                        padding: const EdgeInsets.only(top: 8),
                        child: InkWell(
                          onTap: () => launchUrl(Uri.parse(event.hangoutLink)),
                          child: Row(
                            mainAxisSize: MainAxisSize.min,
                            children: [
                              Icon(Icons.videocam_outlined, size: 12, color: AppColors.primary),
                              const SizedBox(width: 4),
                              Text(
                                l10n.calendarEventJoinMeet,
                                style: TextStyle(fontSize: 11, color: AppColors.primary),
                              ),
                            ],
                          ),
                        ),
                      ),
                    if (event.htmlLink.isNotEmpty)
                      Padding(
                        padding: const EdgeInsets.only(top: 8),
                        child: InkWell(
                          onTap: () => launchUrl(Uri.parse(event.htmlLink)),
                          child: Row(
                            mainAxisSize: MainAxisSize.min,
                            children: [
                              Icon(Icons.open_in_new, size: 12, color: AppColors.primary),
                              const SizedBox(width: 4),
                              Text(
                                l10n.calendarEventOpenInGoogle,
                                style: TextStyle(fontSize: 11, color: AppColors.primary),
                              ),
                            ],
                          ),
                        ),
                      ),
                  ],
                ),
              ),
          ],
        ),
      ),
    );
  }
}

class _DetailRow extends StatelessWidget {
  final String label;
  final String value;
  final int maxLines;

  const _DetailRow({required this.label, required this.value, this.maxLines = 2});

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.only(bottom: 6),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text(
            label.toUpperCase(),
            style: TextStyle(
              fontSize: 9,
              color: AppColors.textFaint,
              letterSpacing: 0.4,
            ),
          ),
          const SizedBox(height: 1),
          Text(
            value,
            style: TextStyle(fontSize: 11, color: AppColors.foreground),
            maxLines: maxLines,
            overflow: TextOverflow.ellipsis,
          ),
        ],
      ),
    );
  }
}
