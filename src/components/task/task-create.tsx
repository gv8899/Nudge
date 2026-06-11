"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";

interface TaskCreateProps {
  onSubmit: (title: string) => void;
}

export function TaskCreate({ onSubmit }: TaskCreateProps) {
  const t = useTranslations("task");
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
        placeholder={t("createPlaceholder")}
        aria-label={t("createPlaceholder")}
        value={title}
        onChange={(e) => setTitle(e.target.value)}
        autoFocus
        className="w-full bg-transparent py-2 text-sm text-foreground placeholder-text-faint outline-none border-b border-border focus:border-primary transition-colors"
      />
    </form>
  );
}
