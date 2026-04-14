class CalendarEvent {
  final String id;
  final String calendarId;
  final String calendarName;
  final String title;
  final DateTime start;
  final DateTime end;
  final bool allDay;
  final String? location;
  final String? description;
  final List<String> attendees;
  final String htmlLink;
  final String hangoutLink;
  final bool busyOnly;

  CalendarEvent({
    required this.id,
    required this.calendarId,
    required this.calendarName,
    required this.title,
    required this.start,
    required this.end,
    required this.allDay,
    required this.location,
    required this.description,
    required this.attendees,
    required this.htmlLink,
    required this.hangoutLink,
    required this.busyOnly,
  });

  factory CalendarEvent.fromJson(Map<String, dynamic> json) {
    return CalendarEvent(
      id: json['id'] as String,
      calendarId: json['calendarId'] as String,
      calendarName: json['calendarName'] as String? ?? '',
      title: json['title'] as String? ?? '',
      start: DateTime.parse(json['start'] as String),
      end: DateTime.parse(json['end'] as String),
      allDay: json['allDay'] as bool? ?? false,
      location: json['location'] as String?,
      description: json['description'] as String?,
      attendees: ((json['attendees'] as List?) ?? [])
          .map((e) => e.toString())
          .toList(),
      htmlLink: json['htmlLink'] as String? ?? '',
      hangoutLink: json['hangoutLink'] as String? ?? '',
      busyOnly: json['busyOnly'] as bool? ?? false,
    );
  }
}

/// /api/calendar/events response
class CalendarEventsResponse {
  final bool connected;
  final String? reason;
  final List<CalendarEvent> events;

  CalendarEventsResponse({
    required this.connected,
    this.reason,
    required this.events,
  });

  factory CalendarEventsResponse.fromJson(Map<String, dynamic> json) {
    final connected = json['connected'] as bool? ?? false;
    return CalendarEventsResponse(
      connected: connected,
      reason: json['reason'] as String?,
      events: connected
          ? ((json['events'] as List?) ?? [])
              .map((e) => CalendarEvent.fromJson(e as Map<String, dynamic>))
              .toList()
          : <CalendarEvent>[],
    );
  }
}
