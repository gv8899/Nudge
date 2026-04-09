/**
 * 手繪風 SVG doodles — 給 landing 頁面加一點人味與意外感
 * 所有路徑故意做得不完美，像是隨手拿筆畫上去的筆觸
 */

interface DoodleProps {
  className?: string;
  style?: React.CSSProperties;
}

/** 手繪橢圓圈 — 像用鋼筆圈起關鍵字 */
export function HandDrawnCircle({ className = "", style }: DoodleProps) {
  return (
    <svg
      viewBox="0 0 220 110"
      fill="none"
      className={className}
      style={style}
      aria-hidden="true"
      preserveAspectRatio="none"
    >
      {/* 主要的橢圓 — 起點有一點歪，線條故意微彎 */}
      <path
        d="M 18 58 Q 8 25 55 15 Q 110 5 165 18 Q 205 32 203 62 Q 195 92 140 98 Q 70 104 25 85 Q 10 72 18 58 Z"
        stroke="currentColor"
        strokeWidth="3.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      {/* 末端拖尾 — 模擬筆觸收尾超出圓圈 */}
      <path
        d="M 18 58 Q 5 48 12 30"
        stroke="currentColor"
        strokeWidth="3.5"
        strokeLinecap="round"
        fill="none"
      />
    </svg>
  );
}

/** 手繪底線 — 波浪形 */
export function HandDrawnUnderline({ className = "", style }: DoodleProps) {
  return (
    <svg
      viewBox="0 0 200 16"
      fill="none"
      className={className}
      style={style}
      aria-hidden="true"
      preserveAspectRatio="none"
    >
      <path
        d="M 4 10 Q 30 2 60 10 Q 95 18 130 8 Q 165 2 196 10"
        stroke="currentColor"
        strokeWidth="3"
        strokeLinecap="round"
      />
    </svg>
  );
}

/** 墨水滴 / 星號 — 小裝飾用 */
export function InkSparkle({ className = "", style }: DoodleProps) {
  return (
    <svg
      viewBox="0 0 40 40"
      fill="none"
      className={className}
      style={style}
      aria-hidden="true"
    >
      {/* 四角星狀墨點 */}
      <path
        d="M 20 4 L 22 18 L 36 20 L 22 22 L 20 36 L 18 22 L 4 20 L 18 18 Z"
        fill="currentColor"
      />
    </svg>
  );
}

/** 手繪箭頭 — 微彎、有弧度 */
export function HandDrawnArrow({ className = "", style }: DoodleProps) {
  return (
    <svg
      viewBox="0 0 80 40"
      fill="none"
      className={className}
      style={style}
      aria-hidden="true"
    >
      {/* 彎曲箭頭身 */}
      <path
        d="M 6 8 Q 30 32 68 22"
        stroke="currentColor"
        strokeWidth="2.5"
        strokeLinecap="round"
        fill="none"
      />
      {/* 箭頭頭 — 兩條線 */}
      <path
        d="M 55 12 L 70 22 L 56 30"
        stroke="currentColor"
        strokeWidth="2.5"
        strokeLinecap="round"
        strokeLinejoin="round"
        fill="none"
      />
    </svg>
  );
}

/** 手繪打勾 — 手繪 checkmark */
export function HandDrawnCheck({ className = "", style }: DoodleProps) {
  return (
    <svg
      viewBox="0 0 40 40"
      fill="none"
      className={className}
      style={style}
      aria-hidden="true"
    >
      <path
        d="M 6 22 Q 10 26 16 32 Q 18 34 20 32 Q 28 20 34 8"
        stroke="currentColor"
        strokeWidth="4"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}
