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
          <h1 className="text-xl font-bold text-foreground mt-2 mb-1">{children}</h1>
        ),
        h2: ({ children }) => (
          <h2 className="text-lg font-semibold text-foreground mt-2 mb-1">{children}</h2>
        ),
        h3: ({ children }) => (
          <h3 className="text-base font-medium text-foreground mt-1 mb-1">{children}</h3>
        ),
        p: ({ children }) => (
          <p className="my-1 text-muted-foreground">{children}</p>
        ),
        ul: ({ children }) => (
          <ul className="list-disc pl-5 my-1 space-y-0.5 text-muted-foreground">{children}</ul>
        ),
        ol: ({ children }) => (
          <ol className="list-decimal pl-5 my-1 space-y-0.5 text-muted-foreground">{children}</ol>
        ),
        li: ({ children }) => (
          <li className="text-muted-foreground">{children}</li>
        ),
        strong: ({ children }) => (
          <strong className="text-foreground font-semibold">{children}</strong>
        ),
        em: ({ children }) => (
          <em className="text-muted-foreground">{children}</em>
        ),
        code: ({ children }) => (
          <code className="bg-border px-1 py-0.5 rounded text-chart-2 text-xs">{children}</code>
        ),
        a: ({ children, href }) => (
          <a href={href} className="text-primary underline" target="_blank" rel="noopener noreferrer">{children}</a>
        ),
      }}
    >
      {content}
    </ReactMarkdown>
  );
}
