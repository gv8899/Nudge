import Foundation

// 子項目收合狀態的本機持久化（每裝置各自記），鏡像 Web `src/lib/checklist-collapse.ts`。
// key 與 Web 同為 "nudge.checklistCollapsed"，存「收合中的 task id 陣列」。
// 預設展開：不在陣列裡 = 展開。已完成任務一律從收合開始、且點膠囊不寫入（由呼叫端控制）。
enum ChecklistCollapseStore {
    private static let key = "nudge.checklistCollapsed"

    static func isCollapsed(_ taskId: String) -> Bool {
        collapsedIds().contains(taskId)
    }

    static func setCollapsed(_ taskId: String, _ collapsed: Bool) {
        var ids = collapsedIds()
        if collapsed {
            if !ids.contains(taskId) { ids.append(taskId) }
        } else {
            ids.removeAll { $0 == taskId }
        }
        UserDefaults.standard.set(ids, forKey: key)
    }

    private static func collapsedIds() -> [String] {
        (UserDefaults.standard.array(forKey: key) as? [String]) ?? []
    }
}
