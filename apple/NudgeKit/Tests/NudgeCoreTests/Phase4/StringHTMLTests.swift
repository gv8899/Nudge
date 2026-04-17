import Testing
@testable import NudgeCore

@Suite("StringHTML") struct StringHTMLTests {
    @Test func stripsSimpleTags() {
        let html = "<p>Hello <strong>world</strong></p>"
        #expect(html.strippedHTML() == "Hello world")
    }

    @Test func collapsesWhitespace() {
        let html = "<p>foo</p>\n\n<p>bar</p>"
        #expect(html.strippedHTML() == "foo bar")
    }

    @Test func decodesCommonEntities() {
        let html = "&amp; &lt; &gt; &quot; &#39; &nbsp;"
        #expect(html.strippedHTML() == "& < > \" '")
    }

    @Test func truncatesToMaxLength() {
        let html = "<p>" + String(repeating: "a", count: 200) + "</p>"
        let out = html.strippedHTML(maxLength: 50)
        #expect(out.count == 50)
    }

    @Test func handlesEmptyAndNilLike() {
        #expect("".strippedHTML() == "")
        #expect("<p></p>".strippedHTML() == "")
    }

    @Test func keepsPlainText() {
        #expect("no tags here".strippedHTML() == "no tags here")
    }
}
