/**
 * SF Icon — design-system 層的 chrome icon 元件。
 *
 * 圖形來源是 Mac App 實際使用的 SF Symbol 字形（不是 lucide 近似品）：
 * 用 scratchpad 的 render-symbol.swift 把 symbol 渲染成 PNG，裁邊、
 * 補成正方形、縮到 96px，以 data URI alpha mask 形式放在
 * `src/app/globals.css` 的 `.sf-<name>` 規則，`currentColor` 上色。
 *
 * 新增 icon 流程：
 *   1. swift render-symbol.swift <sf.symbol.name> sf-<name>.png
 *   2. 重跑 globals.css 的 sf-icons 生成段（裁邊→方形→96px→base64）
 *   3. 在下方 SF_ICONS 加上名字
 *
 * 尺寸規範（對齊 Mac toolbar）：
 *   - sidebar nav 項目：h-5 w-5（20px）
 *   - toolbar icon 按鈕：本體 h-9 w-12 rounded-full（寬扁膠囊），字形 h-4 w-4
 *     （16px — 左右各留 16px、上下各留 10px，比照 Mac 留白）
 *   - chevron：h-4 w-4
 */

export const SF_ICONS = [
  "book",
  "calendar",
  "checkmark-circle",
  "chevron-left",
  "chevron-right",
  "gearshape",
  "magnifyingglass",
  "plus",
  "sidebar-left",
  "sidebar-right",
  "square-stack",
  "tag",
] as const;

export type SFIconName = (typeof SF_ICONS)[number];

export function SFIcon({
  name,
  className,
}: {
  name: SFIconName;
  className?: string;
}) {
  return (
    <span
      className={`sf-icon sf-${name} ${className ?? ""}`}
      role="img"
      aria-hidden="true"
    />
  );
}

/** ComponentType<{className}> 介面的具名包裝 — 給 navItems 這類吃 icon 元件的地方。 */
function make(name: SFIconName) {
  const C = ({ className }: { className?: string }) => (
    <SFIcon name={name} className={className} />
  );
  C.displayName = `SFIcon(${name})`;
  return C;
}

export const IconTasks = make("checkmark-circle");
export const IconCalendar = make("calendar");
export const IconCards = make("square-stack");
export const IconNotes = make("book");
export const IconSettings = make("gearshape");
export const IconSidebarLeft = make("sidebar-left");
export const IconSidebarRight = make("sidebar-right");
