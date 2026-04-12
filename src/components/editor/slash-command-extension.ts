import { Extension } from "@tiptap/core";
import { ReactRenderer } from "@tiptap/react";
import Suggestion from "@tiptap/suggestion";
import tippy, { type Instance as TippyInstance } from "tippy.js";
import {
  SlashCommandMenu,
  type SlashCommandMenuRef,
} from "./slash-command-menu";
import {
  filterSlashItems,
  type SlashCommandItem,
} from "./slash-command-items";

interface SlashCommandExtensionOptions {
  items: SlashCommandItem[];
  suggestion: Record<string, unknown>;
}

export const slashCommandExtension = Extension.create<SlashCommandExtensionOptions>({
  name: "slashCommand",

  addOptions() {
    return {
      items: [],
      suggestion: {
        char: "/",
        command: ({
          editor,
          range,
          props,
        }: {
          editor: any;
          range: any;
          props: { item: SlashCommandItem };
        }) => {
          props.item.command({ editor, range });
        },
      },
    };
  },

  addProseMirrorPlugins() {
    const extensionOptions = this.options;
    return [
      Suggestion({
        editor: this.editor,
        ...(extensionOptions.suggestion as any),
        items: ({ query, editor }: { query: string; editor: any }) =>
          filterSlashItems(extensionOptions.items, query, editor),
        render: () => {
          let component: ReactRenderer<SlashCommandMenuRef> | null = null;
          let popup: TippyInstance[] = [];

          return {
            onStart: (props: any) => {
              component = new ReactRenderer(SlashCommandMenu, {
                props: {
                  items: props.items,
                  command: (item: SlashCommandItem) => {
                    props.command({ item });
                  },
                  editor: props.editor,
                  range: props.range,
                },
                editor: props.editor,
              });

              if (!props.clientRect) return;

              popup = tippy("body", {
                getReferenceClientRect: props.clientRect,
                appendTo: () => document.body,
                content: component.element,
                showOnCreate: true,
                interactive: true,
                trigger: "manual",
                placement: "bottom-start",
                offset: [0, 8],
              });
            },
            onUpdate: (props: any) => {
              component?.updateProps({
                items: props.items,
                command: (item: SlashCommandItem) => {
                  props.command({ item });
                },
                editor: props.editor,
                range: props.range,
              });
              if (popup[0]) {
                popup[0].setProps({
                  getReferenceClientRect: props.clientRect,
                });
              }
            },
            onKeyDown: (props: any) => {
              if (props.event.key === "Escape") {
                popup[0]?.hide();
                return true;
              }
              return component?.ref?.onKeyDown({ event: props.event }) ?? false;
            },
            onExit: () => {
              popup[0]?.destroy();
              component?.destroy();
              popup = [];
              component = null;
            },
          };
        },
      }),
    ];
  },
});
