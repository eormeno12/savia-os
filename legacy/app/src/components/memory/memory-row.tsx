"use client";

import { Box, HStack, Stack, Text } from "@chakra-ui/react";

interface MemoryRowProps {
  text: string;
  /** Secondary line, e.g. "Claude · hace 4 min · Trabajo". */
  meta?: string;
  onClick?: () => void;
  /** Optional highlighted fragments rendered with a lime mark. */
  highlight?: string;
}

/** Render `text` with case-insensitive `highlight` wrapped in a lime mark. */
function withHighlight(text: string, highlight?: string) {
  if (!highlight) return text;
  const idx = text.toLowerCase().indexOf(highlight.toLowerCase());
  if (idx === -1) return text;
  return (
    <>
      {text.slice(0, idx)}
      <Box as="mark" bg="lime.solid" color="fg" px="0.5" rounded="xs">
        {text.slice(idx, idx + highlight.length)}
      </Box>
      {text.slice(idx + highlight.length)}
    </>
  );
}

/**
 * A single memory as a white card (mockup search/area rows). Clickable to open
 * the detail dialog; keyboard-operable.
 */
export function MemoryRow({ text, meta, onClick, highlight }: MemoryRowProps) {
  return (
    <Stack
      as={onClick ? "button" : "div"}
      gap="2"
      textAlign="start"
      bg="bg.panel"
      borderWidth="1px"
      borderColor="border"
      rounded="2xl"
      p="3.5"
      cursor={onClick ? "pointer" : "default"}
      onClick={onClick}
      _hover={onClick ? { borderColor: "fg.subtle" } : undefined}
    >
      <Text fontSize="14px" lineHeight="1.5" color="fg">
        {withHighlight(text, highlight)}
      </Text>
      {meta ? (
        <Text fontSize="12px" color="fg.muted">
          {meta}
        </Text>
      ) : null}
    </Stack>
  );
}

/** Section heading for grouped memory lists (e.g. by area). */
export function MemoryGroupHeading({ color, label }: { color: string; label: string }) {
  return (
    <HStack gap="2" mb="2.5">
      <Box w="2.5" h="2.5" rounded="full" bg={color} />
      <Text textStyle="label" color="fg.muted">
        {label}
      </Text>
    </HStack>
  );
}
