import Foundation
import WebKit
import NudgeCore

/// 攔 `nudge-attachment://attachment/<id>` → AttachmentRepository 代抓（帶 Bearer）。
/// WebKit 規定：task 被 stop 之後不得再呼叫 didReceive / didFinish（會 crash），
/// 所以用 `stopped` 集合守住。
@MainActor
final class AttachmentSchemeHandler: NSObject, WKURLSchemeHandler {
    static let scheme = "nudge-attachment"

    private let repository: AttachmentRepository
    private var stopped = Set<ObjectIdentifier>()

    init(repository: AttachmentRepository) {
        self.repository = repository
    }

    func webView(_ webView: WKWebView, start urlSchemeTask: WKURLSchemeTask) {
        let key = ObjectIdentifier(urlSchemeTask)
        guard let url = urlSchemeTask.request.url else {
            urlSchemeTask.didFailWithError(URLError(.badURL))
            return
        }
        let id = url.lastPathComponent
        guard !id.isEmpty, id != "attachment" else {
            urlSchemeTask.didFailWithError(URLError(.badURL))
            return
        }
        Task { @MainActor [weak self] in
            guard let self else { return }
            // 不論哪條路徑結束都清 key —— 否則已 stop 的 task 早退留下的
            // ObjectIdentifier 可能被之後新 task 重用，誤判成已 stop、圖永遠不載。
            defer { self.stopped.remove(key) }
            do {
                let (data, mime) = try await self.repository.imageData(id: id)
                guard !self.stopped.contains(key) else { return }
                let response = URLResponse(
                    url: url, mimeType: mime, expectedContentLength: data.count, textEncodingName: nil
                )
                urlSchemeTask.didReceive(response)
                urlSchemeTask.didReceive(data)
                urlSchemeTask.didFinish()
            } catch {
                guard !self.stopped.contains(key) else { return }
                urlSchemeTask.didFailWithError(error)
            }
        }
    }

    func webView(_ webView: WKWebView, stop urlSchemeTask: WKURLSchemeTask) {
        stopped.insert(ObjectIdentifier(urlSchemeTask))
    }
}
