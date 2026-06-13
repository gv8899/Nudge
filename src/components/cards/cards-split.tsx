"use client";

import { useState, useEffect } from "react";
import { ResizeHandle } from "@/components/ui/resize-handle";
import { CardsFeed } from "./cards-feed";
import { CardDetail } from "./card-detail";

// ── localStorage ──────────────────────────────────────────────────────────────
const LS_DETAIL_WIDTH = "cards.web.detailWidth";
const DETAIL_MIN = 360;
const DETAIL_MAX = 900;
const DETAIL_DEFAULT = 520;

function clampDetailWidth(w: number) {
  return Math.min(DETAIL_MAX, Math.max(DETAIL_MIN, w));
}

function lsReadNumber(key: string, fallback: number): number {
  if (typeof window === "undefined") return fallback;
  const v = window.localStorage.getItem(key);
  if (v === null) return fallback;
  const n = Number(v);
  return isNaN(n) ? fallback : n;
}

// ── Props ─────────────────────────────────────────────────────────────────────
export interface CardsSplitProps {
  /** Seed the selected card (e.g. from deep-link /cards/[id]). */
  initialCardId?: string;
}

// ── Main CardsSplit component ─────────────────────────────────────────────────
export function CardsSplit({ initialCardId }: CardsSplitProps) {
  const [selectedId, setSelectedId] = useState<string | null>(
    initialCardId ?? null
  );
  const [detailWidth, setDetailWidth] = useState<number>(DETAIL_DEFAULT);
  const [isMd, setIsMd] = useState<boolean>(false);

  // SSR-safe: hydrate localStorage + matchMedia in effects only
  useEffect(() => {
    setDetailWidth(clampDetailWidth(lsReadNumber(LS_DETAIL_WIDTH, DETAIL_DEFAULT)));
  }, []);

  useEffect(() => {
    const mq = window.matchMedia("(min-width: 768px)");
    setIsMd(mq.matches);
    const handler = (e: MediaQueryListEvent) => setIsMd(e.matches);
    mq.addEventListener("change", handler);
    return () => mq.removeEventListener("change", handler);
  }, []);

  const handleWidthChange = (px: number) => {
    const clamped = clampDetailWidth(px);
    setDetailWidth(clamped);
    localStorage.setItem(LS_DETAIL_WIDTH, String(clamped));
  };

  // ── Mobile: use standard CardsFeed (navigate to /cards/[id] full page) ───
  if (!isMd) {
    // If deep-linked to /cards/[id] on mobile, show full-page CardDetail
    if (initialCardId) {
      return <CardDetail id={initialCardId} />;
    }
    return <CardsFeed />;
  }

  // ── Desktop: no card selected → full-width grid ──────────────────────────
  if (!selectedId) {
    return (
      <div className="h-[100dvh] overflow-y-auto">
        <CardsFeed onSelectCard={setSelectedId} selectedId={null} layout="grid" />
      </div>
    );
  }

  // ── Desktop: card selected → master-detail split ─────────────────────────
  return (
    <div className="flex h-[100dvh] overflow-hidden">
      {/* LEFT: narrow single-column list */}
      <div className="flex-1 min-w-0 overflow-y-auto">
        <CardsFeed
          onSelectCard={setSelectedId}
          selectedId={selectedId}
          layout="list"
        />
      </div>

      {/* RIGHT: card detail pane with resize handle */}
      <div
        className="flex shrink-0 border-l border-border overflow-hidden"
        style={{ width: detailWidth }}
      >
        <ResizeHandle
          value={detailWidth}
          onChange={handleWidthChange}
          min={DETAIL_MIN}
          max={DETAIL_MAX}
          side="left"
        />
        <div className="flex-1 overflow-y-auto">
          <CardDetail
            id={selectedId}
            embedded
            onBack={() => setSelectedId(null)}
          />
        </div>
      </div>
    </div>
  );
}
