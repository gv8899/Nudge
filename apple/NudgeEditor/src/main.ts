// apple/NudgeEditor/src/main.ts
import { createEditorExtensions } from "@web-editor/editor-extensions";
import { SLASH_COMMAND_DEFS } from "@web-editor/slash-command-defs";

console.log("nudge-editor bundle loaded", {
  extensions: createEditorExtensions.name,
  slashCount: SLASH_COMMAND_DEFS.length,
});
