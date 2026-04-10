"use client";

import { TAG_COLORS, type TagColor } from "@/lib/constants";

interface TagColorPickerProps {
  value: string;
  onChange: (color: TagColor) => void;
}

export function TagColorPicker({ value, onChange }: TagColorPickerProps) {
  return (
    <div className="grid grid-cols-4 gap-2 p-2">
      {TAG_COLORS.map((c) => (
        <button
          key={c.value}
          type="button"
          onClick={() => onChange(c.value)}
          title={c.label}
          aria-label={c.label}
          aria-pressed={value === c.value}
          className={`w-7 h-7 rounded-full border-2 transition-colors ${
            value === c.value
              ? "border-foreground scale-110"
              : "border-transparent hover:border-muted-foreground"
          }`}
          style={{ backgroundColor: `var(--${c.value})` }}
        />
      ))}
    </div>
  );
}
