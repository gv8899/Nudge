import Foundation

public extension String {
    /// Removes HTML tags, decodes a small set of common entities, and
    /// collapses whitespace. Matches the behaviour of Web's
    /// `src/lib/strip-html.ts` — not a full HTML parser; just enough for
    /// Quill/Tiptap output (paragraphs, lists, inline formatting).
    func strippedHTML(maxLength: Int? = nil) -> String {
        // 1. Drop tags.
        var out = self.replacingOccurrences(
            of: "<[^>]+>",
            with: " ",
            options: .regularExpression
        )

        // 2. Decode common entities.
        let entities: [(String, String)] = [
            ("&amp;", "&"),
            ("&lt;", "<"),
            ("&gt;", ">"),
            ("&quot;", "\""),
            ("&#39;", "'"),
            ("&nbsp;", " ")
        ]
        for (k, v) in entities {
            out = out.replacingOccurrences(of: k, with: v)
        }

        // 3. Collapse whitespace.
        out = out.replacingOccurrences(
            of: "\\s+",
            with: " ",
            options: .regularExpression
        )
        out = out.trimmingCharacters(in: .whitespacesAndNewlines)

        // 4. Truncate if requested.
        if let max = maxLength, out.count > max {
            out = String(out.prefix(max))
        }
        return out
    }
}
