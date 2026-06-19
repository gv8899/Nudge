"use client";

import Image from "next/image";
import { useEffect, useState } from "react";
import { useTranslations } from "next-intl";

/**
 * Heptabase 式：tab 切換 + 自動輪播三張 Mac 整桌面截圖（選單列文字清掉、桌布保留）。
 * 真實桌布當底 → 整張圖圓角卡片 + 陰影。hover 暫停輪播、
 * prefers-reduced-motion 不自動輪播（tab 仍可手動切）。
 */
const SLIDES = [
  { key: "tasks", src: "/landing/desk-tasks.jpg" },
  { key: "calendar", src: "/landing/desk-calendar.jpg" },
  { key: "cards", src: "/landing/desk-cards.jpg" },
] as const;

const INTERVAL = 4200;

export function WorkspaceCarousel() {
  const t = useTranslations("landing.workspace.tabs");
  const [i, setI] = useState(0);
  const [paused, setPaused] = useState(false);

  useEffect(() => {
    if (paused) return;
    const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
    if (mq.matches) return;
    const id = setInterval(() => setI((v) => (v + 1) % SLIDES.length), INTERVAL);
    return () => clearInterval(id);
  }, [paused]);

  return (
    <div
      onMouseEnter={() => setPaused(true)}
      onMouseLeave={() => setPaused(false)}
    >
      {/* tabs */}
      <div className="mb-7 flex flex-wrap justify-center gap-2">
        {SLIDES.map((s, idx) => {
          const active = idx === i;
          return (
            <button
              key={s.key}
              type="button"
              onClick={() => setI(idx)}
              aria-pressed={active}
              className={`rounded-full px-4 py-2 text-sm font-medium transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary ${
                active
                  ? "bg-primary text-primary-foreground"
                  : "border border-border text-muted-foreground hover:text-foreground hover:bg-[var(--surface-hover)]"
              }`}
            >
              {t(s.key)}
            </button>
          );
        })}
      </div>

      {/* 真桌布當底：整張圖圓角卡片 + 陰影，cross-fade 切換 */}
      <div className="relative mx-auto aspect-[2400/1493] w-full max-w-[1080px] overflow-hidden rounded-2xl border border-border shadow-[0_30px_70px_-24px_rgba(40,32,18,0.34)]">
        {SLIDES.map((s, idx) => (
          <Image
            key={s.key}
            src={s.src}
            alt={t(s.key)}
            fill
            sizes="(max-width: 1080px) 92vw, 1080px"
            priority={idx === 0}
            className={`object-cover transition-opacity duration-700 ease-out ${
              idx === i ? "opacity-100" : "opacity-0"
            }`}
          />
        ))}
      </div>
    </div>
  );
}
