"use client";

import { useState } from "react";

interface TaskCreateProps {
  onSubmit: (title: string) => void;
}

export function TaskCreate({ onSubmit }: TaskCreateProps) {
  const [title, setTitle] = useState("");

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = title.trim();
    if (!trimmed) return;
    onSubmit(trimmed);
    setTitle("");
  };

  return (
    <form onSubmit={handleSubmit} className="pl-7">
      <input
        placeholder="新增任務"
        aria-label="新增任務"
        value={title}
        onChange={(e) => setTitle(e.target.value)}
        className="w-full bg-transparent py-2 text-sm text-foreground placeholder-text-faint outline-none border-b border-border focus:border-primary transition-colors"
      />
    </form>
  );
}
