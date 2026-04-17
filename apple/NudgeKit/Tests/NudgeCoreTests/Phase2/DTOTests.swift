import Testing
import Foundation
@testable import NudgeCore

@Suite("Phase 2 DTOs") struct DTOTests {
    @Test func taskDTODecodesRealServerShape() throws {
        let json = #"""
        {
          "id": "t1",
          "title": "Buy milk",
          "description": "at 7-11",
          "status": "in_progress",
          "createdAt": "2026-04-17T10:00:00.000Z",
          "updatedAt": "2026-04-17T10:00:00.000Z"
        }
        """#.data(using: .utf8)!
        let decoder = JSONDecoder()
        decoder.dateDecodingStrategy = .iso8601
        let task = try decoder.decode(TaskDTO.self, from: json)
        #expect(task.id == "t1")
        #expect(task.title == "Buy milk")
        #expect(task.status == "in_progress")
    }

    @Test func dailyAssignmentDecodesNestedTask() throws {
        let json = #"""
        {
          "id": "a1",
          "taskId": "t1",
          "date": "2026-04-17",
          "isCompleted": false,
          "sortOrder": 0,
          "task": {
            "id": "t1",
            "title": "Buy milk",
            "description": "",
            "status": "in_progress",
            "createdAt": "2026-04-17T10:00:00.000Z",
            "updatedAt": "2026-04-17T10:00:00.000Z"
          }
        }
        """#.data(using: .utf8)!
        let decoder = JSONDecoder()
        decoder.dateDecodingStrategy = .iso8601
        let a = try decoder.decode(DailyAssignmentDTO.self, from: json)
        #expect(a.id == "a1")
        #expect(a.task.title == "Buy milk")
    }

    @Test func dailyDataDTODecodesFullResponse() throws {
        let json = #"""
        {
          "date": "2026-04-17",
          "assignments": [],
          "overdueTasks": [],
          "noteContent": null
        }
        """#.data(using: .utf8)!
        let decoder = JSONDecoder()
        decoder.dateDecodingStrategy = .iso8601
        let data = try decoder.decode(DailyDataDTO.self, from: json)
        #expect(data.date == "2026-04-17")
        #expect(data.assignments.isEmpty)
        #expect(data.noteContent == nil)
    }

    @Test func weekSummaryDecodes() throws {
        let json = #"{"datesWithTasks":["2026-04-15","2026-04-17"]}"#.data(using: .utf8)!
        let summary = try JSONDecoder().decode(WeekSummaryDTO.self, from: json)
        #expect(summary.datesWithTasks == ["2026-04-15", "2026-04-17"])
    }

    @Test func calendarEventDecodes() throws {
        let json = #"""
        {
          "id": "ev1",
          "summary": "Meeting",
          "start": "2026-04-17T09:00:00Z",
          "end": "2026-04-17T10:00:00Z",
          "location": "Room 1",
          "attendees": ["alice@x.com"],
          "hangoutLink": null,
          "htmlLink": "https://cal.google.com/..."
        }
        """#.data(using: .utf8)!
        let decoder = JSONDecoder()
        decoder.dateDecodingStrategy = .iso8601
        let ev = try decoder.decode(CalendarEventDTO.self, from: json)
        #expect(ev.id == "ev1")
        #expect(ev.attendees.count == 1)
    }

    @Test func tagDTODecodes() throws {
        let json = #"""
        {"id":"tag1","name":"Work","color":"#5a7050","sortOrder":0}
        """#.data(using: .utf8)!
        let tag = try JSONDecoder().decode(TagDTO.self, from: json)
        #expect(tag.name == "Work")
        #expect(tag.color == "#5a7050")
    }
}
