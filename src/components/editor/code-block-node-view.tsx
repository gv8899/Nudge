"use client";

import { useState } from "react";
import {
  NodeViewContent,
  NodeViewWrapper,
  type NodeViewProps,
} from "@tiptap/react";
import { Check, Copy } from "lucide-react";
import { CODE_BLOCK_LANGUAGES } from "./lowlight-instance";

export function CodeBlockNodeView({
  node,
  updateAttributes,
}: NodeViewProps) {
  const currentLang = (node.attrs.language as string) || "plaintext";
  const [copied, setCopied] = useState(false);

  const handleCopy = async () => {
    try {
      const text = node.textContent;
      await navigator.clipboard.writeText(text);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      // 忽略 clipboard 失敗
    }
  };

  return (
    <NodeViewWrapper className="relative my-3 group/codeblock">
      {/* 頂部工具列：語言 + 複製 — 永遠顯示 */}
      <div
        contentEditable={false}
        className="absolute top-2 right-2 z-10 flex items-center gap-1 select-none"
      >
        <select
          value={currentLang}
          onChange={(e) => updateAttributes({ language: e.target.value })}
          className="text-[11px] font-medium bg-background/80 backdrop-blur-sm text-text-dim hover:text-foreground border border-border rounded px-2 py-1 cursor-pointer outline-none focus:ring-1 focus:ring-primary transition-colors"
          aria-label="切換語言"
        >
          {CODE_BLOCK_LANGUAGES.map((lang) => (
            <option key={lang.value} value={lang.value}>
              {lang.label}
            </option>
          ))}
        </select>
        <button
          type="button"
          onClick={handleCopy}
          aria-label={copied ? "已複製" : "複製"}
          title={copied ? "已複製" : "複製程式碼"}
          className="flex items-center justify-center w-7 h-7 bg-background/80 backdrop-blur-sm text-text-dim hover:text-foreground border border-border rounded transition-colors"
        >
          {copied ? (
            <Check className="h-3.5 w-3.5 text-primary" />
          ) : (
            <Copy className="h-3.5 w-3.5" />
          )}
        </button>
      </div>
      <pre className="!pt-12">
        <NodeViewContent />
      </pre>
    </NodeViewWrapper>
  );
}
