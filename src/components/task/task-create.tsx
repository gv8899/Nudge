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
    <form onSubmit={handleSubmit}>
      <input
        placeholder="新增任務，按 Enter 建立..."
        value={title}
        onChange={(e) => setTitle(e.target.value)}
        className="w-full bg-transparent px-1 py-2 text-sm text-[#cdcfd2] placeholder-[#555759] outline-none border-b border-[#3a3c40] focus:border-[#5cb3e8] transition-colors"
      />
    </form>
  );
}
