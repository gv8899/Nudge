"use client";

import { useScrollReveal } from "./use-scroll-reveal";

interface RevealProps {
  children: React.ReactNode;
  className?: string;
  /** 階梯延遲（秒），同段多元素錯落進場用 */
  delay?: number;
}

export function Reveal({ children, className = "", delay = 0 }: RevealProps) {
  const ref = useScrollReveal<HTMLDivElement>();
  return (
    <div
      ref={ref}
      className={`reveal ${className}`}
      style={delay ? { transitionDelay: `${delay}s` } : undefined}
    >
      {children}
    </div>
  );
}
