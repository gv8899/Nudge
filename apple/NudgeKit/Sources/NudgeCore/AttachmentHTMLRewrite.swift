import Foundation

/// 鏡像 `src/components/editor/attachment-url.ts` 的 `replacePendingImage`，
/// 輸出必須與 Web 字元級一致。
public enum AttachmentHTMLRewrite {
    private static let idPattern = try! NSRegularExpression(pattern: #"\A[A-Za-z0-9_-]{1,64}\z"#)  // \z：ICU 的 $ 會吃結尾 \n，JS 不會

    /// 把第一個帶 `data-upload-id="<uploadId>"` 的 `<img …>` placeholder 換成最終 tag
    /// （屬性順序 src, alt, data-attachment-id, width, height；nil 寬高省略）。
    /// placeholder 不在或 `result.id` 不合法 → nil。
    public static func replacePendingImage(
        html: String,
        uploadId: String,
        result: AttachmentUploadResult
    ) -> String? {
        let id = result.id
        guard idPattern.firstMatch(in: id, range: NSRange(id.startIndex..., in: id)) != nil else {
            return nil
        }
        let pattern = #"<img\b[^>]*\bdata-upload-id=""#
            + NSRegularExpression.escapedPattern(for: uploadId)
            + #""[^>]*>"#
        guard let re = try? NSRegularExpression(pattern: pattern),
              let match = re.firstMatch(in: html, range: NSRange(html.startIndex..., in: html)),
              let range = Range(match.range, in: html)
        else { return nil }

        var tag = #"<img src="/api/attachments/\#(id)" alt="" data-attachment-id="\#(id)""#
        if let width = result.width { tag += #" width="\#(width)""# }
        if let height = result.height { tag += #" height="\#(height)""# }
        tag += ">"

        var out = html
        out.replaceSubrange(range, with: tag)
        return out
    }
}
