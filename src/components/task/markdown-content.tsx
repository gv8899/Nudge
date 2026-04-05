"use client";

import ReactMarkdown from "react-markdown";

interface MarkdownContentProps {
  content: string;
}

export function MarkdownContent({ content }: MarkdownContentProps) {
  return (
    <ReactMarkdown
      components={{
        h1: ({ children }) => (
          <h1 className="text-xl font-bold text-[#cdcfd2] mt-2 mb-1">{children}</h1>
        ),
        h2: ({ children }) => (
          <h2 className="text-lg font-semibold text-[#cdcfd2] mt-2 mb-1">{children}</h2>
        ),
        h3: ({ children }) => (
          <h3 className="text-base font-medium text-[#cdcfd2] mt-1 mb-1">{children}</h3>
        ),
        p: ({ children }) => (
          <p className="my-1 text-[#b0b2b5]">{children}</p>
        ),
        ul: ({ children }) => (
          <ul className="list-disc pl-5 my-1 space-y-0.5 text-[#b0b2b5]">{children}</ul>
        ),
        ol: ({ children }) => (
          <ol className="list-decimal pl-5 my-1 space-y-0.5 text-[#b0b2b5]">{children}</ol>
        ),
        li: ({ children }) => (
          <li className="text-[#b0b2b5]">{children}</li>
        ),
        strong: ({ children }) => (
          <strong className="text-[#e0e1e3] font-semibold">{children}</strong>
        ),
        em: ({ children }) => (
          <em className="text-[#9b9da0]">{children}</em>
        ),
        code: ({ children }) => (
          <code className="bg-[#3a3c40] px-1 py-0.5 rounded text-[#e8a855] text-xs">{children}</code>
        ),
        a: ({ children, href }) => (
          <a href={href} className="text-[#5cb3e8] underline">{children}</a>
        ),
      }}
    >
      {content}
    </ReactMarkdown>
  );
}
