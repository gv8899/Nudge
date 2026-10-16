import Foundation
import Observation

/// 卡片內文圖片。WKWebView 的 <img> 不會帶 Bearer，所以由 AttachmentSchemeHandler
/// 透過這裡代抓。記憶體 NSCache；磁碟靠 URLSession 預設 URLCache（server 回
/// `Cache-Control: private, max-age=31536000, immutable`，URLCache 是 private cache
/// 可以存）。
@Observable
@MainActor
public final class AttachmentRepository {
    private let client: APIClient
    private let cache = NSCache<NSString, CachedImage>()

    final class CachedImage {
        let data: Data
        let mime: String
        init(data: Data, mime: String) { self.data = data; self.mime = mime }
    }

    public init(client: APIClient) {
        self.client = client
        cache.totalCostLimit = 64 * 1024 * 1024
    }

    public func imageData(id: String) async throws -> (Data, String) {
        if let hit = cache.object(forKey: id as NSString) {
            return (hit.data, hit.mime)
        }
        let (data, contentType) = try await client.getData("/api/attachments/\(id)")
        let mime = contentType ?? "application/octet-stream"
        cache.setObject(CachedImage(data: data, mime: mime), forKey: id as NSString, cost: data.count)
        return (data, mime)
    }
}
