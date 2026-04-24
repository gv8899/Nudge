import {
  Type, Heading1, Heading2, Heading3, List, ListOrdered, ListTodo,
  Quote, Code, Minus, type LucideIcon,
} from "lucide-react";
import { useTranslations } from "next-intl";
import { useMemo } from "react";
import {
  SLASH_COMMAND_DEFS,
  type SlashCommandItem as BaseSlashCommandItem,
} from "./slash-command-defs";

export { filterSlashItems } from "./slash-command-defs";

const ID_TO_ICON: Record<string, LucideIcon> = {
  text: Type, h1: Heading1, h2: Heading2, h3: Heading3,
  bullet: List, ordered: ListOrdered, todo: ListTodo,
  quote: Quote, code: Code, divider: Minus,
};

const ID_TO_KEY: Record<string, { label: string; description: string; keywords: string }> = {
  text: { label: "slashTextLabel", description: "slashTextDescription", keywords: "slashTextKeywords" },
  h1: { label: "slashH1Label", description: "slashH1Description", keywords: "slashH1Keywords" },
  h2: { label: "slashH2Label", description: "slashH2Description", keywords: "slashH2Keywords" },
  h3: { label: "slashH3Label", description: "slashH3Description", keywords: "slashH3Keywords" },
  bullet: { label: "slashBulletLabel", description: "slashBulletDescription", keywords: "slashBulletKeywords" },
  ordered: { label: "slashOrderedLabel", description: "slashOrderedDescription", keywords: "slashOrderedKeywords" },
  todo: { label: "slashTodoLabel", description: "slashTodoDescription", keywords: "slashTodoKeywords" },
  quote: { label: "slashQuoteLabel", description: "slashQuoteDescription", keywords: "slashQuoteKeywords" },
  code: { label: "slashCodeLabel", description: "slashCodeDescription", keywords: "slashCodeKeywords" },
  divider: { label: "slashDividerLabel", description: "slashDividerDescription", keywords: "slashDividerKeywords" },
};

export interface SlashCommandItem extends BaseSlashCommandItem {
  icon: LucideIcon;
}

/** Hook 回傳已翻譯的 slash command items；必須在 client component 內使用 */
export function useSlashCommandItems(): SlashCommandItem[] {
  const t = useTranslations("editor");
  return useMemo(
    () =>
      SLASH_COMMAND_DEFS.map((def) => {
        const keys = ID_TO_KEY[def.id];
        return {
          ...def,
          icon: ID_TO_ICON[def.id],
          label: t(keys.label),
          description: t(keys.description),
          keywords: t(keys.keywords).split("|").filter(Boolean),
        };
      }),
    [t],
  );
}
