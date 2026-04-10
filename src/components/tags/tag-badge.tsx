"use client";

interface TagBadgeProps {
  name: string;
  color: string;
  onRemove?: () => void;
}

export function TagBadge({ name, color, onRemove }: TagBadgeProps) {
  return (
    <span
      className="inline-flex items-center gap-1 text-[11px] px-1.5 py-0.5 rounded"
      style={{
        color: `var(--${color})`,
        backgroundColor: `color-mix(in srgb, var(--${color}) 15%, transparent)`,
      }}
    >
      {name}
      {onRemove && (
        <button
          type="button"
          onClick={(e) => {
            e.preventDefault();
            e.stopPropagation();
            onRemove();
          }}
          className="hover:opacity-70 transition-opacity leading-none"
          aria-label={`移除 ${name}`}
        >
          ×
        </button>
      )}
    </span>
  );
}
