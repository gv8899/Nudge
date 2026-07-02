"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import {
  useNotificationPreferences,
  type NotificationPreferences,
  type NotificationContent,
} from "@/hooks/use-notification-preferences";
import { SettingsRow } from "./settings-primitives";

const CONTENTS: NotificationContent[] = ["summary", "incomplete", "summary_streak"];

const contentLabelKey = (v: NotificationContent) =>
  `notifications.content.${v === "summary_streak" ? "summaryStreak" : v}`;

export function NotificationsSection() {
  const t = useTranslations();
  const { data, patch } = useNotificationPreferences();
  const [error, setError] = useState<string | null>(null);

  if (!data) return null;

  return (
    <>
      <ToggleRow
        label={t("settings.notifications.morningEnabled")}
        checked={data.morningEnabled}
        onChange={(v) => save({ morningEnabled: v })}
      />
      {data.morningEnabled && (
        <>
          <TimeRow
            label={t("settings.notifications.morningTime")}
            value={data.morningTime}
            onChange={(v) => save({ morningTime: v })}
          />
          <SelectRow
            label={t("settings.notifications.morningContent")}
            value={data.morningContent}
            options={CONTENTS}
            labelFor={(v) => t(contentLabelKey(v))}
            onChange={(v) => save({ morningContent: v })}
          />
        </>
      )}

      <ToggleRow
        label={t("settings.notifications.eveningEnabled")}
        checked={data.eveningEnabled}
        onChange={(v) => save({ eveningEnabled: v })}
      />
      {data.eveningEnabled && (
        <>
          <TimeRow
            label={t("settings.notifications.eveningTime")}
            value={data.eveningTime}
            onChange={(v) => save({ eveningTime: v })}
          />
          <SelectRow
            label={t("settings.notifications.eveningContent")}
            value={data.eveningContent}
            options={CONTENTS}
            labelFor={(v) => t(contentLabelKey(v))}
            onChange={(v) => save({ eveningContent: v })}
          />
        </>
      )}

      <ToggleRow
        label={t("settings.notifications.perTaskEnabled")}
        checked={data.perTaskRemindersEnabled}
        onChange={(v) => save({ perTaskRemindersEnabled: v })}
      />

      <SettingsRow>
        <span className="text-xs text-text-dim">{t("settings.notifications.platformNote")}</span>
      </SettingsRow>
      {error && (
        <SettingsRow>
          <span className="text-xs text-destructive" role="alert">
            {error}
          </span>
        </SettingsRow>
      )}
    </>
  );

  async function save(updates: Partial<NotificationPreferences>) {
    try {
      await patch(updates);
      setError(null);
    } catch {
      setError(t("common.errorSaving"));
    }
  }
}

/// Toggle row uses <div> (not <label>) because the inner button has its own
/// aria-label; wrapping in <label> with no labellable form control inside
/// produces ambiguous a11y semantics.
function ToggleRow({
  label,
  checked,
  onChange,
}: {
  label: string;
  checked: boolean;
  onChange: (v: boolean) => void;
}) {
  return (
    <SettingsRow
      trailing={
        <button
          type="button"
          role="switch"
          aria-checked={checked}
          aria-label={label}
          onClick={() => onChange(!checked)}
          className={`relative h-6 w-11 rounded-full transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40 focus-visible:ring-offset-2 focus-visible:ring-offset-background ${
            checked ? "bg-primary" : "bg-muted"
          }`}
        >
          <span
            className={`absolute top-0.5 h-5 w-5 rounded-full bg-background transition-transform ${
              checked ? "translate-x-5" : "translate-x-0.5"
            }`}
          />
        </button>
      }
    >
      {label}
    </SettingsRow>
  );
}

function TimeRow({
  label,
  value,
  onChange,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
}) {
  return (
    <SettingsRow
      trailing={
        <input
          type="time"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          className="rounded-md border border-border bg-background px-2 py-1 text-sm text-foreground"
          aria-label={label}
        />
      }
    >
      {label}
    </SettingsRow>
  );
}

function SelectRow<T extends string>({
  label,
  value,
  options,
  labelFor,
  onChange,
}: {
  label: string;
  value: T;
  options: T[];
  labelFor: (v: T) => string;
  onChange: (v: T) => void;
}) {
  return (
    <SettingsRow
      trailing={
        <select
          value={value}
          onChange={(e) => onChange(e.target.value as T)}
          className="rounded-md border border-border bg-background px-2 py-1 text-sm text-foreground"
          aria-label={label}
        >
          {options.map((opt) => (
            <option key={opt} value={opt}>
              {labelFor(opt)}
            </option>
          ))}
        </select>
      }
    >
      {label}
    </SettingsRow>
  );
}
