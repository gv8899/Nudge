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

export const slashCommandExtension = Extension.create({
  name: "slashCommand",

  addOptions() {
    return {
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
    return [
      Suggestion({
        editor: this.editor,
        ...this.options.suggestion,
        items: ({ query }: { query: string }) => filterSlashItems(query),
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
