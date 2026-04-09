"use client";

import Link from "next/link";
import useSWR from "swr";
import DOMPurify from "dompurify";
import { format, parseISO } from "date-fns";
import { ArrowLeft } from "lucide-react";
import { fetcher } from "@/lib/fetcher";
import { TASK_STATUSES, type TaskStatus } from "@/lib/constants";

interface CardDetailProps {
  id: string;
}

interface CardData {
  id: string;
  title: string;
  description: string | null;
  status: TaskStatus;
  createdAt: string;
  updatedAt: string;
  completedAt: string | null;
}

export function CardDetail({ id }: CardDetailProps) {
  const { data, error, isLoading } = useSWR<CardData>(
    `/api/tasks/${id}`,
    fetcher
  );

  if (isLoading) {
    return (
      <div className="mx-auto max-w-3xl px-4 md:px-6 py-8">
        <p className="text-sm text-text-dim">載入中...</p>
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="mx-auto max-w-3xl px-4 md:px-6 py-8">
        <Link
          href="/cards"
          className="inline-flex items-center gap-1 text-sm text-text-dim hover:text-foreground transition-colors mb-4"
        >
          <ArrowLeft className="h-4 w-4" /> 返回卡片
        </Link>
        <p className="text-sm text-destructive">找不到這張卡片</p>
      </div>
    );
  }

  const status = TASK_STATUSES[data.status];
  const cleanHTML = data.description ? DOMPurify.sanitize(data.description) : "";

  return (
    <div className="mx-auto max-w-3xl px-4 md:px-6 py-8">
      <Link
        href="/cards"
        className="inline-flex items-center gap-1 text-sm text-text-dim hover:text-foreground transition-colors mb-6"
      >
        <ArrowLeft className="h-4 w-4" /> 返回卡片
      </Link>

      <header className="mb-6 pb-4 border-b border-border">
        <h1 className="text-3xl font-bold text-foreground tracking-tight mb-3">
          {data.title}
        </h1>
        <div className="flex items-center gap-3 text-xs text-text-dim">
          <span>建立 {format(parseISO(data.createdAt), "yyyy/MM/dd")}</span>
          <span>·</span>
          <span>更新 {format(parseISO(data.updatedAt), "yyyy/MM/dd")}</span>
          <span>·</span>
          <span
            className="px-1.5 py-0.5 rounded border text-[10px]"
            style={{
              color: status.color,
              borderColor: status.color,
              backgroundColor: status.bgColor,
            }}
          >
            {status.label}
          </span>
        </div>
      </header>

      {cleanHTML ? (
        <div
          className="tiptap-container"
          dangerouslySetInnerHTML={{ __html: cleanHTML }}
        />
      ) : (
        <p className="text-sm text-text-dim italic">這張卡片沒有內容</p>
      )}
    </div>
  );
}
