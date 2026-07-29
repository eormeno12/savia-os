"use client";

import { Box, Clipboard, IconButton } from "@chakra-ui/react";
import type { BoxProps } from "@chakra-ui/react";
import { Check, Copy } from "lucide-react";

export interface CopyBlockProps extends Omit<BoxProps, "children"> {
  /** The exact text shown in the block and copied to the clipboard. */
  value: string;
  /** Accessible label for the copy button. */
  copyLabel?: string;
}

/**
 * A read-only block of config/code on a dark surface with a copy button that
 * confirms on click. Used by the connection guide (C3), rescue prompt (O3) and
 * anywhere the user must copy an exact string.
 */
export function CopyBlock({
  value,
  copyLabel = "Copiar",
  ...rest
}: CopyBlockProps) {
  return (
    <Clipboard.Root value={value} position="relative" w="full">
      <Box
        as="pre"
        bg="bg.inverse"
        color="fg.inverse"
        borderRadius="message"
        p="4"
        pe="12"
        overflowX="auto"
        fontFamily="mono"
        fontSize="sm"
        lineHeight="1.6"
        whiteSpace="pre-wrap"
        wordBreak="break-word"
        {...rest}
      >
        {value}
      </Box>
      <Clipboard.Trigger asChild>
        <IconButton
          aria-label={copyLabel}
          size="xs"
          variant="subtle"
          position="absolute"
          top="2.5"
          insetEnd="2.5"
        >
          <Clipboard.Indicator copied={<Check size={14} />}>
            <Copy size={14} />
          </Clipboard.Indicator>
        </IconButton>
      </Clipboard.Trigger>
    </Clipboard.Root>
  );
}
