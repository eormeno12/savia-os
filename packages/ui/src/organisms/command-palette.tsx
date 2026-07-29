"use client";

import {
  Combobox,
  Dialog,
  Portal,
  Span,
  useFilter,
  useListCollection,
} from "@chakra-ui/react";
import { useState, type ReactNode } from "react";

export interface CommandItem {
  /** Unique id used by `onSelect`. */
  value: string;
  /** Text shown and matched against the query. */
  label: string;
  /** Optional grouping/secondary hint shown at the end of the row. */
  group?: string;
  /** Optional leading icon. */
  icon?: ReactNode;
}

export interface CommandPaletteProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** All selectable entries (areas, saved searches, nav actions). */
  items: CommandItem[];
  placeholder?: string;
  emptyText?: string;
  /** Called with the chosen item's `value`; the palette closes after. */
  onSelect: (value: string) => void;
  /**
   * Called when the user submits free text (Enter) that isn't an item — the
   * "search my memory for this" fallback. The palette closes after.
   */
  onSubmitQuery?: (query: string) => void;
}

/**
 * Global ⌘K command palette: a filtered, keyboard-navigable list inside a modal.
 * Generic — the Shell injects `items` (areas, saved searches, nav) and handles
 * `onSelect`. Built on Chakra Combobox (filtering + a11y) inside Dialog.
 *
 * Note: list positioning gets a visual pass when mounted in the Shell (Fase 4).
 */
export function CommandPalette({
  open,
  onOpenChange,
  items,
  placeholder = "Buscar áreas, memorias, acciones…",
  emptyText = "Sin resultados",
  onSelect,
  onSubmitQuery,
}: CommandPaletteProps) {
  const [inputValue, setInputValue] = useState("");
  const { contains } = useFilter({ sensitivity: "base" });
  const { collection, filter } = useListCollection<CommandItem>({
    initialItems: items,
    itemToString: (item) => item.label,
    itemToValue: (item) => item.value,
    filter: contains,
  });

  return (
    <Dialog.Root
      open={open}
      onOpenChange={(e) => onOpenChange(e.open)}
      size="md"
      placement="top"
    >
      <Portal>
        <Dialog.Backdrop backdropFilter="blur(6px)" />
        <Dialog.Positioner>
          <Dialog.Content
            borderRadius="card"
            boxShadow="float"
            overflow="hidden"
          >
            <Combobox.Root
              open
              collection={collection}
              onInputValueChange={(e) => {
                setInputValue(e.inputValue);
                filter(e.inputValue);
              }}
              onValueChange={(e) => {
                const value = e.value[0];
                if (value) {
                  onSelect(value);
                  onOpenChange(false);
                }
              }}
              placeholder={placeholder}
            >
              <Combobox.Control>
                <Combobox.Input
                  borderWidth="0"
                  onKeyDown={(e) => {
                    if (
                      e.key === "Enter" &&
                      onSubmitQuery &&
                      inputValue.trim() &&
                      collection.items.length === 0
                    ) {
                      e.preventDefault();
                      onSubmitQuery(inputValue.trim());
                      onOpenChange(false);
                    }
                  }}
                />
              </Combobox.Control>
              <Combobox.Positioner>
                <Combobox.Content boxShadow="none" maxH="20rem" overflowY="auto">
                  <Combobox.Empty>{emptyText}</Combobox.Empty>
                  {collection.items.map((item) => (
                    <Combobox.Item key={item.value} item={item}>
                      {item.icon}
                      <Combobox.ItemText>{item.label}</Combobox.ItemText>
                      {item.group != null && (
                        <Span color="fg.muted" textStyle="xs" ms="auto">
                          {item.group}
                        </Span>
                      )}
                    </Combobox.Item>
                  ))}
                </Combobox.Content>
              </Combobox.Positioner>
            </Combobox.Root>
          </Dialog.Content>
        </Dialog.Positioner>
      </Portal>
    </Dialog.Root>
  );
}
