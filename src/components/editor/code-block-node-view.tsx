import {
  NodeViewContent,
  NodeViewWrapper,
  type NodeViewProps,
} from "@tiptap/react";
import { CODE_BLOCK_LANGUAGES } from "./lowlight-instance";

export function CodeBlockNodeView({
  node,
  updateAttributes,
}: NodeViewProps) {
  const currentLang = (node.attrs.language as string) || "plaintext";

  return (
    <NodeViewWrapper className="relative my-3">
      <select
        contentEditable={false}
        value={currentLang}
        onChange={(e) => updateAttributes({ language: e.target.value })}
        className="absolute top-2 right-2 text-[11px] bg-transparent text-text-dim border border-border rounded px-1.5 py-0.5 cursor-pointer hover:text-foreground focus:outline-none focus:ring-1 focus:ring-primary"
        aria-label="切換語言"
      >
        {CODE_BLOCK_LANGUAGES.map((lang) => (
          <option key={lang.value} value={lang.value}>
            {lang.label}
          </option>
        ))}
      </select>
      <pre className="!pr-24">
        <NodeViewContent as="div" />
      </pre>
    </NodeViewWrapper>
  );
}
