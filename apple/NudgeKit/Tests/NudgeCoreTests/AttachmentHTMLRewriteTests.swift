import Testing
@testable import NudgeCore

@Suite("AttachmentHTMLRewrite") struct AttachmentHTMLRewriteTests {
    let result = AttachmentUploadResult(id: "abc_1", width: 800, height: 600)

    @Test func replacesMatchingPlaceholder() {
        let html = #"<p>a</p><img data-upload-pending="true" data-upload-id="u1" alt=""><p>b</p>"#
        let out = AttachmentHTMLRewrite.replacePendingImage(html: html, uploadId: "u1", result: result)
        #expect(out == #"<p>a</p><img src="/api/attachments/abc_1" alt="" data-attachment-id="abc_1" width="800" height="600"><p>b</p>"#)
    }
    @Test func leavesOtherPlaceholdersAlone() {
        let html = #"<img data-upload-pending="true" data-upload-id="u2" alt="">"#
        #expect(AttachmentHTMLRewrite.replacePendingImage(html: html, uploadId: "u1", result: result) == nil)
    }
    @Test func omitsNilDimensions() {
        let html = #"<img data-upload-pending="true" data-upload-id="u1" alt="">"#
        let out = AttachmentHTMLRewrite.replacePendingImage(html: html, uploadId: "u1", result: AttachmentUploadResult(id: "x", width: nil, height: nil))
        #expect(out == #"<img src="/api/attachments/x" alt="" data-attachment-id="x">"#)
    }
    @Test func attributeOrderInsidePlaceholderDoesNotMatter() {
        let html = #"<img alt="" data-upload-id="u1" data-upload-pending="true">"#
        #expect(AttachmentHTMLRewrite.replacePendingImage(html: html, uploadId: "u1", result: result) != nil)
    }
    @Test func rejectsInvalidResultId() {
        let html = #"<img data-upload-pending="true" data-upload-id="u1" alt="">"#
        let bad = AttachmentUploadResult(id: "a\"b", width: 1, height: 1)
        #expect(AttachmentHTMLRewrite.replacePendingImage(html: html, uploadId: "u1", result: bad) == nil)
        #expect(AttachmentHTMLRewrite.replacePendingImage(html: html, uploadId: "u1", result: AttachmentUploadResult(id: "", width: nil, height: nil)) == nil)
    }
    @Test func rejectsIdWithTrailingNewline() {
        let html = #"<img data-upload-pending="true" data-upload-id="u1" alt="">"#
        #expect(AttachmentHTMLRewrite.replacePendingImage(html: html, uploadId: "u1", result: AttachmentUploadResult(id: "a1\n", width: nil, height: nil)) == nil)
    }
    @Test func rejectsIdLongerThan64() {
        let html = #"<img data-upload-pending="true" data-upload-id="u1" alt="">"#
        let long = String(repeating: "a", count: 65)
        #expect(AttachmentHTMLRewrite.replacePendingImage(html: html, uploadId: "u1", result: AttachmentUploadResult(id: long, width: nil, height: nil)) == nil)
        let max = String(repeating: "a", count: 64)
        #expect(AttachmentHTMLRewrite.replacePendingImage(html: html, uploadId: "u1", result: AttachmentUploadResult(id: max, width: nil, height: nil)) != nil)
    }
    @Test func replacesFirstMatchOnly() {
        let html = #"<img data-upload-id="u1"><img data-upload-id="u1">"#
        let out = AttachmentHTMLRewrite.replacePendingImage(html: html, uploadId: "u1", result: result)
        #expect(out == #"<img src="/api/attachments/abc_1" alt="" data-attachment-id="abc_1" width="800" height="600"><img data-upload-id="u1">"#)
    }
    @Test func uploadIdIsMatchedLiterally() {
        let html = #"<img data-upload-id="uXb">"#
        #expect(AttachmentHTMLRewrite.replacePendingImage(html: html, uploadId: "u.b", result: result) == nil)
        let html2 = #"<img data-upload-id="u.b">"#
        #expect(AttachmentHTMLRewrite.replacePendingImage(html: html2, uploadId: "u.b", result: result) != nil)
    }
    @Test func handlesNonASCIIAroundTag() {
        let html = #"<p>中文段落😀</p><img data-upload-pending="true" data-upload-id="u1" alt=""><p>後面的字</p>"#
        let out = AttachmentHTMLRewrite.replacePendingImage(html: html, uploadId: "u1", result: result)
        #expect(out == #"<p>中文段落😀</p><img src="/api/attachments/abc_1" alt="" data-attachment-id="abc_1" width="800" height="600"><p>後面的字</p>"#)
    }
}
