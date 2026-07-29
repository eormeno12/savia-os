"use client";

import { Input, InputGroup, Kbd } from "@chakra-ui/react";
import type { InputProps } from "@chakra-ui/react";
import { Search } from "lucide-react";

export interface SearchBarProps extends InputProps {
  /** Show a ⌘K hint at the end (the global command-palette shortcut). */
  shortcutHint?: boolean;
}

/**
 * Prominent natural-language search field — the product's primary navigation
 * (Shell, Memoria, search results). A leading search icon and an optional ⌘K
 * hint sit inside the field.
 */
export function SearchBar({ shortcutHint, ...rest }: SearchBarProps) {
  return (
    <InputGroup
      startElement={<Search size={16} />}
      endElement={shortcutHint ? <Kbd>⌘K</Kbd> : undefined}
    >
      <Input placeholder="Buscar en tu memoria…" borderRadius="chip" {...rest} />
    </InputGroup>
  );
}
